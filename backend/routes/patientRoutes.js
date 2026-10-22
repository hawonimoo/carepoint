const express = require("express");

const router = express.Router();
const { requireRoles } = require("../middleware/auth");
const auditResponse = require("../middleware/auditResponse");

const {
  createPatient,
  getAssignableDoctors,
  getAllPatients,
  getPatientById,
  updatePatient,
  deletePatient
} = require("../controllers/patientController");

// Create a patient
router.post("/", requireRoles("admin", "receptionist"), auditResponse("patient.created", "patient"), createPatient);

// Active doctors available for patient assignment during registration
router.get("/doctors", requireRoles("admin", "receptionist"), getAssignableDoctors);

// Get all patients
router.get("/", requireRoles("admin", "receptionist", "doctor", "nurse", "accountant"), auditResponse("patient.list_accessed", "patient"), getAllPatients);

// Get one patient by ID
router.get("/:id", requireRoles("admin", "receptionist", "doctor", "nurse", "accountant"), auditResponse("patient.accessed", "patient"), getPatientById);

// Update a patient
router.put("/:id", requireRoles("admin", "receptionist"), auditResponse("patient.updated", "patient"), updatePatient);

// Delete a patient
router.delete("/:id", requireRoles("admin", "receptionist"), auditResponse("patient.deleted", "patient"), deletePatient);

module.exports = router;