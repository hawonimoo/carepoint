const express = require("express");

const router = express.Router();
const { requireRoles } = require("../middleware/auth");
const auditResponse = require("../middleware/auditResponse");

const {
  createLaboratoryTest,
  getAllLaboratoryTests,
  getLaboratoryTestById,
  updateLaboratoryTest,
  deleteLaboratoryTest
} = require("../controllers/laboratoryTestController");

// Create a laboratory test
router.post("/", requireRoles("admin", "doctor"), auditResponse("laboratory_test.created", "laboratory_test"), createLaboratoryTest);

// Get all laboratory tests
router.get("/", requireRoles("admin", "doctor", "laboratory_staff"), auditResponse("laboratory_test.list_accessed", "laboratory_test"), getAllLaboratoryTests);

// Get one laboratory test
router.get("/:id", requireRoles("admin", "doctor", "laboratory_staff"), auditResponse("laboratory_test.accessed", "laboratory_test"), getLaboratoryTestById);

// Update a laboratory test
router.put("/:id", requireRoles("admin", "laboratory_staff"), auditResponse("laboratory_test.updated", "laboratory_test"), updateLaboratoryTest);

// Delete a laboratory test
router.delete("/:id", requireRoles("admin"), auditResponse("laboratory_test.deleted", "laboratory_test"), deleteLaboratoryTest);

module.exports = router;