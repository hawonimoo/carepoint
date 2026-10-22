CREATE TABLE consultations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  chief_complaint TEXT NOT NULL,
  symptoms TEXT NULL,
  examination_findings TEXT NULL,
  diagnosis TEXT NOT NULL,
  treatment_plan TEXT NOT NULL,
  follow_up_instructions TEXT NULL,
  consultation_date DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_consultations_doctor_date (doctor_id, consultation_date),
  INDEX idx_consultations_patient_date (patient_id, consultation_date),
  CONSTRAINT fk_consultations_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
  CONSTRAINT fk_consultations_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE RESTRICT
);