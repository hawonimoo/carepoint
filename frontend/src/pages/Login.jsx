import { useState } from "react";

export default function Login({ onLogin, error, busy }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function submit(event) {
    event.preventDefault();
    onLogin(email, password);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-sky-50 via-white to-teal-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-xl sm:p-9">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-xl bg-sky-800 text-xl font-extrabold text-white">C</span>
          <div>
            <h1 className="font-[Manrope] text-2xl font-extrabold text-slate-900">CarePoint</h1>
            <p className="text-sm text-slate-500">Staff sign in</p>
          </div>
        </div>
        <h2 className="font-[Manrope] text-xl font-bold text-slate-900">Welcome back</h2>
        <p className="mb-6 mt-1 text-sm text-slate-500">Use your clinic-issued staff account.</p>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700" htmlFor="login-email">
            Email
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              required
              maxLength={100}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-sky-700 focus:ring-2 focus:ring-sky-700/15"
            />
          </label>
          <div>
            <label className="block text-sm font-semibold text-slate-700" htmlFor="login-password">
              Password
            </label>
            <div className="relative mt-1.5">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-20 font-normal outline-none focus:border-sky-700 focus:ring-2 focus:ring-sky-700/15"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-0 rounded-r-lg px-3 text-sm font-semibold text-sky-800 hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-700"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-800">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-sky-800 px-4 py-3 font-semibold text-white transition hover:bg-sky-900 disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in securely"}
          </button>
        </form>
        <p className="mt-6 text-xs leading-5 text-slate-500">Accounts are created by an administrator. Staff registration is not public.</p>
      </section>
    </main>
  );
}
