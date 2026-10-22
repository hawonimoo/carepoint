
const paymentModel = require("../models/paymentModel");

const PAYMENT_METHODS = new Set(["Cash", "Card", "Mobile Money", "Bank Transfer", "Insurance"]);

function validatePayment(payment) {
    if (
        !/^[1-9]\d*$/.test(String(payment?.invoice_id || "")) ||
        !/^[1-9]\d*$/.test(String(payment?.patient_id || "")) ||
        typeof payment.payment_date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(payment.payment_date) ||
        Number.isNaN(Date.parse(`${payment.payment_date}T00:00:00Z`)) ||
        new Date(`${payment.payment_date}T00:00:00Z`).toISOString().slice(0, 10) !== payment.payment_date ||
        !Number.isFinite(Number(payment.amount)) ||
        Number(payment.amount) <= 0 ||
        Number(payment.amount) > 1000000000 ||
        Math.round(Number(payment.amount) * 100) !== Number(payment.amount) * 100 ||
        typeof payment.payment_method !== "string" ||
        !PAYMENT_METHODS.has(payment.payment_method) ||
        (payment.transaction_reference != null &&
            (typeof payment.transaction_reference !== "string" || payment.transaction_reference.length > 255)) ||
        (payment.notes != null && (typeof payment.notes !== "string" || payment.notes.length > 5000))
    ) {
        return "Provide a valid invoice, patient, date, positive amount, payment method, and optional notes";
    }
    return null;
}

function respondToPaymentError(res, error, action) {
    if (error.code === "INVOICE_NOT_FOUND" || error.code === "ER_NO_REFERENCED_ROW_2") {
        return res.status(404).json({ message: "Invoice or patient was not found" });
    }
    if (error.code === "PAYMENT_PATIENT_MISMATCH") {
        return res.status(400).json({ message: error.message });
    }
    if (error.code === "PAYMENT_EXCEEDS_BALANCE") {
        return res.status(409).json({ message: error.message });
    }
    if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "Payment reference already exists" });
    }
    console.error(`Payment ${action} failed:`, error.code || "database error");
    return res.status(500).json({ message: `Failed to ${action} payment` });
}

// Create a payment
const createPayment = (req, res) => {
    const invalid = validatePayment(req.body || {});
    if (invalid) return res.status(400).json({ message: invalid });
    paymentModel.createPayment(req.body, (err, result) => {
        if (err) {
            return respondToPaymentError(res, err, "create");
        }

        res.status(201).json({
            message: "Payment created successfully",
            paymentId: result.insertId
        });
    });
};

// Get all payments
const getAllPayments = (req, res) => {
    paymentModel.getAllPayments((err, results) => {
        if (err) {
            console.error("Payment list failed:", err.code || "database error");
            return res.status(500).json({
                message: "Failed to retrieve payments",
            });
        }

        res.status(200).json(results);
    });
};

// Get payment by ID
const getPaymentById = (req, res) => {
    if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({ message: "Invalid payment ID" });
    paymentModel.getPaymentById(req.params.id, (err, result) => {
        if (err) {
            console.error("Payment lookup failed:", err.code || "database error");
            return res.status(500).json({
                message: "Failed to retrieve payment",
            });
        }

        if (result.length === 0) {
            return res.status(404).json({
                message: "Payment not found"
            });
        }

        res.status(200).json(result[0]);
    });
};

// Update a payment
const updatePayment = (req, res) => {
    if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({ message: "Invalid payment ID" });
    const invalid = validatePayment(req.body || {});
    if (invalid) return res.status(400).json({ message: invalid });
    paymentModel.updatePayment(
        req.params.id,
        req.body,
        (err, result) => {
            if (err) {
                return respondToPaymentError(res, err, "update");
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "Payment not found"
                });
            }

            res.status(200).json({
                message: "Payment updated successfully"
            });
        }
    );
};

// Delete a payment
const deletePayment = (req, res) => {
    if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({ message: "Invalid payment ID" });
    paymentModel.deletePayment(req.params.id, (err, result) => {
        if (err) {
            return respondToPaymentError(res, err, "delete");
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Payment not found"
            });
        }

        res.status(200).json({
            message: "Payment deleted successfully"
        });
    });
};

module.exports = {
    createPayment,
    getAllPayments,
    getPaymentById,
    updatePayment,
    deletePayment,
    validatePayment,
};