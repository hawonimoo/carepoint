-- Migration 005: Enhanced Laboratory Management System
-- Adds reference ranges, units, specimen tracking, abnormality flags, and verification/release

-- 1. Extend laboratory_test_catalogue with clinical reference ranges & units
ALTER TABLE laboratory_test_catalogue
  ADD COLUMN unit VARCHAR(30) NULL,
  ADD COLUMN reference_range_min DECIMAL(10,2) NULL,
  ADD COLUMN reference_range_max DECIMAL(10,2) NULL,
  ADD COLUMN reference_range_text VARCHAR(150) NULL;

-- Seed standard clinical reference ranges for catalogue tests
UPDATE laboratory_test_catalogue SET unit = '10^3/uL', reference_range_text = '4.0 - 11.0 (WBC), 12.0 - 17.5 g/dL (Hb)' WHERE test_code = 'CBC';
UPDATE laboratory_test_catalogue SET unit = 'mg/dL', reference_range_min = 70.00, reference_range_max = 99.00, reference_range_text = '70.00 - 99.00 mg/dL' WHERE test_code = 'FBS';
UPDATE laboratory_test_catalogue SET unit = 'mg/dL', reference_range_min = 70.00, reference_range_max = 140.00, reference_range_text = '70.00 - 140.00 mg/dL' WHERE test_code = 'RBS';
UPDATE laboratory_test_catalogue SET unit = 'pH', reference_range_text = 'pH: 4.5 - 8.0, Specific Gravity: 1.005 - 1.030, Negative protein/glucose' WHERE test_code = 'URINALYSIS';
UPDATE laboratory_test_catalogue SET unit = 'mg/dL', reference_range_text = 'Total Cholesterol < 200 mg/dL, Triglycerides < 150 mg/dL, HDL > 40 mg/dL' WHERE test_code = 'LIPID';
UPDATE laboratory_test_catalogue SET unit = 'mg/dL', reference_range_text = 'Creatinine: 0.6 - 1.2 mg/dL, BUN: 7 - 20 mg/dL' WHERE test_code = 'RENAL';
UPDATE laboratory_test_catalogue SET unit = 'U/L', reference_range_text = 'ALT: 7 - 56 U/L, AST: 10 - 40 U/L, Bilirubin: 0.1 - 1.2 mg/dL' WHERE test_code = 'LIVER';
UPDATE laboratory_test_catalogue SET unit = '%', reference_range_min = 4.00, reference_range_max = 5.60, reference_range_text = '4.00 - 5.60 % (Normal), 5.7 - 6.4 % (Prediabetes)' WHERE test_code = 'HBA1C';

-- 2. Extend laboratory_orders for rejection tracking & status
ALTER TABLE laboratory_orders
  MODIFY COLUMN status ENUM('Pending','Accepted','Sample Collected','In Progress','Completed','Partially Completed','Cancelled','Rejected') NOT NULL DEFAULT 'Pending',
  ADD COLUMN rejected_by INT NULL,
  ADD COLUMN rejected_at DATETIME NULL,
  ADD COLUMN rejection_reason TEXT NULL,
  ADD CONSTRAINT fk_lab_orders_rejected_by FOREIGN KEY (rejected_by) REFERENCES users(id) ON DELETE SET NULL;

-- 3. Extend laboratory_order_items for specimen tracking, units, reference range, flags & verification
ALTER TABLE laboratory_order_items
  MODIFY COLUMN status ENUM('Pending','Accepted','Sample Collected','In Progress','Ready for Verification','Completed','Cancelled') NOT NULL DEFAULT 'Pending',
  ADD COLUMN specimen_barcode VARCHAR(50) NULL,
  ADD COLUMN sample_status ENUM('Pending', 'Collected', 'Received', 'Rejected', 'Recollection Required') NOT NULL DEFAULT 'Pending',
  ADD COLUMN collected_at DATETIME NULL,
  ADD COLUMN collected_by INT NULL,
  ADD COLUMN sample_rejection_reason TEXT NULL,
  ADD COLUMN unit VARCHAR(30) NULL,
  ADD COLUMN reference_range VARCHAR(150) NULL,
  ADD COLUMN abnormal_flag ENUM('Normal', 'Abnormal', 'Critical') NULL,
  ADD COLUMN assigned_to INT NULL,
  ADD COLUMN delay_reason TEXT NULL,
  ADD COLUMN is_draft TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN verified_by INT NULL,
  ADD COLUMN verified_at DATETIME NULL,
  ADD COLUMN released_at DATETIME NULL,
  ADD CONSTRAINT fk_lab_items_collected_by FOREIGN KEY (collected_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_lab_items_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_lab_items_verified_by FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL;
