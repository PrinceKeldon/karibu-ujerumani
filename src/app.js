import { api, getToken, setToken, clearToken } from "./api.js?v=api-refresh-20260703";

// ── Screens ───────────────────────────────────────────────────
const screens = {
  splash: "splash",
  login: "login",
  register: "register",
  home: "home",
  search: "search",
  detail: "detail",
  listRoom: "listRoom",
  assistant: "assistant",
  checklist: "checklist",
  community: "community",
  messages: "messages",
  bookings: "bookings",
  profile: "profile",
  rathaus: "rathaus",
  emergency: "emergency",
  admin: "admin",
};

// ── State ─────────────────────────────────────────────────────
let state = {
  screen: screens.splash,
  user: null,

  // API-loaded data
  listings: [],
  savedIds: new Set(),
  communityPosts: [],
  events: [],
  announcements: [],
  bookings: [],
  conversations: [],
  checklistDone: new Set(),
  profileSummary: null,
  profileSettings: null,
  verificationRequests: [],
  detailListing: null,
  states: [],
  cities: [],
  selectedCity: null,
  locationStatus: "Berlin fallback",
  listingFallback: false,
  emergencyData: null,

  // UI state
  communityTab: "For You",
  communitySort: "newest",
  bookingsTab: "Upcoming",
  checklistExpanded: false,
  rathausQuery: { address: "", postcode: "" },
  rathausResults: [],
  rathausUserCoords: null,
  rathausLoading: false,
  rathausSearchLabel: "",
  messagesLoaded: false,
  profileLoaded: false,
  emergencyType: "All",
  listRoomAmenities: [],
  listRoomLocation: null,
  signupLocation: null,
  searchQuery: "",
  scrollPositions: {},
  messages: [],
  sheet: null,
  carousel: null,
  toast: "",
  loading: false,
  listRoomLoading: false,
  profilePhotoLoading: false,
  authError: null,
  authForm: { email: "", password: "", name: "" },
  admin: {
    loaded: false,
    me: null,
    summary: null,
    listings: [],
    events: [],
    supportCases: [],
    invites: [],
    announcements: [],
    messages: [],
    audit: [],
  },
};

const app = document.querySelector("#app");
let renderedScreen = null;
const adminPath = window.location.pathname.replace(/\/$/, "");
const isAdminRoute = adminPath === "/admin" || window.location.pathname.endsWith("/admin.html") || window.location.hash === "#admin";
if (isAdminRoute) sessionStorage.setItem("karibu_admin_route", "1");
const wantsAdminMode = () => isAdminRoute || sessionStorage.getItem("karibu_admin_route") === "1";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ── Icons ─────────────────────────────────────────────────────
const icons = {
  home: `<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>`,
  search: `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>`,
  bot: `<svg viewBox="0 0 24 24"><path d="M4 5h16v10a2 2 0 0 1-2 2H9l-5 4z"/><path d="M8 9h8M8 13h5"/></svg>`,
  msg: `<svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4z"/></svg>`,
  user: `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`,
  back: `<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>`,
  bell: `<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7M10 20h4"/></svg>`,
  heart: `<svg viewBox="0 0 24 24"><path d="M20.8 5.6a5.4 5.4 0 0 0-7.6 0L12 6.8l-1.2-1.2a5.4 5.4 0 1 0-7.6 7.6L12 22l8.8-8.8a5.4 5.4 0 0 0 0-7.6z"/></svg>`,
  plus: `<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>`,
  map: `<svg viewBox="0 0 24 24"><path d="M12 21s7-5.3 7-12a7 7 0 1 0-14 0c0 6.7 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>`,
  shield: `<svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6z"/><path d="M12 8v5M12 16h.01"/></svg>`,
  spinner: `<svg class="spin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke-dasharray="28 57"/></svg>`,
};

const nav = [
  ["Home", screens.home, icons.home],
  ["Search", screens.search, icons.search],
  ["Assistant", screens.assistant, icons.bot],
  ["Messages", screens.messages, icons.msg],
  ["Profile", screens.profile, icons.user],
];

// ── Utilities ─────────────────────────────────────────────────
function iconButton(label, icon, action = "") {
  return `<button class="icon-button" ${action} aria-label="${label}">${icon}</button>`;
}

// Toast uses direct DOM so it doesn't trigger a full render (which would destroy the map)
function showToast(msg) {
  let el = document.getElementById("global-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "global-toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("visible");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove("visible"), 2200);
}

function openSheet(title, body, cta = "Done") {
  state.sheet = { title, body, cta };
  render();
}

function setScreen(screen, opts = {}) {
  // Destroy map when leaving rathaus
  if (state.screen === screens.rathaus && screen !== screens.rathaus) {
    if (_rathausMap) { _rathausMap.remove(); _rathausMap = null; }
    state.rathausResults = [];
    state.rathausUserCoords = null;
  }
  state.screen = screen;
  state.sheet = null;
  state.authError = null;
  if (!wantsAdminMode()) history.replaceState(null, "", `#${screen}`);
  render();
  // Kick off data loading for screens that need it
  if (screen === screens.home) {
    if (!state.communityPosts.length) loadCommunity("For You");
    if (!state.events.length) loadEvents();
    if (!state.announcements.length) loadAnnouncements(false);
    if (!state.messagesLoaded) loadMessages();
  }
  if (screen === screens.search) loadListings();
  if (screen === screens.community) loadCommunity(state.communityTab);
  if (screen === screens.checklist) loadChecklist();
  if (screen === screens.messages) loadMessages();
  if (screen === screens.bookings) loadBookings();
  if (screen === screens.profile) loadProfileData();
  if (screen === screens.rathaus) loadRathaus();
  if (screen === screens.emergency) loadEmergency();
  if (screen === screens.admin) loadAdminData();
}

// ── Data loaders ──────────────────────────────────────────────
async function loadListings(params = {}) {
  try {
    const cityParams = state.selectedCity ? { city_id: state.selectedCity.id, ...params } : params;
    let data = await api.listings.list(cityParams);
    state.listingFallback = false;
    if (state.selectedCity && !data.length) {
      data = await api.listings.list(params);
      state.listingFallback = true;
    }
    state.listings = data;
    state.savedIds = new Set(data.filter((l) => l.is_saved).map((l) => l.id));
    render();
  } catch (e) {
    showToast("Could not load listings");
  }
}

async function loadGeography() {
  try {
    const [states, cities] = await Promise.all([api.geo.states(), api.geo.cities()]);
    state.states = states;
    state.cities = cities;
    const profileCityId = Number(state.user?.city_id || 0);
    const savedCityId = Number(localStorage.getItem("karibu_city_id"));
    const profileCityName = (state.user?.city_name || "").toLowerCase();
    const profileStateName = (state.user?.state_name || "").toLowerCase();
    state.selectedCity =
      cities.find((c) => c.id === profileCityId) ||
      cities.find((c) => c.id === savedCityId) ||
      cities.find((c) => c.name.toLowerCase() === profileCityName && (!profileStateName || c.state_name.toLowerCase() === profileStateName)) ||
      cities.find((c) => c.name.toLowerCase() === profileCityName) ||
      cities.find((c) => c.name === "Berlin") ||
      cities[0] ||
      null;
    if (state.selectedCity) {
      state.locationStatus = `${state.selectedCity.name}, ${state.selectedCity.state_abbreviation}`;
      if (profileCityId) localStorage.setItem("karibu_city_id", String(profileCityId));
    }
    render();
    detectLocation();
  } catch {
    showToast("Could not load German cities");
  }
}

async function detectLocation() {
  if (!navigator.geolocation || localStorage.getItem("karibu_city_id")) return;
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        const cities = await api.geo.citiesNear(pos.coords.latitude, pos.coords.longitude, 100);
        if (cities[0]) {
          state.selectedCity = cities[0];
          state.locationStatus = `${cities[0].name}, ${cities[0].state_abbreviation} · GPS`;
          localStorage.setItem("karibu_city_id", String(cities[0].id));
          loadListings();
          render();
        }
      } catch {
        state.locationStatus = "Berlin fallback";
      }
    },
    () => { state.locationStatus = "Berlin fallback"; },
    { timeout: 3500, maximumAge: 1000 * 60 * 60 }
  );
}

async function loadRathaus() {
  state.rathausLoading = true;
  if (state.screen === screens.rathaus) render();
  try {
    const query = `${state.rathausQuery.address || ""} ${state.rathausQuery.postcode || ""}`.trim();
    if (query) {
      const result = await api.geo.rathausSearch({ address: query, radius_km: 35, limit: 10 });
      state.rathausUserCoords = { lat: result.latitude, lng: result.longitude, label: result.label };
      state.rathausSearchLabel = result.label || query;
      state.rathausResults = result.offices || [];
    } else {
      const params = state.selectedCity ? { city_id: state.selectedCity.id, limit: 10 } : { limit: 10 };
      state.rathausUserCoords = null;
      state.rathausSearchLabel = "";
      state.rathausResults = await api.geo.rathaus(params);
    }
    state.rathausLoading = false;
    render();
  } catch (err) {
    state.rathausLoading = false;
    state.rathausResults = [];
    render();
    showToast(err.message || "Could not load offices");
  }
}

async function loadEmergency() {
  const cacheKey = `karibu_emergency_${state.selectedCity?.state_id || "national"}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    state.emergencyData = JSON.parse(cached);
    render();
  }
  try {
    const data = await api.geo.emergency(state.selectedCity ? { state_id: state.selectedCity.state_id } : {});
    state.emergencyData = data;
    localStorage.setItem(cacheKey, JSON.stringify(data));
    render();
  } catch {
    if (!cached) showToast("Using offline emergency fallback");
  }
}

async function loadCommunity(tab) {
  try {
    if (tab === "Events") {
      await loadEvents(false);
    } else {
      const data = await api.community.posts(tab, state.communitySort);
      state.communityPosts = data;
    }
    render();
  } catch (e) {
    showToast("Could not load community");
  }
}

async function loadEvents(shouldRender = true) {
  try {
    state.events = await api.community.events();
    if (shouldRender) render();
  } catch {
    if (shouldRender) showToast("Could not load events");
  }
}

async function loadChecklist() {
  try {
    const data = await api.checklist.get();
    state.checklistDone = new Set(data.completed);
    render();
  } catch (e) {
    showToast("Could not load checklist");
  }
}

async function loadMessages() {
  try {
    const conversations = await api.messages.list();
    const shouldMarkRead = state.screen === screens.messages && conversations.some((c) => c.unread_count);
    state.conversations = shouldMarkRead
      ? conversations.map((c) => ({ ...c, is_read: true, unread_count: 0 }))
      : conversations;
    state.messagesLoaded = true;
    render();
    if (shouldMarkRead) {
      api.messages.markRead().catch(() => showToast("Could not mark messages as read"));
    }
  } catch (e) {
    state.messagesLoaded = true;
    render();
    showToast("Could not load messages");
  }
}

async function loadAnnouncements(shouldRender = true) {
  try {
    state.announcements = await api.community.announcements();
    if (shouldRender) render();
  } catch {
    if (shouldRender) showToast("Could not load announcements");
  }
}

async function loadAdminData() {
  try {
    const [me, summary, listings, events, supportCases, invites, announcements, messages, audit] = await Promise.all([
      api.admin.me(),
      api.admin.summary(),
      api.admin.listings("all"),
      api.admin.events("pending"),
      api.admin.supportCases("open"),
      api.admin.invites("pending"),
      api.admin.announcements(),
      api.admin.messages(),
      api.admin.audit(),
    ]);
    state.admin = { loaded: true, me, summary, listings, events, supportCases, invites, announcements, messages, audit };
    render();
  } catch (err) {
    state.admin = { ...state.admin, loaded: true };
    render();
    showToast(err.message || "Admin access required");
  }
}

async function loadBookings() {
  try {
    state.bookings = await api.bookings.list();
    render();
  } catch (e) {
    showToast("Could not load bookings");
  }
}

async function loadProfileData() {
  try {
    const [summary, settings, verification] = await Promise.all([
      api.auth.summary(),
      api.auth.settings(),
      api.auth.verification(),
    ]);
    state.profileSummary = summary;
    state.profileSettings = settings;
    state.verificationRequests = verification;
    state.profileLoaded = true;
    render();
  } catch {
    state.profileLoaded = true;
    render();
    showToast("Could not load profile details");
  }
}

// ── Auth ──────────────────────────────────────────────────────
async function initAuth() {
  if (!getToken()) { setScreen(screens.login); return; }
  try {
    const user = await api.auth.me();
    state.user = user;
    state.messages = [
      { from: "bot", text: `Hi ${user.full_name.split(" ")[0]}! 👋\nHow can I help with life in Germany today?` },
    ];
    if (wantsAdminMode()) {
      setScreen(screens.admin);
    } else {
      setScreen(screens.home);
      await loadGeography();
      loadListings(); // pre-load listings for home recommendations
    }
  } catch {
    clearToken();
    setScreen(screens.login);
  }
}

async function doLogin(email, password) {
  state.loading = true;
  state.authError = null;
  render();
  try {
    const data = await api.auth.login({ email, password });
    setToken(data.access_token);
    state.user = data.user;
    state.loading = false;
    state.messages = [
      { from: "bot", text: `Hi ${data.user.full_name.split(" ")[0]}! 👋\nHow can I help with life in Germany today?` },
    ];
    if (wantsAdminMode()) {
      setScreen(screens.admin);
    } else {
      setScreen(screens.home);
      await loadGeography();
      loadListings();
    }
  } catch (e) {
    state.loading = false;
    state.authError = e.message;
    render();
  }
}

async function doRegister(email, password, fullName) {
  state.loading = true;
  state.authError = null;
  render();
  try {
    const data = await api.auth.register({ email, password, full_name: fullName, ...signupLocationPayload() });
    setToken(data.access_token);
    state.user = data.user;
    if (data.user?.city_id) localStorage.setItem("karibu_city_id", String(data.user.city_id));
    state.loading = false;
    state.messages = [
      { from: "bot", text: `Welcome to Karibu Ujerumani, ${data.user.full_name.split(" ")[0]}! 🎉\nI'm here for community, services, housing, and everyday life in Germany.` },
    ];
    if (wantsAdminMode()) {
      setScreen(screens.admin);
    } else {
      setScreen(screens.home);
      await loadGeography();
      loadListings();
    }
  } catch (e) {
    state.loading = false;
    state.authError = e.message;
    render();
  }
}

// ── Shared UI ─────────────────────────────────────────────────
function demoLayer() {
  const sheet = state.sheet
    ? `<div class="demo-backdrop" data-action="close-sheet">
        <section class="demo-sheet" role="dialog" aria-modal="true">
          <div class="sheet-handle"></div>
          <h2>${state.sheet.title}</h2>
          <div class="sheet-body">${state.sheet.body}</div>
          <button class="primary" data-action="close-sheet">${state.sheet.cta}</button>
        </section>
      </div>`
    : "";
  const carousel = state.carousel
    ? `<div class="demo-backdrop media-backdrop" data-action="close-carousel">
        <section class="media-carousel" role="dialog" aria-modal="true" aria-label="Listing images">
          <button class="media-close" data-action="close-carousel" aria-label="Close image carousel">×</button>
          <img src="${state.carousel.images[state.carousel.index]}" alt="Listing image ${state.carousel.index + 1}" />
          <div class="media-controls">
            <button data-action="carousel-prev" aria-label="Previous image">‹</button>
            <span>${state.carousel.index + 1} / ${state.carousel.images.length}</span>
            <button data-action="carousel-next" aria-label="Next image">›</button>
          </div>
        </section>
      </div>`
    : "";
  return sheet + carousel;
}

function bottomNav() {
  const unread = state.conversations.reduce((total, c) => total + (c.unread_count || 0), 0);
  return `<nav class="bottom-nav">${nav
    .map(([label, screen, icon]) => {
      const active = state.screen === screen ||
        (screen === screens.search && [screens.detail, screens.rathaus].includes(state.screen));
      const badge = label === "Messages" && unread
        ? `<span class="nav-badge">${unread}</span>`
        : "";
      return `<button class="${active ? "active" : ""}" data-screen="${screen}">${badge}${icon}<span>${label}</span></button>`;
    })
    .join("")}</nav>`;
}

function shell(title, body, options = {}) {
  const left = options.back
    ? iconButton("Back", icons.back, `data-screen="${options.back}"`)
    : "";
  const right = options.right || "";
  return `<section class="phone-screen ${options.className || ""}">
    <header class="topbar">${left}<strong>${title}</strong><div class="topbar-right">${right}</div></header>
    <div class="screen-body">${body}</div>
    ${demoLayer()}
    ${options.hideNav ? "" : bottomNav()}
  </section>`;
}

// ── Rathaus / Emergency static fallback data ──────────────────
// Kept as a UI fallback; primary data now comes from /geo.
const BERLIN_BUERGERAEMTER = [
  { name: "Bürgeramt Rathaus Neukölln", district: "Neukölln", address: "Karl-Marx-Straße 83, 12040 Berlin", lat: 52.4757, lng: 13.4348, phone: "030 115", services: ["Anmeldung", "ID card", "Residence certificate", "Address change"], booking: "https://service.berlin.de/dienstleistung/120686/" },
  { name: "Bürgeramt Sonnenallee", district: "Neukölln", address: "Sonnenallee 107, 12045 Berlin", lat: 52.4798, lng: 13.4415, phone: "030 115", services: ["Anmeldung", "Address change", "Documents"], booking: "https://service.berlin.de/dienstleistung/120686/" },
  { name: "Bürgeramt Schöneberg", district: "Schöneberg", address: "Martin-Luther-Straße 105, 10825 Berlin", lat: 52.4885, lng: 13.3571, phone: "030 115", services: ["Anmeldung", "ID card", "Passport"], booking: "https://service.berlin.de/dienstleistung/120686/" },
  { name: "Bürgeramt Kreuzberg", district: "Kreuzberg", address: "Yorckstraße 4-11, 10965 Berlin", lat: 52.4927, lng: 13.3802, phone: "030 115", services: ["Anmeldung", "ID card", "Driver's licence"], booking: "https://service.berlin.de/dienstleistung/120686/" },
  { name: "Bürgeramt Tempelhof", district: "Tempelhof", address: "Tempelhofer Damm 165, 12099 Berlin", lat: 52.4761, lng: 13.3854, phone: "030 115", services: ["Anmeldung", "Documents", "Residence permit"], booking: "https://service.berlin.de/dienstleistung/120686/" },
  { name: "Bürgeramt Mitte", district: "Mitte", address: "Karl-Marx-Allee 31, 10178 Berlin", lat: 52.5228, lng: 13.4140, phone: "030 115", services: ["Anmeldung", "ID card", "Passport", "Residence certificate"], booking: "https://service.berlin.de/dienstleistung/120686/" },
  { name: "Bürgeramt Wedding", district: "Wedding", address: "Müllerstraße 147, 13353 Berlin", lat: 52.5447, lng: 13.3598, phone: "030 115", services: ["Anmeldung", "ID card", "Address change"], booking: "https://service.berlin.de/dienstleistung/120686/" },
  { name: "Bürgeramt Charlottenburg", district: "Charlottenburg", address: "Otto-Suhr-Allee 100, 10585 Berlin", lat: 52.5161, lng: 13.3036, phone: "030 115", services: ["Anmeldung", "ID card", "Passport"], booking: "https://service.berlin.de/dienstleistung/120686/" },
  { name: "Bürgeramt Prenzlauer Berg", district: "Prenzlauer Berg", address: "Fröbelstraße 17, 10405 Berlin", lat: 52.5380, lng: 13.4200, phone: "030 115", services: ["Anmeldung", "Documents"], booking: "https://service.berlin.de/dienstleistung/120686/" },
  { name: "Bürgeramt Friedrichshain", district: "Friedrichshain", address: "Frankfurter Allee 35-37, 10247 Berlin", lat: 52.5133, lng: 13.4568, phone: "030 115", services: ["Anmeldung", "ID card", "Address change"], booking: "https://service.berlin.de/dienstleistung/120686/" },
  { name: "Bürgeramt Lichtenberg", district: "Lichtenberg", address: "Möllendorffstraße 6, 10367 Berlin", lat: 52.5243, lng: 13.4723, phone: "030 115", services: ["Anmeldung", "Documents", "Residence permit"], booking: "https://service.berlin.de/dienstleistung/120686/" },
  { name: "Bürgeramt Spandau", district: "Spandau", address: "Carl-Schurz-Straße 2-6, 13597 Berlin", lat: 52.5364, lng: 13.2041, phone: "030 115", services: ["Anmeldung", "ID card", "Passport"], booking: "https://service.berlin.de/dienstleistung/120686/" },
  { name: "Bürgeramt Pankow", district: "Pankow", address: "Berliner Straße 120-121, 13187 Berlin", lat: 52.5667, lng: 13.4022, phone: "030 115", services: ["Anmeldung", "Documents"], booking: "https://service.berlin.de/dienstleistung/120686/" },
];

// ── Map lifecycle ─────────────────────────────────────────────
let _rathausMap = null;

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function geocodeAddress(query) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ", Germany")}&format=json&limit=1&countrycodes=de`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    const data = await res.json();
    if (data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        label: data[0].display_name,
      };
    }
  } catch {}
  return null;
}

async function initRathausMap() {
  const container = document.getElementById("rathaus-map");
  if (!container || _rathausMap) return;

  const cardEl = document.getElementById("rathaus-cards");
  const offices = state.rathausResults || [];
  const coords = state.rathausUserCoords || (state.selectedCity
    ? { lat: state.selectedCity.latitude, lng: state.selectedCity.longitude }
    : { lat: 52.5074, lng: 13.3904 });

  _rathausMap = L.map(container, { zoomControl: true, scrollWheelZoom: false }).setView(
    [coords.lat, coords.lng], 13
  );
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
  }).addTo(_rathausMap);

  // User location pin (blue circle)
  L.circleMarker([coords.lat, coords.lng], {
    radius: 9, fillColor: "#1a7a3c", color: "#fff", weight: 3, fillOpacity: 1,
  }).addTo(_rathausMap).bindPopup(`<strong>${state.rathausSearchLabel || state.selectedCity?.name || "Germany"}</strong>`);

  offices.forEach((o, i) => {
    if (o.latitude == null || o.longitude == null) return;
    const icon = L.divIcon({
      className: "",
      html: `<div class="map-num-pin">${i + 1}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    L.marker([o.latitude, o.longitude], { icon })
      .addTo(_rathausMap)
      .bindPopup(
        `<strong>${o.name}</strong><br>${o.address || ""}<br><em>${o.distance_km ? o.distance_km.toFixed(1) + " km away" : o.city_name || ""}</em>`
      );
  });

  const bounds = L.latLngBounds([
    [coords.lat, coords.lng],
    ...offices.filter((o) => o.latitude != null && o.longitude != null).slice(0, 3).map((o) => [o.latitude, o.longitude]),
  ]);
  _rathausMap.fitBounds(bounds, { padding: [32, 32] });

  if (cardEl) cardEl.innerHTML = rathausCards(offices);
}

const emergencyContacts = [
  {
    type: "Mental health",
    title: "Crisis first response",
    org: "Berliner Krisendienst",
    availability: "24/7 · Free",
    tone: "red",
    detail: "Immediate support if someone may harm themselves, feels unsafe, or needs urgent mental health help. You will speak to a trained responder.",
    action_type: "call",
    phones: [
      { label: "Berliner Krisendienst", number: "tel:+4930390630" },
      { label: "Telefonseelsorge (free)", number: "tel:+498001110111" },
    ],
  },
  {
    type: "Care and support",
    title: "Care and support",
    org: "Karibu community network",
    availability: "< 2 hrs response",
    tone: "green",
    detail: "Speak with a trusted community leader for pastoral care, emergencies, grief and crisis support.",
    action_type: "case",
    case_type: "pastoral",
    action: "Request callback",
    contact_pref_prompt: true,
  },
  {
    type: "Short stay",
    title: "Emergency short-stay help",
    org: "Karibu + Berlin shelter network",
    availability: "Tonight",
    tone: "gold",
    detail: "Escalates to vetted community hosts and local shelter guidance for urgent temporary safe accommodation.",
    action_type: "case+call",
    case_type: "short_stay",
    action: "Request safe stay",
    phones: [
      { label: "Berlin city services (115)", number: "tel:115" },
    ],
  },
  {
    type: "Embassy",
    title: "Embassy support",
    org: "Kenyan Embassy, Berlin",
    availability: "Mon-Fri 09:00-13:00",
    tone: "slate",
    detail: "For lost passport, detention, family emergency, travel document, or urgent consular guidance.",
    action_type: "case+call",
    case_type: "embassy",
    action: "Open Karibu case",
    phones: [
      { label: "Kenyan Embassy Berlin", number: "tel:+493025926611" },
    ],
    url: { label: "kenyanembassyberlin.de ↗", href: "https://kenyanembassyberlin.de/" },
    address: {
      label: "Rheinbabenallee 49, 14199 Berlin, Germany",
      href: "https://kenyanembassyberlin.de/contact-us/#",
    },
  },
  {
    type: "Admin",
    title: "Lost documents / urgent paperwork",
    org: "Karibu Support desk",
    availability: "Today",
    tone: "green",
    detail: "Karibu helps triage a police report, embassy contact, Bürgeramt steps, and translation support for lost or stolen documents.",
    action_type: "case",
    case_type: "admin",
    action: "Open support case",
  },
];

// ── Screen renderers ──────────────────────────────────────────

function splash() {
  return `<section class="phone-screen splash">
    <div class="splash-mark">
      <div class="brand-house"><span></span><span></span><span></span></div>
      <h1>KARIBU</h1>
      <h2>UJERUMANI</h2>
      <p>Kenyan community, events, support, and local knowledge across Germany.</p>
    </div>
    <div class="cityline" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <div class="splash-loader"><span></span></div>
  </section>`;
}

function login() {
  const err = state.authError ? `<p class="auth-error">${state.authError}</p>` : "";
  return `<section class="phone-screen auth-screen">
    <div class="auth-body">
      <div class="auth-brand"><div class="brand-house small"><span></span><span></span><span></span></div><h1>Karibu<br>Ujerumani</h1></div>
      <h2 class="auth-title">Welcome back</h2>
      <p class="auth-sub">Sign in to your account</p>
      ${err}
      <form class="auth-form" id="login-form">
        <label>Email<input type="email" name="email" placeholder="you@example.com" value="${state.authForm.email}" required /></label>
        <label>Password<input type="password" name="password" placeholder="Your password" required /></label>
        <button class="primary" type="submit">${state.loading ? icons.spinner + " Signing in…" : "Sign in"}</button>
      </form>
      <p class="auth-switch">Don't have an account? <button data-screen="${screens.register}">Register</button></p>
    </div>
    ${demoLayer()}
  </section>`;
}

function register() {
  const err = state.authError ? `<p class="auth-error">${state.authError}</p>` : "";
  const location = state.signupLocation || {};
  const cityValue = location.city_name || state.authForm.city_name || "";
  const stateValue = location.state_name || state.authForm.state_name || "";
  const postcodeValue = location.postcode || state.authForm.postcode || "";
  const locationResult = location.city_name
    ? `<p class="location-result">Using ${escapeHtml([location.postcode, location.city_name].filter(Boolean).join(" "))}${location.state_name ? `, ${escapeHtml(location.state_name)}` : ""}</p>`
    : `<p class="location-result muted">Enter your city, or use a German postal code to set the nearest city automatically.</p>`;
  return `<section class="phone-screen auth-screen">
    <div class="auth-body">
      <div class="auth-brand"><div class="brand-house small"><span></span><span></span><span></span></div><h1>Karibu<br>Ujerumani</h1></div>
      <h2 class="auth-title">Join the community</h2>
      <p class="auth-sub">Create your free account</p>
      ${err}
      <form class="auth-form" id="register-form">
        <label>Full name<input type="text" name="name" placeholder="Your full name" value="${escapeHtml(state.authForm.name || "")}" required /></label>
        <label>Email<input type="email" name="email" placeholder="you@example.com" value="${escapeHtml(state.authForm.email || "")}" required /></label>
        <label>Password<input type="password" name="password" placeholder="Choose a password (min 8 chars)" required /></label>
        <fieldset class="location-fields signup-location-fields">
          <legend>Your city in Germany</legend>
          <label>Postal code
            <div class="postcode-row">
              <input id="signup-postcode" type="text" name="postcode" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" placeholder="e.g. 50667" value="${escapeHtml(postcodeValue)}" />
              <button type="button" data-action="lookup-signup-postcode">Find</button>
            </div>
          </label>
          <label>City<input id="signup-city-name" type="text" name="city_name" placeholder="e.g. Cologne" value="${escapeHtml(cityValue)}" required /></label>
          <label>State<input id="signup-state-name" type="text" name="state_name" placeholder="e.g. Nordrhein-Westfalen" value="${escapeHtml(stateValue)}" /></label>
          <input type="hidden" name="city_id" value="${location.city_id || ""}" />
          <input type="hidden" name="state_id" value="${location.state_id || ""}" />
          <input type="hidden" name="latitude" value="${location.latitude || ""}" />
          <input type="hidden" name="longitude" value="${location.longitude || ""}" />
          ${locationResult}
        </fieldset>
        <button class="primary" type="submit">${state.loading ? icons.spinner + " Creating account…" : "Create account"}</button>
      </form>
      <p class="auth-switch">Already have an account? <button data-screen="${screens.login}">Sign in</button></p>
    </div>
    ${demoLayer()}
  </section>`;
}

function listingCard(l) {
  const saved = state.savedIds.has(l.id);
  const photo = l.images?.[0];
  const location = listingLocationLabel(l);
  return `<article class="listing-card" data-listing-id="${l.id}">
    <div class="listing-image room-${l.theme}">
      ${photo
        ? `<button class="listing-photo-trigger" data-carousel-listing="${l.id}" aria-label="Open listing image carousel"><img src="${photo}" alt="${l.title}" /></button>`
        : `<div class="room-scene"><i></i><i></i><i></i></div>`}
      ${l.is_top_match ? `<span class="top-match">Top match</span>` : ""}
      <button class="save ${saved ? "saved" : ""}" data-save-id="${l.id}" aria-label="Save listing">${icons.heart}</button>
    </div>
    <div class="listing-content">
      <div class="price"><strong>€${l.price}</strong> / month</div>
      <h3>${l.title}</h3>
      <p>${escapeHtml(l.transit_info || location)} · ${escapeHtml(location)}</p>
      <div class="chips"><span>Private Room</span><span>Wi‑Fi</span><span>Kitchen</span><b>${l.rating}</b></div>
    </div>
  </article>`;
}

function listingLocationLabel(l) {
  const place = [l.postcode, l.city_name].filter(Boolean).join(" ");
  return place || l.district || "Germany";
}

function home() {
  const firstName = state.user?.full_name?.split(" ")[0] || "there";
  const unreadMessages = state.conversations.reduce((total, c) => total + (c.unread_count || 0), 0);
  const topListings = state.listings.slice(0, 3);
  const cityName = state.selectedCity?.name || "Berlin";
  const tierCities = state.cities.filter((c) => c.is_tier_1 || c.is_tier_2).slice(0, 8);
  const communityHighlights = state.communityPosts.slice(0, 2);
  const upcomingEvents = state.events.slice(0, 2);
  const publishedAnnouncements = state.announcements.slice(0, 2);
  const listingSection = topListings.length
    ? `<div class="section-row"><h2>Recommended for you</h2><button data-screen="${screens.search}">See all</button></div>
      <div class="mini-row">${topListings.map((l) => `<button class="mini-listing room-${l.theme}" data-listing-id="${l.id}"><span>€${l.price}/mo</span><b>${l.district}</b></button>`).join("")}</div>`
    : "";
  const eventsSection = upcomingEvents.length
    ? `<div class="section-row" style="margin-top:22px"><h2>Events</h2><button data-community-tab="Events" data-screen="${screens.community}">View all</button></div>
      <div class="announce-cards">${upcomingEvents.map((e) => `<button class="announce-card" data-community-tab="Events" data-screen="${screens.community}"><span class="announce-icon">📅</span><div><strong>${escapeHtml(e.title)}</strong><p>${escapeHtml(e.date_str)} · ${escapeHtml(e.location)}</p></div><b class="announce-tag">${escapeHtml(e.tag)}</b></button>`).join("")}</div>`
    : "";
  const announcementsSection = publishedAnnouncements.length
    ? `<div class="section-row" style="margin-top:22px"><h2>Community Notices</h2><button data-screen="${screens.community}">Community</button></div>
      <div class="announce-cards">${publishedAnnouncements.map((a) => `<button class="announce-card" data-screen="${screens.community}"><span class="announce-icon">📣</span><div><strong>${escapeHtml(a.title)}</strong><p>${escapeHtml(a.body)}</p></div><b class="announce-tag">${escapeHtml(a.audience)}</b></button>`).join("")}</div>`
    : "";
  const communitySection = communityHighlights.length
    ? `<div class="section-row"><h2>Community Highlights</h2><button data-screen="${screens.community}">Join</button></div>
      <div class="community-preview">${communityHighlights.map((p) => `<button class="community-highlight" data-screen="${screens.community}"><b>${escapeHtml(p.author_name)} · ${escapeHtml(p.author_area || "Germany")}</b><span>${escapeHtml(p.body)}</span><footer>💬 ${p.comments || 0} replies · ${timeAgo(p.created_at)}</footer></button>`).join("")}</div>`
    : "";
  const cards = [
    ["🏠", "Find Housing", "Rooms, apartments & short stays", screens.search],
    ["👥", "Community", "Ask, share, connect & help others", screens.community],
    ["✅", "Arrival Checklist", "Useful steps for new arrivals", screens.checklist],
    ["🏛️", "Rathaus Finder", "Find the right Bürgeramt nearby", screens.rathaus],
    ["🛟", "Emergency Help", "Community support when it is urgent", screens.emergency],
    ["❤️", "Saved Listings", "Your favorite places", screens.search],
  ];
  return `<section class="phone-screen home-screen">
    <div class="screen-body">
    <div class="home-head">
      <div><h1>Karibu, ${firstName} 👋</h1><p>📍 ${state.locationStatus || cityName}</p></div>
      <button class="bell" data-screen="${screens.messages}" aria-label="Messages">${unreadMessages ? `<span class="nav-badge">${unreadMessages}</span>` : ""}${icons.bell}</button>
    </div>
    <button class="city-pill" data-action="city-selector">🌍 ${cityName} <span>Change city</span></button>
    <button class="ai-banner" data-screen="${screens.assistant}">
      <div><h2>Need help today?</h2><p>Your AI concierge is ready.</p><b>Open Karibu Chat</b></div>
      <span class="suitcase-ai" aria-hidden="true"><i></i></span>
    </button>
    <h2 class="section-title">Quick access</h2>
    <div class="quick-grid">${cards.map(([e, t, s, sc]) => `<button class="quick-card" data-screen="${sc}"><span>${e}</span><strong>${t}</strong><small>${s}</small></button>`).join("")}</div>
    ${listingSection}
    <div class="section-row" style="margin-top:22px"><h2>Explore Germany</h2><button data-action="city-selector">All cities</button></div>
    <div class="city-strip">${tierCities.map((c) => `<button class="${state.selectedCity?.id === c.id ? "active" : ""}" data-city-id="${c.id}"><b>${c.name}</b><span>${c.state_abbreviation} · ${c.listing_count} listing${c.listing_count === 1 ? "" : "s"}</span></button>`).join("")}</div>
    ${announcementsSection}
    ${eventsSection}
    ${communitySection}
    </div>
    ${demoLayer()}
    ${bottomNav()}
  </section>`;
}

function search() {
  const filtered = filterListings(state.searchQuery);
  const items = listingResultsHtml(filtered, state.searchQuery);

  return shell(
    "Find Housing",
    `<button class="city-selector-row" data-action="city-selector">
      <span>Housing city</span><b>${state.selectedCity?.name || "Germany"}</b><small>${state.selectedCity?.state_name || "National search"}</small>
    </button>
    ${state.listingFallback ? `<div class="fallback-banner">No rooms yet in ${state.selectedCity?.name}. Showing national listings until the first local host lists a room.</div>` : ""}
    <label class="searchbox">${icons.search}<input placeholder="Search area, district or landmark…" id="search-input" value="${state.searchQuery}" /></label>
    <div class="filters">
      <button data-action="filter-budget">Budget⌄</button>
      <button data-action="filter-type">Type⌄</button>
      <button data-action="filter-more">More⌄</button>
    </div>
    <div class="results-line" id="listing-results-line"><span>${filtered.length} listing${filtered.length !== 1 ? "s" : ""} in ${state.listingFallback ? "Germany" : (state.selectedCity?.name || "Germany")}</span><button class="list-room-link" data-screen="${screens.listRoom}">+ List a room</button></div>
    <div class="listing-stack">${items}</div>`,
    { back: screens.home, right: iconButton("List a room", icons.plus, `data-screen="${screens.listRoom}"`) }
  );
}

function filterListings(query) {
  const q = query.toLowerCase().trim();
  if (!q) return state.listings;
  return state.listings.filter(
    (l) =>
    l.district.toLowerCase().includes(q) ||
    (l.postcode || "").toLowerCase().includes(q) ||
    (l.city_name || "").toLowerCase().includes(q) ||
    (l.state_name || "").toLowerCase().includes(q) ||
    l.title.toLowerCase().includes(q) ||
      (l.address || "").toLowerCase().includes(q) ||
      (l.transit_info || "").toLowerCase().includes(q)
  );
}

function listingResultsHtml(filtered, query) {
  const q = query.toLowerCase().trim();
  if (!state.listings.length) {
    return `<div class="loading-state">${icons.spinner} Loading listings…</div>`;
  }
  if (!filtered.length) {
    return `<div class="empty-state"><p>No listings match "<strong>${q}</strong>"</p><button class="secondary" data-action="clear-search">Clear search</button></div>`;
  }
  return filtered.map((l) => listingCard(l)).join("");
}

function updateSearchResultsDom() {
  const filtered = filterListings(state.searchQuery);
  const stack = document.querySelector(".listing-stack");
  const line = document.getElementById("listing-results-line");
  if (stack) stack.innerHTML = listingResultsHtml(filtered, state.searchQuery);
  if (line) {
    line.innerHTML = `<span>${filtered.length} listing${filtered.length !== 1 ? "s" : ""} in ${state.listingFallback ? "Germany" : (state.selectedCity?.name || "Germany")}</span><button class="list-room-link" data-screen="${screens.listRoom}">+ List a room</button>`;
  }
}

function listRoom() {
  const themes = ["sun", "leaf", "city"];
  const amenities = ["Anmeldung friendly", "Wi-Fi", "Kitchen", "Furnished", "Private room", "Heating", "Near U-Bahn", "Women-friendly", "No deposit", "Short stay"];
  const location = state.listRoomLocation || {};
  return shell(
    "List Your Room",
    `<p class="form-intro">Share your spare room anywhere in Germany with the Karibu community. We'll verify it before it goes live.</p>
    <form class="room-form" id="list-room-form">
      <fieldset class="image-buckets">
        <legend>Listing photos</legend>
        <p>Upload up to 3 images. The main image opens a floating carousel with the support images.</p>
        <label>Main image
          <input type="file" name="main_image" accept="image/*" />
        </label>
        <label>Support image 1
          <input type="file" name="support_image_1" accept="image/*" />
        </label>
        <label>Support image 2
          <input type="file" name="support_image_2" accept="image/*" />
        </label>
      </fieldset>
      <label>Room title <span class="req">*</span>
        <input type="text" name="title" placeholder="e.g. Cozy room in Neukölln" required maxlength="80" />
      </label>
      <label>Monthly rent (€) <span class="req">*</span>
        <input type="number" name="price" placeholder="e.g. 550" min="100" max="5000" required />
      </label>
      <fieldset class="location-fields">
        <legend>Location</legend>
        <label>Postal code <span class="req">*</span>
          <div class="postcode-row">
            <input id="listing-postcode" type="text" name="postcode" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" placeholder="e.g. 50667" value="${escapeHtml(location.postcode || "")}" required />
            <button type="button" data-action="lookup-postcode">Find</button>
          </div>
        </label>
        <label>City / town <span class="req">*</span>
          <input id="listing-city-name" type="text" name="city_name" placeholder="Auto-filled from postal code" value="${escapeHtml(location.city_name || "")}" required />
        </label>
        <label>State
          <input id="listing-state-name" type="text" name="state_name" placeholder="Auto-filled" value="${escapeHtml(location.state_name || "")}" />
        </label>
        <label>District / neighbourhood
          <input type="text" name="district" placeholder="e.g. Ehrenfeld, Mitte, Neustadt" value="${escapeHtml(location.district || "")}" />
        </label>
        <input type="hidden" name="city_id" value="${location.city_id || ""}" />
        <input type="hidden" name="state_id" value="${location.state_id || ""}" />
        <input type="hidden" name="latitude" value="${location.latitude || ""}" />
        <input type="hidden" name="longitude" value="${location.longitude || ""}" />
        ${location.label ? `<p class="location-result">Matched: ${escapeHtml(location.label)}</p>` : `<p class="location-result muted">Use Find to auto-fill city and state. You can still edit them if needed.</p>`}
      </fieldset>
      <label>Street address
        <input type="text" name="address" placeholder="Street name and house number" />
      </label>
      <label>Nearest transport
        <input type="text" name="transit_info" placeholder="e.g. 5 min to U8 Boddinstraße" />
      </label>
      <label>Room colour theme
        <div class="theme-picker">${themes.map((t) => `<label class="theme-opt"><input type="radio" name="theme" value="${t}" ${t === "sun" ? "checked" : ""} /><span class="swatch room-${t}"></span><small>${t}</small></label>`).join("")}</div>
      </label>
      <label>Amenities
        <select id="amenity-select">
          <option value="">Select to add</option>
          ${amenities.filter((a) => !state.listRoomAmenities.includes(a)).map((a) => `<option value="${a}">${a}</option>`).join("")}
        </select>
      </label>
      <div class="amenity-picks">${state.listRoomAmenities.length
        ? state.listRoomAmenities.map((a) => `<button type="button" data-amenity-remove="${a}">${a} ×</button>`).join("")
        : `<span>No amenities added yet</span>`}
      </div>
      <label>Communication route
        <select name="communication_route">
          <option value="in_app">In-app messaging (recommended)</option>
        </select>
      </label>
      <p class="route-note">Hosts and guests start with Karibu in-app messaging so phone numbers stay private until both sides choose to share them.</p>
      <label>Description
        <textarea name="description" rows="4" placeholder="Tell potential guests about the room, house rules, who you're looking for…" maxlength="500"></textarea>
      </label>
      <button class="primary" type="submit" ${state.listRoomLoading ? "disabled" : ""}>${state.listRoomLoading ? icons.spinner + " Submitting…" : "Submit listing"}</button>
    </form>`,
    { back: screens.search }
  );
}

function detail() {
  const l = state.detailListing || state.listings[0];
  if (!l) return shell("", `<div class="loading-state">${icons.spinner}</div>`, { hideNav: true });
  const saved = state.savedIds.has(l.id);
  const isOwn = l.host_id === state.user?.id;
  const photos = l.images || [];
  const location = listingLocationLabel(l);
  const region = [l.district, l.state_name].filter(Boolean).join(" · ");
  return shell(
    "",
    `<div class="detail-hero room-${l.theme}">
      ${photos.length
        ? `<button class="detail-photo-trigger" data-carousel-listing="${l.id}" aria-label="Open listing image carousel"><img src="${photos[0]}" alt="${l.title}" /><span>${photos.length} photos</span></button>`
        : `<div class="room-scene large"><i></i><i></i><i></i></div>`}
      <button class="floating back" data-screen="${screens.search}">${icons.back}</button>
      <div class="hero-actions">
        <button data-save-id="${l.id}" class="${saved ? "saved" : ""}">${icons.heart}</button>
        <button data-action="share-listing">↗</button>
      </div>
    </div>
    <article class="detail-panel">
      <div class="price-row">
        <div class="price"><strong>€${l.price}</strong> / month</div>
        <span class="rating-pill">${l.rating}</span>
      </div>
      <h1>${l.title}</h1>
      <p class="detail-location">📍 ${escapeHtml([l.address, location].filter(Boolean).join(", "))}</p>
      ${region ? `<p class="detail-transit">${escapeHtml(region)}</p>` : ""}
      ${l.transit_info ? `<p class="detail-transit">🚇 ${l.transit_info}</p>` : ""}
      ${!isOwn ? `<span class="verified">✓ Community Verified</span>` : `<span class="verified own">Your listing</span>`}
      <div class="amenities">
        ${(l.amenities?.length ? l.amenities.slice(0, 5) : ["Private Room", "1 Guest", "Wi‑Fi", "Kitchen", "Heating"])
          .map((a) => `<span>${amenityIcon(a)}<b>${a}</b></span>`).join("")}
      </div>
      <div class="comm-route"><b>Communication</b><span>In-app messaging first. Share WhatsApp or phone only after both sides agree.</span></div>
      <h2>About the place</h2>
      <p class="detail-desc">${l.description || "No description provided."}</p>
      <div class="detail-map">
        <div class="map-placeholder">📍 ${escapeHtml(location)}</div>
        <p class="map-note">Community verified area · Safe for Anmeldung</p>
      </div>
    </article>
    <div class="cta-row">
      ${isOwn
        ? `<button class="secondary" data-action="edit-listing">Edit listing</button>
           <button class="secondary danger" data-action="end-listing">End listing</button>
           <button class="primary danger" data-action="delete-listing">Delete listing</button>`
        : `<button class="secondary" data-action="message-host">Message Host</button>
           <button class="primary" data-book-id="${l.id}">Request to Book</button>`
      }
    </div>`,
    { className: "detail", hideNav: true }
  );
}

function amenityIcon(label) {
  const key = label.toLowerCase();
  if (key.includes("wi")) return "📶";
  if (key.includes("kitchen")) return "🍳";
  if (key.includes("heat")) return "♨️";
  if (key.includes("u-bahn")) return "🚇";
  if (key.includes("anmeldung")) return "✅";
  if (key.includes("furnished")) return "🪑";
  if (key.includes("short")) return "🧳";
  if (key.includes("deposit")) return "💶";
  if (key.includes("women")) return "🛡️";
  if (key.includes("guest")) return "👤";
  return "🛏️";
}

function assistant() {
  const chips = [
    "Where should I stay near TU Berlin?",
    "What should I do after landing?",
    "How do I register in Berlin?",
    "What documents do I need?",
    "Estimated monthly costs in Berlin",
  ];
  return shell(
    "Karibu Chat",
    `<div class="chat-intro">
      <div class="chat-mark">💬</div>
      <div><h2>Your AI concierge</h2><p>Ask about housing, Anmeldung, documents, costs, events, and life in Germany.</p></div>
    </div>
    <div class="chat" id="chat-messages">${state.messages.map((m) => `<div class="bubble ${m.from}">${m.text.replace(/\n/g, "<br>")}</div>`).join("")}</div>
    <div class="action-chips">${chips.map((c) => `<button data-chat="${c}">${c}</button>`).join("")}</div>
    <form class="composer" id="chat-form"><input id="chat-input" placeholder="Ask anything about life in Germany…" /><button type="submit" aria-label="Send message">Send</button></form>`,
    { back: screens.home }
  );
}

function checklist() {
  const beforeArrival = ["Confirm University/Job Acceptance", "Apply for German Visa", "Book Temporary Accommodation", "Get Travel Insurance", "Research Berlin neighbourhoods"];
  const week1 = ["Get a SIM Card", "Get Transport Card (BVG)", "Register Address (Anmeldung)", "Open a Bank Account", "Explore your neighbourhood"];
  const week2 = ["Choose health insurance (Krankenkasse)", "Book Rathaus appointment", "Register with Kenyan Embassy", "Get a German number for official use"];
  const settled = ["Join a community group", "Start German language classes", "Connect with a mentor on Karibu", "Help a new arrival — pay it forward 🤝"];
  const all = [...beforeArrival, ...week1, ...week2, ...settled];
  const pct = Math.round((state.checklistDone.size / all.length) * 100);

  return shell(
    "Arrival Checklist",
    `<section class="progress-card">
      <div><strong>Your progress</strong><span>${state.checklistDone.size} of ${all.length} completed</span></div>
      <b>${pct}%</b>
      <progress value="${pct}" max="100"></progress>
    </section>
    <h2 class="section-title">Before Arrival</h2>
    <div class="task-list">${beforeArrival.map(taskRow).join("")}</div>
    <h2 class="section-title">After Arrival — Week 1</h2>
    <div class="task-list">${week1.map(taskRow).join("")}</div>
    ${state.checklistExpanded ? `
    <h2 class="section-title">Week 2</h2>
    <div class="task-list">${week2.map(taskRow).join("")}</div>
    <h2 class="section-title settled-title">Settled 🎉</h2>
    <div class="task-list">${settled.map(taskRow).join("")}</div>
    ` : ""}
    <button class="show-more" data-action="toggle-checklist">${state.checklistExpanded ? "Show less ▲" : "Show Week 2 & Settled ▼"}</button>`,
    { back: screens.home }
  );
}

function taskRow(task) {
  const done = state.checklistDone.has(task);
  return `<button class="task ${done ? "done" : ""}" data-task="${task}"><span>${done ? "✓" : ""}</span>${task}<b>${done ? "" : "⌄"}</b></button>`;
}

function community() {
  const tabs = ["For You", "Questions", "Tips", "Events"];

  let content = "";
  if (state.communityTab === "Events") {
    if (!state.events.length) {
      content = `<div class="empty-state">
        <h2>No community events yet</h2>
        <p>Start a meetup, workshop, church gathering, sports day, or family-friendly event.</p>
        <button class="primary" data-action="compose-event">Create event</button>
      </div>`;
    } else {
      content = `<div class="event-stack">${state.events.map((e) => `<article class="event-card">
        <div class="event-header"><span class="event-tag">${escapeHtml(e.tag)}${e.is_ticketed ? " · Ticketed" : " · Free"}</span><span class="event-rsvp">${e.approval_status === "pending" ? "Pending approval" : `👥 ${e.rsvp_count} going`}</span></div>
        <h2>${escapeHtml(e.title)}</h2>
        <p>📅 ${escapeHtml(e.date_str)}</p>
        <p>📍 ${escapeHtml(e.location)}</p>
        ${e.approval_status === "pending"
          ? `<button class="primary event-btn rsvped" disabled>Awaiting admin approval</button>`
          : e.is_ticketed && e.ticket_url
            ? `<a class="primary event-btn" href="${escapeHtml(e.ticket_url)}" target="_blank" rel="noopener">${e.ticket_price ? `Get tickets · ${escapeHtml(e.ticket_price)}` : "Get tickets"}</a>`
            : `<button class="primary event-btn ${e.is_rsvped ? "rsvped" : ""}" data-rsvp-id="${e.id}">${e.is_rsvped ? "Cancel RSVP" : "RSVP to attend"}</button>`}
      </article>`).join("")}</div>`;
    }
  } else {
    if (!state.communityPosts.length) {
      const label = state.communityTab === "Questions" ? "Ask the first question" : state.communityTab === "Tips" ? "Share the first tip" : "Create the first post";
      content = `<div class="empty-state">
        <h2>No ${state.communityTab.toLowerCase()} yet</h2>
        <p>Community posts appear here after members create them.</p>
        <button class="primary" data-action="compose-post">${label}</button>
      </div>`;
    } else {
      content = `<div class="post-stack">${state.communityPosts.map((p) => `<article class="post" data-post-id="${p.id}">
        <header><b>${escapeHtml(p.author_name)}</b><span>${escapeHtml(p.author_area)} · ${timeAgo(p.created_at)}</span>${p.is_owner || p.can_delete ? `<div class="post-owner-actions">${p.is_owner ? `<button data-edit-post-id="${p.id}" aria-label="Edit post">Edit</button>` : ""}${p.can_delete ? `<button data-delete-post-id="${p.id}" aria-label="Delete post">Delete</button>` : ""}</div>` : ""}</header>
        <h2>${escapeHtml(p.body)}</h2>
        <footer>
          <button class="${p.is_liked ? "active" : ""}" data-like-id="${p.id}">${p.is_liked ? "♥" : "♡"} ${p.likes}</button>
          <button data-comment-id="${p.id}">💬 ${p.comments}</button>
          <button data-share-post-id="${p.id}">Share</button>
        </footer>
      </article>`).join("")}</div>`;
    }
  }

  return shell(
    "Community",
    `<div class="tabs">${tabs.map((t) => `<button class="${state.communityTab === t ? "active" : ""}" data-community-tab="${t}">${t}</button>`).join("")}</div>
    ${content}
    <button class="fab" data-action="${state.communityTab === "Events" ? "compose-event" : "compose-post"}">${icons.plus}</button>`,
    { right: iconButton("Sort", "☷", `data-action="community-sort"`) }
  );
}

function timeAgo(iso) {
  const d = new Date(iso);
  const diff = (Date.now() - d) / 1000;
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}

function formatCommunityDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function messages() {
  const rows = state.conversations.length
    ? state.conversations.map((c) => `<article class="message-row"><span class="avatar">${c.name[0].toUpperCase()}</span><div><b>${escapeHtml(c.name)}</b><p>${escapeHtml(c.body)}</p></div><time>${escapeHtml(c.time)}</time>${c.unread_count ? `<em>${c.unread_count}</em>` : ""}<button class="message-delete" data-delete-message="${c.message_id}" aria-label="Delete message">×</button></article>`).join("")
    : state.messagesLoaded
      ? `<div class="empty-state"><p>No messages yet.</p><button class="primary" data-screen="${screens.search}">Find a host</button></div>`
      : `<div class="loading-state">${icons.spinner} Loading messages…</div>`;
  return shell(
    "Messages",
    `<label class="searchbox small">${icons.search}<input placeholder="Search messages" /></label>
    <div class="message-list">${rows}</div>`,
    { right: iconButton("More", "⋮", `data-action="message-more"`) }
  );
}

function bookings() {
  const tabs = ["Upcoming", "Current", "Past"];
  let content = "";
  if (!state.bookings.length) {
    content = `<div class="empty-state"><p>No bookings yet.</p><button class="primary" data-screen="${screens.search}">Find Housing</button></div>`;
  } else {
    content = `<div class="booking-stack">${state.bookings.map((b) => `<article class="booking">
      <div class="booking-visual room-${b.listing_theme}"><div class="room-scene tiny"><i></i><i></i><i></i></div></div>
      <div>
        <h2>${b.listing_title}</h2>
        <p>${b.start_date} – ${b.end_date}</p>
        <b>€${b.price} / month</b>
        <span class="${b.status}">${b.status.charAt(0).toUpperCase() + b.status.slice(1)}</span>
      </div>
      <footer><button data-action="booking-details">View Details</button><button data-action="contact-host">Contact Host</button></footer>
    </article>`).join("")}</div>`;
  }
  return shell(
    "My Bookings",
    `<div class="tabs">${tabs.map((t) => `<button class="${state.bookingsTab === t ? "active" : ""}" data-bookings-tab="${t}">${t}</button>`).join("")}</div>
    ${content}`,
    { right: iconButton("Filter", "☷", `data-action="booking-filter"`) }
  );
}

function profile() {
  if (!state.profileLoaded) {
    return shell(
      "Profile",
      `<div class="loading-state">${icons.spinner} Loading profile…</div>`
    );
  }
  const u = state.user || {};
  const initials = u.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
  const summary = state.profileSummary || {
    saved_count: state.savedIds.size,
    booking_count: state.bookings.length,
    checklist_done_count: state.checklistDone.size,
    post_count: 0,
    tips_count: 0,
    answers_count: 0,
    support_case_count: 0,
  };
  const latestVerification = state.verificationRequests[0];
  const verificationLabel = u.is_verified
    ? "✓ Verified"
    : latestVerification?.status === "pending" ? "Verification pending" : "Unverified";
  const activityRows = [
    summary.saved_count ? `<div class="activity-row"><span class="activity-icon">❤️</span><div><b>Saved ${summary.saved_count} listing${summary.saved_count !== 1 ? "s" : ""}</b><p>From your housing searches</p></div></div>` : "",
    summary.booking_count ? `<div class="activity-row"><span class="activity-icon">🏠</span><div><b>${summary.booking_count} booking request${summary.booking_count !== 1 ? "s" : ""}</b><p>Tracked in My Bookings</p></div></div>` : "",
    summary.checklist_done_count ? `<div class="activity-row"><span class="activity-icon">✅</span><div><b>${summary.checklist_done_count} checklist task${summary.checklist_done_count !== 1 ? "s" : ""} completed</b><p>Saved to your account</p></div></div>` : "",
    latestVerification ? `<div class="activity-row"><span class="activity-icon">✓</span><div><b>Verification ${latestVerification.status}</b><p>${new Date(latestVerification.created_at).toLocaleDateString()}</p></div></div>` : "",
  ].filter(Boolean);
  return shell(
    "",
    `<header class="profile-hero">
      <button class="profile-photo" data-profile="Profile Photo">${u.profile_photo_url ? `<img src="${u.profile_photo_url}" alt="${escapeHtml(u.full_name || "Profile photo")}" />` : initials}</button>
      <h1>${u.full_name || "—"}</h1>
      <p>${u.location || "Berlin, Germany"}</p>
      <span>${verificationLabel}</span>
    </header>
    <div class="stats">
      <button data-action="saved-listings">${summary.saved_count}<span>Saved</span></button>
      <button data-screen="${screens.bookings}">${summary.booking_count}<span>Bookings</span></button>
      <button data-screen="${screens.community}">${summary.post_count}<span>Posts</span></button>
    </div>
    <div class="menu-list">${["Edit Profile", "Profile Photo", "Verification", "Payment Methods", "Saved Searches", "Settings", "Help & Support"].map((item) => `<button data-profile="${item}"><span>${profileItemIcon(item)}</span>${item}<b>›</b></button>`).join("")}</div>
    <h2 class="section-title profile-section-title">Recent Activity</h2>
    <div class="activity-list">${activityRows.length ? activityRows.join("") : `<div class="empty-state"><p>No account activity yet.</p><button class="primary" data-screen="${screens.community}">Visit community</button></div>`}</div>
    <h2 class="section-title profile-section-title">Contributions</h2>
    <div class="contrib-grid">
      <div class="contrib-card"><b>${summary.tips_count}</b><span>Tips shared</span></div>
      <div class="contrib-card"><b>${summary.answers_count}</b><span>Question posts</span></div>
      <div class="contrib-card"><b>${summary.support_case_count}</b><span>Support cases</span></div>
    </div>
    <button class="logout-btn" data-action="logout">Sign out</button>`
  );
}

function profileItemIcon(item) {
  return { "Edit Profile": "♙", "Profile Photo": "◉", Verification: "✓", "Payment Methods": "▣", "Saved Searches": "⌕", Settings: "⚙", "Help & Support": "☼" }[item];
}

function adminDashboard() {
  const a = state.admin;
  if (!a.loaded) {
    return shell("Admin", `<div class="loading-state">${icons.spinner} Loading admin dashboard…</div>`, { hideNav: true, className: "admin-screen" });
  }
  if (!a.me) {
    return shell(
      "Admin",
      `<div class="empty-state"><h2>Admin access required</h2><p>This dashboard is gated to approved admins and moderators.</p><button class="primary" data-action="logout">Sign in with another account</button></div>`,
      { hideNav: true, className: "admin-screen" }
    );
  }
  const summary = a.summary || {};
  const listingRow = (l) => `<article class="admin-row admin-edit-row">
    <form class="admin-inline-form admin-listing-edit" data-admin-listing-form="${l.id}">
      <input name="title" value="${escapeHtml(l.title)}" aria-label="Listing title" required />
      <input name="price" type="number" min="100" value="${l.price}" aria-label="Monthly rent" required />
      <input name="postcode" value="${escapeHtml(l.postcode || "")}" aria-label="Postal code" placeholder="Postcode" />
      <input name="city_name" value="${escapeHtml(l.city_name || "")}" aria-label="City" placeholder="City" />
      <input name="district" value="${escapeHtml(l.district || "")}" aria-label="District" placeholder="District" />
      <span class="admin-meta">${escapeHtml(l.approval_status)} · Host #${l.host_id || "-"}</span>
      <button type="submit">Save</button>
      <button type="button" data-admin-listing="${l.id}" data-status="approved">Approve</button>
      <button type="button" data-admin-listing="${l.id}" data-status="rejected">Reject</button>
      <button type="button" data-admin-listing="${l.id}" data-status="suspended">Suspend</button>
      <button type="button" data-admin-listing="${l.id}" data-status="ended">End</button>
      <button type="button" data-admin-listing-delete="${l.id}">Delete</button>
    </form>
  </article>`;
  const eventRow = (e) => `<article class="admin-row">
    <div><b>${escapeHtml(e.title)}</b><span>${escapeHtml(e.location)} · ${escapeHtml(e.ticket_price || "Ticketed")}</span></div>
    <div class="admin-actions"><button data-admin-event="${e.id}" data-status="approved">Approve</button><button data-admin-event="${e.id}" data-status="rejected">Reject</button><button data-admin-event="${e.id}" data-status="suspended">Suspend</button></div>
  </article>`;
  const caseRow = (c) => `<article class="admin-row">
    <div>
      <b>${escapeHtml(c.case_ref)} · ${escapeHtml(c.case_type)}</b>
      <span>${escapeHtml(c.user_name || "User")} · ${escapeHtml(c.user_email || `#${c.user_id}`)}</span>
      <span>${escapeHtml(c.contact_phone || "No phone")} · ${escapeHtml(c.location || "No location")} · ${escapeHtml(c.contact_pref || "No preference")}</span>
      <span>${escapeHtml(c.request_summary || c.description || "No request summary")}</span>
    </div>
    <form class="admin-case-form" data-admin-case-form="${c.id}">
      <textarea name="message_body" rows="2" placeholder="Write a message to the user or note callback action"></textarea>
      <div class="admin-actions">
        <button type="submit" name="status" value="assigned">Log callback</button>
        <button type="submit" name="status" value="escalated">Escalate</button>
        <button type="submit" name="status" value="resolved">Resolve</button>
      </div>
    </form>
  </article>`;
  const inviteRow = (i) => `<article class="admin-row">
    <div><b>${escapeHtml(i.email)}</b><span>Invited by #${i.invited_by} · ${escapeHtml(i.status)}</span></div>
    <div class="admin-actions">${a.me.role === "admin" ? `<button data-admin-invite="${i.id}">Approve</button>` : "<span>Awaiting admin</span>"}</div>
  </article>`;
  const announcementRow = (ann) => `<article class="admin-row admin-edit-row">
    <form class="admin-inline-form admin-announcement-edit" data-admin-announcement-form="${ann.id}">
      <input name="title" value="${escapeHtml(ann.title)}" aria-label="Announcement title" required />
      <input name="body" value="${escapeHtml(ann.body)}" aria-label="Announcement body" required />
      <select name="status" aria-label="Announcement status">
        ${["draft", "published", "archived"].map((status) => `<option value="${status}" ${ann.status === status ? "selected" : ""}>${status}</option>`).join("")}
      </select>
      <button type="submit">Save</button>
      <button type="button" data-admin-announcement-delete="${ann.id}">Delete</button>
    </form>
  </article>`;
  const adminMessageRow = (m) => `<article class="admin-row">
    <div>
      <b>${escapeHtml(m.from_name || "Message")}</b>
      <span>From #${escapeHtml(m.from_user_id)} to #${escapeHtml(m.to_user_id)} · ${new Date(m.created_at).toLocaleString()}</span>
      <span>${escapeHtml(m.body)}</span>
    </div>
    <div class="admin-actions"><button data-admin-message-delete="${m.id}">Delete</button></div>
  </article>`;
  return shell(
    "Admin",
    `<section class="admin-hero">
      <div><h1>Operations</h1><p>${escapeHtml(a.me.email)} · ${escapeHtml(a.me.role)}</p></div>
      <button class="secondary mini-cta" data-action="logout">Sign out</button>
    </section>
    <div class="admin-stats">
      <b>${summary.pending_listings || 0}<span>Listing reviews</span></b>
      <b>${summary.pending_ticketed_events || 0}<span>Ticketed events</span></b>
      <b>${summary.open_support_cases || 0}<span>Open support</span></b>
      <b>${summary.pending_moderator_invites || 0}<span>Moderator invites</span></b>
    </div>
    <section class="admin-panel"><h2>Listing Management</h2>${a.listings.length ? a.listings.map(listingRow).join("") : `<p class="admin-empty">No listings yet.</p>`}</section>
    <section class="admin-panel"><h2>Ticketed Event Approval</h2>${a.events.length ? a.events.map(eventRow).join("") : `<p class="admin-empty">No pending ticketed events.</p>`}</section>
    <section class="admin-panel"><h2>Care & Emergency Support</h2>${a.supportCases.length ? a.supportCases.map(caseRow).join("") : `<p class="admin-empty">No open support cases.</p>`}</section>
    <section class="admin-panel">
      <h2>Moderator Invites</h2>
      <form class="admin-inline-form" id="admin-invite-form">
        <input name="email" type="email" placeholder="moderator@email.com" required />
        <label><input name="perm_listings" type="checkbox" checked /> Listings</label>
        <label><input name="perm_community" type="checkbox" checked /> Community</label>
        <label><input name="perm_support" type="checkbox" /> Support</label>
        <button class="primary" type="submit">Invite moderator</button>
      </form>
      ${a.invites.length ? a.invites.map(inviteRow).join("") : `<p class="admin-empty">No pending moderator invites.</p>`}
    </section>
    <section class="admin-panel">
      <h2>Announcements</h2>
      <form class="admin-form" id="admin-announcement-form">
        <input name="title" placeholder="Announcement title" required />
        <textarea name="body" rows="3" placeholder="Community notice" required></textarea>
        <div class="finder-row"><select name="channel"><option value="community">Community board</option><option value="messages">Messages</option></select><select name="audience"><option value="all">All users</option><option value="newcomers">Newcomers</option><option value="verified">Verified users</option></select></div>
        <button class="primary" type="submit">Publish announcement</button>
      </form>
      ${a.announcements.slice(0, 6).map(announcementRow).join("") || `<p class="admin-empty">No announcements yet.</p>`}
    </section>
    <section class="admin-panel"><h2>Message Moderation</h2>${a.messages.slice(0, 8).map(adminMessageRow).join("") || `<p class="admin-empty">No user messages yet.</p>`}</section>
    <section class="admin-panel"><h2>Audit Log</h2>${a.audit.slice(0, 8).map((log) => `<article class="admin-row"><div><b>${escapeHtml(log.action)}</b><span>${escapeHtml(log.target_type)} #${escapeHtml(log.target_id || "-")} · ${new Date(log.created_at).toLocaleString()}</span></div></article>`).join("") || `<p class="admin-empty">No audit entries yet.</p>`}</section>`,
    { hideNav: true, className: "admin-screen" }
  );
}

function rathausCards(offices) {
  if (!offices.length) return `<div class="empty-state"><p>No offices loaded for ${state.selectedCity?.name || "this city"} yet.</p><button class="primary" data-action="city-selector">Choose another city</button></div>`;
  return offices.map((o, i) => `<article class="authority-card" id="office-card-${i}">
    <div class="office-num">${i + 1}</div>
    <div class="office-body">
      <h2>${escapeHtml(o.name)}</h2>
      <p class="office-addr">📍 ${escapeHtml(o.address || o.city_name || "Germany")}</p>
      <div class="office-meta">
        <span class="dist-pill">${o.office_type === "auslaenderbehorde" ? "Visa / residence" : "Registration"}</span>
        ${o.distance_km ? `<span>🚶 ${o.distance_km.toFixed(1)} km</span>` : ""}
        ${o.phone ? `<span>📞 ${escapeHtml(o.phone)}</span>` : ""}
      </div>
      <div class="chips"><span>${escapeHtml(o.city_name || state.selectedCity?.name || "Nearby")}</span><span>${escapeHtml(o.state_abbreviation || "")}</span>${o.is_verified ? "<b>Verified</b>" : o.source === "openstreetmap" ? "<span>OSM result</span>" : ""}</div>
      <div class="office-cta">
        <a class="secondary mini-cta" href="${escapeHtml(o.appointment_url || o.website || "https://www.115.de/")}" target="_blank" rel="noopener">Book appointment ↗</a>
        <a class="directions-link" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(o.address || o.city_name || state.selectedCity?.name || "Germany")}" target="_blank" rel="noopener">Directions ↗</a>
        ${o.source_url ? `<a class="directions-link" href="${escapeHtml(o.source_url)}" target="_blank" rel="noopener">Source ↗</a>` : ""}
      </div>
    </div>
  </article>`).join("");
}

function rathaus() {
  const query = state.rathausQuery || {};
  return shell(
    "Rathaus Finder",
    `<button class="city-selector-row" data-action="city-selector">
      <span>Official-services city</span><b>${state.selectedCity?.name || "Berlin"}</b><small>${state.selectedCity?.state_name || "Germany"}</small>
    </button>
    <form class="finder-form" data-rathaus-form>
      <div class="finder-row">
        <label>Address or area
          <input name="address" placeholder="e.g. Sonnenallee 107, Berlin" value="${escapeHtml(query.address || "")}" autocomplete="street-address" />
        </label>
        <label>Postcode
          <input name="postcode" placeholder="12045" value="${escapeHtml(query.postcode || "")}" inputmode="numeric" />
        </label>
      </div>
      <button class="primary" type="submit" ${state.rathausLoading ? "disabled" : ""}>${state.rathausLoading ? icons.spinner + " Searching…" : "Find closest offices"}</button>
      <p class="route-note">${state.rathausSearchLabel ? `Showing closest municipal offices to ${escapeHtml(state.rathausSearchLabel)}. Confirm services and appointment rules before visiting.` : "Enter your address or area to discover and rank nearby municipal offices. Without an address, Karibu shows offices for the selected city."}</p>
    </form>
    <div id="rathaus-map" class="leaflet-map-container"></div>
    <div id="rathaus-cards" class="authority-list">
      ${state.rathausLoading
        ? `<div class="loading-state">${icons.spinner} Loading nearby offices…</div>`
        : state.rathausResults.length ? rathausCards(state.rathausResults) : `<div class="empty-state"><p>No offices found near that location yet.</p><button class="primary" data-action="city-selector">Choose another city</button></div>`}
    </div>`,
    { back: screens.home, right: iconButton("Emergency help", icons.shield, `data-screen="${screens.emergency}"`) }
  );
}

function emergencyCardActions(c) {
  const parts = [];

  if (c.phones) {
    c.phones.forEach((p) => {
      parts.push(`<a class="sc-call" href="${p.number}">📞 ${p.label}</a>`);
    });
  }
  if (c.url) {
    parts.push(`<a class="sc-link" href="${c.url.href}" target="_blank" rel="noopener">${c.url.label}</a>`);
  }
  if (c.address) {
    parts.push(`<a class="sc-link" href="${c.address.href}" target="_blank" rel="noopener">📍 ${c.address.label}</a>`);
  }
  if (c.action_type === "case" || c.action_type === "case+call") {
    parts.push(`<button class="primary sc-case-btn" data-case-type="${c.case_type}"${c.contact_pref_prompt ? ' data-ask-pref="true"' : ""}>${c.action}</button>`);
  }

  return `<div class="sc-actions">${parts.join("")}</div>`;
}

function emergencyServiceActions(c) {
  const phone = c.phone ? `<a class="sc-call" href="tel:${c.phone.replace(/\s+/g, "")}">📞 ${escapeHtml(c.phone)}</a>` : "";
  const websiteLabel = c.website ? c.website.replace(/^https?:\/\//, "").replace(/\/$/, "") : "";
  const website = c.website ? `<a class="sc-link" href="${escapeHtml(c.website)}" target="_blank" rel="noopener">${escapeHtml(websiteLabel)} ↗</a>` : "";
  const address = c.address ? `<a class="sc-link" href="${escapeHtml(c.map_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`)}" target="_blank" rel="noopener">📍 ${escapeHtml(c.address)}</a>` : "";
  const hours = c.office_hours ? `<span class="sc-link">Office Hours: ${escapeHtml(c.office_hours)}</span>` : "";
  const languages = c.languages ? `<span class="sc-link">${escapeHtml(c.languages)}</span>` : "";
  return `<div class="sc-actions">${[phone, website, address, hours, languages].filter(Boolean).join("")}</div>`;
}

function emergency() {
  if (state.emergencyType === "Poison") state.emergencyType = "All";
  const tabs = ["All", "Mental health", "Embassy", "Immigrant support", "Care", "Short stay"];
  const services = [
    ...(state.emergencyData?.national || []),
    ...(state.emergencyData?.state_specific || []),
  ].filter((s) => s.category !== "poison");
  const cards = [
    ...services.map((s) => ({
      kind: "service",
      type: serviceTypeLabel(s.category),
      title: s.name,
      org: s.scope === "national" ? "Germany-wide" : (state.emergencyData?.state_name || state.selectedCity?.state_name || "Regional"),
      availability: s.available_24h ? "24/7" : "Office hours",
      tone: serviceTone(s.category),
      detail: s.description,
      phone: s.phone,
      website: s.website,
      address: s.address,
      map_url: s.map_url,
      office_hours: s.office_hours,
      category: s.category,
      languages: s.languages,
    })),
    {
      kind: "case",
      type: "Care",
      title: "Care and support",
      org: "Karibu community network",
      availability: "< 2 hrs response",
      tone: "green",
      detail: "Speak with a trusted community leader for pastoral care, emergencies, grief and crisis support.",
      category: "care",
      case_type: "pastoral",
    },
    {
      kind: "case",
      type: "Short stay",
      title: "Emergency short-stay help",
      org: "Karibu + local shelter network",
      availability: "Tonight",
      tone: "gold",
      detail: "Request urgent guidance for temporary safe accommodation. Karibu will triage the case and point you toward vetted community or local shelter options.",
      category: "short_stay",
      case_type: "short_stay",
      action: "Request safe stay",
    },
  ];
  const contacts = state.emergencyType === "All"
    ? cards
    : cards.filter((c) => c.type === state.emergencyType);

  return shell(
    "Emergency Help",
    `<div class="urgent-panel">
      <div class="urgent-numbers">
        <a class="urgent-num red" href="tel:110"><span>110</span><small>Police</small></a>
        <a class="urgent-num red" href="tel:112"><span>112</span><small>Ambulance</small></a>
        <a class="urgent-num green" href="tel:115"><span>115</span><small>City services</small></a>
      </div>
      <p>Call emergency services first if there is immediate danger. Numbers are cached for offline use.</p>
    </div>
    <button class="city-selector-row" data-action="city-selector">
      <span>Emergency region</span><b>${state.selectedCity?.name || "Germany"}</b><small>${state.emergencyData?.state_name || state.selectedCity?.state_name || "National numbers"}</small>
    </button>
    <div class="support-tabs">${tabs.map((t) => `<button class="${state.emergencyType === t ? "active" : ""}" data-emergency-type="${t}">${t}</button>`).join("")}</div>
    <div class="support-list">${contacts.map((c) => `<article class="support-card ${c.tone}">
      <div class="sc-header">
        <span class="sc-tag ${c.tone}">${c.type}</span>
        <span class="sc-avail">${c.availability}</span>
      </div>
      <h2>${c.title}</h2>
      <p class="sc-detail">${c.detail}</p>
      <p class="sc-org">— ${c.org}</p>
      ${c.kind === "case"
        ? `<div class="sc-actions"><button class="primary sc-case-btn" data-case-type="${c.case_type}" data-ask-pref="true">${c.action || "Request callback"}</button></div>`
        : emergencyServiceActions(c)}
    </article>`).join("")}</div>`,
    { back: screens.home, right: iconButton("Rathaus finder", icons.map, `data-screen="${screens.rathaus}"`) }
  );
}

function serviceTypeLabel(category) {
  return {
    police: "Police",
    fire: "Fire",
    ambulance: "Ambulance",
    poison: "Poison",
    mental_health: "Mental health",
    embassy: "Embassy",
    immigrant_support: "Immigrant support",
  }[category] || "Other";
}

function serviceTone(category) {
  return {
    police: "red",
    fire: "red",
    ambulance: "red",
    poison: "gold",
    mental_health: "green",
    embassy: "slate",
    immigrant_support: "green",
  }[category] || "slate";
}

// ── Render ────────────────────────────────────────────────────
function render() {
  // Always destroy Leaflet map before replacing DOM; initRathausMap re-creates it
  if (_rathausMap) { _rathausMap.remove(); _rathausMap = null; }
  const currentBody = app.querySelector(".screen-body");
  if (currentBody && renderedScreen) {
    state.scrollPositions[renderedScreen] = currentBody.scrollTop;
  }
  const screenMap = { splash, login, register, home, search, detail, listRoom, assistant, checklist, community, messages, bookings, profile, rathaus, emergency, admin: adminDashboard };
  app.innerHTML = screenMap[state.screen]?.() ?? "";
  renderedScreen = state.screen;
  const nextBody = app.querySelector(".screen-body");
  if (nextBody) {
    const savedScroll = state.scrollPositions[state.screen] || 0;
    if (savedScroll) requestAnimationFrame(() => { nextBody.scrollTop = savedScroll; });
  }
  if (state.screen === screens.rathaus) requestAnimationFrame(initRathausMap);
}

// ── Event Delegation ──────────────────────────────────────────
app.addEventListener("click", (e) => {
  const screenBtn = e.target.closest("[data-screen]");
  const actionBtn = e.target.closest("[data-action]");
  const saveBtn = e.target.closest("[data-save-id]");
  const listingBtn = e.target.closest("[data-listing-id]");
  const taskBtn = e.target.closest("[data-task]");
  const chatBtn = e.target.closest("[data-chat]");
  const communityTabBtn = e.target.closest("[data-community-tab]");
  const bookingsTabBtn = e.target.closest("[data-bookings-tab]");
  const emergencyTypeBtn = e.target.closest("[data-emergency-type]");
  const likeBtn = e.target.closest("[data-like-id]");
  const rsvpBtn = e.target.closest("[data-rsvp-id]");
  const commentBtn = e.target.closest("[data-comment-id]");
  const sharePostBtn = e.target.closest("[data-share-post-id]");
  const editPostBtn = e.target.closest("[data-edit-post-id]");
  const deletePostBtn = e.target.closest("[data-delete-post-id]");
  const bookBtn = e.target.closest("[data-book-id]");
  const profileBtn = e.target.closest("[data-profile]");
  const officeBtn = e.target.closest("[data-office]");
  const caseBtn = e.target.closest("[data-case-type]");
  const carouselBtn = e.target.closest("[data-carousel-listing]");
  const amenityRemoveBtn = e.target.closest("[data-amenity-remove]");
  const cityBtn = e.target.closest("[data-city-id]");
  const deleteMessageBtn = e.target.closest("[data-delete-message]");
  const adminListingBtn = e.target.closest("[data-admin-listing]");
  const adminListingDeleteBtn = e.target.closest("[data-admin-listing-delete]");
  const adminEventBtn = e.target.closest("[data-admin-event]");
  const adminCaseBtn = e.target.closest("[data-admin-case]");
  const adminInviteBtn = e.target.closest("[data-admin-invite]");
  const adminAnnouncementDeleteBtn = e.target.closest("[data-admin-announcement-delete]");
  const adminMessageDeleteBtn = e.target.closest("[data-admin-message-delete]");

  if (amenityRemoveBtn) {
    state.listRoomAmenities = state.listRoomAmenities.filter((a) => a !== amenityRemoveBtn.dataset.amenityRemove);
    updateAmenityPickerDom();
    return;
  }
  if (carouselBtn) { openCarousel(parseInt(carouselBtn.dataset.carouselListing, 10)); return; }
  if (cityBtn) { selectCity(parseInt(cityBtn.dataset.cityId, 10)); return; }
  if (deleteMessageBtn) { deleteMessage(parseInt(deleteMessageBtn.dataset.deleteMessage, 10)); return; }
  if (adminListingDeleteBtn) { deleteAdminListing(parseInt(adminListingDeleteBtn.dataset.adminListingDelete, 10)); return; }
  if (adminListingBtn) { updateAdminListing(parseInt(adminListingBtn.dataset.adminListing, 10), adminListingBtn.dataset.status); return; }
  if (adminEventBtn) { updateAdminEvent(parseInt(adminEventBtn.dataset.adminEvent, 10), adminEventBtn.dataset.status); return; }
  if (adminCaseBtn) { updateAdminCase(parseInt(adminCaseBtn.dataset.adminCase, 10), adminCaseBtn.dataset.status); return; }
  if (adminInviteBtn) { approveAdminInvite(parseInt(adminInviteBtn.dataset.adminInvite, 10)); return; }
  if (adminAnnouncementDeleteBtn) { deleteAdminAnnouncement(parseInt(adminAnnouncementDeleteBtn.dataset.adminAnnouncementDelete, 10)); return; }
  if (adminMessageDeleteBtn) { deleteAdminMessage(parseInt(adminMessageDeleteBtn.dataset.adminMessageDelete, 10)); return; }
  if (actionBtn && (!actionBtn.classList.contains("demo-backdrop") || e.target === actionBtn)) {
    handleAction(actionBtn.dataset.action);
    return;
  }
  if (saveBtn) { handleSave(parseInt(saveBtn.dataset.saveId)); return; }
  if (bookBtn) { handleBook(parseInt(bookBtn.dataset.bookId)); return; }
  if (likeBtn) { handleLike(parseInt(likeBtn.dataset.likeId)); return; }
  if (commentBtn) { openComments(parseInt(commentBtn.dataset.commentId, 10)); return; }
  if (sharePostBtn) { shareCommunityPost(parseInt(sharePostBtn.dataset.sharePostId, 10)); return; }
  if (editPostBtn) { openCommunityPostEdit(parseInt(editPostBtn.dataset.editPostId, 10)); return; }
  if (deletePostBtn) { deleteCommunityPost(parseInt(deletePostBtn.dataset.deletePostId, 10)); return; }
  if (rsvpBtn) { handleRsvp(parseInt(rsvpBtn.dataset.rsvpId)); return; }
  if (caseBtn) { handleEmergencyCase(caseBtn.dataset.caseType, caseBtn.dataset.askPref === "true"); return; }
  if (listingBtn && !saveBtn) { handleOpenListing(parseInt(listingBtn.dataset.listingId)); return; }
  if (taskBtn) { handleTask(taskBtn.dataset.task); return; }
  if (chatBtn) { handleChat(chatBtn.dataset.chat); return; }
  if (communityTabBtn && screenBtn) {
    state.communityTab = communityTabBtn.dataset.communityTab;
    setScreen(screenBtn.dataset.screen);
    return;
  }
  if (communityTabBtn) { state.communityTab = communityTabBtn.dataset.communityTab; render(); loadCommunity(state.communityTab); return; }
  if (bookingsTabBtn) { state.bookingsTab = bookingsTabBtn.dataset.bookingsTab; render(); return; }
  if (emergencyTypeBtn) { state.emergencyType = emergencyTypeBtn.dataset.emergencyType; render(); return; }
  if (profileBtn) { openSheet(profileBtn.dataset.profile, profileSheet(profileBtn.dataset.profile), "Close"); return; }
  if (officeBtn) { openSheet("Authority details", `<p class="sheet-copy">${officeBtn.dataset.office} — appointment booking, registration and address services.</p>`, "Use this office"); return; }
  if (screenBtn) { setScreen(screenBtn.dataset.screen); return; }
});

async function handleSave(id) {
  try {
    const res = await api.listings.toggleSave(id);
    if (res.saved) {
      state.savedIds.add(id);
      showToast("Saved to favorites");
    } else {
      state.savedIds.delete(id);
      showToast("Removed from saved");
    }
    render();
  } catch { showToast("Could not save listing"); }
}

function handleOpenListing(id) {
  state.detailListing = state.listings.find((l) => l.id === id) || null;
  setScreen(screens.detail);
}

function openCarousel(id) {
  const listing = state.listings.find((l) => l.id === id) || state.detailListing;
  const images = listing?.images || [];
  if (!images.length) return;
  state.carousel = { images, index: 0 };
  render();
}

function selectCity(id) {
  const city = state.cities.find((c) => c.id === id);
  if (!city) return;
  state.selectedCity = city;
  state.locationStatus = `${city.name}, ${city.state_abbreviation}`;
  state.sheet = null;
  localStorage.setItem("karibu_city_id", String(city.id));
  render();
  loadListings();
  if (state.screen === screens.rathaus) loadRathaus();
  if (state.screen === screens.emergency) loadEmergency();
}

function citySelectorSheet() {
  const tier1 = state.cities.filter((c) => c.is_tier_1);
  const other = state.cities.filter((c) => !c.is_tier_1);
  const cityButton = (c) => `<button class="${state.selectedCity?.id === c.id ? "active" : ""}" data-city-id="${c.id}">
    <b>${c.name}</b><span>${c.state_name || c.state_abbreviation} · ${c.listing_count} listing${c.listing_count === 1 ? "" : "s"}</span>
  </button>`;
  return `<div class="city-picker">
    <p class="sheet-copy">Choose the city for housing, Rathaus Finder, and emergency support. Cities with no rooms still show official-service coverage.</p>
    <h3>Core cities</h3>
    <div class="city-picker-grid">${tier1.map(cityButton).join("")}</div>
    <h3>Explore Germany</h3>
    <div class="city-picker-grid">${other.map(cityButton).join("")}</div>
  </div>`;
}

async function handleTask(key) {
  const wasDone = state.checklistDone.has(key);
  wasDone ? state.checklistDone.delete(key) : state.checklistDone.add(key);
  render();
  try {
    await api.checklist.toggle(key);
  } catch {
    wasDone ? state.checklistDone.add(key) : state.checklistDone.delete(key);
    render();
    showToast("Could not save progress");
  }
}

async function handleChat(text) {
  state.messages.push({ from: "user", text });
  state.messages.push({ from: "bot", text: "…" });
  render();
  scrollChat();
  try {
    const history = state.messages.slice(0, -2).map((m) => ({ role: m.from === "user" ? "user" : "assistant", content: m.text }));
    const res = await api.ai.chat(text, history);
    state.messages[state.messages.length - 1] = { from: "bot", text: res.reply };
    render();
    scrollChat();
  } catch (e) {
    state.messages[state.messages.length - 1] = { from: "bot", text: e.message || "Sorry, I couldn't reach Karibu Chat right now. Please try again." };
    render();
  }
}

async function sendDirectMessage(toUserId, body, successTitle = "Message sent") {
  if (!toUserId) {
    openSheet("Messaging unavailable", `<p class="sheet-copy">This conversation cannot start yet because the recipient is not linked to a Karibu user account.</p>`, "Close");
    return;
  }
  try {
    await api.messages.send({ to_user_id: toUserId, body });
    state.messagesLoaded = false;
    openSheet(successTitle, `<p class="sheet-copy">The message was sent through Karibu in-app messaging. Phone or WhatsApp details stay private unless both sides choose to share them.</p>`, "View messages");
    state.sheet._onClose = () => setScreen(screens.messages);
  } catch (e) {
    showToast(e.message || "Could not send message");
  }
}

async function deleteMessage(id) {
  try {
    await api.messages.delete(id);
    state.conversations = state.conversations.filter((c) => c.message_id !== id);
    render();
    showToast("Message deleted");
  } catch (err) {
    showToast(err.message || "Could not delete message");
  }
}

function openListingEditSheet() {
  const l = state.detailListing;
  if (!l || l.host_id !== state.user?.id) {
    showToast("You can only edit your own listing");
    return;
  }
  openSheet(
    "Edit listing",
    `<form class="sheet-form" id="listing-edit-form">
      <fieldset class="image-buckets">
        <legend>Listing photos</legend>
        <p>${(l.images || []).length ? `${l.images.length} current photo${l.images.length === 1 ? "" : "s"}. ` : ""}Choose new images only if you want to replace the current listing photos.</p>
        <label>Main image
          <input type="file" name="main_image" accept="image/*" />
        </label>
        <label>Support image 1
          <input type="file" name="support_image_1" accept="image/*" />
        </label>
        <label>Support image 2
          <input type="file" name="support_image_2" accept="image/*" />
        </label>
      </fieldset>
      <label>Room title
        <input name="title" value="${escapeHtml(l.title)}" required maxlength="80" />
      </label>
      <label>Monthly rent (€)
        <input name="price" type="number" min="100" max="5000" value="${l.price}" required />
      </label>
      <label>Postal code
        <input name="postcode" inputmode="numeric" maxlength="5" value="${escapeHtml(l.postcode || "")}" />
      </label>
      <label>City / town
        <input name="city_name" value="${escapeHtml(l.city_name || "")}" />
      </label>
      <label>District / neighbourhood
        <input name="district" value="${escapeHtml(l.district || "")}" />
      </label>
      <label>Street address
        <input name="address" value="${escapeHtml(l.address || "")}" />
      </label>
      <label>Nearest transport
        <input name="transit_info" value="${escapeHtml(l.transit_info || "")}" />
      </label>
      <label>Description
        <textarea name="description" rows="4" maxlength="500">${escapeHtml(l.description || "")}</textarea>
      </label>
      <p class="route-note">Edited listings return to admin review before appearing publicly again.</p>
      <button class="primary" type="submit">Save changes</button>
    </form>`,
    "Close"
  );
}

async function endOwnListing() {
  const l = state.detailListing;
  if (!l || l.host_id !== state.user?.id) return;
  if (!confirm("End this listing? It will stop appearing in search results.")) return;
  try {
    const updated = await api.listings.end(l.id);
    state.detailListing = updated;
    state.listings = state.listings.filter((item) => item.id !== l.id);
    render();
    showToast("Listing ended");
  } catch (err) {
    showToast(err.message || "Could not end listing");
  }
}

async function deleteOwnListing() {
  const l = state.detailListing;
  if (!l || l.host_id !== state.user?.id) return;
  if (!confirm("Delete this listing from Karibu?")) return;
  try {
    await api.listings.delete(l.id);
    state.detailListing = null;
    state.listings = state.listings.filter((item) => item.id !== l.id);
    setScreen(screens.search);
    showToast("Listing deleted");
  } catch (err) {
    showToast(err.message || "Could not delete listing");
  }
}

function openHostMessageSheet() {
  const l = state.detailListing;
  if (!l?.host_id) {
    openSheet("Message Host", `<p class="sheet-copy">This listing does not have a linked host account yet. Use request to book or contact Karibu Support for help.</p>`, "Close");
    return;
  }
  openSheet(
    "Message Host",
    `<form class="sheet-form" id="host-message-form">
      <input type="hidden" name="to_user_id" value="${l.host_id}" />
      <label>Your message
        <textarea name="body" rows="5" required>Hi, I found your listing "${escapeHtml(l.title)}" on Karibu. Is it still available?</textarea>
      </label>
      <button class="primary" type="submit">Send in-app message</button>
      <p class="route-note">Start in Karibu messaging first. Share WhatsApp or phone only after both sides agree.</p>
    </form>`,
    "Close"
  );
}

function communityPostForm() {
  const defaultTab = state.communityTab === "Questions" || state.communityTab === "Tips" ? state.communityTab : "Questions";
  return `<form class="sheet-form" id="community-post-form">
    <label>Post type
      <select name="tab" required>
        ${["Questions", "Tips", "For You"].map((tab) => `<option value="${tab}" ${tab === defaultTab ? "selected" : ""}>${tab === "For You" ? "General post" : tab}</option>`).join("")}
      </select>
    </label>
    <label>${defaultTab === "Tips" ? "Tip" : "Question or post"}
      <textarea name="body" rows="5" maxlength="600" required placeholder="Share something useful for Kenyans in Germany."></textarea>
    </label>
    <button class="primary" type="submit">Publish to community</button>
  </form>`;
}

function communityPostEditForm(post) {
  return `<form class="sheet-form" id="community-post-edit-form">
    <input type="hidden" name="post_id" value="${post.id}" />
    <label>Post type
      <select name="tab" required>
        ${["Questions", "Tips", "For You"].map((tab) => `<option value="${tab}" ${tab === post.tab ? "selected" : ""}>${tab === "For You" ? "General post" : tab}</option>`).join("")}
      </select>
    </label>
    <label>Post
      <textarea name="body" rows="5" maxlength="600" required>${escapeHtml(post.body)}</textarea>
    </label>
    <button class="primary" type="submit">Save post</button>
  </form>`;
}

function openCommunityPostEdit(postId) {
  const post = state.communityPosts.find((p) => p.id === postId);
  if (!post || !post.is_owner) {
    showToast("You can only edit posts you created");
    return;
  }
  openSheet("Edit community post", communityPostEditForm(post), "Close");
}

async function deleteCommunityPost(postId) {
  const post = state.communityPosts.find((p) => p.id === postId);
  if (!post || !post.can_delete) {
    showToast("You do not have permission to delete this post");
    return;
  }
  if (!confirm("Delete this community post?")) return;
  try {
    await api.community.deletePost(postId);
    state.communityPosts = state.communityPosts.filter((p) => p.id !== postId);
    render();
    showToast("Community post deleted");
  } catch (err) {
    showToast(err.message || "Could not delete post");
  }
}

function communityEventForm() {
  return `<form class="sheet-form" id="community-event-form">
    <label>Event title
      <input name="title" maxlength="120" required placeholder="e.g. Berlin newcomers meetup" />
    </label>
    <label>Date and time
      <input name="date_str" type="datetime-local" required />
    </label>
    <label>Location
      <input name="location" maxlength="160" required placeholder="Venue, city, or online link" />
    </label>
    <label>Category
      <select name="tag">
        ${["Community", "Meetup", "Workshop", "Sports", "Faith", "Family"].map((tag) => `<option value="${tag}">${tag}</option>`).join("")}
      </select>
    </label>
    <label>Access
      <select name="event_access" id="event-access-select">
        <option value="free">Free event - publish immediately</option>
        <option value="ticketed">Ticketed event - requires admin approval</option>
      </select>
    </label>
    <label>Ticket link
      <input name="ticket_url" type="url" placeholder="Required only for ticketed events" />
    </label>
    <label>Ticket price
      <input name="ticket_price" maxlength="40" placeholder="e.g. EUR 15 or donation" />
    </label>
    <p class="route-note">Free community events go live immediately. Ticketed events are reviewed before they appear publicly.</p>
    <button class="primary" type="submit">Create event</button>
  </form>`;
}

function communitySortForm() {
  return `<form class="sheet-form" id="community-sort-form">
    <label>Sort posts
      <select name="sort">
        <option value="newest" ${state.communitySort === "newest" ? "selected" : ""}>Newest first</option>
        <option value="most_helpful" ${state.communitySort === "most_helpful" ? "selected" : ""}>Most helpful</option>
      </select>
    </label>
    <button class="primary" type="submit">Apply sorting</button>
  </form>`;
}

async function openComments(postId) {
  const post = state.communityPosts.find((p) => p.id === postId);
  openSheet("Comments", `<div class="loading-state">${icons.spinner} Loading comments…</div>`, "Close");
  try {
    const comments = await api.community.comments(postId);
    const rows = comments.length
      ? comments.map((c) => `<article class="comment-row"><b>${escapeHtml(c.author_name)}</b><p>${escapeHtml(c.body)}</p><span>${timeAgo(c.created_at)}</span></article>`).join("")
      : `<p class="sheet-copy">No replies yet. Add the first useful answer.</p>`;
    openSheet(
      "Comments",
      `<div class="thread-list">${rows}</div>
      <form class="sheet-form" id="community-comment-form">
        <input type="hidden" name="post_id" value="${postId}" />
        <label>Reply
          <textarea name="body" rows="4" maxlength="500" required placeholder="Reply with practical community help."></textarea>
        </label>
        <button class="primary" type="submit">Post reply</button>
      </form>`,
      "Close"
    );
  } catch (err) {
    openSheet("Comments", `<p class="sheet-copy">${escapeHtml(err.message || "Could not load comments")}</p>`, "Close");
  }
  if (post) post.comments = post.comments || 0;
}

async function shareCommunityPost(postId) {
  const post = state.communityPosts.find((p) => p.id === postId);
  const url = `${window.location.origin}${window.location.pathname}#community-post-${postId}`;
  const title = "Karibu community post";
  const text = post?.body || "Community post on Karibu Ujerumani";
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      showToast("Community post link copied");
    } else {
      openSheet("Share post", `<p class="sheet-copy">${escapeHtml(url)}</p>`, "Close");
    }
  } catch {
    showToast("Share cancelled");
  }
}

async function handleLike(id) {
  try {
    const res = await api.community.like(id);
    const post = state.communityPosts.find((p) => p.id === id);
    if (post) { post.likes = res.likes; post.is_liked = res.liked; render(); }
  } catch { showToast("Could not like post"); }
}

async function handleRsvp(id) {
  try {
    const res = await api.community.rsvp(id);
    const ev = state.events.find((e) => e.id === id);
    if (ev) { ev.rsvp_count = res.rsvp_count; ev.is_rsvped = res.rsvped; render(); }
    showToast(res.rsvped ? `RSVP confirmed: ${res.title}` : `RSVP cancelled: ${res.title}`);
  } catch { showToast("Could not RSVP"); }
}

async function updateAdminListing(id, status) {
  try {
    await api.admin.setListingStatus(id, status, `Set from admin dashboard to ${status}`);
    showToast(`Listing ${status}`);
    loadAdminData();
  } catch (err) {
    showToast(err.message || "Could not update listing");
  }
}

async function deleteAdminListing(id) {
  if (!confirm("Delete this listing from Karibu?")) return;
  try {
    await api.admin.deleteListing(id);
    showToast("Listing deleted");
    loadAdminData();
  } catch (err) {
    showToast(err.message || "Could not delete listing");
  }
}

async function updateAdminEvent(id, status) {
  try {
    await api.admin.setEventStatus(id, status, `Set from admin dashboard to ${status}`);
    showToast(`Event ${status}`);
    loadAdminData();
  } catch (err) {
    showToast(err.message || "Could not update event");
  }
}

async function updateAdminCase(id, status, messageBody = null) {
  try {
    await api.admin.updateSupportCase(id, status, `Set from admin dashboard to ${status}`, messageBody);
    showToast(`Case ${status}`);
    loadAdminData();
  } catch (err) {
    showToast(err.message || "Could not update case");
  }
}

async function approveAdminInvite(id) {
  try {
    await api.admin.approveInvite(id);
    showToast("Moderator invite approved");
    loadAdminData();
  } catch (err) {
    showToast(err.message || "Could not approve invite");
  }
}

async function updateAdminAnnouncement(id, data) {
  try {
    await api.admin.updateAnnouncement(id, data);
    showToast("Announcement updated");
    loadAdminData();
  } catch (err) {
    showToast(err.message || "Could not update announcement");
  }
}

async function deleteAdminAnnouncement(id) {
  try {
    await api.admin.deleteAnnouncement(id);
    showToast("Announcement deleted");
    loadAdminData();
  } catch (err) {
    showToast(err.message || "Could not delete announcement");
  }
}

async function deleteAdminMessage(id) {
  try {
    await api.admin.deleteMessage(id);
    showToast("Message deleted");
    loadAdminData();
  } catch (err) {
    showToast(err.message || "Could not delete message");
  }
}

async function handleBook(listingId) {
  const l = state.detailListing || state.listings.find((x) => x.id === listingId);
  if (!l) return;
  try {
    const booking = await api.bookings.create({ listing_id: listingId, start_date: "1 Jul 2024", end_date: "31 Jul 2024" });
    state.bookings.unshift(booking);
    openSheet("Booking request sent!", `<p class="sheet-copy"><strong>${l.title}</strong> has been requested. Check your bookings for status updates.</p><div class="case-number">Booking #${booking.id}</div>`, "View bookings");
    state.sheet._onClose = () => setScreen(screens.bookings);
  } catch (e) { showToast(e.message); }
}

const CASE_LABELS = {
  pastoral: "Care and support request",
  short_stay: "Emergency short-stay",
  embassy: "Embassy support",
  admin: "Lost documents / urgent paperwork",
  mental_health: "Mental health support",
};

async function handleEmergencyCase(caseType, askPref = false) {
  openSheet(CASE_LABELS[caseType] || "Support request", supportCaseForm(caseType), "Close");
}

async function submitEmergencyCase(data) {
  try {
    const res = await api.support.createCase(data);
    const label = CASE_LABELS[data.case_type] || "Support case";
    openSheet(
      "Case opened ✓",
      `<p class="sheet-copy">Your <strong>${label}</strong> has been logged. A Karibu responder will follow up through ${data.contact_pref || "in-app message"}.</p>
      <div class="case-number">${res.case_ref}</div>
      <p class="sheet-copy" style="margin-top:12px;font-size:12px">Keep this reference number. You can track the case in your messages.</p>`,
      "Done"
    );
  } catch (e) {
    showToast(e.message || "Could not open case");
  }
}

function scrollChat() {
  const el = document.getElementById("chat-messages");
  if (el) el.scrollTop = el.scrollHeight;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

function handleAction(action) {
  if (action === "close-sheet") {
    const onClose = state.sheet?._onClose;
    state.sheet = null;
    if (onClose) { onClose(); return; }
    render();
    return;
  }
  if (action === "clear-search") { state.searchQuery = ""; render(); return; }
  if (action === "city-selector") { openSheet("Choose city", citySelectorSheet(), "Close"); return; }
  if (action === "lookup-postcode") { lookupListingPostcode(); return; }
  if (action === "lookup-signup-postcode") { lookupSignupPostcode(); return; }
  if (action === "close-carousel") { state.carousel = null; render(); return; }
  if (action === "carousel-prev" && state.carousel) {
    state.carousel.index = (state.carousel.index - 1 + state.carousel.images.length) % state.carousel.images.length;
    render();
    return;
  }
  if (action === "carousel-next" && state.carousel) {
    state.carousel.index = (state.carousel.index + 1) % state.carousel.images.length;
    render();
    return;
  }
  if (action === "edit-listing") { openListingEditSheet(); return; }
  if (action === "end-listing") { endOwnListing(); return; }
  if (action === "delete-listing") { deleteOwnListing(); return; }
  if (action === "message-host" || action === "contact-host") { openHostMessageSheet(); return; }
  if (action === "support-message") {
    openSheet("Help & Support", supportCaseForm(), "Close");
    return;
  }
  if (action === "compose-post") {
    openSheet("Create community post", communityPostForm(), "Close");
    return;
  }
  if (action === "compose-event") {
    openSheet("Create event", communityEventForm(), "Close");
    return;
  }
  if (action === "community-sort") {
    openSheet("Community sorting", communitySortForm(), "Close");
    return;
  }
  if (action === "toggle-checklist") { state.checklistExpanded = !state.checklistExpanded; render(); return; }
  if (action === "logout") {
    clearToken();
    if (wantsAdminMode()) sessionStorage.removeItem("karibu_admin_route");
    state.user = null;
    state.listings = [];
    state.savedIds = new Set();
    state.checklistDone = new Set();
    state.bookings = [];
    state.conversations = [];
    state.profileSummary = null;
    state.profileSettings = null;
    state.verificationRequests = [];
    state.profileLoaded = false;
    setScreen(screens.login);
    return;
  }

  const sheets = {
    notifications: ["Notifications", "No notifications yet."],
    "filter-budget": ["Budget filter", "Filtering: up to €700/month."],
    "filter-type": ["Type filter", "Private room or verified short stay."],
    "filter-more": ["More filters", "Verified hosts, near U-Bahn, Anmeldung friendly, Wi-Fi, and furnished."],
    "share-listing": ["Share listing", "Shareable link ready for WhatsApp or Messages."],
    "message-more": ["Inbox actions", "Open a support chat from Profile > Help & Support, or contact a host from a listing."],
    "booking-details": ["Booking details", "Full dates, host contact, check-in notes, and payment status."],
    "booking-filter": ["Booking filters", "Filter by status: Upcoming, Confirmed, Pending, Past."],
    "saved-listings": ["Saved listings", `You have ${state.savedIds.size} saved listing(s).`],
    "service-chip": ["Service selected", "This office handles this registration service."],
  };

  const s = sheets[action];
  if (s) openSheet(s[0], `<p class="sheet-copy">${s[1]}</p>`, "Got it");
}

function profileSheet(item) {
  const u = state.user || {};
  if (item === "Edit Profile") {
    return `<form class="sheet-form" id="profile-form">
      <label>Full name
        <input name="full_name" value="${escapeHtml(u.full_name || "")}" required />
      </label>
      <label>Location
        <input name="location" value="${escapeHtml(u.location || "")}" placeholder="Berlin, Germany" />
      </label>
      <label>Arrival date or year
        <input name="arrived_at" value="${escapeHtml(u.arrived_at || "")}" placeholder="e.g. 2023 or March 2024" />
      </label>
      <button class="primary" type="submit">Save profile</button>
    </form>`;
  }
  if (item === "Profile Photo") {
    return `<form class="sheet-form" id="profile-photo-form">
      <label>Profile photo
        <input name="profile_photo" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required />
      </label>
      <p class="route-note">MVP0.1 stores your photo on your profile record and prepares the path for the Supabase profile-photos bucket.</p>
      <button class="primary" type="submit">${state.profilePhotoLoading ? icons.spinner + " Saving…" : "Save photo"}</button>
    </form>`;
  }
  if (item === "Verification") {
    const latest = state.verificationRequests[0];
    if (state.user?.is_verified) {
      return `<p class="sheet-copy">Your profile is verified.</p>`;
    }
    if (latest?.status === "pending") {
      return `<p class="sheet-copy">Your verification request is pending review. A Karibu reviewer will follow up through Messages if more information is needed.</p>`;
    }
    return `<form class="sheet-form" id="verification-form">
      <label>Verification type
        <select name="request_type">
          <option value="community">Community verification</option>
          <option value="host">Host verification</option>
          <option value="leader">Community leader verification</option>
        </select>
      </label>
      <label>Notes
        <textarea name="notes" rows="4" placeholder="Share your city, community connection, or reason for verification."></textarea>
      </label>
      <button class="primary" type="submit">Submit verification request</button>
    </form>`;
  }
  if (item === "Payment Methods") {
    return `<p class="sheet-copy">No payment method is required for MVP0.1. Keep deposits and rent outside Karibu until payments are formally launched.</p>`;
  }
  if (item === "Saved Searches") {
    return state.searchQuery
      ? `<p class="sheet-copy">Current search:</p><div class="case-number">${escapeHtml(state.selectedCity?.name || "Germany")} · ${escapeHtml(state.searchQuery)} · Rooms and short stays</div><button class="primary" data-screen="${screens.search}">Open housing search</button>`
      : `<p class="sheet-copy">No saved searches yet. Search housing first, then return here to reuse it.</p><button class="primary" data-screen="${screens.search}">Open housing search</button>`;
  }
  if (item === "Settings") {
    const settings = state.profileSettings || { community_replies: true, host_messages: true, event_reminders: false };
    return `<form class="settings-list" id="settings-form">
      <label><input name="community_replies" type="checkbox" ${settings.community_replies ? "checked" : ""} /> Community replies</label>
      <label><input name="host_messages" type="checkbox" ${settings.host_messages ? "checked" : ""} /> Host messages</label>
      <label><input name="event_reminders" type="checkbox" ${settings.event_reminders ? "checked" : ""} /> Event reminders</label>
      <button class="primary" type="submit">Save settings</button>
    </form>`;
  }
  if (item === "Help & Support") return supportCaseForm();
  return `<p class="sheet-copy"></p>`;
}

function supportCaseForm(defaultType = "admin") {
  return `<form class="sheet-form" id="support-case-form">
    <label>What do you need help with?
      <select name="case_type">
        ${[
          ["admin", "Lost documents / urgent paperwork"],
          ["pastoral", "Care and support"],
          ["embassy", "Embassy support"],
          ["short_stay", "Emergency short-stay"],
          ["mental_health", "Mental health support"],
        ].map(([value, label]) => `<option value="${value}" ${value === defaultType ? "selected" : ""}>${label}</option>`).join("")}
      </select>
    </label>
    <label>Phone or WhatsApp number
      <input name="contact_phone" placeholder="+49…" inputmode="tel" />
    </label>
    <label>Location
      <input name="location" placeholder="City, district, or address" value="${escapeHtml(state.user?.location || "")}" />
    </label>
    <label>Short request
      <input name="request_summary" maxlength="140" placeholder="e.g. Need a callback tonight" required />
    </label>
    <label>Details
      <textarea name="description" rows="4" placeholder="Share enough context for a Karibu responder." required></textarea>
    </label>
    <label>Preferred contact
      <select name="contact_pref">
        <option value="in_app">Karibu in-app message</option>
        <option value="whatsapp">WhatsApp</option>
        <option value="phone">Phone call</option>
      </select>
    </label>
    <button class="primary" type="submit">Open support case</button>
  </form>`;
}

// ── Form Submissions ──────────────────────────────────────────
app.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Login form
  if (e.target.id === "login-form") {
    const fd = new FormData(e.target);
    doLogin(fd.get("email"), fd.get("password"));
    return;
  }

  // Register form
  if (e.target.id === "register-form") {
    const fd = new FormData(e.target);
    state.authForm = {
      ...state.authForm,
      name: fd.get("name") || "",
      email: fd.get("email") || "",
      postcode: fd.get("postcode") || "",
      city_name: fd.get("city_name") || "",
      state_name: fd.get("state_name") || "",
    };
    state.signupLocation = signupLocationFromForm(e.target);
    doRegister(fd.get("email"), fd.get("password"), fd.get("name"));
    return;
  }

  // Rathaus form
  if (e.target.closest("[data-rathaus-form]")) {
    const fd = new FormData(e.target);
    state.rathausQuery = { address: fd.get("address") || "", postcode: fd.get("postcode") || "" };
    loadRathaus();
    return;
  }

  if (e.target.id === "profile-form") {
    const fd = new FormData(e.target);
    try {
      state.user = await api.auth.updateMe({
        full_name: fd.get("full_name"),
        location: fd.get("location"),
        arrived_at: fd.get("arrived_at"),
      });
      state.sheet = null;
      render();
      showToast("Profile saved");
    } catch (err) {
      showToast(err.message || "Could not save profile");
    }
    return;
  }

  if (e.target.id === "profile-photo-form") {
    const file = e.target.elements.profile_photo?.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("Profile photo must be under 5 MB");
      return;
    }
    state.profilePhotoLoading = true;
    try {
      const profilePhotoUrl = await readFileAsDataUrl(file);
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
      state.user = await api.auth.updateProfilePhoto({
        profile_photo_url: profilePhotoUrl,
        profile_photo_path: `profile-photos/${state.user.id}/${Date.now()}-${safeName}`,
      });
      state.profilePhotoLoading = false;
      state.sheet = null;
      render();
      showToast("Profile photo saved");
    } catch (err) {
      state.profilePhotoLoading = false;
      showToast(err.message || "Could not save photo");
    }
    return;
  }

  if (e.target.id === "verification-form") {
    const fd = new FormData(e.target);
    try {
      const req = await api.auth.createVerification({
        request_type: fd.get("request_type"),
        notes: fd.get("notes"),
      });
      state.verificationRequests = [req, ...state.verificationRequests.filter((r) => r.id !== req.id)];
      state.user = { ...state.user, verification_status: req.status };
      state.sheet = null;
      render();
      showToast("Verification request submitted");
    } catch (err) {
      showToast(err.message || "Could not submit verification");
    }
    return;
  }

  if (e.target.id === "settings-form") {
    const fd = new FormData(e.target);
    try {
      state.profileSettings = await api.auth.updateSettings({
        community_replies: fd.has("community_replies"),
        host_messages: fd.has("host_messages"),
        event_reminders: fd.has("event_reminders"),
      });
      state.sheet = null;
      render();
      showToast("Settings saved");
    } catch (err) {
      showToast(err.message || "Could not save settings");
    }
    return;
  }

  if (e.target.id === "host-message-form") {
    const fd = new FormData(e.target);
    await sendDirectMessage(parseInt(fd.get("to_user_id"), 10), fd.get("body"));
    return;
  }

  if (e.target.id === "listing-edit-form") {
    const l = state.detailListing;
    if (!l) return;
    const fd = new FormData(e.target);
    try {
      const images = await readListingImages(e.target);
      const payload = {
        title: fd.get("title"),
        price: parseInt(fd.get("price"), 10),
        postcode: fd.get("postcode") || null,
        city_name: fd.get("city_name") || null,
        district: fd.get("district") || null,
        address: fd.get("address") || null,
        transit_info: fd.get("transit_info") || null,
        description: fd.get("description") || null,
      };
      if (images.length) payload.images = images;
      const updated = await api.listings.update(l.id, payload);
      state.detailListing = updated;
      state.listings = state.listings.map((item) => item.id === updated.id ? updated : item);
      state.sheet = null;
      render();
      showToast("Listing saved for review");
    } catch (err) {
      showToast(err.message || "Could not save listing");
    }
    return;
  }

  if (e.target.id === "community-post-form") {
    const fd = new FormData(e.target);
    try {
      const post = await api.community.createPost({
        tab: fd.get("tab"),
        body: fd.get("body"),
      });
      state.sheet = null;
      state.communityTab = post.tab;
      await loadCommunity(state.communityTab);
      showToast("Community post published");
    } catch (err) {
      showToast(err.message || "Could not publish post");
    }
    return;
  }

  if (e.target.id === "community-post-edit-form") {
    const fd = new FormData(e.target);
    const postId = parseInt(fd.get("post_id"), 10);
    try {
      const post = await api.community.updatePost(postId, {
        tab: fd.get("tab"),
        body: fd.get("body"),
      });
      state.sheet = null;
      state.communityPosts = state.communityPosts.map((item) => item.id === post.id ? post : item);
      if (post.tab !== state.communityTab && state.communityTab !== "For You") {
        await loadCommunity(state.communityTab);
      } else {
        render();
      }
      showToast("Community post saved");
    } catch (err) {
      showToast(err.message || "Could not save post");
    }
    return;
  }

  if (e.target.id === "community-comment-form") {
    const fd = new FormData(e.target);
    const postId = parseInt(fd.get("post_id"), 10);
    try {
      await api.community.createComment(postId, { body: fd.get("body") });
      const post = state.communityPosts.find((p) => p.id === postId);
      if (post) post.comments = (post.comments || 0) + 1;
      state.sheet = null;
      render();
      showToast("Reply posted");
    } catch (err) {
      showToast(err.message || "Could not post reply");
    }
    return;
  }

  if (e.target.id === "community-event-form") {
    const fd = new FormData(e.target);
    const isTicketed = fd.get("event_access") === "ticketed";
    try {
      const event = await api.community.createEvent({
        title: fd.get("title"),
        date_str: formatCommunityDate(fd.get("date_str")),
        location: fd.get("location"),
        tag: fd.get("tag"),
        is_ticketed: isTicketed,
        ticket_url: fd.get("ticket_url") || null,
        ticket_price: fd.get("ticket_price") || null,
      });
      state.sheet = null;
      state.communityTab = "Events";
      state.events = [event, ...state.events.filter((e) => e.id !== event.id)];
      render();
      showToast(event.approval_status === "pending" ? "Ticketed event submitted for admin approval" : "Free community event published");
    } catch (err) {
      showToast(err.message || "Could not create event");
    }
    return;
  }

  if (e.target.id === "community-sort-form") {
    const fd = new FormData(e.target);
    state.communitySort = fd.get("sort") || "newest";
    state.sheet = null;
    await loadCommunity(state.communityTab);
    showToast("Community sorting updated");
    return;
  }

  if (e.target.id === "support-case-form") {
    const fd = new FormData(e.target);
    try {
      const res = await api.support.createCase({
        case_type: fd.get("case_type"),
        description: fd.get("description"),
        contact_pref: fd.get("contact_pref"),
        contact_phone: fd.get("contact_phone"),
        location: fd.get("location"),
        request_summary: fd.get("request_summary"),
      });
      openSheet("Case opened ✓", `<p class="sheet-copy">Your support case has been opened. A Karibu responder will follow up through your preferred route.</p><div class="case-number">${res.case_ref}</div>`, "Done");
    } catch (err) {
      showToast(err.message || "Could not open support case");
    }
    return;
  }

  if (e.target.id === "admin-invite-form") {
    const fd = new FormData(e.target);
    const permissions = JSON.stringify({
      listings: fd.has("perm_listings"),
      community: fd.has("perm_community"),
      support: fd.has("perm_support"),
    });
    try {
      await api.admin.inviteModerator(fd.get("email"), permissions);
      e.target.reset();
      showToast(state.admin.me?.role === "admin" ? "Moderator invited" : "Moderator invite submitted for admin approval");
      loadAdminData();
    } catch (err) {
      showToast(err.message || "Could not invite moderator");
    }
    return;
  }

  if (e.target.matches("[data-admin-case-form]")) {
    const fd = new FormData(e.target);
    const id = parseInt(e.target.dataset.adminCaseForm, 10);
    const status = e.submitter?.value || "assigned";
    await updateAdminCase(id, status, fd.get("message_body") || null);
    return;
  }

  if (e.target.matches("[data-admin-listing-form]")) {
    const fd = new FormData(e.target);
    const id = parseInt(e.target.dataset.adminListingForm, 10);
    try {
      await api.admin.updateListing(id, {
        title: fd.get("title"),
        price: parseInt(fd.get("price"), 10),
        postcode: fd.get("postcode") || null,
        city_name: fd.get("city_name") || null,
        district: fd.get("district") || null,
      });
      showToast("Listing saved");
      loadAdminData();
    } catch (err) {
      showToast(err.message || "Could not save listing");
    }
    return;
  }

  if (e.target.matches("[data-admin-announcement-form]")) {
    const fd = new FormData(e.target);
    const id = parseInt(e.target.dataset.adminAnnouncementForm, 10);
    await updateAdminAnnouncement(id, {
      title: fd.get("title"),
      body: fd.get("body"),
      status: fd.get("status"),
    });
    return;
  }

  if (e.target.id === "admin-announcement-form") {
    const fd = new FormData(e.target);
    try {
      await api.admin.createAnnouncement({
        title: fd.get("title"),
        body: fd.get("body"),
        channel: fd.get("channel"),
        audience: fd.get("audience"),
        publish_now: true,
      });
      e.target.reset();
      showToast("Announcement published");
      loadAdminData();
    } catch (err) {
      showToast(err.message || "Could not publish announcement");
    }
    return;
  }

  // AI chat form
  if (e.target.id === "chat-form") {
    const input = document.getElementById("chat-input");
    const text = input?.value.trim();
    if (text) { handleChat(text); if (input) input.value = ""; }
    return;
  }

  // List-a-room form
  if (e.target.id === "list-room-form") {
    const fd = new FormData(e.target);
    const images = await readListingImages(e.target);
    doListRoom({
      title: fd.get("title"),
      price: parseInt(fd.get("price"), 10),
      district: fd.get("district") || undefined,
      postcode: fd.get("postcode") || undefined,
      city_name: fd.get("city_name") || undefined,
      state_name: fd.get("state_name") || undefined,
      city_id: fd.get("city_id") ? parseInt(fd.get("city_id"), 10) : undefined,
      state_id: fd.get("state_id") ? parseInt(fd.get("state_id"), 10) : undefined,
      latitude: fd.get("latitude") ? parseFloat(fd.get("latitude")) : undefined,
      longitude: fd.get("longitude") ? parseFloat(fd.get("longitude")) : undefined,
      address: fd.get("address") || undefined,
      transit_info: fd.get("transit_info") || undefined,
      description: fd.get("description") || undefined,
      theme: fd.get("theme") || "sun",
      images,
      amenities: [...state.listRoomAmenities],
      communication_route: fd.get("communication_route") || "in_app",
    });
    return;
  }
});

// ── Search input (live filter) ────────────────────────────────
app.addEventListener("input", (e) => {
  if (e.target.id === "search-input") {
    state.searchQuery = e.target.value;
    updateSearchResultsDom();
  }
  if (e.target.id === "signup-city-name" || e.target.id === "signup-state-name") {
    state.signupLocation = {
      ...(state.signupLocation || {}),
      city_id: undefined,
      state_id: undefined,
      latitude: undefined,
      longitude: undefined,
    };
  }
});

app.addEventListener("change", (e) => {
  if (e.target.id === "amenity-select" && e.target.value) {
    if (!state.listRoomAmenities.includes(e.target.value)) {
      state.listRoomAmenities = [...state.listRoomAmenities, e.target.value];
    }
    updateAmenityPickerDom();
  }
});

function updateAmenityPickerDom() {
  const allAmenities = ["Anmeldung friendly", "Wi-Fi", "Kitchen", "Furnished", "Private room", "Heating", "Near U-Bahn", "Women-friendly", "No deposit", "Short stay"];
  const picks = document.querySelector(".amenity-picks");
  const select = document.getElementById("amenity-select");
  if (picks) {
    picks.innerHTML = state.listRoomAmenities.length
      ? state.listRoomAmenities.map((a) => `<button type="button" data-amenity-remove="${a}">${a} ×</button>`).join("")
      : `<span>No amenities added yet</span>`;
  }
  if (select) {
    select.innerHTML = `<option value="">Select to add</option>` +
      allAmenities
        .filter((a) => !state.listRoomAmenities.includes(a))
        .map((a) => `<option value="${a}">${a}</option>`)
        .join("");
  }
}

async function lookupListingPostcode() {
  const postcodeInput = document.getElementById("listing-postcode");
  const postcode = postcodeInput?.value.trim();
  if (!/^\d{5}$/.test(postcode || "")) {
    showToast("Enter a valid 5-digit German postal code");
    postcodeInput?.focus();
    return;
  }
  try {
    const result = await api.geo.postcode(postcode);
    state.listRoomLocation = result;
    render();
    showToast(`Location found: ${result.city_name}`);
  } catch (err) {
    state.listRoomLocation = { ...(state.listRoomLocation || {}), postcode };
    showToast(err.message || "Could not find that postal code");
  }
}

function signupLocationFromForm(form) {
  const fd = new FormData(form);
  const postcode = (fd.get("postcode") || "").trim();
  const cityName = (fd.get("city_name") || "").trim();
  const stateName = (fd.get("state_name") || "").trim();
  const cityId = Number(fd.get("city_id") || 0);
  const stateId = Number(fd.get("state_id") || 0);
  const latitude = Number(fd.get("latitude") || NaN);
  const longitude = Number(fd.get("longitude") || NaN);
  const location = {
    postcode,
    city_name: cityName,
    state_name: stateName,
    city_id: cityId || undefined,
    state_id: stateId || undefined,
    latitude: Number.isFinite(latitude) ? latitude : undefined,
    longitude: Number.isFinite(longitude) ? longitude : undefined,
  };
  return Object.fromEntries(Object.entries(location).filter(([, value]) => value !== "" && value !== undefined));
}

function signupLocationPayload() {
  const location = state.signupLocation || {};
  const place = [location.postcode, location.city_name].filter(Boolean).join(" ");
  return {
    ...location,
    location: [place, location.state_name].filter(Boolean).join(", ") || undefined,
  };
}

async function lookupSignupPostcode() {
  const form = document.getElementById("register-form");
  const postcodeInput = document.getElementById("signup-postcode");
  const postcode = postcodeInput?.value.trim();
  if (form) {
    const fd = new FormData(form);
    state.authForm = {
      ...state.authForm,
      name: fd.get("name") || "",
      email: fd.get("email") || "",
      postcode: fd.get("postcode") || "",
      city_name: fd.get("city_name") || "",
      state_name: fd.get("state_name") || "",
    };
  }
  if (!/^\d{5}$/.test(postcode || "")) {
    showToast("Enter a valid 5-digit German postal code");
    postcodeInput?.focus();
    return;
  }
  try {
    const result = await api.geo.postcode(postcode);
    state.signupLocation = result;
    state.authForm = {
      ...state.authForm,
      postcode: result.postcode,
      city_name: result.city_name,
      state_name: result.state_name || "",
    };
    render();
    showToast(`Signup city set to ${result.city_name}`);
  } catch (err) {
    state.signupLocation = form ? signupLocationFromForm(form) : { postcode };
    showToast(err.message || "Could not find that postal code");
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function readListingImages(form) {
  const fields = ["main_image", "support_image_1", "support_image_2"];
  const files = fields
    .map((name) => form.elements[name]?.files?.[0])
    .filter(Boolean)
    .slice(0, 3);
  return Promise.all(files.map(readFileAsDataUrl));
}

async function doListRoom(data) {
  state.listRoomLoading = true;
  render();
  try {
    const { amenities, communication_route, ...listingData } = data;
    const listing = await api.listings.create(listingData);
    const enrichedListing = { ...listing, amenities, communication_route };
    if (enrichedListing.approval_status === "approved") {
      state.listings = [enrichedListing, ...state.listings];
    }
    if (state.selectedCity && enrichedListing.city_id === state.selectedCity.id && enrichedListing.approval_status === "approved") {
      state.selectedCity = { ...state.selectedCity, listing_count: (state.selectedCity.listing_count || 0) + 1 };
      state.cities = state.cities.map((c) => c.id === state.selectedCity.id ? state.selectedCity : c);
      state.listingFallback = false;
    }
    state.listRoomLoading = false;
    state.listRoomAmenities = [];
    state.listRoomLocation = null;
    openSheet(
      "Listing submitted",
      `<p class="sheet-copy">Your room <strong>${enrichedListing.title}</strong> has been submitted for admin approval. It will appear in search results after approval.</p>
      <div class="case-number">Listing #${listing.id}</div>`,
      "Done"
    );
  } catch (e) {
    state.listRoomLoading = false;
    render();
    showToast(e.message || "Could not submit listing");
  }
}

// ── Boot ──────────────────────────────────────────────────────
registerServiceWorker();
render();
requestAnimationFrame(() => setTimeout(initAuth, 250));
