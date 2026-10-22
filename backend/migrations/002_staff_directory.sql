ALTER TABLE users
  MODIFY COLUMN role ENUM(
    'admin',
    'doctor',
    'receptionist',
    'pharmacist',
    'lab_technician',
    'laboratory_staff',
    'nurse',
    'accountant',
    'other_staff'
  ) NOT NULL,
  ADD COLUMN staff_number VARCHAR(30) NULL,
  ADD COLUMN phone VARCHAR(20) NULL,
  ADD COLUMN professional_registration_number VARCHAR(100) NULL,
  ADD COLUMN staff_joined_date DATE NULL,
  ADD UNIQUE INDEX uq_users_staff_number (staff_number);

UPDATE users
SET staff_number = CONCAT('STF-', LPAD(id, 6, '0')),
    staff_joined_date = COALESCE(staff_joined_date, DATE(created_at))
WHERE staff_number IS NULL OR staff_joined_date IS NULL;

ALTER TABLE doctors
  ADD COLUMN professional_registration_number VARCHAR(100) NULL,
  ADD COLUMN staff_joined_date DATE NULL;

UPDATE doctors
SET staff_joined_date = DATE(created_at)
WHERE staff_joined_date IS NULL;
