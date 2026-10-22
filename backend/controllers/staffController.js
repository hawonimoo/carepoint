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
const CATEGORIES = {
  admin: "Administrator",
  receptionist: "Receptionist",
  doctor: "Doctor",
  nurse: "Nurse",
  laboratory_staff: "Laboratory Staff",
  pharmacist: "Pharmacist",
  accountant: "Accountant",
  other_staff: "Other Staff",
};

function validEmail(email) {
  return typeof email === "string" && email.length <= 100 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function handleStaffSchemaError(error, res, next) {
  if (error.code === "ER_BAD_FIELD_ERROR" || error.code === "ER_NO_SUCH_TABLE") {
    return res.status(503).json({
      message: "Staff directory database migration is required. Back up the database and apply backend/migrations/002_staff_directory.sql.",
    });
  }
  return next(error);
}

const DIRECTORY_QUERY = `
  SELECT CONCAT('doctor:', d.id) AS staff_key, d.id AS record_id, u.id AS user_id,
         d.doctor_number AS staff_number, d.full_name,
         COALESCE(u.email, d.email) AS email, d.phone, 'doctor' AS role,
         'Doctor' AS category, COALESCE(dep.department_name, d.department) AS department,
         COALESCE(u.department_id, dep.id) AS department_id,
         d.gender, d.specialization, d.consultation_fee,
         d.professional_registration_number,
         DATE_FORMAT(COALESCE(d.staff_joined_date, DATE(d.created_at)), '%Y-%m-%d') AS date_joined,
         CASE WHEN u.id IS NULL THEN LOWER(d.status) = 'active'
              ELSE u.is_active = 1 AND LOWER(d.status) = 'active' END AS is_active
  FROM doctors d
  LEFT JOIN users u ON u.doctor_id = d.id AND u.role = 'doctor'
  LEFT JOIN departments dep
    ON dep.id = COALESCE(
      u.department_id,
      (SELECT matching_department.id FROM departments matching_department
       WHERE matching_department.department_name = d.department LIMIT 1)
    )
  UNION ALL
  SELECT CONCAT('user:', u.id) AS staff_key, u.id AS record_id, u.id AS user_id,
         COALESCE(u.staff_number, CONCAT('STF-', LPAD(u.id, 6, '0'))) AS staff_number,
         u.full_name, u.email, u.phone, u.role,
         CASE u.role
           WHEN 'lab_technician' THEN 'Laboratory Staff'
           ${Object.keys(CATEGORIES).map((role) => `WHEN '${role}' THEN '${CATEGORIES[role]}'`).join("\n           ")}
           ELSE 'Other Staff'
         END AS category,
         dep.department_name AS department, u.department_id,
         NULL AS gender, NULL AS specialization, NULL AS consultation_fee,
         u.professional_registration_number,
         DATE_FORMAT(COALESCE(u.staff_joined_date, DATE(u.created_at)), '%Y-%m-%d') AS date_joined,
         u.is_active
  FROM users u
  LEFT JOIN departments dep ON dep.id = u.department_id
  WHERE u.role <> 'doctor' OR u.doctor_id IS NULL
  ORDER BY full_name
`;

async function listStaff(req, res, next) {
  try {
    const [rows] = await db.promise().query(DIRECTORY_QUERY);
    return res.json(rows.map((row) => ({ ...row, role: normalizeRole(row.role), is_active: Boolean(row.is_active) })));
  } catch (error) {
    return handleStaffSchemaError(error, res, next);
  }
}

async function listDepartments(req, res, next) {
  try {
    const [rows] = await db.promise().query(
      "SELECT id, department_name FROM departments WHERE LOWER(COALESCE(status, 'active')) = 'active' ORDER BY department_name"
    );
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
}

function validateStaffInput(body, creating) {
  const fullName = body.full_name;
  const role = body.role;
  if (typeof fullName !== "string" || !fullName.trim() || fullName.trim().length > 100) {
    return "Provide a staff member's full name (maximum 100 characters)";
  }
  if (typeof role !== "string" || !ROLES.has(role)) return "Select a valid staff role";
  if (!validEmail(body.email)) return "Provide a valid email address";
  if (typeof body.phone !== "string" || body.phone.length > 20) return "Phone number must be 20 characters or fewer";
  if (body.department_id !== null && body.department_id !== "" &&
      !/^[1-9]\d*$/.test(String(body.department_id))) return "Select a valid department";
  if (body.professional_registration_number !== undefined &&
      (typeof body.professional_registration_number !== "string" || body.professional_registration_number.length > 100)) {
    return "Professional registration number must be 100 characters or fewer";
  }
  if (body.date_joined !== undefined && !validDate(body.date_joined)) return "Provide a valid date joined";
  if (body.is_active !== undefined && typeof body.is_active !== "boolean") return "Employment status must be active or inactive";
  if (creating && (typeof body.password !== "string" || body.password.length < 12 || body.password.length > 128)) {
    return "Initial password must be between 12 and 128 characters";
  }
  if (role === "doctor") {
    if (typeof body.staff_number !== "string" || !/^[A-Za-z0-9_-]{2,30}$/.test(body.staff_number)) return "Provide a valid staff ID";
    if (typeof body.gender !== "string" || !body.gender.trim() || body.gender.length > 20) return "Select a gender for the doctor record";
    if (typeof body.specialization !== "string" || !body.specialization.trim() || body.specialization.length > 100) return "Provide a specialization";
  } else if (creating && body.staff_number && !/^[A-Za-z0-9_-]{2,30}$/.test(body.staff_number)) {
    return "Staff ID may contain only letters, numbers, underscores, and hyphens";
  }
  return null;
}

async function createStaff(req, res, next) {
  const body = req.body || {};
  const validationError = validateStaffInput(body, true);
  if (validationError) return res.status(400).json({ message: validationError });
  const passwordHash = await bcrypt.hash(body.password, 12);
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const departmentId = body.department_id ? Number(body.department_id) : null;
    let doctorId = null;
    if (body.role === "doctor") {
      const [[department]] = departmentId
        ? await connection.query("SELECT department_name FROM departments WHERE id = ?", [departmentId])
        : [[null]];
      if (departmentId && !department) {
        await connection.rollback();
        return res.status(400).json({ message: "Selected department was not found" });
      }
      const [doctorResult] = await connection.query(
        `INSERT INTO doctors
          (doctor_number, full_name, gender, specialization, phone, email, department,
           consultation_fee, status, professional_registration_number, staff_joined_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'Active', ?, ?)`,
        [
          body.staff_number.trim(), body.full_name.trim(), body.gender.trim(),
          body.specialization.trim(), body.phone.trim() || null, body.email.trim().toLowerCase(),
          department?.department_name || null, body.professional_registration_number?.trim() || null,
          body.date_joined || new Date().toISOString().slice(0, 10),
        ]
      );
      doctorId = doctorResult.insertId;
    }
    const [userResult] = await connection.query(
      `INSERT INTO users
        (full_name, email, password, role, doctor_id, department_id, is_active, phone,
         staff_number, professional_registration_number, staff_joined_date)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      [
        body.full_name.trim(), body.email.trim().toLowerCase(), passwordHash, body.role,
        doctorId, departmentId, body.phone.trim() || null,
        body.staff_number?.trim() || null, body.professional_registration_number?.trim() || null,
        body.date_joined || new Date().toISOString().slice(0, 10),
      ]
    );
    if (body.role !== "doctor") {
      const staffNumber = body.staff_number?.trim() || `STF-${String(userResult.insertId).padStart(6, "0")}`;
      const [doctorIds] = await connection.query("SELECT id FROM doctors WHERE doctor_number = ? LIMIT 1", [staffNumber]);
      if (doctorIds.length) {
        await connection.rollback();
        return res.status(409).json({ message: "That staff ID is already used by a doctor" });
      }
      if (!body.staff_number) {
        await connection.query("UPDATE users SET staff_number = ? WHERE id = ?", [staffNumber, userResult.insertId]);
      }
    }
    await connection.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata, ip_address)
       VALUES (?, 'staff.created', 'user', ?, ?, ?)`,
      [req.user.id, String(userResult.insertId), JSON.stringify({ role: body.role }), req.ip]
    );
    await connection.commit();
    return res.status(201).json({ id: userResult.insertId, message: "Staff member created" });
  } catch (error) {
    await connection.rollback();
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Email or staff ID is already in use" });
    if (error.code === "ER_NO_REFERENCED_ROW_2") return res.status(400).json({ message: "Selected department was not found" });
    return handleStaffSchemaError(error, res, next);
  } finally {
    connection.release();
  }
}

async function updateStaff(req, res, next) {
  const match = /^(doctor|user):([1-9]\d*)$/.exec(req.params.staffKey);
  if (!match) return res.status(400).json({ message: "Invalid staff record ID" });
  const [, source, id] = match;
  const body = req.body || {};
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    if (source === "doctor") {
      const [doctors] = await connection.query(
        `SELECT d.id, d.doctor_number, d.status, u.id AS user_id
         FROM doctors d LEFT JOIN users u ON u.doctor_id = d.id AND u.role = 'doctor'
         WHERE d.id = ? FOR UPDATE`, [id]
      );
      if (!doctors.length) {
        await connection.rollback();
        return res.status(404).json({ message: "Staff profile not found" });
      }
      const doctor = doctors[0];
      if (doctor.user_id === req.user.id && body.is_active === false) {
        await connection.rollback();
        return res.status(400).json({ message: "You cannot deactivate your own account" });
      }
      const profileFields = [];
      const profileValues = [];
      const profileMap = {
        full_name: ["full_name", (v) => typeof v === "string" && v.trim().length > 0 && v.trim().length <= 100, (v) => v.trim()],
        email: ["email", validEmail, (v) => v.trim().toLowerCase()],
        phone: ["phone", (v) => typeof v === "string" && v.length <= 20, (v) => v.trim() || null],
        gender: ["gender", (v) => ["Male", "Female", "Other"].includes(v), (v) => v],
        specialization: ["specialization", (v) => typeof v === "string" && v.length <= 100, (v) => v.trim() || null],
        consultation_fee: ["consultation_fee", (v) => v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0, (v) => Number(v)],
        professional_registration_number: ["professional_registration_number", (v) => typeof v === "string" && v.length <= 100, (v) => v.trim() || null],
        date_joined: ["staff_joined_date", validDate, (v) => v],
      };
      for (const [key, [column, valid, convert]] of Object.entries(profileMap)) {
        if (body[key] === undefined) continue;
        if (!valid(body[key])) {
          await connection.rollback();
          return res.status(400).json({ message: `Invalid ${key.replaceAll("_", " ")}` });
        }
        profileFields.push(`${column} = ?`);
        profileValues.push(convert(body[key]));
      }
      if (body.department_id !== undefined) {
        if (body.department_id !== null && body.department_id !== "" && !/^[1-9]\d*$/.test(String(body.department_id))) {
          await connection.rollback();
          return res.status(400).json({ message: "Select a valid department" });
        }
        const departmentId = body.department_id ? Number(body.department_id) : null;
        const [[department]] = departmentId
          ? await connection.query("SELECT department_name FROM departments WHERE id = ?", [departmentId])
          : [[null]];
        if (departmentId && !department) {
          await connection.rollback();
          return res.status(400).json({ message: "Selected department was not found" });
        }
        profileFields.push("department = ?");
        profileValues.push(department?.department_name || null);
        if (doctor.user_id) {
          await connection.query("UPDATE users SET department_id = ? WHERE id = ?", [departmentId, doctor.user_id]);
        }
      }
      if (body.is_active !== undefined) {
        if (typeof body.is_active !== "boolean") {
          await connection.rollback();
          return res.status(400).json({ message: "Employment status must be active or inactive" });
        }
        profileFields.push("status = ?");
        profileValues.push(body.is_active ? "Active" : "Inactive");
        if (doctor.user_id) {
          await connection.query("UPDATE users SET is_active = ? WHERE id = ?", [body.is_active ? 1 : 0, doctor.user_id]);
          if (!body.is_active) {
            await connection.query("UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL", [doctor.user_id]);
          }
        }
      }
      if (!profileFields.length) {
        await connection.rollback();
        return res.status(400).json({ message: "Provide profile information or employment status to update" });
      }
      await connection.query(`UPDATE doctors SET ${profileFields.join(", ")} WHERE id = ?`, [...profileValues, id]);
      if (doctor.user_id) {
        const userFields = [];
        const userValues = [];
        if (body.full_name !== undefined) { userFields.push("full_name = ?"); userValues.push(body.full_name.trim()); }
        if (body.email !== undefined) { userFields.push("email = ?"); userValues.push(body.email.trim().toLowerCase()); }
        if (body.phone !== undefined) { userFields.push("phone = ?"); userValues.push(body.phone.trim() || null); }
        if (body.professional_registration_number !== undefined) {
          userFields.push("professional_registration_number = ?");
          userValues.push(body.professional_registration_number.trim() || null);
        }
        if (body.date_joined !== undefined) { userFields.push("staff_joined_date = ?"); userValues.push(body.date_joined); }
        if (userFields.length) await connection.query(`UPDATE users SET ${userFields.join(", ")} WHERE id = ?`, [...userValues, doctor.user_id]);
      }
      if (body.create_account !== undefined && body.create_account !== true) {
        await connection.rollback();
        return res.status(400).json({ message: "Invalid account creation request" });
      }
      if (body.create_account) {
        if (doctor.user_id) {
          await connection.rollback();
          return res.status(409).json({ message: "This doctor already has a staff login account" });
        }
        if (typeof body.password !== "string" || body.password.length < 12 || body.password.length > 128 || !validEmail(body.email)) {
          await connection.rollback();
          return res.status(400).json({ message: "Provide a valid email and password of at least 12 characters" });
        }
        const departmentId = body.department_id ? Number(body.department_id) : null;
        const passwordHash = await bcrypt.hash(body.password, 12);
        const doctorIsActive = body.is_active === undefined
          ? String(doctor.status).toLowerCase() === "active"
          : body.is_active;
        await connection.query(
          `INSERT INTO users
            (full_name, email, password, role, doctor_id, department_id, is_active, phone,
             staff_number, professional_registration_number, staff_joined_date)
           VALUES (?, ?, ?, 'doctor', ?, ?, ?, ?, ?, ?, ?)`,
          [
            body.full_name.trim(), body.email.trim().toLowerCase(), passwordHash, id, departmentId,
            doctorIsActive ? 1 : 0,
            body.phone?.trim() || null, doctor.doctor_number,
            body.professional_registration_number?.trim() || null, body.date_joined || null,
          ]
        );
      }
    } else {
      const [users] = await connection.query(
        "SELECT id, role, is_active, doctor_id FROM users WHERE id = ? FOR UPDATE", [id]
      );
      if (!users.length) {
        await connection.rollback();
        return res.status(404).json({ message: "Staff profile not found" });
      }
      const user = users[0];
      if (user.role === "doctor" && user.doctor_id !== null) {
        await connection.rollback();
        return res.status(404).json({ message: "Staff profile not found" });
      }
      if (Number(id) === req.user.id && body.role === "admin" && user.role !== "admin") {
        await connection.rollback();
        return res.status(403).json({ message: "You cannot assign administrator privileges to your own account" });
      }
      if (Number(id) === req.user.id && body.is_active === false) {
        await connection.rollback();
        return res.status(400).json({ message: "You cannot deactivate your own account" });
      }
      const allowedFields = {
        full_name: ["full_name", (v) => typeof v === "string" && v.trim().length > 0 && v.trim().length <= 100, (v) => v.trim()],
        email: ["email", validEmail, (v) => v.trim().toLowerCase()],
        phone: ["phone", (v) => typeof v === "string" && v.length <= 20, (v) => v.trim() || null],
        professional_registration_number: ["professional_registration_number", (v) => typeof v === "string" && v.length <= 100, (v) => v.trim() || null],
        date_joined: ["staff_joined_date", validDate, (v) => v],
      };
      const fields = [];
      const values = [];
      for (const [key, [column, valid, convert]] of Object.entries(allowedFields)) {
        if (body[key] === undefined) continue;
        if (!valid(body[key])) {
          await connection.rollback();
          return res.status(400).json({ message: `Invalid ${key.replaceAll("_", " ")}` });
        }
        fields.push(`${column} = ?`);
        values.push(convert(body[key]));
      }
      if (body.role !== undefined) {
        if (!ROLES.has(body.role) || (body.role === "doctor" && user.role !== "doctor")) {
          await connection.rollback();
          return res.status(400).json({ message: "Select a valid staff role" });
        }
        fields.push("role = ?");
        values.push(body.role);
      }
      if (body.department_id !== undefined) {
        if (body.department_id !== null && body.department_id !== "" && !/^[1-9]\d*$/.test(String(body.department_id))) {
          await connection.rollback();
          return res.status(400).json({ message: "Select a valid department" });
        }
        const departmentId = body.department_id ? Number(body.department_id) : null;
        const [[department]] = departmentId
          ? await connection.query("SELECT department_name FROM departments WHERE id = ?", [departmentId])
          : [[null]];
        if (departmentId && !department) {
          await connection.rollback();
          return res.status(400).json({ message: "Selected department was not found" });
        }
        fields.push("department_id = ?");
        values.push(departmentId);
      }
      if (body.is_active !== undefined) {
        if (typeof body.is_active !== "boolean") {
          await connection.rollback();
          return res.status(400).json({ message: "Employment status must be active or inactive" });
        }
        if (Number(id) === req.user.id && !body.is_active) {
          await connection.rollback();
          return res.status(400).json({ message: "You cannot deactivate your own account" });
        }
        fields.push("is_active = ?");
        values.push(body.is_active ? 1 : 0);
      }
      const nextRole = body.role || user.role;
      const activeAfter = body.is_active === undefined ? Boolean(user.is_active) : body.is_active;
      if (user.role === "admin" && user.is_active && (nextRole !== "admin" || !activeAfter)) {
        const [activeAdmins] = await connection.query("SELECT id FROM users WHERE role = 'admin' AND is_active = 1 FOR UPDATE");
        if (activeAdmins.length <= 1) {
          await connection.rollback();
          return res.status(409).json({ message: "At least one active administrator account must remain" });
        }
      }
      if (!fields.length) {
        await connection.rollback();
        return res.status(400).json({ message: "Provide staff details, role, or employment status to update" });
      }
      values.push(id);
      await connection.query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);
      if (body.role !== undefined || body.is_active === false) {
        await connection.query("UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL", [id]);
      }
    }
    await connection.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata, ip_address)
       VALUES (?, 'staff.updated', 'staff', ?, ?, ?)`,
      [req.user.id, `${source}:${id}`, JSON.stringify({ fields: Object.keys(body).filter((key) => key !== "password") }), req.ip]
    );
    await connection.commit();
    return res.json({ message: "Staff member updated" });
  } catch (error) {
    await connection.rollback();
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Email or staff ID is already in use" });
    if (error.code === "ER_NO_REFERENCED_ROW_2") return res.status(400).json({ message: "Selected department was not found" });
    return handleStaffSchemaError(error, res, next);
  } finally {
    connection.release();
  }
}

module.exports = { DIRECTORY_QUERY, listStaff, listDepartments, createStaff, updateStaff, validateStaffInput, handleStaffSchemaError };
