const workflowGrid = document.getElementById("workflow-grid");
const nextSteps = document.getElementById("flow-next-steps");
const inspectButton = document.getElementById("inspect-flow");
const flowModal = document.getElementById("flow-modal");
const flowModalClose = document.getElementById("flow-modal-close");
const flowModalBody = document.getElementById("flow-modal-body");
const commandModal = document.getElementById("command-modal");
const commandSearch = document.getElementById("command-search");
const commandList = document.getElementById("command-list");
const subscribeModal = document.getElementById("subscribe-modal");
const subscribeForm = document.getElementById("subscribe-form");
const heroLeadForm = document.getElementById("hero-lead-form");
const loginButton = document.getElementById("open-login");
const loginModal = document.getElementById("login-modal");
const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");
const googleLoginButton = document.getElementById("login-with-google");
const appleLoginButton = document.getElementById("login-with-apple");
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
const journeyShortcut = document.getElementById("journey-shortcut");
const journeyShortcutCopy = document.getElementById("journey-shortcut-copy");
const journeyShortcutAction = document.getElementById("journey-shortcut-action");

const connectorForms = document.querySelectorAll(".connector-form");
const integrationCheckButtons = document.querySelectorAll("[data-integration-check]");
const integrationSearch = document.getElementById("integration-search");
const integrationSearchMeta = document.getElementById("integration-search-meta");
const connectorCards = document.querySelectorAll(".connector-card");
const paymentButtons = document.querySelectorAll("[data-payment-method]");
const subscriptionButtons = document.querySelectorAll("[data-checkout-tier]");
const subscribeOpenButtons = document.querySelectorAll("[data-subscribe-open='true']");
const activityFeed = document.getElementById("activity-feed");
const navLinks = document.querySelectorAll(".nav a[href^='#']");
const priceCells = document.querySelectorAll(".price[data-monthly][data-annual]");
const monthlyToggle = document.getElementById("billing-monthly");
const annualToggle = document.getElementById("billing-annual");
const themeToggle = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");
const topAppBar = document.getElementById("top-app-bar");
const fabCommandBtn = document.getElementById("fab-command-btn");

const SESSION_KEY = "globalflow_session";
const numberFormatter = new Intl.NumberFormat("en-US");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const hiddenPollMultiplier = 4;
const minimumHiddenInterval = 60000;
const API_BASE = String(window.GLOBALFLOW_API_BASE || "").replace(/\/$/, "");
const VISIT_PROFILE_KEY = "globalflow_visit_profile";

let metricsCache = {};
let activityCount = 0;
let revealObserver = null;
let billingMode = "monthly";
let activeModalId = null;
let summaryCache = null;
let revealIndex = 0;
let commandRegistry = [];
let autopilotState = {
  enabled: autopilotData?.dataset?.enabled === "true",
  next_run: autopilotData?.dataset?.nextRun || null,
  last_run: autopilotData?.dataset?.lastRun || null,
  cycles: parseInt(autopilotData?.dataset?.cycles || "0", 10),
};
const inFlightTasks = new Map();
const pollers = [];
let shortcutShown = false;

function normalizeText(value) {
  return String(value || "").toLowerCase().trim();
}

function renderSkeleton(target, count = 3) {
  if (!target) return;
  target.innerHTML = "";
  for (let i = 0; i < count; i += 1) {
    const skeleton = document.createElement("div");
    skeleton.className = "skeleton-card";
    target.appendChild(skeleton);
  }
}

function updateSearchMeta(el, visible, total) {
  if (!el) return;
  el.textContent = `${visible}/${total}`;
}

function filterIntegrations() {
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
}

function applyAnticipatoryDesign() {
  const params = new URLSearchParams(window.location.search);
  const referral = normalizeText(document.referrer);
  const utmSource = normalizeText(params.get("utm_source"));
  const body = document.body;
  const timezone = normalizeText(Intl.DateTimeFormat().resolvedOptions().timeZone || "");
  const profile = readVisitProfile();
  const isReturning = Number(profile.visits || 0) > 1;
  let segment = "general";
  if (utmSource.includes("ads") || referral.includes("facebook") || referral.includes("google")) {
    segment = "marketing";
  } else if (utmSource.includes("finance") || referral.includes("quickbooks")) {
    segment = "finance";
  } else if (utmSource.includes("ops") || referral.includes("zapier") || referral.includes("make")) {
    segment = "automation";
  }
  if (body) {
    body.dataset.userSegment = segment;
    body.dataset.userReturning = isReturning ? "yes" : "no";
    body.dataset.userRegion = timezone.includes("america")
      ? "americas"
      : timezone.includes("europe")
      ? "europe"
      : timezone.includes("asia") || timezone.includes("africa")
      ? "emea-apac"
      : "global";
  }

  const prioritize = {
    marketing: ["meta-ads", "google-ads"],
    finance: ["snowflake", "bigquery"],
    automation: ["zapier", "make"],
  };
  const picks = prioritize[segment] || [];
  if (picks.length && connectorCards.length) {
    const grid = connectorCards[0].parentElement;
    picks.forEach((id) => {
      const card = document.querySelector(`.connector-card[data-connector-id="${id}"]`);
      if (card && grid) grid.prepend(card);
    });
  }
  return segment;
}

function applySegmentCopy(segment) {
  const lead = document.querySelector(".hero-copy .lead");
  const h1 = document.querySelector(".hero-copy h1");
  const profile = readVisitProfile();
  const isReturning = Number(profile.visits || 0) > 1;
  if (!lead || !h1) return;

  const copy = {
    marketing: {
      h1: "One control room for campaigns, billing, files, and compliance.",
      lead: "Automate campaign follow-up, invoicing, files, and compliance from one operating layer.",
    },
    finance: {
      h1: "One control room for billing, tax readiness, files, and follow-up.",
      lead: "Automate invoicing, reconciliation, compliance prep, and follow-up with live operator visibility.",
    },
    automation: {
      h1: "One control room for routing, execution, verification, and handoff.",
      lead: "Automate operations with clear execution states, ownership, and next actions in one place.",
    },
    general: {
      h1: "One calm control room for calls, billing, taxes, files, and follow-up.",
      lead: "Automate billing, follow-up, files, and compliance. Most pilot teams recover 20+ hours each week.",
    },
  };

  const selected = copy[segment] || copy.general;
  h1.textContent = isReturning ? selected.h1.replace("One control room", "Your control room") : selected.h1;
  lead.textContent = isReturning
    ? `${selected.lead} Continue from where you left off in one click.`
    : selected.lead;
}

function applyPrimaryActionFocus() {
  const actionTargets = Array.from(document.querySelectorAll(".primary, .ghost"));
  const sectionMap = {
    hero: ".hero-actions .primary",
    demo: "#watch-demo",
    flowboard: "#launch-orchestration",
    integrations: ".connector-card:not([hidden]) .primary",
    pricing: "[data-checkout-tier]",
  };

  const setPrimary = (sectionId) => {
    actionTargets.forEach((el) => el.classList.remove("is-action-primary"));
    const selector = sectionMap[sectionId];
    if (!selector) return;
    const primary = document.querySelector(selector);
    if (primary) primary.classList.add("is-action-primary");
    document.body.dataset.primarySection = sectionId || "hero";
  };

  const sections = ["hero", "demo", "flowboard", "integrations", "pricing"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if (!sections.length) return;
  setPrimary("hero");
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.id) setPrimary(visible.target.id);
    },
    { threshold: [0.35, 0.6, 0.85] }
  );
  sections.forEach((section) => observer.observe(section));
}

function hydrateConversionForms() {
  const session = readSession();
  const email = session?.email ? String(session.email).trim() : "";
  if (!email) return;
  const subscribeEmail = subscribeForm?.querySelector('input[name="email"]');
  if (subscribeEmail && !subscribeEmail.value) subscribeEmail.value = email;
}

function readVisitProfile() {
  try {
    const raw = window.localStorage.getItem(VISIT_PROFILE_KEY);
    if (!raw) return { visits: 0, lastSection: "", interactions: 0 };
    return JSON.parse(raw);
  } catch {
    return { visits: 0, lastSection: "", interactions: 0 };
  }
}

function writeVisitProfile(profile) {
  try {
    window.localStorage.setItem(VISIT_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // No-op when storage is unavailable.
  }
}

function trackVisitProfile() {
  const profile = readVisitProfile();
  profile.visits = Number(profile.visits || 0) + 1;
  profile.lastSeenAt = new Date().toISOString();
  writeVisitProfile(profile);
}

function readSession() {
  return loadSession();
}

function showJourneyShortcut(action) {
  if (!journeyShortcut || shortcutShown) return;
  const actionMap = {
    trial: {
      label: "Start My Trial",
      copy: "Need the fastest path? Start your trial now.",
      handler: () => openModal(subscribeModal),
    },
    workflow: {
      label: "Open Workflow",
      copy: "Jump directly to your live workflow command center.",
      handler: () => scrollToSelector("#flowboard"),
    },
    integrations: {
      label: "Open Integrations",
      copy: "Go straight to integration setup.",
      handler: () => scrollToSelector("#integrations"),
    },
  };
  const chosen = actionMap[action] || actionMap.trial;
  if (journeyShortcutCopy) journeyShortcutCopy.textContent = chosen.copy;
  if (journeyShortcutAction) {
    journeyShortcutAction.textContent = chosen.label;
    journeyShortcutAction.onclick = chosen.handler;
  }
  journeyShortcut.hidden = false;
  shortcutShown = true;
}

function initFrictionShortcuts() {
  const profile = readVisitProfile();
  let interactions = 0;
  document.addEventListener(
    "click",
    (event) => {
      const trigger = event.target instanceof Element ? event.target.closest("button, a, summary") : null;
      if (!trigger) return;
      interactions += 1;
      const nextProfile = readVisitProfile();
      nextProfile.interactions = Number(nextProfile.interactions || 0) + 1;
      writeVisitProfile(nextProfile);

      if (interactions < 3 || shortcutShown) return;
      const segment = document.body?.dataset?.userSegment || "general";
      if (segment === "automation") showJourneyShortcut("workflow");
      else if (segment === "marketing") showJourneyShortcut("integrations");
      else showJourneyShortcut("trial");
    },
    { passive: true }
  );

  if (Number(profile.visits || 0) >= 2) {
    const preferred = String(profile.lastSection || "").toLowerCase();
    if (preferred.includes("flow")) showJourneyShortcut("workflow");
    else if (preferred.includes("integration")) showJourneyShortcut("integrations");
    else showJourneyShortcut("trial");
  }
}

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
  nextSteps.innerHTML = "";
  steps.forEach((step) => {
    const li = document.createElement("li");
    li.textContent = step;
    nextSteps.appendChild(li);
  });
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
  renderSkeleton(workflowGrid, 4);
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
  renderSkeleton(activityFeed, 3);
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
    "main > section, .hero-video-card, .hero-status-card, .logo-pill, .testimonial-card, .feature-card, .pricing-card, .payment-chip, .trust-card, .founder-card, .connector-card"
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
  target.style.transitionDelay = `${Math.min(revealIndex * 40, 320)}ms`;
  target.classList.add("reveal-ready");
  revealIndex += 1;
  if (prefersReducedMotion) {
    target.classList.add("is-visible");
    return;
  }
  if (revealObserver) revealObserver.observe(target);
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
        aurora.style.transform = `translate3d(${(x - 0.5) * 28}px, ${(y - 0.5) * 20}px, 0)`;
      }
      if (vfxCursor) {
        vfxCursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
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
        const rate = ((index % 3) + 1) * 0.012;
        const offset = Math.min(window.scrollY * rate, 18);
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
      const rx = ((event.clientY - rect.top) / rect.height - 0.5) * -10;
      const ry = ((event.clientX - rect.left) / rect.width - 0.5) * 12;
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

function initMagneticButtons() {
  if (prefersReducedMotion) return;
  const buttons = document.querySelectorAll("button.primary, button.ghost, .nav a, .feature-link");
  buttons.forEach((button) => {
    button.addEventListener("pointermove", (event) => {
      const rect = button.getBoundingClientRect();
      const dx = ((event.clientX - rect.left) / rect.width - 0.5) * 14;
      const dy = ((event.clientY - rect.top) / rect.height - 0.5) * 10;
      button.style.setProperty("--bx", `${dx.toFixed(2)}px`);
      button.style.setProperty("--by", `${dy.toFixed(2)}px`);
      button.classList.add("is-magnetic");
    });
    button.addEventListener("pointerleave", () => {
      button.style.removeProperty("--bx");
      button.style.removeProperty("--by");
      button.classList.remove("is-magnetic");
    });
  });
}

function initKineticType() {
  const headings = document.querySelectorAll("h1, .section-heading h2, .pricing-top h3, .overview-panel h3");
  headings.forEach((heading) => heading.classList.add("kinetic-heading"));
}

// ── M3 FAB Menu (simplified CSS-driven layout) ──
function initSpatialMenu() {
  const container = document.getElementById("spatial-menu");
  const fab = document.getElementById("spatial-fab-toggle");
  if (!container || !fab) return;

  let isOpen = false;

  fab.addEventListener("click", () => {
    isOpen = !isOpen;
    container.classList.toggle("is-open", isOpen);
    fab.setAttribute("aria-expanded", String(isOpen));
  });

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (isOpen && !container.contains(e.target)) {
      isOpen = false;
      container.classList.remove("is-open");
      fab.setAttribute("aria-expanded", "false");
    }
  });

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) {
      isOpen = false;
      container.classList.remove("is-open");
      fab.setAttribute("aria-expanded", "false");
      fab.focus();
    }
  });

  // FAB command button opens command palette
  if (fabCommandBtn) {
    fabCommandBtn.addEventListener("click", () => {
      isOpen = false;
      container.classList.remove("is-open");
      fab.setAttribute("aria-expanded", "false");
      openCommandPalette();
    });
  }
}

// ── CRED / FinTech Unlock Button Interaction ──
function initFintechUnlockButtons() {
  const unlockButtons = document.querySelectorAll(".gf-unlock-btn");
  if (!unlockButtons.length) return;

  unlockButtons.forEach((btn) => {
    let holdTimer = null;
    let isUnlocking = false;
    const HOLD_DURATION = 600; // ms

    // Create the radial progress ring overlay
    const ring = document.createElement("span");
    ring.className = "unlock-ring";
    ring.setAttribute("aria-hidden", "true");
    btn.style.position = "relative";
    btn.appendChild(ring);

    function startUnlock(e) {
      if (isUnlocking) return;
      e.preventDefault();
      isUnlocking = true;
      btn.classList.add("is-pressing");
      ring.style.transition = `transform ${HOLD_DURATION}ms linear`;
      ring.style.transform = "scaleX(1)";

      holdTimer = setTimeout(() => {
        btn.classList.remove("is-pressing");
        btn.classList.add("is-unlocked");
        if (navigator.vibrate) navigator.vibrate([30, 60, 30]);

        // Flash confirmation then reset
        setTimeout(() => {
          btn.classList.remove("is-unlocked");
          ring.style.transition = "none";
          ring.style.transform = "scaleX(0)";
          isUnlocking = false;
          // Allow the original click to fire
          btn.click();
        }, 800);
      }, HOLD_DURATION);
    }

    function cancelUnlock() {
      if (!isUnlocking) return;
      clearTimeout(holdTimer);
      holdTimer = null;
      isUnlocking = false;
      btn.classList.remove("is-pressing");
      ring.style.transition = "transform 200ms ease-out";
      ring.style.transform = "scaleX(0)";
    }

    btn.addEventListener("pointerdown", startUnlock);
    btn.addEventListener("pointerup", cancelUnlock);
    btn.addEventListener("pointerleave", cancelUnlock);
    btn.addEventListener("pointercancel", cancelUnlock);
  });
}

// ── M3 Expressive Physics Motion System ──
function initM3MotionSystem() {
  if (prefersReducedMotion) return;

  // 1. Shared element transitions for section headings
  const sectionHeadings = document.querySelectorAll(".section-heading");
  if (typeof IntersectionObserver !== "undefined") {
    const headingObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("m3-entered");
          headingObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });
    sectionHeadings.forEach((h) => headingObserver.observe(h));
  }

  // 2. Momentum-based scroll deceleration for cards
  const fintechCards = document.querySelectorAll(".gf-fintech-card");
  if (typeof IntersectionObserver !== "undefined") {
    const cardObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const ratio = entry.intersectionRatio;
          const el = entry.target;
          // M3 Emphasized decelerate: elements settle gently into view
          const shift = (1 - ratio) * 30;
          const scale = 0.96 + ratio * 0.04;
          el.style.transform = `translateY(${shift.toFixed(1)}px) scale(${scale.toFixed(3)})`;
          el.style.opacity = String(Math.min(1, ratio * 1.5).toFixed(2));
          if (ratio > 0.8) {
            el.style.transform = "translateY(0) scale(1)";
            el.style.opacity = "1";
          }
        }
      });
    }, { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });
    fintechCards.forEach((c) => cardObserver.observe(c));
  }

  // 3. Container transform for modals (M3 pattern: scale from origin)
  document.querySelectorAll(".flow-modal").forEach((modal) => {
    const content = modal.querySelector(".flow-modal__content");
    if (!content) return;
    content.style.transition = "transform 500ms cubic-bezier(0.05, 0.7, 0.1, 1), opacity 300ms ease";
    // Watch for open class to apply entry animation
    const obs = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        if (m.attributeName !== "class") return;
        const isOpen = modal.classList.contains("flow-modal--open");
        if (isOpen) {
          content.style.transform = "scale(0.85) translateY(20px)";
          content.style.opacity = "0";
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              content.style.transform = "scale(1) translateY(0)";
              content.style.opacity = "1";
            });
          });
        }
      });
    });
    obs.observe(modal, { attributes: true, attributeFilter: ["class"] });
  });

  // 4. Physics spring for stat counters (count-up with deceleration)
  const statValues = document.querySelectorAll(".stat-card .value");
  if (typeof IntersectionObserver !== "undefined") {
    const statObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        if (el.dataset.counted) return;
        el.dataset.counted = "true";
        const text = el.textContent.trim();
        const match = text.match(/([\d,.]+)/);
        if (!match) return;
        const raw = match[1].replace(/,/g, "");
        const target = parseFloat(raw);
        if (isNaN(target)) return;
        const prefix = text.substring(0, text.indexOf(match[1]));
        const suffix = text.substring(text.indexOf(match[1]) + match[1].length);
        const isFloat = raw.includes(".");
        const duration = 1200;
        const start = performance.now();

        function step(now) {
          const elapsed = now - start;
          // M3 emphasized decelerate curve approximation
          const t = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
          const current = eased * target;
          el.textContent = prefix + (isFloat ? current.toFixed(1) : numberFormatter.format(Math.round(current))) + suffix;
          if (t < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
        statObserver.unobserve(el);
      });
    }, { threshold: 0.5 });
    statValues.forEach((v) => statObserver.observe(v));
  }
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
        const profile = readVisitProfile();
        profile.lastSection = entry.target.id;
        writeVisitProfile(profile);
      });
    },
    { threshold: 0.45 }
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

function buildCommandPalette() {
  commandRegistry = [
    { id: "start-trial", title: "Start free trial", hint: "Open subscription modal", kbd: "T", run: () => openModal(subscribeModal) },
    { id: "inspect-flow", title: "Inspect telemetry", hint: "Open workflow summary", kbd: "I", run: () => inspectFlow() },
    { id: "run-orchestration", title: "Launch orchestration", hint: "Run full automation sequence", kbd: "R", run: () => launchOrchestrationBtn?.click() },
    { id: "goto-workflow", title: "Go to workflow", hint: "Jump to workflow section", kbd: "W", run: () => scrollToSelector("#flowboard") },
    { id: "goto-integrations", title: "Go to integrations", hint: "Jump to integrations section", kbd: "G", run: () => scrollToSelector("#integrations") },
    { id: "toggle-autopilot", title: "Toggle autopilot", hint: "Pause or resume autonomous loops", kbd: "A", run: () => autopilotToggle?.click() },
    { id: "open-login", title: "Open login", hint: "Authenticate account session", kbd: "L", run: () => openModal(loginModal) },
  ].filter((cmd) => typeof cmd.run === "function");
}

function renderCommandList(query = "") {
  if (!commandList) return;
  const q = normalizeText(query);
  const items = commandRegistry.filter((cmd) => !q || normalizeText(`${cmd.title} ${cmd.hint}`).includes(q));
  commandList.innerHTML = "";
  items.forEach((cmd, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `command-item${index === 0 ? " is-active" : ""}`;
    button.innerHTML = `<span><strong>${cmd.title}</strong><br><small>${cmd.hint}</small></span><span class="command-kbd">${cmd.kbd}</span>`;
    button.addEventListener("click", () => {
      closeModal(commandModal);
      cmd.run();
    });
    commandList.appendChild(button);
  });
}

function openCommandPalette() {
  if (!commandModal) return;
  if (!commandRegistry.length) buildCommandPalette();
  renderCommandList(commandSearch?.value || "");
  openModal(commandModal);
  if (commandSearch) {
    commandSearch.value = "";
    window.setTimeout(() => commandSearch.focus(), 10);
  }
}

function initCommandPalette() {
  if (!commandModal) return;
  buildCommandPalette();
  renderCommandList("");
  commandSearch?.addEventListener("input", () => renderCommandList(commandSearch.value));
  document.addEventListener("keydown", (event) => {
    const key = String(event.key || "").toLowerCase();
    if ((event.metaKey || event.ctrlKey) && key === "k") {
      event.preventDefault();
      openCommandPalette();
      return;
    }
    const tag = event.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (key === "t") openModal(subscribeModal);
    if (key === "r") launchOrchestrationBtn?.click();
    if (key === "w") scrollToSelector("#flowboard");
    if (key === "g") scrollToSelector("#integrations");
    if (key === "a") autopilotToggle?.click();
    if (key === "l") openModal(loginModal);
  });
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

function startSocialLogin(provider) {
  const returnTo = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  window.location.assign(apiUrl(`/auth/${provider}/start?return_to=${encodeURIComponent(returnTo)}`));
}

function setBillingMode(mode) {
  billingMode = mode;
  priceCells.forEach((cell) => {
    cell.textContent = cell.dataset[mode] || cell.textContent;
  });
  if (monthlyToggle) monthlyToggle.classList.toggle("is-active", mode === "monthly");
  if (annualToggle) annualToggle.classList.toggle("is-active", mode === "annual");
}

// ── M3 Snackbar (toast replacement) ──
let snackbarTimer = null;
function showToast(text) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  // Clear previous timer
  if (snackbarTimer) clearTimeout(snackbarTimer);
  toast.classList.remove("is-visible");
  // Force reflow for re-animation
  void toast.offsetHeight;
  toast.textContent = text;
  toast.classList.add("is-visible");
  // M3 spec: snackbar auto-dismisses after 4 seconds
  snackbarTimer = setTimeout(() => {
    toast.classList.remove("is-visible");
    snackbarTimer = null;
  }, 4000);
}

function integrationTone(status) {
  if (["connected", "reachable", "auth_required"].includes(status)) return "ok";
  if (["not_configured", "degraded"].includes(status)) return "warn";
  return "bad";
}

function renderIntegrationHealth(item) {
  const connectorId = item?.id;
  if (!connectorId) return;
  const statusEl = document.querySelector(`[data-integration-health="${connectorId}"]`);
  const card = document.querySelector(`.connector-card[data-connector-id="${connectorId}"]`);
  if (!statusEl || !card) return;
  const status = String(item.status || "unknown");
  const code = item.status_code ? ` (${item.status_code})` : "";
  const latency = item.latency_ms == null ? "" : ` - ${item.latency_ms}ms`;
  statusEl.textContent = `${status}${code}${latency} - ${item.message || ""}`;
  card.dataset.health = integrationTone(status);
}

async function refreshIntegrationHealth() {
  try {
    const data = await fetchJson("/api/integrations/status");
    const items = Array.isArray(data.items) ? data.items : [];
    items.forEach((item) => renderIntegrationHealth(item));
  } catch (error) {
    console.warn("Integration health refresh failed", error);
  }
}

async function refreshSingleIntegration(connectorId) {
  if (!connectorId) return;
  const statusEl = document.querySelector(`[data-integration-health="${connectorId}"]`);
  if (statusEl) statusEl.textContent = "Checking live status...";
  try {
    const data = await fetchJson(`/api/integrations/${connectorId}/status`);
    if (data && data.item) renderIntegrationHealth(data.item);
    showToast(`${connectorId} status refreshed`);
  } catch (error) {
    if (statusEl) statusEl.textContent = error.message || "Status check failed.";
    showToast(error.message || "Status check failed");
  }
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
      scrollToSelector("#flowboard");
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
});

integrationCheckButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const connectorId = button.dataset.integrationCheck;
    refreshSingleIntegration(connectorId);
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

// ═══════════════════════════════════════════════════════════════════
// M3 RIPPLE EFFECT — Per M3 interaction spec
// ═══════════════════════════════════════════════════════════════════
function initM3Ripple() {
  const rippleTargets = document.querySelectorAll(
    "button, .btn, .primary, .ghost, .btn-filled, .btn-tonal, .btn-outlined, .btn-text, .btn-elevated, .fab, .spatial-fab, .spatial-item, .chip, .nav a"
  );

  rippleTargets.forEach((el) => {
    el.addEventListener("pointerdown", (e) => {
      if (prefersReducedMotion) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const size = Math.max(rect.width, rect.height) * 2;

      const ripple = document.createElement("span");
      ripple.className = "md-ripple";
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${x - size / 2}px`;
      ripple.style.top = `${y - size / 2}px`;
      el.appendChild(ripple);

      ripple.addEventListener("animationend", () => ripple.remove());
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// M3 THEME TOGGLE — Dark/Light with localStorage
// ═══════════════════════════════════════════════════════════════════
function initM3ThemeToggle() {
  if (!themeToggle) return;

  // Restore saved theme
  const saved = localStorage.getItem("globalflow_theme");
  if (saved) {
    document.documentElement.setAttribute("data-theme", saved);
    document.body.setAttribute("data-theme", saved);
    updateThemeIcon(saved);
  }

  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    document.body.setAttribute("data-theme", next);
    localStorage.setItem("globalflow_theme", next);
    updateThemeIcon(next);
    // Update meta theme-color for mobile browsers
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = next === "dark" ? "#111318" : "#FBF8FF";
  });
}

function updateThemeIcon(theme) {
  if (!themeIcon) return;
  themeIcon.textContent = theme === "dark" ? "light_mode" : "dark_mode";
}

// ═══════════════════════════════════════════════════════════════════
// M3 TOP APP BAR — Scroll-aware elevation
// ═══════════════════════════════════════════════════════════════════
function initM3TopAppBar() {
  if (!topAppBar) return;
  window.addEventListener("scroll", () => {
    topAppBar.classList.toggle("is-scrolled", window.scrollY > 8);
  }, { passive: true });
}

// ═══════════════════════════════════════════════════════════════════
// M3 FAB SCROLL — Hide on scroll down, show on scroll up
// ═══════════════════════════════════════════════════════════════════
function initM3FabScroll() {
  const fabContainer = document.getElementById("spatial-menu");
  if (!fabContainer) return;
  let lastScrollY = window.scrollY;

  window.addEventListener("scroll", () => {
    const currentScrollY = window.scrollY;
    if (currentScrollY > lastScrollY && currentScrollY > 200) {
      fabContainer.classList.add("is-fab-hidden");
    } else {
      fabContainer.classList.remove("is-fab-hidden");
    }
    lastScrollY = currentScrollY;
  }, { passive: true });
}

// ═══════════════════════════════════════════════════════════════════
// M3 SECTION HEADING OBSERVER — Animate on scroll into view
// ═══════════════════════════════════════════════════════════════════
function initM3SectionHeadings() {
  if (prefersReducedMotion || typeof IntersectionObserver === "undefined") {
    document.querySelectorAll(".section-heading").forEach((h) => h.classList.add("m3-entered"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("m3-entered");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  document.querySelectorAll(".section-heading").forEach((h) => observer.observe(h));
}

// ═══════════════════════════════════════════════════════════════════
// M3 SCROLL PROGRESS — Linear progress indicator
// ═══════════════════════════════════════════════════════════════════
function initM3ScrollProgress() {
  const progressBar = document.getElementById("scroll-progress");
  if (!progressBar) return;

  window.addEventListener("scroll", () => {
    const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    const pct = Math.min(window.scrollY / maxScroll, 1);
    progressBar.style.setProperty("--scroll-pct", pct.toFixed(4));
  }, { passive: true });
}

// ═══════════════════════════════════════════════════════════════════
// M3 MOBILE NAV — Active state indicator
// ═══════════════════════════════════════════════════════════════════
function initM3MobileNav() {
  const dockLinks = document.querySelectorAll(".mobile-dock a[href^='#']");
  if (!dockLinks.length || typeof IntersectionObserver === "undefined") return;

  const sections = [...dockLinks]
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      dockLinks.forEach((link) => {
        link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`);
      });
    });
  }, { threshold: 0.35 });

  sections.forEach((s) => observer.observe(s));
}

async function bootstrap() {
  trackVisitProfile();
  const segment = applyAnticipatoryDesign();
  applySegmentCopy(segment);
  applyPrimaryActionFocus();
  initFrictionShortcuts();
  hydrateConversionForms();
  handleAuthReturn();
  initRevealObserver();
  initActiveNav();
  initAmbientVfx();
  initMagneticButtons();
  initKineticType();
  initCommandPalette();
  initSpatialMenu();
  initFintechUnlockButtons();
  initM3MotionSystem();
  // M3 behavior initializers
  initM3Ripple();
  initM3ThemeToggle();
  initM3TopAppBar();
  initM3FabScroll();
  initM3SectionHeadings();
  initM3ScrollProgress();
  initM3MobileNav();
  if (integrationSearch) integrationSearch.addEventListener("input", filterIntegrations);
  filterIntegrations();
  setBillingMode(billingMode);
  await Promise.allSettled([
    fetchTasks(),
    fetchSummary(),
    refreshMetrics(),
    refreshAutopilotStatus(),
    fetchActivity(),
    refreshIntegrationHealth(),
  ]);
}

bootstrap().catch((error) => {
  setReliabilityState("warning", "Startup checks delayed");
  console.warn("Bootstrap failed", error);
});

document.addEventListener("visibilitychange", () => {
  pollers.forEach((poller) => poller.restart());
});

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
scheduleSafe(refreshIntegrationHealth, 60000);
