const workflowGrid = document.getElementById("workflow-grid");
const nextSteps = document.getElementById("flow-next-steps");
const radiant = document.getElementById("radiant");
const statCells = document.querySelectorAll("[data-stat-key]");
const numberFormatter = new Intl.NumberFormat("en-US");

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
const autopilotData = document.getElementById("autopilot-data");
let autopilotState = {
  enabled: autopilotData?.dataset?.enabled === "true",
  next_run: autopilotData?.dataset?.nextRun || null,
  last_run: autopilotData?.dataset?.lastRun || null,
  cycles: parseInt(autopilotData?.dataset?.cycles || "0", 10),
};
const toolkitButtons = document.querySelectorAll("[data-tool-action]");
const subscriptionButtons = document.querySelectorAll("[data-checkout-tier]");
const connectorForms = document.querySelectorAll(".connector-form");
const activityFeed = document.getElementById("activity-feed");

async function fetchTasks() {
  const response = await fetch("/api/tasks");
  const data = await response.json();
  renderTasks(data.tasks);
}

async function fetchSummary() {
  const response = await fetch("/api/flow");
  const data = await response.json();
  renderSummary(data.next_steps);
  return data;
}

async function refreshMetrics() {
  if (!statCells.length) {
    return;
  }
  try {
    const response = await fetch("/api/metrics");
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    statCells.forEach((cell) => {
      const key = cell.dataset.statKey;
      if (!key) {
        return;
      }
      const value = data[key];
      if (value === undefined) {
        return;
      }
      cell.textContent = numberFormatter.format(value);
    });
  } catch (error) {
    console.warn("Metrics refresh failed", error);
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

function updateAutopilotDisplay(data) {
  if (!data) return;
  autopilotState.enabled = data.enabled;
  autopilotState.next_run = data.next_run || null;
  autopilotState.cycles = Number(data.cycles ?? autopilotState.cycles);
  if (autopilotStatusEl) {
    autopilotStatusEl.textContent = data.enabled ? "Autopilot running" : "Autopilot idle";
  }
  if (autopilotNextRunEl) {
    autopilotNextRunEl.textContent = data.next_run
      ? `Next run in ${formatCountdown(data.next_run)}`
      : "Next run queued soon";
  }
  if (autopilotCycleCount) {
    autopilotCycleCount.textContent = `Cycles completed: ${autopilotState.cycles.toLocaleString()}`;
  }
  if (autopilotToggle) {
    autopilotToggle.textContent = data.enabled ? "Pause autonomous loops" : "Enable autonomous loops";
  }
}

async function refreshAutopilotStatus() {
  try {
    const response = await fetch("/api/autopilot");
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    updateAutopilotDisplay(data);
  } catch (error) {
    console.warn("Autopilot status unavailable", error);
  }
}

function renderActivity(events) {
  if (!activityFeed) return;
  if (!events || !events.length) {
    activityFeed.innerHTML = `<div class="activity-entry"><p class="activity-message">No activity yet.</p></div>`;
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
}

async function fetchActivity() {
  if (!activityFeed) return;
  try {
    const response = await fetch("/api/activity");
    if (!response.ok) {
      return;
    }
    const body = await response.json();
    renderActivity(body.events);
  } catch (error) {
    console.warn("Activity stream unavailable", error);
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
      <button data-task-id="${task.id}">Kick off</button>
    `;
    const button = card.querySelector("button");
    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "Running...";
      await runTask(task.id);
      button.disabled = false;
      button.textContent = "Kick off";
    });
    workflowGrid.appendChild(card);
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

async function runTask(taskId) {
  const response = await fetch(`/api/tasks/${taskId}/run`, { method: "POST" });
  if (!response.ok) {
    return;
  }
  await fetchTasks();
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

  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2, height / 2);
    const now = Date.now() / 100;
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      const radius = 30 + i * 12 + Math.sin(now + i) * 5;
      ctx.strokeStyle = `rgba(59, 245, 213, ${0.15 + i * 0.05})`;
      ctx.lineWidth = 1.2;
      ctx.arc(0, 0, radius, now * 0.5 + i, now * 0.5 + i + Math.PI * 1.2);
      ctx.stroke();
      ctx.closePath();
    }
    ctx.restore();
    requestAnimationFrame(draw);
  }
  draw();
}

async function inspectFlow() {
  const data = await fetchSummary();
  if (modalBody) {
    modalBody.textContent = JSON.stringify(data, null, 2);
  }
  openModal(modal);
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

const connectorForms = document.querySelectorAll(".connector-form");

function openModal(target) {
  if (target) {
    target.classList.add("flow-modal--open");
    pushModalHistory(target.id);
  }
}

function closeModal(target, { skipHistory = false } = {}) {
  if (target) {
    target.classList.remove("flow-modal--open");
    if (!skipHistory) {
      updateHistoryOnClose();
    }
  }
}

window.addEventListener("popstate", (event) => {
  const modalId = event.state?.modalId;
  const openModalEl = document.querySelector(".flow-modal--open");
  if (!modalId && openModalEl) {
    closeModal(openModalEl, { skipHistory: true });
  }
});

function submitSubscription(form, statusEl, modalEl) {
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const response = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const payload = await response.json();
    if (statusEl) {
      statusEl.textContent = payload.message || payload.detail || "Thanks! We'll stay in touch.";
    }
    if (response.ok && modalEl) {
      setTimeout(() => closeModal(modalEl), 1500);
      if (payload.checkout_url) {
        window.open(payload.checkout_url, "_blank");
      }
    }
  });
}

const SESSION_KEY = "globalflow_session";

function loadSession() {
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    window.localStorage.removeItem(SESSION_KEY);
  }
}

function saveSession(payload) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
}

function hydrateLoginForm() {
  if (!loginForm) {
    return;
  }
  const saved = loadSession();
  if (!saved) {
    return;
  }
  Object.entries(saved).forEach(([key, value]) => {
    const input = loginForm.querySelector(`[name="${key}"]`);
    if (input) {
      input.value = value;
    }
  });
  if (loginStatus) {
    loginStatus.textContent = `Session restored for ${saved.email || "you"}`;
  }
  showToast("Session restored from local storage");
}

fetchTasks();
fetchSummary();
refreshMetrics();
refreshAutopilotStatus();
fetchActivity();
setInterval(fetchTasks, 15000);
setInterval(fetchSummary, 30000);
setInterval(refreshMetrics, 45000);
setInterval(refreshAutopilotStatus, 30000);
setInterval(fetchActivity, 30000);
animateRadiant();

if (inspectButton) {
  inspectButton.addEventListener("click", inspectFlow);
}

if (modalClose) {
  modalClose.addEventListener("click", () => closeModal(modal));
}

if (modal) {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal(modal);
    }
  });
}

function scrollIntoView(selector) {
  const el = document.querySelector(selector);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

async function summonToolkitTool(toolId) {
  if (!toolId) return;
  try {
    const response = await fetch(`/api/toolkit/${toolId}`);
    if (!response.ok) {
      throw new Error("Toolkit action blocked");
    }
    const payload = await response.json();
    showToast(payload.message);
  } catch (error) {
    showToast("Toolkit action failed. Try again.");
  }
}

if (subscribeBtn) {
  subscribeBtn.addEventListener("click", () => openModal(subscribeModal));
}

const paymentButtons = document.querySelectorAll("[data-payment-method]");
paymentButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const method = button.dataset.paymentMethod;
    if (!method) return;
    showToast(`Opening ${method} portal…`);
    window.open(`/payment/${method}`, "_blank");
  });
});

if (signupBtn) {
  signupBtn.addEventListener("click", () => openModal(signupModal));
}

toolkitButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const toolId = button.dataset.toolAction;
    showToast("Queuing automation toolset...");
    summonToolkitTool(toolId);
  });
});

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
    showToast("Launching automation flow…");
    await fetchTasks();
    triggerFlow();
  });
}

if (autopilotToggle) {
  autopilotToggle.addEventListener("click", async () => {
    const targetState = !autopilotState.enabled;
    autopilotToggle.disabled = true;
    try {
      const response = await fetch("/api/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: targetState }),
      });
      const data = await response.json();
      updateAutopilotDisplay(data);
      showToast(data.enabled ? "Autopilot resumed" : "Autopilot paused");
    } catch (error) {
      showToast("Could not update autopilot.");
    } finally {
      autopilotToggle.disabled = false;
    }
  });
}

if (subscribeModal) {
  subscribeModal.addEventListener("click", (event) => {
    if (event.target === subscribeModal) {
      closeModal(subscribeModal);
    }
  });
}

if (signupModal) {
  signupModal.addEventListener("click", (event) => {
    if (event.target === signupModal) {
      closeModal(signupModal);
    }
  });
}

submitSubscription(subscribeForm, document.getElementById("subscribe-status"), subscribeModal);
submitSubscription(signupForm, document.getElementById("signup-status"), signupModal);

if (loginButton) {
  loginButton.addEventListener("click", () => openModal(loginModal));
}

if (loginModal) {
  loginModal.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      closeModal(loginModal);
    }
  });
}

subscriptionButtons.forEach((button) => {
  button.addEventListener("click", () => openCheckoutForTier(button.dataset.checkoutTier));
});

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
      const response = await fetch(`/api/connectors/${connectorId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.ok) {
        showToast(data.message);
        if (statusEl) {
          statusEl.textContent = data.message;
        }
      } else if (statusEl) {
        statusEl.textContent = data.detail || "Connector failed.";
      }
    } catch (error) {
      if (statusEl) {
        statusEl.textContent = "Connector unreachable.";
      }
      showToast("Connector offline, try again.");
    }
  });
});

function openCheckoutForTier(tierId) {
  if (!tierId) return;
  showToast("Opening subscription checkout…");
  window.open(`/checkout/${tierId}`, "_blank");
}

function showToast(text) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = text;
  toast.style.display = "block";
  toast.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 2200, easing: "ease-in-out" });
  setTimeout(() => {
    toast.style.display = "none";
  }, 2200);
}
