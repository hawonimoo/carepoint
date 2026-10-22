require("dotenv").config();

const bcrypt = require("bcryptjs");
const db = require("../config/db");

async function main() {
  const email = process.env.RESET_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.RESET_ADMIN_PASSWORD;
  if (process.env.CAREPOINT_RESET_ADMIN !== "YES") {
    throw new Error("Set CAREPOINT_RESET_ADMIN=YES to confirm an administrator password reset");
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("RESET_ADMIN_EMAIL must be a valid email address");
  }
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    throw new Error("RESET_ADMIN_PASSWORD must be 12-128 characters");
  }

  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const [users] = await connection.query(
      "SELECT id, role, is_active FROM users WHERE email = ? FOR UPDATE",
      [email]
    );
    if (!users.length || users[0].role !== "admin" || !users[0].is_active) {
      throw new Error("No active administrator account matched RESET_ADMIN_EMAIL");
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await connection.query("UPDATE users SET password = ? WHERE id = ?", [passwordHash, users[0].id]);
    await connection.query(
      "UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL",
      [users[0].id]
    );
    await connection.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
       VALUES (?, 'auth.admin_password_reset', 'user', ?, JSON_OBJECT('method', 'local_script'))`,
      [users[0].id, String(users[0].id)]
    );
    await connection.commit();
    console.log("Administrator password reset successfully. Remove the reset environment variables now.");
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

main()
  .catch((error) => {
    console.error("Administrator password reset failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());
