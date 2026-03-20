const workflowGrid = document.getElementById("workflow-grid");
const nextSteps = document.getElementById("flow-next-steps");
const radiant = document.getElementById("radiant");
const statCells = document.querySelectorAll("[data-stat-key]");
const inspectButton = document.getElementById("inspect-flow");
const modal = document.getElementById("flow-modal");
const modalClose = document.getElementById("flow-modal-close");
const modalBody = document.getElementById("flow-modal-body");
const subscribeBtn = document.getElementById("subscribe-btn");
const signupBtn = document.getElementById("signup-btn");
const subscribeModal = document.getElementById("subscribe-modal");
const signupModal = document.getElementById("signup-modal");
const subscribeForm = document.getElementById("subscribe-form");
const signupForm = document.getElementById("signup-form");
const sidebarSubscribeBtn = document.getElementById("sidebar-subscribe-btn");
const sidebarSignupBtn = document.getElementById("sidebar-signup-btn");
const sidebarWorkflowBtn = document.getElementById("sidebar-workflow-btn");
const launchOrchestrationBtn = document.getElementById("launch-orchestration");
const loginButton = document.getElementById("open-login");
const loginModal = document.getElementById("login-modal");
const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");
const autopilotToggle = document.getElementById("autopilot-toggle");
const autopilotStatusEl = document.getElementById("autopilot-status");
const autopilotNextRunEl = document.getElementById("autopilot-next-run");
const autopilotCycleCount = document.getElementById("autopilot-cycle-count");
const autopilotPosture = document.getElementById("autopilot-posture");
const systemConfidence = document.getElementById("system-confidence");
const queuePressure = document.getElementById("queue-pressure");
const activityTotal = document.getElementById("activity-total");
const reliabilityState = document.getElementById("reliability-state");
const lastSync = document.getElementById("last-sync");
const signalDot = document.getElementById("signal-dot");
const panelHealth = document.getElementById("panel-health");
const autopilotData = document.getElementById("autopilot-data");
const navLinks = document.querySelectorAll(".nav a[href^='#']");
const toolkitButtons = document.querySelectorAll("[data-tool-action]");
const subscriptionButtons = document.querySelectorAll("[data-checkout-tier]");
const connectorForms = document.querySelectorAll(".connector-form");
const paymentButtons = document.querySelectorAll("[data-payment-method]");
const activityFeed = document.getElementById("activity-feed");
const numberFormatter = new Intl.NumberFormat("en-US");
const SESSION_KEY = "globalflow_session";
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let metricsCache = {};
let activityCount = 0;
let revealObserver = null;
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
    if (errors > 0) {
      label = "Attention";
    } else if (signal > 18) {
      label = "High flow";
    } else if (signal > 8) {
      label = "Rising";
    }
    queuePressure.textContent = label;
  }

  if (activityTotal) {
    activityTotal.textContent = `${activityCount} event${activityCount === 1 ? "" : "s"}`;
  }

  if (autopilotPosture) {
    autopilotPosture.textContent = autopilotState.enabled ? "Autonomous live" : "Manual ready";
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
  refreshControlReadout();
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
      <button data-task-id="${task.id}">Kick off</button>
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
    activityFeed.innerHTML = `<div class="activity-entry"><p class="activity-message">No activity yet.</p><p class="activity-detail">Launch a workflow or connector to start the audit trail.</p></div>`;
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
  const data = await fetchJson("/api/tasks");
  renderTasks(data.tasks);
}

async function fetchSummary() {
  const data = await fetchJson("/api/flow");
  renderSummary(data.next_steps);
  return data;
}

async function refreshMetrics() {
  if (!statCells.length) return;
  try {
    metricsCache = await fetchJson("/api/metrics");
    statCells.forEach((cell) => {
      const key = cell.dataset.statKey;
      if (!key || metricsCache[key] === undefined) return;
      cell.textContent = numberFormatter.format(metricsCache[key]);
    });
    refreshControlReadout();
  } catch (error) {
    setReliabilityState("warning", "Waiting on system response");
    console.warn("Metrics refresh failed", error);
  }
}

async function refreshAutopilotStatus() {
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
  if (firstButton) {
    firstButton.click();
  }
}

function animateRadiant() {
  if (!radiant) return;
  const ctx = radiant.getContext("2d");
  const width = radiant.width;
  const height = radiant.height;

  if (prefersReducedMotion) {
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2, height / 2);
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(59, 245, 213, ${0.18 + i * 0.08})`;
      ctx.lineWidth = 1.2;
      ctx.arc(0, 0, 42 + i * 18, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2, height / 2);
    const now = Date.now() / 100;
    for (let i = 0; i < 10; i += 1) {
      ctx.beginPath();
      const radius = 30 + i * 12 + Math.sin(now + i) * 5;
      ctx.strokeStyle = `rgba(59, 245, 213, ${0.15 + i * 0.05})`;
      ctx.lineWidth = 1.2;
      ctx.arc(0, 0, radius, now * 0.5 + i, now * 0.5 + i + Math.PI * 1.2);
      ctx.stroke();
      ctx.closePath();
    }
    ctx.restore();
    window.requestAnimationFrame(draw);
  }

  draw();
}

function initRevealObserver() {
  const targets = document.querySelectorAll("main > section, .hero-panel, .proof-strip article, .hero-playbook article, .stat-card");
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
  if (revealObserver) {
    revealObserver.observe(target);
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
      });
    },
    { threshold: 0.45 }
  );

  sections.forEach((section) => observer.observe(section));
}

async function inspectFlow() {
  try {
    const data = await fetchSummary();
    if (modalBody) {
      modalBody.textContent = JSON.stringify(data, null, 2);
    }
    openModal(modal);
  } catch (error) {
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

function updateHistoryOnClose() {
  if (!historySupported) return;
  window.history.replaceState({ modalId: null }, "", window.location.pathname);
}

function openModal(target) {
  if (!target) return;
  target.classList.add("flow-modal--open");
  pushModalHistory(target.id);
}

function closeModal(target, { skipHistory = false } = {}) {
  if (!target) return;
  target.classList.remove("flow-modal--open");
  if (!skipHistory) {
    updateHistoryOnClose();
  }
}

window.addEventListener("popstate", (event) => {
  const modalId = event.state?.modalId;
  const openModalEl = document.querySelector(".flow-modal--open");
  if (!modalId && openModalEl) {
    closeModal(openModalEl, { skipHistory: true });
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
    if (statusEl) {
      statusEl.textContent = data.message || "Request received.";
    }
    showToast(data.message || "Request received");
    await refreshMetrics();
    closeModal(modalEl);
    if (data.checkout_url) {
      window.location.assign(data.checkout_url);
    }
  } catch (error) {
    if (statusEl) {
      statusEl.textContent = error.message || "Submission failed.";
    }
    showToast(error.message || "Submission failed");
  }
}

function loadSession() {
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
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
    if (input) {
      input.value = value;
    }
  });
  if (loginStatus) {
    loginStatus.textContent = `Session restored for ${saved.email || "you"}`;
  }
}

function scrollIntoView(selector) {
  const element = document.querySelector(selector);
  if (element) {
    element.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
  }
}

async function summonToolkitTool(toolId) {
  if (!toolId) return;
  try {
    const payload = await fetchJson(`/api/toolkit/${toolId}`);
    showToast(payload.message);
    await refreshMetrics();
    await fetchActivity();
  } catch (error) {
    showToast(error.message || "Toolkit action failed");
  }
}

function openCheckoutForTier(tierId) {
  if (!tierId) return;
  showToast("Opening subscription checkout...");
  window.location.assign(`/checkout/${tierId}`);
}

function showToast(text) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = text;
  toast.style.display = "block";
  if (!prefersReducedMotion) {
    toast.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 2200, easing: "ease-in-out" });
  }
  window.setTimeout(() => {
    toast.style.display = "none";
  }, 2200);
}

if (inspectButton) {
  inspectButton.addEventListener("click", inspectFlow);
}

if (modalClose) {
  modalClose.addEventListener("click", () => closeModal(modal));
}

document.querySelectorAll("[data-modal]").forEach((button) => {
  button.addEventListener("click", () => closeModal(document.getElementById(button.dataset.modal)));
});

[modal, subscribeModal, signupModal, loginModal].forEach((modalEl) => {
  if (!modalEl) return;
  modalEl.addEventListener("click", (event) => {
    if (event.target === modalEl) {
      closeModal(modalEl);
    }
  });
});

if (subscribeBtn) {
  subscribeBtn.addEventListener("click", () => openModal(subscribeModal));
}

if (signupBtn) {
  signupBtn.addEventListener("click", () => openModal(signupModal));
}

if (sidebarSubscribeBtn) {
  sidebarSubscribeBtn.addEventListener("click", () => openModal(subscribeModal));
}

if (sidebarSignupBtn) {
  sidebarSignupBtn.addEventListener("click", () => openModal(signupModal));
}

if (sidebarWorkflowBtn) {
  sidebarWorkflowBtn.addEventListener("click", () => scrollIntoView("#flowboard"));
}

if (launchOrchestrationBtn) {
  launchOrchestrationBtn.addEventListener("click", async () => {
    showToast("Launching automation flow...");
    await fetchTasks();
    scrollIntoView("#flowboard");
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

if (subscribeForm) {
  subscribeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await handleLeadCapture(subscribeForm, document.getElementById("subscribe-status"), subscribeModal);
  });
}

if (signupForm) {
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await handleLeadCapture(signupForm, document.getElementById("signup-status"), signupModal);
  });
}

if (loginButton) {
  loginButton.addEventListener("click", () => openModal(loginModal));
}

if (loginForm) {
  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(loginForm));
    saveSession(payload);
    if (loginStatus) {
      loginStatus.textContent = `Saved for ${payload.email}`;
    }
    showToast("Login info saved locally for next visit");
    closeModal(loginModal);
  });
  hydrateLoginForm();
}

toolkitButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showToast("Queuing automation toolset...");
    summonToolkitTool(button.dataset.toolAction);
  });
});

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
    if (statusEl) {
      statusEl.textContent = "Dispatching connector...";
    }
    const payload = Object.fromEntries(new FormData(form));
    try {
      const data = await fetchJson(`/api/connectors/${connectorId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (statusEl) {
        statusEl.textContent = data.message;
      }
      showToast(data.message);
      await refreshMetrics();
      await fetchActivity();
    } catch (error) {
      if (statusEl) {
        statusEl.textContent = error.message || "Connector failed.";
      }
      setReliabilityState("warning", "Connector retry needed");
      showToast(error.message || "Connector offline");
    }
  });
});

initRevealObserver();
initActiveNav();
fetchTasks();
fetchSummary();
refreshMetrics();
refreshAutopilotStatus();
fetchActivity();
animateRadiant();

window.setInterval(fetchTasks, 15000);
window.setInterval(fetchSummary, 30000);
window.setInterval(refreshMetrics, 45000);
window.setInterval(refreshAutopilotStatus, 30000);
window.setInterval(fetchActivity, 30000);
