const LaboratoryTest = require("../models/laboratoryTestModel");

// Create a laboratory test
const createLaboratoryTest = (req, res) => {
  const test = req.body;

  LaboratoryTest.create(test, (err, result) => {
    if (err) {
      console.error("Error creating laboratory test:", err);

      return res.status(500).json({
        message: "Failed to create laboratory test",
        error: err.message
      });
    }

    res.status(201).json({
      message: "Laboratory test created successfully",
      testId: result.insertId
    });
  });
};

// Get all laboratory tests
const getAllLaboratoryTests = (req, res) => {
  LaboratoryTest.getAll((err, results) => {
    if (err) {
      console.error("Error fetching laboratory tests:", err);

      return res.status(500).json({
        message: "Failed to fetch laboratory tests",
        error: err.message
      });
    }

    res.status(200).json(results);
  });
};

// Get one laboratory test by ID
const getLaboratoryTestById = (req, res) => {
  const testId = req.params.id;

  LaboratoryTest.getById(testId, (err, result) => {
    if (err) {
      console.error("Error fetching laboratory test:", err);

      return res.status(500).json({
        message: "Failed to fetch laboratory test",
        error: err.message
      });
    }

    if (result.length === 0) {
      return res.status(404).json({
        message: "Laboratory test not found"
      });
    }

    res.status(200).json(result[0]);
  });
};

// Update laboratory test
const updateLaboratoryTest = (req, res) => {
  const testId = req.params.id;
  const test = req.body;

  LaboratoryTest.update(testId, test, (err, result) => {
    if (err) {
      console.error("Error updating laboratory test:", err);

      return res.status(500).json({
        message: "Failed to update laboratory test",
        error: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Laboratory test not found"
      });
    }

    res.status(200).json({
      message: "Laboratory test updated successfully"
    });
  });
};

// Delete laboratory test
const deleteLaboratoryTest = (req, res) => {
  const testId = req.params.id;

  LaboratoryTest.delete(testId, (err, result) => {
    if (err) {
      console.error("Error deleting laboratory test:", err);

      return res.status(500).json({
        message: "Failed to delete laboratory test",
        error: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Laboratory test not found"
      });
    }

    res.status(200).json({
      message: "Laboratory test deleted successfully"
    });
  });
};

module.exports = {
  createLaboratoryTest,
  getAllLaboratoryTests,
  getLaboratoryTestById,
  updateLaboratoryTest,
  deleteLaboratoryTest
};