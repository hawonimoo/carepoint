const Invoice = require("../models/invoiceModel");

function normalizeInvoice(invoice = {}) {
  if (
    typeof invoice.invoice_number !== "string" ||
    !invoice.invoice_number.trim() ||
    invoice.invoice_number.length > 30 ||
    !/^[1-9]\d*$/.test(String(invoice.patient_id || "")) ||
    (invoice.appointment_id != null && invoice.appointment_id !== "" && !/^[1-9]\d*$/.test(String(invoice.appointment_id))) ||
    typeof invoice.invoice_date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(invoice.invoice_date) ||
    Number.isNaN(Date.parse(`${invoice.invoice_date}T00:00:00Z`)) ||
    new Date(`${invoice.invoice_date}T00:00:00Z`).toISOString().slice(0, 10) !== invoice.invoice_date ||
    ["subtotal", "discount", "tax"].some((field) =>
      !Number.isFinite(Number(invoice[field] ?? (field === "subtotal" ? NaN : 0))) ||
      Number(invoice[field] ?? 0) < 0 ||
      Number(invoice[field] ?? 0) > 1000000000 ||
      Math.round(Number(invoice[field] ?? 0) * 100) !== Number(invoice[field] ?? 0) * 100
    ) ||
    (invoice.notes != null && (typeof invoice.notes !== "string" || invoice.notes.length > 5000))
  ) {
    return null;
  }
  const subtotal = Number(invoice.subtotal);
  const discount = Number(invoice.discount ?? 0);
  const tax = Number(invoice.tax ?? 0);
  const total = Math.round((subtotal - discount + tax) * 100) / 100;
  if (discount > subtotal || total < 0) return null;
  return {
    ...invoice,
    invoice_number: invoice.invoice_number.trim(),
    patient_id: Number(invoice.patient_id),
    appointment_id: invoice.appointment_id ? Number(invoice.appointment_id) : null,
    subtotal,
    discount,
    tax,
    total_amount: total,
    paid_amount: 0,
    balance: total,
    payment_status: "Unpaid",
    notes: invoice.notes || null,
  };
}

function respondToInvoiceError(res, error, action) {
  if (error.code === "INVOICE_TOTAL_BELOW_PAYMENTS" || error.code === "INVOICE_PATIENT_HAS_PAYMENTS") {
    return res.status(409).json({ message: error.message });
  }
  if (error.code === "ER_NO_REFERENCED_ROW_2") {
    return res.status(400).json({ message: "Selected patient or appointment was not found" });
  }
  if (error.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ message: "Invoice number already exists" });
  }
  console.error(`Invoice ${action} failed:`, error.code || "database error");
  return res.status(500).json({ message: `Failed to ${action} invoice` });
}

// Create invoice
const createInvoice = (req, res) => {
  const invoice = normalizeInvoice(req.body);
  if (!invoice) return res.status(400).json({ message: "Provide a valid invoice number, patient, date, and non-negative amounts" });

  Invoice.create(invoice, (err, result) => {
    if (err) {
      return respondToInvoiceError(res, err, "create");
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
      console.error("Error fetching invoices:", err.code || "database error");

      return res.status(500).json({
        message: "Failed to fetch invoices",
      });
    }

    res.status(200).json(results);
  });
};

// Get one invoice by ID
const getInvoiceById = (req, res) => {
  const invoiceId = req.params.id;
  if (!/^[1-9]\d*$/.test(invoiceId)) return res.status(400).json({ message: "Invalid invoice ID" });

  Invoice.getById(invoiceId, (err, result) => {
    if (err) {
      console.error("Error fetching invoice:", err.code || "database error");

      return res.status(500).json({
        message: "Failed to fetch invoice",
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
  if (!/^[1-9]\d*$/.test(invoiceId)) return res.status(400).json({ message: "Invalid invoice ID" });
  const invoice = normalizeInvoice(req.body);
  if (!invoice) return res.status(400).json({ message: "Provide a valid invoice number, patient, date, and non-negative amounts" });

  Invoice.update(invoiceId, invoice, (err, result) => {
    if (err) {
      return respondToInvoiceError(res, err, "update");
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
  if (!/^[1-9]\d*$/.test(invoiceId)) return res.status(400).json({ message: "Invalid invoice ID" });

  Invoice.delete(invoiceId, (err, result) => {
    if (err) {
      if (err.code === "ER_ROW_IS_REFERENCED_2") {
        return res.status(409).json({ message: "Invoices with payments cannot be deleted" });
      }
      return respondToInvoiceError(res, err, "delete");
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
  deleteInvoice,
  normalizeInvoice,
};