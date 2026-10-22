const express = require("express");

const router = express.Router();
const { requireRoles } = require("../middleware/auth");
const auditResponse = require("../middleware/auditResponse");

const {
  createMedicine,
  getAllMedicines,
  getMedicineById,
  updateMedicine,
  deleteMedicine
} = require("../controllers/medicineController");

// Create a medicine
router.post("/", requireRoles("admin", "pharmacist"), auditResponse("medicine.created", "medicine"), createMedicine);

// Get all medicines
router.get("/", requireRoles("admin", "pharmacist", "doctor"), getAllMedicines);

// Get one medicine by ID
router.get("/:id", requireRoles("admin", "pharmacist"), getMedicineById);

// Update a medicine
router.put("/:id", requireRoles("admin", "pharmacist"), auditResponse("medicine.updated", "medicine"), updateMedicine);

// Delete a medicine
router.delete("/:id", requireRoles("admin"), auditResponse("medicine.deleted", "medicine"), deleteMedicine);

module.exports = router;