import { useEffect, useMemo } from "react";
import { ROLE_PAGES, ROLE_TITLES, canWrite } from "./auth";
import { resources } from "./config/resources";
import ClinicLayout from "./components/ClinicLayout";
import ResourcePage from "./components/ResourcePage";
import StaffPage from "./components/StaffPage";
import Consultation from "./pages/Consultation";
import PrescriptionsPage from "./components/PrescriptionsPage";
import LaboratoryOrdersPage from "./components/LaboratoryOrdersPage";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import useHashRoute from "./app/useHashRoute";
import useStaffSession from "./app/useStaffSession";

const EMPTY_PAGES = [];
const PAGE_TITLES = {
  dashboard: "Dashboard",
  staff: "Staff",
  consultations: "Consultations",
  prescriptions: "Prescriptions",
  "laboratory-orders": "Laboratory",
};

function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-teal-50 text-xl font-bold text-teal-700">C</div>
        <h2 className="font-semibold text-slate-800">CarePoint</h2>
        <p className="mt-2 text-sm text-slate-500">Checking your staff session...</p>
      </div>
    </main>
  );
}

export default function App() {
  const route = useHashRoute();
  const { auth, busy, login, logout } = useStaffSession();
  const role = auth.user?.role;
  const pageKeys = ROLE_PAGES[role] || EMPTY_PAGES;
  const allowedResources = useMemo(
    () => resources.filter((resource) => pageKeys.includes(resource.key)),
    [pageKeys]
  );
  const resource = allowedResources.find((entry) => entry.key === route.key);
  const isStaffPage = route.key === "staff" && pageKeys.includes("staff");
  const isConsultationPage = route.key === "consultations" && pageKeys.includes("consultations");
  const isPrescriptionsPage = route.key === "prescriptions" && pageKeys.includes("prescriptions");
  const isLaboratoryPage = route.key === "laboratory-orders" && pageKeys.includes("laboratory-orders");

  useEffect(() => {
    if (!auth.loading && auth.user && route.key !== "dashboard" &&
        !pageKeys.includes(route.key)) {
      window.location.hash = "#dashboard";
    }
  }, [auth.loading, auth.user, pageKeys, route.key]);

  async function handleLogin(email, password) {
    if (await login(email, password)) window.location.hash = "#dashboard";
  }

  async function handleLogout() {
    if (await logout()) window.location.hash = "";
  }

  if (auth.loading) return <LoadingScreen />;
  if (!auth.user) return <Login onLogin={handleLogin} error={auth.error} busy={busy} />;

  const navigation = [
    { key: "dashboard", title: "Dashboard", icon: "⌂" },
    ...allowedResources.map(({ key, title }) => ({
      key,
      title,
      icon: key === "patients" ? "♡" : "•",
    })),
    ...(pageKeys.includes("consultations")
      ? [{ key: "consultations", title: "Consultations", icon: "✚" }]
      : []),
    ...(pageKeys.includes("prescriptions")
      ? [{ key: "prescriptions", title: "Prescriptions", icon: "Rx" }]
      : []),
    ...(pageKeys.includes("laboratory-orders")
      ? [{ key: "laboratory-orders", title: "Laboratory", icon: "⚗" }]
      : []),
    ...(pageKeys.includes("staff")
      ? [{ key: "staff", title: "Staff", icon: "♙" }]
      : []),
  ];
  const activeKey = resource ? route.key : isStaffPage ? "staff" : isConsultationPage ? "consultations" : isPrescriptionsPage ? "prescriptions" : isLaboratoryPage ? "laboratory-orders" : "dashboard";
  const title = resource?.title || PAGE_TITLES[activeKey];
  const roleTitle = ROLE_TITLES[role] || role;

  let page;
  if (resource) {
    page = (
      <ResourcePage
        key={resource.key}
        resource={resource}
        role={role}
        canCreate={canWrite(role, resource.key, "create")}
      />
    );
  } else if (isStaffPage) {
    page = <StaffPage />;
  } else if (isConsultationPage) {
    page = <Consultation />;
  } else if (isPrescriptionsPage) {
    page = <PrescriptionsPage role={role} />;
  } else if (isLaboratoryPage) {
    page = <LaboratoryOrdersPage role={role} />;
  } else if (route.key === "dashboard") {
    page = (
      <Dashboard
        pages={pageKeys}
        onNavigate={(key) => { window.location.hash = `#${key}`; }}
      />
    );
  }

  return (
    <ClinicLayout
      user={auth.user}
      roleTitle={roleTitle}
      title={title}
      navigation={navigation}
      activeKey={activeKey}
      error={auth.error}
      onLogout={handleLogout}
    >
      {page}
    </ClinicLayout>
  );
}
