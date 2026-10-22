const express = require("express");

const router = express.Router();
const { requireRoles } = require("../middleware/auth");
const auditResponse = require("../middleware/auditResponse");

const {
  createInvoice,
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice
} = require("../controllers/invoiceController");

// Create an invoice
router.post("/", requireRoles("admin", "accountant"), auditResponse("invoice.created", "invoice"), createInvoice);

// Get all invoices
router.get("/", requireRoles("admin", "accountant"), getAllInvoices);

// Get one invoice
router.get("/:id", requireRoles("admin", "accountant"), getInvoiceById);

// Update an invoice
router.put("/:id", requireRoles("admin", "accountant"), auditResponse("invoice.updated", "invoice"), updateInvoice);

// Delete an invoice
router.delete("/:id", requireRoles("admin"), auditResponse("invoice.deleted", "invoice"), deleteInvoice);

module.exports = router;