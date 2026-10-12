import { useCallback, useEffect, useState } from "react";
import Dashboard from "./pages/Dashboard";
import ResourcePage from "./components/ResourcePage";
import { resourceByKey, resources } from "./config/resources";

// "#patients"      -> { key: "patients" }
// "#patients/new"  -> { key: "patients", action: "new" }  (opens the add form)
function parseHash() {
  const [key, action] = window.location.hash.replace(/^#\/?/, "").split("/");
  return { key: key || "dashboard", action };
}

function useHashRoute() {
  const [route, setRoute] = useState(parseHash);

  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return route;
}

const NAV = [{ key: "dashboard", title: "Dashboard" }, ...resources];

function App() {
  const route = useHashRoute();
  const resource = resourceByKey[route.key];
  const activeKey = resource ? route.key : "dashboard";

  // once the add form is open, turn "#patients/new" back into "#patients"
  // (replaceState doesn't fire hashchange, so nothing re-renders)
  const clearAction = useCallback(() => {
    window.history.replaceState(null, "", `#${route.key}`);
  }, [route.key]);

  return (
    <div className="min-h-screen bg-[#f5f7f6] text-slate-800 md:flex">
      <aside className="border-b border-sky-950 bg-sky-950 text-white md:min-h-screen md:w-64 md:shrink-0 md:border-b-0">
        <div className="flex items-center gap-3 px-5 py-5 md:px-7 md:pt-8">
          <span className="grid size-10 place-items-center rounded-xl bg-sky-400 text-lg font-bold text-sky-950">C</span>
          <div>
            <h2 className="font-[Manrope] text-lg font-extrabold tracking-normal">CarePoint</h2>
            <p className="mt-0.5 text-xs text-sky-200">Clinic Management</p>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:px-4 md:py-6">
          {NAV.map((item) => (
            <a
              key={item.key}
              href={`#${item.key}`}
              className={`shrink-0 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors md:w-full ${
                item.key === activeKey
                  ? "bg-sky-800 text-white"
                  : "text-sky-100 hover:bg-sky-900 hover:text-white"
              }`}
            >
              {item.title}
            </a>
          ))}
        </nav>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col px-4 pb-6 pt-5 sm:px-6 lg:px-10">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="font-[Manrope] text-2xl font-bold tracking-normal text-slate-900">
              {resource ? resource.title : "Dashboard"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {resource
                ? resource.description
                : "Welcome to your Clinic Management System."}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            <span className="grid size-7 place-items-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">A</span>
            Administrator
          </div>
        </header>

        {resource ? (
          <ResourcePage
            key={resource.key}
            resource={resource}
            startWithNew={route.action === "new"}
            onStartHandled={clearAction}
          />
        ) : (
          <Dashboard />
        )}

        <footer className="mt-auto border-t border-slate-200 pt-5 text-xs text-slate-400">
          CarePoint Clinic Management System
        </footer>
      </main>
    </div>
  );
}

export default App;