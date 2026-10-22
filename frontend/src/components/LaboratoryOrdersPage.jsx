import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { formatDate } from "../utils";

const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-600 focus:ring-1 focus:ring-sky-600";
const selectClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-600 focus:ring-1 focus:ring-sky-600";

const SAMPLE_TYPES = [
  "Blood (EDTA)",
  "Blood (Serum)",
  "Blood (Fluoride)",
  "Urine (Clean Catch)",
  "Stool",
  "Sputum",
  "Swab (Throat/Nasal)",
  "Cerebrospinal Fluid (CSF)",
  "Synovial Fluid",
  "Tissue Biopsy",
  "Other",
];

const SAMPLE_STATUSES = [
  "Pending",
  "Collected",
  "Received",
  "Rejected",
  "Recollection Required",
];

export default function LaboratoryOrdersPage({ role }) {
  const isDoctor = role === "doctor";
  const canProcess = role === "laboratory_staff" || role === "admin";

  const [orders, setOrders] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [patients, setPatients] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Navigation tab
  const [activeTab, setActiveTab] = useState(isDoctor ? "order" : "overview");

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Doctor order form state
  const [patientId, setPatientId] = useState("");
  const [consultationId, setConsultationId] = useState("");
  const [testIds, setTestIds] = useState([]);
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState("Routine");

  // Modals & Active Edit States
  const [rejectOrderTarget, setRejectOrderTarget] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const [activeSampleItem, setActiveSampleItem] = useState(null);
  const [sampleForm, setSampleForm] = useState({
    barcode: "",
    sampleType: "",
    sampleStatus: "Collected",
    rejectionReason: "",
  });

  const [activeResultItem, setActiveResultItem] = useState(null);
  const [resultForm, setResultForm] = useState({
    result: "",
    unit: "",
    referenceRange: "",
    abnormalFlag: "Normal",
    notes: "",
    assignedTo: "",
    delayReason: "",
    isDraft: false,
  });

  const [activeVerifyItem, setActiveVerifyItem] = useState(null);
  const [reviewerNotes, setReviewerNotes] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const requests = [
        api.list("laboratory-orders"),
        api.list("laboratory-orders/catalogue"),
      ];
      if (isDoctor) {
        requests.push(api.list("patients"), api.list("consultations"));
      }
      const [orderRows, catalogueRows, patientRows, consultationRows] = await Promise.all(requests);
      setOrders(orderRows);
      setCatalogue(catalogueRows);
      if (isDoctor) {
        setPatients(patientRows || []);
        setConsultations(consultationRows || []);
      }
    } catch (err) {
      setError(err.message || "Failed to load laboratory data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [isDoctor]);

  // Flattened items for sample, processing, and result workflows
  const allItems = useMemo(() => {
    return orders.flatMap((order) =>
      order.items.map((item) => ({
        ...item,
        orderId: order.id,
        orderNumber: order.order_number,
        patientName: order.patient_name,
        patientNumber: order.patient_number,
        doctorName: order.doctor_name,
        orderPriority: order.priority,
        orderStatus: order.status,
        clinicalReason: order.clinical_reason,
        orderCreatedAt: order.created_at,
      }))
    );
  }, [orders]);

  // Key performance indicators (Overview Dashboard)
  const metrics = useMemo(() => {
    const totalOrders = orders.length;
    const pendingOrders = orders.filter((o) => o.status === "Pending").length;
    const samplesCollected = allItems.filter(
      (i) => i.sample_status === "Collected" || i.sample_status === "Received" || i.status === "Sample Collected"
    ).length;
    const inProgressTests = allItems.filter(
      (i) => i.status === "In Progress" || i.status === "Ready for Verification"
    ).length;
    const completedTests = allItems.filter((i) => i.status === "Completed").length;
    const urgentOrders = orders.filter((o) => o.priority === "Urgent" || o.priority === "STAT").length;

    return {
      totalOrders,
      pendingOrders,
      samplesCollected,
      inProgressTests,
      completedTests,
      urgentOrders,
    };
  }, [orders, allItems]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        order.order_number?.toLowerCase().includes(q) ||
        order.patient_name?.toLowerCase().includes(q) ||
        order.patient_number?.toLowerCase().includes(q) ||
        order.doctor_name?.toLowerCase().includes(q) ||
        order.clinical_reason?.toLowerCase().includes(q);

      const matchesPriority = priorityFilter === "all" || order.priority === priorityFilter;
      return matchesSearch && matchesPriority;
    });
  }, [orders, searchQuery, priorityFilter]);

  // Doctor submits laboratory order
  async function handleDoctorSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await api.create("laboratory-orders", {
        patient_id: Number(patientId),
        consultation_id: consultationId ? Number(consultationId) : null,
        test_ids: testIds.map(Number),
        clinical_reason: reason,
        priority,
      });
      setPatientId("");
      setConsultationId("");
      setTestIds([]);
      setReason("");
      setPriority("Routine");
      setNotice(`Laboratory order submitted successfully (${response.order_number || "Order created"}).`);
      await loadData();
      setActiveTab("requests");
    } catch (err) {
      setError(err.message || "Failed to submit laboratory order");
    } finally {
      setSaving(false);
    }
  }

  // Accept laboratory order
  async function handleAcceptOrder(order) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.create(`laboratory-orders/${order.id}/accept`, {});
      setNotice(`Order ${order.order_number} accepted. Samples can now be collected.`);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to accept order");
    } finally {
      setSaving(false);
    }
  }

  // Reject laboratory order
  async function handleRejectOrder() {
    if (!rejectOrderTarget || !rejectionReason.trim()) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.create(`laboratory-orders/${rejectOrderTarget.id}/reject`, {
        rejection_reason: rejectionReason.trim(),
      });
      setNotice(`Order ${rejectOrderTarget.order_number} was rejected.`);
      setRejectOrderTarget(null);
      setRejectionReason("");
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to reject order");
    } finally {
      setSaving(false);
    }
  }

  // Save Sample Details
  async function handleSaveSample() {
    if (!activeSampleItem) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.patch(
        `laboratory-orders/${activeSampleItem.orderId}/items/${activeSampleItem.id}/sample`,
        {
          specimen_barcode: sampleForm.barcode,
          sample_type: sampleForm.sampleType,
          sample_status: sampleForm.sampleStatus,
          rejection_reason: sampleForm.rejectionReason,
        }
      );
      setNotice(`Sample status for ${activeSampleItem.test_name} updated to ${sampleForm.sampleStatus}.`);
      setActiveSampleItem(null);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to update sample details");
    } finally {
      setSaving(false);
    }
  }

  // Save Test Results (Draft or Ready for Verification)
  async function handleSaveResult(asDraft) {
    if (!activeResultItem) return;
    if (!asDraft && !resultForm.result.trim()) {
      setError("Please enter a test result before submitting for verification.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.patch(
        `laboratory-orders/${activeResultItem.orderId}/items/${activeResultItem.id}/result`,
        {
          result: resultForm.result,
          unit: resultForm.unit,
          reference_range: resultForm.referenceRange,
          abnormal_flag: resultForm.abnormalFlag,
          notes: resultForm.notes,
          assigned_to: resultForm.assignedTo || null,
          delay_reason: resultForm.delayReason || null,
          is_draft: asDraft,
        }
      );
      setNotice(
        asDraft
          ? `Draft result saved for ${activeResultItem.test_name}.`
          : `Result for ${activeResultItem.test_name} submitted for verification.`
      );
      setActiveResultItem(null);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to save test result");
    } finally {
      setSaving(false);
    }
  }

  // Verify and Release Results
  async function handleVerifyAndRelease() {
    if (!activeVerifyItem) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.create(
        `laboratory-orders/${activeVerifyItem.orderId}/items/${activeVerifyItem.id}/verify`,
        { reviewer_notes: reviewerNotes }
      );
      setNotice(`Verified and released results for ${activeVerifyItem.test_name} to requesting clinician.`);
      setActiveVerifyItem(null);
      setReviewerNotes("");
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to verify and release result");
    } finally {
      setSaving(false);
    }
  }

  // Quick specimen barcode generator
  function generateBarcode(testName) {
    const prefix = (testName || "LAB").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `SMP-${prefix}-${rand}`;
  }

  // Open Sample Modal
  function openSampleModal(item) {
    setActiveSampleItem(item);
    setSampleForm({
      barcode: item.specimen_barcode || generateBarcode(item.test_name),
      sampleType: item.specimen_type || "Blood (EDTA)",
      sampleStatus: item.sample_status && item.sample_status !== "Pending" ? item.sample_status : "Collected",
      rejectionReason: item.sample_rejection_reason || "",
    });
  }

  // Open Result Entry Modal
  function openResultModal(item) {
    const matchedCatalogue = catalogue.find((c) => c.id === item.catalogue_test_id);
    setActiveResultItem(item);
    setResultForm({
      result: item.result || "",
      unit: item.unit || matchedCatalogue?.unit || "",
      referenceRange: item.reference_range || matchedCatalogue?.reference_range_text || "",
      abnormalFlag: item.abnormal_flag || "Normal",
      notes: item.notes || "",
      assignedTo: item.assigned_to || "",
      delayReason: item.delay_reason || "",
      isDraft: Boolean(item.is_draft),
    });
  }

  // Open Verify Modal
  function openVerifyModal(item) {
    setActiveVerifyItem(item);
    setReviewerNotes("");
  }

  const patientConsultations = consultations.filter((row) => String(row.patient_id) === patientId);

  return (
    <div className="space-y-6">
      {/* Notifications and Alerts */}
      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800 shadow-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-rose-500 hover:text-rose-800 text-base">✕</button>
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 shadow-sm flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} className="text-emerald-500 hover:text-emerald-800 text-base">✕</button>
        </div>
      )}

      {/* Laboratory Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {isDoctor && (
          <button
            onClick={() => setActiveTab("order")}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
              activeTab === "order"
                ? "bg-sky-800 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            ✚ Order Tests
          </button>
        )}

        <button
          onClick={() => setActiveTab("overview")}
          className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === "overview"
              ? "bg-sky-800 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          📊 Overview
        </button>

        <button
          onClick={() => setActiveTab("requests")}
          className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === "requests"
              ? "bg-sky-800 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          📋 Test Requests ({orders.length})
        </button>

        {canProcess && (
          <>
            <button
              onClick={() => setActiveTab("samples")}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                activeTab === "samples"
                  ? "bg-sky-800 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              🧪 Sample Management
            </button>

            <button
              onClick={() => setActiveTab("processing")}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                activeTab === "processing"
                  ? "bg-sky-800 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              ⚙ Test Processing
            </button>

            <button
              onClick={() => setActiveTab("results")}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                activeTab === "results"
                  ? "bg-sky-800 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              ✍ Enter Results
            </button>

            <button
              onClick={() => setActiveTab("verify")}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                activeTab === "verify"
                  ? "bg-sky-800 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              ✓ Verify & Release
            </button>
          </>
        )}

        <button
          onClick={() => setActiveTab("catalogue")}
          className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === "catalogue"
              ? "bg-sky-800 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          📖 Test Catalogue ({catalogue.length})
        </button>

        <button
          onClick={loadData}
          disabled={loading}
          className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "↻ Refresh Queue"}
        </button>
      </div>

      {/* ────────────────── TAB 1: OVERVIEW DASHBOARD ────────────────── */}
      {activeTab === "overview" && (
        <section className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Total Lab Orders</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.totalOrders}</p>
              <span className="mt-1 inline-block text-[11px] text-slate-400">All registered requests</span>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
              <p className="text-xs font-medium text-amber-800">Pending Requests</p>
              <p className="mt-2 text-2xl font-bold text-amber-900">{metrics.pendingOrders}</p>
              <span className="mt-1 inline-block text-[11px] text-amber-700">Awaiting intake</span>
            </div>

            <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 shadow-sm">
              <p className="text-xs font-medium text-sky-800">Samples Collected</p>
              <p className="mt-2 text-2xl font-bold text-sky-900">{metrics.samplesCollected}</p>
              <span className="mt-1 inline-block text-[11px] text-sky-700">Ready for testing</span>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-sm">
              <p className="text-xs font-medium text-indigo-800">Tests In Progress</p>
              <p className="mt-2 text-2xl font-bold text-indigo-900">{metrics.inProgressTests}</p>
              <span className="mt-1 inline-block text-[11px] text-indigo-700">Under analysis</span>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
              <p className="text-xs font-medium text-emerald-800">Completed Tests</p>
              <p className="mt-2 text-2xl font-bold text-emerald-900">{metrics.completedTests}</p>
              <span className="mt-1 inline-block text-[11px] text-emerald-700">Released to doctor</span>
            </div>

            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 shadow-sm">
              <p className="text-xs font-medium text-rose-800">Urgent / STAT</p>
              <p className="mt-2 text-2xl font-bold text-rose-900">{metrics.urgentOrders}</p>
              <span className="mt-1 inline-block text-[11px] text-rose-700 font-semibold">Priority attention</span>
            </div>
          </div>

          {/* Quick Overview Summary Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-800">Recent Laboratory Requests</h3>
                <p className="text-xs text-slate-500 mt-0.5">Summary of latest doctor requests and their diagnostic statuses</p>
              </div>
              <button
                onClick={() => setActiveTab("requests")}
                className="text-xs font-semibold text-sky-700 hover:text-sky-900"
              >
                View all orders →
              </button>
            </div>
            <div className="divide-y divide-slate-100 overflow-x-auto">
              {!orders.length ? (
                <p className="p-5 text-sm text-slate-500">No laboratory orders recorded yet.</p>
              ) : (
                orders.slice(0, 5).map((order) => (
                  <div key={order.id} className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/80">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900">{order.order_number}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          order.priority === "STAT"
                            ? "bg-rose-100 text-rose-800 border border-rose-300"
                            : order.priority === "Urgent"
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : "bg-slate-100 text-slate-700"
                        }`}>
                          {order.priority}
                        </span>
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                          {order.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        Patient: <span className="font-semibold">{order.patient_name}</span> ({order.patient_number}) · Dr. {order.doctor_name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 italic">"{order.clinical_reason}"</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {canProcess && order.status === "Pending" && (
                        <button
                          onClick={() => handleAcceptOrder(order)}
                          disabled={saving}
                          className="rounded-lg bg-sky-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-900"
                        >
                          Accept
                        </button>
                      )}
                      <button
                        onClick={() => setActiveTab("requests")}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Inspect
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {/* ────────────────── TAB: DOCTOR TEST ORDER FORM ────────────────── */}
      {isDoctor && activeTab === "order" && (
        <form onSubmit={handleDoctorSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div>
            <h2 className="font-[Manrope] text-lg font-bold text-slate-900">Request laboratory tests</h2>
            <p className="mt-1 text-xs text-slate-500">Orders are linked to your doctor account and routed to the Laboratory queue.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Patient *
              <select
                required
                value={patientId}
                onChange={(event) => {
                  setPatientId(event.target.value);
                  setConsultationId("");
                }}
                className={selectClass}
              >
                <option value="">Select assigned patient</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} · {p.patient_number}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Consultation (optional)
              <select
                disabled={!patientId}
                value={consultationId}
                onChange={(event) => setConsultationId(event.target.value)}
                className={selectClass}
              >
                <option value="">No consultation selected</option>
                {patientConsultations.map((row) => (
                  <option key={row.id} value={row.id}>
                    {formatDate(row.consultation_date)} · {row.chief_complaint}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Select Tests * (Hold Ctrl or Command for multiple)
              <select
                multiple
                required
                value={testIds}
                onChange={(event) => setTestIds(Array.from(event.target.selectedOptions, (o) => o.value))}
                className={`${selectClass} min-h-36`}
              >
                {catalogue.map((test) => (
                  <option key={test.id} value={test.id}>
                    {test.test_name} {test.specimen_type ? `(${test.specimen_type})` : ""} · Ref: {test.reference_range_text || "Standard"}
                  </option>
                ))}
              </select>
              <span className="font-normal text-slate-500 text-[11px]">Selected: {testIds.length} test(s)</span>
            </label>

            <div className="space-y-3">
              <label className="grid gap-1 text-xs font-semibold text-slate-700">
                Priority
                <select value={priority} onChange={(event) => setPriority(event.target.value)} className={selectClass}>
                  <option value="Routine">Routine</option>
                  <option value="Urgent">Urgent</option>
                  <option value="STAT">STAT (Immediate / Emergency)</option>
                </select>
              </label>

              <label className="grid gap-1 text-xs font-semibold text-slate-700">
                Clinical Reason & Notes *
                <textarea
                  required
                  maxLength={5000}
                  rows="3"
                  placeholder="Clinical indication, provisional diagnosis, or specific parameters needed..."
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className={inputClass}
                />
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || !patients.length || !catalogue.length}
            className="rounded-lg bg-sky-800 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-900 disabled:opacity-60"
          >
            {saving ? "Submitting order…" : "Submit Laboratory Order"}
          </button>
        </form>
      )}

      {/* ────────────────── TAB 2: TEST REQUESTS QUEUE ────────────────── */}
      {activeTab === "requests" && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900">Doctor Laboratory Requests Queue</h3>
              <p className="text-xs text-slate-500 mt-0.5">Filter by priority or patient, accept incoming requests, or decline invalid requests</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Search orders, patients, doctors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-sky-600"
              />

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              >
                <option value="all">All Priorities</option>
                <option value="STAT">STAT Only</option>
                <option value="Urgent">Urgent Only</option>
                <option value="Routine">Routine Only</option>
              </select>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {!filteredOrders.length ? (
              <p className="p-6 text-sm text-slate-500 text-center">No orders match the selected filters.</p>
            ) : (
              filteredOrders.map((order) => (
                <article key={order.id} className="p-5 hover:bg-slate-50/50 transition">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{order.order_number}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          order.priority === "STAT"
                            ? "bg-rose-100 text-rose-800 border border-rose-300"
                            : order.priority === "Urgent"
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : "bg-slate-100 text-slate-700"
                        }`}>
                          {order.priority}
                        </span>
                        <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-semibold text-sky-800">
                          {order.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 mt-1">
                        Patient: <span className="font-semibold text-slate-900">{order.patient_name}</span> ({order.patient_number}) · Requesting Clinician: <span className="font-semibold text-slate-900">Dr. {order.doctor_name}</span> · Ordered {formatDate(order.created_at)}
                      </p>

                      <p className="text-xs text-slate-700 mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className="font-semibold text-slate-800">Clinical Indication: </span>{order.clinical_reason}
                      </p>

                      {order.status === "Rejected" && (
                        <p className="text-xs text-rose-700 mt-1.5 font-medium">
                          ⚠ Rejection Reason: {order.rejection_reason}
                        </p>
                      )}
                    </div>

                    {/* Order Acceptance Controls */}
                    {canProcess && (
                      <div className="flex items-center gap-2">
                        {order.status === "Pending" && (
                          <>
                            <button
                              onClick={() => handleAcceptOrder(order)}
                              disabled={saving}
                              className="rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 shadow-sm"
                            >
                              ✓ Accept Order
                            </button>

                            <button
                              onClick={() => {
                                setRejectOrderTarget(order);
                                setRejectionReason("");
                              }}
                              disabled={saving}
                              className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                            >
                              ✕ Reject Order
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Test items inside order */}
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <p className="text-xs font-semibold text-slate-500 mb-2">Requested Tests ({order.items.length}):</p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {order.items.map((item) => (
                        <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-slate-800">{item.test_name}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">{item.specimen_type || "Blood"} · {item.status}</p>
                            {item.specimen_barcode && (
                              <p className="text-[10px] text-sky-700 font-mono mt-0.5">Barcode: {item.specimen_barcode}</p>
                            )}
                          </div>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            item.status === "Completed"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.status === "Sample Collected"
                              ? "bg-sky-100 text-sky-800"
                              : item.status === "In Progress"
                              ? "bg-indigo-100 text-indigo-800"
                              : "bg-slate-100 text-slate-700"
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {/* ────────────────── TAB 3: SAMPLE MANAGEMENT ────────────────── */}
      {canProcess && activeTab === "samples" && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-bold text-slate-900">Specimen & Sample Management</h3>
            <p className="text-xs text-slate-500 mt-0.5">Generate barcodes, verify sample intake, track collection timestamps and rejection criteria</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold">
                <tr>
                  <th className="p-3">Order / Patient</th>
                  <th className="p-3">Test Name</th>
                  <th className="p-3">Specimen Barcode</th>
                  <th className="p-3">Sample Type</th>
                  <th className="p-3">Sample Status</th>
                  <th className="p-3">Collected Details</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!allItems.length ? (
                  <tr>
                    <td colSpan="7" className="p-6 text-center text-slate-500">No test specimens recorded.</td>
                  </tr>
                ) : (
                  allItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="p-3">
                        <p className="font-bold text-slate-900">{item.orderNumber}</p>
                        <p className="text-slate-500">{item.patientName} ({item.patientNumber})</p>
                      </td>
                      <td className="p-3 font-semibold text-slate-800">{item.test_name}</td>
                      <td className="p-3 font-mono text-sky-800">{item.specimen_barcode || "—"}</td>
                      <td className="p-3 text-slate-600">{item.specimen_type || "Blood"}</td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.sample_status === "Collected" || item.sample_status === "Received"
                            ? "bg-emerald-100 text-emerald-800"
                            : item.sample_status === "Rejected"
                            ? "bg-rose-100 text-rose-800"
                            : item.sample_status === "Recollection Required"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                        }`}>
                          {item.sample_status || "Pending"}
                        </span>
                        {item.sample_rejection_reason && (
                          <p className="text-[10px] text-rose-600 mt-0.5 italic">{item.sample_rejection_reason}</p>
                        )}
                      </td>
                      <td className="p-3 text-slate-500">
                        {item.collected_at ? (
                          <>
                            <p>{formatDate(item.collected_at)}</p>
                            {item.collected_by_name && <p className="text-[10px] text-slate-400">By {item.collected_by_name}</p>}
                          </>
                        ) : (
                          "Awaiting collection"
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => openSampleModal(item)}
                          className="rounded-md border border-sky-600 px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50"
                        >
                          Update Sample
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ────────────────── TAB 4: TEST PROCESSING ────────────────── */}
      {canProcess && activeTab === "processing" && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-bold text-slate-900">Test Processing Worklist</h3>
            <p className="text-xs text-slate-500 mt-0.5">Active laboratory pipeline: Queued → In Progress → Ready for Verification</p>
          </div>

          <div className="divide-y divide-slate-100">
            {!allItems.length ? (
              <p className="p-6 text-center text-slate-500">No active laboratory tests in the processing queue.</p>
            ) : (
              allItems.map((item) => (
                <div key={item.id} className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{item.test_name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        item.status === "Completed"
                          ? "bg-emerald-100 text-emerald-800"
                          : item.status === "Ready for Verification"
                          ? "bg-purple-100 text-purple-800"
                          : item.status === "In Progress"
                          ? "bg-indigo-100 text-indigo-800"
                          : "bg-slate-100 text-slate-700"
                      }`}>
                        {item.status}
                      </span>
                      {item.is_draft ? (
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">Draft</span>
                      ) : null}
                    </div>

                    <p className="text-xs text-slate-600">
                      Order: <span className="font-semibold">{item.orderNumber}</span> · Patient: {item.patientName} · Clinician: Dr. {item.doctorName}
                    </p>

                    {item.delay_reason && (
                      <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                        ⚠ Delay Note: {item.delay_reason}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openResultModal(item)}
                      className="rounded-lg bg-sky-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-900 shadow-sm"
                    >
                      {item.result ? "Edit Result" : "Enter Result"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* ────────────────── TAB 5: ENTER TEST RESULTS ────────────────── */}
      {canProcess && activeTab === "results" && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-bold text-slate-900">Diagnostic Result Recording</h3>
            <p className="text-xs text-slate-500 mt-0.5">Select a test to input values, reference ranges, and clinical abnormality flags</p>
          </div>

          <div className="divide-y divide-slate-100">
            {!allItems.length ? (
              <p className="p-6 text-center text-slate-500">No tests available for result entry.</p>
            ) : (
              allItems.map((item) => (
                <div key={item.id} className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{item.test_name}</span>
                      <span className="text-xs text-slate-500">({item.orderNumber})</span>
                      {item.abnormal_flag && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          item.abnormal_flag === "Critical"
                            ? "bg-rose-600 text-white"
                            : item.abnormal_flag === "Abnormal"
                            ? "bg-amber-500 text-white"
                            : "bg-emerald-100 text-emerald-800"
                        }`}>
                          {item.abnormal_flag}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600">
                      Patient: <span className="font-medium text-slate-800">{item.patientName}</span> · Ref Range: <span className="font-mono text-slate-700">{item.reference_range || "N/A"}</span>
                    </p>

                    {item.result && (
                      <p className="text-xs text-slate-800 bg-slate-50 p-2 rounded border border-slate-200 mt-1">
                        <span className="font-bold">Recorded Result: </span>{item.result} {item.unit || ""}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => openResultModal(item)}
                    className="rounded-lg bg-sky-800 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-900 shadow-sm"
                  >
                    {item.result ? "Update Result" : "Enter Result"}
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* ────────────────── TAB 6: VERIFY & RELEASE RESULTS ────────────────── */}
      {canProcess && activeTab === "verify" && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-bold text-slate-900">Verification & Release Gate</h3>
            <p className="text-xs text-slate-500 mt-0.5">Senior laboratory technologist review and sign-off before releasing reports to requesting doctors</p>
          </div>

          <div className="divide-y divide-slate-100">
            {!allItems.filter((i) => i.result && i.status !== "Completed").length ? (
              <p className="p-6 text-center text-slate-500">No test results are currently awaiting verification sign-off.</p>
            ) : (
              allItems
                .filter((i) => i.result && i.status !== "Completed")
                .map((item) => (
                  <div key={item.id} className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{item.test_name}</span>
                        <span className="text-xs text-slate-500">Order: {item.orderNumber}</span>
                        {item.abnormal_flag && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            item.abnormal_flag === "Critical"
                              ? "bg-rose-600 text-white"
                              : item.abnormal_flag === "Abnormal"
                              ? "bg-amber-500 text-white"
                              : "bg-emerald-100 text-emerald-800"
                          }`}>
                            {item.abnormal_flag}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600">
                        Patient: <span className="font-semibold text-slate-800">{item.patientName}</span> · Requesting Clinician: Dr. {item.doctorName}
                      </p>

                      <div className="mt-2 rounded-lg bg-sky-50/60 p-3 border border-sky-100 text-xs text-slate-800 space-y-1">
                        <p><span className="font-semibold">Value: </span>{item.result} {item.unit || ""}</p>
                        <p><span className="font-semibold">Standard Reference Range: </span>{item.reference_range || "N/A"}</p>
                        {item.notes && <p><span className="font-semibold">Technician Comments: </span>{item.notes}</p>}
                      </div>
                    </div>

                    <button
                      onClick={() => openVerifyModal(item)}
                      className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 shadow-sm"
                    >
                      ✓ Verify & Release Report
                    </button>
                  </div>
                ))
            )}
          </div>
        </section>
      )}

      {/* ────────────────── TAB 7: TEST CATALOGUE ────────────────── */}
      {activeTab === "catalogue" && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-bold text-slate-900">Laboratory Diagnostic Catalogue</h3>
            <p className="text-xs text-slate-500 mt-0.5">Reference specifications, specimen types, and configured clinical normal ranges</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold">
                <tr>
                  <th className="p-3">Test Code</th>
                  <th className="p-3">Test Name</th>
                  <th className="p-3">Specimen Requirement</th>
                  <th className="p-3">Standard Units</th>
                  <th className="p-3">Configured Reference Range</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {catalogue.map((test) => (
                  <tr key={test.id} className="hover:bg-slate-50/70">
                    <td className="p-3 font-mono font-bold text-sky-800">{test.test_code}</td>
                    <td className="p-3 font-semibold text-slate-900">{test.test_name}</td>
                    <td className="p-3 text-slate-600">{test.specimen_type || "Blood"}</td>
                    <td className="p-3 font-mono text-slate-700">{test.unit || "—"}</td>
                    <td className="p-3 text-slate-700">{test.reference_range_text || "Standard adult range"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ────────────────── MODAL: REJECT ORDER ────────────────── */}
      {rejectOrderTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Reject Laboratory Request</h3>
            <p className="text-xs text-slate-500">
              Please enter the clinical or logistical reason for declining Order <span className="font-semibold text-slate-800">{rejectOrderTarget.order_number}</span>.
            </p>

            <textarea
              required
              rows="3"
              placeholder="e.g., Specimen volume insufficient, patient not in fasting state, requisition form incomplete..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className={inputClass}
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectOrderTarget(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectionReason.trim() || saving}
                onClick={handleRejectOrder}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {saving ? "Rejecting…" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── MODAL: SAMPLE MANAGEMENT ────────────────── */}
      {activeSampleItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Sample Management Intake</h3>
            <p className="text-xs text-slate-500">
              Specimen tracking for <span className="font-semibold text-slate-800">{activeSampleItem.test_name}</span> ({activeSampleItem.patientName})
            </p>

            <div className="space-y-3">
              <label className="grid gap-1 text-xs font-semibold text-slate-700">
                Specimen ID / Barcode
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sampleForm.barcode}
                    onChange={(e) => setSampleForm({ ...sampleForm, barcode: e.target.value })}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setSampleForm({ ...sampleForm, barcode: generateBarcode(activeSampleItem.test_name) })}
                    className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Generate
                  </button>
                </div>
              </label>

              <label className="grid gap-1 text-xs font-semibold text-slate-700">
                Sample Type
                <select
                  value={sampleForm.sampleType}
                  onChange={(e) => setSampleForm({ ...sampleForm, sampleType: e.target.value })}
                  className={selectClass}
                >
                  {SAMPLE_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-xs font-semibold text-slate-700">
                Sample Status
                <select
                  value={sampleForm.sampleStatus}
                  onChange={(e) => setSampleForm({ ...sampleForm, sampleStatus: e.target.value })}
                  className={selectClass}
                >
                  {SAMPLE_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>

              {["Rejected", "Recollection Required"].includes(sampleForm.sampleStatus) && (
                <label className="grid gap-1 text-xs font-semibold text-slate-700">
                  Sample Rejection / Recollection Reason
                  <textarea
                    rows="2"
                    placeholder="e.g., Hemolyzed specimen, clotted blood, incorrect tube type..."
                    value={sampleForm.rejectionReason}
                    onChange={(e) => setSampleForm({ ...sampleForm, rejectionReason: e.target.value })}
                    className={inputClass}
                  />
                </label>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveSampleItem(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveSample}
                className="rounded-lg bg-sky-800 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-900 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Specimen Intake"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── MODAL: ENTER RESULTS ────────────────── */}
      {activeResultItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Enter Diagnostic Test Results</h3>
            <p className="text-xs text-slate-500">
              Test: <span className="font-semibold text-slate-800">{activeResultItem.test_name}</span> · Patient: {activeResultItem.patientName}
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-semibold text-slate-700 sm:col-span-2">
                Test Result *
                <input
                  type="text"
                  placeholder="e.g. 104, Negative, Clear, 14.2"
                  value={resultForm.result}
                  onChange={(e) => setResultForm({ ...resultForm, result: e.target.value })}
                  className={inputClass}
                />
              </label>

              <label className="grid gap-1 text-xs font-semibold text-slate-700">
                Measurement Unit
                <input
                  type="text"
                  placeholder="e.g. mg/dL, %, g/dL"
                  value={resultForm.unit}
                  onChange={(e) => setResultForm({ ...resultForm, unit: e.target.value })}
                  className={inputClass}
                />
              </label>

              <label className="grid gap-1 text-xs font-semibold text-slate-700">
                Configured Reference Range
                <input
                  type="text"
                  value={resultForm.referenceRange}
                  onChange={(e) => setResultForm({ ...resultForm, referenceRange: e.target.value })}
                  className={inputClass}
                />
              </label>

              <label className="grid gap-1 text-xs font-semibold text-slate-700 sm:col-span-2">
                Abnormality Flag
                <select
                  value={resultForm.abnormalFlag}
                  onChange={(e) => setResultForm({ ...resultForm, abnormalFlag: e.target.value })}
                  className={selectClass}
                >
                  <option value="Normal">Normal (Within standard parameters)</option>
                  <option value="Abnormal">Abnormal (Outside standard range)</option>
                  <option value="Critical">Critical (Panic value / immediate alert)</option>
                </select>
              </label>

              <label className="grid gap-1 text-xs font-semibold text-slate-700 sm:col-span-2">
                Laboratory Comments & Observations
                <textarea
                  rows="2"
                  placeholder="Additional technician observations, microscopic findings, or remarks..."
                  value={resultForm.notes}
                  onChange={(e) => setResultForm({ ...resultForm, notes: e.target.value })}
                  className={inputClass}
                />
              </label>
            </div>

            <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveResultItem(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveResult(true)}
                  className="rounded-lg border border-amber-600 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                >
                  Save Draft
                </button>

                <button
                  type="button"
                  disabled={saving || !resultForm.result.trim()}
                  onClick={() => handleSaveResult(false)}
                  className="rounded-lg bg-sky-800 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-900 disabled:opacity-50"
                >
                  Submit for Verification
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── MODAL: VERIFY AND RELEASE ────────────────── */}
      {activeVerifyItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Verify & Release Laboratory Report</h3>
            <p className="text-xs text-slate-500">
              Confirm verified diagnostic findings for <span className="font-semibold text-slate-800">{activeVerifyItem.test_name}</span>. Upon release, report is locked and accessible to Dr. {activeVerifyItem.doctorName}.
            </p>

            <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200 text-xs text-slate-800 space-y-1.5">
              <p><span className="font-semibold">Recorded Value: </span>{activeVerifyItem.result} {activeVerifyItem.unit || ""}</p>
              <p><span className="font-semibold">Reference Range: </span>{activeVerifyItem.reference_range || "N/A"}</p>
              <p>
                <span className="font-semibold">Flag: </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeVerifyItem.abnormal_flag === "Critical"
                    ? "bg-rose-600 text-white"
                    : activeVerifyItem.abnormal_flag === "Abnormal"
                    ? "bg-amber-500 text-white"
                    : "bg-emerald-100 text-emerald-800"
                }`}>
                  {activeVerifyItem.abnormal_flag || "Normal"}
                </span>
              </p>
              {activeVerifyItem.notes && <p><span className="font-semibold">Technician Comments: </span>{activeVerifyItem.notes}</p>}
            </div>

            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Senior Reviewer Sign-off Notes (Optional)
              <input
                type="text"
                placeholder="Reviewer remarks or clinical authorization note..."
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                className={inputClass}
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveVerifyItem(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleVerifyAndRelease}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 shadow-sm disabled:opacity-50"
              >
                {saving ? "Releasing…" : "✓ Confirm & Release to Clinician"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
