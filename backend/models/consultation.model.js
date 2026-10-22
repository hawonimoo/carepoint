const db = require("../config/db");

const CONSULTATION_SELECT = `
  SELECT c.id, c.patient_id, c.doctor_id,
         c.chief_complaint, c.symptoms, c.examination_findings,
         c.diagnosis, c.treatment_plan, c.follow_up_instructions,
         DATE_FORMAT(c.consultation_date, '%Y-%m-%dT%H:%i:%s') AS consultation_date,
         c.created_at, c.updated_at,
         p.full_name AS patient_name, p.patient_number,
         d.full_name AS doctor_name
  FROM consultations c
  JOIN patients p ON p.id = c.patient_id
  JOIN doctors d ON d.id = c.doctor_id
`;

const DOCTOR_PATIENT_ACCESS = `(
  EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.patient_id = c.patient_id AND a.doctor_id = ?
  )
  OR EXISTS (
    SELECT 1 FROM patient_assignments pa
    WHERE pa.patient_id = c.patient_id AND pa.user_id = ?
  )
)`;

async function hasPatientAccess(patientId, doctorId, userId) {
  const [rows] = await db.promise().query(
    `SELECT p.id FROM patients p
     WHERE p.id = ? AND (
       EXISTS (
         SELECT 1 FROM appointments a
         WHERE a.patient_id = p.id AND a.doctor_id = ?
       )
       OR EXISTS (
         SELECT 1 FROM patient_assignments pa
         WHERE pa.patient_id = p.id AND pa.user_id = ?
       )
     )
     LIMIT 1`,
    [patientId, doctorId, userId]
  );
  return rows.length > 0;
}

async function createForDoctor(consultation, doctorId, userId) {
  if (!(await hasPatientAccess(consultation.patient_id, doctorId, userId))) {
    const error = new Error("The patient is not assigned to this doctor");
    error.code = "CONSULTATION_PATIENT_FORBIDDEN";
    throw error;
  }

  const [result] = await db.promise().query(
    `INSERT INTO consultations
       (patient_id, doctor_id, chief_complaint, symptoms, examination_findings,
        diagnosis, treatment_plan, follow_up_instructions, consultation_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      consultation.patient_id,
      doctorId,
      consultation.chief_complaint,
      consultation.symptoms,
      consultation.examination_findings,
      consultation.diagnosis,
      consultation.treatment_plan,
      consultation.follow_up_instructions,
      consultation.consultation_date,
    ]
  );
  return result.insertId;
}

async function listForDoctor(doctorId, userId, patientId = null) {
  const patientFilter = patientId === null ? "" : " AND c.patient_id = ?";
  const values = patientId === null
    ? [doctorId, doctorId, userId]
    : [doctorId, doctorId, userId, patientId];
  const [rows] = await db.promise().query(
    `${CONSULTATION_SELECT}
     WHERE c.doctor_id = ? AND ${DOCTOR_PATIENT_ACCESS}${patientFilter}
     ORDER BY c.consultation_date DESC, c.id DESC`,
    values
  );
  return rows;
}

async function listAll(patientId = null) {
  const patientFilter = patientId === null ? "" : " WHERE c.patient_id = ?";
  const [rows] = await db.promise().query(
    `${CONSULTATION_SELECT}${patientFilter}
     ORDER BY c.consultation_date DESC, c.id DESC`,
    patientId === null ? [] : [patientId]
  );
  return rows;
}

async function getForDoctor(id, doctorId, userId) {
  const [rows] = await db.promise().query(
    `${CONSULTATION_SELECT}
     WHERE c.id = ? AND c.doctor_id = ? AND ${DOCTOR_PATIENT_ACCESS}
     LIMIT 1`,
    [id, doctorId, doctorId, userId]
  );
  return rows[0] || null;
}

async function getForAdministrator(id) {
  const [rows] = await db.promise().query(
    `${CONSULTATION_SELECT} WHERE c.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

module.exports = {
  createForDoctor,
  getForAdministrator,
  getForDoctor,
  hasPatientAccess,
  listAll,
  listForDoctor,
};
