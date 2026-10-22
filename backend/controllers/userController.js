const bcrypt = require("bcryptjs");
const db = require("../config/db");
const { normalizeRole } = require("../middleware/auth");

const ROLES = new Set([
  "admin",
  "receptionist",
  "doctor",
  "nurse",
  "laboratory_staff",
  "pharmacist",
  "accountant",
  "other_staff",
]);

async function listUsers(req, res, next) {
  try {
    const [rows] = await db.promise().query(
      `SELECT id, full_name, email, role, is_active, doctor_id, department_id, created_at
       FROM users ORDER BY created_at DESC`
    );
    return res.json(rows.map((user) => ({ ...user, role: normalizeRole(user.role) })));
  } catch (error) {
    return next(error);
  }
}

async function createUser(req, res, next) {
  const { full_name: fullName, email, password, role, doctor_id: doctorId = null, department_id: departmentId = null } = req.body || {};

  if (
    typeof fullName !== "string" || !fullName.trim() || fullName.length > 100 ||
    typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 100 ||
    typeof password !== "string" || password.length < 12 || password.length > 128 ||
    typeof role !== "string" || !ROLES.has(role)
  ) {
    return res.status(400).json({
      message: "Provide a name, valid email, password of at least 12 characters, and an allowed role",
    });
  }
  if (["receptionist", "laboratory_staff"].includes(role) && !departmentId) {
    return res.status(400).json({ message: "Receptionist and laboratory staff accounts must be assigned to a department" });
  }
  if (role === "doctor" && !doctorId) {
    return res.status(400).json({ message: "Doctor accounts must be linked to a doctor record" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO users (full_name, email, password, role, doctor_id, department_id, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [fullName.trim(), email.trim().toLowerCase(), passwordHash, role, doctorId, departmentId]
    );
    if (role !== "doctor") {
      await connection.query(
        "UPDATE users SET staff_number = ? WHERE id = ? AND staff_number IS NULL",
        [`STF-${String(result.insertId).padStart(6, "0")}`, result.insertId]
      );
    }
    await connection.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata, ip_address)
       VALUES (?, 'staff.created', 'user', ?, ?, ?)`,
      [req.user.id, String(result.insertId), JSON.stringify({ role }), req.ip]
    );
    await connection.commit();
    return res.status(201).json({ id: result.insertId, message: "Staff account created" });
  } catch (error) {
    await connection.rollback();
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "The email or linked doctor record is already assigned to an account" });
    }
    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({ message: "Selected doctor or department was not found" });
    }
    return next(error);
  } finally {
    connection.release();
  }
}

async function updateUser(req, res, next) {
  const userId = req.params.id;
  const {
    is_active: isActive,
    role,
    doctor_id: doctorId,
    department_id: departmentId,
    new_password: newPassword,
  } = req.body || {};

  if (!/^[1-9]\d*$/.test(userId)) {
    return res.status(400).json({ message: "Invalid staff account ID" });
  }
  if (Number(userId) === req.user.id && isActive === false) {
    return res.status(400).json({ message: "You cannot deactivate your own account" });
  }
  if (isActive === undefined && role === undefined && doctorId === undefined && departmentId === undefined && newPassword === undefined) {
    return res.status(400).json({ message: "Provide account status, role, assignment, or a new password" });
  }
  if (role !== undefined && (typeof role !== "string" || !ROLES.has(role))) {
    return res.status(400).json({ message: "Invalid role" });
  }
  if (isActive !== undefined && typeof isActive !== "boolean") {
    return res.status(400).json({ message: "is_active must be true or false" });
  }
  if (newPassword !== undefined && (typeof newPassword !== "string" || newPassword.length < 12 || newPassword.length > 128)) {
    return res.status(400).json({ message: "New passwords must be between 12 and 128 characters" });
  }
  if (doctorId !== undefined && doctorId !== null && !/^[1-9]\d*$/.test(String(doctorId))) {
    return res.status(400).json({ message: "Invalid doctor record ID" });
  }
  if (departmentId !== undefined && departmentId !== null && !/^[1-9]\d*$/.test(String(departmentId))) {
    return res.status(400).json({ message: "Invalid department ID" });
  }

  const fields = [];
  const values = [];
  const passwordHash = newPassword === undefined ? undefined : await bcrypt.hash(newPassword, 12);
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const [existingUsers] = await connection.query(
      "SELECT role, is_active, doctor_id, department_id FROM users WHERE id = ? FOR UPDATE",
      [userId]
    );
    if (!existingUsers.length) {
      await connection.rollback();
      return res.status(404).json({ message: "Staff account not found" });
    }
    const existingUser = existingUsers[0];
    const nextRole = role === undefined ? existingUser.role : role;
    const nextDoctorId = doctorId === undefined ? existingUser.doctor_id : doctorId;
    const nextDepartmentId = departmentId === undefined ? existingUser.department_id : departmentId;
    if (nextRole === "doctor" && !nextDoctorId) {
      await connection.rollback();
      return res.status(400).json({ message: "Doctor accounts must be linked to a doctor record" });
    }
    if (["receptionist", "laboratory_staff"].includes(nextRole) && !nextDepartmentId) {
      await connection.rollback();
      return res.status(400).json({ message: "Receptionist and laboratory staff accounts must be assigned to a department" });
    }
    const removingAdmin = existingUser.role === "admin" && existingUser.is_active && (
      role !== undefined && role !== "admin" || isActive === false
    );
    if (removingAdmin) {
      const [activeAdmins] = await connection.query(
        "SELECT id FROM users WHERE role = 'admin' AND is_active = 1 FOR UPDATE"
      );
      if (activeAdmins.length <= 1) {
        await connection.rollback();
        return res.status(409).json({ message: "At least one active administrator account must remain" });
      }
    }

    if (isActive !== undefined) {
      fields.push("is_active = ?");
      values.push(isActive ? 1 : 0);
    }
    if (role !== undefined) {
      fields.push("role = ?");
      values.push(role);
    }
    if (doctorId !== undefined) {
      fields.push("doctor_id = ?");
      values.push(doctorId || null);
    }
    if (departmentId !== undefined) {
      fields.push("department_id = ?");
      values.push(departmentId || null);
    }
    if (passwordHash !== undefined) {
      fields.push("password = ?");
      values.push(passwordHash);
    }

    values.push(userId);
    await connection.query(
      `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
      values
    );
    if (isActive === false || role !== undefined || newPassword !== undefined) {
      await connection.query(
        "UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL",
        [userId]
      );
    }
    await connection.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata, ip_address)
       VALUES (?, 'staff.updated', 'user', ?, ?, ?)`,
      [
        req.user.id,
        userId,
        JSON.stringify({
        ...(isActive === undefined ? {} : { is_active: isActive }),
        ...(role === undefined ? {} : { role }),
        ...(newPassword === undefined ? {} : { password_reset: true }),
        }),
        req.ip,
      ]
    );
    await connection.commit();
    return res.json({ message: "Staff account updated" });
  } catch (error) {
    await connection.rollback();
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "The linked doctor record is already assigned to another account" });
    }
    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({ message: "Selected doctor or department was not found" });
    }
    return next(error);
  } finally {
    connection.release();
  }
}

module.exports = { listUsers, createUser, updateUser };
