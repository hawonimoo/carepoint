const express = require("express");

const router = express.Router();

const {
  createMedicine,
  getAllMedicines,
  getMedicineById,
  updateMedicine,
  deleteMedicine
} = require("../controllers/medicineController");

// Create a medicine
router.post("/", createMedicine);

// Get all medicines
router.get("/", getAllMedicines);

// Get one medicine by ID
router.get("/:id", getMedicineById);

// Update a medicine
router.put("/:id", updateMedicine);

// Delete a medicine
router.delete("/:id", deleteMedicine);

module.exports = router;