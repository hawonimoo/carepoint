const mysql = require("mysql2");
require("dotenv").config();

const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "clinic_user",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "clinic_management",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = db;