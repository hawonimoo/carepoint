require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("../config/db");

async function bootstrap() {
  if (process.env.CAREPOINT_CREATE_INITIAL_ADMIN !== "YES") {
    throw new Error("Set CAREPOINT_CREATE_INITIAL_ADMIN=YES to confirm this one-time operation");
  }
  const fullName = process.env.INITIAL_ADMIN_NAME?.trim();
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!fullName || fullName.length > 100 || !email || email.length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof password !== "string" || password.length < 12 || password.length > 128) {
    throw new Error("Provide INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL, and an INITIAL_ADMIN_PASSWORD of 12-128 characters");
  }
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      "SELECT id FROM users WHERE role = 'admin' AND is_active = 1 LIMIT 1 FOR UPDATE"
    );
    if (rows.length) {
      throw new Error("An active administrator already exists; initial bootstrap is disabled");
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await connection.query(
      "INSERT INTO users (full_name, email, password, role, is_active) VALUES (?, ?, ?, 'admin', 1)",
      [fullName, email, passwordHash]
    );
    await connection.query(
      "UPDATE users SET staff_number = ? WHERE id = ? AND staff_number IS NULL",
      [`STF-${String(result.insertId).padStart(6, "0")}`, result.insertId]
    );
    await connection.commit();
    console.log("Initial administrator created. Remove the bootstrap variables from the environment.");
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

bootstrap()
  .catch((error) => {
    console.error("Administrator bootstrap failed:", error.code || error.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());
