const Doctor = require("../models/doctorModel");

// Create a new doctor
const createDoctor = (req, res) => {
  const doctor = req.body;

  Doctor.create(doctor, (err, result) => {
    if (err) {
      console.error("Error creating doctor:", err);

      return res.status(500).json({
        message: "Failed to register doctor",
        error: err.message
      });
    }

    res.status(201).json({
      message: "Doctor registered successfully",
      doctorId: result.insertId
    });
  });
};

// Get all doctors
const getAllDoctors = (req, res) => {
  Doctor.getAll((err, results) => {
    if (err) {
      console.error("Error fetching doctors:", err);

      return res.status(500).json({
        message: "Failed to fetch doctors",
        error: err.message
      });
    }

    res.status(200).json(results);
  });
};

// Get one doctor by ID
const getDoctorById = (req, res) => {
  const doctorId = req.params.id;

  Doctor.getById(doctorId, (err, result) => {
    if (err) {
      console.error("Error fetching doctor:", err);

      return res.status(500).json({
        message: "Failed to fetch doctor",
        error: err.message
      });
    }

    if (result.length === 0) {
      return res.status(404).json({
        message: "Doctor not found"
      });
    }

    res.status(200).json(result[0]);
  });
};

// Update doctor
const updateDoctor = (req, res) => {
  const doctorId = req.params.id;
  const doctor = req.body;

  Doctor.update(doctorId, doctor, (err, result) => {
    if (err) {
      console.error("Error updating doctor:", err);

      return res.status(500).json({
        message: "Failed to update doctor",
        error: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Doctor not found"
      });
    }

    res.status(200).json({
      message: "Doctor updated successfully"
    });
  });
};

// Delete doctor
const deleteDoctor = (req, res) => {
  const doctorId = req.params.id;

  Doctor.delete(doctorId, (err, result) => {
    if (err) {
      console.error("Error deleting doctor:", err);

      return res.status(500).json({
        message: "Failed to delete doctor",
        error: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Doctor not found"
      });
    }

    res.status(200).json({
      message: "Doctor deleted successfully"
    });
  });
};

module.exports = {
  createDoctor,
  getAllDoctors,
  getDoctorById,
  updateDoctor,
  deleteDoctor
};