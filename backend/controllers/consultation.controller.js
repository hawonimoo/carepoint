const Consultation = require("../models/consultation.model");

const TEXT_LIMITS = {
  chief_complaint: 5000,
  symptoms: 10000,
  examination_findings: 10000,
  diagnosis: 5000,
  treatment_plan: 10000,
  follow_up_instructions: 5000,
};

function validPositiveId(value) {
  return typeof value === "string" && /^[1-9]\d*$/.test(value) &&
    Number.isSafeInteger(Number(value));
}

function normalizeConsultationDate(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second = "00"] = match;
  if (Number(year) < 1000) return null;
  const date = new Date(Date.UTC(
    Number(year), Number(month) - 1, Number(day),
    Number(hour), Number(minute), Number(second)
  ));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day) ||
    date.getUTCHours() !== Number(hour) ||
    date.getUTCMinutes() !== Number(minute) ||
    date.getUTCSeconds() !== Number(second)
  ) {
    return null;
  }
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function validateConsultationInput(body) {
  const consultation = {};
  const patientId = body?.patient_id;
  if (
    !(typeof patientId === "number" && Number.isSafeInteger(patientId) && patientId > 0) &&
    !(typeof patientId === "string" && /^[1-9]\d*$/.test(patientId) && Number.isSafeInteger(Number(patientId)))
  ) {
    return { error: "Select a valid patient" };
  }
  consultation.patient_id = Number(patientId);

  for (const [field, limit] of Object.entries(TEXT_LIMITS)) {
    const value = body[field] ?? "";
    if (typeof value !== "string" || value.length > limit) {
      return { error: `${field.replaceAll("_", " ")} must be text no longer than ${limit} characters` };
    }
    if (["chief_complaint", "diagnosis", "treatment_plan"].includes(field) && !value.trim()) {
      return { error: `${field.replaceAll("_", " ")} is required` };
    }
    consultation[field] = value.trim() || null;
  }

  const consultationDate = normalizeConsultationDate(body.consultation_date);
  if (!consultationDate) {
    return { error: "Provide a valid consultation date and time" };
  }
  consultation.consultation_date = consultationDate;
  return { consultation };
}

function handleConsultationError(error, res, next) {
  if (error.code === "CONSULTATION_PATIENT_FORBIDDEN") {
    return res.status(404).json({ message: "Patient not found or not assigned to you" });
  }
  if (error.code === "ER_NO_SUCH_TABLE" || error.code === "ER_BAD_FIELD_ERROR") {
    return res.status(503).json({
      message: "Consultation database migration is required. Apply backend/migrations/003_consultations.sql.",
    });
  }
  if (error.code === "ER_NO_REFERENCED_ROW_2") {
    return res.status(404).json({ message: "Patient or doctor record was not found" });
  }
  return next(error);
}

async function createConsultation(req, res, next) {
  if (!req.user.doctorId) {
    return res.status(403).json({ message: "This doctor account is not linked to a doctor record" });
  }
  const { consultation, error } = validateConsultationInput(req.body || {});
  if (error) return res.status(400).json({ message: error });

  try {
    const id = await Consultation.createForDoctor(consultation, req.user.doctorId, req.user.id);
    return res.status(201).json({ message: "Consultation saved successfully", consultationId: id });
  } catch (caught) {
    return handleConsultationError(caught, res, next);
  }
}

async function listConsultations(req, res, next) {
  let patientId = null;
  if (req.query.patient_id !== undefined) {
    if (!validPositiveId(req.query.patient_id)) {
      return res.status(400).json({ message: "Invalid patient ID" });
    }
    patientId = Number(req.query.patient_id);
  }

  try {
    if (req.user.role === "doctor") {
      if (!req.user.doctorId) {
        return res.status(403).json({ message: "This doctor account is not linked to a doctor record" });
      }
      return res.json(await Consultation.listForDoctor(req.user.doctorId, req.user.id, patientId));
    }
    return res.json(await Consultation.listAll(patientId));
  } catch (caught) {
    return handleConsultationError(caught, res, next);
  }
}

async function getConsultationById(req, res, next) {
  if (!validPositiveId(req.params.id)) {
    return res.status(400).json({ message: "Invalid consultation ID" });
  }
  if (req.user.role === "doctor" && !req.user.doctorId) {
    return res.status(403).json({ message: "This doctor account is not linked to a doctor record" });
  }

  try {
    const consultation = req.user.role === "doctor"
      ? await Consultation.getForDoctor(req.params.id, req.user.doctorId, req.user.id)
      : await Consultation.getForAdministrator(req.params.id);
    if (!consultation) {
      return res.status(404).json({ message: "Consultation not found or you are not authorized to view it" });
    }
    return res.json(consultation);
  } catch (caught) {
    return handleConsultationError(caught, res, next);
  }
}

module.exports = {
  createConsultation,
  getConsultationById,
  listConsultations,
  normalizeConsultationDate,
  validPositiveId,
  validateConsultationInput,
};
