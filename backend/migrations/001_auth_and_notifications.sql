ALTER TABLE users
  MODIFY COLUMN role ENUM(
    'admin',
    'doctor',
    'receptionist',
    'pharmacist',
    'lab_technician',
    'laboratory_staff',
    'nurse',
    'accountant'
  ) NOT NULL,
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN doctor_id INT NULL,
  ADD COLUMN department_id INT NULL,
  ADD UNIQUE INDEX uq_users_doctor_id (doctor_id),
  ADD INDEX idx_users_department_id (department_id),
  ADD CONSTRAINT fk_users_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctors(id),
  ADD CONSTRAINT fk_users_department
    FOREIGN KEY (department_id) REFERENCES departments(id);

CREATE TABLE user_sessions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id INT NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_sessions_user_expiry (user_id, expires_at),
  CONSTRAINT fk_user_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NULL,
  entity_id VARCHAR(80) NULL,
  metadata JSON NULL,
  ip_address VARCHAR(45) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_logs_created_at (created_at),
  INDEX idx_audit_logs_user_created (user_id, created_at),
  CONSTRAINT fk_audit_logs_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  recipient_user_id INT NULL,
  patient_id INT NULL,
  appointment_id INT NULL,
  event_type VARCHAR(40) NOT NULL,
  channel ENUM('in_app', 'sms') NOT NULL DEFAULT 'in_app',
  status ENUM('pending', 'sent', 'failed', 'unavailable') NOT NULL DEFAULT 'pending',
  read_at DATETIME NULL,
  message TEXT NOT NULL,
  error TEXT NULL,
  sent_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_recipient_created (recipient_user_id, created_at),
  INDEX idx_notifications_appointment (appointment_id),
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_notifications_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
  CONSTRAINT fk_notifications_appointment
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
);

ALTER TABLE appointments
  ADD INDEX idx_appointments_doctor_schedule
    (doctor_id, appointment_date, appointment_time, status);

CREATE TABLE patient_assignments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  user_id INT NOT NULL,
  assigned_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_patient_user_assignment (patient_id, user_id),
  INDEX idx_patient_assignments_user (user_id),
  CONSTRAINT fk_patient_assignments_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_assignments_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_assignments_assigned_by
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE nursing_observations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  nurse_user_id INT NOT NULL,
  observation TEXT NOT NULL,
  recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_nursing_observations_patient_time (patient_id, recorded_at),
  INDEX idx_nursing_observations_nurse_time (nurse_user_id, recorded_at),
  CONSTRAINT fk_nursing_observations_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT fk_nursing_observations_nurse
    FOREIGN KEY (nurse_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE prescriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  prescription_number VARCHAR(30) NOT NULL UNIQUE,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  medicine_id INT NOT NULL,
  dosage VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  dispensed_quantity INT NOT NULL DEFAULT 0,
  instructions TEXT NULL,
  status ENUM('Pending', 'Partially Dispensed', 'Dispensed', 'Cancelled') NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_prescriptions_doctor_created (doctor_id, created_at),
  INDEX idx_prescriptions_patient (patient_id),
  INDEX idx_prescriptions_medicine (medicine_id),
  CONSTRAINT fk_prescriptions_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id),
  CONSTRAINT fk_prescriptions_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctors(id),
  CONSTRAINT fk_prescriptions_medicine
    FOREIGN KEY (medicine_id) REFERENCES medicines(id)
);

CREATE TABLE prescription_dispensings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  prescription_id BIGINT UNSIGNED NOT NULL,
  medicine_id INT NOT NULL,
  dispensed_by INT NOT NULL,
  quantity INT NOT NULL,
  dispensed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_prescription_dispensings_prescription (prescription_id, dispensed_at),
  CONSTRAINT fk_prescription_dispensings_prescription
    FOREIGN KEY (prescription_id) REFERENCES prescriptions(id),
  CONSTRAINT fk_prescription_dispensings_medicine
    FOREIGN KEY (medicine_id) REFERENCES medicines(id),
  CONSTRAINT fk_prescription_dispensings_user
    FOREIGN KEY (dispensed_by) REFERENCES users(id)
);
