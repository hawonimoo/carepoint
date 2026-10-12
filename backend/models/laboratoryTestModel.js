const db = require("../config/db");

const LaboratoryTest = {
  // Create laboratory test
  create: (test, callback) => {
    const sql = `
      INSERT INTO laboratory_tests
      (
        test_number,
        patient_id,
        doctor_id,
        test_name,
        test_type,
        sample_type,
        test_date,
        result,
        normal_range,
        status,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      test.test_number,
      test.patient_id,
      test.doctor_id,
      test.test_name,
      test.test_type,
      test.sample_type,
      test.test_date,
      test.result,
      test.normal_range,
      test.status,
      test.notes
    ];

    db.query(sql, values, callback);
  },

  // Get all laboratory tests
  getAll: (callback) => {
    const sql = `
      SELECT
        laboratory_tests.*,
        patients.full_name AS patient_name,
        doctors.full_name AS doctor_name
      FROM laboratory_tests
      JOIN patients
        ON laboratory_tests.patient_id = patients.id
      JOIN doctors
        ON laboratory_tests.doctor_id = doctors.id
      ORDER BY laboratory_tests.id DESC
    `;

    db.query(sql, callback);
  },

  // Get laboratory test by ID
  getById: (id, callback) => {
    const sql = `
      SELECT
        laboratory_tests.*,
        patients.full_name AS patient_name,
        doctors.full_name AS doctor_name
      FROM laboratory_tests
      JOIN patients
        ON laboratory_tests.patient_id = patients.id
      JOIN doctors
        ON laboratory_tests.doctor_id = doctors.id
      WHERE laboratory_tests.id = ?
    `;

    db.query(sql, [id], callback);
  },

  // Update laboratory test
  update: (id, test, callback) => {
    const sql = `
      UPDATE laboratory_tests
      SET test_number = ?,
          patient_id = ?,
          doctor_id = ?,
          test_name = ?,
          test_type = ?,
          sample_type = ?,
          test_date = ?,
          result = ?,
          normal_range = ?,
          status = ?,
          notes = ?
      WHERE id = ?
    `;

    const values = [
      test.test_number,
      test.patient_id,
      test.doctor_id,
      test.test_name,
      test.test_type,
      test.sample_type,
      test.test_date,
      test.result,
      test.normal_range,
      test.status,
      test.notes,
      id
    ];

    db.query(sql, values, callback);
  },

  // Delete laboratory test
  delete: (id, callback) => {
    const sql = `
      DELETE FROM laboratory_tests
      WHERE id = ?
    `;

    db.query(sql, [id], callback);
  }
};

module.exports = LaboratoryTest;