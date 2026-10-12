
const paymentModel = require("../models/paymentModel");

// Create a payment
const createPayment = (req, res) => {
    paymentModel.createPayment(req.body, (err, result) => {
        if (err) {
            return res.status(500).json({
                message: "Failed to create payment",
                error: err.message
            });
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
            return res.status(500).json({
                message: "Failed to retrieve payments",
                error: err.message
            });
        }

        res.status(200).json(results);
    });
};

// Get payment by ID
const getPaymentById = (req, res) => {
    paymentModel.getPaymentById(req.params.id, (err, result) => {
        if (err) {
            return res.status(500).json({
                message: "Failed to retrieve payment",
                error: err.message
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
    paymentModel.updatePayment(
        req.params.id,
        req.body,
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    message: "Failed to update payment",
                    error: err.message
                });
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
    paymentModel.deletePayment(req.params.id, (err, result) => {
        if (err) {
            return res.status(500).json({
                message: "Failed to delete payment",
                error: err.message
            });
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
    deletePayment
};