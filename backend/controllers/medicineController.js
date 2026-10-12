const Medicine = require("../models/medicineModel");

// Create a new medicine
const createMedicine = (req, res) => {
  const medicine = req.body;

  Medicine.create(medicine, (err, result) => {
    if (err) {
      console.error("Error creating medicine:", err);

      return res.status(500).json({
        message: "Failed to create medicine",
        error: err.message
      });
    }

    res.status(201).json({
      message: "Medicine created successfully",
      medicineId: result.insertId
    });
  });
};

// Get all medicines
const getAllMedicines = (req, res) => {
  Medicine.getAll((err, results) => {
    if (err) {
      console.error("Error fetching medicines:", err);

      return res.status(500).json({
        message: "Failed to fetch medicines",
        error: err.message
      });
    }

    res.status(200).json(results);
  });
};

// Get one medicine by ID
const getMedicineById = (req, res) => {
  const medicineId = req.params.id;

  Medicine.getById(medicineId, (err, result) => {
    if (err) {
      console.error("Error fetching medicine:", err);

      return res.status(500).json({
        message: "Failed to fetch medicine",
        error: err.message
      });
    }

    if (result.length === 0) {
      return res.status(404).json({
        message: "Medicine not found"
      });
    }

    res.status(200).json(result[0]);
  });
};

// Update medicine
const updateMedicine = (req, res) => {
  const medicineId = req.params.id;
  const medicine = req.body;

  Medicine.update(medicineId, medicine, (err, result) => {
    if (err) {
      console.error("Error updating medicine:", err);

      return res.status(500).json({
        message: "Failed to update medicine",
        error: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Medicine not found"
      });
    }

    res.status(200).json({
      message: "Medicine updated successfully"
    });
  });
};

// Delete medicine
const deleteMedicine = (req, res) => {
  const medicineId = req.params.id;

  Medicine.delete(medicineId, (err, result) => {
    if (err) {
      console.error("Error deleting medicine:", err);

      return res.status(500).json({
        message: "Failed to delete medicine",
        error: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Medicine not found"
      });
    }

    res.status(200).json({
      message: "Medicine deleted successfully"
    });
  });
};

module.exports = {
  createMedicine,
  getAllMedicines,
  getMedicineById,
  updateMedicine,
  deleteMedicine
};