const MedicalRecord = require("../models/medicalRecordModel");
const db = require("../config/db");

function checkDoctorAssignment(doctorId, userId, patientId, appointmentId, callback) {
  if (!/^[1-9]\d*$/.test(String(patientId || ""))) {
    callback(new Error("INVALID_PATIENT_ID"));
    return;
  }
  const appointmentScope = appointmentId === undefined || appointmentId === null || appointmentId === ""
    ? ""
    : " AND id = ?";
  if (appointmentScope && !/^[1-9]\d*$/.test(String(appointmentId))) {
    callback(new Error("INVALID_APPOINTMENT_ID"));
    return;
  }
  const query = appointmentScope
    ? `SELECT id FROM appointments WHERE patient_id = ? AND doctor_id = ? AND id = ? LIMIT 1`
    : `SELECT id FROM patients p
       WHERE p.id = ? AND (
         EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = p.id AND a.doctor_id = ?)
         OR EXISTS (SELECT 1 FROM patient_assignments pa WHERE pa.patient_id = p.id AND pa.user_id = ?)
       ) LIMIT 1`;
  const values = appointmentScope
    ? [patientId, doctorId, appointmentId]
    : [patientId, doctorId, userId];
  db.promise().query(query, values).then(([rows]) => callback(null, rows.length > 0)).catch(callback);
}

// Create a new medical record
const createMedicalRecord = (req, res) => {
  const record = { ...req.body };
  if (req.user.role === "doctor") {
    if (!req.user.doctorId) {
      return res.status(403).json({ message: "This doctor account is not linked to a doctor record" });
    }
    record.doctor_id = req.user.doctorId;
    checkDoctorAssignment(req.user.doctorId, req.user.id, record.patient_id, record.appointment_id, (assignmentError, assigned) => {
      if (assignmentError?.message === "INVALID_PATIENT_ID" || assignmentError?.message === "INVALID_APPOINTMENT_ID") {
        return res.status(400).json({ message: "A valid patient and appointment assignment is required" });
      }
      if (assignmentError) return res.status(500).json({ message: "Failed to validate patient assignment" });
      if (!assigned) return res.status(403).json({ message: "You are not assigned to this patient" });
      return createValidatedRecord(record, res);
    });
    return;
  }

  return createValidatedRecord(record, res);
};

function createValidatedRecord(record, res) {
  MedicalRecord.create(record, (err, result) => {
    if (err) {
      console.error("Error creating medical record:", err.code || "database error");

      return res.status(500).json({
        message: "Failed to create medical record",
      });
    }

    res.status(201).json({
      message: "Medical record created successfully",
      recordId: result.insertId
    });
  });
}

// Get all medical records
const getAllMedicalRecords = (req, res) => {
  MedicalRecord.getAll(req.user, (err, results) => {
    if (err) {
      console.error("Error fetching medical records:", err.code || "database error");

      return res.status(500).json({
        message: "Failed to fetch medical records",
      });
    }

    res.status(200).json(results);
  });
};

// Get one medical record by ID
const getMedicalRecordById = (req, res) => {
  const recordId = req.params.id;

  MedicalRecord.getById(recordId, req.user, (err, result) => {
    if (err) {
      console.error("Error fetching medical record:", err.code || "database error");

      return res.status(500).json({
        message: "Failed to fetch medical record",
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
  const record = { ...req.body };
  if (req.user.role === "doctor") {
    if (!req.user.doctorId) {
      return res.status(403).json({ message: "This doctor account is not linked to a doctor record" });
    }
    record.doctor_id = req.user.doctorId;
    checkDoctorAssignment(req.user.doctorId, req.user.id, record.patient_id, record.appointment_id, (assignmentError, assigned) => {
      if (assignmentError?.message === "INVALID_PATIENT_ID" || assignmentError?.message === "INVALID_APPOINTMENT_ID") {
        return res.status(400).json({ message: "A valid patient and appointment assignment is required" });
      }
      if (assignmentError) return res.status(500).json({ message: "Failed to validate patient assignment" });
      if (!assigned) return res.status(403).json({ message: "You are not assigned to this patient" });
      return updateValidatedRecord(recordId, record, req.user, res);
    });
    return;
  }
  return updateValidatedRecord(recordId, record, req.user, res);
};

function updateValidatedRecord(recordId, record, user, res) {
  MedicalRecord.update(recordId, record, user, (err, result) => {
    if (err) {
      console.error("Error updating medical record:", err.code || "database error");

      return res.status(500).json({
        message: "Failed to update medical record"
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
}

// Delete medical record
const deleteMedicalRecord = (req, res) => {
  const recordId = req.params.id;

  MedicalRecord.delete(recordId, (err, result) => {
    if (err) {
      console.error("Error deleting medical record:", err.code || "database error");

      return res.status(500).json({
        message: "Failed to delete medical record",
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