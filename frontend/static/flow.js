const workflowGrid = document.getElementById("workflow-grid");
const nextSteps = document.getElementById("flow-next-steps");
const inspectButton = document.getElementById("inspect-flow");
const flowModal = document.getElementById("flow-modal");
const flowModalClose = document.getElementById("flow-modal-close");
const flowModalBody = document.getElementById("flow-modal-body");
const subscribeModal = document.getElementById("subscribe-modal");
const subscribeForm = document.getElementById("subscribe-form");
const heroLeadForm = document.getElementById("hero-lead-form");
const loginButton = document.getElementById("open-login");
const loginModal = document.getElementById("login-modal");
const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");
const googleLoginButton = document.getElementById("login-with-google");
const appleLoginButton = document.getElementById("login-with-apple");
const oauthStatus = document.getElementById("oauth-status");
const launchOrchestrationBtn = document.getElementById("launch-orchestration");
const watchDemoBtn = document.getElementById("watch-demo");
const demoVideo = document.getElementById("demo-video");
const demoSection = document.getElementById("demo");

const autopilotToggle = document.getElementById("autopilot-toggle");
const autopilotStatusEl = document.getElementById("autopilot-status");
const autopilotNextRunEl = document.getElementById("autopilot-next-run");
const autopilotCycleCount = document.getElementById("autopilot-cycle-count");
const autopilotData = document.getElementById("autopilot-data");

const systemConfidence = document.getElementById("system-confidence");
const queuePressure = document.getElementById("queue-pressure");
const activityTotal = document.getElementById("activity-total");
const reliabilityState = document.getElementById("reliability-state");
const signalDot = document.getElementById("signal-dot");
const panelHealth = document.getElementById("panel-health");
const lastSync = document.getElementById("last-sync");
const scrollProgress = document.getElementById("scroll-progress");
const vfxCursor = document.getElementById("vfx-cursor");

const connectorForms = document.querySelectorAll(".connector-form");
const paymentButtons = document.querySelectorAll("[data-payment-method]");
const subscriptionButtons = document.querySelectorAll("[data-checkout-tier]");
const subscribeOpenButtons = document.querySelectorAll("[data-subscribe-open='true']");
const activityFeed = document.getElementById("activity-feed");
const navLinks = document.querySelectorAll(".nav a[href^='#']");
const priceCells = document.querySelectorAll(".price[data-monthly][data-annual]");
const monthlyToggle = document.getElementById("billing-monthly");
const annualToggle = document.getElementById("billing-annual");
const featureDetailButtons = document.querySelectorAll("[data-feature-title]");
const useCaseCards = document.querySelectorAll("[data-preview-headline]");
const useCasePreviewTitle = document.getElementById("use-case-preview-title");
const useCasePreviewDomain = document.getElementById("use-case-preview-domain");
const useCasePreviewCopy = document.getElementById("use-case-preview-copy");
const useCaseSearch = document.getElementById("use-case-search");
const useCaseSearchMeta = document.getElementById("use-case-search-meta");
const integrationSearch = document.getElementById("integration-search");
const integrationSearchMeta = document.getElementById("integration-search-meta");
const connectorCards = document.querySelectorAll(".connector-card");
const integrationCheckButtons = document.querySelectorAll("[data-integration-check]");
const openFeedbackButton = document.getElementById("open-feedback");
const feedbackModal = document.getElementById("feedback-modal");
const feedbackForm = document.getElementById("feedback-form");
const feedbackStatus = document.getElementById("feedback-status");
const exploreGrid = document.querySelector(".explore-grid");
const workflowCards = document.querySelectorAll(".workflow-card");
const workflowBoard = document.getElementById("wf-board");

const SESSION_KEY = "globalflow_session";
const NEXT_STEPS_ORDER_KEY = "globalflow_next_steps_order";
const PERSONALIZATION_CONSENT_KEY = "globalflow_personalization_consent";
const HAPTICS_ENABLED_KEY = "globalflow_haptics_enabled";
const numberFormatter = new Intl.NumberFormat("en-US");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const hiddenPollMultiplier = 4;
const minimumHiddenInterval = 60000;
const API_BASE = String(window.GLOBALFLOW_API_BASE || "").replace(/\/$/, "");

let metricsCache = {};
let activityCount = 0;
let revealObserver = null;
let sectionObserver = null;
let motionObserver = null;
let billingMode = "monthly";
let activeModalId = null;
let summaryCache = null;
let revealIndex = 0;
let autopilotState = {
  enabled: autopilotData?.dataset?.enabled === "true",
  next_run: autopilotData?.dataset?.nextRun || null,
  last_run: autopilotData?.dataset?.lastRun || null,
  cycles: parseInt(autopilotData?.dataset?.cycles || "0", 10),
};
const inFlightTasks = new Map();
const pollers = [];

const toneRules = [
  { tone: "urgency", badge: "Urgent", pattern: /deadline|overdue|escalat|risk|urgent|tax/i },
  { tone: "trust", badge: "Trusted", pattern: /billing|invoice|payment|compliance|audit/i },
  { tone: "success", badge: "Stable", pattern: /follow|complete|ready|owner|dispatch/i },
  { tone: "insight", badge: "Insight", pattern: /document|file|classif|analy|report|ops/i },
];

function apiUrl(path) {
  if (!path) return API_BASE || "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path}`;
}

function runExclusive(key, task) {
  const activeTask = inFlightTasks.get(key);
  if (activeTask) return activeTask;
  let promise;
  promise = (async () => {
    try {
      return await task();
    } finally {
      if (inFlightTasks.get(key) === promise) {
        inFlightTasks.delete(key);
      }
    }
  })();
  inFlightTasks.set(key, promise);
  return promise;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(apiUrl(url), options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || payload.message || "Request failed");
  }
  stampSync();
  setReliabilityState("healthy", "System healthy");
  return payload;
}

function stampSync() {
  if (!lastSync) return;
  lastSync.textContent = `Last sync ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function setReliabilityState(mode, label) {
  if (reliabilityState) {
    reliabilityState.textContent = label;
  }
  if (panelHealth) {
    panelHealth.textContent = mode === "healthy" ? "Live tracking active" : "Monitoring attention";
  }
  if (signalDot) {
    signalDot.classList.toggle("is-warning", mode !== "healthy");
  }
}

function formatCountdown(nextRunIso) {
  if (!nextRunIso) return "Queued soon";
  const next = new Date(nextRunIso);
  const delta = next.getTime() - Date.now();
  if (delta <= 0) return "Starting now";
  const minutes = Math.floor(delta / 60000);
  const seconds = Math.floor((delta % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function refreshControlReadout() {
  if (systemConfidence) {
    const errors = Number(metricsCache.errors || 0);
    const pressurePenalty = Math.min(activityCount, 12) * 0.08;
    const errorPenalty = Math.min(errors, 8) * 0.6;
    const score = Math.max(91.4, 99.4 - errorPenalty - pressurePenalty);
    systemConfidence.textContent = `${score.toFixed(1)}%`;
  }

  if (queuePressure) {
    const tasksRun = Number(metricsCache.tasks_run || 0);
    const errors = Number(metricsCache.errors || 0);
    const signal = tasksRun + activityCount;
    let label = "Stable";
    if (errors > 0) label = "Attention";
    else if (signal > 18) label = "High flow";
    else if (signal > 8) label = "Rising";
    queuePressure.textContent = label;
  }

  if (activityTotal) {
    activityTotal.textContent = `${activityCount} event${activityCount === 1 ? "" : "s"}`;
  }
}

function updateAutopilotDisplay(data) {
  if (!data) return;
  autopilotState = {
    ...autopilotState,
    enabled: Boolean(data.enabled),
    next_run: data.next_run || null,
    last_run: data.last_run || null,
    cycles: Number(data.cycles ?? autopilotState.cycles),
  };

  if (autopilotStatusEl) {
    autopilotStatusEl.textContent = autopilotState.enabled ? "Autopilot running" : "Autopilot idle";
  }
  if (autopilotNextRunEl) {
    autopilotNextRunEl.textContent = autopilotState.next_run
      ? `Next run in ${formatCountdown(autopilotState.next_run)}`
      : "Next run queued soon";
  }
  if (autopilotCycleCount) {
    autopilotCycleCount.textContent = `Cycles completed: ${numberFormatter.format(autopilotState.cycles)}`;
  }
  if (autopilotToggle) {
    autopilotToggle.textContent = autopilotState.enabled ? "Pause autonomous loops" : "Enable autonomous loops";
  }
}

function renderTasks(tasks) {
  if (!workflowGrid) return;
  workflowGrid.innerHTML = "";
  tasks.forEach((task) => {
    const card = document.createElement("article");
    card.className = "workflow-card gf-card gf-fade";
    card.innerHTML = `
      <div class="content-body">
        <span class="workflow-status">${task.status}</span>
        <h4>${task.domain}</h4>
        <p>${task.next_action}</p>
        <p class="note">${task.note}</p>
      </div>
      <button class="primary small" type="button">Kick off</button>
    `;
    const button = card.querySelector("button");
    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "Running...";
      try {
        await runTask(task.id);
        showToast(`${task.domain} queued`);
      } catch (error) {
        showToast(error.message || "Task failed to queue");
      } finally {
        button.disabled = false;
        button.textContent = "Kick off";
      }
    });
    workflowGrid.appendChild(card);
    registerRevealTargets(card);
  });
}

function renderSummary(steps) {
  if (!nextSteps) return;
  const savedOrder = loadNextStepsOrder();
  const orderedSteps = applyNextStepsOrder(steps, savedOrder);
  nextSteps.innerHTML = "";
  orderedSteps.forEach((step) => {
    const li = document.createElement("li");
    li.textContent = step;
    nextSteps.appendChild(li);
  });
  initNextStepsDragDrop();
}

function renderActivity(events) {
  if (!activityFeed) return;
  activityCount = Array.isArray(events) ? events.length : 0;
  refreshControlReadout();

  if (!events || !events.length) {
    activityFeed.innerHTML =
      '<div class="activity-entry gf-card gf-fade"><div class="content-body"><p class="activity-message">No activity yet.</p><p class="activity-detail">Launch a workflow or connector to start the audit trail.</p></div></div>';
    return;
  }

  activityFeed.innerHTML = events
    .map(
      (event) => `
      <article class="activity-entry gf-card gf-fade">
        <div class="content-body">
          <span class="activity-kind">${event.kind || "event"}</span>
          <p class="activity-message">${event.message}</p>
          <p class="activity-detail">${event.detail || ""}</p>
          <time>${new Date(event.timestamp).toLocaleString()}</time>
        </div>
      </article>
    `
    )
    .join("");

  activityFeed.querySelectorAll(".activity-entry").forEach((entry) => registerRevealTargets(entry));
}

async function fetchTasks() {
  if (!workflowGrid) return;
  const data = await runExclusive("tasks", () => fetchJson("/api/tasks"));
  renderTasks(data.tasks);
  return data;
}

async function fetchSummary(force = false) {
  if (!force && summaryCache) {
    renderSummary(summaryCache.next_steps);
    return summaryCache;
  }
  const data = await runExclusive("summary", () => fetchJson("/api/flow"));
  summaryCache = data;
  renderSummary(data.next_steps);
  return data;
}

async function refreshMetrics() {
  try {
    metricsCache = await runExclusive("metrics", () => fetchJson("/api/metrics"));
    refreshControlReadout();
  } catch (error) {
    setReliabilityState("warning", "Waiting on system response");
    console.warn("Metrics refresh failed", error);
  }
}

async function refreshAutopilotStatus() {
  if (!autopilotToggle) return;
  try {
    const data = await runExclusive("autopilot", () => fetchJson("/api/autopilot"));
    updateAutopilotDisplay(data);
  } catch (error) {
    setReliabilityState("warning", "Autopilot signal delayed");
    console.warn("Autopilot status unavailable", error);
  }
}

async function fetchActivity() {
  if (!activityFeed) return;
  try {
    const body = await runExclusive("activity", () => fetchJson("/api/activity"));
    renderActivity(body.events);
  } catch (error) {
    setReliabilityState("warning", "Activity stream delayed");
    console.warn("Activity stream unavailable", error);
  }
}

async function runTask(taskId) {
  await fetchJson(`/api/tasks/${taskId}/run`, { method: "POST" });
  await fetchTasks();
  await refreshMetrics();
  await fetchActivity();
}

function triggerFlow() {
  if (!workflowGrid) return;
  const firstButton = workflowGrid.querySelector("button");
  if (firstButton) firstButton.click();
}

function initRevealObserver() {
  const targets = document.querySelectorAll(
    "main > section, .hero-status-card, .logo-pill, .testimonial-card, .feature-card, .pricing-card, .payment-chip, .trust-card, .founder-card, .connector-card, .endtoend-step, .overview-panel, .hero-proof-card, .hero-trust-card"
  );
  targets.forEach((target) => registerRevealTargets(target));

  if (prefersReducedMotion || typeof IntersectionObserver === "undefined") {
    document.querySelectorAll(".reveal-ready").forEach((target) => target.classList.add("is-visible"));
    return;
  }

  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  document.querySelectorAll(".reveal-ready").forEach((target) => revealObserver.observe(target));
}

function registerRevealTargets(target) {
  if (!target || target.classList.contains("reveal-ready")) return;
  target.style.transitionDelay = `${Math.min(revealIndex * 55, 360)}ms`;
  target.classList.add("reveal-ready");
  revealIndex += 1;
  if (prefersReducedMotion) {
    target.classList.add("is-visible");
    return;
  }
  if (revealObserver) revealObserver.observe(target);
}

function initSectionStateObserver() {
  const sections = document.querySelectorAll("main > section");
  if (!sections.length) return;

  if (prefersReducedMotion || typeof IntersectionObserver === "undefined") {
    sections.forEach((section) => section.classList.add("is-section-active"));
    return;
  }

  sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("is-section-active", entry.isIntersecting);
      });
    },
    { threshold: 0.28, rootMargin: "-8% 0px -18% 0px" }
  );

  sections.forEach((section) => sectionObserver.observe(section));
}

function initAdvancedMotion() {
  const trackedSelectors = [
    ".hero-visual",
    ".overview-statement",
    ".endtoend-step",
    ".explore-card",
    ".stat-card--airbnb",
    ".pricing-card",
    ".trust-card",
    ".workflow-card",
    ".activity-entry",
    ".connector-card",
    ".hero-quickfacts article",
  ];

  const trackedNodes = document.querySelectorAll(trackedSelectors.join(", "));
  trackedNodes.forEach((node, index) => {
    node.classList.add("motion-track");
    node.style.setProperty("--motion-delay", `${Math.min(index * 40, 320)}ms`);
  });

  const pointerTargets = document.querySelectorAll(
    ".gf-card, .workflow-card, .activity-entry, .explore-card, .endtoend-step, .hero-visual, .connector-card"
  );

  pointerTargets.forEach((target) => {
    target.addEventListener("pointermove", (event) => {
      const rect = target.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      target.style.setProperty("--pointer-x", `${x.toFixed(2)}%`);
      target.style.setProperty("--pointer-y", `${y.toFixed(2)}%`);
    });
    target.addEventListener("pointerenter", () => target.classList.add("is-hovered"));
    target.addEventListener("pointerleave", () => target.classList.remove("is-hovered"));
  });

  if (prefersReducedMotion || typeof IntersectionObserver === "undefined") {
    trackedNodes.forEach((node) => node.classList.add("is-entered"));
    return;
  }

  motionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("is-entered", entry.isIntersecting);
      });
    },
    { threshold: 0.22, rootMargin: "-6% 0px -12% 0px" }
  );

  trackedNodes.forEach((node) => motionObserver.observe(node));
}

function initAmbientVfx() {
  if (prefersReducedMotion) return;
  const root = document.documentElement;
  const aurora = document.querySelector(".aurora");
  const cards = document.querySelectorAll(".gf-card");
  const parallaxSections = document.querySelectorAll("main > section");

  window.addEventListener(
    "pointermove",
    (event) => {
      const x = event.clientX / window.innerWidth;
      const y = event.clientY / window.innerHeight;
      root.style.setProperty("--mx", x.toFixed(4));
      root.style.setProperty("--my", y.toFixed(4));
      if (aurora) {
        aurora.style.transform = `translate3d(${(x - 0.5) * 12}px, ${(y - 0.5) * 8}px, 0)`;
      }
    },
    { passive: true }
  );

  window.addEventListener(
    "scroll",
    () => {
      const doc = document.documentElement;
      const maxScroll = Math.max(doc.scrollHeight - window.innerHeight, 1);
      const progress = window.scrollY / maxScroll;
      root.style.setProperty("--scroll-progress", progress.toFixed(4));
      if (scrollProgress) {
        scrollProgress.style.transform = `scaleX(${Math.max(progress, 0.02)})`;
      }
      parallaxSections.forEach((section, index) => {
        const rate = ((index % 2) + 1) * 0.004;
        const offset = Math.min(window.scrollY * rate, 8);
        section.style.setProperty("--section-shift", `${offset.toFixed(2)}px`);
      });
    },
    { passive: true }
  );

  cards.forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      const px = ((event.clientX - rect.left) / rect.width) * 100;
      const py = ((event.clientY - rect.top) / rect.height) * 100;
      const rx = ((event.clientY - rect.top) / rect.height - 0.5) * -3;
      const ry = ((event.clientX - rect.left) / rect.width - 0.5) * 4;
      card.style.setProperty("--gx", `${px.toFixed(2)}%`);
      card.style.setProperty("--gy", `${py.toFixed(2)}%`);
      card.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
      card.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
      card.classList.add("is-hovered");
    });
    card.addEventListener("pointerleave", () => {
      card.style.removeProperty("--rx");
      card.style.removeProperty("--ry");
      card.classList.remove("is-hovered");
    });
  });
}

function installStorytellingImmersion() {
  const storySections = Array.from(document.querySelectorAll("main > section, main > .wf-section, main > .workflow"));
  if (!storySections.length) return;

  storySections.forEach((section, index) => {
    section.classList.add("story-stage");
    section.style.setProperty("--story-index", String(index));
  });

  if (prefersReducedMotion) {
    storySections.forEach((section) => section.classList.add("is-story-focus"));
    return;
  }

  const root = document.documentElement;
  let rafId = 0;

  const updateStoryState = () => {
    rafId = 0;
    const vh = window.innerHeight || 1;
    let maxProgress = 0;
    let bestScore = -1;
    let focusIndex = 0;

    storySections.forEach((section, index) => {
      const rect = section.getBoundingClientRect();
      const centerDistance = Math.abs(rect.top + rect.height * 0.5 - vh * 0.5);
      const focusScore = Math.max(0, 1 - centerDistance / vh);
      if (focusScore > bestScore) {
        bestScore = focusScore;
        focusIndex = index;
      }

      const enters = vh - rect.top;
      const progress = Math.max(0, Math.min(1, enters / (vh + rect.height)));
      section.style.setProperty("--story-progress", progress.toFixed(4));
      maxProgress = Math.max(maxProgress, progress);
    });

    storySections.forEach((section, index) => {
      section.classList.toggle("is-story-focus", index === focusIndex);
    });

    root.style.setProperty("--story-depth", maxProgress.toFixed(4));
    root.style.setProperty("--story-focus", String(focusIndex));
  };

  const requestUpdate = () => {
    if (rafId) return;
    rafId = window.requestAnimationFrame(updateStoryState);
  };

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate, { passive: true });
  requestUpdate();
}

function initMagneticButtons() {
  return;
}

function initKineticType() {
  const headings = document.querySelectorAll("h1, .section-heading h2, .pricing-top h3, .overview-panel h3, .overview-statement, .endtoend-body h3");
  headings.forEach((heading) => heading.classList.add("kinetic-heading"));
}

function initActiveNav() {
  if (!navLinks.length || typeof IntersectionObserver === "undefined") return;
  const sections = [...navLinks]
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
          link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`);
        });
      });
    },
    { threshold: 0.45, rootMargin: "-12% 0px -30% 0px" }
  );

  sections.forEach((section) => observer.observe(section));
}

async function inspectFlow() {
  try {
    const data = await fetchSummary();
    if (flowModalBody) flowModalBody.textContent = JSON.stringify(data, null, 2);
    openModal(flowModal);
  } catch {
    showToast("Could not load flow summary");
  }
}

const historySupported = typeof window !== "undefined" && window.history && window.history.pushState;
if (historySupported) {
  window.history.replaceState({ modalId: null }, "", `${window.location.pathname}${window.location.search}`);
}

function pushModalHistory(modalId) {
  if (!historySupported) return;
  if (window.history.state?.modalId === modalId) return;
  window.history.pushState({ modalId }, "", `${window.location.pathname}#${modalId}`);
}

function resetModalHistory() {
  if (!historySupported) return;
  window.history.replaceState({ modalId: null }, "", `${window.location.pathname}${window.location.search}`);
}

function openModal(target, pushHistory = true) {
  if (!target) return;
  document.querySelectorAll(".flow-modal--open").forEach((el) => el.classList.remove("flow-modal--open"));
  target.classList.add("flow-modal--open");
  activeModalId = target.id;
  if (pushHistory) pushModalHistory(target.id);
}

function closeModal(target, skipHistory = false) {
  if (!target) return;
  target.classList.remove("flow-modal--open");
  activeModalId = null;
  if (!skipHistory) resetModalHistory();
}

window.addEventListener("popstate", (event) => {
  const modalId = event.state?.modalId;
  const openModalEl = document.querySelector(".flow-modal--open");
  if (!modalId && openModalEl) {
    closeModal(openModalEl, true);
    return;
  }
  if (modalId) {
    const target = document.getElementById(modalId);
    if (target) openModal(target, false);
  }
});

async function handleLeadCapture(form, statusEl, modalEl) {
  const payload = Object.fromEntries(new FormData(form));
  try {
    const data = await fetchJson("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (statusEl) statusEl.textContent = data.message || "Request received.";
    showToast(data.message || "Request received");
    await refreshMetrics();
    if (modalEl) closeModal(modalEl);
    if (data.checkout_url) window.location.assign(data.checkout_url);
  } catch (error) {
    if (statusEl) statusEl.textContent = error.message || "Submission failed.";
    showToast(error.message || "Submission failed");
  }
}

function loadSession() {
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function saveSession(payload) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  updateLoginButton();
}

function updateLoginButton() {
  if (!loginButton) return;
  const saved = loadSession();
  if (!saved) {
    loginButton.textContent = "Login";
    return;
  }
  loginButton.textContent = saved.name ? `Hi, ${String(saved.name).split(" ")[0]}` : "Account";
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = window.atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function handleAuthReturn() {
  const rawHash = window.location.hash.replace(/^#/, "");
  if (!rawHash) return;
  const params = new URLSearchParams(rawHash);
  const encodedSession = params.get("auth_session");
  const authError = params.get("auth_error");
  if (!encodedSession && !authError) return;

  if (encodedSession) {
    try {
      const session = JSON.parse(decodeBase64Url(encodedSession));
      saveSession(session);
      hydrateLoginForm();
      if (loginStatus) loginStatus.textContent = `Signed in with ${session.login_method || "your account"} as ${session.email || "your account"}`;
      showToast(`Signed in with ${session.login_method || "your account"}`);
    } catch (error) {
      console.warn("Could not restore auth session", error);
      if (loginStatus) loginStatus.textContent = "Sign-in completed, but the session could not be restored.";
      showToast("Sign-in completed, but the session could not be restored");
    }
  }

  if (authError) {
    if (loginStatus) loginStatus.textContent = authError;
    showToast(authError);
    if (loginModal) openModal(loginModal, false);
  }

  const cleanUrl = `${window.location.pathname}${window.location.search}`;
  if (historySupported) {
    window.history.replaceState(window.history.state, "", cleanUrl);
  } else {
    window.location.hash = "";
  }
}

function hydrateLoginForm() {
  if (!loginForm) return;
  const saved = loadSession();
  if (!saved) return;
  Object.entries(saved).forEach(([key, value]) => {
    const input = loginForm.querySelector(`[name="${key}"]`);
    if (input) input.value = value;
  });
  if (loginStatus) loginStatus.textContent = `Session restored for ${saved.email || "you"}`;
  updateLoginButton();
}

function scrollToSelector(selector) {
  const element = document.querySelector(selector);
  if (!element) return;
  element.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
}

function openCheckoutForTier(tierId) {
  if (!tierId) return;
  showToast("Opening subscription checkout...");
  window.location.assign(`/checkout/${String(tierId).toLowerCase()}`);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function updateSearchMeta(metaEl, visible, total) {
  if (!metaEl) return;
  if (!total) {
    metaEl.textContent = "";
    return;
  }
  metaEl.textContent = `${visible}/${total}`;
}

function applyDeviceClass() {
  const width = window.innerWidth;
  let device = "desktop";
  if (width < 640) device = "mobile";
  else if (width < 1024) device = "tablet";
  else if (width < 1440) device = "laptop";
  document.documentElement.dataset.device = device;
}

function triggerHaptic(pattern = 12) {
  try {
    if (window.localStorage.getItem(HAPTICS_ENABLED_KEY) === "false") return;
  } catch (_) {}
  if (!("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch (_) {}
}

function installMicrointeractionHaptics() {
  const hapticTargets = document.querySelectorAll(
    ".primary, .ghost, .wf-toggle, .wf-density, .connector-card summary, .pricing-card button, .workflow-card button"
  );
  hapticTargets.forEach((target) => {
    target.addEventListener(
      "pointerdown",
      () => {
        if (prefersReducedMotion) return;
        triggerHaptic(10);
      },
      { passive: true }
    );
  });
}

function loadNextStepsOrder() {
  try {
    const raw = window.localStorage.getItem(NEXT_STEPS_ORDER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveNextStepsOrder(order) {
  try {
    window.localStorage.setItem(NEXT_STEPS_ORDER_KEY, JSON.stringify(order));
  } catch {}
}

function applyNextStepsOrder(steps, order) {
  if (!Array.isArray(steps) || !steps.length) return [];
  if (!Array.isArray(order) || !order.length) return steps;
  const index = new Map(order.map((value, idx) => [value, idx]));
  return [...steps].sort((a, b) => {
    const ia = index.has(a) ? index.get(a) : Number.MAX_SAFE_INTEGER;
    const ib = index.has(b) ? index.get(b) : Number.MAX_SAFE_INTEGER;
    return ia - ib;
  });
}

function initNextStepsDragDrop() {
  if (!nextSteps) return;
  const items = [...nextSteps.querySelectorAll("li")];
  if (!items.length) return;

  items.forEach((li) => {
    li.draggable = true;
    li.classList.add("is-draggable");
  });

  let dragSource = null;

  const onDragStart = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    dragSource = target;
    target.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", target.textContent || "");
  };

  const onDragEnd = () => {
    nextSteps.querySelectorAll(".is-dragging, .is-drop-target").forEach((el) => el.classList.remove("is-dragging", "is-drop-target"));
    dragSource = null;
    const order = [...nextSteps.querySelectorAll("li")].map((li) => li.textContent || "");
    saveNextStepsOrder(order);
    showToast("Saved next-step order");
  };

  const onDragOver = (event) => {
    event.preventDefault();
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const li = target.closest("li");
    if (!li || li === dragSource) return;
    li.classList.add("is-drop-target");
    event.dataTransfer.dropEffect = "move";
  };

  const onDrop = (event) => {
    event.preventDefault();
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const li = target.closest("li");
    if (!li || !dragSource || li === dragSource) return;
    const rect = li.getBoundingClientRect();
    const before = event.clientY < rect.top + rect.height / 2;
    if (before) nextSteps.insertBefore(dragSource, li);
    else nextSteps.insertBefore(dragSource, li.nextSibling);
    nextSteps.querySelectorAll(".is-drop-target").forEach((el) => el.classList.remove("is-drop-target"));
  };

  nextSteps.addEventListener("dragstart", onDragStart);
  nextSteps.addEventListener("dragend", onDragEnd);
  nextSteps.addEventListener("dragover", onDragOver);
  nextSteps.addEventListener("drop", onDrop);
}

function initSearchFilters() {
  const filterUseCases = () => {
    if (!useCaseSearch || !useCaseCards.length) return;
    const query = normalizeText(useCaseSearch.value);
    let visible = 0;
    useCaseCards.forEach((card) => {
      const haystack = normalizeText(
        `${card.dataset.previewDomain || ""} ${card.dataset.previewHeadline || ""} ${card.dataset.previewDescription || ""}`
      );
      const match = !query || haystack.includes(query);
      card.hidden = !match;
      card.setAttribute("aria-hidden", match ? "false" : "true");
      if (match) visible += 1;
    });

    updateSearchMeta(useCaseSearchMeta, visible, useCaseCards.length);

    // Keep preview panel in sync with the first visible card.
    if (visible > 0) {
      const first = [...useCaseCards].find((card) => !card.hidden);
      if (first && useCasePreviewTitle && useCasePreviewDomain && useCasePreviewCopy) {
        useCasePreviewTitle.textContent = first.dataset.previewHeadline || "";
        useCasePreviewDomain.textContent = first.dataset.previewDomain || "";
        useCasePreviewCopy.textContent = first.dataset.previewDescription || "";
      }
    }
  };

  const filterIntegrations = () => {
    if (!integrationSearch || !connectorCards.length) return;
    const query = normalizeText(integrationSearch.value);
    let visible = 0;
    connectorCards.forEach((card) => {
      const text = normalizeText(card.textContent);
      const match = !query || text.includes(query);
      card.hidden = !match;
      card.setAttribute("aria-hidden", match ? "false" : "true");
      if (match) visible += 1;
    });
    updateSearchMeta(integrationSearchMeta, visible, connectorCards.length);
  };

  if (useCaseSearch) useCaseSearch.addEventListener("input", filterUseCases);
  if (integrationSearch) integrationSearch.addEventListener("input", filterIntegrations);

  filterUseCases();
  filterIntegrations();
}

function setIntegrationHealthUi(connectorId, payload) {
  if (!connectorId) return;
  const statusEl = document.querySelector(`[data-integration-health="${connectorId}"]`);
  const cardEl = document.querySelector(`.connector-card[data-connector-id="${connectorId}"]`);
  if (!statusEl || !payload) return;

  const status = String(payload.status || "unknown");
  const latency = payload.latency_ms == null ? "" : ` - ${payload.latency_ms}ms`;
  const statusCode = payload.status_code ? ` (${payload.status_code})` : "";
  statusEl.textContent = `${status}${statusCode}${latency} - ${payload.message || "No details"}`;

  if (cardEl) {
    cardEl.dataset.health = status;
    cardEl.classList.remove("is-health-ok", "is-health-warn", "is-health-bad");
    if (["connected", "reachable", "auth_required"].includes(status)) {
      cardEl.classList.add("is-health-ok");
    } else if (["degraded", "not_configured"].includes(status)) {
      cardEl.classList.add("is-health-warn");
    } else {
      cardEl.classList.add("is-health-bad");
    }
  }
}

async function refreshAllIntegrationHealth() {
  if (!connectorCards.length) return;
  try {
    const data = await fetchJson("/api/integrations/status");
    const items = Array.isArray(data.items) ? data.items : [];
    items.forEach((item) => setIntegrationHealthUi(item.id, item));
  } catch (error) {
    console.warn("Integration health refresh failed", error);
  }
}

async function checkSingleIntegration(connectorId, statusEl) {
  if (!connectorId) return;
  if (statusEl) statusEl.textContent = "checking live status...";
  try {
    const data = await fetchJson(`/api/integrations/${connectorId}/status`);
    setIntegrationHealthUi(connectorId, data.item || {});
    showToast(`${connectorId} status updated`);
  } catch (error) {
    if (statusEl) statusEl.textContent = error.message || "status check failed";
    showToast(error.message || "status check failed");
  }
}

async function submitFeedback(payload) {
  try {
    const data = await fetchJson("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return data;
  } catch (error) {
    return { status: "queued", message: error.message || "Feedback queued locally." };
  }
}

function initFeedback() {
  if (openFeedbackButton) {
    openFeedbackButton.addEventListener("click", () => openModal(feedbackModal));
  }
  if (!feedbackForm) return;
  const personalizationConsentInput = feedbackForm.querySelector("#personalization-consent");
  const hapticsEnabledInput = feedbackForm.querySelector("#haptics-enabled");
  if (personalizationConsentInput) {
    try {
      const savedConsent = window.localStorage.getItem(PERSONALIZATION_CONSENT_KEY);
      if (savedConsent !== null) personalizationConsentInput.checked = savedConsent !== "false";
    } catch (_) {}
    personalizationConsentInput.addEventListener("change", () => {
      try {
        window.localStorage.setItem(PERSONALIZATION_CONSENT_KEY, personalizationConsentInput.checked ? "true" : "false");
      } catch (_) {}
    });
  }
  if (hapticsEnabledInput) {
    try {
      const savedHaptics = window.localStorage.getItem(HAPTICS_ENABLED_KEY);
      if (savedHaptics !== null) hapticsEnabledInput.checked = savedHaptics !== "false";
    } catch (_) {}
    hapticsEnabledInput.addEventListener("change", () => {
      try {
        window.localStorage.setItem(HAPTICS_ENABLED_KEY, hapticsEnabledInput.checked ? "true" : "false");
      } catch (_) {}
    });
  }
  feedbackForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(feedbackForm);
    const payload = Object.fromEntries(formData);
    payload.personalization_consent = Boolean(personalizationConsentInput?.checked);
    payload.haptics_enabled = Boolean(hapticsEnabledInput?.checked);
    payload.rating = Number(payload.rating || 0);
    payload.nps = payload.nps === "" || payload.nps == null ? null : Number(payload.nps);
    payload.ces = payload.ces === "" || payload.ces == null ? null : Number(payload.ces);
    payload.sus = payload.sus === "" || payload.sus == null ? null : Number(payload.sus);
    payload.ua = navigator.userAgent;
    payload.path = `${window.location.pathname}${window.location.hash}`;
    if (!payload.comment || payload.rating < 1 || payload.rating > 5) {
      if (feedbackStatus) feedbackStatus.textContent = "Rating and comment are required.";
      showToast("Feedback incomplete");
      return;
    }
    if (payload.nps !== null && (payload.nps < 0 || payload.nps > 10)) {
      if (feedbackStatus) feedbackStatus.textContent = "NPS must be between 0 and 10.";
      showToast("Feedback incomplete");
      return;
    }
    if (payload.ces !== null && (payload.ces < 1 || payload.ces > 7)) {
      if (feedbackStatus) feedbackStatus.textContent = "CES must be between 1 and 7.";
      showToast("Feedback incomplete");
      return;
    }
    if (payload.sus !== null && (payload.sus < 0 || payload.sus > 100)) {
      if (feedbackStatus) feedbackStatus.textContent = "SUS must be between 0 and 100.";
      showToast("Feedback incomplete");
      return;
    }
    try {
      window.localStorage.setItem(PERSONALIZATION_CONSENT_KEY, payload.personalization_consent ? "true" : "false");
      window.localStorage.setItem(HAPTICS_ENABLED_KEY, payload.haptics_enabled ? "true" : "false");
    } catch (_) {}
    if (feedbackStatus) feedbackStatus.textContent = "Sending...";
    const result = await submitFeedback(payload);
    if (feedbackStatus) feedbackStatus.textContent = result.message || "Thanks. Feedback received.";
    showToast(result.message || "Feedback received");
    await fetchActivity().catch(() => {});
    window.setTimeout(() => closeModal(feedbackModal), 700);
  });
}

function initUseCasePreview() {
  if (!useCaseCards.length || !useCasePreviewTitle || !useCasePreviewDomain || !useCasePreviewCopy) return;

  const updatePreview = (card) => {
    useCasePreviewTitle.textContent = card.dataset.previewHeadline || "";
    useCasePreviewDomain.textContent = card.dataset.previewDomain || "";
    useCasePreviewCopy.textContent = card.dataset.previewDescription || "";
  };

  useCaseCards.forEach((card, index) => {
    if (index === 0) updatePreview(card);
    ["mouseenter", "focusin"].forEach((eventName) => {
      card.addEventListener(eventName, () => updatePreview(card));
    });
  });
}

function initFeatureDetailButtons() {
  if (!featureDetailButtons.length || !flowModal || !flowModalBody) return;
  featureDetailButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const payload = {
        capability: button.dataset.featureTitle,
        headline: button.dataset.featureHeadline,
        detail: button.dataset.featureDetail,
        next_step: button.dataset.featureTarget,
      };
      flowModalBody.textContent = JSON.stringify(payload, null, 2);
      openModal(flowModal);
    });
  });
}

function startSocialLogin(provider) {
  const providerButton =
    provider === "google" ? googleLoginButton : provider === "apple" ? appleLoginButton : null;
  if (providerButton && providerButton.dataset.providerReady !== "true") {
    const message = `${provider[0].toUpperCase()}${provider.slice(1)} sign-in is not configured on the server yet.`;
    if (oauthStatus) oauthStatus.textContent = message;
    showToast(message);
    return;
  }
  const returnTo = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  window.location.assign(apiUrl(`/auth/${provider}/start?return_to=${encodeURIComponent(returnTo)}`));
}

function setBillingMode(mode) {
  billingMode = mode;
  priceCells.forEach((cell) => {
    cell.textContent = cell.dataset[mode] || cell.textContent;
  });
  if (monthlyToggle) {
    monthlyToggle.classList.toggle("is-active", mode === "monthly");
    monthlyToggle.setAttribute("aria-selected", mode === "monthly" ? "true" : "false");
  }
  if (annualToggle) {
    annualToggle.classList.toggle("is-active", mode === "annual");
    annualToggle.setAttribute("aria-selected", mode === "annual" ? "true" : "false");
  }
}

function showToast(text) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = text;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.style.display = "block";
  if (!prefersReducedMotion) {
    toast.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 2200, easing: "ease-in-out" });
  }
  window.setTimeout(() => {
    toast.style.display = "none";
  }, 2200);
}

if (inspectButton) inspectButton.addEventListener("click", inspectFlow);
if (flowModalClose) flowModalClose.addEventListener("click", () => closeModal(flowModal));

document.querySelectorAll("[data-modal]").forEach((button) => {
  button.addEventListener("click", () => closeModal(document.getElementById(button.dataset.modal)));
});

[flowModal, subscribeModal, loginModal].forEach((modalEl) => {
  if (!modalEl) return;
  modalEl.addEventListener("click", (event) => {
    if (event.target === modalEl) closeModal(modalEl);
  });
});

if (watchDemoBtn) {
  watchDemoBtn.addEventListener("click", () => {
    if (demoSection) scrollToSelector("#demo");
    if (demoVideo && typeof demoVideo.play === "function") {
      demoVideo.play().catch(() => {
        // user gesture or media policy may block autoplay after scroll
      });
    }
  });
}

if (launchOrchestrationBtn) {
  launchOrchestrationBtn.addEventListener("click", async () => {
    launchOrchestrationBtn.disabled = true;
    try {
      showToast("Launching automation flow...");
      await fetchTasks();
      triggerFlow();
    } catch (error) {
      setReliabilityState("warning", "Launch delayed");
      showToast(error.message || "Could not launch orchestration");
    } finally {
      launchOrchestrationBtn.disabled = false;
    }
  });
}

if (autopilotToggle) {
  autopilotToggle.addEventListener("click", async () => {
    const targetState = !autopilotState.enabled;
    autopilotToggle.disabled = true;
    try {
      const data = await fetchJson("/api/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: targetState }),
      });
      updateAutopilotDisplay(data);
      showToast(data.enabled ? "Autopilot resumed" : "Autopilot paused");
      await fetchActivity();
      await refreshMetrics();
    } catch (error) {
      showToast(error.message || "Could not update autopilot");
    } finally {
      autopilotToggle.disabled = false;
    }
  });
}

if (heroLeadForm) {
  heroLeadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await handleLeadCapture(heroLeadForm);
  });
}

if (subscribeForm) {
  subscribeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await handleLeadCapture(subscribeForm, document.getElementById("subscribe-status"), subscribeModal);
  });
}

subscribeOpenButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!subscribeModal) return;
    const tierId = button.dataset.tier;
    if (tierId && subscribeForm) {
      const tierSelect = subscribeForm.querySelector("select[name='tier']");
      if (tierSelect) tierSelect.value = tierId;
    }
    openModal(subscribeModal);
  });
});

if (loginButton) loginButton.addEventListener("click", () => openModal(loginModal));
if (googleLoginButton) {
  googleLoginButton.addEventListener("click", () => startSocialLogin("google"));
}
if (appleLoginButton) {
  appleLoginButton.addEventListener("click", () => startSocialLogin("apple"));
}
if (loginForm) {
  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(loginForm));
    saveSession(payload);
    if (loginStatus) loginStatus.textContent = `Saved for ${payload.email}`;
    showToast("Login info saved locally for next visit");
    closeModal(loginModal);
  });
  hydrateLoginForm();
}

paymentButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const method = button.dataset.paymentMethod;
    if (!method) return;
    showToast(`Opening ${method} portal...`);
    window.location.assign(`/payment/${method}`);
  });
});

subscriptionButtons.forEach((button) => {
  button.addEventListener("click", () => openCheckoutForTier(button.dataset.checkoutTier));
});

connectorForms.forEach((form) => {
  const endpointInput = form.querySelector("input[name='target_url']");
  const sampleInput = form.querySelector("input:not([name='target_url']):not([name='context'])");
  const submitButton = form.querySelector("button[type='submit']");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const connectorId = form.dataset.connectorId;
    const statusEl = form.querySelector(".connector-status");
    if (!connectorId) {
      if (statusEl) statusEl.textContent = "Connector is misconfigured.";
      showToast("Connector unavailable");
      return;
    }
    if (statusEl) statusEl.textContent = "Dispatching connector...";
    const payload = Object.fromEntries(new FormData(form));
    try {
      const data = await fetchJson(`/api/connectors/${connectorId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (statusEl) statusEl.textContent = data.message;
      showToast(data.message);
      await refreshMetrics();
      await fetchActivity();
    } catch (error) {
      if (statusEl) statusEl.textContent = error.message || "Connector failed.";
      setReliabilityState("warning", "Connector retry needed");
      showToast(error.message || "Connector offline");
    }
  });

  const refreshConnectorState = () => {
    if (!submitButton) return;
    const hasEndpoint = endpointInput && endpointInput.value.trim().startsWith("http");
    const hasSample = sampleInput && sampleInput.value.trim().length > 0;
    submitButton.disabled = !(hasEndpoint && hasSample);
    const statusEl = form.querySelector(".connector-status");
    if (statusEl && !submitButton.disabled) {
      statusEl.textContent = "Ready to validate connector";
    }
  };

  [endpointInput, sampleInput].forEach((input) => {
    if (input) input.addEventListener("input", refreshConnectorState);
  });
  refreshConnectorState();
});

integrationCheckButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const connectorId = button.dataset.integrationCheck;
    const statusEl = document.querySelector(`[data-integration-health="${connectorId}"]`);
    await checkSingleIntegration(connectorId, statusEl);
  });
});

if (monthlyToggle) monthlyToggle.addEventListener("click", () => setBillingMode("monthly"));
if (annualToggle) annualToggle.addEventListener("click", () => setBillingMode("annual"));

function scheduleSafe(task, interval) {
  let timerId = null;

  const scheduleNext = () => {
    const nextInterval = document.hidden ? Math.max(interval * hiddenPollMultiplier, minimumHiddenInterval) : interval;
    timerId = window.setTimeout(runTask, nextInterval);
  };

  const runTask = async () => {
    try {
      await task();
    } catch (error) {
      console.warn("Scheduled task failed", error);
    } finally {
      scheduleNext();
    }
  };

  const controller = {
    restart() {
      if (timerId) window.clearTimeout(timerId);
      scheduleNext();
    },
    stop() {
      if (timerId) window.clearTimeout(timerId);
    },
  };

  pollers.push(controller);
  scheduleNext();
  return controller;
}

function detectTone(text) {
  const source = String(text || "");
  const match = toneRules.find((rule) => rule.pattern.test(source));
  return match || { tone: "trust", badge: "Trusted" };
}

function installAdaptiveUseCaseStates() {
  if (!useCaseCards?.length) return;
  useCaseCards.forEach((card) => {
    const title = card.dataset.previewHeadline || "";
    const description = card.dataset.previewDescription || "";
    const merged = `${title} ${description}`;
    const rule = detectTone(merged);
    card.dataset.tone = rule.tone;
    let badge = card.querySelector(".ux-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "ux-badge";
      const anchor = card.querySelector(".explore-card__body h3") || card.querySelector(".explore-card__body");
      if (anchor && anchor.parentNode) {
        anchor.parentNode.insertBefore(badge, anchor.nextSibling);
      }
    }
    badge.dataset.state = rule.tone;
    badge.textContent = rule.badge;
  });
}

function installPersonalizedLayout() {
  const segment = document.body?.dataset?.userSegment || "general";
  if (!segment || segment === "general" || !exploreGrid) return;
  const cards = Array.from(exploreGrid.querySelectorAll("[data-preview-domain]"));
  if (!cards.length) return;

  const scored = cards
    .map((card) => {
      const domain = normalizeText(card.dataset.previewDomain || "");
      let score = 0;
      if (segment === "finance" && /bill|invoice|payment|recovery/.test(domain)) score = 3;
      if (segment === "workflow" && /ops|orchestration|workflow|call/.test(domain)) score = 3;
      if (segment === "compliance" && /tax|compliance|readiness|audit/.test(domain)) score = 3;
      if (segment === "documents" && /document|file|control|uploads/.test(domain)) score = 3;
      return { card, score };
    })
    .sort((a, b) => b.score - a.score);

  scored.forEach(({ card }) => exploreGrid.appendChild(card));
  const leader = scored[0];
  if (leader && leader.score > 0) {
    leader.card.classList.add("is-personalized-focus");
  }
}

function installAdaptiveGridEngine() {
  if (!exploreGrid || !("ResizeObserver" in window)) return;
  const ro = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const width = entry.contentRect.width;
      if (width < 640) {
        document.documentElement.dataset.gridDensity = "mobile";
      } else if (width < 980) {
        document.documentElement.dataset.gridDensity = "compact";
      } else {
        document.documentElement.dataset.gridDensity = "cozy";
      }
    }
  });
  ro.observe(exploreGrid);
}

function installWorkflowKeyboardControls() {
  if (!workflowBoard) return;
  const cards = Array.from(workflowBoard.querySelectorAll(".wf-lane-card"));
  cards.forEach((card, index) => {
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-grabbed", "false");
    card.addEventListener("keydown", (event) => {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const lane = card.closest(".wf-lane");
      if (!lane) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const lanes = Array.from(workflowBoard.querySelectorAll(".wf-lane"));
        const laneIndex = lanes.indexOf(lane);
        const targetIndex = event.key === "ArrowLeft" ? laneIndex - 1 : laneIndex + 1;
        if (targetIndex < 0 || targetIndex >= lanes.length) return;
        const targetLane = lanes[targetIndex];
        targetLane.appendChild(card);
        card.focus();
        showToast("Workflow lane updated");
        return;
      }
      const laneCards = Array.from(lane.querySelectorAll(".wf-lane-card"));
      const current = laneCards.indexOf(card);
      const nextIndex = event.key === "ArrowUp" ? current - 1 : current + 1;
      if (nextIndex < 0 || nextIndex >= laneCards.length) return;
      const target = laneCards[nextIndex];
      if (event.key === "ArrowUp") {
        lane.insertBefore(card, target);
      } else {
        lane.insertBefore(card, target.nextSibling);
      }
      card.focus();
      showToast("Workflow order updated");
    });
    if (index === 0) {
      card.setAttribute("aria-grabbed", "false");
    }
  });
}

async function bootstrap() {
  handleAuthReturn();
  applyDeviceClass();
  initRevealObserver();
  initSectionStateObserver();
  initAdvancedMotion();
  initActiveNav();
  initAmbientVfx();
  initMagneticButtons();
  initKineticType();
  initUseCasePreview();
  initFeatureDetailButtons();
  initSearchFilters();
  initFeedback();
  installMicrointeractionHaptics();
  installAdaptiveUseCaseStates();
  installPersonalizedLayout();
  installAdaptiveGridEngine();
  installStorytellingImmersion();
  installWorkflowKeyboardControls();
  setBillingMode(billingMode);
  await Promise.allSettled([
    fetchTasks(),
    fetchSummary(),
    refreshMetrics(),
    refreshAutopilotStatus(),
    fetchActivity(),
    refreshAllIntegrationHealth(),
  ]);
}

bootstrap().catch((error) => {
  setReliabilityState("warning", "Startup checks delayed");
  console.warn("Bootstrap failed", error);
});

document.addEventListener("visibilitychange", () => {
  pollers.forEach((poller) => poller.restart());
});

window.addEventListener("resize", applyDeviceClass, { passive: true });

window.addEventListener(
  "pagehide",
  () => {
    pollers.forEach((poller) => poller.stop());
  },
  { once: true }
);

scheduleSafe(fetchTasks, 15000);
scheduleSafe(refreshMetrics, 45000);
scheduleSafe(refreshAutopilotStatus, 30000);
scheduleSafe(fetchActivity, 30000);
scheduleSafe(refreshAllIntegrationHealth, 60000);
