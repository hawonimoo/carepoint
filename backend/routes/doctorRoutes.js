const express = require("express");

const router = express.Router();

const {
  createDoctor,
  getAllDoctors,
  getDoctorById,
  updateDoctor,
  deleteDoctor
} = require("../controllers/doctorController");

// Create a doctor
router.post("/", createDoctor);

// Get all doctors
router.get("/", getAllDoctors);

// Get one doctor by ID
router.get("/:id", getDoctorById);

// Update a doctor
router.put("/:id", updateDoctor);

// Delete a doctor
router.delete("/:id", deleteDoctor);

module.exports = router;