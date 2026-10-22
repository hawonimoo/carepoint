const express = require("express");

const router = express.Router();
const { requireRoles } = require("../middleware/auth");
const auditResponse = require("../middleware/auditResponse");

const {
  createAppointment,
  getAllAppointments,
  getAppointmentById,
  updateAppointment,
  deleteAppointment
} = require("../controllers/appointmentController");

// Create an appointment
router.post("/", requireRoles("admin", "receptionist"), createAppointment);

// Get all appointments
router.get("/", requireRoles("admin", "receptionist", "doctor", "nurse"), getAllAppointments);

// Get one appointment by ID
router.get("/:id", requireRoles("admin", "receptionist", "doctor", "nurse"), getAppointmentById);

// Update an appointment
router.put("/:id", requireRoles("admin", "receptionist"), updateAppointment);

// Delete an appointment
router.delete("/:id", requireRoles("admin", "receptionist"), deleteAppointment);

module.exports = router;