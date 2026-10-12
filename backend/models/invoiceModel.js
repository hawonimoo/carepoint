const db = require("../config/db");

const Invoice = {
  // Create invoice
  create: (invoice, callback) => {
    const sql = `
      INSERT INTO invoices
      (
        invoice_number,
        patient_id,
        appointment_id,
        invoice_date,
        subtotal,
        discount,
        tax,
        total_amount,
        paid_amount,
        balance,
        payment_status,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      invoice.invoice_number,
      invoice.patient_id,
      invoice.appointment_id,
      invoice.invoice_date,
      invoice.subtotal,
      invoice.discount,
      invoice.tax,
      invoice.total_amount,
      invoice.paid_amount,
      invoice.balance,
      invoice.payment_status,
      invoice.notes
    ];

    db.query(sql, values, callback);
  },

  // Get all invoices
  getAll: (callback) => {
    const sql = `
      SELECT
        invoices.*,
        patients.full_name AS patient_name
      FROM invoices
      JOIN patients
        ON invoices.patient_id = patients.id
      LEFT JOIN appointments
        ON invoices.appointment_id = appointments.id
      ORDER BY invoices.id DESC
    `;

    db.query(sql, callback);
  },

  // Get invoice by ID
  getById: (id, callback) => {
    const sql = `
      SELECT
        invoices.*,
        patients.full_name AS patient_name
      FROM invoices
      JOIN patients
        ON invoices.patient_id = patients.id
      LEFT JOIN appointments
        ON invoices.appointment_id = appointments.id
      WHERE invoices.id = ?
    `;

    db.query(sql, [id], callback);
  },

  // Update invoice
  update: (id, invoice, callback) => {
    const sql = `
      UPDATE invoices
      SET invoice_number = ?,
          patient_id = ?,
          appointment_id = ?,
          invoice_date = ?,
          subtotal = ?,
          discount = ?,
          tax = ?,
          total_amount = ?,
          paid_amount = ?,
          balance = ?,
          payment_status = ?,
          notes = ?
      WHERE id = ?
    `;

    const values = [
      invoice.invoice_number,
      invoice.patient_id,
      invoice.appointment_id,
      invoice.invoice_date,
      invoice.subtotal,
      invoice.discount,
      invoice.tax,
      invoice.total_amount,
      invoice.paid_amount,
      invoice.balance,
      invoice.payment_status,
      invoice.notes,
      id
    ];

    db.query(sql, values, callback);
  },

  // Delete invoice
  delete: (id, callback) => {
    const sql = `
      DELETE FROM invoices
      WHERE id = ?
    `;

    db.query(sql, [id], callback);
  }
};

module.exports = Invoice;