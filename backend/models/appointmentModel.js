const db = require("../config/db");

const Appointment = {
  // Create appointment
  create: (appointment, callback) => {
    const sql = `
      INSERT INTO appointments
      (
        appointment_number,
        patient_id,
        doctor_id,
        appointment_date,
        appointment_time,
        reason,
        status,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      appointment.appointment_number,
      appointment.patient_id,
      appointment.doctor_id,
      appointment.appointment_date,
      appointment.appointment_time,
      appointment.reason,
      appointment.status,
      appointment.notes
    ];

    db.query(sql, values, callback);
  },

  // Get all appointments
  getAll: (callback) => {
    const sql = `
      SELECT
        appointments.*,
        patients.full_name AS patient_name,
        doctors.full_name AS doctor_name
      FROM appointments
      JOIN patients ON appointments.patient_id = patients.id
      JOIN doctors ON appointments.doctor_id = doctors.id
      ORDER BY appointment_date DESC, appointment_time DESC
    `;

    db.query(sql, callback);
  },

  // Get appointment by ID
  getById: (id, callback) => {
    const sql = `
      SELECT
        appointments.*,
        patients.full_name AS patient_name,
        doctors.full_name AS doctor_name
      FROM appointments
      JOIN patients ON appointments.patient_id = patients.id
      JOIN doctors ON appointments.doctor_id = doctors.id
      WHERE appointments.id = ?
    `;

    db.query(sql, [id], callback);
  },

  // Update appointment
  update: (id, appointment, callback) => {
    const sql = `
      UPDATE appointments
      SET appointment_number = ?,
          patient_id = ?,
          doctor_id = ?,
          appointment_date = ?,
          appointment_time = ?,
          reason = ?,
          status = ?,
          notes = ?
      WHERE id = ?
    `;

    const values = [
      appointment.appointment_number,
      appointment.patient_id,
      appointment.doctor_id,
      appointment.appointment_date,
      appointment.appointment_time,
      appointment.reason,
      appointment.status,
      appointment.notes,
      id
    ];

    db.query(sql, values, callback);
  },

  // Delete appointment
  delete: (id, callback) => {
    const sql = "DELETE FROM appointments WHERE id = ?";

    db.query(sql, [id], callback);
  }
};

module.exports = Appointment;