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
const toolkitButtons = document.querySelectorAll("[data-tool-action]");

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

function openModal(target) {
  if (target) {
    target.classList.add("flow-modal--open");
  }
}

function closeModal(target) {
  if (target) {
    target.classList.remove("flow-modal--open");
  }
}

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
    }
  });
}

fetchTasks();
fetchSummary();
refreshMetrics();
setInterval(fetchTasks, 15000);
setInterval(fetchSummary, 30000);
setInterval(refreshMetrics, 45000);
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
  launchOrchestrationBtn.addEventListener("click", () => triggerFlow());
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
