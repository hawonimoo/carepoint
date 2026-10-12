// Shown in front of every money amount. Set it to e.g. "KES " or "$" if you want one.
export const CURRENCY = "";

const pad = (n) => String(n).padStart(2, "0");

export const isEmpty = (v) => v === "" || v === null || v === undefined;

export const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Today as YYYY-MM-DD in the user's own timezone
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const toInputDate = (value) => (value ? String(value).slice(0, 10) : "");
export const toInputTime = (value) => (value ? String(value).slice(0, 5) : "");

export function formatDate(value) {
  if (!value) return "—";
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return String(value);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(value) {
  if (!value) return "—";
  const [h, m] = String(value).split(":").map(Number);
  if (Number.isNaN(h)) return String(value);
  return new Date(2000, 0, 1, h, m || 0).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatMoney(value) {
  if (isEmpty(value)) return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return (
    CURRENCY +
    n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function calcAge(dob) {
  if (!dob) return "—";
  const [y, m, d] = String(dob).slice(0, 10).split("-").map(Number);
  if (!y) return "—";
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) {
    age -= 1;
  }
  return age >= 0 ? `${age} yrs` : "—";
}

// Suggest the next code by following whatever pattern already exists,
// e.g. PAT-0007 -> PAT-0008, LAB001 -> LAB002. Falls back to <prefix>001.
export function nextCode(defaultPrefix, rows, field) {
  let best = null;

  for (const row of rows) {
    const match = String(row[field] ?? "").match(/^(.*?)(\d+)$/);
    if (!match) continue;

    const num = Number(match[2]);
    if (!best || num > best.num) {
      best = { prefix: match[1], num, width: match[2].length };
    }
  }

  if (!best) return `${defaultPrefix}001`;
  return `${best.prefix}${String(best.num + 1).padStart(best.width, "0")}`;
}

export function badgeTone(value) {
  const v = String(value ?? "").toLowerCase();

  if (["active", "completed", "paid", "available"].includes(v)) return "good";
  if (["pending", "partially paid", "low stock"].includes(v)) return "warn";
  if (["scheduled", "in progress", "confirmed"].includes(v)) return "info";
  if (
    ["cancelled", "canceled", "inactive", "unpaid", "expired", "out of stock", "no show"].includes(v)
  ) {
    return "bad";
  }
  return "neutral";
}

// Days from today until a YYYY-MM-DD date (negative = already past)
export function daysUntil(value) {
  if (!value) return null;
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  if (!y) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d) - start) / 86400000);
}

export const LOW_STOCK_LEVEL = 10;
export const EXPIRY_WARNING_DAYS = 90;