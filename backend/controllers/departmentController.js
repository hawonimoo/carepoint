const Department = require("../models/departmentModel");

// Create a new department
const createDepartment = (req, res) => {
  const department = req.body;

  Department.create(department, (err, result) => {
    if (err) {
      console.error("Error creating department:", err.code || "database error");

      return res.status(500).json({
        message: "Failed to create department",
      });
    }

    res.status(201).json({
      message: "Department created successfully",
      departmentId: result.insertId
    });
  });
};

// Get all departments
const getAllDepartments = (req, res) => {
  Department.getAll((err, results) => {
    if (err) {
      console.error("Error fetching departments:", err.code || "database error");

      return res.status(500).json({
        message: "Failed to fetch departments",
      });
    }

    res.status(200).json(results);
  });
};

// Get one department by ID
const getDepartmentById = (req, res) => {
  const departmentId = req.params.id;

  Department.getById(departmentId, (err, result) => {
    if (err) {
      console.error("Error fetching department:", err.code || "database error");

      return res.status(500).json({
        message: "Failed to fetch department",
      });
    }

    if (result.length === 0) {
      return res.status(404).json({
        message: "Department not found"
      });
    }

    res.status(200).json(result[0]);
  });
};

// Update department
const updateDepartment = (req, res) => {
  const departmentId = req.params.id;
  const department = req.body;

  Department.update(departmentId, department, (err, result) => {
    if (err) {
      console.error("Error updating department:", err.code || "database error");

      return res.status(500).json({
        message: "Failed to update department",
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Department not found"
      });
    }

    res.status(200).json({
      message: "Department updated successfully"
    });
  });
};

// Delete department
const deleteDepartment = (req, res) => {
  const departmentId = req.params.id;

  Department.delete(departmentId, (err, result) => {
    if (err) {
      console.error("Error deleting department:", err.code || "database error");

      return res.status(500).json({
        message: "Failed to delete department",
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Department not found"
      });
    }

    res.status(200).json({
      message: "Department deleted successfully"
    });
  });
};

module.exports = {
  createDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment
};