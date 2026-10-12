
const db = require("../config/db");

// Recalculate an invoice using all its recorded payments
const updateInvoiceBalance = (invoiceId, callback) => {
    const sql = `
        SELECT
            total_amount,
            COALESCE(
                (SELECT SUM(amount)
                 FROM payments
                 WHERE invoice_id = invoices.id),
                0
            ) AS paid_amount
        FROM invoices
        WHERE id = ?
    `;

    db.query(sql, [invoiceId], (err, results) => {
        if (err) return callback(err);

        if (results.length === 0) {
            return callback(new Error("Invoice not found"));
        }

        const total = Number(results[0].total_amount);
        const paid = Number(results[0].paid_amount);
        const balance = Math.max(0, total - paid);

        let status = "Unpaid";
        if (paid >= total) {
            status = "Paid";
        } else if (paid > 0) {
            status = "Partially Paid";
        }

        db.query(
            `UPDATE invoices
             SET paid_amount = ?, balance = ?, payment_status = ?
             WHERE id = ?`,
            [paid, balance, status, invoiceId],
            callback
        );
    });
};

// Create a payment
const createPayment = (payment, callback) => {
    const sql = `
        INSERT INTO payments
        (invoice_id, patient_id, payment_date, amount,
         payment_method, transaction_reference, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
        payment.invoice_id,
        payment.patient_id,
        payment.payment_date,
        payment.amount,
        payment.payment_method,
        payment.transaction_reference || null,
        payment.notes || null
    ];

    db.query(sql, values, (err, result) => {
        if (err) return callback(err);

        updateInvoiceBalance(payment.invoice_id, (balanceErr) => {
            if (balanceErr) return callback(balanceErr);
            callback(null, result);
        });
    });
};

// Get all payments
const getAllPayments = (callback) => {
    const sql = `
        SELECT payments.*, patients.full_name AS patient_name
        FROM payments
        JOIN patients ON payments.patient_id = patients.id
        ORDER BY payments.id DESC
    `;

    db.query(sql, callback);
};

// Get payment by ID
const getPaymentById = (id, callback) => {
    const sql = `
        SELECT payments.*, patients.full_name AS patient_name
        FROM payments
        JOIN patients ON payments.patient_id = patients.id
        WHERE payments.id = ?
    `;

    db.query(sql, [id], callback);
};

// Update a payment
const updatePayment = (id, payment, callback) => {
    db.query(
        "SELECT invoice_id FROM payments WHERE id = ?",
        [id],
        (err, results) => {
            if (err) return callback(err);
            if (results.length === 0) {
                return callback(null, { affectedRows: 0 });
            }

            const oldInvoiceId = results[0].invoice_id;

            const sql = `
                UPDATE payments
                SET invoice_id = ?, patient_id = ?, payment_date = ?,
                    amount = ?, payment_method = ?,
                    transaction_reference = ?, notes = ?
                WHERE id = ?
            `;

            const values = [
                payment.invoice_id,
                payment.patient_id,
                payment.payment_date,
                payment.amount,
                payment.payment_method,
                payment.transaction_reference || null,
                payment.notes || null,
                id
            ];

            db.query(sql, values, (updateErr, result) => {
                if (updateErr) return callback(updateErr);

                updateInvoiceBalance(oldInvoiceId, (oldErr) => {
                    if (oldErr) return callback(oldErr);

                    if (Number(payment.invoice_id) === Number(oldInvoiceId)) {
                        return callback(null, result);
                    }

                    updateInvoiceBalance(payment.invoice_id, (newErr) => {
                        if (newErr) return callback(newErr);
                        callback(null, result);
                    });
                });
            });
        }
    );
};

// Delete a payment
const deletePayment = (id, callback) => {
    db.query(
        "SELECT invoice_id FROM payments WHERE id = ?",
        [id],
        (err, results) => {
            if (err) return callback(err);
            if (results.length === 0) {
                return callback(null, { affectedRows: 0 });
            }

            const invoiceId = results[0].invoice_id;

            db.query(
                "DELETE FROM payments WHERE id = ?",
                [id],
                (deleteErr, result) => {
                    if (deleteErr) return callback(deleteErr);

                    updateInvoiceBalance(invoiceId, (balanceErr) => {
                        if (balanceErr) return callback(balanceErr);
                        callback(null, result);
                    });
                }
            );
        }
    );
};

module.exports = {
    createPayment,
    getAllPayments,
    getPaymentById,
    updatePayment,
    deletePayment
};