const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = "unit-test-secret-that-is-at-least-32-characters-long";

const {
  isSecuritySchemaUnavailable,
  normalizeRole,
  requireAuth,
  requireRoles,
} = require("../middleware/auth");
const { login } = require("../controllers/authController");
const csrfProtection = require("../middleware/csrfProtection");
const loginRateLimit = require("../middleware/loginRateLimit");
const { validateAppointment } = require("../controllers/appointmentController");
const db = require("../config/db");
const Patient = require("../models/patientModel");
const LaboratoryTest = require("../models/laboratoryTestModel");
const { normalizeInvoice } = require("../controllers/invoiceController");
const { validatePayment } = require("../controllers/paymentController");
const {
  DIRECTORY_QUERY,
  listDepartments,
  validateStaffInput,
} = require("../controllers/staffController");
const {
  normalizeConsultationDate,
  validateConsultationInput,
} = require("../controllers/consultation.controller");
const Consultation = require("../models/consultation.model");
const { validateItems } = require("../controllers/prescriptionOrder.controller");
const { validateCreateInput: validateLaboratoryOrderInput } = require("../controllers/laboratoryOrder.controller");
const PrescriptionOrder = require("../models/prescriptionOrder.model");
const LaboratoryOrder = require("../models/laboratoryOrder.model");
const app = require("../server");

function responseDouble() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    set(name, value) { this.headers[name] = value; return this; },
  };
}

test("legacy lab role maps to the canonical permission role", () => {
  assert.equal(normalizeRole("lab_technician"), "laboratory_staff");
});

test("missing authentication tables or columns are identified as a pending migration", () => {
  assert.equal(isSecuritySchemaUnavailable({ code: "ER_NO_SUCH_TABLE" }), true);
  assert.equal(isSecuritySchemaUnavailable({ code: "ER_BAD_FIELD_ERROR" }), true);
  assert.equal(isSecuritySchemaUnavailable({ code: "ER_ACCESS_DENIED_ERROR" }), false);
});

test("role middleware denies unauthorized staff with HTTP 403", () => {
  const req = { user: { role: "receptionist" } };
  const res = responseDouble();
  let continued = false;
  requireRoles("admin")(req, res, () => { continued = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(continued, false);
});

test("role middleware returns HTTP 401 when there is no user", () => {
  const res = responseDouble();
  requireRoles("admin")({}, res, () => assert.fail("must not continue"));
  assert.equal(res.statusCode, 401);
});

test("staff directory access is restricted to administrators", () => {
  const res = responseDouble();
  let continued = false;
  requireRoles("admin")({ user: { role: "other_staff" } }, res, () => { continued = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(continued, false);
});

test("staff creation validates accounts and the unified directory merges linked doctors", () => {
  const validStaff = {
    full_name: "Fictional Staff Member",
    email: "fictional.staff@example.test",
    phone: "",
    role: "other_staff",
    department_id: null,
    password: "fictional-development-password",
  };
  assert.equal(validateStaffInput(validStaff, true), null);
  assert.equal(validateStaffInput({ ...validStaff, role: "receptionist", department_id: null }, true), null);
  assert.equal(validateStaffInput({ ...validStaff, date_joined: "2024-02-29" }, true), null);
  assert.match(validateStaffInput({ ...validStaff, date_joined: "2025-02-29" }, true), /valid date joined/i);
  assert.match(validateStaffInput({ ...validStaff, role: "super_admin" }, true), /valid staff role/i);
  assert.match(validateStaffInput({ ...validStaff, password: "short" }, true), /12 and 128/i);
  assert.match(DIRECTORY_QUERY, /LEFT JOIN users u ON u\.doctor_id = d\.id AND u\.role = 'doctor'/);
  assert.match(DIRECTORY_QUERY, /WHERE u\.role <> 'doctor' OR u\.doctor_id IS NULL/);
  assert.match(DIRECTORY_QUERY, /DATE_FORMAT\(COALESCE/);
});

test("login finds staff accounts regardless of email casing or surrounding spaces", async () => {
  const originalPromise = db.promise;
  const capturedQueries = [];
  db.promise = () => ({
    query: async (sql, values) => {
      capturedQueries.push({ sql, values });
      return [[], []];
    },
  });

  try {
    const res = responseDouble();
    await login({
      body: { email: "  DOCTOR@EXAMPLE.TEST  ", password: "valid-test-password" },
      ip: "127.0.0.1",
    }, res, (error) => {
      if (error) throw error;
    });

    assert.equal(res.statusCode, 401);
    assert.match(capturedQueries[0].sql, /LOWER\(TRIM\(email\)\) = \?/);
    assert.deepEqual(capturedQueries[0].values, ["doctor@example.test"]);
    assert.equal(capturedQueries[1].values[1], "auth.login_failed");
  } finally {
    db.promise = originalPromise;
  }
});

test("department dropdown includes legacy departments without a status and excludes inactive rows", async () => {
  const originalPromise = db.promise;
  let captured;
  db.promise = () => ({
    query: async (sql) => {
      captured = sql;
      return [[{ id: 3, department_name: "Outpatient" }], []];
    },
  });
  try {
    const res = responseDouble();
    await listDepartments({}, res, (error) => {
      if (error) throw error;
    });
    assert.match(captured, /COALESCE\(status, 'active'\)/);
    assert.deepEqual(res.body, [{ id: 3, department_name: "Outpatient" }]);
  } finally {
    db.promise = originalPromise;
  }
});

test("receptionists without a department only see patients assigned to their account", async () => {
  const originalQuery = db.query;
  let captured;
  db.query = (sql, values, callback) => {
    captured = { sql, values };
    callback(null, []);
  };
  try {
    await new Promise((resolve, reject) => {
      Patient.getAll({ id: 18, role: "receptionist", departmentId: null }, (error) => error ? reject(error) : resolve());
    });
    assert.match(captured.sql, /patient_assignments pa WHERE pa\.patient_id = patients\.id AND pa\.user_id = \?/);
    assert.deepEqual(captured.values, [18]);
    await new Promise((resolve, reject) => {
      Patient.getById(3, { id: 18, role: "receptionist", departmentId: null }, (error) => error ? reject(error) : resolve());
    });
    assert.match(captured.sql, /patient_assignments pa WHERE pa\.patient_id = patients\.id AND pa\.user_id = \?/);
    assert.deepEqual(captured.values, [3, 18]);
  } finally {
    db.query = originalQuery;
  }
});

test("patient registration doctor lookup returns active linked doctor accounts only", async () => {
  const originalQuery = db.query;
  let captured;
  db.query = (sql, callback) => {
    captured = sql;
    callback(null, [{ id: 23, full_name: "Fictional Doctor" }]);
  };
  try {
    await new Promise((resolve, reject) => {
      Patient.getAssignableDoctors((error, rows) => {
        if (error) reject(error);
        else {
          assert.deepEqual(rows, [{ id: 23, full_name: "Fictional Doctor" }]);
          resolve();
        }
      });
    });
    assert.match(captured, /u\.role = 'doctor' AND u\.is_active = 1/);
    assert.match(captured, /JOIN doctors d ON d\.id = u\.doctor_id/);
  } finally {
    db.query = originalQuery;
  }
});

test("patient creation assigns the patient to the selected doctor in the same transaction", async () => {
  const originalPromise = db.promise;
  const statements = [];
  const connection = {
    beginTransaction: async () => {},
    query: async (sql, values = []) => {
      statements.push({ sql, values });
      if (/SELECT u\.id/.test(sql)) return [[{ id: 23 }], []];
      if (/INSERT INTO patients/.test(sql)) return [{ insertId: 501 }, []];
      return [{ affectedRows: 1 }, []];
    },
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
  };
  db.promise = () => ({ getConnection: async () => connection });
  try {
    const patient = {
      patient_number: "PAT-TEST-501",
      full_name: "Fictional Patient",
      gender: "Other",
      date_of_birth: "1990-01-01",
      phone: "0700000000",
      doctor_user_id: "23",
    };
    await new Promise((resolve, reject) => {
      Patient.create(patient, { id: 7, role: "admin" }, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    const assignment = statements.find(({ sql }) => /INSERT INTO patient_assignments/.test(sql));
    assert.deepEqual(assignment.values, [501, "23", 7]);
  } finally {
    db.promise = originalPromise;
  }
});

test("protected requests without a session return HTTP 401", async () => {
  const res = responseDouble();
  await requireAuth({ get: () => undefined }, res, (error) => {
    if (error) throw error;
  });
  assert.equal(res.statusCode, 401);
});

test("cookie writes without the request marker return HTTP 403", () => {
  const res = responseDouble();
  csrfProtection({ method: "POST", headers: { cookie: "carepoint_session=opaque" }, get: () => undefined }, res, () => {
    assert.fail("must reject a cookie-authenticated cross-site write");
  });
  assert.equal(res.statusCode, 403);
});

test("cookie writes with the request marker are accepted", () => {
  const res = responseDouble();
  let continued = false;
  csrfProtection({
    method: "POST",
    headers: { cookie: "carepoint_session=opaque" },
    get: (name) => name === "x-carepoint-request" ? "1" : undefined,
  }, res, () => { continued = true; });
  assert.equal(continued, true);
});

test("login rate limiter returns HTTP 429 after its configured attempt limit", () => {
  const req = { ip: `test-${Date.now()}-${Math.random()}`, body: {} };
  for (let attempt = 0; attempt < 8; attempt += 1) {
    loginRateLimit(req, responseDouble(), () => {});
  }
  const res = responseDouble();
  loginRateLimit(req, res, () => assert.fail("rate-limited request must not continue"));
  assert.equal(res.statusCode, 429);
  assert.ok(Number(res.headers["Retry-After"]) > 0);
});

test("appointment validation rejects invalid dates, times, and statuses", () => {
  const valid = {
    appointment_number: "APT-TEST-001",
    patient_id: 1,
    doctor_id: 1,
    appointment_date: "2099-12-31",
    appointment_time: "10:30",
    status: "Scheduled",
  };
  assert.equal(validateAppointment(valid), null);
  assert.ok(validateAppointment({ ...valid, appointment_date: "2099-02-31" }));
  assert.ok(validateAppointment({ ...valid, appointment_time: "25:90" }));
  assert.ok(validateAppointment({ ...valid, status: "Unknown" }));
});

test("appointment updates may keep a historical date without allowing invalid dates", () => {
  const historical = {
    appointment_number: "APT-TEST-002",
    patient_id: 1,
    doctor_id: 1,
    appointment_date: "2000-01-01",
    appointment_time: "10:30",
    status: "Completed",
  };
  assert.ok(validateAppointment(historical));
  assert.equal(validateAppointment(historical, { allowPast: true }), null);
});

test("laboratory staff test queries are restricted to their department", async () => {
  const originalQuery = db.query;
  let captured;
  db.query = (sql, values, callback) => {
    captured = { sql, values };
    callback(null, []);
  };
  try {
    await new Promise((resolve, reject) => {
      LaboratoryTest.getAll({ role: "laboratory_staff", departmentId: 7 }, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    assert.match(captured.sql, /dep\.id = \?/);
    assert.deepEqual(captured.values, [7]);

    await new Promise((resolve, reject) => {
      LaboratoryTest.updateResult(4, { status: "Completed" }, { departmentId: 7 }, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    assert.match(captured.sql, /AND dep\.id = \?/);
    assert.equal(captured.values.at(-1), 7);
  } finally {
    db.query = originalQuery;
  }
});

test("invoice and payment input validation derives protected financial fields", () => {
  const invoice = normalizeInvoice({
    invoice_number: "INV-TEST-001",
    patient_id: 3,
    appointment_id: "",
    invoice_date: "2099-01-01",
    subtotal: "100.00",
    discount: "10.00",
    tax: "5.00",
    paid_amount: "999",
    balance: "0",
    payment_status: "Paid",
  });
  assert.equal(invoice.total_amount, 95);
  assert.equal(invoice.paid_amount, 0);
  assert.equal(invoice.balance, 95);
  assert.equal(invoice.payment_status, "Unpaid");

  const payment = {
    invoice_id: 4,
    patient_id: 3,
    payment_date: "2099-01-01",
    amount: "25.50",
    payment_method: "Mobile Money",
  };
  assert.equal(validatePayment(payment), null);
  assert.ok(validatePayment({ ...payment, amount: "0" }));
  assert.ok(validatePayment({ ...payment, payment_method: "Unknown" }));
});

test("consultation validation requires core clinical fields and a real date-time", () => {
  const valid = {
    patient_id: "4",
    chief_complaint: "Persistent cough",
    symptoms: "Dry cough",
    examination_findings: "",
    diagnosis: "Upper respiratory infection",
    treatment_plan: "Rest and fluids",
    follow_up_instructions: "",
    consultation_date: "2026-10-21T14:30",
    doctor_id: 999,
  };
  const result = validateConsultationInput(valid);
  assert.equal(result.error, undefined);
  assert.equal(result.consultation.patient_id, 4);
  assert.equal(result.consultation.consultation_date, "2026-10-21 14:30:00");
  assert.equal(Object.hasOwn(result.consultation, "doctor_id"), false);
  assert.match(validateConsultationInput({ ...valid, patient_id: "1 OR 1=1" }).error, /valid patient/i);
  assert.match(validateConsultationInput({ ...valid, chief_complaint: " " }).error, /chief complaint is required/i);
  assert.match(validateConsultationInput({ ...valid, diagnosis: "" }).error, /diagnosis is required/i);
  assert.match(validateConsultationInput({ ...valid, treatment_plan: "" }).error, /treatment plan is required/i);
  assert.match(validateConsultationInput({ ...valid, consultation_date: "2026-02-30T14:30" }).error, /valid consultation date/i);
  assert.equal(normalizeConsultationDate("2026-10-21T14:30:12"), "2026-10-21 14:30:12");
});

test("prescription orders validate multiple complete medicine lines", () => {
  const lines = [{
    medicine_id: "4",
    strength: "500 mg",
    dosage_form: "Tablet",
    dose: "1 tablet",
    route: "Oral",
    frequency: "Twice daily",
    duration: "5 days",
    quantity: "10",
    instructions: "",
  }];
  const result = validateItems(lines);
  assert.equal(result.error, undefined);
  assert.equal(result.items[0].medicine_id, 4);
  assert.equal(result.items[0].quantity, 10);
  assert.equal(validateItems([]).error, "Add between 1 and 20 medicines to the prescription");
  assert.match(validateItems([{ ...lines[0], route: "" }]).error, /route is required/i);
  assert.match(validateItems([lines[0], lines[0]]).error, /only once/i);
  assert.match(validateItems([{ ...lines[0], quantity: "1.5" }]).error, /whole-number quantity/i);
});

test("laboratory orders validate assigned patient IDs, test catalogue IDs, priority, and reason", () => {
  const request = {
    patient_id: "17",
    consultation_id: "23",
    test_ids: ["2", "5"],
    clinical_reason: "Investigate persistent fatigue",
    priority: "Urgent",
  };
  const result = validateLaboratoryOrderInput(request);
  assert.equal(result.error, undefined);
  assert.equal(result.patientId, 17);
  assert.deepEqual(result.testIds, [2, 5]);
  assert.equal(result.priority, "Urgent");
  assert.match(validateLaboratoryOrderInput({ ...request, test_ids: ["2", "2"] }).error, /only once/i);
  assert.match(validateLaboratoryOrderInput({ ...request, priority: "Immediate" }).error, /priority/i);
  assert.match(validateLaboratoryOrderInput({ ...request, clinical_reason: " " }).error, /clinical reason/i);
  assert.match(validateLaboratoryOrderInput({ ...request, patient_id: "1 OR 1=1" }).error, /valid patient/i);
});

test("prescription order creation saves the prescription and all medicine lines in one transaction", async () => {
  const originalPromise = db.promise;
  const statements = [];
  let committed = false;
  const connection = {
    beginTransaction: async () => {},
    query: async (sql, values = []) => {
      statements.push({ sql, values });
      if (/SELECT p\.id FROM patients/.test(sql)) return [[{ id: 17 }], []];
      if (/SELECT id FROM consultations/.test(sql)) return [[{ id: 23 }], []];
      if (/SELECT id, medicine_name/.test(sql)) return [[
        { id: 4, medicine_name: "Test medicine", category: "Tablet", status: "Available" },
      ], []];
      if (/INSERT INTO prescriptions/.test(sql)) return [{ insertId: 55 }, []];
      return [{ affectedRows: 1 }, []];
    },
    commit: async () => { committed = true; },
    rollback: async () => { assert.fail("valid prescription should commit"); },
    release: () => {},
  };
  db.promise = () => ({ getConnection: async () => connection });
  try {
    const id = await PrescriptionOrder.create({
      orderNumber: "RX-TEST-001",
      patientId: 17,
      doctorId: 8,
      consultationId: 23,
      items: [{
        medicine_id: 4, strength: "250 mg", dosage_form: "Tablet",
        dose: "1 tablet", route: "Oral", frequency: "Daily",
        duration: "3 days", quantity: 3, instructions: null,
      }],
      userId: 31,
    });
    assert.equal(id, 55);
    assert.equal(committed, true);
    assert.deepEqual(statements.find(({ sql }) => /SELECT p\.id FROM patients/.test(sql)).values, [17, 8, 31]);
    assert.ok(statements.some(({ sql }) => /INSERT INTO prescription_order_items/.test(sql)));
    assert.ok(statements.some(({ sql }) => /INSERT INTO prescription_events/.test(sql)));
  } finally {
    db.promise = originalPromise;
  }
});

test("laboratory order creation stores each selected catalogue test transactionally", async () => {
  const originalPromise = db.promise;
  const statements = [];
  let committed = false;
  const connection = {
    beginTransaction: async () => {},
    query: async (sql, values = []) => {
      statements.push({ sql, values });
      if (/SELECT p\.id FROM patients/.test(sql)) return [[{ id: 17 }], []];
      if (/SELECT id FROM consultations/.test(sql)) return [[{ id: 23 }], []];
      if (/SELECT id, test_name/.test(sql)) return [[
        { id: 2, test_name: "Complete Blood Count", specimen_type: "Blood", department_id: null },
        { id: 5, test_name: "Fasting Blood Glucose", specimen_type: "Blood", department_id: null },
      ], []];
      if (/INSERT INTO laboratory_orders/.test(sql)) return [{ insertId: 89 }, []];
      return [{ affectedRows: 1 }, []];
    },
    commit: async () => { committed = true; },
    rollback: async () => { assert.fail("valid laboratory order should commit"); },
    release: () => {},
  };
  db.promise = () => ({ getConnection: async () => connection });
  try {
    const id = await LaboratoryOrder.create({
      orderNumber: "LAB-TEST-001",
      patientId: 17,
      doctorId: 8,
      consultationId: 23,
      reason: "Investigate persistent fatigue",
      priority: "Urgent",
      testIds: [2, 5],
      userId: 31,
    });
    assert.equal(id, 89);
    assert.equal(committed, true);
    assert.equal(statements.filter(({ sql }) => /INSERT INTO laboratory_order_items/.test(sql)).length, 2);
    assert.ok(statements.some(({ sql }) => /INSERT INTO laboratory_order_events/.test(sql)));
  } finally {
    db.promise = originalPromise;
  }
});

test("pharmacy acceptance and dispensing record stock and order-status changes", async () => {
  const originalPromise = db.promise;
  let state = "Pending";
  let dispensed = 0;
  const statements = [];
  let commits = 0;
  const connection = {
    beginTransaction: async () => {},
    query: async (sql, values = []) => {
      statements.push({ sql, values });
      if (/SELECT id, status FROM prescriptions/.test(sql)) return [[{ id: 55, status: state }], []];
      if (/SELECT id, medicine_id, quantity, dispensed_quantity/.test(sql)) {
        return [[{ id: 77, medicine_id: 4, quantity: 4, dispensed_quantity: dispensed }], []];
      }
      if (/SELECT quantity, status, expiry_date/.test(sql)) return [[{ quantity: 8, status: "Available", expiry_date: null }], []];
      if (/SELECT quantity, dispensed_quantity FROM prescription_order_items/.test(sql)) {
        return [[{ quantity: 4, dispensed_quantity: dispensed }], []];
      }
      if (/UPDATE prescriptions SET status = 'Processing'/.test(sql)) state = "Processing";
      if (/UPDATE prescriptions SET dispensed_quantity/.test(sql)) {
        dispensed = Number(values[0]);
        state = values[1];
      }
      if (/UPDATE prescription_order_items SET dispensed_quantity/.test(sql)) dispensed += Number(values[0]);
      return [{ affectedRows: 1 }, []];
    },
    commit: async () => { commits += 1; },
    rollback: async () => { assert.fail("valid pharmacy workflow should commit"); },
    release: () => {},
  };
  db.promise = () => ({ getConnection: async () => connection });
  try {
    assert.deepEqual(await PrescriptionOrder.accept(55, 42), { status: "Processing" });
    assert.deepEqual(await PrescriptionOrder.dispense(55, 42, [{ item_id: 77, quantity: 2 }]), { status: "Partially Dispensed" });
    assert.equal(commits, 2);
    assert.equal(state, "Partially Dispensed");
    assert.ok(statements.some(({ sql }) => /INSERT INTO prescription_dispensings/.test(sql)));
    assert.ok(statements.some(({ sql }) => /UPDATE medicines SET quantity = quantity -/.test(sql)));
    assert.ok(statements.some(({ sql }) => /INSERT INTO prescription_events/.test(sql)));
  } finally {
    db.promise = originalPromise;
  }
});

test("laboratory staff can finalize a result only through an authorized status transition", async () => {
  const originalPromise = db.promise;
  const statements = [];
  let committed = false;
  const connection = {
    beginTransaction: async () => {},
    query: async (sql, values = []) => {
      statements.push({ sql, values });
      if (/SELECT lo\.id, lo\.status AS order_status/.test(sql)) {
        return [[{
          id: 89, order_status: "In Progress", department_id: 7,
          item_id: 91, item_status: "In Progress", old_result: null,
        }], []];
      }
      if (/SELECT status FROM laboratory_order_items/.test(sql)) return [[{ status: "Completed" }], []];
      return [{ affectedRows: 1 }, []];
    },
    commit: async () => { committed = true; },
    rollback: async () => { assert.fail("valid result finalization should commit"); },
    release: () => {},
  };
  db.promise = () => ({ getConnection: async () => connection });
  try {
    const result = await LaboratoryOrder.updateItem(
      89,
      91,
      { id: 42, role: "laboratory_staff", departmentId: 7 },
      { status: "Completed", result: "Within expected range", notes: "Verified" }
    );
    assert.deepEqual(result, { item_status: "Completed", order_status: "Completed" });
    assert.equal(committed, true);
    assert.match(statements[0].sql, /lo\.department_id IS NULL OR lo\.department_id = \?/);
    assert.ok(statements.some(({ sql }) => /INSERT INTO laboratory_order_events/.test(sql)));
    assert.ok(statements.some(({ sql }) => /laboratory_test\.updated/.test(sql)));
  } finally {
    db.promise = originalPromise;
  }
});

test("consultation history query is scoped to the authenticated doctor's patients", async () => {
  const originalPromise = db.promise;
  let captured;
  db.promise = () => ({
    query: async (sql, values) => {
      captured = { sql, values };
      return [[], []];
    },
  });
  try {
    await Consultation.listForDoctor(17, 23, 41);
    assert.match(captured.sql, /c\.doctor_id = \?/);
    assert.match(captured.sql, /a\.doctor_id = \?/);
    assert.match(captured.sql, /pa\.user_id = \?/);
    assert.match(captured.sql, /c\.patient_id = \?/);
    assert.deepEqual(captured.values, [17, 17, 23, 41]);

    await Consultation.getForDoctor(41, 17, 23);
    assert.match(captured.sql, /c\.id = \? AND c\.doctor_id = \?/);
    assert.match(captured.sql, /a\.doctor_id = \?/);
    assert.match(captured.sql, /pa\.user_id = \?/);
    assert.deepEqual(captured.values, [41, 17, 17, 23]);
  } finally {
    db.promise = originalPromise;
  }
});

test("mounted clinic APIs reject unauthenticated requests", async (t) => {
  const server = app.listen(0);
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/patients`);
  assert.equal(response.status, 401);
  const staffResponse = await fetch(`http://127.0.0.1:${address.port}/api/staff`);
  assert.equal(staffResponse.status, 401);
  const consultationResponse = await fetch(`http://127.0.0.1:${address.port}/api/consultations`);
  assert.equal(consultationResponse.status, 401);
  const inactiveAppointments = await fetch(`http://127.0.0.1:${address.port}/api/appointments`);
  assert.equal(inactiveAppointments.status, 401);
  const inactiveDoctors = await fetch(`http://127.0.0.1:${address.port}/api/doctors`);
  assert.equal(inactiveDoctors.status, 401);
});

test("CORS permits local Vite ports and rejects unconfigured external origins", async (t) => {
  const server = app.listen(0);
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();

  const localResponse = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:5174",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,x-carepoint-request",
    },
  });
  assert.equal(localResponse.status, 204);
  if (process.env.NODE_ENV !== "production") {
    assert.equal(localResponse.headers.get("access-control-allow-origin"), "http://localhost:5174");
  }

  const externalResponse = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://untrusted.example",
      "Access-Control-Request-Method": "POST",
    },
  });
  assert.equal(externalResponse.headers.get("access-control-allow-origin"), null);
});
