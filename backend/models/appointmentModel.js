const db = require("../config/db");

const APPOINTMENT_SELECT = `
  SELECT a.id, a.appointment_number, a.patient_id, a.doctor_id,
         DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
         a.appointment_time, a.reason, a.status,
         p.full_name AS patient_name, d.full_name AS doctor_name
  FROM appointments a
  JOIN patients p ON a.patient_id = p.id
  JOIN doctors d ON a.doctor_id = d.id
`;

function scopeFor(user) {
  if (user.role === "doctor") {
    return { where: "a.doctor_id = ?", values: [user.doctorId || 0] };
  }
  if (user.role === "nurse") {
    return {
      where: "EXISTS (SELECT 1 FROM patient_assignments pa WHERE pa.patient_id = a.patient_id AND pa.user_id = ?)",
      values: [user.id],
    };
  }
  if (user.role === "receptionist") {
    return user.departmentId
      ? {
          where: "d.department = (SELECT department_name FROM departments WHERE id = ?)",
          values: [user.departmentId],
        }
      : { where: "1 = 0", values: [] };
  }
  return { where: "", values: [] };
}

async function getAll(user) {
  const scope = scopeFor(user);
  const where = scope.where ? `WHERE ${scope.where}` : "";
  const [rows] = await db.promise().query(
    `${APPOINTMENT_SELECT} ${where} ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
    scope.values
  );
  return rows;
}

async function getById(id, user) {
  const scope = scopeFor(user);
  const where = [ "a.id = ?", scope.where ].filter(Boolean).join(" AND ");
  const [rows] = await db.promise().query(
    `${APPOINTMENT_SELECT} WHERE ${where} LIMIT 1`,
    [id, ...scope.values]
  );
  return rows[0] || null;
}

async function notifyAppointment(connection, appointment, eventType, actorId) {
  const [doctors] = await connection.query(
    "SELECT id FROM users WHERE doctor_id = ? AND role = 'doctor' AND is_active = 1 LIMIT 1",
    [appointment.doctor_id]
  );
  const doctorUserId = doctors[0]?.id ?? null;
  const appointmentDate = String(appointment.appointment_date).slice(0, 10);
  const date = new Date(`${appointmentDate}T00:00:00Z`).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const time = String(appointment.appointment_time).slice(0, 5);
  const message = `CarePoint appointment ${eventType}: ${appointment.patient_name} with ${appointment.doctor_name} on ${date} at ${time}.`;

  await connection.query(
    `INSERT INTO notifications
      (recipient_user_id, patient_id, appointment_id, event_type, channel, status, message, error, sent_at)
     VALUES (?, ?, ?, ?, 'in_app', ?, ?, ?, IF(? = 'sent', CURRENT_TIMESTAMP, NULL))`,
    [
      doctorUserId,
      appointment.patient_id,
      appointment.id,
      eventType,
      doctorUserId ? "sent" : "unavailable",
      `Doctor notification: ${message}`,
      doctorUserId ? null : "No active staff account is linked to the assigned doctor.",
      doctorUserId ? "sent" : "unavailable",
    ]
  );
  await connection.query(
    `INSERT INTO notifications
      (recipient_user_id, patient_id, appointment_id, event_type, channel, status, message, error, sent_at)
     VALUES (NULL, ?, ?, ?, 'in_app', 'unavailable', ?, ?, NULL)`,
    [
      appointment.patient_id,
      appointment.id,
      eventType,
      `Patient notification: ${message}`,
      "Patient accounts/portal are not configured; no patient notification was delivered.",
    ]
  );
  await connection.query(
    `INSERT INTO audit_logs
      (user_id, action, entity_type, entity_id, metadata)
     VALUES (?, ?, 'appointment', ?, ?)`,
    [actorId, `appointment.${eventType}`, String(appointment.id), JSON.stringify({
      patient_id: appointment.patient_id,
      doctor_id: appointment.doctor_id,
      appointment_date: appointment.appointment_date,
      appointment_time: appointment.appointment_time,
    })]
  );
}

async function transaction(work) {
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function lockDoctor(connection, doctorIds) {
  const ids = [...new Set(doctorIds.map(Number))].sort((a, b) => a - b);
  for (const id of ids) {
    const [rows] = await connection.query("SELECT id FROM doctors WHERE id = ? FOR UPDATE", [id]);
    if (!rows.length) {
      const error = new Error("Assigned doctor was not found");
      error.code = "INVALID_DOCTOR";
      throw error;
    }
  }
}

async function ensureSlotAvailable(connection, appointment, excludeId = null) {
  const [rows] = await connection.query(
    `SELECT id FROM appointments
     WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ?
       AND COALESCE(status, 'Scheduled') NOT IN ('Cancelled', 'No Show')
       AND (? IS NULL OR id <> ?)
     LIMIT 1 FOR UPDATE`,
    [
      appointment.doctor_id,
      appointment.appointment_date,
      appointment.appointment_time,
      excludeId,
      excludeId,
    ]
  );
  if (rows.length) {
    const error = new Error("The doctor already has an appointment at that date and time");
    error.code = "APPOINTMENT_CONFLICT";
    throw error;
  }
}

async function appointmentWithNames(connection, id) {
  const [rows] = await connection.query(
    `SELECT a.id, a.appointment_number, a.patient_id, a.doctor_id,
          DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
          a.appointment_time, a.reason, a.status,
            p.full_name AS patient_name, d.full_name AS doctor_name
     FROM appointments a
     JOIN patients p ON a.patient_id = p.id
     JOIN doctors d ON a.doctor_id = d.id
     WHERE a.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function ensureReceptionDepartment(connection, actor, doctorId) {
  if (actor.role !== "receptionist") return;
  if (!actor.departmentId) {
    const error = new Error("Receptionist account has no department assignment");
    error.code = "DEPARTMENT_REQUIRED";
    throw error;
  }
  const [rows] = await connection.query(
    `SELECT d.id FROM doctors d
     JOIN departments dep ON dep.department_name = d.department
     WHERE d.id = ? AND dep.id = ? LIMIT 1`,
    [doctorId, actor.departmentId]
  );
  if (!rows.length) {
    const error = new Error("Assigned doctor is outside your department");
    error.code = "DEPARTMENT_FORBIDDEN";
    throw error;
  }
}

async function ensureReceptionPatient(connection, actor, patientId) {
  if (actor.role !== "receptionist") return;
  const [rows] = await connection.query(
    `SELECT p.id FROM patients p
     WHERE p.id = ? AND (
       EXISTS (
         SELECT 1 FROM patient_assignments pa
         JOIN users assigned ON assigned.id = pa.user_id
         WHERE pa.patient_id = p.id AND assigned.role = 'receptionist'
           AND assigned.department_id = ?
       ) OR EXISTS (
         SELECT 1 FROM appointments a
         JOIN doctors d ON d.id = a.doctor_id
         JOIN departments dep ON dep.department_name = d.department
         WHERE a.patient_id = p.id AND dep.id = ?
       )
     ) LIMIT 1`,
    [patientId, actor.departmentId || 0, actor.departmentId || 0]
  );
  if (!rows.length) {
    const error = new Error("Patient is not available to your department");
    error.code = "DEPARTMENT_FORBIDDEN";
    throw error;
  }
}

async function create(appointment, actor) {
  return transaction(async (connection) => {
    await ensureReceptionDepartment(connection, actor, appointment.doctor_id);
    await ensureReceptionPatient(connection, actor, appointment.patient_id);
    await lockDoctor(connection, [appointment.doctor_id]);
    await ensureSlotAvailable(connection, appointment);
    const [result] = await connection.query(
      `INSERT INTO appointments
        (appointment_number, patient_id, doctor_id, appointment_date, appointment_time, reason, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        appointment.appointment_number,
        appointment.patient_id,
        appointment.doctor_id,
        appointment.appointment_date,
        appointment.appointment_time,
        appointment.reason || null,
        appointment.status || "Scheduled",
        appointment.notes || null,
      ]
    );
    const saved = await appointmentWithNames(connection, result.insertId);
    await notifyAppointment(connection, saved, "scheduled", actor.id);
    return result.insertId;
  });
}

async function update(id, appointment, actor) {
  return transaction(async (connection) => {
    const [oldRows] = await connection.query(
      `SELECT a.doctor_id, a.patient_id,
              DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
              a.appointment_time FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       WHERE a.id = ? FOR UPDATE`,
      [id]
    );
    if (!oldRows.length) return false;
    const oldDate = String(oldRows[0].appointment_date).slice(0, 10);
    const newDate = String(appointment.appointment_date).slice(0, 10);
    const scheduleChanged =
      Number(oldRows[0].doctor_id) !== Number(appointment.doctor_id) ||
      Number(oldRows[0].patient_id) !== Number(appointment.patient_id) ||
      oldDate !== newDate ||
      String(oldRows[0].appointment_time).slice(0, 5) !== String(appointment.appointment_time).slice(0, 5);
    if (
      scheduleChanged &&
      new Date(`${newDate}T00:00:00Z`) < new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
    ) {
      const error = new Error("Appointments cannot be rescheduled into the past");
      error.code = "PAST_APPOINTMENT";
      throw error;
    }
    if (actor.role === "receptionist") {
      const [department] = await connection.query(
        `SELECT a.id FROM appointments a JOIN doctors d ON d.id = a.doctor_id
         JOIN departments dep ON dep.department_name = d.department
         WHERE a.id = ? AND dep.id = ? LIMIT 1`,
        [id, actor.departmentId || 0]
      );
      if (!department.length) return false;
    }
    await ensureReceptionDepartment(connection, actor, appointment.doctor_id);
    await ensureReceptionPatient(connection, actor, appointment.patient_id);
    await lockDoctor(connection, [oldRows[0].doctor_id, appointment.doctor_id]);
    if (appointment.status !== "Cancelled") {
      await ensureSlotAvailable(connection, appointment, id);
    }
    await connection.query(
      `UPDATE appointments
       SET appointment_number = ?, patient_id = ?, doctor_id = ?, appointment_date = ?,
           appointment_time = ?, reason = ?, status = ?, notes = ?
       WHERE id = ?`,
      [
        appointment.appointment_number,
        appointment.patient_id,
        appointment.doctor_id,
        appointment.appointment_date,
        appointment.appointment_time,
        appointment.reason || null,
        appointment.status || "Scheduled",
        appointment.notes || null,
        id,
      ]
    );
    const saved = await appointmentWithNames(connection, id);
    const eventType = saved.status === "Cancelled" ? "cancelled" : "changed";
    await notifyAppointment(connection, saved, eventType, actor.id);
    return true;
  });
}

async function cancel(id, actor) {
  return transaction(async (connection) => {
    const [rows] = await connection.query(
      `SELECT a.id FROM appointments a JOIN doctors d ON d.id = a.doctor_id
       WHERE a.id = ? FOR UPDATE`,
      [id]
    );
    if (!rows.length) return false;
    if (actor.role === "receptionist") {
      const [department] = await connection.query(
        `SELECT a.id FROM appointments a JOIN doctors d ON d.id = a.doctor_id
         JOIN departments dep ON dep.department_name = d.department
         WHERE a.id = ? AND dep.id = ? LIMIT 1`,
        [id, actor.departmentId || 0]
      );
      if (!department.length) return false;
    }
    await connection.query("UPDATE appointments SET status = 'Cancelled' WHERE id = ?", [id]);
    const saved = await appointmentWithNames(connection, id);
    await notifyAppointment(connection, saved, "cancelled", actor.id);
    return true;
  });
}

module.exports = { getAll, getById, create, update, cancel };
