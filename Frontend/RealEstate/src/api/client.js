const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

function getStoredTokens() {
  try {
    const raw = localStorage.getItem('authTokens');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeTokens(tokens) {
  localStorage.setItem('authTokens', JSON.stringify(tokens));
}

export async function apiFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const tokens = getStoredTokens();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (tokens?.access) {
    headers.set('Authorization', `Bearer ${tokens.access}`);
  }

  const doFetch = () => fetch(url, { ...options, headers });

  let response = await doFetch();
  if (response.status !== 401) return response;

  // Try refresh flow
  if (!tokens?.refresh) return response;

  const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: tokens.refresh })
  });

  if (!refreshResponse.ok) return response; // refresh failed

  const refreshed = await refreshResponse.json();
  const newTokens = { ...tokens, access: refreshed.access };
  storeTokens(newTokens);

  headers.set('Authorization', `Bearer ${newTokens.access}`);
  response = await doFetch();
  return response;
}

export function saveAuthTokens(tokens) {
  storeTokens(tokens);
}

export function clearAuthTokens() {
  localStorage.removeItem('authTokens');
}

export function getAccessToken() {
  return getStoredTokens()?.access || null;
}

export async function loginApi(username, password) {
  const res = await fetch(`${API_BASE_URL}/api/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  if (!res.ok) {
    const data = await res.json().catch(()=>({}))
    throw new Error(data?.detail || 'Login failed')
  }
  return res.json()
}

export async function signupApi({ username, email, password }) {
  const res = await fetch(`${API_BASE_URL}/api/auth/signup/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password })
  })
  if (!res.ok) {
    const data = await res.json().catch(()=>({}))
    throw new Error(data?.detail || 'Signup failed')
  }
  return res.json()
}

export async function logoutApi() {
  const tokens = getStoredTokens()
  if (!tokens?.refresh) return
  await fetch(`${API_BASE_URL}/api/auth/logout/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(tokens?.access ? { Authorization: `Bearer ${tokens.access}` } : {}) },
    body: JSON.stringify({ refresh: tokens.refresh })
  })
}


