const express = require("express");

const router = express.Router();
const { requireRoles } = require("../middleware/auth");
const auditResponse = require("../middleware/auditResponse");

const {
  createMedicalRecord,
  getAllMedicalRecords,
  getMedicalRecordById,
  updateMedicalRecord,
  deleteMedicalRecord
} = require("../controllers/medicalRecordController");

// Create a medical record
router.post("/", requireRoles("admin", "doctor"), auditResponse("medical_record.created", "medical_record"), createMedicalRecord);

// Get all medical records
router.get("/", requireRoles("admin", "doctor"), auditResponse("medical_record.list_accessed", "medical_record"), getAllMedicalRecords);

// Get one medical record by ID
router.get("/:id", requireRoles("admin", "doctor"), auditResponse("medical_record.accessed", "medical_record"), getMedicalRecordById);

// Update a medical record
router.put("/:id", requireRoles("admin", "doctor"), auditResponse("medical_record.updated", "medical_record"), updateMedicalRecord);

// Delete a medical record
router.delete("/:id", requireRoles("admin"), auditResponse("medical_record.deleted", "medical_record"), deleteMedicalRecord);

module.exports = router;