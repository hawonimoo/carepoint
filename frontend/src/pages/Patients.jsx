export default function Patients({ onNavigate }) {
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <button
        onClick={() => onNavigate("dashboard")}
        className="mb-6 text-sm font-semibold text-sky-700 hover:underline"
      >
        ← Back to Dashboard
      </button>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">
            Patient Management
          </h1>

          <p className="mt-2 text-slate-500">
            Manage patient registration and information.
          </p>
        </div>

        <button
          className="rounded-lg bg-sky-700 px-5 py-3 font-semibold text-white hover:bg-sky-800"
        >
          + Register Patient
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <input
          type="search"
          placeholder="Search patients..."
          className="mb-5 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-sky-500 md:max-w-md"
        />

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-4">Patient ID</th>
                <th className="p-4">Full Name</th>
                <th className="p-4">Gender</th>
                <th className="p-4">Phone</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td colSpan="5" className="p-10 text-center text-slate-500">
                  No patient records to display yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}