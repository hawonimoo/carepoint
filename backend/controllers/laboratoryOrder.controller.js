const crypto = require("node:crypto");
const LaboratoryOrder = require("../models/laboratoryOrder.model");

function validId(value) {
  return (typeof value === "string" && /^[1-9]\d*$/.test(value) ||
    typeof value === "number" && Number.isSafeInteger(value) && value > 0) &&
    Number.isSafeInteger(Number(value));
}

function validateCreateInput(body) {
  if (!validId(body?.patient_id)) return { error: "Select a valid patient" };
  if (body.consultation_id != null && body.consultation_id !== "" && !validId(body.consultation_id)) {
    return { error: "Select a valid consultation" };
  }
  if (typeof body.clinical_reason !== "string" || !body.clinical_reason.trim() || body.clinical_reason.length > 5000) {
    return { error: "Provide a clinical reason of 1 to 5,000 characters" };
  }
  const priority = body.priority || "Routine";
  if (!["Routine", "Urgent", "STAT"].includes(priority)) {
    return { error: "Priority must be Routine, Urgent, or STAT" };
  }
  if (!Array.isArray(body.test_ids) || body.test_ids.length < 1 || body.test_ids.length > 30 ||
      body.test_ids.some((id) => !validId(id))) {
    return { error: "Select between 1 and 30 valid laboratory tests" };
  }
  const testIds = body.test_ids.map(Number);
  if (new Set(testIds).size !== testIds.length) {
    return { error: "A test may appear only once in a laboratory order" };
  }
  const orderNumber = body.order_number === undefined || body.order_number === null || body.order_number === ""
    ? `LAB-${crypto.randomBytes(7).toString("hex").toUpperCase()}`
    : typeof body.order_number === "string" && body.order_number.trim()
      ? body.order_number.trim()
      : null;
  if (!orderNumber) return { error: "Laboratory order number must be text" };
  if (orderNumber.length > 30) return { error: "Laboratory order number must be 30 characters or fewer" };
  return {
    orderNumber,
    patientId: Number(body.patient_id),
    consultationId: body.consultation_id ? Number(body.consultation_id) : null,
    reason: body.clinical_reason.trim(),
    priority,
    testIds,
  };
}

function handleLaboratoryError(error, res, next) {
  if (error.code === "LAB_PATIENT_FORBIDDEN") return res.status(403).json({ message: error.message });
  if (["LAB_CONSULTATION_INVALID", "LAB_TEST_INVALID", "LAB_DEPARTMENT_MISMATCH"].includes(error.code)) {
    return res.status(400).json({ message: error.message });
  }
  if (error.code === "LAB_ORDER_NOT_FOUND") return res.status(404).json({ message: error.message });
  if (error.code === "LAB_RESULT_REQUIRED") return res.status(400).json({ message: error.message });
  if (error.code === "LAB_STATUS_CONFLICT") return res.status(409).json({ message: error.message });
  if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Laboratory order number already exists. Please try again." });
  if (error.code === "ER_NO_SUCH_TABLE" || error.code === "ER_BAD_FIELD_ERROR") {
    return res.status(503).json({
      message: "Laboratory database migration is required.",
    });
  }
  if (error.code === "ER_NO_REFERENCED_ROW_2") {
    return res.status(400).json({ message: "A selected patient, test, consultation, department, or staff account no longer exists" });
  }
  return next(error);
}

async function listCatalogue(req, res, next) {
  try {
    return res.json(await LaboratoryOrder.listCatalogue(req.user));
  } catch (error) {
    return handleLaboratoryError(error, res, next);
  }
}

async function list(req, res, next) {
  if (req.user.role === "doctor" && !req.user.doctorId) {
    return res.status(403).json({ message: "This doctor account is not linked to a doctor record" });
  }
  try {
    return res.json(await LaboratoryOrder.list(req.user));
  } catch (error) {
    return handleLaboratoryError(error, res, next);
  }
}

async function create(req, res, next) {
  if (req.user.role !== "doctor" || !req.user.doctorId) {
    return res.status(403).json({ message: "Only a linked doctor account can request laboratory tests" });
  }
  const body = req.body || {};
  const input = validateCreateInput(body);
  if (input.error) return res.status(400).json({ message: input.error });

  try {
    const id = await LaboratoryOrder.create({
      orderNumber: input.orderNumber,
      patientId: input.patientId,
      doctorId: req.user.doctorId,
      consultationId: input.consultationId,
      reason: input.reason,
      priority: input.priority,
      testIds: input.testIds,
      userId: req.user.id,
    });
    return res.status(201).json({ id, order_number: input.orderNumber, message: "Laboratory order submitted" });
  } catch (error) {
    return handleLaboratoryError(error, res, next);
  }
}

async function accept(req, res, next) {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid laboratory order ID" });
  try {
    return res.json({ message: "Laboratory order accepted", ...await LaboratoryOrder.accept(Number(req.params.id), req.user) });
  } catch (error) {
    return handleLaboratoryError(error, res, next);
  }
}

async function reject(req, res, next) {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid laboratory order ID" });
  const rejectionReason = req.body?.rejection_reason;
  if (typeof rejectionReason !== "string" || !rejectionReason.trim() || rejectionReason.trim().length > 1000) {
    return res.status(400).json({ message: "Provide a rejection reason (1 to 1,000 characters)" });
  }
  try {
    return res.json({
      message: "Laboratory order rejected",
      ...await LaboratoryOrder.rejectOrder(Number(req.params.id), req.user, { rejectionReason: rejectionReason.trim() })
    });
  } catch (error) {
    return handleLaboratoryError(error, res, next);
  }
}

async function updateSample(req, res, next) {
  if (!validId(req.params.id) || !validId(req.params.itemId)) {
    return res.status(400).json({ message: "Invalid laboratory order or test ID" });
  }
  const { specimen_barcode, sample_type, sample_status, rejection_reason } = req.body || {};
  if (!["Pending", "Collected", "Received", "Rejected", "Recollection Required"].includes(sample_status)) {
    return res.status(400).json({ message: "Select a valid sample status" });
  }
  try {
    return res.json({
      message: "Sample details updated",
      ...await LaboratoryOrder.updateSample(Number(req.params.id), Number(req.params.itemId), req.user, {
        specimenBarcode: specimen_barcode?.trim() || null,
        sampleType: sample_type?.trim() || null,
        sampleStatus: sample_status,
        rejectionReason: rejection_reason?.trim() || null,
      })
    });
  } catch (error) {
    return handleLaboratoryError(error, res, next);
  }
}

async function saveResult(req, res, next) {
  if (!validId(req.params.id) || !validId(req.params.itemId)) {
    return res.status(400).json({ message: "Invalid laboratory order or test ID" });
  }
  const { result, unit, reference_range, abnormal_flag, notes, is_draft, assigned_to, delay_reason } = req.body || {};
  if (abnormal_flag && !["Normal", "Abnormal", "Critical"].includes(abnormal_flag)) {
    return res.status(400).json({ message: "Abnormal flag must be Normal, Abnormal, or Critical" });
  }
  try {
    return res.json({
      message: is_draft ? "Result draft saved" : "Result submitted for verification",
      ...await LaboratoryOrder.saveResult(Number(req.params.id), Number(req.params.itemId), req.user, {
        result: result?.trim() || null,
        unit: unit?.trim() || null,
        referenceRange: reference_range?.trim() || null,
        abnormalFlag: abnormal_flag || null,
        notes: notes?.trim() || null,
        isDraft: Boolean(is_draft),
        assignedTo: assigned_to ? Number(assigned_to) : null,
        delayReason: delay_reason?.trim() || null,
      })
    });
  } catch (error) {
    return handleLaboratoryError(error, res, next);
  }
}

async function verifyAndRelease(req, res, next) {
  if (!validId(req.params.id) || !validId(req.params.itemId)) {
    return res.status(400).json({ message: "Invalid laboratory order or test ID" });
  }
  const { reviewer_notes } = req.body || {};
  try {
    return res.json({
      message: "Test result verified and released to clinician",
      ...await LaboratoryOrder.verifyAndRelease(Number(req.params.id), Number(req.params.itemId), req.user, {
        reviewerNotes: reviewer_notes?.trim() || null,
      })
    });
  } catch (error) {
    return handleLaboratoryError(error, res, next);
  }
}

async function updateItem(req, res, next) {
  if (!validId(req.params.id) || !validId(req.params.itemId)) {
    return res.status(400).json({ message: "Invalid laboratory order or test ID" });
  }
  const { status, result, notes } = req.body || {};
  if (!["Accepted", "Sample Collected", "In Progress", "Ready for Verification", "Completed", "Cancelled"].includes(status)) {
    return res.status(400).json({ message: "Select a valid next test status" });
  }
  if (result !== undefined && result !== null && (typeof result !== "string" || result.length > 20000)) {
    return res.status(400).json({ message: "Test result must be 20,000 characters or fewer" });
  }
  if (notes !== undefined && notes !== null && (typeof notes !== "string" || notes.length > 5000)) {
    return res.status(400).json({ message: "Test notes must be 5,000 characters or fewer" });
  }
  try {
    const resultData = await LaboratoryOrder.updateItem(
      Number(req.params.id),
      Number(req.params.itemId),
      req.user,
      { status, result, notes }
    );
    return res.json({ message: "Laboratory test updated", ...resultData });
  } catch (error) {
    return handleLaboratoryError(error, res, next);
  }
}

module.exports = {
  accept,
  reject,
  updateSample,
  saveResult,
  verifyAndRelease,
  create,
  list,
  listCatalogue,
  updateItem,
  validateCreateInput,
};
