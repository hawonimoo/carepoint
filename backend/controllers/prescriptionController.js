const db = require("../config/db");

async function listPrescriptions(req, res, next) {
  try {
    const doctorScope = req.user.role === "doctor" ? "WHERE pr.doctor_id = ?" : "";
    const values = req.user.role === "doctor" ? [req.user.doctorId || 0] : [];
    const [rows] = await db.promise().query(
      `SELECT pr.id, pr.prescription_number, pr.patient_id, pr.doctor_id,
              pr.medicine_id, pr.dosage, pr.quantity, pr.dispensed_quantity,
              pr.instructions, pr.status, pr.created_at,
              p.full_name AS patient_name, d.full_name AS doctor_name,
              m.medicine_name
       FROM prescriptions pr
       JOIN patients p ON p.id = pr.patient_id
       JOIN doctors d ON d.id = pr.doctor_id
       JOIN medicines m ON m.id = pr.medicine_id
       ${doctorScope}
       ORDER BY pr.created_at DESC
       LIMIT 500`,
      values
    );
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
}

async function createPrescription(req, res, next) {
  const {
    prescription_number: prescriptionNumber,
    patient_id: patientId,
    medicine_id: medicineId,
    dosage,
    quantity,
    instructions = null,
  } = req.body || {};
  const doctorId = req.user.role === "doctor" ? req.user.doctorId : req.body?.doctor_id;

  if (
    typeof prescriptionNumber !== "string" || !prescriptionNumber.trim() || prescriptionNumber.length > 30 ||
    !/^[1-9]\d*$/.test(String(patientId || "")) ||
    !/^[1-9]\d*$/.test(String(doctorId || "")) ||
    !/^[1-9]\d*$/.test(String(medicineId || "")) ||
    !Number.isInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > 10000 ||
    typeof dosage !== "string" || !dosage.trim() || dosage.length > 255 ||
    (instructions !== null && (typeof instructions !== "string" || instructions.length > 5000))
  ) {
    return res.status(400).json({ message: "Provide valid prescription, patient, doctor, medicine, dose, and quantity fields" });
  }
  if (req.user.role === "doctor" && !req.user.doctorId) {
    return res.status(403).json({ message: "This doctor account is not linked to a doctor record" });
  }

  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    if (req.user.role === "doctor") {
      const [assigned] = await connection.query(
        `SELECT p.id FROM patients p WHERE p.id = ? AND (
           EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = p.id AND a.doctor_id = ?)
           OR EXISTS (SELECT 1 FROM patient_assignments pa WHERE pa.patient_id = p.id AND pa.user_id = ?)
         ) LIMIT 1`,
        [patientId, doctorId, req.user.id]
      );
      if (!assigned.length) {
        await connection.rollback();
        return res.status(403).json({ message: "You are not assigned to this patient" });
      }
    }
    const [result] = await connection.query(
      `INSERT INTO prescriptions
        (prescription_number, patient_id, doctor_id, medicine_id, dosage, quantity, instructions)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [prescriptionNumber.trim(), patientId, doctorId, medicineId, dosage.trim(), Number(quantity), instructions?.trim() || null]
    );
    await connection.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
       VALUES (?, 'prescription.created', 'prescription', ?, ?)`,
      [req.user.id, String(result.insertId), JSON.stringify({
        patient_id: Number(patientId),
        doctor_id: Number(doctorId),
        medicine_id: Number(medicineId),
        quantity: Number(quantity),
      })]
    );
    await connection.commit();
    return res.status(201).json({ id: result.insertId, message: "Prescription created" });
  } catch (error) {
    await connection.rollback();
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Prescription number already exists" });
    if (error.code === "ER_NO_REFERENCED_ROW_2") return res.status(400).json({ message: "Selected patient, doctor, or medicine was not found" });
    return next(error);
  } finally {
    connection.release();
  }
}

async function dispensePrescription(req, res, next) {
  const quantity = Number(req.body?.quantity);
  if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
    return res.status(400).json({ message: "Provide a valid prescription ID and dispensing quantity" });
  }
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT pr.id, pr.medicine_id, pr.quantity, pr.dispensed_quantity,
              pr.status, m.quantity AS stock
       FROM prescriptions pr
       JOIN medicines m ON m.id = pr.medicine_id
       WHERE pr.id = ? FOR UPDATE`,
      [req.params.id]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ message: "Prescription not found" });
    }
    const prescription = rows[0];
    const remaining = Number(prescription.quantity) - Number(prescription.dispensed_quantity);
    if (prescription.status === "Cancelled" || quantity > remaining) {
      await connection.rollback();
      return res.status(409).json({ message: "Dispensed quantity exceeds the active prescription balance" });
    }
    if (quantity > Number(prescription.stock)) {
      await connection.rollback();
      return res.status(409).json({ message: "Insufficient medicine stock" });
    }

    const dispensedQuantity = Number(prescription.dispensed_quantity) + quantity;
    const status = dispensedQuantity === Number(prescription.quantity) ? "Dispensed" : "Partially Dispensed";
    await connection.query(
      `UPDATE medicines
       SET quantity = quantity - ?,
           status = CASE WHEN quantity - ? <= 0 THEN 'Out of Stock' ELSE status END
       WHERE id = ?`,
      [quantity, quantity, prescription.medicine_id]
    );
    await connection.query(
      "UPDATE prescriptions SET dispensed_quantity = ?, status = ? WHERE id = ?",
      [dispensedQuantity, status, prescription.id]
    );
    await connection.query(
      `INSERT INTO prescription_dispensings (prescription_id, medicine_id, dispensed_by, quantity)
       VALUES (?, ?, ?, ?)`,
      [prescription.id, prescription.medicine_id, req.user.id, quantity]
    );
    await connection.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
       VALUES (?, 'prescription.dispensed', 'prescription', ?, ?)`,
      [req.user.id, String(prescription.id), JSON.stringify({
        medicine_id: prescription.medicine_id,
        quantity,
        total_dispensed: dispensedQuantity,
        status,
      })]
    );
    await connection.commit();
    return res.json({ message: "Prescription dispensed", dispensedQuantity, status });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
}

module.exports = { listPrescriptions, createPrescription, dispensePrescription };
