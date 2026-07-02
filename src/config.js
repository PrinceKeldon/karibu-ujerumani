export function isLocalOrPrivateHost(hostname) {
  return ["localhost", "127.0.0.1", "0.0.0.0"].includes(hostname)
    || /^10\./.test(hostname)
    || /^192\.168\./.test(hostname)
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
}

export function getApiBase() {
  const configured = window.KARIBU_API_BASE || localStorage.getItem("karibu_api_base");
  if (configured) return configured.replace(/\/$/, "");

  const { protocol, hostname, origin } = window.location;
  if (isLocalOrPrivateHost(hostname)) return `${protocol}//${hostname}:8000`;

  return origin;
}

export const API_BASE = getApiBase();
