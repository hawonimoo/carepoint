import { useEffect, useState } from "react";
import { api } from "../api";

export default function useStaffSession() {
  const [auth, setAuth] = useState({ loading: true, user: null, error: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api.me()
      .then(({ user }) => {
        if (active) setAuth({ loading: false, user, error: "" });
      })
      .catch((error) => {
        if (active) {
          setAuth({
            loading: false,
            user: null,
            error: error.status === 401 ? "" : error.message,
          });
        }
      });
    return () => { active = false; };
  }, []);

  async function login(email, password) {
    setBusy(true);
    setAuth((current) => ({ ...current, error: "" }));
    try {
      const { user } = await api.login(email, password);
      setAuth({ loading: false, user, error: "" });
      return true;
    } catch (error) {
      setAuth((current) => ({ ...current, error: error.message }));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await api.logout();
      setAuth({ loading: false, user: null, error: "" });
      return true;
    } catch (error) {
      setAuth((current) => ({ ...current, error: error.message }));
      return false;
    }
  }

  return { auth, busy, login, logout };
}
