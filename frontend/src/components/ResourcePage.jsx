import { useEffect, useState } from "react";
import { api } from "../api";
import { lookupEndpointsFor } from "../config/resources";
import {
  EXPIRY_WARNING_DAYS,
  LOW_STOCK_LEVEL,
  calcAge,
  daysUntil,
  formatDate,
  formatMoney,
  formatTime,
  isEmpty,
} from "../utils";
import Badge from "./Badge";
import Modal from "./Modal";
import ResourceForm from "./ResourceForm";

function renderCell(column, row, ctx) {
  if (column.render) return column.render(row, ctx);

  const value = row[column.key];

  switch (column.type) {
    case "date":
      return formatDate(value);
    case "time":
      return formatTime(value);
    case "money":
      return formatMoney(value);
    case "age":
      return calcAge(value);
    case "badge":
      return <Badge value={value} />;
    case "stock": {
      const quantity = Number(value);
      return quantity <= LOW_STOCK_LEVEL ? (
        <span className="inline-flex whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">{quantity} · low</span>
      ) : (
        quantity
      );
    }
    case "expiry": {
      if (!value) return "—";
      const days = daysUntil(value);
      if (days !== null && days < 0) {
        return (
          <>
            {formatDate(value)} <span className="inline-flex whitespace-nowrap rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800">Expired</span>
          </>
        );
      }
      if (days !== null && days <= EXPIRY_WARNING_DAYS) {
        return (
          <>
            {formatDate(value)} <span className="inline-flex whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">{days}d left</span>
          </>
        );
      }
      return formatDate(value);
    }
    default:
      return isEmpty(value) ? "—" : String(value);
  }
}

export default function ResourcePage({ resource, startWithNew = false, onStartHandled }) {
  const [rows, setRows] = useState([]);
  const [lookups, setLookups] = useState({});
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState(
    startWithNew ? { record: null } : null
  );
  const [toDelete, setToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");

  // Load this module's rows plus anything its dropdowns need
  useEffect(() => {
    let cancelled = false;
    const lookupEndpoints = lookupEndpointsFor(resource);

    Promise.all([
      api.list(resource.endpoint),
      ...lookupEndpoints.map((endpoint) => api.list(endpoint)),
    ])
      .then(([main, ...others]) => {
        if (cancelled) return;
        setRows(main);
        setLookups(
          Object.fromEntries(lookupEndpoints.map((e, i) => [e, others[i]]))
        );
        setStatus({ loading: false, error: "" });
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus({ loading: false, error: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, [resource, reloadKey]);

  // let the parent drop "/new" from the address bar once the form has opened
  useEffect(() => {
    if (startWithNew && onStartHandled) onStartHandled();
  }, [startWithNew, onStartHandled]);

  // auto-hide the success message
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const reload = () => setReloadKey((key) => key + 1);

  const query = search.trim().toLowerCase();
  const visibleRows = query
    ? rows.filter((row) =>
        Object.values(row).join(" ").toLowerCase().includes(query)
      )
    : rows;

  const ctx = { lookups };

  const handleSaved = (message) => {
    setEditor(null);
    setNotice(message);
    reload();
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError("");

    try {
      await api.remove(resource.endpoint, toDelete.id);
      setNotice(`${resource.singular} deleted.`);
      setToDelete(null);
      reload();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="mb-7 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-[Manrope] text-lg font-bold tracking-normal text-slate-900">{resource.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{resource.description}</p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg bg-sky-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => setEditor({ record: null })}
          disabled={status.loading || Boolean(status.error)}
        >
          + New {resource.singular}
        </button>
      </div>

      {notice && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{notice}</div>}

      {status.loading && <p className="py-5 text-sm text-slate-500">Loading {resource.title.toLowerCase()}…</p>}

      {status.error && (
        <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <p>{status.error}</p>
          <button
            type="button"
            className="mt-2 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-300 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              setStatus({ loading: true, error: "" });
              reload();
            }}
          >
            Try again
          </button>
        </div>
      )}

      {!status.loading && !status.error && (
        <>
          <div className="mb-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <input
              type="search"
              className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-700 focus:ring-2 focus:ring-sky-700/15"
              placeholder={`Search ${resource.title.toLowerCase()}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={`Search ${resource.title}`}
            />
            <span className="text-xs font-medium text-slate-500">
              {query
                ? `${visibleRows.length} of ${rows.length}`
                : `${rows.length} total`}
            </span>
          </div>

          {rows.length === 0 ? (
            <p className="py-5 text-sm text-slate-500">
              No {resource.title.toLowerCase()} yet. Click “+ New {resource.singular}” to add the first one.
            </p>
          ) : visibleRows.length === 0 ? (
            <p className="py-5 text-sm text-slate-500">Nothing matches “{search}”.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm [&_th]:whitespace-nowrap [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-3 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:text-slate-500 [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-3 [&_tbody_tr:hover]:bg-slate-50">
                <thead>
                  <tr>
                    {resource.columns.map((column) => (
                      <th key={column.key}>{column.label}</th>
                    ))}
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.id}>
                      {resource.columns.map((column) => (
                        <td
                          key={column.key}
                          className={column.truncate ? "max-w-60 truncate" : undefined}
                          title={column.truncate && row[column.key] ? String(row[column.key]) : undefined}
                        >
                          {renderCell(column, row, ctx)}
                        </td>
                      ))}
                      <td className="whitespace-nowrap text-right">
                        <button
                          type="button"
                          className="rounded-md px-2 py-1 text-sm font-semibold text-sky-800 transition hover:bg-sky-50"
                          onClick={() => setEditor({ record: row })}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded-md px-2 py-1 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                          onClick={() => {
                            setDeleteError("");
                            setToDelete(row);
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {editor && !status.loading && !status.error && (
        <Modal
          wide
          title={editor.record ? `Edit ${resource.singular}` : `New ${resource.singular}`}
          onClose={() => setEditor(null)}
        >
          <ResourceForm
            resource={resource}
            record={editor.record}
            rows={rows}
            lookups={lookups}
            onCancel={() => setEditor(null)}
            onSaved={handleSaved}
          />
        </Modal>
      )}

      {toDelete && (
        <Modal title={`Delete ${resource.singular}?`} onClose={() => setToDelete(null)}>
          <p className="text-sm leading-6 text-slate-600">
            This will permanently delete <strong>{resource.deleteLabel(toDelete)}</strong>.
            This can’t be undone.
          </p>

          {deleteError && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
              {deleteError}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-300 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setToDelete(null)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-rose-700 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}