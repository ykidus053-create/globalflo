const LOADER_MIN_MS = 700;
const loader = document.getElementById("site-loader");
const loaderStart = performance.now();
const UX_STORE_KEY = "globalflow_ux_state_v2";
const UX_SESSION_KEY = "globalflow_ux_session_id";
const UX_VARIANT_KEY = "globalflow_ux_variant";
const UX_CONSENT_KEY = "globalflow_personalization_consent";

function personalizationConsentEnabled() {
  try {
    const raw = localStorage.getItem(UX_CONSENT_KEY);
    if (raw === null) return true;
    return raw !== "false";
  } catch (_) {
    return true;
  }
}

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function loadUxState() {
  const base = {
    interactions: {},
    intents: {
      finance: 0,
      workflow: 0,
      compliance: 0,
      documents: 0,
    },
    userSegment: "general",
    scans: 0,
    contrastWarnings: 0,
    preferredDensity: "comfortable",
    timestamp: Date.now(),
  };
  try {
    const raw = localStorage.getItem(UX_STORE_KEY);
    if (!raw) return base;
    const parsed = safeParse(raw, base);
    return { ...base, ...parsed };
  } catch (_) {
    return base;
  }
}

function saveUxState(state) {
  try {
    localStorage.setItem(UX_STORE_KEY, JSON.stringify({ ...state, timestamp: Date.now() }));
  } catch (_) {}
}

function getApiBase() {
  const base = String(window.GLOBALFLOW_API_BASE || "").trim();
  return base ? base.replace(/\/$/, "") : "";
}

function apiUrl(path) {
  const base = getApiBase();
  return base ? `${base}${path}` : path;
}

function getSessionId() {
  try {
    const existing = sessionStorage.getItem(UX_SESSION_KEY);
    if (existing) return existing;
    const id = `ux_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(UX_SESSION_KEY, id);
    return id;
  } catch (_) {
    return "ux_anonymous";
  }
}

function postTelemetry(eventType, payload = {}) {
  if (!personalizationConsentEnabled()) return;
  const body = {
    event_type: eventType,
    session_id: getSessionId(),
    route: location.pathname || "/",
    payload,
  };
  fetch(apiUrl("/api/ux/telemetry"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {});
}

function installVariantSystem() {
  if (!personalizationConsentEnabled()) {
    document.body.dataset.uxVariant = "A";
    return;
  }
  const body = document.body;
  if (!body) return;
  const allowed = ["A", "B", "C"];
  let chosen = "A";
  try {
    const saved = localStorage.getItem(UX_VARIANT_KEY);
    if (saved && allowed.includes(saved)) {
      chosen = saved;
    } else {
      const index = Math.floor(Math.random() * allowed.length);
      chosen = allowed[index];
      localStorage.setItem(UX_VARIANT_KEY, chosen);
    }
  } catch (_) {}
  body.dataset.uxVariant = chosen;
  postTelemetry("variant_assigned", { variant: chosen });
}

function inferIntentFromAction(actionId) {
  const id = String(actionId || "").toLowerCase();
  if (/bill|invoice|payment|checkout|price/.test(id)) return "finance";
  if (/workflow|board|operator|launch|autopilot|route|task/.test(id)) return "workflow";
  if (/tax|compliance|audit|risk/.test(id)) return "compliance";
  if (/file|doc|upload|folder|classif/.test(id)) return "documents";
  return "general";
}

function deriveUserSegment(state) {
  const intents = state.intents || {};
  const ranked = Object.entries(intents)
    .filter(([key]) => key !== "general")
    .sort((a, b) => Number(b[1]) - Number(a[1]));
  if (!ranked.length || ranked[0][1] <= 0) return "general";
  return ranked[0][0];
}

function applyPersonalization(state) {
  const body = document.body;
  if (!body) return;
  if (!personalizationConsentEnabled()) {
    state.userSegment = "general";
    body.dataset.userSegment = "general";
    body.classList.remove("ux-segment-finance", "ux-segment-workflow", "ux-segment-compliance", "ux-segment-documents");
    return;
  }
  const segment = deriveUserSegment(state);
  state.userSegment = segment;
  body.dataset.userSegment = segment;
  body.classList.remove("ux-segment-finance", "ux-segment-workflow", "ux-segment-compliance", "ux-segment-documents");
  if (segment !== "general") body.classList.add(`ux-segment-${segment}`);
}

function applyAdaptiveDensity(state) {
  const body = document.body;
  if (!body) return;
  body.classList.remove("ux-density-compact", "ux-density-comfortable");
  body.classList.add(state.preferredDensity === "compact" ? "ux-density-compact" : "ux-density-comfortable");
}

function installInteractionTelemetry(state) {
  if (!personalizationConsentEnabled()) return;
  const clickable = Array.from(document.querySelectorAll("a, button, [role='button'], summary"));
  clickable.forEach((node) => {
    node.addEventListener(
      "click",
      () => {
        const id =
          node.id ||
          node.getAttribute("data-ai-method") ||
          node.getAttribute("href") ||
          node.textContent?.trim()?.slice(0, 40) ||
          "unknown";
        state.interactions[id] = (state.interactions[id] || 0) + 1;
        const intent = inferIntentFromAction(id);
        if (intent !== "general") {
          state.intents[intent] = (state.intents[intent] || 0) + 1;
        }
        applyPersonalization(state);
        saveUxState(state);
        postTelemetry("interaction", {
          action: id,
          count: state.interactions[id],
          intent,
          user_segment: state.userSegment,
        });
      },
      { passive: true }
    );
  });
}

function rgbFromCss(value) {
  const match = String(value || "").match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const [r, g, b] = match[1]
    .split(",")
    .slice(0, 3)
    .map((v) => Number(v.trim()));
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return { r, g, b };
}

function luminance(rgb) {
  const toLin = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLin(rgb.r) + 0.7152 * toLin(rgb.g) + 0.0722 * toLin(rgb.b);
}

function contrastRatio(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}

function runAccessibilityPass(state) {
  const body = document.body;
  if (!body) return;
  const sample = Array.from(
    document.querySelectorAll("p, span, li, small, .activity-detail, .modal-note, .feature-card p, .explore-card p")
  ).slice(0, 120);
  let warnings = 0;
  sample.forEach((el) => {
    const style = getComputedStyle(el);
    const fg = rgbFromCss(style.color);
    const bg = rgbFromCss(style.backgroundColor);
    if (!fg || !bg) return;
    const ratio = contrastRatio(fg, bg);
    if (ratio < 4.5) {
      warnings += 1;
      el.classList.add("ux-low-contrast");
    }
  });
  state.scans += 1;
  state.contrastWarnings = warnings;
  if (warnings > 0) {
    body.classList.add("ux-high-contrast");
  } else {
    body.classList.remove("ux-high-contrast");
  }
  saveUxState(state);
  postTelemetry("accessibility_scan", { contrast_warnings: warnings, scans: state.scans });
}

function applyResponsiveUxState(state) {
  const width = window.innerWidth;
  if (width <= 767) {
    state.preferredDensity = "compact";
  } else if (width <= 1160 && state.preferredDensity !== "compact") {
    state.preferredDensity = "comfortable";
  }
  applyAdaptiveDensity(state);
}

function installUxEngine() {
  const state = loadUxState();
  installVariantSystem();
  applyResponsiveUxState(state);
  applyPersonalization(state);
  if (personalizationConsentEnabled()) installInteractionTelemetry(state);
  runAccessibilityPass(state);
  postTelemetry("page_view", { density: state.preferredDensity, user_segment: state.userSegment, consent: personalizationConsentEnabled() });
  window.addEventListener(
    "resize",
    () => {
      applyResponsiveUxState(state);
      runAccessibilityPass(state);
    },
    { passive: true }
  );
}

function finishLoader() {
  const body = document.body;
  if (!body || !loader) return;
  const elapsed = performance.now() - loaderStart;
  const wait = Math.max(0, LOADER_MIN_MS - elapsed);
  window.setTimeout(() => {
    body.classList.remove("is-loading");
    body.classList.add("is-loaded");
    window.setTimeout(() => {
      loader.remove();
    }, 700);
  }, wait);
}

if (document.readyState === "complete") {
  finishLoader();
  installUxEngine();
} else {
  window.addEventListener(
    "load",
    () => {
      finishLoader();
      installUxEngine();
    },
    { once: true }
  );
}

window.setTimeout(finishLoader, 2200);
