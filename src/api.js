function getApiBase() {
  const configured = window.KARIBU_API_BASE || localStorage.getItem("karibu_api_base");
  if (configured) return configured.replace(/\/$/, "");

  const { protocol, hostname } = window.location;
  const isLocalPreview = ["localhost", "127.0.0.1", "0.0.0.0"].includes(hostname)
    || /^10\./.test(hostname)
    || /^192\.168\./.test(hostname)
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

  if (isLocalPreview) return `${protocol}//${hostname}:8000`;
  return "http://127.0.0.1:8000";
}

const BASE = getApiBase();
const TOKEN_KEY = "karibu_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, opts = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export const api = {
  auth: {
    register: (d) => request("/auth/register", { method: "POST", body: d }),
    login: (d) => request("/auth/login", { method: "POST", body: d }),
    me: () => request("/auth/me"),
  },
  listings: {
    list: (params = {}) => {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return request(`/listings${qs ? "?" + qs : ""}`);
    },
    create: (d) => request("/listings", { method: "POST", body: d }),
    saved: () => request("/listings/saved"),
    toggleSave: (id) => request(`/listings/${id}/save`, { method: "POST" }),
  },
  geo: {
    states: () => request("/geo/states"),
    cities: (params = {}) => {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return request(`/geo/cities${qs ? "?" + qs : ""}`);
    },
    citiesNear: (lat, lng, radius_km = 50) =>
      request(`/geo/cities/near?lat=${lat}&lng=${lng}&radius_km=${radius_km}`),
    rathaus: (params = {}) => {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return request(`/geo/rathaus${qs ? "?" + qs : ""}`);
    },
    rathausDetail: (id) => request(`/geo/rathaus/${id}`),
    verifyRathaus: (id) => request(`/geo/rathaus/${id}/verify`, { method: "POST" }),
    emergency: (params = {}) => {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return request(`/geo/emergency${qs ? "?" + qs : ""}`);
    },
  },
  community: {
    posts: (tab = "For You") =>
      request(`/community/posts?tab=${encodeURIComponent(tab)}`),
    createPost: (d) => request("/community/posts", { method: "POST", body: d }),
    like: (id) => request(`/community/posts/${id}/like`, { method: "POST" }),
    events: () => request("/community/events"),
    rsvp: (id) => request(`/community/events/${id}/rsvp`, { method: "POST" }),
  },
  checklist: {
    get: () => request("/checklist/me"),
    toggle: (taskKey) =>
      request("/checklist/toggle", { method: "POST", body: { task_key: taskKey } }),
  },
  messages: {
    list: () => request("/messages"),
    send: (d) => request("/messages", { method: "POST", body: d }),
  },
  bookings: {
    list: () => request("/bookings/me"),
    create: (d) => request("/bookings", { method: "POST", body: d }),
  },
  ai: {
    chat: (message, history) =>
      request("/ai/chat", { method: "POST", body: { message, history } }),
  },
  support: {
    createCase: (case_type, description, contact_pref) =>
      request("/support/cases", { method: "POST", body: { case_type, description, contact_pref } }),
    myCases: () => request("/support/cases/mine"),
  },
};
