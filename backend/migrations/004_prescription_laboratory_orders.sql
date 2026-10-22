ALTER TABLE prescriptions
  MODIFY COLUMN status ENUM('Pending', 'Processing', 'Partially Dispensed', 'Dispensed', 'Cancelled')
    NOT NULL DEFAULT 'Pending',
  ADD COLUMN consultation_id BIGINT UNSIGNED NULL,
  ADD COLUMN created_by INT NULL,
  ADD COLUMN accepted_by INT NULL,
  ADD COLUMN accepted_at DATETIME NULL,
  ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD INDEX idx_prescriptions_status_created (status, created_at),
  ADD CONSTRAINT fk_prescriptions_consultation
    FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_prescriptions_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_prescriptions_accepted_by
    FOREIGN KEY (accepted_by) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE prescription_order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  prescription_id BIGINT UNSIGNED NOT NULL,
  medicine_id INT NOT NULL,
  medicine_name VARCHAR(150) NOT NULL,
  strength VARCHAR(100) NULL,
  dosage_form VARCHAR(80) NULL,
  dose VARCHAR(150) NOT NULL,
  route VARCHAR(80) NOT NULL,
  frequency VARCHAR(150) NOT NULL,
  duration VARCHAR(100) NOT NULL,
  quantity INT NOT NULL,
  dispensed_quantity INT NOT NULL DEFAULT 0,
  instructions TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_prescription_order_items_order (prescription_id),
  INDEX idx_prescription_order_items_medicine (medicine_id),
  CONSTRAINT fk_prescription_order_items_order
    FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE RESTRICT,
  CONSTRAINT fk_prescription_order_items_medicine
    FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE RESTRICT
);

INSERT INTO prescription_order_items
  (prescription_id, medicine_id, medicine_name, dose, route, frequency, duration,
   quantity, dispensed_quantity, instructions)
SELECT pr.id, pr.medicine_id, medicine.medicine_name, pr.dosage,
       'As prescribed', 'As prescribed', 'As prescribed',
       pr.quantity, pr.dispensed_quantity, pr.instructions
FROM prescriptions pr
JOIN medicines medicine ON medicine.id = pr.medicine_id;

CREATE TABLE prescription_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  prescription_id BIGINT UNSIGNED NOT NULL,
  changed_by INT NOT NULL,
  old_status VARCHAR(40) NULL,
  new_status VARCHAR(40) NOT NULL,
  details JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_prescription_events_order_date (prescription_id, created_at),
  CONSTRAINT fk_prescription_events_order
    FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE RESTRICT,
  CONSTRAINT fk_prescription_events_user
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE laboratory_test_catalogue (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  test_code VARCHAR(40) NOT NULL UNIQUE,
  test_name VARCHAR(150) NOT NULL,
  specimen_type VARCHAR(100) NULL,
  department_id INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_laboratory_test_catalogue_department_active (department_id, is_active),
  CONSTRAINT fk_laboratory_test_catalogue_department
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

INSERT INTO laboratory_test_catalogue (test_code, test_name, specimen_type) VALUES
  ('CBC', 'Complete Blood Count', 'Blood'),
  ('FBS', 'Fasting Blood Glucose', 'Blood'),
  ('RBS', 'Random Blood Glucose', 'Blood'),
  ('URINALYSIS', 'Urinalysis', 'Urine'),
  ('LIPID', 'Lipid Profile', 'Blood'),
  ('RENAL', 'Renal Function Tests', 'Blood'),
  ('LIVER', 'Liver Function Tests', 'Blood'),
  ('HBA1C', 'Glycated Haemoglobin (HbA1c)', 'Blood');

CREATE TABLE laboratory_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(30) NOT NULL UNIQUE,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  consultation_id BIGINT UNSIGNED NULL,
  department_id INT NULL,
  clinical_reason TEXT NOT NULL,
  priority ENUM('Routine', 'Urgent', 'STAT') NOT NULL DEFAULT 'Routine',
  status ENUM('Pending', 'Accepted', 'Sample Collected', 'In Progress', 'Completed', 'Partially Completed', 'Cancelled')
    NOT NULL DEFAULT 'Pending',
  created_by INT NOT NULL,
  accepted_by INT NULL,
  accepted_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_laboratory_orders_doctor_date (doctor_id, created_at),
  INDEX idx_laboratory_orders_patient_date (patient_id, created_at),
  INDEX idx_laboratory_orders_department_status (department_id, status, created_at),
  CONSTRAINT fk_laboratory_orders_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
  CONSTRAINT fk_laboratory_orders_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE RESTRICT,
  CONSTRAINT fk_laboratory_orders_consultation
    FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE SET NULL,
  CONSTRAINT fk_laboratory_orders_department
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  CONSTRAINT fk_laboratory_orders_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_laboratory_orders_accepted_by
    FOREIGN KEY (accepted_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE laboratory_order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  laboratory_order_id BIGINT UNSIGNED NOT NULL,
  catalogue_test_id INT UNSIGNED NOT NULL,
  test_name VARCHAR(150) NOT NULL,
  specimen_type VARCHAR(100) NULL,
  status ENUM('Pending', 'Accepted', 'Sample Collected', 'In Progress', 'Completed', 'Cancelled')
    NOT NULL DEFAULT 'Pending',
  result LONGTEXT NULL,
  notes TEXT NULL,
  updated_by INT NULL,
  result_entered_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_laboratory_order_items_order (laboratory_order_id),
  INDEX idx_laboratory_order_items_catalogue (catalogue_test_id),
  CONSTRAINT fk_laboratory_order_items_order
    FOREIGN KEY (laboratory_order_id) REFERENCES laboratory_orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_laboratory_order_items_catalogue
    FOREIGN KEY (catalogue_test_id) REFERENCES laboratory_test_catalogue(id) ON DELETE RESTRICT,
  CONSTRAINT fk_laboratory_order_items_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE laboratory_order_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  laboratory_order_id BIGINT UNSIGNED NOT NULL,
  laboratory_order_item_id BIGINT UNSIGNED NULL,
  changed_by INT NOT NULL,
  old_status VARCHAR(40) NULL,
  new_status VARCHAR(40) NOT NULL,
  details JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_laboratory_order_events_order_date (laboratory_order_id, created_at),
  CONSTRAINT fk_laboratory_order_events_order
    FOREIGN KEY (laboratory_order_id) REFERENCES laboratory_orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_laboratory_order_events_item
    FOREIGN KEY (laboratory_order_item_id) REFERENCES laboratory_order_items(id) ON DELETE SET NULL,
  CONSTRAINT fk_laboratory_order_events_user
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE RESTRICT
);
