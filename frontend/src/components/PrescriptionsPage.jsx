import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { formatDate } from "../utils";

const emptyMedicine = () => ({
  medicine_id: "",
  strength: "",
  dosage_form: "",
  dose: "",
  route: "Oral",
  frequency: "",
  duration: "",
  quantity: "",
  instructions: "",
});

const controlClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800";

export default function PrescriptionsPage({ role }) {
  const canPrescribe = role === "doctor";
  const canDispense = role === "pharmacist" || role === "admin";
  const [orders, setOrders] = useState([]);
  const [patients, setPatients] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [consultationId, setConsultationId] = useState("");
  const [items, setItems] = useState([emptyMedicine()]);
  const [dispenseQuantities, setDispenseQuantities] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const orderRequest = api.list("prescriptions");
    const requests = [orderRequest];
    if (canPrescribe) requests.push(api.list("patients"), api.list("medicines"), api.list("consultations"));
    const [orderRows, patientRows, medicineRows, consultationRows] = await Promise.all(requests);
    setOrders(orderRows);
    if (canPrescribe) {
      setPatients(patientRows);
      setMedicines(medicineRows);
      setConsultations(consultationRows);
    }
  }, [canPrescribe]);

  useEffect(() => {
    let active = true;
    const requests = [api.list("prescriptions")];
    if (canPrescribe) requests.push(api.list("patients"), api.list("medicines"), api.list("consultations"));
    Promise.all(requests)
      .then(([orderRows, patientRows, medicineRows, consultationRows]) => {
        if (!active) return;
        setOrders(orderRows);
        if (canPrescribe) {
          setPatients(patientRows);
          setMedicines(medicineRows);
          setConsultations(consultationRows);
        }
      })
      .catch((loadError) => { if (active) setError(loadError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [canPrescribe]);

  const patientConsultations = consultations.filter((row) => String(row.patient_id) === patientId);

  function updateItem(index, field, value) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const result = await api.create("prescriptions", {
        patient_id: Number(patientId),
        consultation_id: consultationId ? Number(consultationId) : null,
        items: items.map((item) => ({
          ...item,
          medicine_id: Number(item.medicine_id),
          quantity: Number(item.quantity),
        })),
      });
      setItems([emptyMedicine()]);
      setPatientId("");
      setConsultationId("");
      setNotice(`${result.message} (${result.prescription_number}).`);
      await load();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function accept(order) {
    setSaving(true);
    setError("");
    try {
      await api.create(`prescriptions/${order.id}/accept`, {});
      setNotice(`${order.prescription_number} accepted for dispensing.`);
      await load();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setSaving(false);
    }
  }

  async function dispense(order, item) {
    const quantity = Number(dispenseQuantities[item.id]);
    setSaving(true);
    setError("");
    try {
      await api.create(`prescriptions/${order.id}/dispense`, {
        items: [{ item_id: item.id, quantity }],
      });
      setNotice(`Dispensing recorded for ${item.medicine_name}.`);
      setDispenseQuantities((current) => ({ ...current, [item.id]: "" }));
      await load();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {canPrescribe && (
        <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="font-[Manrope] text-lg font-bold text-slate-900">Create prescription</h2>
            <p className="mt-1 text-sm text-slate-500">Orders are linked to your doctor account and sent to the Pharmacy queue.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Patient *
              <select required value={patientId} onChange={(event) => { setPatientId(event.target.value); setConsultationId(""); }} className={controlClass}>
                <option value="">Select assigned patient</option>
                {patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.full_name} · {patient.patient_number}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Consultation (optional)
              <select value={consultationId} onChange={(event) => setConsultationId(event.target.value)} disabled={!patientId} className={controlClass}>
                <option value="">No consultation selected</option>
                {patientConsultations.map((row) => <option key={row.id} value={row.id}>{formatDate(row.consultation_date)} · {row.chief_complaint}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-5 space-y-4">
            {items.map((item, index) => (
              <fieldset key={index} className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <legend className="px-1 text-sm font-semibold text-slate-700">Medicine {index + 1}</legend>
                <label className="grid gap-1 text-xs font-semibold text-slate-700 sm:col-span-2">
                  Medicine *
                  <select required value={item.medicine_id} onChange={(event) => updateItem(index, "medicine_id", event.target.value)} className={controlClass}>
                    <option value="">Select medicine</option>
                    {medicines.map((medicine) => <option key={medicine.id} value={medicine.id}>{medicine.medicine_name}{medicine.category ? ` · ${medicine.category}` : ""}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-semibold text-slate-700">Strength<input maxLength={100} value={item.strength} onChange={(event) => updateItem(index, "strength", event.target.value)} placeholder="e.g. 500 mg" className={controlClass} /></label>
                <label className="grid gap-1 text-xs font-semibold text-slate-700">Dosage form<input maxLength={80} value={item.dosage_form} onChange={(event) => updateItem(index, "dosage_form", event.target.value)} placeholder="Tablet, capsule, liquid..." className={controlClass} /></label>
                <label className="grid gap-1 text-xs font-semibold text-slate-700">Dose *<input required maxLength={150} value={item.dose} onChange={(event) => updateItem(index, "dose", event.target.value)} placeholder="e.g. 1 tablet" className={controlClass} /></label>
                <label className="grid gap-1 text-xs font-semibold text-slate-700">Route *<input required maxLength={80} value={item.route} onChange={(event) => updateItem(index, "route", event.target.value)} placeholder="Oral, topical..." className={controlClass} /></label>
                <label className="grid gap-1 text-xs font-semibold text-slate-700">Frequency *<input required maxLength={150} value={item.frequency} onChange={(event) => updateItem(index, "frequency", event.target.value)} placeholder="e.g. Twice daily" className={controlClass} /></label>
                <label className="grid gap-1 text-xs font-semibold text-slate-700">Duration *<input required maxLength={100} value={item.duration} onChange={(event) => updateItem(index, "duration", event.target.value)} placeholder="e.g. 5 days" className={controlClass} /></label>
                <label className="grid gap-1 text-xs font-semibold text-slate-700">Quantity *<input required type="number" min="1" max="10000" step="1" value={item.quantity} onChange={(event) => updateItem(index, "quantity", event.target.value)} className={controlClass} /></label>
                <label className="grid gap-1 text-xs font-semibold text-slate-700 sm:col-span-2">Instructions<textarea maxLength={3000} rows="2" value={item.instructions} onChange={(event) => updateItem(index, "instructions", event.target.value)} className={controlClass} /></label>
                {items.length > 1 && <button type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="self-end text-left text-sm font-semibold text-rose-700 hover:underline">Remove medicine</button>}
              </fieldset>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => setItems((current) => [...current, emptyMedicine()])} disabled={items.length >= 20} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">+ Add medicine</button>
            <button type="submit" disabled={saving || !patients.length || !medicines.length} className="rounded-lg bg-sky-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Sending…" : "Send to Pharmacy"}</button>
          </div>
        </form>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-[Manrope] font-bold text-slate-900">{canDispense ? "Pharmacy prescription queue" : "Prescription history"}</h2>
            <p className="mt-1 text-xs text-slate-500">{canDispense ? "Accept orders and record dispensing; stock is updated for each medicine." : "Track pharmacy processing and dispensing progress."}</p>
          </div>
          <button type="button" onClick={() => { setLoading(true); load().catch((loadError) => setError(loadError.message)).finally(() => setLoading(false)); }} disabled={loading} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60">{loading ? "Refreshing…" : "Refresh"}</button>
        </div>
        {error && <p role="alert" className="m-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {notice && <p role="status" className="m-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        {loading ? <p className="p-5 text-sm text-slate-500">Loading prescriptions…</p> : !orders.length ? <p className="p-5 text-sm text-slate-500">No prescriptions to display.</p> : (
          <div className="space-y-4 p-4">
            {orders.map((order) => (
              <article key={order.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{order.prescription_number} · {order.patient_name}</h3>
                    <p className="mt-1 text-xs text-slate-500">{order.patient_number} · Dr. {order.doctor_name} · {formatDate(order.created_at)}</p>
                  </div>
                  <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">{order.status}</span>
                </div>
                <div className="mt-3 divide-y divide-slate-100">
                  {order.items.map((item) => {
                    const remaining = Number(item.quantity) - Number(item.dispensed_quantity);
                    return (
                      <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div className="min-w-56 flex-1">
                          <p className="text-sm font-semibold text-slate-800">{item.medicine_name}{item.strength ? ` · ${item.strength}` : ""}{item.dosage_form ? ` · ${item.dosage_form}` : ""}</p>
                          <p className="mt-1 text-xs text-slate-600">{item.dose} · {item.route} · {item.frequency} · {item.duration} · {item.dispensed_quantity}/{item.quantity} dispensed</p>
                          {item.instructions && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{item.instructions}</p>}
                        </div>
                        {canDispense && order.status === "Pending" && <button type="button" disabled={saving} onClick={() => accept(order)} className="rounded-lg border border-sky-700 px-3 py-2 text-xs font-semibold text-sky-800 disabled:opacity-50">Accept order</button>}
                        {canDispense && remaining > 0 && ["Processing", "Partially Dispensed"].includes(order.status) && (
                          <div className="flex items-center gap-2">
                            <input aria-label={`Quantity to dispense for ${item.medicine_name}`} type="number" min="1" max={remaining} value={dispenseQuantities[item.id] ?? ""} onChange={(event) => setDispenseQuantities((current) => ({ ...current, [item.id]: event.target.value }))} className="w-24 rounded-lg border border-slate-300 px-2 py-2 text-sm" />
                            <button type="button" disabled={saving || !Number(dispenseQuantities[item.id])} onClick={() => dispense(order, item)} className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Dispense</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
