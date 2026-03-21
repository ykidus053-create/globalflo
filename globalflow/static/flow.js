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

let metricsCache = {};
let activityCount = 0;
let revealObserver = null;
let billingMode = "monthly";
let autopilotState = {
  enabled: autopilotData?.dataset?.enabled === "true",
  next_run: autopilotData?.dataset?.nextRun || null,
  last_run: autopilotData?.dataset?.lastRun || null,
  cycles: parseInt(autopilotData?.dataset?.cycles || "0", 10),
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
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
  const data = await fetchJson("/api/tasks");
  renderTasks(data.tasks);
}

async function fetchSummary() {
  const data = await fetchJson("/api/flow");
  renderSummary(data.next_steps);
  return data;
}

async function refreshMetrics() {
  try {
    metricsCache = await fetchJson("/api/metrics");
    refreshControlReadout();
  } catch (error) {
    setReliabilityState("warning", "Waiting on system response");
    console.warn("Metrics refresh failed", error);
  }
}

async function refreshAutopilotStatus() {
  if (!autopilotToggle) return;
  try {
    const data = await fetchJson("/api/autopilot");
    updateAutopilotDisplay(data);
  } catch (error) {
    setReliabilityState("warning", "Autopilot signal delayed");
    console.warn("Autopilot status unavailable", error);
  }
}

async function fetchActivity() {
  if (!activityFeed) return;
  try {
    const body = await fetchJson("/api/activity");
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
  window.history.replaceState({ modalId: null }, "", window.location.pathname);
}

function pushModalHistory(modalId) {
  if (!historySupported) return;
  window.history.pushState({ modalId }, "", `${window.location.pathname}#${modalId}`);
}

function resetModalHistory() {
  if (!historySupported) return;
  window.history.replaceState({ modalId: null }, "", window.location.pathname);
}

function openModal(target) {
  if (!target) return;
  target.classList.add("flow-modal--open");
  pushModalHistory(target.id);
}

function closeModal(target, skipHistory = false) {
  if (!target) return;
  target.classList.remove("flow-modal--open");
  if (!skipHistory) resetModalHistory();
}

window.addEventListener("popstate", (event) => {
  const modalId = event.state?.modalId;
  const openModalEl = document.querySelector(".flow-modal--open");
  if (!modalId && openModalEl) closeModal(openModalEl, true);
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
}

function scrollToSelector(selector) {
  const element = document.querySelector(selector);
  if (!element) return;
  element.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
}

function openCheckoutForTier(tierId) {
  if (!tierId) return;
  showToast("Opening subscription checkout...");
  window.location.assign(`/checkout/${tierId}`);
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
    showToast("Launching automation flow...");
    await fetchTasks();
    scrollToSelector("#flowboard");
    triggerFlow();
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

initRevealObserver();
initActiveNav();
setBillingMode(billingMode);
fetchTasks();
fetchSummary();
refreshMetrics();
refreshAutopilotStatus();
fetchActivity();

window.setInterval(fetchTasks, 15000);
window.setInterval(fetchSummary, 30000);
window.setInterval(refreshMetrics, 45000);
window.setInterval(refreshAutopilotStatus, 30000);
window.setInterval(fetchActivity, 30000);
