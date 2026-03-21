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

const connectorForms = document.querySelectorAll(".connector-form");
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

let metricsCache = {};
let activityCount = 0;
let revealObserver = null;
let billingMode = "monthly";
let activeModalId = null;
let summaryCache = null;
let autopilotState = {
  enabled: autopilotData?.dataset?.enabled === "true",
  next_run: autopilotData?.dataset?.nextRun || null,
  last_run: autopilotData?.dataset?.lastRun || null,
  cycles: parseInt(autopilotData?.dataset?.cycles || "0", 10),
};
const inFlightTasks = new Map();
const pollers = [];

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
    card.className = "workflow-card";
    card.innerHTML = `
      <span class="workflow-status">${task.status}</span>
      <h4>${task.domain}</h4>
      <p>${task.next_action}</p>
      <p class="note">${task.note}</p>
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
      '<div class="activity-entry"><p class="activity-message">No activity yet.</p><p class="activity-detail">Launch a workflow or connector to start the audit trail.</p></div>';
    return;
  }

  activityFeed.innerHTML = events
    .map(
      (event) => `
      <article class="activity-entry">
        <span class="activity-kind">${event.kind || "event"}</span>
        <p class="activity-message">${event.message}</p>
        <p class="activity-detail">${event.detail || ""}</p>
        <time>${new Date(event.timestamp).toLocaleString()}</time>
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
  target.classList.add("reveal-ready");
  if (prefersReducedMotion) {
    target.classList.add("is-visible");
    return;
  }
  if (revealObserver) revealObserver.observe(target);
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

async function bootstrap() {
  handleAuthReturn();
  initRevealObserver();
  initActiveNav();
  setBillingMode(billingMode);
  await Promise.allSettled([fetchTasks(), fetchSummary(), refreshMetrics(), refreshAutopilotStatus(), fetchActivity()]);
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
