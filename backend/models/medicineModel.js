const db = require("../config/db");

const Medicine = {
  // Create medicine
  create: (medicine, callback) => {
    const sql = `
      INSERT INTO medicines
      (
        medicine_number,
        medicine_name,
        category,
        description,
        quantity,
        unit_price,
        expiry_date,
        supplier,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      medicine.medicine_number,
      medicine.medicine_name,
      medicine.category,
      medicine.description,
      medicine.quantity,
      medicine.unit_price,
      medicine.expiry_date,
      medicine.supplier,
      medicine.status
    ];

    db.query(sql, values, callback);
  },

  // Get all medicines
  getAll: (callback) => {
    const sql = `
      SELECT *
      FROM medicines
      ORDER BY created_at DESC
    `;

    db.query(sql, callback);
  },

  // Get medicine by ID
  getById: (id, callback) => {
    const sql = `
      SELECT *
      FROM medicines
      WHERE id = ?
    `;

    db.query(sql, [id], callback);
  },

  // Update medicine
  update: (id, medicine, callback) => {
    const sql = `
      UPDATE medicines
      SET medicine_number = ?,
          medicine_name = ?,
          category = ?,
          description = ?,
          quantity = ?,
          unit_price = ?,
          expiry_date = ?,
          supplier = ?,
          status = ?
      WHERE id = ?
    `;

    const values = [
      medicine.medicine_number,
      medicine.medicine_name,
      medicine.category,
      medicine.description,
      medicine.quantity,
      medicine.unit_price,
      medicine.expiry_date,
      medicine.supplier,
      medicine.status,
      id
    ];

    db.query(sql, values, callback);
  },

  // Delete medicine
  delete: (id, callback) => {
    const sql = `
      DELETE FROM medicines
      WHERE id = ?
    `;

    db.query(sql, [id], callback);
  }
};

module.exports = Medicine;