const express = require("express");

const router = express.Router();

const {
  createInvoice,
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice
} = require("../controllers/invoiceController");

// Create an invoice
router.post("/", createInvoice);

// Get all invoices
router.get("/", getAllInvoices);

// Get one invoice
router.get("/:id", getInvoiceById);

// Update an invoice
router.put("/:id", updateInvoice);

// Delete an invoice
router.delete("/:id", deleteInvoice);

module.exports = router;