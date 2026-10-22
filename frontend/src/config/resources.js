// One entry per backend module. ResourcePage + ResourceForm read these
// definitions to build the table, the form and the API calls, so adding a
// column or a field is a one-line change here.
//
// Field types:
//   text | email | tel | number | date | time | textarea
//   select    -> fixed list (options)
//   suggest   -> free text with suggestions (options or optionsFrom)
//   lookup    -> pick a row from another module (lookup: "patients" ...)
//   readonly  -> calculated value, shown but not editable
//   hidden    -> sent to the API but not shown
//
// NOTE on status/method lists: only gender and the invoice payment status
// are enforced by your backend. The other lists are *suggestions* so the
// form never blocks a value your database accepts. If your database columns
// are ENUMs, edit the lists below to match them exactly.

import { formatDate, formatMoney, round2, toNumber } from "../utils";

const GENDERS = ["Male", "Female", "Other"];

// How a row from another module is shown inside a dropdown
export const lookupLabels = {
  patients: (r) => `${r.full_name} (${r.patient_number})`,
  doctors: (r) =>
    r.specialization ? `${r.full_name} — ${r.specialization}` : r.full_name,
  appointments: (r) =>
    `${r.appointment_number} · ${r.patient_name} · ${formatDate(r.appointment_date)}`,
  invoices: (r) =>
    `${r.invoice_number} · ${r.patient_name} · Balance ${formatMoney(r.balance)}`,
  departments: (r) => r.department_name,
};

const findRow = (lookups, endpoint, id) =>
  (lookups[endpoint] || []).find((r) => String(r.id) === String(id));

// If the chosen appointment belongs to a different patient, clear it
function clearMismatchedAppointment(values, lookups) {
  if (!values.appointment_id || !values.patient_id) return values;
  const appointment = findRow(lookups, "appointments", values.appointment_id);

  if (appointment && String(appointment.patient_id) !== String(values.patient_id)) {
    return { ...values, appointment_id: "" };
  }
  return values;
}

const appointmentForPatient = (row, { values }) =>
  !values.patient_id || String(row.patient_id) === String(values.patient_id);

export const resources = [
  // ───────────────────────── Patients ─────────────────────────
  {
    key: "patients",
    endpoint: "patients",
    title: "Patients",
    singular: "Patient",
    description: "Register and manage patient records.",
    columns: [
      { key: "patient_number", label: "Patient No." },
      { key: "full_name", label: "Full Name" },
      { key: "gender", label: "Gender" },
      { key: "date_of_birth", label: "Age", type: "age" },
      { key: "phone", label: "Phone" },
      { key: "address", label: "Address", truncate: true },
    ],
    fields: [
      { name: "patient_number", label: "Patient No.", type: "text", required: true, code: "PAT" },
      { name: "full_name", label: "Full Name", type: "text", required: true },
      { name: "gender", label: "Gender", type: "select", options: GENDERS, required: true },
      { name: "date_of_birth", label: "Date of Birth", type: "date", required: true },
      { name: "phone", label: "Phone", type: "tel", required: true },
      {
        name: "doctor_user_id",
        label: "Assign to Doctor",
        type: "lookup",
        lookup: "doctors",
        lookupEndpoint: "patients/doctors",
        createOnly: true,
        hint: () => "Optional. The selected doctor will be assigned to this patient and can access the patient in Consultations.",
      },
      { name: "email", label: "Email", type: "email" },
      { name: "address", label: "Address", type: "text", span: 2 },
      { name: "emergency_contact", label: "Emergency Contact", type: "text" },
      { name: "emergency_phone", label: "Emergency Phone", type: "tel" },
    ],
    deleteLabel: (r) => r.full_name,
  },

  // ───────────────────────── Departments ─────────────────────────
  {
    key: "departments",
    endpoint: "departments",
    title: "Departments",
    singular: "Department",
    description: "Organise the clinic into departments.",
    columns: [
      { key: "department_name", label: "Department" },
      { key: "description", label: "Description", truncate: true },
      { key: "status", label: "Status", type: "badge" },
    ],
    fields: [
      { name: "department_name", label: "Department Name", type: "text", required: true, span: 2 },
      { name: "description", label: "Description", type: "textarea", span: 2 },
      { name: "status", label: "Status", type: "suggest", options: ["Active", "Inactive"], default: "Active" },
    ],
    deleteLabel: (r) => r.department_name,
  },

  // ───────────────────────── Appointments ─────────────────────────
  {
    key: "appointments",
    endpoint: "appointments",
    title: "Appointments",
    singular: "Appointment",
    description: "Book and track patient visits.",
    columns: [
      { key: "appointment_number", label: "Appt. No." },
      { key: "patient_name", label: "Patient" },
      { key: "doctor_name", label: "Assigned Clinician" },
      { key: "appointment_date", label: "Date", type: "date" },
      { key: "appointment_time", label: "Time", type: "time" },
      { key: "reason", label: "Reason", truncate: true },
      { key: "status", label: "Status", type: "badge" },
    ],
    fields: [
      { name: "appointment_number", label: "Appointment No.", type: "text", required: true, code: "APT" },
      { name: "status", label: "Status", type: "suggest", options: ["Scheduled", "Completed", "Cancelled"], default: "Scheduled" },
      { name: "patient_id", label: "Patient", type: "lookup", lookup: "patients", required: true },
      { name: "doctor_id", label: "Assigned Clinician", type: "lookup", lookup: "doctors", required: true },
      { name: "appointment_date", label: "Date", type: "date", required: true, defaultToday: true },
      { name: "appointment_time", label: "Time", type: "time", required: true },
      { name: "reason", label: "Reason for Visit", type: "text", span: 2 },
      { name: "notes", label: "Notes", type: "textarea", span: 2 },
    ],
    deleteLabel: (r) => `${r.appointment_number} (${r.patient_name})`,
  },

  // ───────────────────────── Medical records ─────────────────────────
  {
    key: "records",
    endpoint: "medical-records",
    title: "Medical Records",
    singular: "Medical Record",
    description: "Diagnoses, treatments and prescriptions.",
    columns: [
      { key: "record_number", label: "Record No." },
      { key: "patient_name", label: "Patient" },
      { key: "doctor_name", label: "Prescribing Clinician" },
      { key: "diagnosis", label: "Diagnosis", truncate: true },
      { key: "follow_up_date", label: "Follow-up", type: "date" },
    ],
    fields: [
      { name: "record_number", label: "Record No.", type: "text", required: true, code: "REC" },
      { name: "patient_id", label: "Patient", type: "lookup", lookup: "patients", required: true },
      { name: "doctor_id", label: "Prescribing Clinician", type: "lookup", lookup: "doctors", required: true },
      {
        name: "appointment_id",
        label: "Appointment (optional)",
        type: "lookup",
        lookup: "appointments",
        filter: appointmentForPatient,
      },
      { name: "symptoms", label: "Symptoms", type: "textarea", span: 2 },
      { name: "diagnosis", label: "Diagnosis", type: "textarea", span: 2 },
      { name: "treatment", label: "Treatment", type: "textarea", span: 2 },
      { name: "prescription", label: "Prescription", type: "textarea", span: 2 },
      { name: "notes", label: "Notes", type: "textarea", span: 2 },
      { name: "follow_up_date", label: "Follow-up Date", type: "date" },
    ],
    derive: (values, { lookups }) => clearMismatchedAppointment(values, lookups),
    deleteLabel: (r) => `${r.record_number} (${r.patient_name})`,
  },

  // ───────────────────────── Medicines ─────────────────────────
  {
    key: "medicines",
    endpoint: "medicines",
    title: "Medicines",
    singular: "Medicine",
    description: "Pharmacy stock, prices and expiry dates.",
    columns: [
      { key: "medicine_number", label: "Medicine No." },
      { key: "medicine_name", label: "Name" },
      { key: "category", label: "Category" },
      { key: "quantity", label: "In Stock", type: "stock" },
      { key: "unit_price", label: "Unit Price", type: "money" },
      { key: "expiry_date", label: "Expiry", type: "expiry" },
      { key: "status", label: "Status", type: "badge" },
    ],
    fields: [
      { name: "medicine_number", label: "Medicine No.", type: "text", required: true, code: "MED" },
      { name: "medicine_name", label: "Medicine Name", type: "text", required: true },
      { name: "category", label: "Category", type: "text" },
      { name: "supplier", label: "Supplier", type: "text" },
      { name: "quantity", label: "Quantity in Stock", type: "number", min: 0, step: "1", required: true, default: 0 },
      { name: "unit_price", label: "Unit Price", type: "number", min: 0, step: "0.01", required: true },
      { name: "expiry_date", label: "Expiry Date", type: "date" },
      { name: "status", label: "Status", type: "suggest", options: ["Available", "Out of Stock", "Expired"], default: "Available" },
      { name: "description", label: "Description", type: "textarea", span: 2 },
    ],
    deleteLabel: (r) => r.medicine_name,
  },

  // ───────────────────────── Laboratory tests ─────────────────────────
  {
    key: "laboratory",
    endpoint: "laboratory-tests",
    title: "Laboratory Tests",
    singular: "Laboratory Test",
    description: "Order tests and record results.",
    columns: [
      { key: "test_number", label: "Test No." },
      { key: "patient_name", label: "Patient" },
      { key: "doctor_name", label: "Requested By" },
      { key: "test_name", label: "Test" },
      { key: "test_date", label: "Date", type: "date" },
      { key: "result", label: "Result", truncate: true },
      { key: "status", label: "Status", type: "badge" },
    ],
    fields: [
      { name: "test_number", label: "Test No.", type: "text", required: true, code: "LAB" },
      { name: "status", label: "Status", type: "suggest", options: ["Pending", "In Progress", "Completed"], default: "Pending" },
      { name: "patient_id", label: "Patient", type: "lookup", lookup: "patients", required: true },
      { name: "doctor_id", label: "Requested By", type: "lookup", lookup: "doctors", required: true },
      { name: "test_name", label: "Test Name", type: "text", required: true },
      { name: "test_type", label: "Test Type", type: "text" },
      { name: "sample_type", label: "Sample Type", type: "text" },
      { name: "test_date", label: "Test Date", type: "date", required: true, defaultToday: true },
      { name: "result", label: "Result", type: "textarea", span: 2 },
      { name: "normal_range", label: "Normal Range", type: "text", span: 2 },
      { name: "notes", label: "Notes", type: "textarea", span: 2 },
    ],
    deleteLabel: (r) => `${r.test_number} (${r.test_name})`,
  },

  // ───────────────────────── Invoices ─────────────────────────
  {
    key: "invoices",
    endpoint: "invoices",
    title: "Invoices",
    singular: "Invoice",
    description:
      "Bill patients. Paid amount, balance and status update automatically when payments are recorded.",
    columns: [
      { key: "invoice_number", label: "Invoice No." },
      { key: "patient_name", label: "Patient" },
      { key: "invoice_date", label: "Date", type: "date" },
      { key: "total_amount", label: "Total", type: "money" },
      { key: "paid_amount", label: "Paid", type: "money" },
      { key: "balance", label: "Balance", type: "money" },
      { key: "payment_status", label: "Status", type: "badge" },
    ],
    fields: [
      { name: "invoice_number", label: "Invoice No.", type: "text", required: true, code: "INV" },
      { name: "invoice_date", label: "Invoice Date", type: "date", required: true, defaultToday: true },
      { name: "patient_id", label: "Patient", type: "lookup", lookup: "patients", required: true },
      {
        name: "appointment_id",
        label: "Appointment (optional)",
        type: "lookup",
        lookup: "appointments",
        filter: appointmentForPatient,
      },
      { name: "subtotal", label: "Subtotal", type: "number", min: 0, step: "0.01", required: true, default: 0 },
      { name: "discount", label: "Discount (amount)", type: "number", min: 0, step: "0.01", default: 0 },
      { name: "tax", label: "Tax (amount)", type: "number", min: 0, step: "0.01", default: 0 },
      { name: "total_amount", label: "Total", type: "readonly", format: "money" },
      { name: "paid_amount", label: "Paid so far", type: "readonly", format: "money", default: 0 },
      { name: "balance", label: "Balance", type: "readonly", format: "money" },
      { name: "payment_status", label: "Status", type: "readonly", format: "badge" },
      { name: "notes", label: "Notes", type: "textarea", span: 2 },
    ],
    // total = subtotal - discount + tax. Paid comes from the payments module.
    derive: (values, { lookups }) => {
      const next = clearMismatchedAppointment(values, lookups);
      const total = Math.max(
        0,
        toNumber(next.subtotal) - toNumber(next.discount) + toNumber(next.tax)
      );
      const paid = toNumber(next.paid_amount);

      let status = "Unpaid";
      if (total > 0 && paid >= total) status = "Paid";
      else if (paid > 0) status = "Partially Paid";

      return {
        ...next,
        total_amount: String(round2(total)),
        paid_amount: String(round2(paid)),
        balance: String(round2(Math.max(0, total - paid))),
        payment_status: status,
      };
    },
    deleteLabel: (r) => `${r.invoice_number} (${r.patient_name})`,
  },

  // ───────────────────────── Payments ─────────────────────────
  {
    key: "payments",
    endpoint: "payments",
    title: "Payments",
    singular: "Payment",
    description:
      "Record money received. The linked invoice is recalculated automatically.",
    columns: [
      { key: "payment_date", label: "Date", type: "date" },
      { key: "patient_name", label: "Patient" },
      {
        key: "invoice_id",
        label: "Invoice",
        render: (row, { lookups }) =>
          findRow(lookups, "invoices", row.invoice_id)?.invoice_number ?? `#${row.invoice_id}`,
      },
      { key: "amount", label: "Amount", type: "money" },
      { key: "payment_method", label: "Method" },
      { key: "transaction_reference", label: "Reference" },
    ],
    fields: [
      {
        name: "invoice_id",
        label: "Invoice",
        type: "lookup",
        lookup: "invoices",
        required: true,
        span: 2,
        // only invoices that still owe money (plus the one being edited)
        filter: (row, { record }) =>
          toNumber(row.balance) > 0 ||
          (record && String(record.invoice_id) === String(row.id)),
        hint: (values, { lookups }) => {
          const invoice = findRow(lookups, "invoices", values.invoice_id);
          if (!invoice) return "Only invoices with an outstanding balance are listed.";
          return `Patient: ${invoice.patient_name} · Total ${formatMoney(invoice.total_amount)} · Paid ${formatMoney(invoice.paid_amount)} · Balance ${formatMoney(invoice.balance)}`;
        },
      },
      { name: "patient_id", label: "Patient", type: "hidden", numeric: true },
      { name: "payment_date", label: "Payment Date", type: "date", required: true, defaultToday: true },
      { name: "amount", label: "Amount", type: "number", min: 0.01, step: "0.01", required: true },
      {
        name: "payment_method",
        label: "Payment Method",
        type: "suggest",
        options: ["Cash", "Card", "Mobile Money", "Bank Transfer", "Insurance"],
        required: true,
        default: "Cash",
      },
      { name: "transaction_reference", label: "Transaction Reference", type: "text" },
      { name: "notes", label: "Notes", type: "textarea", span: 2 },
    ],
    // the payment belongs to whoever the invoice belongs to
    derive: (values, { lookups }) => {
      const invoice = findRow(lookups, "invoices", values.invoice_id);
      return { ...values, patient_id: invoice ? String(invoice.patient_id) : "" };
    },
    // stop overpayment before it reaches the invoice
    validate: (values, { lookups, record }) => {
      const amount = toNumber(values.amount);
      if (amount <= 0) return "Amount must be greater than zero.";

      const invoice = findRow(lookups, "invoices", values.invoice_id);
      if (!invoice) return null;

      const alreadyCounted =
        record && String(record.invoice_id) === String(values.invoice_id)
          ? toNumber(record.amount)
          : 0;
      const allowed = round2(toNumber(invoice.balance) + alreadyCounted);

      if (round2(amount) > allowed) {
        return `Amount (${formatMoney(amount)}) is more than the outstanding balance (${formatMoney(allowed)}).`;
      }
      return null;
    },
    deleteLabel: (r) => `payment of ${formatMoney(r.amount)} from ${r.patient_name}`,
  },
];

export const resourceByKey = Object.fromEntries(resources.map((r) => [r.key, r]));

// Every other module a resource needs data from (dropdowns, labels, hints)
export function lookupEndpointsFor(resource) {
  const endpoints = new Set();

  for (const field of resource.fields) {
    if (field.lookup) endpoints.add(field.lookupEndpoint || field.lookup);
    if (field.optionsFrom) endpoints.add(field.optionsFrom.endpoint);
  }
  for (const column of resource.columns) {
    if (column.key === "invoice_id") endpoints.add("invoices");
  }

  return [...endpoints];
}