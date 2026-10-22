
const db = require("../config/db");

function runTransaction(callback, work) {
    db.promise().getConnection().then(async (connection) => {
        let result;
        let failure;
        try {
            await connection.beginTransaction();
            result = await work(connection);
            await connection.commit();
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
}

async function lockInvoices(connection, invoiceIds) {
    const ids = [...new Set(invoiceIds.map(Number))].sort((left, right) => left - right);
    const [rows] = await connection.query(
        `SELECT id, patient_id, total_amount FROM invoices
         WHERE id IN (${ids.map(() => "?").join(", ")})
         ORDER BY id FOR UPDATE`,
        ids
    );
    return rows;
}

async function recalculateInvoice(connection, invoiceId) {
    const [invoices] = await connection.query(
        "SELECT total_amount FROM invoices WHERE id = ? FOR UPDATE",
        [invoiceId]
    );
    if (!invoices.length) {
        const error = new Error("Invoice not found");
        error.code = "INVOICE_NOT_FOUND";
        throw error;
    }
    const [totals] = await connection.query(
        "SELECT COALESCE(SUM(amount), 0) AS paid_amount FROM payments WHERE invoice_id = ?",
        [invoiceId]
    );
    const total = Number(invoices[0].total_amount);
    const paid = Number(totals[0].paid_amount);
    const balance = Math.max(0, total - paid);
    const status = total > 0 && paid >= total ? "Paid" : paid > 0 ? "Partially Paid" : "Unpaid";
    await connection.query(
        "UPDATE invoices SET paid_amount = ?, balance = ?, payment_status = ? WHERE id = ?",
        [paid, balance, status, invoiceId]
    );
    return { total, paid, balance };
}

async function validatePaymentForInvoice(connection, invoice, payment, excludePaymentId = null) {
    if (!invoice) {
        const error = new Error("Invoice not found");
        error.code = "INVOICE_NOT_FOUND";
        throw error;
    }
    if (Number(invoice.patient_id) !== Number(payment.patient_id)) {
        const error = new Error("Payment patient does not match the invoice patient");
        error.code = "PAYMENT_PATIENT_MISMATCH";
        throw error;
    }
    const [totals] = await connection.query(
        `SELECT COALESCE(SUM(amount), 0) AS paid_amount
         FROM payments WHERE invoice_id = ? AND (? IS NULL OR id <> ?)`,
        [invoice.id, excludePaymentId, excludePaymentId]
    );
    const balance = Number(invoice.total_amount) - Number(totals[0].paid_amount);
    if (Number(payment.amount) > balance + 0.000001) {
        const error = new Error("Payment amount exceeds the invoice balance");
        error.code = "PAYMENT_EXCEEDS_BALANCE";
        throw error;
    }
}

// Create a payment
const createPayment = (payment, callback) => {
    runTransaction(callback, async (connection) => {
        const [invoices] = await lockInvoices(connection, [payment.invoice_id]);
        await validatePaymentForInvoice(connection, invoices[0], payment);
        const [result] = await connection.query(
            `INSERT INTO payments
             (invoice_id, patient_id, payment_date, amount, payment_method, transaction_reference, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                payment.invoice_id,
                payment.patient_id,
                payment.payment_date,
                payment.amount,
                payment.payment_method,
                payment.transaction_reference || null,
                payment.notes || null,
            ]
        );
        await recalculateInvoice(connection, payment.invoice_id);
        return result;
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
    runTransaction(callback, async (connection) => {
        const [payments] = await connection.query(
            "SELECT invoice_id FROM payments WHERE id = ? FOR UPDATE",
            [id]
        );
        if (!payments.length) return { affectedRows: 0 };
        const oldInvoiceId = payments[0].invoice_id;
        const invoices = await lockInvoices(connection, [oldInvoiceId, payment.invoice_id]);
        const newInvoice = invoices.find((invoice) => Number(invoice.id) === Number(payment.invoice_id));
        await validatePaymentForInvoice(connection, newInvoice, payment, id);
        const [result] = await connection.query(
            `UPDATE payments
             SET invoice_id = ?, patient_id = ?, payment_date = ?, amount = ?,
                 payment_method = ?, transaction_reference = ?, notes = ?
             WHERE id = ?`,
            [
                payment.invoice_id,
                payment.patient_id,
                payment.payment_date,
                payment.amount,
                payment.payment_method,
                payment.transaction_reference || null,
                payment.notes || null,
                id,
            ]
        );
        await recalculateInvoice(connection, oldInvoiceId);
        if (Number(payment.invoice_id) !== Number(oldInvoiceId)) {
            await recalculateInvoice(connection, payment.invoice_id);
        }
        return result.affectedRows ? result : { ...result, affectedRows: 1 };
    });
};

// Delete a payment
const deletePayment = (id, callback) => {
    runTransaction(callback, async (connection) => {
        const [payments] = await connection.query(
            "SELECT invoice_id FROM payments WHERE id = ? FOR UPDATE",
            [id]
        );
        if (!payments.length) return { affectedRows: 0 };
        const invoiceId = payments[0].invoice_id;
        await lockInvoices(connection, [invoiceId]);
        const [result] = await connection.query("DELETE FROM payments WHERE id = ?", [id]);
        await recalculateInvoice(connection, invoiceId);
        return result;
    });
};

module.exports = {
    createPayment,
    getAllPayments,
    getPaymentById,
    updatePayment,
    deletePayment
};