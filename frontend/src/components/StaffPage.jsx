import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

const CATEGORIES = [
  ["doctor", "Doctor"],
  ["nurse", "Nurse"],
  ["laboratory_staff", "Laboratory Staff"],
  ["pharmacist", "Pharmacist"],
  ["receptionist", "Receptionist"],
  ["accountant", "Accountant"],
  ["admin", "Administrator"],
  ["other_staff", "Other Staff"],
];
const EMPTY_FORM = {
  staff_number: "",
  full_name: "",
  email: "",
  phone: "",
  role: "receptionist",
  department_id: "",
  professional_registration_number: "",
  date_joined: new Date().toISOString().slice(0, 10),
  password: "",
  gender: "Other",
  specialization: "",
  consultation_fee: "",
};

function formatRole(role) {
  return CATEGORIES.find(([value]) => value === role)?.[1] || role;
}

export default function StaffPage() {
  const [staff, setStaff] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [resetUserId, setResetUserId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [passwordReset, setPasswordReset] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingStaffKey, setUpdatingStaffKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function reload() {
    setLoading(true);
    try {
      const [staffRows, userRows, departmentRows] = await Promise.all([
        api.list("staff"),
        api.list("users"),
        api.list("staff/departments"),
      ]);
      setStaff(staffRows);
      setUsers(userRows);
      setDepartments(departmentRows);
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    Promise.all([api.list("staff"), api.list("users"), api.list("staff/departments")])
      .then(([staffRows, userRows, departmentRows]) => {
        if (!active) return;
        setStaff(staffRows);
        setUsers(userRows);
        setDepartments(departmentRows);
      })
      .catch((loadError) => { if (active) setError(loadError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visibleStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    return staff.filter((member) => {
      const matchesSearch = !query || [
        member.full_name, member.email, member.staff_number, member.department,
      ].some((value) => String(value || "").toLowerCase().includes(query));
      const matchesCategory = !category || member.role === category;
      const matchesStatus = !status || (member.is_active ? "active" : "inactive") === status;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [staff, search, category, status]);

  function openCreateForm() {
    setSelected(null);
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setError("");
  }

  function openEditForm(member) {
    setSelected(null);
    setEditing(member);
    setForm({
      ...EMPTY_FORM,
      staff_number: member.staff_number || "",
      full_name: member.full_name || "",
      email: member.email || "",
      phone: member.phone || "",
      role: member.role,
      gender: member.gender || "Other",
      specialization: member.specialization || "",
      consultation_fee: member.consultation_fee ?? "",
      department_id: member.department_id || "",
      professional_registration_number: member.professional_registration_number || "",
      date_joined: member.date_joined ? String(member.date_joined).slice(0, 10) : "",
    });
    setShowForm(true);
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const payload = {
      ...form,
      department_id: form.department_id ? Number(form.department_id) : null,
      professional_registration_number: form.professional_registration_number.trim(),
      ...(editing ? { is_active: editing.is_active } : {}),
    };
    try {
      if (editing) {
        const profile = { ...payload };
        delete profile.staff_number;
        if (editing.role !== "doctor") {
          delete profile.gender;
          delete profile.specialization;
          delete profile.consultation_fee;
        }
        const creatingDoctorAccount = editing.role === "doctor" && !editing.user_id;
        if (creatingDoctorAccount) {
          profile.create_account = true;
        } else {
          delete profile.password;
        }
        await api.patch("staff", editing.staff_key, profile);
        setNotice("Staff profile updated.");
      } else {
        await api.create("staff", payload);
        setNotice("Staff member created.");
      }
      setShowForm(false);
      setEditing(null);
      setSelected(null);
      setForm(EMPTY_FORM);
      await reload();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(member) {
    setError("");
    setNotice("");
    setUpdatingStaffKey(member.staff_key);
    try {
      await api.patch("staff", member.staff_key, { is_active: !member.is_active });
      setNotice(`${member.full_name} ${member.is_active ? "deactivated" : "activated"}.`);
      setSelected(null);
      setEditing(null);
      setShowForm(false);
      await reload();
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setUpdatingStaffKey("");
    }
  }

  async function resetPassword(member) {
    if (!member.user_id) {
      setError("This doctor profile has no staff login account. Create an account before resetting its password.");
      return;
    }
    const newPassword = passwordReset[member.user_id] || "";
    setError("");
    try {
      await api.patch("users", member.user_id, { new_password: newPassword });
      setPasswordReset({ ...passwordReset, [member.user_id]: "" });
      setNotice("Password reset. The staff member must sign in again.");
    } catch (updateError) {
      setError(updateError.message);
    }
  }

  const staffRoleOptions = editing
    ? CATEGORIES.filter(([value]) => editing.role === "doctor" ? value === "doctor" : value !== "doctor")
    : CATEGORIES;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="font-[Manrope] text-lg font-bold text-slate-900">Staff directory</h2>
          <p className="mt-1 text-sm text-slate-500">Manage clinic employee profiles, access roles, departments, and employment status.</p>
        </div>
        <button type="button" onClick={openCreateForm} className="rounded-lg bg-sky-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-900">
          Add Staff
        </button>
      </section>

      {error && <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      {showForm && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-[Manrope] text-lg font-bold text-slate-900">{editing ? "Edit staff profile" : "Add staff member"}</h2>
              <p className="mt-1 text-sm text-slate-500">{editing ? "Update the staff member's profile and assigned permissions." : "Creates an individual staff login. Passwords are securely hashed by the backend."}</p>
            </div>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Close</button>
          </div>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="grid gap-1 text-xs font-semibold text-slate-600">Staff ID
              <input required={!editing && form.role === "doctor"} readOnly={Boolean(editing)} maxLength={30} pattern={form.staff_number ? "[A-Za-z0-9_-]{2,30}" : undefined} value={form.staff_number} onChange={(event) => setForm({ ...form, staff_number: event.target.value })} placeholder={form.role === "doctor" ? "e.g. DOC-001" : "Generated if left blank"} className="rounded-lg border border-slate-300 px-3 py-2 text-sm read-only:bg-slate-50" />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">Full name
              <input required maxLength={100} value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">Email
              <input required type="email" maxLength={100} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">Phone
              <input type="tel" maxLength={20} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">Staff category / role
              <select disabled={Boolean(editing?.role === "doctor")} required value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100">
                {staffRoleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">Department <span className="font-normal text-slate-400">(optional)</span>
              <select value={form.department_id} onChange={(event) => setForm({ ...form, department_id: event.target.value })} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                <option value="">Unassigned</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.department_name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">Professional registration number <span className="font-normal text-slate-400">(optional)</span>
              <input maxLength={100} value={form.professional_registration_number} onChange={(event) => setForm({ ...form, professional_registration_number: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">Date joined
              <input required type="date" value={form.date_joined} onChange={(event) => setForm({ ...form, date_joined: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            {(!editing || (editing.role === "doctor" && !editing.user_id)) && <label className="grid gap-1 text-xs font-semibold text-slate-600">{editing ? "Create login password (12+ characters)" : "Initial password (12+ characters)"}
              <input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>}
            {form.role === "doctor" && <>
              <label className="grid gap-1 text-xs font-semibold text-slate-600">Gender
                <select required={!editing} value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option>Male</option><option>Female</option><option>Other</option></select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-slate-600">Specialization
                <input required={!editing} maxLength={100} value={form.specialization} onChange={(event) => setForm({ ...form, specialization: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-slate-600">Consultation fee
                <input type="number" min="0" step="0.01" value={form.consultation_fee} onChange={(event) => setForm({ ...form, consultation_fee: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>
            </>}
            {editing && <label className="flex items-center gap-2 self-end rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
              <input type="checkbox" checked={Boolean(editing.is_active)} onChange={(event) => setEditing({ ...editing, is_active: event.target.checked })} />
              Employment active
            </label>}
            <div className="flex items-end gap-2">
              <button disabled={saving} className="rounded-lg bg-sky-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : editing ? "Save Changes" : "Create Staff"}</button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button>
            </div>
          </form>
          {editing?.is_active !== undefined && editing.is_active !== staff.find((row) => row.staff_key === editing.staff_key)?.is_active && (
            <p className="mt-3 text-xs text-slate-500">Employment status change will be saved with the profile.</p>
          )}
        </section>
      )}

      {selected && (
        <section className="rounded-xl border border-sky-200 bg-sky-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-[Manrope] font-bold text-slate-900">{selected.full_name}</h2>
              <p className="mt-1 text-sm text-slate-700">{selected.staff_number || "Staff ID not recorded"} · {formatRole(selected.role)}</p>
              <p className="mt-2 text-sm text-slate-600">{selected.email || "No email"} · {selected.phone || "No phone"}</p>
              <p className="text-sm text-slate-600">{selected.department || "No department"} · Joined {selected.date_joined ? String(selected.date_joined).slice(0, 10) : "date not recorded"}</p>
              {selected.professional_registration_number && <p className="text-sm text-slate-600">Registration: {selected.professional_registration_number}</p>}
              {selected.specialization && <p className="text-sm text-slate-600">Specialization: {selected.specialization}</p>}
              {selected.consultation_fee !== null && selected.consultation_fee !== undefined && <p className="text-sm text-slate-600">Consultation fee: {selected.consultation_fee}</p>}
              <p className="mt-1 text-sm font-semibold">{selected.is_active ? "Active" : "Inactive"}</p>
            </div>
            <button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-100">Close profile</button>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_180px]">
          <input aria-label="Search staff" placeholder="Search name, email, staff ID, or department" value={search} onChange={(event) => setSearch(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <select aria-label="Filter staff category" value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">All categories</option>{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select aria-label="Filter employment status" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-[Manrope] font-bold text-slate-900">Staff ({visibleStaff.length})</h2></div>
        {loading ? <p className="p-5 text-sm text-slate-500">Loading staff directory…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
                <th className="px-4 py-3">Staff ID</th><th className="px-4 py-3">Name / Email</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Employment</th><th className="px-4 py-3">Actions</th>
              </tr></thead>
              <tbody>{visibleStaff.map((member) => (
                <tr key={member.staff_key} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-mono text-xs">{member.staff_number || "—"}</td>
                  <td className="px-4 py-3"><div className="font-semibold text-slate-900">{member.full_name}</div><div className="text-xs text-slate-500">{member.email || "No email"}</div></td>
                  <td className="px-4 py-3">{member.phone || "—"}</td>
                  <td className="px-4 py-3">{formatRole(member.role)}</td>
                  <td className="px-4 py-3">{member.department || "—"}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${member.is_active ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{member.is_active ? "Active" : "Inactive"}</span></td>
                  <td className="px-4 py-3">
                    <div className="grid min-w-48 grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => { setShowForm(false); setEditing(null); setSelected(member); }}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        View profile
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditForm(member)}
                        className="rounded-md border border-sky-200 bg-sky-50 px-2.5 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-100"
                      >
                        {member.role === "doctor" && !member.user_id ? "Edit / Add login" : "Edit profile"}
                      </button>
                      <button
                        type="button"
                        disabled={updatingStaffKey === member.staff_key}
                        onClick={() => toggleActive(member)}
                        className={`col-span-2 rounded-md border px-2.5 py-2 text-xs font-semibold disabled:cursor-wait disabled:opacity-60 ${
                          member.is_active
                            ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                            : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                        }`}
                      >
                        {updatingStaffKey === member.staff_key
                          ? "Updating account…"
                          : member.is_active
                            ? "Deactivate account"
                            : "Activate account"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
            {!visibleStaff.length && !loading && <p className="p-5 text-sm text-slate-500">No staff match those filters.</p>}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-[Manrope] font-bold text-slate-900">Reset staff login password</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">Password reset requires at least 12 characters. Existing passwords are never displayed.</p>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <select aria-label="Staff account for password reset" value={resetUserId} onChange={(event) => setResetUserId(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">Select staff account</option>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name} · {formatRole(user.role)}</option>)}
          </select>
          <input aria-label="New password" type="password" minLength={12} maxLength={128} autoComplete="new-password" placeholder="New password (12+ characters)" value={passwordReset[resetUserId] || ""} onChange={(event) => setPasswordReset({ ...passwordReset, [resetUserId]: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button type="button" disabled={!resetUserId || (passwordReset[resetUserId] || "").length < 12} onClick={() => resetPassword({ user_id: Number(resetUserId) })} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40">Reset Password</button>
        </div>
      </section>

    </div>
  );
}
