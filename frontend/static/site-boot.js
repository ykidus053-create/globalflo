const LOADER_MIN_MS = 700;
const loader = document.getElementById("site-loader");
const loaderStart = performance.now();
const UX_STORE_KEY = "globalflow_ux_state_v2";

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

function applyAdaptiveDensity(state) {
  const body = document.body;
  if (!body) return;
  body.classList.remove("ux-density-compact", "ux-density-comfortable");
  body.classList.add(state.preferredDensity === "compact" ? "ux-density-compact" : "ux-density-comfortable");
}

function installInteractionTelemetry(state) {
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
        saveUxState(state);
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
  applyResponsiveUxState(state);
  installInteractionTelemetry(state);
  runAccessibilityPass(state);
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
