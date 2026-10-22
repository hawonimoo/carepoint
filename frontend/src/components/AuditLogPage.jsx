import { useEffect, useState } from "react";
import { api } from "../api";
import { formatDate } from "../utils";

export default function AuditLogPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.list("audit-logs").then(setRows).catch((loadError) => setError(loadError.message)).finally(() => setLoading(false));
  }, []);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-[Manrope] font-bold text-slate-900">Sensitive activity</h2><p className="mt-1 text-sm text-slate-500">Audit metadata is restricted to administrators.</p></div>
      {loading && <p className="p-5 text-sm text-slate-500">Loading audit events…</p>}
      {error && <p role="alert" className="p-5 text-sm text-rose-700">{error}</p>}
      {!loading && !error && <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">When</th><th className="px-4 py-3">User</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Record</th><th className="px-4 py-3">Details</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id} className="border-t border-slate-100"><td className="whitespace-nowrap px-4 py-3">{formatDate(row.created_at)}</td><td className="px-4 py-3">{row.user_id ?? "System"}</td><td className="px-4 py-3">{row.action}</td><td className="px-4 py-3">{row.entity_type || "—"} {row.entity_id || ""}</td><td className="max-w-80 truncate px-4 py-3">{typeof row.metadata === "string" ? row.metadata : JSON.stringify(row.metadata || {})}</td></tr>)}</tbody>
      </table></div>}
    </section>
  );
}
