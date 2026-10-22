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

    const total = Number(invoice.total_amount);
    const values = [
      invoice.invoice_number,
      invoice.patient_id,
      invoice.appointment_id,
      invoice.invoice_date,
      invoice.subtotal,
      invoice.discount,
      invoice.tax,
      total,
      0,
      total,
      "Unpaid",
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
    db.promise().getConnection().then(async (connection) => {
      let result;
      let failure;
      try {
        await connection.beginTransaction();
        const [existing] = await connection.query(
          "SELECT patient_id FROM invoices WHERE id = ? FOR UPDATE",
          [id]
        );
        if (!existing.length) {
          await connection.rollback();
          result = { affectedRows: 0 };
        } else {
          const [totals] = await connection.query(
            "SELECT COALESCE(SUM(amount), 0) AS paid_amount FROM payments WHERE invoice_id = ?",
            [id]
          );
          const paid = Number(totals[0].paid_amount);
          if (paid > Number(invoice.total_amount) + 0.000001) {
            const error = new Error("Invoice total cannot be reduced below payments already received");
            error.code = "INVOICE_TOTAL_BELOW_PAYMENTS";
            throw error;
          }
          if (paid > 0 && Number(existing[0].patient_id) !== Number(invoice.patient_id)) {
            const error = new Error("An invoice with payments cannot be reassigned to another patient");
            error.code = "INVOICE_PATIENT_HAS_PAYMENTS";
            throw error;
          }
          const balance = Math.max(0, Number(invoice.total_amount) - paid);
          const status = Number(invoice.total_amount) > 0 && paid >= Number(invoice.total_amount)
            ? "Paid"
            : paid > 0
              ? "Partially Paid"
              : "Unpaid";
          const [updated] = await connection.query(
            `UPDATE invoices
             SET invoice_number = ?, patient_id = ?, appointment_id = ?, invoice_date = ?,
                 subtotal = ?, discount = ?, tax = ?, total_amount = ?, paid_amount = ?,
                 balance = ?, payment_status = ?, notes = ?
             WHERE id = ?`,
            [
              invoice.invoice_number,
              invoice.patient_id,
              invoice.appointment_id,
              invoice.invoice_date,
              invoice.subtotal,
              invoice.discount,
              invoice.tax,
              invoice.total_amount,
              paid,
              balance,
              status,
              invoice.notes,
              id,
            ]
          );
          await connection.commit();
          result = updated.affectedRows ? updated : { ...updated, affectedRows: 1 };
        }
      } catch (error) {
        failure = error;
        try {
          await connection.rollback();
        } catch (rollbackError) {
          failure = rollbackError;
        }
      } finally {
        connection.release();
      }
      callback(failure, result);
    }).catch(callback);
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