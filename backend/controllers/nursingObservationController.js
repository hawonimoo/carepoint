const db = require("../config/db");
const { writeAuditLog } = require("../services/auditLog");

async function listObservations(req, res, next) {
  try {
    const nurseOnly = req.user.role === "nurse";
    const filter = nurseOnly
      ? "WHERE EXISTS (SELECT 1 FROM patient_assignments pa WHERE pa.patient_id = o.patient_id AND pa.user_id = ?)"
      : "";
    const values = nurseOnly ? [req.user.id] : [];
    const [rows] = await db.promise().query(
      `SELECT o.id, o.patient_id, p.full_name AS patient_name,
              o.nurse_user_id, o.observation, o.recorded_at
       FROM nursing_observations o
       JOIN patients p ON p.id = o.patient_id
       ${filter}
       ORDER BY o.recorded_at DESC
       LIMIT 250`,
      values
    );
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
}

async function createObservation(req, res, next) {
  const patientId = req.body?.patient_id;
  const observation = req.body?.observation;
  if (!/^[1-9]\d*$/.test(String(patientId || "")) || typeof observation !== "string" || !observation.trim() || observation.length > 5000) {
    return res.status(400).json({ message: "Provide a patient ID and an observation up to 5000 characters" });
  }
  try {
    if (req.user.role === "nurse") {
      const [assignment] = await db.promise().query(
        "SELECT id FROM patient_assignments WHERE patient_id = ? AND user_id = ? LIMIT 1",
        [patientId, req.user.id]
      );
      if (!assignment.length) return res.status(403).json({ message: "You are not assigned to this patient" });
    }
    const [result] = await db.promise().query(
      "INSERT INTO nursing_observations (patient_id, nurse_user_id, observation) VALUES (?, ?, ?)",
      [patientId, req.user.id, observation.trim()]
    );
    await writeAuditLog({
      userId: req.user.id,
      action: "nursing_observation.created",
      entityType: "nursing_observation",
      entityId: result.insertId,
      metadata: { patient_id: Number(patientId) },
      ipAddress: req.ip,
    });
    return res.status(201).json({ id: result.insertId, message: "Nursing observation recorded" });
  } catch (error) {
    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(404).json({ message: "Patient not found" });
    }
    return next(error);
  }
}

module.exports = { listObservations, createObservation };
