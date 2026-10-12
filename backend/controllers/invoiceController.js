const Invoice = require("../models/invoiceModel");

// Create invoice
const createInvoice = (req, res) => {
  const invoice = req.body;

  Invoice.create(invoice, (err, result) => {
    if (err) {
      console.error("Error creating invoice:", err);

      return res.status(500).json({
        message: "Failed to create invoice",
        error: err.message
      });
    }

    res.status(201).json({
      message: "Invoice created successfully",
      invoiceId: result.insertId
    });
  });
};

// Get all invoices
const getAllInvoices = (req, res) => {
  Invoice.getAll((err, results) => {
    if (err) {
      console.error("Error fetching invoices:", err);

      return res.status(500).json({
        message: "Failed to fetch invoices",
        error: err.message
      });
    }

    res.status(200).json(results);
  });
};

// Get one invoice by ID
const getInvoiceById = (req, res) => {
  const invoiceId = req.params.id;

  Invoice.getById(invoiceId, (err, result) => {
    if (err) {
      console.error("Error fetching invoice:", err);

      return res.status(500).json({
        message: "Failed to fetch invoice",
        error: err.message
      });
    }

    if (result.length === 0) {
      return res.status(404).json({
        message: "Invoice not found"
      });
    }

    res.status(200).json(result[0]);
  });
};

// Update invoice
const updateInvoice = (req, res) => {
  const invoiceId = req.params.id;
  const invoice = req.body;

  Invoice.update(invoiceId, invoice, (err, result) => {
    if (err) {
      console.error("Error updating invoice:", err);

      return res.status(500).json({
        message: "Failed to update invoice",
        error: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Invoice not found"
      });
    }

    res.status(200).json({
      message: "Invoice updated successfully"
    });
  });
};

// Delete invoice
const deleteInvoice = (req, res) => {
  const invoiceId = req.params.id;

  Invoice.delete(invoiceId, (err, result) => {
    if (err) {
      console.error("Error deleting invoice:", err);

      return res.status(500).json({
        message: "Failed to delete invoice",
        error: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Invoice not found"
      });
    }

    res.status(200).json({
      message: "Invoice deleted successfully"
    });
  });
};

module.exports = {
  createInvoice,
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice
};