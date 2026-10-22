const LaboratoryTest = require("../models/laboratoryTestModel");
const db = require("../config/db");

const TEST_STATUSES = new Set(["Pending", "Completed", "Cancelled"]);

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

// Create a laboratory test
const createLaboratoryTest = async (req, res, next) => {
  const test = { ...(req.body || {}) };
  const doctorId = req.user.role === "doctor" ? req.user.doctorId : test.doctor_id;
  if (
    typeof test.test_number !== "string" || !test.test_number.trim() || test.test_number.length > 30 ||
    !/^[1-9]\d*$/.test(String(test.patient_id || "")) ||
    !/^[1-9]\d*$/.test(String(doctorId || "")) ||
    typeof test.test_name !== "string" || !test.test_name.trim() || test.test_name.length > 100 ||
    !validDate(test.test_date) ||
    (test.status !== undefined && !TEST_STATUSES.has(test.status))
  ) {
    return res.status(400).json({ message: "Provide a valid test number, patient, doctor, test name, and date" });
  }
  for (const field of ["test_type", "sample_type", "result", "normal_range", "notes"]) {
    if (test[field] !== undefined && test[field] !== null &&
        (typeof test[field] !== "string" || test[field].length > 5000)) {
      return res.status(400).json({ message: `Invalid laboratory test ${field}` });
    }
  }
  test.doctor_id = doctorId;
  test.status = test.status || "Pending";

  if (req.user.role === "doctor") {
    if (!doctorId) {
      return res.status(403).json({ message: "This doctor account is not linked to a doctor record" });
    }
    try {
      const [assigned] = await db.promise().query(
        `SELECT p.id FROM patients p WHERE p.id = ? AND (
           EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = p.id AND a.doctor_id = ?)
           OR EXISTS (SELECT 1 FROM patient_assignments pa WHERE pa.patient_id = p.id AND pa.user_id = ?)
         ) LIMIT 1`,
        [test.patient_id, doctorId, req.user.id]
      );
      if (!assigned.length) {
        return res.status(403).json({ message: "You are not assigned to this patient" });
      }
    } catch (error) {
      return next(error);
    }
  }

  LaboratoryTest.create(test, (err, result) => {
    if (err) {
      console.error("Error creating laboratory test:", err.code || "database error");

      if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Laboratory test number already exists" });
      if (err.code === "ER_NO_REFERENCED_ROW_2") return res.status(400).json({ message: "Selected patient or doctor was not found" });
      return res.status(500).json({ message: "Failed to create laboratory test" });
    }

    res.status(201).json({
      message: "Laboratory test created successfully",
      testId: result.insertId
    });
  });
};

// Get all laboratory tests
const getAllLaboratoryTests = (req, res) => {
  LaboratoryTest.getAll(req.user, (err, results) => {
    if (err) {
      console.error("Error fetching laboratory tests:", err.code || "database error");

      return res.status(500).json({
        message: "Failed to fetch laboratory tests",
      });
    }

    res.status(200).json(results);
  });
};

// Get one laboratory test by ID
const getLaboratoryTestById = (req, res) => {
  const testId = req.params.id;
  if (!/^[1-9]\d*$/.test(testId)) return res.status(400).json({ message: "Invalid laboratory test ID" });

  LaboratoryTest.getById(testId, req.user, (err, result) => {
    if (err) {
      console.error("Error fetching laboratory test:", err.code || "database error");

      return res.status(500).json({
        message: "Failed to fetch laboratory test",
      });
    }

    if (result.length === 0) {
      return res.status(404).json({
        message: "Laboratory test not found"
      });
    }

    res.status(200).json(result[0]);
  });
};

// Update laboratory test
const updateLaboratoryTest = (req, res) => {
  const testId = req.params.id;
  const test = req.body || {};
  if (!/^[1-9]\d*$/.test(testId)) return res.status(400).json({ message: "Invalid laboratory test ID" });

  if (req.user.role === "laboratory_staff") {
    const allowed = new Set(["result", "status", "notes"]);
    if (Object.keys(test || {}).some((key) => !allowed.has(key))) {
      return res.status(400).json({ message: "Laboratory staff may update only result, status, and notes" });
    }
    if (!TEST_STATUSES.has(test.status)) {
      return res.status(400).json({ message: "Invalid laboratory test status" });
    }
    if (test.result !== undefined && test.result !== null && (typeof test.result !== "string" || test.result.length > 5000)) {
      return res.status(400).json({ message: "Invalid laboratory result" });
    }
    if (test.notes !== undefined && test.notes !== null && (typeof test.notes !== "string" || test.notes.length > 5000)) {
      return res.status(400).json({ message: "Invalid laboratory test notes" });
    }
  }
  const update = req.user.role === "laboratory_staff"
    ? LaboratoryTest.updateResult.bind(LaboratoryTest)
    : LaboratoryTest.update;
  const updateValues = req.user.role === "laboratory_staff"
    ? { result: test.result, status: test.status, notes: test.notes }
    : test;

  const callback = (err, result) => {
    if (err) {
      console.error("Error updating laboratory test:", err.code || "database error");

      return res.status(500).json({
        message: "Failed to update laboratory test",
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Laboratory test not found"
      });
    }

    res.status(200).json({
      message: "Laboratory test updated successfully"
    });
  };
  if (req.user.role === "laboratory_staff") {
    update(testId, updateValues, req.user, callback);
  } else {
    update(testId, updateValues, callback);
  }
};

// Delete laboratory test
const deleteLaboratoryTest = (req, res) => {
  const testId = req.params.id;
  if (!/^[1-9]\d*$/.test(testId)) return res.status(400).json({ message: "Invalid laboratory test ID" });

  LaboratoryTest.delete(testId, (err, result) => {
    if (err) {
      console.error("Error deleting laboratory test:", err.code || "database error");

      return res.status(500).json({
        message: "Failed to delete laboratory test",
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Laboratory test not found"
      });
    }

    res.status(200).json({
      message: "Laboratory test deleted successfully"
    });
  });
};

module.exports = {
  createLaboratoryTest,
  getAllLaboratoryTests,
  getLaboratoryTestById,
  updateLaboratoryTest,
  deleteLaboratoryTest
};