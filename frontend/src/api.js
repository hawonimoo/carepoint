
const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Convert database errors into friendly messages.
function friendly(message, detail) {
  const text = `${detail || ""} ${message || ""}`;

  if (/Duplicate entry/i.test(text)) {
    const value = text.match(/Duplicate entry '([^']*)'/i)?.[1];

    return `That value already exists${value ? ` (${value})` : ""}. Each number/email must be unique.`;
  }

  if (/foreign key constraint fails/i.test(text)) {
    return /DELETE|delete/i.test(message || "")
      ? "This record is used by other records, so it cannot be deleted yet. Remove or reassign those records first."
      : "One of the selected patients, doctors, appointments, or invoices no longer exists.";
  }

  if (/cannot be null|doesn't have a default value/i.test(text)) {
    const column =
      text.match(/Column '([^']+)'/i)?.[1] ||
      text.match(/Field '([^']+)'/i)?.[1];

    return `A required value is missing${
      column ? `: ${column.replace(/_/g, " ")}` : ""
    }.`;
  }

  if (/Incorrect (date|time|datetime|decimal|integer)/i.test(text)) {
    return "One of the values has the wrong format. Check dates, times, and numbers.";
  }

  if (/Data truncated/i.test(text)) {
    const column = text.match(/column '([^']+)'/i)?.[1];

    return `That value isn't allowed${
      column ? ` for ${column.replace(/_/g, " ")}` : ""
    }. Choose an accepted option.`;
  }

  return null;
}

// Send requests to the backend.
async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${BASE}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CarePoint-Request": "1",
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      "Cannot reach the server. Make sure the backend is running."
    );
  }

  let data;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.message || `Request failed (${response.status})`;

    const missing = Array.isArray(data?.missingFields)
      ? data.missingFields
          .map((field) => field.replace(/_/g, " "))
          .join(", ")
      : "";

    const friendlyText = friendly(message, data?.error);

    const error = new Error(
      friendlyText ||
        `${message}${missing ? `: ${missing}` : ""}${
          data?.error ? ` (${data.error})` : ""
        }`
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

// Public API methods.
export const api = {
  login: (email, password) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),
  // Get all records.
  list: (endpoint) => request(`/${endpoint}`),

  // Get one record.
  get: (endpoint, id) =>
    request(`/${endpoint}/${encodeURIComponent(id)}`),

  // Create a record.
  create: (endpoint, body) =>
    request(`/${endpoint}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Update a record.
  update: (endpoint, id, body) =>
    request(`/${endpoint}/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  patch: (endpoint, idOrBody, maybeBody) => {
    const hasExplicitId = maybeBody !== undefined;
    const path = hasExplicitId
      ? `/${endpoint}/${encodeURIComponent(idOrBody)}`
      : `/${endpoint}`;
    const payload = hasExplicitId ? maybeBody : idOrBody;
    return request(path, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  // Delete a record.
  remove: (endpoint, id) =>
    request(`/${endpoint}/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  markNotificationRead: (id) =>
    request(`/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" }),
};
