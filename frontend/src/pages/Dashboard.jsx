const PAGE_CARDS = {
  staff: {
    title: "Staff",
    description: "Manage staff profiles, roles, and individual login accounts.",
    icon: "👥",
    action: "Open Staff",
  },
  patients: {
    title: "Patients",
    description: "Open the patient management workspace.",
    icon: "🏥",
    action: "Open Patients",
  },
  consultations: {
    title: "Consultations",
    description: "Record and review consultations for your assigned patients.",
    icon: "🩺",
    action: "Open Consultations",
  },
  prescriptions: {
    title: "Prescriptions",
    description: "Write patient prescriptions or process the Pharmacy queue.",
    icon: "💊",
    action: "Open Prescriptions",
  },
  "laboratory-orders": {
    title: "Laboratory",
    description: "Request tests or process laboratory orders and results.",
    icon: "🧪",
    action: "Open Laboratory",
  },
  medicines: {
    title: "Medicine Inventory",
    description: "Review pharmacy medicine inventory and availability.",
    icon: "📦",
    action: "Open Inventory",
  },
};

export default function Dashboard({ pages, onNavigate }) {
  const cards = pages.filter((page) => PAGE_CARDS[page]).map((page) => ({
    key: page,
    ...PAGE_CARDS[page],
  }));

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <header className="mb-8">
        <p className="text-sm font-semibold text-sky-700">
          CAREPOINT
        </p>

        <h1 className="mt-2 text-3xl font-bold text-slate-800">
          Clinic Dashboard
        </h1>

        <p className="mt-2 text-slate-500">
          Your available workspace is based on your staff role.
        </p>
      </header>

      {cards.length ? (
        <div className="grid gap-6 md:grid-cols-2">
          {cards.map((card) => (
            <button
              key={card.key}
              onClick={() => onNavigate(card.key)}
              className="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-sky-400 hover:shadow-md"
            >
              <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-sky-100 text-2xl">{card.icon}</div>
              <h2 className="text-xl font-bold text-slate-800">{card.title}</h2>
              <p className="mt-2 text-sm text-slate-500">{card.description}</p>
              <p className="mt-5 font-semibold text-sky-700">{card.action} →</p>
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No additional pages are enabled for this staff role yet.
        </p>
      )}
    </div>
  );
}