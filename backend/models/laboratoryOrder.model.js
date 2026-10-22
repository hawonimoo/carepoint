const db = require("../config/db");

function inList(values) {
  return values.map(() => "?").join(", ");
}

async function listCatalogue(user) {
  const departmentClause = user.role === "laboratory_staff"
    ? "AND (department_id IS NULL OR department_id = ?)"
    : "";
  const params = user.role === "laboratory_staff" ? [user.departmentId || 0] : [];
  const [rows] = await db.promise().query(
    `SELECT id, test_code, test_name, specimen_type, unit,
            reference_range_min, reference_range_max, reference_range_text,
            department_id, is_active
     FROM laboratory_test_catalogue
     WHERE is_active = 1 ${departmentClause}
     ORDER BY test_name`,
    params
  );
  return rows;
}

async function list(user) {
  let scope = "";
  let values = [];
  if (user.role === "doctor") {
    scope = `WHERE lo.doctor_id = ? AND (
      EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = lo.patient_id AND a.doctor_id = lo.doctor_id)
      OR EXISTS (SELECT 1 FROM patient_assignments pa WHERE pa.patient_id = lo.patient_id AND pa.user_id = ?)
    )`;
    values = [user.doctorId || 0, user.id];
  } else if (user.role === "laboratory_staff") {
    scope = "WHERE (lo.department_id IS NULL OR lo.department_id = ?)";
    values = [user.departmentId || 0];
  }
  const [orders] = await db.promise().query(
    `SELECT lo.id, lo.order_number, lo.patient_id, lo.doctor_id, lo.consultation_id,
            lo.department_id, lo.clinical_reason, lo.priority, lo.status,
            lo.rejected_by, lo.rejected_at, lo.rejection_reason,
            lo.accepted_by, lo.accepted_at,
            lo.created_at, lo.updated_at, p.full_name AS patient_name,
            p.patient_number, d.full_name AS doctor_name,
            u_doc.id AS doctor_user_id
     FROM laboratory_orders lo
     JOIN patients p ON p.id = lo.patient_id
     JOIN doctors d ON d.id = lo.doctor_id
     LEFT JOIN users u_doc ON u_doc.doctor_id = d.id AND u_doc.role = 'doctor'
     ${scope}
     ORDER BY CASE lo.priority WHEN 'STAT' THEN 0 WHEN 'Urgent' THEN 1 ELSE 2 END,
              lo.created_at DESC
     LIMIT 500`,
    values
  );
  if (!orders.length) return [];
  const ids = orders.map((order) => order.id);

  const [items] = await db.promise().query(
    `SELECT i.id, i.laboratory_order_id, i.catalogue_test_id, i.test_name, i.specimen_type,
            i.specimen_barcode, i.sample_status, i.collected_at, i.collected_by,
            i.sample_rejection_reason, i.unit, i.reference_range, i.abnormal_flag,
            i.assigned_to, i.delay_reason, i.is_draft, i.verified_by, i.verified_at,
            i.released_at, i.status, i.result, i.notes, i.result_entered_at, i.updated_at,
            u_col.full_name AS collected_by_name,
            u_asn.full_name AS assigned_to_name,
            u_ver.full_name AS verified_by_name
     FROM laboratory_order_items i
     LEFT JOIN users u_col ON u_col.id = i.collected_by
     LEFT JOIN users u_asn ON u_asn.id = i.assigned_to
     LEFT JOIN users u_ver ON u_ver.id = i.verified_by
     WHERE i.laboratory_order_id IN (${inList(ids)})
     ORDER BY i.id`,
    ids
  );

  const [events] = await db.promise().query(
    `SELECT id, laboratory_order_id, laboratory_order_item_id,
            old_status, new_status, details, created_at
     FROM laboratory_order_events
     WHERE laboratory_order_id IN (${inList(ids)})
     ORDER BY created_at, id`,
    ids
  );

  const itemsByOrder = new Map();
  const eventsByOrder = new Map();
  for (const item of items) {
    const listForOrder = itemsByOrder.get(item.laboratory_order_id) || [];
    listForOrder.push(item);
    itemsByOrder.set(item.laboratory_order_id, listForOrder);
  }
  for (const event of events) {
    const listForOrder = eventsByOrder.get(event.laboratory_order_id) || [];
    listForOrder.push(event);
    eventsByOrder.set(event.laboratory_order_id, listForOrder);
  }

  return orders.map((order) => ({
    ...order,
    items: itemsByOrder.get(order.id) || [],
    events: eventsByOrder.get(order.id) || [],
  }));
}

async function create({ orderNumber, patientId, doctorId, consultationId, reason, priority, testIds, userId }) {
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
      error.code = "LAB_PATIENT_FORBIDDEN";
      throw error;
    }
    if (consultationId !== null) {
      const [consultations] = await connection.query(
        "SELECT id FROM consultations WHERE id = ? AND patient_id = ? AND doctor_id = ? LIMIT 1",
        [consultationId, patientId, doctorId]
      );
      if (!consultations.length) {
        const error = new Error("Select a consultation for this patient");
        error.code = "LAB_CONSULTATION_INVALID";
        throw error;
      }
    }
    const [tests] = await connection.query(
      `SELECT id, test_name, specimen_type, unit, reference_range_text, department_id
       FROM laboratory_test_catalogue
       WHERE is_active = 1 AND id IN (${inList(testIds)})
       FOR UPDATE`,
      testIds
    );
    if (tests.length !== testIds.length) {
      const error = new Error("One or more selected laboratory tests are unavailable");
      error.code = "LAB_TEST_INVALID";
      throw error;
    }
    const departmentIds = new Set(tests.map((test) => test.department_id == null ? "null" : String(test.department_id)));
    if (departmentIds.size > 1) {
      const error = new Error("Tests from different laboratory departments must be ordered separately");
      error.code = "LAB_DEPARTMENT_MISMATCH";
      throw error;
    }
    const departmentId = tests[0].department_id || null;
    const [result] = await connection.query(
      `INSERT INTO laboratory_orders
        (order_number, patient_id, doctor_id, consultation_id, department_id,
         clinical_reason, priority, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderNumber, patientId, doctorId, consultationId, departmentId, reason, priority, userId]
    );
    for (const test of tests) {
      await connection.query(
        `INSERT INTO laboratory_order_items
          (laboratory_order_id, catalogue_test_id, test_name, specimen_type, unit, reference_range)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [result.insertId, test.id, test.test_name, test.specimen_type, test.unit || null, test.reference_range_text || null]
      );
    }
    await connection.query(
      `INSERT INTO laboratory_order_events
        (laboratory_order_id, changed_by, old_status, new_status, details)
       VALUES (?, ?, NULL, 'Pending', ?)`,
      [result.insertId, userId, JSON.stringify({ test_count: tests.length })]
    );
    await connection.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
       VALUES (?, 'laboratory_order.created', 'laboratory_order', ?, ?)`,
      [userId, String(result.insertId), JSON.stringify({ patient_id: patientId, test_count: tests.length })]
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

async function accept(orderId, user) {
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const deptClause = user.role === "laboratory_staff"
      ? "AND (department_id IS NULL OR department_id = ?)"
      : "";
    const params = user.role === "laboratory_staff" ? [orderId, user.departmentId || 0] : [orderId];
    const [orders] = await connection.query(
      `SELECT id, status FROM laboratory_orders WHERE id = ? ${deptClause} FOR UPDATE`,
      params
    );
    if (!orders.length) {
      const error = new Error("Laboratory order not found");
      error.code = "LAB_ORDER_NOT_FOUND";
      throw error;
    }
    const order = orders[0];
    if (order.status !== "Pending") {
      const error = new Error(`Laboratory order cannot be accepted while its status is ${order.status}`);
      error.code = "LAB_STATUS_CONFLICT";
      throw error;
    }
    await connection.query(
      "UPDATE laboratory_orders SET status = 'Accepted', accepted_by = ?, accepted_at = CURRENT_TIMESTAMP WHERE id = ?",
      [user.id, orderId]
    );
    await connection.query(
      "UPDATE laboratory_order_items SET status = 'Accepted', updated_by = ? WHERE laboratory_order_id = ? AND status = 'Pending'",
      [user.id, orderId]
    );
    await connection.query(
      `INSERT INTO laboratory_order_events
        (laboratory_order_id, changed_by, old_status, new_status)
       VALUES (?, ?, ?, 'Accepted')`,
      [orderId, user.id, order.status]
    );
    await connection.query(
      "INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES (?, 'laboratory_order.accepted', 'laboratory_order', ?)",
      [user.id, String(orderId)]
    );
    await connection.commit();
    return { status: "Accepted" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function rejectOrder(orderId, user, { rejectionReason }) {
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const deptClause = user.role === "laboratory_staff"
      ? "AND (department_id IS NULL OR department_id = ?)"
      : "";
    const params = user.role === "laboratory_staff" ? [orderId, user.departmentId || 0] : [orderId];
    const [orders] = await connection.query(
      `SELECT lo.id, lo.order_number, lo.status, lo.patient_id, lo.doctor_id, u_doc.id AS doctor_user_id
       FROM laboratory_orders lo
       JOIN doctors d ON d.id = lo.doctor_id
       LEFT JOIN users u_doc ON u_doc.doctor_id = d.id AND u_doc.role = 'doctor'
       WHERE lo.id = ? ${deptClause} FOR UPDATE`,
      params
    );
    if (!orders.length) {
      const error = new Error("Laboratory order not found");
      error.code = "LAB_ORDER_NOT_FOUND";
      throw error;
    }
    const order = orders[0];
    if (["Completed", "Cancelled", "Rejected"].includes(order.status)) {
      const error = new Error(`Laboratory order cannot be rejected while its status is ${order.status}`);
      error.code = "LAB_STATUS_CONFLICT";
      throw error;
    }
    await connection.query(
      `UPDATE laboratory_orders
       SET status = 'Rejected', rejected_by = ?, rejected_at = CURRENT_TIMESTAMP, rejection_reason = ?
       WHERE id = ?`,
      [user.id, rejectionReason, orderId]
    );
    await connection.query(
      `UPDATE laboratory_order_items
       SET status = 'Cancelled', notes = CONCAT(COALESCE(notes, ''), ' [Order Rejected: ', ?, ']')
       WHERE laboratory_order_id = ? AND status NOT IN ('Completed', 'Cancelled')`,
      [rejectionReason, orderId]
    );
    await connection.query(
      `INSERT INTO laboratory_order_events
        (laboratory_order_id, changed_by, old_status, new_status, details)
       VALUES (?, ?, ?, 'Rejected', ?)`,
      [orderId, user.id, order.status, JSON.stringify({ reason: rejectionReason })]
    );
    if (order.doctor_user_id) {
      await connection.query(
        `INSERT INTO notifications (recipient_user_id, patient_id, event_type, message)
         VALUES (?, ?, 'lab_order_rejected', ?)`,
        [order.doctor_user_id, order.patient_id, `Lab Order ${order.order_number} was rejected: ${rejectionReason}`]
      );
    }
    await connection.query(
      "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata) VALUES (?, 'laboratory_order.rejected', 'laboratory_order', ?, ?)",
      [user.id, String(orderId), JSON.stringify({ reason: rejectionReason })]
    );
    await connection.commit();
    return { status: "Rejected" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateSample(orderId, itemId, user, { specimenBarcode, sampleType, sampleStatus, rejectionReason }) {
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT lo.id, lo.status AS order_status, i.id AS item_id, i.status AS item_status, i.sample_status AS old_sample_status
       FROM laboratory_orders lo
       JOIN laboratory_order_items i ON i.laboratory_order_id = lo.id
       WHERE lo.id = ? AND i.id = ?
       ${user.role === "laboratory_staff" ? "AND (lo.department_id IS NULL OR lo.department_id = ?)" : ""}
       FOR UPDATE`,
      user.role === "laboratory_staff" ? [orderId, itemId, user.departmentId || 0] : [orderId, itemId]
    );
    if (!rows.length) {
      const error = new Error("Laboratory order or test was not found");
      error.code = "LAB_ORDER_NOT_FOUND";
      throw error;
    }
    const item = rows[0];

    const fields = [
      "sample_status = ?",
      "specimen_barcode = COALESCE(?, specimen_barcode)",
      "specimen_type = COALESCE(?, specimen_type)",
      "sample_rejection_reason = ?",
      "updated_by = ?",
    ];
    const values = [
      sampleStatus,
      specimenBarcode || null,
      sampleType || null,
      rejectionReason || null,
      user.id,
    ];

    if (["Collected", "Received"].includes(sampleStatus)) {
      fields.push("collected_at = COALESCE(collected_at, CURRENT_TIMESTAMP)", "collected_by = COALESCE(collected_by, ?)");
      values.push(user.id);
    }

    let nextItemStatus = item.item_status;
    if (sampleStatus === "Collected" && ["Pending", "Accepted"].includes(item.item_status)) {
      nextItemStatus = "Sample Collected";
      fields.push("status = 'Sample Collected'");
    } else if (sampleStatus === "Received" && item.item_status === "Sample Collected") {
      nextItemStatus = "In Progress";
      fields.push("status = 'In Progress'");
    }

    values.push(itemId);
    await connection.query(`UPDATE laboratory_order_items SET ${fields.join(", ")} WHERE id = ?`, values);

    // Recalculate parent order status
    await syncOrderStatus(connection, orderId);

    await connection.query(
      `INSERT INTO laboratory_order_events
        (laboratory_order_id, laboratory_order_item_id, changed_by, old_status, new_status, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [orderId, itemId, user.id, item.old_sample_status, sampleStatus, JSON.stringify({ barcode: specimenBarcode, sample_type: sampleType })]
    );
    await connection.commit();
    return { sample_status: sampleStatus, item_status: nextItemStatus };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function saveResult(orderId, itemId, user, { result, unit, referenceRange, abnormalFlag, notes, isDraft, assignedTo, delayReason }) {
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT lo.id, i.id AS item_id, i.status AS item_status, i.result AS old_result
       FROM laboratory_orders lo
       JOIN laboratory_order_items i ON i.laboratory_order_id = lo.id
       WHERE lo.id = ? AND i.id = ?
       ${user.role === "laboratory_staff" ? "AND (lo.department_id IS NULL OR lo.department_id = ?)" : ""}
       FOR UPDATE`,
      user.role === "laboratory_staff" ? [orderId, itemId, user.departmentId || 0] : [orderId, itemId]
    );
    if (!rows.length) {
      const error = new Error("Laboratory order or test was not found");
      error.code = "LAB_ORDER_NOT_FOUND";
      throw error;
    }
    const item = rows[0];

    let nextStatus = item.item_status;
    if (!isDraft && result?.trim()) {
      nextStatus = "Ready for Verification";
    } else if (item.item_status === "Accepted" || item.item_status === "Sample Collected") {
      nextStatus = "In Progress";
    }

    await connection.query(
      `UPDATE laboratory_order_items
       SET result = ?,
           unit = COALESCE(?, unit),
           reference_range = COALESCE(?, reference_range),
           abnormal_flag = ?,
           notes = ?,
           is_draft = ?,
           assigned_to = COALESCE(?, assigned_to),
           delay_reason = ?,
           status = ?,
           updated_by = ?
       WHERE id = ?`,
      [
        result ?? item.old_result,
        unit || null,
        referenceRange || null,
        abnormalFlag || null,
        notes || null,
        isDraft ? 1 : 0,
        assignedTo || null,
        delayReason || null,
        nextStatus,
        user.id,
        itemId,
      ]
    );

    await syncOrderStatus(connection, orderId);

    await connection.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
       VALUES (?, 'laboratory_result.saved', 'laboratory_order_item', ?, ?)`,
      [user.id, String(itemId), JSON.stringify({ is_draft: Boolean(isDraft), abnormal_flag: abnormalFlag })]
    );
    await connection.commit();
    return { status: nextStatus, is_draft: Boolean(isDraft) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function verifyAndRelease(orderId, itemId, user, { reviewerNotes } = {}) {
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT lo.id, lo.order_number, lo.patient_id, lo.doctor_id, u_doc.id AS doctor_user_id,
              p.full_name AS patient_name,
              i.id AS item_id, i.test_name, i.result, i.status AS item_status
       FROM laboratory_orders lo
       JOIN patients p ON p.id = lo.patient_id
       JOIN doctors d ON d.id = lo.doctor_id
       LEFT JOIN users u_doc ON u_doc.doctor_id = d.id AND u_doc.role = 'doctor'
       JOIN laboratory_order_items i ON i.laboratory_order_id = lo.id
       WHERE lo.id = ? AND i.id = ?
       ${user.role === "laboratory_staff" ? "AND (lo.department_id IS NULL OR lo.department_id = ?)" : ""}
       FOR UPDATE`,
      user.role === "laboratory_staff" ? [orderId, itemId, user.departmentId || 0] : [orderId, itemId]
    );
    if (!rows.length) {
      const error = new Error("Laboratory order or test was not found");
      error.code = "LAB_ORDER_NOT_FOUND";
      throw error;
    }
    const item = rows[0];
    if (!item.result?.trim()) {
      const error = new Error("A test result must be entered before it can be verified and released");
      error.code = "LAB_RESULT_REQUIRED";
      throw error;
    }

    await connection.query(
      `UPDATE laboratory_order_items
       SET status = 'Completed',
           is_draft = 0,
           verified_by = ?,
           verified_at = CURRENT_TIMESTAMP,
           released_at = CURRENT_TIMESTAMP,
           result_entered_at = COALESCE(result_entered_at, CURRENT_TIMESTAMP),
           notes = CASE WHEN ? IS NOT NULL THEN CONCAT(COALESCE(notes, ''), ' [Reviewer: ', ?, ']') ELSE notes END
       WHERE id = ?`,
      [user.id, reviewerNotes || null, reviewerNotes || null, itemId]
    );

    const orderStatus = await syncOrderStatus(connection, orderId);

    // Notify doctor
    if (item.doctor_user_id) {
      await connection.query(
        `INSERT INTO notifications (recipient_user_id, patient_id, event_type, message)
         VALUES (?, ?, 'lab_result_released', ?)`,
        [item.doctor_user_id, item.patient_id, `Results released for ${item.test_name} (Order ${item.order_number}, Patient: ${item.patient_name})`]
      );
    }

    await connection.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
       VALUES (?, 'laboratory_result.verified_and_released', 'laboratory_order_item', ?, ?)`,
      [user.id, String(itemId), JSON.stringify({ verified_by: user.id, order_status: orderStatus })]
    );

    await connection.commit();
    return { item_status: "Completed", order_status: orderStatus };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function syncOrderStatus(connection, orderId) {
  const [allItems] = await connection.query(
    "SELECT status FROM laboratory_order_items WHERE laboratory_order_id = ?",
    [orderId]
  );
  const terminal = allItems.every((entry) => ["Completed", "Cancelled"].includes(entry.status));
  const hasCompleted = allItems.some((entry) => entry.status === "Completed");
  const orderStatus = allItems.every((entry) => entry.status === "Completed")
    ? "Completed"
    : allItems.every((entry) => entry.status === "Cancelled")
      ? "Cancelled"
      : terminal && hasCompleted
        ? "Partially Completed"
        : allItems.some((entry) => ["In Progress", "Ready for Verification"].includes(entry.status))
          ? "In Progress"
          : allItems.some((entry) => entry.status === "Sample Collected")
            ? "Sample Collected"
            : allItems.some((entry) => entry.status === "Accepted")
              ? "Accepted"
              : "Pending";

  await connection.query("UPDATE laboratory_orders SET status = ? WHERE id = ?", [orderStatus, orderId]);
  return orderStatus;
}

async function updateItem(orderId, itemId, user, { status, result, notes }) {
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT lo.id, lo.status AS order_status, lo.department_id,
              i.id AS item_id, i.status AS item_status, i.result AS old_result
       FROM laboratory_orders lo
       JOIN laboratory_order_items i ON i.laboratory_order_id = lo.id
       WHERE lo.id = ? AND i.id = ?
       ${user.role === "laboratory_staff" ? "AND (lo.department_id IS NULL OR lo.department_id = ?)" : ""}
       FOR UPDATE`,
      user.role === "laboratory_staff"
        ? [orderId, itemId, user.departmentId || 0]
        : [orderId, itemId]
    );
    if (!rows.length) {
      const error = new Error("Laboratory order or test was not found");
      error.code = "LAB_ORDER_NOT_FOUND";
      throw error;
    }
    const item = rows[0];
    const transitions = {
      Pending: ["Cancelled"],
      Accepted: ["Sample Collected", "Cancelled"],
      "Sample Collected": ["In Progress", "Cancelled"],
      "In Progress": ["Ready for Verification", "Completed", "Cancelled"],
      "Ready for Verification": ["Completed", "In Progress", "Cancelled"],
    };
    if (!(transitions[item.item_status] || []).includes(status)) {
      const error = new Error(`Test cannot move from ${item.item_status} to ${status}`);
      error.code = "LAB_STATUS_CONFLICT";
      throw error;
    }
    if (status === "Completed" && !result?.trim()) {
      const error = new Error("Enter the test result before completing it");
      error.code = "LAB_RESULT_REQUIRED";
      throw error;
    }
    await connection.query(
      `UPDATE laboratory_order_items
       SET status = ?, result = ?, notes = ?, updated_by = ?,
           result_entered_at = CASE WHEN ? = 'Completed' THEN CURRENT_TIMESTAMP ELSE result_entered_at END,
           verified_by = CASE WHEN ? = 'Completed' THEN ? ELSE verified_by END,
           verified_at = CASE WHEN ? = 'Completed' THEN CURRENT_TIMESTAMP ELSE verified_at END,
           released_at = CASE WHEN ? = 'Completed' THEN CURRENT_TIMESTAMP ELSE released_at END
       WHERE id = ?`,
      [status, result ?? item.old_result, notes ?? null, user.id, status, status, user.id, status, status, itemId]
    );
    const orderStatus = await syncOrderStatus(connection, orderId);
    await connection.query(
      `INSERT INTO laboratory_order_events
        (laboratory_order_id, laboratory_order_item_id, changed_by, old_status, new_status, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [orderId, itemId, user.id, item.item_status, status, JSON.stringify({ result_changed: result !== undefined })]
    );
    await connection.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
       VALUES (?, 'laboratory_test.updated', 'laboratory_order_item', ?, ?)`,
      [user.id, String(itemId), JSON.stringify({ old_status: item.item_status, status, order_status: orderStatus })]
    );
    await connection.commit();
    return { item_status: status, order_status: orderStatus };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  accept,
  rejectOrder,
  updateSample,
  saveResult,
  verifyAndRelease,
  create,
  list,
  listCatalogue,
  updateItem,
};
