const express = require("express");

const router = express.Router();

const {
  createLaboratoryTest,
  getAllLaboratoryTests,
  getLaboratoryTestById,
  updateLaboratoryTest,
  deleteLaboratoryTest
} = require("../controllers/laboratoryTestController");

// Create a laboratory test
router.post("/", createLaboratoryTest);

// Get all laboratory tests
router.get("/", getAllLaboratoryTests);

// Get one laboratory test
router.get("/:id", getLaboratoryTestById);

// Update a laboratory test
router.put("/:id", updateLaboratoryTest);

// Delete a laboratory test
router.delete("/:id", deleteLaboratoryTest);

module.exports = router;