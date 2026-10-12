const db = require("../config/db");

const Patient = {
  // Create a new patient
  create: (patient, callback) => {
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

    db.query(sql, values, callback);
  },

  // Get all patients
  getAll: (callback) => {
    const sql = "SELECT * FROM patients ORDER BY created_at DESC";

    db.query(sql, callback);
  },

  // Get one patient by ID
  getById: (id, callback) => {
    const sql = "SELECT * FROM patients WHERE id = ?";

    db.query(sql, [id], callback);
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