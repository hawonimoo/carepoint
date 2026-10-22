import { useEffect, useState } from "react";
import { api } from "../api";
import { formatDate } from "../utils";

export default function NotificationsPage({ user }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function reload() {
    setLoading(true);
    try {
      setRows(await api.list("notifications"));
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    api.list("notifications")
      .then((items) => { if (active) setRows(items); })
      .catch((loadError) => { if (active) setError(loadError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function markRead(id) {
    try {
      await api.markNotificationRead(id);
      await reload();
    } catch (readError) {
      setError(readError.message);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-[Manrope] text-lg font-bold text-slate-900">{user.role === "admin" ? "Notification delivery log" : "Your notifications"}</h2>
      <p className="mb-4 mt-1 text-sm text-slate-500">{user.role === "admin" ? "Review appointment notification statuses, delivery errors, and patient-message availability." : "Appointment updates assigned to your staff account."}</p>
      {loading && <p className="py-4 text-sm text-slate-500">Loading notifications…</p>}
      {error && <p role="alert" className="mb-3 text-sm text-rose-700">{error}</p>}
      {!loading && !rows.length && <p className="py-4 text-sm text-slate-500">No notifications yet.</p>}
      <div className="space-y-3">{rows.map((row) => <article key={row.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 p-4">
        <div><p className="text-sm font-medium text-slate-800">{row.message}</p><p className="mt-1 text-xs text-slate-500">{row.event_type} · {formatDate(row.created_at)} · {row.status}</p>
          {row.status !== "sent" && row.error && <p className="mt-1 text-xs text-amber-800">{row.error}</p>}
        </div>
        {Number(row.recipient_user_id) === Number(user.id) && !row.read_at && <button type="button" onClick={() => markRead(row.id)} className="text-sm font-semibold text-sky-800 hover:underline">Mark read</button>}
      </article>)}</div>
    </section>
  );
}
