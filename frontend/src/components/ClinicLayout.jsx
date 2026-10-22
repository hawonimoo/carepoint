export default function ClinicLayout({
  user,
  roleTitle,
  title,
  navigation,
  activeKey,
  error,
  onLogout,
  children,
}) {
  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-800 md:flex">
      <aside className="flex shrink-0 flex-col border-b border-slate-200 bg-white md:min-h-screen md:w-64 md:border-b-0 md:border-r">
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-6">
          <div className="grid size-11 place-items-center rounded-xl bg-teal-600 text-xl font-bold text-white">C</div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">CarePoint</h2>
            <p className="text-xs text-slate-500">Clinic Management</p>
          </div>
        </div>
        <nav className="flex gap-2 overflow-x-auto p-4 md:flex-1 md:flex-col" aria-label="Main navigation">
          <p className="hidden px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400 md:block">Main Menu</p>
          {navigation.map((item) => {
            const active = item.key === activeKey;
            return (
              <a
                key={item.key}
                href={`#${item.key}`}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                  active ? "bg-teal-50 text-teal-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className={`grid size-8 place-items-center rounded-lg text-lg ${active ? "bg-teal-100" : "bg-slate-100"}`}>{item.icon}</span>
                <span>{item.title}</span>
                {active && <span className="ml-auto size-1.5 rounded-full bg-teal-600" />}
              </a>
            );
          })}
        </nav>
        <div className="hidden border-t border-slate-100 p-5 md:block">
          <p className="text-xs text-slate-400">CarePoint Clinic System</p>
          <p className="mt-1 text-xs font-medium text-slate-500">Secure staff workspace</p>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col md:h-screen md:overflow-y-auto">
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-8">
          <div>
            <p className="mb-1 text-xs font-medium text-slate-400">CarePoint / {title}</p>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-800">{user.fullName}</p>
              <p className="text-xs text-slate-500">{roleTitle}</p>
            </div>
            <div className="grid size-10 place-items-center rounded-full bg-teal-100 font-bold text-teal-800">{user.fullName?.slice(0, 1).toUpperCase()}</div>
            <button type="button" onClick={onLogout} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700">Log out</button>
          </div>
        </header>
        <div className="flex flex-1 flex-col p-5 sm:p-8">
          {error && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
          <div className="flex-1">{children}</div>
          <footer className="mt-10 border-t border-slate-200 pt-5 text-xs text-slate-400">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p>© {new Date().getFullYear()} CarePoint Clinic Management System</p>
              <p>Staff access is managed by role-based permissions.</p>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
