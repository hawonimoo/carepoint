import { useState } from "react";
import { api } from "../api";
import { lookupLabels } from "../config/resources";
import {
  isEmpty,
  nextCode,
  toInputDate,
  toInputTime,
  today,
  formatMoney,
} from "../utils";
import Badge from "./Badge";

const isNumeric = (field) =>
  field.type === "number" ||
  field.type === "lookup" ||
  field.format === "money" ||
  field.numeric === true;

function buildInitialValues(resource, record, rows, ctx) {
  const values = {};

  for (const field of resource.fields) {
    if (record) {
      const raw = record[field.name];

      if (field.type === "date") values[field.name] = toInputDate(raw);
      else if (field.type === "time") values[field.name] = toInputTime(raw);
      else values[field.name] = isEmpty(raw) ? "" : String(raw);
    } else if (field.code) {
      values[field.name] = nextCode(field.code, rows, field.name);
    } else if (field.defaultToday) {
      values[field.name] = today();
    } else {
      values[field.name] = field.default !== undefined ? String(field.default) : "";
    }
  }

  return resource.derive ? resource.derive(values, ctx) : values;
}

// Empty optional values go to the database as NULL (not "" or 0),
// which is what DATE columns, foreign keys and UNIQUE columns expect.
function buildPayload(resource, values) {
  const payload = {};

  for (const field of resource.fields) {
    const raw = values[field.name];

    if (isEmpty(raw) || (typeof raw === "string" && raw.trim() === "")) {
      payload[field.name] = null;
    } else if (isNumeric(field)) {
      payload[field.name] = Number(raw);
    } else {
      payload[field.name] = typeof raw === "string" ? raw.trim() : raw;
    }
  }

  return payload;
}

function FieldInput({ field, value, onChange, values, ctx }) {
  const id = `field-${field.name}`;

  if (field.type === "textarea") {
    return (
      <textarea
        id={id}
        rows={3}
        className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-700 focus:ring-2 focus:ring-sky-700/15"
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select
        id={id}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-700 focus:ring-2 focus:ring-sky-700/15"
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
      >
        <option value="">Select…</option>
        {field.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "suggest") {
    const options = field.optionsFrom
      ? (ctx.lookups[field.optionsFrom.endpoint] || []).map(field.optionsFrom.value)
      : field.options || [];

    return (
      <>
        <input
          id={id}
          type="text"
          list={`${id}-options`}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-700 focus:ring-2 focus:ring-sky-700/15"
          value={value}
          autoComplete="off"
          onChange={(e) => onChange(field.name, e.target.value)}
        />
        <datalist id={`${id}-options`}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </>
    );
  }

  if (field.type === "lookup") {
    const label = lookupLabels[field.lookup];
    const options = (ctx.lookups[field.lookup] || []).filter(
      (row) => !field.filter || field.filter(row, { values, record: ctx.record })
    );

    return (
      <select
        id={id}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-700 focus:ring-2 focus:ring-sky-700/15"
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
      >
        <option value="">
          {options.length === 0 ? `No ${field.lookup.replace(/-/g, " ")} available` : "Select…"}
        </option>
        {options.map((row) => (
          <option key={row.id} value={String(row.id)}>
            {label(row)}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "readonly") {
    return (
      <div className="flex min-h-10 items-center rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700" id={id}>
        {field.format === "badge" ? (
          <Badge value={value} />
        ) : field.format === "money" ? (
          formatMoney(value)
        ) : (
          value || "—"
        )}
      </div>
    );
  }

  return (
    <input
      id={id}
      type={field.type}
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-700 focus:ring-2 focus:ring-sky-700/15"
      value={value}
      min={field.min}
      step={field.step}
      onChange={(e) => onChange(field.name, e.target.value)}
    />
  );
}

export default function ResourceForm({
  resource,
  record,
  rows,
  lookups,
  onCancel,
  onSaved,
}) {
  const isEdit = Boolean(record);
  const ctx = { lookups, record, rows };

  const [values, setValues] = useState(() =>
    buildInitialValues(resource, record, rows, ctx)
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChange = (name, value) => {
    setValues((previous) => {
      const next = { ...previous, [name]: value };
      return resource.derive ? resource.derive(next, ctx) : next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const missing = resource.fields.filter(
      (field) =>
        field.required &&
        field.type !== "readonly" &&
        field.type !== "hidden" &&
        (isEmpty(values[field.name]) || String(values[field.name]).trim() === "")
    );

    if (missing.length > 0) {
      setError(`Please fill in: ${missing.map((f) => f.label).join(", ")}.`);
      return;
    }

    const problem = resource.validate ? resource.validate(values, ctx) : null;
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);

    try {
      const payload = buildPayload(resource, values);

      if (isEdit) {
        await api.update(resource.endpoint, record.id, payload);
      } else {
        await api.create(resource.endpoint, payload);
      }

      onSaved(`${resource.singular} ${isEdit ? "updated" : "added"} successfully.`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
        {resource.fields
          .filter((field) => field.type !== "hidden")
          .map((field) => (
            <div
              key={field.name}
              className={`flex min-w-0 flex-col gap-1.5 ${field.span === 2 ? "sm:col-span-2" : ""}`}
            >
              <label className="text-xs font-semibold text-slate-700" htmlFor={`field-${field.name}`}>
                {field.label}
                {field.required && <span className="text-rose-700"> *</span>}
              </label>

              <FieldInput
                field={field}
                value={values[field.name]}
                onChange={handleChange}
                values={values}
                ctx={ctx}
              />

              {field.hint && (
                <small className="text-xs leading-5 text-slate-500">{field.hint(values, ctx)}</small>
              )}
            </div>
          ))}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button type="button" className="rounded-lg bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-300 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="rounded-lg bg-sky-800 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-50" disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save Changes" : `Add ${resource.singular}`}
        </button>
      </div>
    </form>
  );
}