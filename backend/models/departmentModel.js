const db = require("../config/db");

const Department = {
  // Create department
  create: (department, callback) => {
    const sql = `
      INSERT INTO departments
      (department_name, description, status)
      VALUES (?, ?, ?)
    `;

    const values = [
      department.department_name,
      department.description,
      department.status
    ];

    db.query(sql, values, callback);
  },

  // Get all departments
  getAll: (callback) => {
    const sql = "SELECT * FROM departments ORDER BY created_at DESC";

    db.query(sql, callback);
  },

  // Get department by ID
  getById: (id, callback) => {
    const sql = "SELECT * FROM departments WHERE id = ?";

    db.query(sql, [id], callback);
  },

  // Update department
  update: (id, department, callback) => {
    const sql = `
      UPDATE departments
      SET department_name = ?,
          description = ?,
          status = ?
      WHERE id = ?
    `;

    const values = [
      department.department_name,
      department.description,
      department.status,
      id
    ];

    db.query(sql, values, callback);
  },

  // Delete department
  delete: (id, callback) => {
    const sql = "DELETE FROM departments WHERE id = ?";

    db.query(sql, [id], callback);
  }
};

module.exports = Department;