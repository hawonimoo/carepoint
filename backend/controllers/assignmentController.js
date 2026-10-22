const db = require("../config/db");
const { writeAuditLog } = require("../services/auditLog");

async function createPatientAssignment(req, res, next) {
  const patientId = req.body?.patient_id;
  const userId = req.body?.user_id;
  if (!/^[1-9]\d*$/.test(String(patientId || "")) || !/^[1-9]\d*$/.test(String(userId || ""))) {
    return res.status(400).json({ message: "Provide valid patient and staff account IDs" });
  }
  try {
    const [users] = await db.promise().query(
      "SELECT id, role FROM users WHERE id = ? AND is_active = 1 LIMIT 1",
      [userId]
    );
    if (!users.length || !["nurse", "doctor", "receptionist"].includes(users[0].role)) {
      return res.status(400).json({ message: "Assignments may be made only to active reception, nursing, or doctor staff" });
    }
    const [result] = await db.promise().query(
      "INSERT INTO patient_assignments (patient_id, user_id, assigned_by) VALUES (?, ?, ?)",
      [patientId, userId, req.user.id]
    );
    await writeAuditLog({
      userId: req.user.id,
      action: "patient.assignment_created",
      entityType: "patient_assignment",
      entityId: result.insertId,
      metadata: { patient_id: Number(patientId), user_id: Number(userId) },
      ipAddress: req.ip,
    });
    return res.status(201).json({ id: result.insertId, message: "Patient assignment created" });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "This staff member is already assigned to that patient" });
    }
    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({ message: "Patient or staff account was not found" });
    }
    return next(error);
  }
}

async function deletePatientAssignment(req, res, next) {
  if (!/^[1-9]\d*$/.test(req.params.id)) {
    return res.status(400).json({ message: "Invalid assignment ID" });
  }
  try {
    const [result] = await db.promise().query("DELETE FROM patient_assignments WHERE id = ?", [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: "Assignment not found" });
    await writeAuditLog({
      userId: req.user.id,
      action: "patient.assignment_removed",
      entityType: "patient_assignment",
      entityId: req.params.id,
      ipAddress: req.ip,
    });
    return res.json({ message: "Patient assignment removed" });
  } catch (error) {
    return next(error);
  }
}

module.exports = { createPatientAssignment, deletePatientAssignment };
