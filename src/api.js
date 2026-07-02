import { API_BASE } from "./config.js";

const BASE = API_BASE;
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
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opts.headers,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new Error(`Could not reach Karibu API at ${BASE}. Check that the backend is running and this browser can access that host.`);
  }

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
    updateMe: (d) => request("/auth/me", { method: "PATCH", body: d }),
    updateProfilePhoto: (d) => request("/auth/me/profile-photo", { method: "PATCH", body: d }),
    settings: () => request("/auth/me/settings"),
    updateSettings: (d) => request("/auth/me/settings", { method: "PUT", body: d }),
    verification: () => request("/auth/me/verification"),
    createVerification: (d) => request("/auth/me/verification", { method: "POST", body: d }),
    summary: () => request("/auth/me/summary"),
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
    rathausSearch: (params = {}) => {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return request(`/geo/rathaus/search${qs ? "?" + qs : ""}`);
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
    posts: (tab = "For You", sort = "newest") =>
      request(`/community/posts?tab=${encodeURIComponent(tab)}&sort=${encodeURIComponent(sort)}`),
    createPost: (d) => request("/community/posts", { method: "POST", body: d }),
    like: (id) => request(`/community/posts/${id}/like`, { method: "POST" }),
    comments: (id) => request(`/community/posts/${id}/comments`),
    createComment: (id, d) => request(`/community/posts/${id}/comments`, { method: "POST", body: d }),
    events: () => request("/community/events"),
    createEvent: (d) => request("/community/events", { method: "POST", body: d }),
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
