const db = require("../config/db");

const Doctor = {
  // Create doctor
  create: (doctor, callback) => {
    const sql = `
      INSERT INTO doctors
      (doctor_number, full_name, gender, specialization, phone, email, department, consultation_fee, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      doctor.doctor_number,
      doctor.full_name,
      doctor.gender,
      doctor.specialization,
      doctor.phone,
      doctor.email,
      doctor.department,
      doctor.consultation_fee,
      doctor.status
    ];

    db.query(sql, values, callback);
  },

  // Get all doctors
  getAll: (callback) => {
    const sql = "SELECT * FROM doctors ORDER BY created_at DESC";

    db.query(sql, callback);
  },

  // Get doctor by ID
  getById: (id, callback) => {
    const sql = "SELECT * FROM doctors WHERE id = ?";

    db.query(sql, [id], callback);
  },

  // Update doctor
  update: (id, doctor, callback) => {
    const sql = `
      UPDATE doctors
      SET doctor_number = ?,
          full_name = ?,
          gender = ?,
          specialization = ?,
          phone = ?,
          email = ?,
          department = ?,
          consultation_fee = ?,
          status = ?
      WHERE id = ?
    `;

    const values = [
      doctor.doctor_number,
      doctor.full_name,
      doctor.gender,
      doctor.specialization,
      doctor.phone,
      doctor.email,
      doctor.department,
      doctor.consultation_fee,
      doctor.status,
      id
    ];

    db.query(sql, values, callback);
  },

  // Delete doctor
  delete: (id, callback) => {
    const sql = "DELETE FROM doctors WHERE id = ?";

    db.query(sql, [id], callback);
  }
};

module.exports = Doctor;