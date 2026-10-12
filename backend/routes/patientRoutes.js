const express = require("express");

const router = express.Router();

const {
  createPatient,
  getAllPatients,
  getPatientById,
  updatePatient,
  deletePatient
} = require("../controllers/patientController");

// Create a patient
router.post("/", createPatient);

// Get all patients
router.get("/", getAllPatients);

// Get one patient by ID
router.get("/:id", getPatientById);

// Update a patient
router.put("/:id", updatePatient);

// Delete a patient
router.delete("/:id", deletePatient);

module.exports = router;