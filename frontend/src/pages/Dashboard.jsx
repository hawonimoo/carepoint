import { useEffect, useState } from "react";
import { api } from "../api";
import Badge from "../components/Badge";
import {
  EXPIRY_WARNING_DAYS,
  LOW_STOCK_LEVEL,
  daysUntil,
  formatDate,
  formatMoney,
  formatTime,
  toNumber,
  today,
} from "../utils";

const SOURCES = [
  "patients",
  "doctors",
  "appointments",
  "payments",
  "invoices",
  "medicines",
  "laboratory-tests",
];

const sum = (rows, key) => rows.reduce((total, row) => total + toNumber(row[key]), 0);

export default function Dashboard() {
  const [state, setState] = useState({ loading: true, lists: {}, failed: [] });

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled(SOURCES.map((name) => api.list(name))).then((results) => {
      if (cancelled) return;

      const lists = {};
      const failed = [];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") lists[SOURCES[index]] = result.value;
        else failed.push(SOURCES[index]);
      });

      setState({ loading: false, lists, failed });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const { loading, lists, failed } = state;
  const allFailed = !loading && failed.length === SOURCES.length;

  const patients = lists.patients || [];
  const doctors = lists.doctors || [];
  const appointments = lists.appointments || [];
  const payments = lists.payments || [];
  const invoices = lists.invoices || [];
  const medicines = lists.medicines || [];
  const labTests = lists["laboratory-tests"] || [];

  const todayKey = today();
  const todaysAppointments = appointments.filter(
    (a) => String(a.appointment_date).slice(0, 10) === todayKey
  );
  const upcoming = appointments
    .filter(
      (a) =>
        String(a.appointment_date).slice(0, 10) >= todayKey &&
        !["completed", "cancelled", "canceled"].includes(String(a.status).toLowerCase())
    )
    .sort((a, b) =>
      `${a.appointment_date} ${a.appointment_time}`.localeCompare(
        `${b.appointment_date} ${b.appointment_time}`
      )
    )
    .slice(0, 6);

  const unpaidInvoices = invoices.filter((i) => toNumber(i.balance) > 0);
  const pendingTests = labTests.filter(
    (t) => String(t.status).toLowerCase() !== "completed"
  );
  const medicineAlerts = medicines.filter((m) => {
    const days = daysUntil(m.expiry_date);
    return (
      toNumber(m.quantity) <= LOW_STOCK_LEVEL ||
      (days !== null && days <= EXPIRY_WARNING_DAYS)
    );
  });

  // shows "—" for a card whose request failed, "…" while loading
  const show = (source, value) =>
    loading ? "…" : failed.includes(source) ? "—" : value;

  const cards = [
    { label: "Patients", value: show("patients", patients.length), note: "Total registered patients" },
    { label: "Doctors", value: show("doctors", doctors.length), note: "Registered doctors" },
    {
      label: "Appointments",
      value: show("appointments", todaysAppointments.length),
      note: `Today · ${show("appointments", appointments.length)} in total`,
    },
    {
      label: "Payments",
      value: show("payments", formatMoney(sum(payments, "amount"))),
      note: `Collected · ${show("payments", payments.length)} payments`,
    },
    {
      label: "Outstanding",
      value: show("invoices", formatMoney(sum(invoices, "balance"))),
      note: `${show("invoices", unpaidInvoices.length)} unpaid invoices`,
    },
    {
      label: "Pending Lab Tests",
      value: show("laboratory-tests", pendingTests.length),
      note: "Not yet completed",
    },
    {
      label: "Medicine Alerts",
      value: show("medicines", medicineAlerts.length),
      note: "Low stock or expiring soon",
    },
    {
      label: "Invoices",
      value: show("invoices", invoices.length),
      note: "Total invoices raised",
    },
  ];

  return (
    <>
      <section className="mb-6 flex items-center justify-between gap-4 overflow-hidden rounded-xl bg-sky-900 px-5 py-6 text-white sm:px-7">
        <div>
          <h2 className="font-[Manrope] text-xl font-bold tracking-normal sm:text-2xl">Your clinic, organized.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-sky-100">
            Manage patients, doctors, appointments, and clinic services in one place.
          </p>
        </div>
        <span className="hidden size-16 shrink-0 place-items-center rounded-full border border-sky-700 bg-sky-800 text-3xl text-sky-200 sm:grid">✚</span>
      </section>

      {allFailed && (
        <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <p>
            Could not connect to the backend. Start it with <code>npm run dev</code> in the
            backend folder, then refresh this page.
          </p>
        </div>
      )}

      {!allFailed && failed.length > 0 && (
        <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <p>Some figures could not be loaded: {failed.join(", ")}.</p>
        </div>
      )}

      <section className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" key={card.label}>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</span>
            <h2 className="mt-2 truncate font-[Manrope] text-2xl font-bold tracking-normal text-slate-900">{card.value}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">{card.note}</p>
          </div>
        ))}
      </section>

      <div className="mb-7 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="font-[Manrope] text-base font-bold tracking-normal text-slate-900">Upcoming Appointments</h2>
          <p className="mb-4 mt-1 text-sm text-slate-500">Next scheduled visits.</p>

          {upcoming.length === 0 ? (
            <p className="py-5 text-sm text-slate-500">{loading ? "Loading…" : "No upcoming appointments."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm [&_th]:whitespace-nowrap [&_th]:bg-slate-50 [&_th]:px-2.5 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:text-slate-500 [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-2.5 [&_td]:py-3 [&_tbody_tr:hover]:bg-slate-50">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((a) => (
                    <tr key={a.id}>
                      <td>
                        {formatDate(a.appointment_date)} · {formatTime(a.appointment_time)}
                      </td>
                      <td>{a.patient_name}</td>
                      <td>{a.doctor_name}</td>
                      <td>
                        <Badge value={a.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="font-[Manrope] text-base font-bold tracking-normal text-slate-900">Recent Payments</h2>
          <p className="mb-4 mt-1 text-sm text-slate-500">Latest money received.</p>

          {payments.length === 0 ? (
            <p className="py-5 text-sm text-slate-500">{loading ? "Loading…" : "No payments recorded yet."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm [&_th]:whitespace-nowrap [&_th]:bg-slate-50 [&_th]:px-2.5 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:text-slate-500 [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-2.5 [&_td]:py-3 [&_tbody_tr:hover]:bg-slate-50">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Patient</th>
                    <th>Method</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.slice(0, 6).map((p) => (
                    <tr key={p.id}>
                      <td>{formatDate(p.payment_date)}</td>
                      <td>{p.patient_name}</td>
                      <td>{p.payment_method}</td>
                      <td className="text-right tabular-nums">{formatMoney(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="font-[Manrope] text-base font-bold tracking-normal text-slate-900">Quick Actions</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">Choose an action to continue managing your clinic.</p>

        <div className="flex flex-wrap gap-2">
          <a className="rounded-lg bg-sky-800 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-900" href="#patients/new">+ Register Patient</a>
          <a className="rounded-lg bg-sky-800 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-900" href="#appointments/new">+ Book Appointment</a>
          <a className="rounded-lg bg-sky-800 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-900" href="#doctors/new">+ Add Doctor</a>
          <a className="rounded-lg bg-sky-800 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-900" href="#invoices/new">+ Create Invoice</a>
          <a className="rounded-lg bg-sky-800 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-900" href="#payments/new">+ Record Payment</a>
        </div>
      </section>
    </>
  );
}