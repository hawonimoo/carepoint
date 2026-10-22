import { useEffect, useState } from "react";

function parseHash() {
  const [key, action] = window.location.hash.replace(/^#\/?/, "").split("/");
  return { key: key || "dashboard", action };
}

export default function useHashRoute() {
  const [route, setRoute] = useState(parseHash);

  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return route;
}
