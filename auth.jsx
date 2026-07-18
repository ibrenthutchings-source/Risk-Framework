// auth.jsx — login screen shown when no valid token is present.
const { useState: useStateAuth } = React;

function LoginScreen({ onLoggedIn }) {
  const [email, setEmail] = useStateAuth("");
  const [password, setPassword] = useStateAuth("");
  const [error, setError] = useStateAuth(null);
  const [busy, setBusy] = useStateAuth(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      onLoggedIn();
    } catch (err) {
      setError(err.message || "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <svg width="26" height="26" viewBox="0 0 24 24">
            <path d="M12 2l8 5v10l-8 5-8-5V7z" fill="none" stroke="var(--accent)" strokeWidth="1.6" />
            <path d="M12 7l4 2.5v5L12 17l-4-2.5v-5z" fill="var(--accent)" opacity="0.25" />
            <circle cx="12" cy="12" r="1.6" fill="var(--accent)" />
          </svg>
          <div><div className="brand-name">CHAINPROOF</div><div className="brand-sub">Audit & Assurance</div></div>
        </div>

        <h1 className="login-title">Sign in</h1>
        <p className="login-sub">Enter your engagement credentials.</p>

        <label className="login-field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
        </label>
        <label className="login-field">
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>

        {error && <div className="login-error"><Icon path={ICONS.alert} size={14} />{error}</div>}

        <button className="login-submit" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>

        <div className="login-hint">
          No account yet? Users are created via <code className="mono">npm run seed:user</code> — there's no self-service signup.
        </div>
      </form>
    </div>
  );
}

Object.assign(window, { LoginScreen });
