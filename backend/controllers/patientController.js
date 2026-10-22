
const Patient = require("../models/patientModel");

const getAssignableDoctors = (req, res) => {
  Patient.getAssignableDoctors((err, results) => {
    if (err) {
      console.error("Error fetching assignable doctors:", err.code || "database error");
      return res.status(500).json({ message: "Failed to fetch active doctors" });
    }
    return res.status(200).json(results);
  });
};

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

  if (
    patient.doctor_user_id !== undefined &&
    patient.doctor_user_id !== null &&
    patient.doctor_user_id !== "" &&
    !/^[1-9]\d*$/.test(String(patient.doctor_user_id))
  ) {
    return res.status(400).json({ message: "Select a valid doctor" });
  }
  if (patient.doctor_user_id === "") patient.doctor_user_id = null;

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

  Patient.create(patient, req.user, (err, result) => {
    if (err) {
      console.error("Error creating patient:", err.code || "database error");

      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          message: "Patient number or another unique field already exists"
        });
      }
      if (err.code === "INVALID_DOCTOR_ASSIGNMENT") {
        return res.status(400).json({ message: err.message });
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
  Patient.getAll(req.user, (err, results) => {
    if (err) {
      console.error("Error fetching patients:", err.code || "database error");

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

  Patient.getById(patientId, req.user, (err, result) => {
    if (err) {
      console.error("Error fetching patient:", err.code || "database error");

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

  if (req.user.role === "receptionist") {
    return Patient.getById(patientId, req.user, (err, rows) => {
      if (err) return res.status(500).json({ message: "Failed to validate patient access" });
      if (!rows.length) return res.status(404).json({ message: "Patient not found" });
      return performPatientUpdate(patientId, patient, res);
    });
  }
  return performPatientUpdate(patientId, patient, res);
};

function performPatientUpdate(patientId, patient, res) {
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
      console.error("Error updating patient:", err.code || "database error");

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
}

// Delete patient
const deletePatient = (req, res) => {
  const patientId = req.params.id;

  if (req.user.role === "receptionist") {
    return Patient.getById(patientId, req.user, (err, rows) => {
      if (err) return res.status(500).json({ message: "Failed to validate patient access" });
      if (!rows.length) return res.status(404).json({ message: "Patient not found" });
      return performPatientDelete(patientId, res);
    });
  }
  return performPatientDelete(patientId, res);
};

function performPatientDelete(patientId, res) {
  if (!/^\d+$/.test(patientId) || Number(patientId) < 1) {
    return res.status(400).json({
      message: "Invalid patient ID"
    });
  }

  Patient.delete(patientId, (err, result) => {
    if (err) {
      console.error("Error deleting patient:", err.code || "database error");

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
}

module.exports = {
  getAssignableDoctors,
  createPatient,
  getAllPatients,
  getPatientById,
  updatePatient,
  deletePatient
};