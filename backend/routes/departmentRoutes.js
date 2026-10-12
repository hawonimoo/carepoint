const express = require("express");

const router = express.Router();

const {
  createDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment
} = require("../controllers/departmentController");

// Create a department
router.post("/", createDepartment);

// Get all departments
router.get("/", getAllDepartments);

// Get one department by ID
router.get("/:id", getDepartmentById);

// Update a department
router.put("/:id", updateDepartment);

// Delete a department
router.delete("/:id", deleteDepartment);

module.exports = router;