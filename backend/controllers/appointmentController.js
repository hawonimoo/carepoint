const Appointment = require("../models/appointmentModel");

const STATUSES = new Set(["Scheduled", "Completed", "Cancelled", "No Show"]);

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validateAppointment(body, { allowPast = false } = {}) {
  const missingFields = ["appointment_number", "patient_id", "doctor_id", "appointment_date", "appointment_time"]
    .filter((field) => body?.[field] === undefined || body[field] === null || String(body[field]).trim() === "");
  if (missingFields.length) return { message: "Required appointment fields are missing", missingFields };

  if (
    typeof body.appointment_number !== "string" ||
    body.appointment_number.trim().length > 20 ||
    !/^[1-9]\d*$/.test(String(body.patient_id)) ||
    !/^[1-9]\d*$/.test(String(body.doctor_id)) ||
    !validDate(body.appointment_date) ||
    (!allowPast && new Date(`${body.appointment_date}T00:00:00Z`) < new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)) ||
    typeof body.appointment_time !== "string" ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(body.appointment_time)
  ) {
    return { message: "Appointment date, time, patient, doctor, or number is invalid" };
  }
  if (body.status !== undefined && !STATUSES.has(body.status)) {
    return { message: "Invalid appointment status" };
  }
  return null;
}

function respondToModelError(res, error, action) {
  if (error.code === "APPOINTMENT_CONFLICT") {
    return res.status(409).json({ message: error.message });
  }
  if (error.code === "INVALID_DOCTOR") {
    return res.status(400).json({ message: error.message });
  }
  if (error.code === "PAST_APPOINTMENT") {
    return res.status(400).json({ message: error.message });
  }
  if (error.code === "DEPARTMENT_REQUIRED" || error.code === "DEPARTMENT_FORBIDDEN") {
    return res.status(403).json({ message: error.message });
  }
  if (error.code === "ER_NO_REFERENCED_ROW_2" || error.code === "ER_ROW_IS_REFERENCED_2") {
    return res.status(400).json({ message: "The selected patient or doctor does not exist" });
  }
  console.error(`Appointment ${action} failed:`, error.code || "internal error");
  return res.status(500).json({ message: `Failed to ${action} appointment` });
}

async function createAppointment(req, res) {
  const invalid = validateAppointment(req.body);
  if (invalid) return res.status(400).json(invalid);
  if (req.body.status !== undefined && req.body.status !== "Scheduled") {
    return res.status(400).json({ message: "New appointments must start as Scheduled" });
  }

  try {
    const appointmentId = await Appointment.create(req.body, req.user);
    return res.status(201).json({ message: "Appointment created", appointmentId });
  } catch (error) {
    return respondToModelError(res, error, "create");
  }
}

async function getAllAppointments(req, res) {
  try {
    return res.json(await Appointment.getAll(req.user));
  } catch (error) {
    return respondToModelError(res, error, "fetch");
  }
}

async function getAppointmentById(req, res) {
  if (!/^[1-9]\d*$/.test(req.params.id)) {
    return res.status(400).json({ message: "Invalid appointment ID" });
  }
  try {
    const appointment = await Appointment.getById(req.params.id, req.user);
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });
    return res.json(appointment);
  } catch (error) {
    return respondToModelError(res, error, "fetch");
  }
}

async function updateAppointment(req, res) {
  if (!/^[1-9]\d*$/.test(req.params.id)) {
    return res.status(400).json({ message: "Invalid appointment ID" });
  }
  const invalid = validateAppointment(req.body, { allowPast: true });
  if (invalid) return res.status(400).json(invalid);
  try {
    const updated = await Appointment.update(req.params.id, req.body, req.user);
    if (!updated) return res.status(404).json({ message: "Appointment not found" });
    return res.json({ message: "Appointment updated" });
  } catch (error) {
    return respondToModelError(res, error, "update");
  }
}

async function deleteAppointment(req, res) {
  if (!/^[1-9]\d*$/.test(req.params.id)) {
    return res.status(400).json({ message: "Invalid appointment ID" });
  }
  try {
    const cancelled = await Appointment.cancel(req.params.id, req.user);
    if (!cancelled) return res.status(404).json({ message: "Appointment not found" });
    return res.json({ message: "Appointment cancelled" });
  } catch (error) {
    return respondToModelError(res, error, "cancel");
  }
}

module.exports = {
  createAppointment,
  getAllAppointments,
  getAppointmentById,
  updateAppointment,
  deleteAppointment,
  validateAppointment,
};
