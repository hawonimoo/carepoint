const express = require("express");

const router = express.Router();

const {
  createMedicalRecord,
  getAllMedicalRecords,
  getMedicalRecordById,
  updateMedicalRecord,
  deleteMedicalRecord
} = require("../controllers/medicalRecordController");

// Create a medical record
router.post("/", createMedicalRecord);

// Get all medical records
router.get("/", getAllMedicalRecords);

// Get one medical record by ID
router.get("/:id", getMedicalRecordById);

// Update a medical record
router.put("/:id", updateMedicalRecord);

// Delete a medical record
router.delete("/:id", deleteMedicalRecord);

module.exports = router;