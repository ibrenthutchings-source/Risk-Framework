// api.jsx — thin fetch client for the ChainProof backend.
// Base URL: defaults to the production API, override with ?api=<url> for
// staging/local (e.g. ?api=https://api-staging-staging-0da5.up.railway.app).
const API_BASE = (() => {
  const qp = new URLSearchParams(window.location.search).get("api");
  return qp || "https://risk-framework-production.up.railway.app";
})();

const TOKEN_KEY = "chainproof_token";
function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }

class ApiError extends Error {
  constructor(status, body) {
    super((body && body.error) || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

// A 401 means the token is missing/expired/invalid — every call site would
// otherwise have to special-case that itself, so it's handled once here:
// clear the stale token and let the auth gate in app.jsx notice on its next
// render and fall back to the login screen.
async function apiFetch(path, opts = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, {
    method: opts.method || "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let body = null;
  try { body = await res.json(); } catch { /* no body / not JSON */ }
  if (!res.ok) {
    if (res.status === 401) setToken(null);
    throw new ApiError(res.status, body);
  }
  return body;
}

async function login(email, password) {
  const body = await apiFetch("/v1/auth/login", { method: "POST", body: { email, password } });
  setToken(body.token);
  return body;
}
function logout() { setToken(null); }

// Shared fetch-on-mount hook so every view doesn't hand-roll the same
// loading/error/data useEffect. `path` may be null to skip fetching (e.g.
// no engagement selected yet); it refetches whenever `path` changes.
// `reload()` forces a manual refetch (e.g. after a POST) without changing path.
function useApi(path) {
  const [state, setState] = React.useState({ data: null, loading: !!path, error: null });
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!path) { setState({ data: null, loading: false, error: null }); return; }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    apiFetch(path)
      .then((body) => { if (!cancelled) setState({ data: body.data, loading: false, error: null }); })
      .catch((err) => { if (!cancelled) setState({ data: null, loading: false, error: err }); });
    return () => { cancelled = true; };
  }, [path, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

Object.assign(window, { API_BASE, apiFetch, ApiError, login, logout, getToken, setToken, useApi });
