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
const storyRail = document.getElementById("strategy-story-rail");
const storyTitle = document.getElementById("story-title");
const storyCopy = document.getElementById("story-copy");
const strategyButtons = document.querySelectorAll("[data-ai-lab]");
const dtPhaseBar = document.getElementById("dt-phase-bar");
const dtTitle = document.getElementById("dt-title");
const dtSummary = document.getElementById("dt-summary");
const dtMicrosteps = document.getElementById("dt-microsteps");
const dtKpi = document.getElementById("dt-kpi");
const liveA11yScanButton = document.getElementById("run-live-a11y-scan");
const liveA11yOutput = document.getElementById("live-a11y-output");

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
let lastMotionTrigger = null;
let autopilotState = {
  enabled: autopilotData?.dataset?.enabled === "true",
  next_run: autopilotData?.dataset?.nextRun || null,
  last_run: autopilotData?.dataset?.lastRun || null,
  cycles: parseInt(autopilotData?.dataset?.cycles || "0", 10),
};
const inFlightTasks = new Map();
const pollers = [];
let shortcutShown = false;
const motionState = {
  profile: "balanced",
  performance: "high",
  intent: "guided",
  story: "intake",
  velocity: 0,
};

function rememberMotionTrigger(element) {
  if (!(element instanceof HTMLElement)) return;
  const rect = element.getBoundingClientRect();
  lastMotionTrigger = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function detectMotionPerformance() {
  const lowPower =
    (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  const saveData = navigator.connection?.saveData === true;
  const constrainedNetwork = /2g/.test(String(navigator.connection?.effectiveType || "").toLowerCase());
  return prefersReducedMotion || lowPower || saveData || constrainedNetwork ? "low" : "high";
}

function normalizeText(value) {
  return String(value || "").toLowerCase().trim();
}

function applyMotionProfile(nextProfile, nextPerformance) {
  motionState.profile = nextProfile || motionState.profile;
  motionState.performance = nextPerformance || motionState.performance;
  document.body.dataset.motionProfile = motionState.profile;
  document.body.dataset.motionPerformance = motionState.performance;
}

function resolveMotionProfile() {
  const profile = readVisitProfile();
  const visits = Number(profile.visits || 0);
  const interactions = Number(profile.interactions || 0);
  const performance = detectMotionPerformance();
  let mode = "balanced";
  if (interactions >= 12 || visits >= 4) mode = "power";
  else if (visits <= 1) mode = "guided";
  applyMotionProfile(mode, performance);
}

function setMotionIntent(intent) {
  motionState.intent = intent;
  document.body.dataset.motionIntent = intent;
}

function setMotionStory(story) {
  motionState.story = story || motionState.story;
  document.body.dataset.motionStory = motionState.story;
}

function registerMotionInteraction(weight = 1, intent = "guided") {
  const profile = readVisitProfile();
  profile.interactions = Number(profile.interactions || 0) + weight;
  writeVisitProfile(profile);
  if (intent) setMotionIntent(intent);

  const interactionCount = Number(profile.interactions || 0);
  const nextProfile = interactionCount >= 16 ? "power" : interactionCount <= 3 ? "guided" : "balanced";
  if (nextProfile !== motionState.profile) {
    applyMotionProfile(nextProfile, detectMotionPerformance());
  }
}

function pulseElement(element, className = "is-feedback-pulse") {
  if (!(element instanceof HTMLElement)) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  window.setTimeout(() => element.classList.remove(className), 900);
}

function createRipple(host, clientX, clientY) {
  if (!(host instanceof HTMLElement)) return;
  const rect = host.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 1.1;
  const ripple = document.createElement("span");
  ripple.className = "motion-ripple";
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left = `${clientX - rect.left - size / 2}px`;
  ripple.style.top = `${clientY - rect.top - size / 2}px`;
  host.querySelectorAll(".motion-ripple").forEach((node) => node.remove());
  host.appendChild(ripple);
  window.setTimeout(() => ripple.remove(), 760);
}

function markButtonBusy(button, busy, pendingLabel) {
  if (!(button instanceof HTMLElement)) return;
  if (!button.dataset.defaultLabel) {
    button.dataset.defaultLabel = button.textContent || "";
  }
  button.classList.toggle("is-busy", busy);
  if (busy) {
    if (pendingLabel) button.textContent = pendingLabel;
    button.setAttribute("aria-busy", "true");
    button.disabled = true;
  } else {
    button.textContent = button.dataset.defaultLabel;
    button.removeAttribute("aria-busy");
    button.disabled = false;
  }
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
      registerMotionInteraction(trigger.matches(".primary, .ghost") ? 2 : 1, "guided");

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
    "main > section, .hero-video-card, .hero-status-card, .logo-pill, .testimonial-card, .feature-card, .pricing-card, .payment-chip, .trust-card, .founder-card, .connector-card, .hero-proof-card, .hero-trust-card, .hero-media-card, .overview-panel, .endtoend-step, .activity-entry, .wf-signal-cell, .wf-operator-card, .wf-lane-card"
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
  target.style.setProperty("--reveal-order", String(revealIndex));
  target.classList.add(["has-reveal-up", "has-reveal-left", "has-reveal-right"][revealIndex % 3]);
  target.classList.add("reveal-ready");
  const staggerTargets = target.querySelectorAll(
    ".content-body > *, .hero-quickfacts > *, .hero-benefit-list > *, .hero-chip-row > *, .hero-trust-list > *, .pricing-list > *, .workflow-grid > *, .command-item, .connector-form > *, .method-grid > *, .endtoend-body > *"
  );
  staggerTargets.forEach((item, index) => item.style.setProperty("--child-order", String(index)));
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
  let lastScrollY = window.scrollY;
  let scrollFrame = null;

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
      motionState.velocity = Math.max(motionState.velocity * 0.88, Math.abs(x - 0.5) + Math.abs(y - 0.5));
      root.style.setProperty("--gf-pointer-energy", Math.min(motionState.velocity, 1.2).toFixed(3));
    },
    { passive: true }
  );

  window.addEventListener(
    "scroll",
    () => {
      if (!scrollFrame) {
        scrollFrame = window.requestAnimationFrame(() => {
          const delta = Math.abs(window.scrollY - lastScrollY);
          lastScrollY = window.scrollY;
          motionState.velocity = Math.min(1.4, delta / Math.max(window.innerHeight, 1) + motionState.velocity * 0.55);
          root.style.setProperty("--gf-scroll-velocity", motionState.velocity.toFixed(3));
          scrollFrame = null;
        });
      }
      const doc = document.documentElement;
      const maxScroll = Math.max(doc.scrollHeight - window.innerHeight, 1);
      const progress = window.scrollY / maxScroll;
      root.style.setProperty("--scroll-progress", progress.toFixed(4));
      if (scrollProgress) {
        scrollProgress.style.transform = `scaleX(${Math.max(progress, 0.02)})`;
      }
      parallaxSections.forEach((section, index) => {
        const rate = ((index % 3) + 1) * (motionState.profile === "power" ? 0.01 : 0.014);
        const offset = Math.min(window.scrollY * rate, motionState.performance === "low" ? 12 : 26);
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

function initDepthCards() {
  if (prefersReducedMotion) return;
  const cards = document.querySelectorAll(".gf-card, .workflow-card, .connector-card, .pricing-card, .payment-chip");
  cards.forEach((card) => {
    card.classList.add("motion-depth-card");
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5;
      const py = (event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5;
      card.style.setProperty("--card-tilt-x", `${(px * Number.parseFloat(getComputedStyle(document.body).getPropertyValue("--gf-motion-tilt") || "8")).toFixed(2)}deg`);
      card.style.setProperty("--card-tilt-y", `${(py * -1 * Number.parseFloat(getComputedStyle(document.body).getPropertyValue("--gf-motion-tilt") || "8")).toFixed(2)}deg`);
      card.classList.add("is-guided-hover");
    });
    card.addEventListener("pointerleave", () => {
      card.classList.remove("is-guided-hover");
      card.style.removeProperty("--card-tilt-x");
      card.style.removeProperty("--card-tilt-y");
    });
  });
}

function initGuidedFocus() {
  const buttons = document.querySelectorAll(".hero-actions .primary, .workflow-actions .primary, .connector-actions .primary, .hero-actions .ghost, .workflow-actions .ghost");
  buttons.forEach((button) => {
    button.addEventListener("pointerenter", () => {
      setMotionIntent("guided");
      button.classList.add("is-guided-focus");
    });
    button.addEventListener("pointerleave", () => {
      button.classList.remove("is-guided-focus");
    });
  });
}

function initCinematicSections() {
  const sections = Array.from(document.querySelectorAll("main > section, .wf-section, .checkout-hero, .checkout-offset, .payment-hero, .payment-form-section"));
  if (!sections.length) return;
  sections.forEach((section, index) => {
    section.classList.add("motion-section");
    section.style.setProperty("--motion-order", String(index));
  });
  if (typeof IntersectionObserver === "undefined") return;

  const storyMap = {
    hero: "intake",
    overview: "analysis",
    demo: "decision",
    "use-cases": "execute",
    flowboard: "execute",
    integrations: "learn",
    pricing: "learn",
    workspace: "capture",
    operators: "decision",
    signals: "analysis",
    immersive: "decision",
    board: "execute",
  };

  const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const section = entry.target;
          section.classList.remove("is-before", "is-active", "is-after");
          section.style.setProperty("--motion-visibility", entry.intersectionRatio.toFixed(3));
          if (entry.isIntersecting) {
            section.classList.add("is-active");
            const story = storyMap[section.id];
            if (story) setMotionStory(story);
            document.documentElement.style.setProperty("--gf-scene-progress", entry.intersectionRatio.toFixed(3));
          } else if (entry.boundingClientRect.top > 0) {
            section.classList.add("is-before");
          } else {
            section.classList.add("is-after");
          }
      });
    },
    { threshold: [0.2, 0.55, 0.8] }
  );
  sections.forEach((section) => observer.observe(section));

  window.addEventListener(
    "scroll",
    () => {
      const progress = Math.min(window.scrollY / Math.max(window.innerHeight, 1), 12);
      document.documentElement.style.setProperty("--gf-motion-scroll-shift", `${Math.min(progress * -1.2, 10)}px`);
    },
    { passive: true }
  );
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
      registerMotionInteraction(0.1, "guided");
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

function initPredictiveMotionEngine() {
  const root = document.documentElement;
  const watchedActions = document.querySelectorAll(".primary, .ghost, .nav a, .feature-link, summary");
  watchedActions.forEach((action) => {
    action.addEventListener("pointerdown", () => registerMotionInteraction(1, "rapid"));
    action.addEventListener("focus", () => setMotionIntent("guided"));
  });

  let idleTimer = null;
  const settle = () => {
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      motionState.velocity = motionState.velocity * 0.6;
      root.style.setProperty("--gf-scroll-velocity", motionState.velocity.toFixed(3));
      if (motionState.profile !== "power") setMotionIntent("guided");
    }, 700);
  };

  window.addEventListener("scroll", settle, { passive: true });
  window.addEventListener("pointermove", settle, { passive: true });
}

function initActionRipples() {
  const rippleTargets = document.querySelectorAll(".primary, .ghost, .wf-density, .wf-toggle, .feature-link, .connector-card summary, .command-item");
  rippleTargets.forEach((target) => {
    target.addEventListener(
      "pointerdown",
      (event) => {
        rememberMotionTrigger(target);
        const x = event.clientX || target.getBoundingClientRect().left + target.getBoundingClientRect().width / 2;
        const y = event.clientY || target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2;
        createRipple(target, x, y);
      },
      { passive: true }
    );
  });
}

function initHoverDisclosure() {
  const cards = document.querySelectorAll(".pricing-card, .connector-card, .explore-card, .hero-proof-card, .hero-status-card, .hero-trust-card, .wf-signal-cell, .wf-lane-card");
  cards.forEach((card) => {
    if (card.querySelector(".hover-disclosure")) return;
    const heading =
      card.querySelector("h3, h2, strong, .label, .connector-heading h3")?.textContent?.trim() ||
      card.getAttribute("data-connector-id") ||
      "Explore";
    const label = document.createElement("span");
    label.className = "hover-disclosure";
    label.textContent = heading;
    card.appendChild(label);
  });
}

function initDirectionalMotion() {
  document.querySelectorAll(".endtoend-step, .pricing-card, .explore-card, .connector-card").forEach((card, index) => {
    card.classList.add(index % 2 === 0 ? "motion-flow-forward" : "motion-flow-backward");
  });
}

function initDetailTransitions() {
  document.querySelectorAll("details.connector-card").forEach((detail) => {
    detail.addEventListener("toggle", () => {
      pulseElement(detail);
      detail.classList.toggle("is-detail-open", detail.open);
    });
  });
}

function initScrollCue() {
  const hero = document.getElementById("hero");
  if (!hero || hero.querySelector(".scroll-cue")) return;
  const cue = document.createElement("button");
  cue.type = "button";
  cue.className = "scroll-cue";
  cue.setAttribute("aria-label", "Scroll to next section");
  cue.innerHTML = '<span class="scroll-cue__label">Scroll</span><span class="scroll-cue__arrow" aria-hidden="true"></span>';
  cue.addEventListener("click", () => {
    registerMotionInteraction(1, "guided");
    scrollToSelector("#overview");
  });
  hero.appendChild(cue);
}

function initAutoScrollReveal() {
  if (prefersReducedMotion) return;
  if (window.location.hash || window.scrollY > 12) return;
  if (window.sessionStorage.getItem("globalflow_auto_reveal_done") === "1") return;
  window.sessionStorage.setItem("globalflow_auto_reveal_done", "1");
  window.setTimeout(() => {
    const targetY = Math.min(Math.round(window.innerHeight * 0.16), 120);
    window.scrollTo({ top: targetY, behavior: "smooth" });
  }, 900);
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

function initStorytellingRail() {
  if (!storyRail || !storyTitle || !storyCopy) return;
  const stages = {
    ingest: {
      title: "Ingest signals from every system.",
      copy: "GlobalFlow starts by collecting events from billing, support, files, and calls into one normalized stream so operators see one truth instead of fragmented dashboards.",
    },
    analyze: {
      title: "Analyze context and risk in one pass.",
      copy: "Cross-system correlation, confidence scoring, and anomaly checks transform raw events into prioritized insight that can be acted on safely.",
    },
    decide: {
      title: "Decide with policy and human control.",
      copy: "Guardrails determine whether the system can proceed automatically or needs human approval before execution.",
    },
    execute: {
      title: "Execute controlled actions with traceability.",
      copy: "Approved actions trigger connectors and workflow updates while every step is logged for compliance and debugging.",
    },
    learn: {
      title: "Learn from outcomes and continuously improve.",
      copy: "Feedback loops compare predictions vs outcomes to improve routing, reduce false positives, and sharpen recommendations.",
    },
  };

  const buttons = Array.from(storyRail.querySelectorAll(".story-node"));
  if (!buttons.length) return;

  const setStage = (stage) => {
    const next = stages[stage] || stages.ingest;
    storyTitle.textContent = next.title;
    storyCopy.textContent = next.copy;
    buttons.forEach((button) => {
      const isActive = button.dataset.storyNode === stage;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => setStage(button.dataset.storyNode));
  });

  const order = ["ingest", "analyze", "decide", "execute", "learn"];
  if (typeof IntersectionObserver === "undefined") {
    setStage(order[0]);
    return;
  }

  const observedSections = ["hero", "overview", "demo", "flowboard", "integrations"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  const observer = new IntersectionObserver(
    (entries) => {
      entries
        .filter((entry) => entry.isIntersecting)
        .forEach((entry) => {
          const map = {
            hero: "ingest",
            overview: "analyze",
            demo: "decide",
            flowboard: "execute",
            integrations: "learn",
          };
          const stage = map[entry.target.id];
          if (stage) setStage(stage);
        });
    },
    { threshold: 0.45 }
  );
  observedSections.forEach((section) => observer.observe(section));
}

function initStrategyLabActions() {
  if (!strategyButtons.length) return;
  const outputs = {
    generate: document.getElementById("strategy-output-generate"),
    predict: document.getElementById("strategy-output-predict"),
    audit: document.getElementById("strategy-output-audit"),
    handoff: document.getElementById("strategy-output-handoff"),
  };

  const lines = {
    generate:
      "Option A: Fastest operator route.\nOption B: Highest-confidence route.\nOption C: Lowest-risk route with extra review.",
    predict:
      "Predicted next best action:\n1) Open workflow board\n2) Trigger billing recovery\n3) Escalate churn-risk account for manual review",
    audit:
      "Interface quality score: 91/100\n- Critical readability alerts: 0\n- Control path coverage: complete\n- Motion safety: reduced-motion supported",
    handoff:
      "Handoff package generated:\n- Action summary included\n- Ownership and approval gates attached\n- Verification checks ready before execution",
  };

  strategyButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.aiLab;
      const output = outputs[mode];
      if (!output) return;
      output.textContent = "Processing...";
      window.setTimeout(() => {
        output.textContent = lines[mode] || "No data available.";
      }, 280);
    });
  });
}

function initDesignThinkingEngine() {
  if (!dtPhaseBar || !dtTitle || !dtSummary || !dtMicrosteps || !dtKpi) return;
  const phases = {
    empathize: {
      title: "Capture: understand the operating context.",
      summary: "Collect the incoming signals, blockers, and constraints before deciding how work should move.",
      microsteps: [
        "Collect signals from operators, customers, and systems.",
        "Map where work stalls or context gets lost.",
        "Segment by role, urgency, and operating conditions.",
        "Translate friction into observable action goals.",
      ],
      kpi: "Output KPI: signal coverage >= 80% of priority workflows.",
    },
    define: {
      title: "Frame: define the exact problem.",
      summary: "Turn the observed friction into a precise decision problem with measurable success criteria.",
      microsteps: [
        "Write one problem statement per high-friction workflow.",
        "Set one primary next action for each critical state.",
        "Define measurable success outcomes for execution speed and confidence.",
        "Prioritize by impact and implementation effort.",
      ],
      kpi: "Output KPI: each priority problem has a measurable outcome target.",
    },
    ideate: {
      title: "Compare: generate credible options.",
      summary: "Create competing action paths, then filter them by clarity, safety, and execution value.",
      microsteps: [
        "Generate baseline and assisted options for the same workflow.",
        "Stress-test the best path, safest path, and fastest path.",
        "Remove visual noise that does not improve action clarity.",
        "Select finalists using quality and reliability checks.",
      ],
      kpi: "Output KPI: >= 3 validated options per priority workflow.",
    },
    prototype: {
      title: "Prepare: build the execution-ready state.",
      summary: "Turn the selected path into a realistic, testable operating surface with full state coverage.",
      microsteps: [
        "Build shared states with explicit action outcomes.",
        "Validate mobile and laptop behavior separately.",
        "Apply clear feedback timing for interaction states.",
        "Map the selected path to reusable implementation patterns.",
      ],
      kpi: "Output KPI: parity across mobile and laptop critical flows.",
    },
    test: {
      title: "Validate: verify before execution.",
      summary: "Run quality, readability, and behavior checks, then feed the results back into the next operating cycle.",
      microsteps: [
        "Run quality review on critical surfaces.",
        "Execute readability, focus order, and control scans.",
        "Measure task completion and error frequency.",
        "Apply revisions and re-test until acceptance criteria pass.",
      ],
      kpi: "Output KPI: confidence target >= 82 and zero critical readability failures.",
    },
  };

  const buttons = Array.from(dtPhaseBar.querySelectorAll(".dt-phase"));
  if (!buttons.length) return;

  const renderPhase = (phaseKey) => {
    const phase = phases[phaseKey] || phases.empathize;
    dtTitle.textContent = phase.title;
    dtSummary.textContent = phase.summary;
    dtKpi.textContent = phase.kpi;
    dtMicrosteps.innerHTML = "";
    phase.microsteps.forEach((step) => {
      const item = document.createElement("li");
      item.textContent = step;
      dtMicrosteps.appendChild(item);
    });
    buttons.forEach((button) => {
      const active = button.dataset.dtPhase === phaseKey;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => renderPhase(button.dataset.dtPhase));
  });

  renderPhase("empathize");
}

function parseRgb(value) {
  const match = String(value || "").match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const parts = match[1].split(",").map((part) => Number(part.trim()));
  if (parts.length < 3 || parts.some((part, idx) => idx < 3 && Number.isNaN(part))) return null;
  return { r: parts[0], g: parts[1], b: parts[2] };
}

function relativeLuminance({ r, g, b }) {
  const channel = (value) => {
    const n = value / 255;
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(foreground, background) {
  const lumA = relativeLuminance(foreground);
  const lumB = relativeLuminance(background);
  const light = Math.max(lumA, lumB);
  const dark = Math.min(lumA, lumB);
  return (light + 0.05) / (dark + 0.05);
}

function runLiveAccessibilityScan() {
  if (!liveA11yOutput) return;
  const textTargets = Array.from(document.querySelectorAll(".gf-card p, .gf-card h2, .gf-card h3, .gf-card li, .gf-card small"));
  let scanned = 0;
  let alerts = 0;

  textTargets.forEach((node) => {
    const style = window.getComputedStyle(node);
    const parentStyle = window.getComputedStyle(node.closest(".gf-card") || node.parentElement || node);
    const fg = parseRgb(style.color);
    const bg = parseRgb(parentStyle.backgroundColor);
    if (!fg || !bg) return;
    scanned += 1;
    const ratio = contrastRatio(fg, bg);
    if (ratio < 4.5) alerts += 1;
  });

  const motionSafe = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "enabled" : "available";
  const keyboardPaths = document.querySelectorAll("button, a, input, select, textarea").length;
  const scoreBase = Math.max(0, 100 - alerts * 3);
  const score = Math.max(62, Math.min(99, scoreBase));

  liveA11yOutput.textContent =
    `Interface quality score: ${score}/100\n` +
    `- Scanned nodes: ${scanned}\n` +
    `- Readability alerts: ${alerts} (recommended ratio >= 4.5:1)\n` +
    `- Keyboard interaction paths detected: ${keyboardPaths}\n` +
    `- Reduced-motion handling: ${motionSafe}`;
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
  if (lastMotionTrigger) {
    target.style.setProperty("--modal-origin-x", `${lastMotionTrigger.x}px`);
    target.style.setProperty("--modal-origin-y", `${lastMotionTrigger.y}px`);
  }
  target.classList.remove("is-closing");
  target.classList.add("is-opening");
  target.classList.add("flow-modal--open");
  activeModalId = target.id;
  pulseElement(target.querySelector(".flow-modal__content"));
  window.setTimeout(() => target.classList.remove("is-opening"), 420);
  if (pushHistory) pushModalHistory(target.id);
}

function closeModal(target, skipHistory = false) {
  if (!target) return;
  target.classList.add("is-closing");
  target.classList.remove("flow-modal--open");
  activeModalId = null;
  window.setTimeout(() => target.classList.remove("is-closing"), 260);
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

function showToast(text) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = text;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.style.display = "block";
  toast.classList.add("is-visible");
  pulseElement(toast);
  if (!prefersReducedMotion) {
    toast.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 2200, easing: "ease-in-out" });
  }
  window.setTimeout(() => {
    toast.style.display = "none";
    toast.classList.remove("is-visible");
  }, 2200);
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
  pulseElement(statusEl);
  pulseElement(card);
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
    registerMotionInteraction(2, "guided");
    setMotionIntent("guided");
    setMotionStory("decision");
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
    markButtonBusy(launchOrchestrationBtn, true, "Launching");
    try {
      registerMotionInteraction(3, "rapid");
      setMotionIntent("rapid");
      setMotionStory("execute");
      showToast("Launching automation flow...");
      await fetchTasks();
      scrollToSelector("#flowboard");
      triggerFlow();
    } catch (error) {
      setReliabilityState("warning", "Launch delayed");
      showToast(error.message || "Could not launch orchestration");
    } finally {
      markButtonBusy(launchOrchestrationBtn, false);
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
    registerMotionInteraction(2, "rapid");
    const method = button.dataset.paymentMethod;
    if (!method) return;
    showToast(`Opening ${method} portal...`);
    window.location.assign(`/payment/${method}`);
  });
});

subscriptionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    registerMotionInteraction(2, "rapid");
    openCheckoutForTier(button.dataset.checkoutTier);
  });
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
    const submitButton = form.querySelector("button[type='submit']");
    markButtonBusy(submitButton, true, "Routing");
    if (statusEl) statusEl.textContent = "Dispatching connector...";
    const payload = Object.fromEntries(new FormData(form));
    try {
      setMotionIntent("rapid");
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
    } finally {
      markButtonBusy(submitButton, false);
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
if (liveA11yScanButton) {
  liveA11yScanButton.addEventListener("click", runLiveAccessibilityScan);
}

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

async function bootstrap() {
  trackVisitProfile();
  resolveMotionProfile();
  setMotionIntent("guided");
  const segment = applyAnticipatoryDesign();
  applySegmentCopy(segment);
  applyPrimaryActionFocus();
  initFrictionShortcuts();
  hydrateConversionForms();
  handleAuthReturn();
  initRevealObserver();
  initActiveNav();
  initAmbientVfx();
  initDepthCards();
  initGuidedFocus();
  initCinematicSections();
  initPredictiveMotionEngine();
  initActionRipples();
  initHoverDisclosure();
  initDirectionalMotion();
  initDetailTransitions();
  initScrollCue();
  initMagneticButtons();
  initKineticType();
  initStorytellingRail();
  initStrategyLabActions();
  initDesignThinkingEngine();
  initCommandPalette();
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
  initAutoScrollReveal();
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
