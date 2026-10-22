const db = require("../config/db");

const Patient = {
  // Only active doctor accounts linked to active doctor profiles may be assigned.
  getAssignableDoctors: (callback) => {
    db.query(
      `SELECT u.id, u.full_name, d.doctor_number, d.specialization
       FROM users u
       JOIN doctors d ON d.id = u.doctor_id
       WHERE u.role = 'doctor' AND u.is_active = 1
         AND LOWER(COALESCE(d.status, 'active')) = 'active'
       ORDER BY u.full_name`,
      callback
    );
  },

  // Create a new patient
  create: (patient, user, callback) => {
    const sql = `
      INSERT INTO patients
      (patient_number, full_name, gender, date_of_birth, phone, email, address, emergency_contact, emergency_phone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      patient.patient_number,
      patient.full_name,
      patient.gender,
      patient.date_of_birth,
      patient.phone,
      patient.email,
      patient.address,
      patient.emergency_contact,
      patient.emergency_phone
    ];

    db.promise().getConnection().then(async (connection) => {
      try {
        await connection.beginTransaction();
        if (patient.doctor_user_id) {
          const [doctors] = await connection.query(
            `SELECT u.id
             FROM users u
             JOIN doctors d ON d.id = u.doctor_id
             WHERE u.id = ? AND u.role = 'doctor' AND u.is_active = 1
               AND LOWER(COALESCE(d.status, 'active')) = 'active'
             FOR UPDATE`,
            [patient.doctor_user_id]
          );
          if (!doctors.length) {
            const error = new Error("Selected doctor account is not active or was not found");
            error.code = "INVALID_DOCTOR_ASSIGNMENT";
            throw error;
          }
        }
        const [result] = await connection.query(sql, values);
        if (user.role === "receptionist") {
          await connection.query(
            "INSERT INTO patient_assignments (patient_id, user_id, assigned_by) VALUES (?, ?, ?)",
            [result.insertId, user.id, user.id]
          );
        }
        if (patient.doctor_user_id) {
          await connection.query(
            "INSERT INTO patient_assignments (patient_id, user_id, assigned_by) VALUES (?, ?, ?)",
            [result.insertId, patient.doctor_user_id, user.id]
          );
        }
        await connection.commit();
        callback(null, result);
      } catch (error) {
        await connection.rollback();
        callback(error);
      } finally {
        connection.release();
      }
    }).catch(callback);
  },

  // Get all patients
  getAll: (user, callback) => {
    let scope = "";
    let values = [];
    if (user.role === "doctor") {
      scope = "WHERE EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = patients.id AND a.doctor_id = ?) OR EXISTS (SELECT 1 FROM patient_assignments pa WHERE pa.patient_id = patients.id AND pa.user_id = ?)";
      values = [user.doctorId || 0, user.id];
    } else if (user.role === "nurse") {
      scope = "WHERE EXISTS (SELECT 1 FROM patient_assignments pa WHERE pa.patient_id = patients.id AND pa.user_id = ?)";
      values = [user.id];
    } else if (user.role === "receptionist") {
      scope = user.departmentId
        ? "WHERE EXISTS (SELECT 1 FROM patient_assignments pa JOIN users assigned ON assigned.id = pa.user_id WHERE pa.patient_id = patients.id AND assigned.role = 'receptionist' AND assigned.department_id = ?) OR EXISTS (SELECT 1 FROM appointments a JOIN doctors d ON d.id = a.doctor_id JOIN departments dep ON dep.department_name = d.department WHERE a.patient_id = patients.id AND dep.id = ?)"
        : "WHERE EXISTS (SELECT 1 FROM patient_assignments pa WHERE pa.patient_id = patients.id AND pa.user_id = ?)";
      values = user.departmentId ? [user.departmentId, user.departmentId] : [user.id];
    }
    const columns = user.role === "accountant"
      ? "id, patient_number, full_name"
      : "*";
    db.query(`SELECT ${columns} FROM patients ${scope} ORDER BY created_at DESC`, values, callback);
  },

  // Get one patient by ID
  getById: (id, user, callback) => {
    let scope = "";
    let values = [id];
    if (user.role === "doctor") {
      scope = "AND (EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = patients.id AND a.doctor_id = ?) OR EXISTS (SELECT 1 FROM patient_assignments pa WHERE pa.patient_id = patients.id AND pa.user_id = ?))";
      values.push(user.doctorId || 0, user.id);
    } else if (user.role === "nurse") {
      scope = "AND EXISTS (SELECT 1 FROM patient_assignments pa WHERE pa.patient_id = patients.id AND pa.user_id = ?)";
      values.push(user.id);
    } else if (user.role === "receptionist") {
      scope = user.departmentId
        ? "AND (EXISTS (SELECT 1 FROM patient_assignments pa JOIN users assigned ON assigned.id = pa.user_id WHERE pa.patient_id = patients.id AND assigned.role = 'receptionist' AND assigned.department_id = ?) OR EXISTS (SELECT 1 FROM appointments a JOIN doctors d ON d.id = a.doctor_id JOIN departments dep ON dep.department_name = d.department WHERE a.patient_id = patients.id AND dep.id = ?))"
        : "AND EXISTS (SELECT 1 FROM patient_assignments pa WHERE pa.patient_id = patients.id AND pa.user_id = ?)";
      if (user.departmentId) values.push(user.departmentId, user.departmentId);
      else values.push(user.id);
    }
    const columns = user.role === "accountant"
      ? "id, patient_number, full_name"
      : "*";
    db.query(`SELECT ${columns} FROM patients WHERE id = ? ${scope}`, values, callback);
  },

  // Update patient
  update: (id, patient, callback) => {
    const sql = `
      UPDATE patients
      SET patient_number = ?,
          full_name = ?,
          gender = ?,
          date_of_birth = ?,
          phone = ?,
          email = ?,
          address = ?,
          emergency_contact = ?,
          emergency_phone = ?
      WHERE id = ?
    `;

    const values = [
      patient.patient_number,
      patient.full_name,
      patient.gender,
      patient.date_of_birth,
      patient.phone,
      patient.email,
      patient.address,
      patient.emergency_contact,
      patient.emergency_phone,
      id
    ];

    db.query(sql, values, callback);
  },

  // Delete patient
  delete: (id, callback) => {
    const sql = "DELETE FROM patients WHERE id = ?";

    db.query(sql, [id], callback);
  }
};

module.exports = Patient;