const db = require("../config/db");

function scopeFor(user) {
  if (user.role === "doctor") {
    return { sql: "WHERE laboratory_tests.doctor_id = ?", values: [user.doctorId || 0] };
  }
  if (user.role === "laboratory_staff") {
    return {
      sql: "WHERE EXISTS (SELECT 1 FROM departments dep WHERE dep.department_name = doctors.department AND dep.id = ?)",
      values: [user.departmentId || 0],
    };
  }
  return { sql: "", values: [] };
}

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
  getAll: (user, callback) => {
    const scope = scopeFor(user);
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
      ${scope.sql}
      ORDER BY laboratory_tests.id DESC
    `;

    db.query(sql, scope.values, callback);
  },

  // Get laboratory test by ID
  getById: (id, user, callback) => {
    const scope = scopeFor(user);
    const scopeSql = scope.sql ? `AND ${scope.sql.slice("WHERE ".length)}` : "";
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
      WHERE laboratory_tests.id = ? ${scopeSql}
    `;

    db.query(sql, [id, ...scope.values], callback);
  },

  updateResult: (id, values, user, callback) => {
    db.query(
      `UPDATE laboratory_tests
       JOIN doctors ON doctors.id = laboratory_tests.doctor_id
       JOIN departments dep ON dep.department_name = doctors.department
       SET laboratory_tests.result = ?, laboratory_tests.status = ?, laboratory_tests.notes = ?
       WHERE laboratory_tests.id = ? AND dep.id = ?`,
      [values.result ?? null, values.status, values.notes ?? null, id, user.departmentId || 0],
      callback
    );
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