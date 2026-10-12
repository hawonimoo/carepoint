const Appointment = require("../models/appointmentModel");

// Create a new appointment
const createAppointment = (req, res) => {
  const appointment = req.body;

  Appointment.create(appointment, (err, result) => {
    if (err) {
      console.error("Error creating appointment:", err);

      return res.status(500).json({
        message: "Failed to create appointment",
        error: err.message
      });
    }

    res.status(201).json({
      message: "Appointment created successfully",
      appointmentId: result.insertId
    });
  });
};

// Get all appointments
const getAllAppointments = (req, res) => {
  Appointment.getAll((err, results) => {
    if (err) {
      console.error("Error fetching appointments:", err);

      return res.status(500).json({
        message: "Failed to fetch appointments",
        error: err.message
      });
    }

    res.status(200).json(results);
  });
};

// Get one appointment by ID
const getAppointmentById = (req, res) => {
  const appointmentId = req.params.id;

  Appointment.getById(appointmentId, (err, result) => {
    if (err) {
      console.error("Error fetching appointment:", err);

      return res.status(500).json({
        message: "Failed to fetch appointment",
        error: err.message
      });
    }

    if (result.length === 0) {
      return res.status(404).json({
        message: "Appointment not found"
      });
    }

    res.status(200).json(result[0]);
  });
};

// Update appointment
const updateAppointment = (req, res) => {
  const appointmentId = req.params.id;
  const appointment = req.body;

  Appointment.update(appointmentId, appointment, (err, result) => {
    if (err) {
      console.error("Error updating appointment:", err);

      return res.status(500).json({
        message: "Failed to update appointment",
        error: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Appointment not found"
      });
    }

    res.status(200).json({
      message: "Appointment updated successfully"
    });
  });
};

// Delete appointment
const deleteAppointment = (req, res) => {
  const appointmentId = req.params.id;

  Appointment.delete(appointmentId, (err, result) => {
    if (err) {
      console.error("Error deleting appointment:", err);

      return res.status(500).json({
        message: "Failed to delete appointment",
        error: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Appointment not found"
      });
    }

    res.status(200).json({
      message: "Appointment deleted successfully"
    });
  });
};

module.exports = {
  createAppointment,
  getAllAppointments,
  getAppointmentById,
  updateAppointment,
  deleteAppointment
};