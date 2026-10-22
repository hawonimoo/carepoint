const crypto = require("node:crypto");
const PrescriptionOrder = require("../models/prescriptionOrder.model");

const TEXT_LIMITS = {
  strength: 100,
  dosage_form: 80,
  dose: 150,
  route: 80,
  frequency: 150,
  duration: 100,
  instructions: 3000,
};

function validId(value) {
  return (typeof value === "string" && /^[1-9]\d*$/.test(value) ||
    typeof value === "number" && Number.isSafeInteger(value) && value > 0) &&
    Number.isSafeInteger(Number(value));
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
    return { error: "Add between 1 and 20 medicines to the prescription" };
  }
  const seen = new Set();
  const normalized = [];
  for (const item of items) {
    if (!validId(item?.medicine_id)) return { error: "Select a valid medicine for every line" };
    if (seen.has(String(item.medicine_id))) return { error: "Each medicine may appear only once per prescription" };
    seen.add(String(item.medicine_id));
    const line = { medicine_id: Number(item.medicine_id) };
    for (const [field, limit] of Object.entries(TEXT_LIMITS)) {
      const value = item[field] ?? "";
      if (typeof value !== "string" || value.length > limit) {
        return { error: `${field.replaceAll("_", " ")} must be no longer than ${limit} characters` };
      }
      if (["dose", "route", "frequency", "duration"].includes(field) && !value.trim()) {
        return { error: `${field.replaceAll("_", " ")} is required for each medicine` };
      }
      line[field] = value.trim() || null;
    }
    if (!validId(item.quantity) || Number(item.quantity) > 10000) {
      return { error: "Enter a whole-number quantity between 1 and 10,000" };
    }
    line.quantity = Number(item.quantity);
    normalized.push(line);
  }
  return { items: normalized };
}

function handleOrderError(error, res, next) {
  if (error.code === "ORDER_PATIENT_FORBIDDEN") {
    return res.status(403).json({ message: error.message });
  }
  if (error.code === "ORDER_CONSULTATION_INVALID" || error.code === "ORDER_MEDICINE_INVALID") {
    return res.status(400).json({ message: error.message });
  }
  if (error.code === "ORDER_NOT_FOUND") return res.status(404).json({ message: error.message });
  if ([
    "ORDER_STATUS_CONFLICT",
    "ORDER_ITEM_INVALID",
    "ORDER_QUANTITY_CONFLICT",
    "ORDER_STOCK_CONFLICT",
  ].includes(error.code)) {
    return res.status(409).json({ message: error.message });
  }
  if (error.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ message: "Prescription number already exists. Please try again." });
  }
  if (error.code === "ER_NO_SUCH_TABLE" || error.code === "ER_BAD_FIELD_ERROR") {
    return res.status(503).json({
      message: "Prescription and laboratory order migration is required. Back up the database and apply backend/migrations/004_prescription_laboratory_orders.sql.",
    });
  }
  if (error.code === "ER_NO_REFERENCED_ROW_2") {
    return res.status(400).json({ message: "A selected patient, medicine, consultation, or staff account no longer exists" });
  }
  return next(error);
}

async function list(req, res, next) {
  try {
    if (req.user.role === "doctor" && !req.user.doctorId) {
      return res.status(403).json({ message: "This doctor account is not linked to a doctor record" });
    }
    return res.json(await PrescriptionOrder.list(req.user));
  } catch (error) {
    return handleOrderError(error, res, next);
  }
}

async function create(req, res, next) {
  if (req.user.role !== "doctor" || !req.user.doctorId) {
    return res.status(403).json({ message: "Only a linked doctor account can create prescriptions" });
  }
  const body = req.body || {};
  if (!validId(body.patient_id)) return res.status(400).json({ message: "Select a valid patient" });
  if (body.consultation_id != null && body.consultation_id !== "" && !validId(body.consultation_id)) {
    return res.status(400).json({ message: "Select a valid consultation" });
  }
  if (body.prescription_number !== undefined && body.prescription_number !== null &&
      typeof body.prescription_number !== "string") {
    return res.status(400).json({ message: "Prescription number must be text" });
  }
  if (typeof body.prescription_number === "string" && body.prescription_number.trim().length > 30) {
    return res.status(400).json({ message: "Prescription number must be 30 characters or fewer" });
  }
  const { items, error } = validateItems(body.items);
  if (error) return res.status(400).json({ message: error });
  const orderNumber = typeof body.prescription_number === "string" && body.prescription_number.trim()
    ? body.prescription_number.trim()
    : `RX-${crypto.randomBytes(7).toString("hex").toUpperCase()}`;
  try {
    const id = await PrescriptionOrder.create({
      orderNumber,
      patientId: Number(body.patient_id),
      doctorId: req.user.doctorId,
      consultationId: body.consultation_id ? Number(body.consultation_id) : null,
      items,
      userId: req.user.id,
    });
    return res.status(201).json({ id, prescription_number: orderNumber, message: "Prescription sent to Pharmacy" });
  } catch (error) {
    return handleOrderError(error, res, next);
  }
}

async function accept(req, res, next) {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid prescription ID" });
  try {
    return res.json({ message: "Prescription accepted", ...await PrescriptionOrder.accept(Number(req.params.id), req.user.id) });
  } catch (error) {
    return handleOrderError(error, res, next);
  }
}

async function dispense(req, res, next) {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid prescription ID" });
  const items = req.body?.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
    return res.status(400).json({ message: "Provide at least one prescription line to dispense" });
  }
  const seen = new Set();
  const normalized = [];
  for (const item of items) {
    if (!validId(item?.item_id) || !validId(item?.quantity) || Number(item.quantity) > 10000) {
      return res.status(400).json({ message: "Provide valid prescription line IDs and quantities" });
    }
    if (seen.has(String(item.item_id))) return res.status(400).json({ message: "A prescription line can be dispensed only once per request" });
    seen.add(String(item.item_id));
    normalized.push({ item_id: Number(item.item_id), quantity: Number(item.quantity) });
  }
  const notes = req.body?.notes ?? null;
  if (notes !== null && (typeof notes !== "string" || notes.length > 1000)) {
    return res.status(400).json({ message: "Dispensing notes must be 1,000 characters or fewer" });
  }
  try {
    const result = await PrescriptionOrder.dispense(Number(req.params.id), req.user.id, normalized, notes);
    return res.json({ message: "Dispensing recorded and stock updated", ...result });
  } catch (error) {
    return handleOrderError(error, res, next);
  }
}

module.exports = { accept, create, dispense, list, validId, validateItems };
