
const express = require("express");
const router = express.Router();
const { requireRoles } = require("../middleware/auth");
const auditResponse = require("../middleware/auditResponse");

const paymentController = require("../controllers/paymentController");

// Create a payment
router.post("/", requireRoles("admin", "accountant"), auditResponse("payment.created", "payment"), paymentController.createPayment);

// Get all payments
router.get("/", requireRoles("admin", "accountant"), paymentController.getAllPayments);

// Get payment by ID
router.get("/:id", requireRoles("admin", "accountant"), paymentController.getPaymentById);

// Update a payment
router.put("/:id", requireRoles("admin", "accountant"), auditResponse("payment.updated", "payment"), paymentController.updatePayment);

// Delete a payment
router.delete("/:id", requireRoles("admin"), auditResponse("payment.deleted", "payment"), paymentController.deletePayment);

module.exports = router;