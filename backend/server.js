const path = require("path");
const express = require("express");
const cors = require("cors");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const db = require("./config/db");
const { requireAuth } = require("./middleware/auth");
const csrfProtection = require("./middleware/csrfProtection");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const staffRoutes = require("./routes/staffRoutes");
const patientRoutes = require("./routes/patientRoutes");
const consultationRoutes = require("./routes/consultation.routes");
const prescriptionRoutes = require("./routes/prescriptionRoutes");
const laboratoryOrderRoutes = require("./routes/laboratoryOrder.routes");
const medicineRoutes = require("./routes/medicineRoutes");

// Initialize Express
const app = express();

const configuredFrontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const localDevelopmentOrigin = /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):(?:517[3-9]|51[89]\d)$/;
app.use(cors({
    origin: (origin, callback) => {
        if (
            !origin ||
            origin === configuredFrontendOrigin ||
            (process.env.NODE_ENV !== "production" && localDevelopmentOrigin.test(origin))
        ) {
            return callback(null, true);
        }
        return callback(null, false);
    },
    credentials: true,
}));
app.use(express.json({ limit: "1mb" }));

// Test route
app.get("/", (req, res) => {
    res.send("Clinic Management System API is running");
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api", csrfProtection);
app.use("/api", requireAuth);
app.use("/api", (req, res, next) => {
    if (req.user.role === "other_staff") {
        return res.status(403).json({ message: "This staff account has no clinic API permissions assigned" });
    }
    return next();
});
app.use("/api/users", userRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/consultations", consultationRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/laboratory-orders", laboratoryOrderRoutes);
app.use("/api/medicines", medicineRoutes);

// Unknown API route -> JSON instead of an HTML error page
app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
});

// Last-resort error handler (e.g. malformed JSON body)
app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") {
        return res.status(400).json({ message: "Request body is not valid JSON" });
    }

    console.error("Unhandled request error:", err.code || err.type || "internal error");
    res.status(500).json({ message: "Something went wrong on the server" });
});

if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        console.error("JWT_SECRET must be configured with at least 32 characters before running the API.");
        process.exit(1);
    }

    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        db.getConnection((err, connection) => {
            if (err) {
                console.error("Database connection failed:", err.message);
                return;
            }
            console.log("MySQL Connected Successfully");
            connection.release();
        });
    });
}

module.exports = app;
