const db = require("../config/db");

function placeholders(ids) {
  return ids.map(() => "?").join(", ");
}

function statusEvent(orderId, userId, oldStatus, newStatus, details = null, executor = db.promise()) {
  return executor.query(
    `INSERT INTO prescription_events
      (prescription_id, changed_by, old_status, new_status, details)
     VALUES (?, ?, ?, ?, ?)`,
    [orderId, userId, oldStatus, newStatus, details ? JSON.stringify(details) : null]
  );
}

async function list(user) {
  const doctorFilter = user.role === "doctor"
    ? `WHERE pr.doctor_id = ? AND (
         EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = pr.patient_id AND a.doctor_id = pr.doctor_id)
         OR EXISTS (SELECT 1 FROM patient_assignments pa WHERE pa.patient_id = pr.patient_id AND pa.user_id = ?)
       )`
    : "";
  const params = user.role === "doctor" ? [user.doctorId || 0, user.id] : [];
  const [orders] = await db.promise().query(
    `SELECT pr.id, pr.prescription_number, pr.patient_id, pr.doctor_id,
            pr.consultation_id, pr.status, pr.created_at, pr.updated_at,
            p.full_name AS patient_name, p.patient_number,
            d.full_name AS doctor_name
     FROM prescriptions pr
     JOIN patients p ON p.id = pr.patient_id
     JOIN doctors d ON d.id = pr.doctor_id
     ${doctorFilter}
     ORDER BY pr.created_at DESC
     LIMIT 300`,
    params
  );
  if (!orders.length) return [];

  const ids = orders.map((order) => order.id);
  const [items] = await db.promise().query(
    `SELECT id, prescription_id, medicine_id, medicine_name, strength,
            dosage_form, dose, route, frequency, duration, quantity,
            dispensed_quantity, instructions
     FROM prescription_order_items
     WHERE prescription_id IN (${placeholders(ids)})
     ORDER BY id`,
    ids
  );
  const [events] = await db.promise().query(
    `SELECT id, prescription_id, old_status, new_status, details, created_at
     FROM prescription_events
     WHERE prescription_id IN (${placeholders(ids)})
     ORDER BY created_at, id`,
    ids
  );
  const itemsByOrder = new Map();
  const eventsByOrder = new Map();
  for (const item of items) {
    const rows = itemsByOrder.get(item.prescription_id) || [];
    rows.push(item);
    itemsByOrder.set(item.prescription_id, rows);
  }
  for (const event of events) {
    const rows = eventsByOrder.get(event.prescription_id) || [];
    rows.push(event);
    eventsByOrder.set(event.prescription_id, rows);
  }
  return orders.map((order) => ({
    ...order,
    items: itemsByOrder.get(order.id) || [],
    events: eventsByOrder.get(order.id) || [],
  }));
}

async function create({ orderNumber, patientId, doctorId, consultationId, items, userId }) {
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const [patients] = await connection.query(
      `SELECT p.id FROM patients p
       WHERE p.id = ? AND (
         EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = p.id AND a.doctor_id = ?)
         OR EXISTS (SELECT 1 FROM patient_assignments pa WHERE pa.patient_id = p.id AND pa.user_id = ?)
       )
       LIMIT 1 FOR UPDATE`,
      [patientId, doctorId, userId]
    );
    if (!patients.length) {
      const error = new Error("You are not assigned to this patient");
      error.code = "ORDER_PATIENT_FORBIDDEN";
      throw error;
    }
    if (consultationId !== null) {
      const [consultations] = await connection.query(
        `SELECT id FROM consultations
         WHERE id = ? AND patient_id = ? AND doctor_id = ?
         LIMIT 1`,
        [consultationId, patientId, doctorId]
      );
      if (!consultations.length) {
        const error = new Error("Select a consultation for this patient");
        error.code = "ORDER_CONSULTATION_INVALID";
        throw error;
      }
    }
    const medicineIds = [...new Set(items.map((item) => item.medicine_id))];
    const [medicines] = await connection.query(
      `SELECT id, medicine_name, category, status
       FROM medicines
       WHERE id IN (${placeholders(medicineIds)})
         AND LOWER(COALESCE(status, 'available')) = 'available'
       FOR UPDATE`,
      medicineIds
    );
    if (medicines.length !== medicineIds.length) {
      const error = new Error("One or more selected medicines were not found");
      error.code = "ORDER_MEDICINE_INVALID";
      throw error;
    }
    const medicineById = new Map(medicines.map((medicine) => [medicine.id, medicine]));
    const firstItem = items[0];
    const legacyDosage = `${firstItem.dose}; ${firstItem.route}; ${firstItem.frequency}; ${firstItem.duration}`.slice(0, 255);
    const [result] = await connection.query(
      `INSERT INTO prescriptions
        (prescription_number, patient_id, doctor_id, medicine_id, dosage, quantity,
         instructions, consultation_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderNumber, patientId, doctorId, firstItem.medicine_id, legacyDosage,
        firstItem.quantity, firstItem.instructions, consultationId, userId,
      ]
    );
    for (const item of items) {
      const medicine = medicineById.get(item.medicine_id);
      await connection.query(
        `INSERT INTO prescription_order_items
          (prescription_id, medicine_id, medicine_name, strength, dosage_form,
           dose, route, frequency, duration, quantity, instructions)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          result.insertId, item.medicine_id, medicine.medicine_name,
          item.strength, item.dosage_form || medicine.category, item.dose,
          item.route, item.frequency, item.duration, item.quantity, item.instructions,
        ]
      );
    }
    await statusEvent(result.insertId, userId, null, "Pending", { item_count: items.length }, connection);
    await connection.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
       VALUES (?, 'prescription_order.created', 'prescription', ?, ?)`,
      [userId, String(result.insertId), JSON.stringify({ patient_id: patientId, item_count: items.length })]
    );
    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function accept(orderId, userId) {
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      "SELECT id, status FROM prescriptions WHERE id = ? FOR UPDATE",
      [orderId]
    );
    if (!rows.length) {
      const error = new Error("Prescription order not found");
      error.code = "ORDER_NOT_FOUND";
      throw error;
    }
    const order = rows[0];
    if (order.status !== "Pending") {
      const error = new Error(`Prescription cannot be accepted while its status is ${order.status}`);
      error.code = "ORDER_STATUS_CONFLICT";
      throw error;
    }
    await connection.query(
      `UPDATE prescriptions SET status = 'Processing', accepted_by = ?, accepted_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [userId, orderId]
    );
    await statusEvent(orderId, userId, order.status, "Processing", null, connection);
    await connection.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
       VALUES (?, 'prescription_order.accepted', 'prescription', ?)`,
      [userId, String(orderId)]
    );
    await connection.commit();
    return { status: "Processing" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function dispense(orderId, userId, items, notes = null) {
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const [orders] = await connection.query(
      "SELECT id, status FROM prescriptions WHERE id = ? FOR UPDATE",
      [orderId]
    );
    if (!orders.length) {
      const error = new Error("Prescription order not found");
      error.code = "ORDER_NOT_FOUND";
      throw error;
    }
    const order = orders[0];
    if (!["Processing", "Partially Dispensed"].includes(order.status)) {
      const error = new Error("Accept the prescription before dispensing it");
      error.code = "ORDER_STATUS_CONFLICT";
      throw error;
    }
    const [lineItems] = await connection.query(
      `SELECT id, medicine_id, quantity, dispensed_quantity
       FROM prescription_order_items
       WHERE prescription_id = ? FOR UPDATE`,
      [orderId]
    );
    const itemById = new Map(lineItems.map((item) => [String(item.id), item]));
    for (const requestItem of items) {
      const item = itemById.get(String(requestItem.item_id));
      if (!item) {
        const error = new Error("A selected medicine line does not belong to this prescription");
        error.code = "ORDER_ITEM_INVALID";
        throw error;
      }
      const remaining = Number(item.quantity) - Number(item.dispensed_quantity);
      if (requestItem.quantity > remaining) {
        const error = new Error("Dispensed quantity exceeds the remaining prescribed quantity");
        error.code = "ORDER_QUANTITY_CONFLICT";
        throw error;
      }
      const [stockRows] = await connection.query(
        "SELECT quantity, status, expiry_date FROM medicines WHERE id = ? FOR UPDATE",
        [item.medicine_id]
      );
      if (!stockRows.length || Number(stockRows[0].quantity) < requestItem.quantity) {
        const error = new Error("Insufficient medicine stock");
        error.code = "ORDER_STOCK_CONFLICT";
        throw error;
      }
      const expiryDate = stockRows[0].expiry_date instanceof Date
        ? stockRows[0].expiry_date.toISOString().slice(0, 10)
        : String(stockRows[0].expiry_date || "").slice(0, 10);
      if (expiryDate && expiryDate < new Date().toISOString().slice(0, 10)) {
        const error = new Error("Expired medicine cannot be dispensed");
        error.code = "ORDER_STOCK_CONFLICT";
        throw error;
      }
      await connection.query(
        `UPDATE medicines SET quantity = quantity - ?,
         status = CASE WHEN quantity - ? <= 0 THEN 'Out of Stock' ELSE status END
         WHERE id = ?`,
        [requestItem.quantity, requestItem.quantity, item.medicine_id]
      );
      await connection.query(
        "UPDATE prescription_order_items SET dispensed_quantity = dispensed_quantity + ? WHERE id = ?",
        [requestItem.quantity, item.id]
      );
      await connection.query(
        `INSERT INTO prescription_dispensings
          (prescription_id, medicine_id, dispensed_by, quantity)
         VALUES (?, ?, ?, ?)`,
        [orderId, item.medicine_id, userId, requestItem.quantity]
      );
    }
    const [updatedItems] = await connection.query(
      "SELECT quantity, dispensed_quantity FROM prescription_order_items WHERE prescription_id = ?",
      [orderId]
    );
    const complete = updatedItems.every((item) => Number(item.quantity) === Number(item.dispensed_quantity));
    const anyDispensed = updatedItems.some((item) => Number(item.dispensed_quantity) > 0);
    const nextStatus = complete ? "Dispensed" : anyDispensed ? "Partially Dispensed" : "Processing";
    const dispensedTotal = updatedItems.reduce((total, item) => total + Number(item.dispensed_quantity), 0);
    await connection.query(
      "UPDATE prescriptions SET dispensed_quantity = ?, status = ? WHERE id = ?",
      [dispensedTotal, nextStatus, orderId]
    );
    await statusEvent(orderId, userId, order.status, nextStatus, {
      dispensed_lines: items.length,
      notes,
    }, connection);
    await connection.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
       VALUES (?, 'prescription_order.dispensed', 'prescription', ?, ?)`,
      [userId, String(orderId), JSON.stringify({ dispensed_lines: items.length, status: nextStatus })]
    );
    await connection.commit();
    return { status: nextStatus };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { accept, create, dispense, list };
