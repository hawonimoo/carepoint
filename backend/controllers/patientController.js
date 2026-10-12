
const Patient = require("../models/patientModel");

// Register a new patient
const createPatient = (req, res) => {
  const patient = req.body || {};

  // Validate required fields
  const requiredFields = [
    "patient_number",
    "full_name",
    "gender",
    "date_of_birth",
    "phone"
  ];

  const missingFields = requiredFields.filter((field) => {
    const value = patient[field];

    return (
      value === undefined ||
      value === null ||
      String(value).trim() === ""
    );
  });

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Please provide all required patient fields",
      missingFields
    });
  }

  // Validate gender
  const allowedGenders = ["Male", "Female", "Other"];

  if (!allowedGenders.includes(patient.gender)) {
    return res.status(400).json({
      message: "Gender must be Male, Female, or Other"
    });
  }

  // Validate date format
  if (
    typeof patient.date_of_birth !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(patient.date_of_birth) ||
    Number.isNaN(Date.parse(patient.date_of_birth)) ||
    new Date(patient.date_of_birth).toISOString().slice(0, 10) !==
      patient.date_of_birth
  ) {
    return res.status(400).json({
      message: "Date of birth must be a valid date in YYYY-MM-DD format"
    });
  }

  Patient.create(patient, (err, result) => {
    if (err) {
      console.error("Error creating patient:", err);

      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          message: "Patient number or another unique field already exists"
        });
      }

      return res.status(500).json({
        message: "Failed to register patient"
      });
    }

    return res.status(201).json({
      message: "Patient registered successfully",
      patientId: result.insertId
    });
  });
};

// Get all patients
const getAllPatients = (req, res) => {
  Patient.getAll((err, results) => {
    if (err) {
      console.error("Error fetching patients:", err);

      return res.status(500).json({
        message: "Failed to fetch patients"
      });
    }

    return res.status(200).json(results);
  });
};

// Get one patient by ID
const getPatientById = (req, res) => {
  const patientId = req.params.id;

  if (!/^\d+$/.test(patientId) || Number(patientId) < 1) {
    return res.status(400).json({
      message: "Invalid patient ID"
    });
  }

  Patient.getById(patientId, (err, result) => {
    if (err) {
      console.error("Error fetching patient:", err);

      return res.status(500).json({
        message: "Failed to fetch patient"
      });
    }

    if (result.length === 0) {
      return res.status(404).json({
        message: "Patient not found"
      });
    }

    return res.status(200).json(result[0]);
  });
};

// Update patient
const updatePatient = (req, res) => {
  const patientId = req.params.id;
  const patient = req.body || {};

  if (!/^\d+$/.test(patientId) || Number(patientId) < 1) {
    return res.status(400).json({
      message: "Invalid patient ID"
    });
  }

  const requiredFields = [
    "patient_number",
    "full_name",
    "gender",
    "date_of_birth",
    "phone"
  ];

  const missingFields = requiredFields.filter((field) => {
    const value = patient[field];

    return (
      value === undefined ||
      value === null ||
      String(value).trim() === ""
    );
  });

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Please provide all required patient fields",
      missingFields
    });
  }

  const allowedGenders = ["Male", "Female", "Other"];

  if (!allowedGenders.includes(patient.gender)) {
    return res.status(400).json({
      message: "Gender must be Male, Female, or Other"
    });
  }

  if (
    typeof patient.date_of_birth !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(patient.date_of_birth) ||
    Number.isNaN(Date.parse(patient.date_of_birth)) ||
    new Date(patient.date_of_birth).toISOString().slice(0, 10) !==
      patient.date_of_birth
  ) {
    return res.status(400).json({
      message: "Date of birth must be a valid date in YYYY-MM-DD format"
    });
  }

  Patient.update(patientId, patient, (err, result) => {
    if (err) {
      console.error("Error updating patient:", err);

      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          message: "Patient number or another unique field already exists"
        });
      }

      return res.status(500).json({
        message: "Failed to update patient"
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Patient not found or no changes were made"
      });
    }

    return res.status(200).json({
      message: "Patient updated successfully"
    });
  });
};

// Delete patient
const deletePatient = (req, res) => {
  const patientId = req.params.id;

  if (!/^\d+$/.test(patientId) || Number(patientId) < 1) {
    return res.status(400).json({
      message: "Invalid patient ID"
    });
  }

  Patient.delete(patientId, (err, result) => {
    if (err) {
      console.error("Error deleting patient:", err);

      if (err.code === "ER_ROW_IS_REFERENCED_2") {
        return res.status(409).json({
          message:
            "This patient has related records. Remove or reassign those records before deleting the patient."
        });
      }

      return res.status(500).json({
        message: "Failed to delete patient"
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Patient not found"
      });
    }

    return res.status(200).json({
      message: "Patient deleted successfully"
    });
  });
};

module.exports = {
  createPatient,
  getAllPatients,
  getPatientById,
  updatePatient,
  deletePatient
};