const express = require("express");

const router = express.Router();
const { requireRoles } = require("../middleware/auth");
const auditResponse = require("../middleware/auditResponse");

const {
  createDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment
} = require("../controllers/departmentController");

// Create a department
router.post("/", requireRoles("admin"), auditResponse("department.created", "department"), createDepartment);

// Get all departments
router.get("/", requireRoles("admin", "receptionist"), getAllDepartments);

// Get one department by ID
router.get("/:id", requireRoles("admin", "receptionist"), getDepartmentById);

// Update a department
router.put("/:id", requireRoles("admin"), auditResponse("department.updated", "department"), updateDepartment);

// Delete a department
router.delete("/:id", requireRoles("admin"), auditResponse("department.deleted", "department"), deleteDepartment);

module.exports = router;