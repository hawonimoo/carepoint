const db = require("../config/db");

const MedicalRecord = {
  // Create medical record
  create: (record, callback) => {
    const sql = `
      INSERT INTO medical_records
      (
        record_number,
        patient_id,
        doctor_id,
        appointment_id,
        symptoms,
        diagnosis,
        treatment,
        prescription,
        notes,
        follow_up_date
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      record.record_number,
      record.patient_id,
      record.doctor_id,
      record.appointment_id,
      record.symptoms,
      record.diagnosis,
      record.treatment,
      record.prescription,
      record.notes,
      record.follow_up_date
    ];

    db.query(sql, values, callback);
  },

  // Get all medical records
  getAll: (user, callback) => {
    const scope = user.role === "doctor" ? "WHERE medical_records.doctor_id = ?" : "";
    const values = user.role === "doctor" ? [user.doctorId || 0] : [];
    const sql = `
      SELECT
        medical_records.*,
        patients.full_name AS patient_name,
        doctors.full_name AS doctor_name
      FROM medical_records
      JOIN patients
        ON medical_records.patient_id = patients.id
      JOIN doctors
        ON medical_records.doctor_id = doctors.id
      LEFT JOIN appointments
        ON medical_records.appointment_id = appointments.id
      ${scope}
      ORDER BY medical_records.id DESC
    `;

    db.query(sql, values, callback);
  },

  // Get medical record by ID
  getById: (id, user, callback) => {
    const scope = user.role === "doctor" ? "AND medical_records.doctor_id = ?" : "";
    const values = user.role === "doctor" ? [id, user.doctorId || 0] : [id];
    const sql = `
      SELECT
        medical_records.*,
        patients.full_name AS patient_name,
        doctors.full_name AS doctor_name
      FROM medical_records
      JOIN patients
        ON medical_records.patient_id = patients.id
      JOIN doctors
        ON medical_records.doctor_id = doctors.id
      LEFT JOIN appointments
        ON medical_records.appointment_id = appointments.id
      WHERE medical_records.id = ? ${scope}
    `;

    db.query(sql, values, callback);
  },

  // Update medical record
  update: (id, record, user, callback) => {
    const scope = user.role === "doctor" ? " AND doctor_id = ?" : "";
    const sql = `
      UPDATE medical_records
      SET record_number = ?,
          patient_id = ?,
          doctor_id = ?,
          appointment_id = ?,
          symptoms = ?,
          diagnosis = ?,
          treatment = ?,
          prescription = ?,
          notes = ?,
          follow_up_date = ?
      WHERE id = ?${scope}
    `;

    const values = [
      record.record_number,
      record.patient_id,
      record.doctor_id,
      record.appointment_id,
      record.symptoms,
      record.diagnosis,
      record.treatment,
      record.prescription,
      record.notes,
      record.follow_up_date,
      id,
      ...(user.role === "doctor" ? [user.doctorId || 0] : [])
    ];

    db.query(sql, values, callback);
  },

  // Delete medical record
  delete: (id, callback) => {
    const sql = `
      DELETE FROM medical_records
      WHERE id = ?
    `;

    db.query(sql, [id], callback);
  }
};

module.exports = MedicalRecord;