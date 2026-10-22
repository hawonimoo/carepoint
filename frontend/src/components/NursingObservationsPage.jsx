import { useEffect, useState } from "react";
import { api } from "../api";
import { formatDate } from "../utils";

export default function NursingObservationsPage() {
  const [rows, setRows] = useState([]);
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [observation, setObservation] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function reload() {
    try {
      const [observations, patientRows] = await Promise.all([
        api.list("nursing-observations"),
        api.list("patients"),
      ]);
      setRows(observations);
      setPatients(patientRows);
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    Promise.all([api.list("nursing-observations"), api.list("patients")])
      .then(([observations, patientRows]) => {
        if (!active) return;
        setRows(observations);
        setPatients(patientRows);
      })
      .catch((loadError) => { if (active) setError(loadError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.create("nursing-observations", { patient_id: Number(patientId), observation });
      setObservation("");
      setNotice("Observation recorded.");
      await reload();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-[Manrope] text-lg font-bold text-slate-900">Record a nursing observation</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_2fr_auto]">
          <select required value={patientId} onChange={(event) => setPatientId(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">Select assigned patient</option>
            {patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.full_name} · {patient.patient_number}</option>)}
          </select>
          <textarea required maxLength={5000} rows={2} value={observation} onChange={(event) => setObservation(event.target.value)} placeholder="Observation (avoid unnecessary identifiers)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button disabled={saving} className="rounded-lg bg-sky-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Record"}</button>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
        {notice && <p role="status" className="mt-3 text-sm text-emerald-700">{notice}</p>}
      </form>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-[Manrope] text-lg font-bold text-slate-900">Recent observations</h2>
        {loading && <p className="py-4 text-sm text-slate-500">Loading observations…</p>}
        {!loading && !rows.length && <p className="py-4 text-sm text-slate-500">No observations recorded.</p>}
        <div className="divide-y divide-slate-100">{rows.map((row) => <article key={row.id} className="py-4"><p className="text-xs font-semibold text-slate-500">{row.patient_name} · {formatDate(row.recorded_at)}</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{row.observation}</p></article>)}</div>
      </section>
    </div>
  );
}
