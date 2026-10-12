const MedicalRecord = require("../models/medicalRecordModel");

// Create a new medical record
const createMedicalRecord = (req, res) => {
  const record = req.body;

  MedicalRecord.create(record, (err, result) => {
    if (err) {
      console.error("Error creating medical record:", err);

      return res.status(500).json({
        message: "Failed to create medical record",
        error: err.message
      });
    }

    res.status(201).json({
      message: "Medical record created successfully",
      recordId: result.insertId
    });
  });
};

// Get all medical records
const getAllMedicalRecords = (req, res) => {
  MedicalRecord.getAll((err, results) => {
    if (err) {
      console.error("Error fetching medical records:", err);

      return res.status(500).json({
        message: "Failed to fetch medical records",
        error: err.message
      });
    }

    res.status(200).json(results);
  });
};

// Get one medical record by ID
const getMedicalRecordById = (req, res) => {
  const recordId = req.params.id;

  MedicalRecord.getById(recordId, (err, result) => {
    if (err) {
      console.error("Error fetching medical record:", err);

      return res.status(500).json({
        message: "Failed to fetch medical record",
        error: err.message
      });
    }

    if (result.length === 0) {
      return res.status(404).json({
        message: "Medical record not found"
      });
    }

    res.status(200).json(result[0]);
  });
};

// Update medical record
const updateMedicalRecord = (req, res) => {
  const recordId = req.params.id;
  const record = req.body;

  MedicalRecord.update(recordId, record, (err, result) => {
    if (err) {
      console.error("Error updating medical record:", err);

      return res.status(500).json({
        message: "Failed to update medical record",
        error: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Medical record not found"
      });
    }

    res.status(200).json({
      message: "Medical record updated successfully"
    });
  });
};

// Delete medical record
const deleteMedicalRecord = (req, res) => {
  const recordId = req.params.id;

  MedicalRecord.delete(recordId, (err, result) => {
    if (err) {
      console.error("Error deleting medical record:", err);

      return res.status(500).json({
        message: "Failed to delete medical record",
        error: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Medical record not found"
      });
    }

    res.status(200).json({
      message: "Medical record deleted successfully"
    });
  });
};

module.exports = {
  createMedicalRecord,
  getAllMedicalRecords,
  getMedicalRecordById,
  updateMedicalRecord,
  deleteMedicalRecord
};