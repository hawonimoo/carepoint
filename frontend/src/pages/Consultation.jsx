import { useCallback, useEffect, useState } from "react";
import { api } from "../api";

function localDateTimeNow() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function emptyForm() {
  return {
    patient_id: "",
    chief_complaint: "",
    symptoms: "",
    examination_findings: "",
    diagnosis: "",
    treatment_plan: "",
    follow_up_instructions: "",
    consultation_date: localDateTimeNow(),
  };
}
                       
function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100";
const labelClass = "grid gap-1.5 text-sm font-medium text-slate-700";

export default function Consultation() {
  const [patients, setPatients] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [patientFilter, setPatientFilter] = useState("");
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [patientError, setPatientError] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const refreshPatients = useCallback(async () => {
    setLoadingPatients(true);
    setPatientError("");
    try {
      const rows = await api.list("patients");
      setPatients(rows);
    } catch (requestError) {
      setPatientError(`Could not load your authorized patients. ${requestError.message}`);
    } finally {
      setLoadingPatients(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    api.list("patients")
      .then((rows) => {
        if (active) setPatients(rows);
      })
      .catch((requestError) => {
        if (active) setPatientError(`Could not load your authorized patients. ${requestError.message}`);
      })
      .finally(() => {
        if (active) setLoadingPatients(false);
      });
    return () => { active = false; };
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const query = patientFilter
        ? `?patient_id=${encodeURIComponent(patientFilter)}`
        : "";
      const rows = await api.list(`consultations${query}`);
      setConsultations(rows);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingHistory(false);
    }
  }, [patientFilter]);

  useEffect(() => {
    let active = true;
    const query = patientFilter
      ? `?patient_id=${encodeURIComponent(patientFilter)}`
      : "";
    api.list(`consultations${query}`)
      .then((rows) => {
        if (active) {
          setConsultations(rows);
          setError("");
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoadingHistory(false);
      });
    return () => { active = false; };
  }, [patientFilter]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setSuccess("");
  }

  function refreshHistory() {
    setLoadingHistory(true);
    loadHistory();
  }

  async function submitConsultation(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const result = await api.create("consultations", {
        ...form,
        patient_id: Number(form.patient_id),
      });
      setSuccess(result.message || "Consultation saved successfully.");
      setForm(emptyForm());
      setLoadingHistory(true);
      await loadHistory();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Doctor workspace</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">New consultation</h2>
          <p className="mt-2 text-sm text-slate-500">Record a consultation for a patient assigned to you.</p>
        </div>

        {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        {patientError && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{patientError}</p>}
        {success && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p>}

        <form onSubmit={submitConsultation} className="grid gap-4 md:grid-cols-2">
          <label className={labelClass}>
            Patient <span className="text-rose-600">*</span>
            <select
              name="patient_id"
              value={form.patient_id}
              onChange={updateField}
              required
              disabled={loadingPatients || patients.length === 0}
              className={inputClass}
            >
              <option value="">{loadingPatients ? "Loading assigned patients..." : "Select a patient"}</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.full_name} · {patient.patient_number}
                </option>
              ))}
            </select>
            {!loadingPatients && patients.length === 0 && <span className="text-xs font-normal text-slate-500">No patients assigned to your account are available. Ask an administrator or receptionist to assign a registered patient to you.</span>}
            <span className="flex flex-wrap items-center gap-3 text-xs font-semibold">
              <button
                type="button"
                onClick={refreshPatients}
                disabled={loadingPatients}
                className="text-teal-700 hover:text-teal-900 hover:underline disabled:cursor-wait disabled:opacity-60"
              >
                {loadingPatients ? "Refreshing patients..." : "Refresh patient list"}
              </button>
              <button
                type="button"
                onClick={() => { window.location.hash = "#patients"; }}
                className="text-sky-700 hover:text-sky-900 hover:underline"
              >
                Open Patients module
              </button>
            </span>
          </label>

          <label className={labelClass}>
            Consultation date and time <span className="text-rose-600">*</span>
            <input
              type="datetime-local"
              name="consultation_date"
              value={form.consultation_date}
              onChange={updateField}
              required
              className={inputClass}
            />
          </label>

          <label className={`${labelClass} md:col-span-2`}>
            Chief complaint <span className="text-rose-600">*</span>
            <textarea name="chief_complaint" value={form.chief_complaint} onChange={updateField} required maxLength={5000} rows="2" className={inputClass} />
          </label>

          <label className={labelClass}>
            Symptoms
            <textarea name="symptoms" value={form.symptoms} onChange={updateField} maxLength={10000} rows="3" className={inputClass} />
          </label>
          <label className={labelClass}>
            Examination findings
            <textarea name="examination_findings" value={form.examination_findings} onChange={updateField} maxLength={10000} rows="3" className={inputClass} />
          </label>
          <label className={labelClass}>
            Diagnosis <span className="text-rose-600">*</span>
            <textarea name="diagnosis" value={form.diagnosis} onChange={updateField} required maxLength={5000} rows="3" className={inputClass} />
          </label>
          <label className={labelClass}>
            Treatment plan <span className="text-rose-600">*</span>
            <textarea name="treatment_plan" value={form.treatment_plan} onChange={updateField} required maxLength={10000} rows="3" className={inputClass} />
          </label>
          <label className={`${labelClass} md:col-span-2`}>
            Follow-up instructions
            <textarea name="follow_up_instructions" value={form.follow_up_instructions} onChange={updateField} maxLength={5000} rows="2" className={inputClass} />
          </label>

          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <button
              type="submit"
              disabled={saving || loadingPatients || patients.length === 0}
              className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save consultation"}
            </button>
            {loadingPatients && <span className="text-sm text-slate-500">Loading patients...</span>}
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Consultation history</h2>
            <p className="mt-1 text-sm text-slate-500">Only consultations for patients you are authorized to access are shown.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Filter by patient
              <select value={patientFilter} onChange={(event) => { setLoadingHistory(true); setPatientFilter(event.target.value); }} className={`${inputClass} min-w-52`}>
                <option value="">All assigned patients</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>{patient.full_name} · {patient.patient_number}</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={refreshHistory} disabled={loadingHistory} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
              {loadingHistory ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date and time</th>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Chief complaint</th>
                <th className="px-4 py-3">Diagnosis</th>
                <th className="px-4 py-3">Treatment plan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingHistory ? (
                <tr><td colSpan="5" className="px-4 py-10 text-center text-slate-500">Loading consultation history...</td></tr>
              ) : consultations.length === 0 ? (
                <tr><td colSpan="5" className="px-4 py-10 text-center text-slate-500">No consultations found for this filter.</td></tr>
              ) : consultations.map((consultation) => (
                <tr key={consultation.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(consultation.consultation_date)}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{consultation.patient_name}<span className="mt-1 block text-xs font-normal text-slate-500">{consultation.patient_number}</span></td>
                  <td className="max-w-56 whitespace-normal px-4 py-3 text-slate-600">{consultation.chief_complaint}</td>
                  <td className="max-w-56 whitespace-normal px-4 py-3 text-slate-600">{consultation.diagnosis}</td>
                  <td className="max-w-56 whitespace-normal px-4 py-3 text-slate-600">{consultation.treatment_plan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
