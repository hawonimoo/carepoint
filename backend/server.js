const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./config/db");

// Import routes
const patientRoutes = require("./routes/patientRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const departmentRoutes = require("./routes/departmentRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const medicalRecordRoutes = require("./routes/medicalRecordRoutes");
const medicineRoutes = require("./routes/medicineRoutes");
const laboratoryTestRoutes = require("./routes/laboratoryTestRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

// Initialize Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get("/", (req, res) => {
    res.send("Clinic Management System API is running");
});

// API routes
app.use("/api/patients", patientRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/medical-records", medicalRecordRoutes);
app.use("/api/medicines", medicineRoutes);
app.use("/api/laboratory-tests", laboratoryTestRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/payments", paymentRoutes);

// Unknown API route -> JSON instead of an HTML error page
app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
});

// Last-resort error handler (e.g. malformed JSON body)
app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") {
        return res.status(400).json({ message: "Request body is not valid JSON" });
    }

    console.error("Unhandled error:", err);
    res.status(500).json({ message: "Something went wrong on the server" });
});

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);

    // Check the database once at startup so problems show up immediately
    db.getConnection((err, connection) => {
        if (err) {
            console.error("Database connection failed:", err.message);
            return;
        }

        console.log("MySQL Connected Successfully");
        connection.release();
    });
});