export const ROLE_TITLES = {
  admin: "Administrator",
  receptionist: "Receptionist",
  doctor: "Doctor",
  nurse: "Nurse",
  laboratory_staff: "Laboratory Staff",
  pharmacist: "Pharmacist",
  accountant: "Accountant",
  other_staff: "Other Staff",
};

export const ROLE_PAGES = {
  admin: ["dashboard", "patients", "staff"],
  receptionist: ["dashboard", "patients"],
  doctor: ["dashboard", "patients", "consultations", "prescriptions", "laboratory-orders"],
  nurse: ["dashboard", "patients"],
  laboratory_staff: ["dashboard", "laboratory-orders"],
  pharmacist: ["dashboard", "prescriptions", "medicines"],
  accountant: ["dashboard", "patients"],
  other_staff: ["dashboard"],
};

export function canWrite(role, page, action) {
  if (role === "admin") return true;
  if (role === "receptionist") return page === "patients" && ["create", "edit"].includes(action);
  return false;
}
