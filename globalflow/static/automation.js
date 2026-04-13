const workflowGrid = document.getElementById("workflow-grid");
const nextSteps = document.getElementById("flow-next-steps");
const activityFeed = document.getElementById("activity-feed");
const launchOrchestrationBtn = document.getElementById("launch-orchestration");
const inspectFlowBtn = document.getElementById("inspect-flow");
const runAllFlowsBtn = document.getElementById("run-all-flows");
const runManualCycleBtn = document.getElementById("run-manual-cycle");
const autopilotToggleBtn = document.getElementById("autopilot-toggle");
const autopilotStatusEl = document.getElementById("autopilot-status");
const autopilotNextRunEl = document.getElementById("autopilot-next-run");
const autopilotCycleCountEl = document.getElementById("autopilot-cycle-count");
const reliabilityState = document.getElementById("reliability-state");
const signalDot = document.getElementById("signal-dot");
const lastSync = document.getElementById("last-sync");
const systemConfidence = document.getElementById("system-confidence");
const queuePressure = document.getElementById("queue-pressure");
const activityTotal = document.getElementById("activity-total");
const flowModal = document.getElementById("flow-modal");
const flowModalBody = document.getElementById("flow-modal-body");
const flowModalClose = document.getElementById("flow-modal-close");

function showToast(text) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = text;
  toast.style.display = "block";
  window.setTimeout(() => {
    toast.style.display = "none";
  }, 2200);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || payload.message || `Request failed (${response.status})`);
  }
  if (lastSync) {
    lastSync.textContent = `Last sync ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  return payload;
}

function formatCountdown(nextRunIso) {
  if (!nextRunIso) return "Pending";
  const next = new Date(nextRunIso);
  const delta = next.getTime() - Date.now();
  if (delta <= 0) return "Starting now";
  const minutes = Math.floor(delta / 60000);
  const seconds = Math.floor((delta % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function updateAutopilot(state) {
  if (!state) return;
  if (autopilotStatusEl) autopilotStatusEl.textContent = state.enabled ? "Running" : "Paused";
  if (autopilotNextRunEl) autopilotNextRunEl.textContent = state.next_run ? formatCountdown(state.next_run) : "Pending";
  if (autopilotCycleCountEl) autopilotCycleCountEl.textContent = String(state.cycles ?? 0);
  if (autopilotToggleBtn) autopilotToggleBtn.textContent = state.enabled ? "Pause autopilot" : "Resume autopilot";
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
      <p>${task.next_action || ""}</p>
      <p class="note">${task.note || ""}</p>
      <button class="primary small" type="button" data-run-task="${task.id}">Run ${task.domain}</button>
    `;
    workflowGrid.appendChild(card);
  });

  workflowGrid.querySelectorAll("[data-run-task]").forEach((button) => {
    button.addEventListener("click", async () => {
      const taskId = button.dataset.runTask;
      if (!taskId) return;
      button.disabled = true;
      button.textContent = "Running...";
      try {
        const data = await fetchJson(`/api/tasks/${taskId}/run`, { method: "POST" });
        showToast(`${taskId} completed`);
        if (data?.task?.note) {
          const entry = document.createElement("li");
          entry.textContent = `${taskId}: ${data.task.note}`;
          nextSteps?.prepend(entry);
        }
        await Promise.all([loadTasks(), loadActivity(), loadMetrics(), loadAutopilot()]);
      } catch (error) {
        showToast(error.message || "Task run failed");
      } finally {
        button.disabled = false;
        button.textContent = `Run ${taskId}`;
      }
    });
  });
}

function renderActivity(events) {
  if (!activityFeed) return;
  activityFeed.innerHTML = "";
  events.forEach((event) => {
    const row = document.createElement("article");
    row.className = "activity-entry";
    row.innerHTML = `
      <p class="activity-message">${event.message || event.kind}</p>
      <p class="activity-detail">${event.detail || ""}</p>
      <time>${new Date(event.created_at).toLocaleString()}</time>
    `;
    activityFeed.appendChild(row);
  });
  if (activityTotal) activityTotal.textContent = `${events.length} events`;
}

async function loadTasks() {
  const data = await fetchJson("/api/tasks");
  renderTasks(Array.isArray(data.tasks) ? data.tasks : []);
}

async function loadActivity() {
  const data = await fetchJson("/api/activity");
  renderActivity(Array.isArray(data.events) ? data.events : []);
}

async function loadMetrics() {
  const data = await fetchJson("/api/metrics");
  const metrics = data.metrics || {};
  if (systemConfidence) {
    const errors = Number(metrics.errors || 0);
    const confidence = Math.max(90, 99.4 - errors * 0.8);
    systemConfidence.textContent = `${confidence.toFixed(1)}%`;
  }
  if (queuePressure) {
    const tasksRun = Number(metrics.tasks_run || 0);
    queuePressure.textContent = tasksRun > 20 ? "High flow" : tasksRun > 8 ? "Rising" : "Stable";
  }
}

async function loadAutopilot() {
  const state = await fetchJson("/api/autopilot");
  updateAutopilot(state);
}

async function runAllFlows() {
  const data = await fetchJson("/api/tasks/run-all", { method: "POST" });
  showToast(`Run-all complete: ${data.ok}/${(data.items || []).length}`);
  const summary = document.createElement("li");
  summary.textContent = `Run all: ${data.ok} success, ${data.failed} failed`;
  nextSteps?.prepend(summary);
  await Promise.all([loadTasks(), loadActivity(), loadMetrics(), loadAutopilot()]);
}

async function runManualCycle() {
  const data = await fetchJson("/api/autopilot/cycle", { method: "POST" });
  showToast(`Manual cycle ${data.cycle} complete`);
  const summary = document.createElement("li");
  summary.textContent = `Manual cycle ${data.cycle}: ${(data.items || []).length} tasks`;
  nextSteps?.prepend(summary);
  updateAutopilot(data.autopilot);
  await Promise.all([loadTasks(), loadActivity(), loadMetrics()]);
}

async function toggleAutopilot() {
  const running = (autopilotStatusEl?.textContent || "").toLowerCase().includes("running");
  const state = await fetchJson("/api/autopilot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: !running }),
  });
  updateAutopilot(state);
  showToast(state.enabled ? "Autopilot enabled" : "Autopilot paused");
}

async function inspectFlow() {
  if (!flowModalBody || !flowModal) return;
  const data = await fetchJson("/api/summary");
  flowModalBody.textContent = JSON.stringify(data, null, 2);
  flowModal.classList.add("flow-modal--open");
}

function closeFlowModal() {
  if (flowModal) flowModal.classList.remove("flow-modal--open");
}

if (launchOrchestrationBtn) {
  launchOrchestrationBtn.addEventListener("click", runAllFlows);
}
if (runAllFlowsBtn) {
  runAllFlowsBtn.addEventListener("click", runAllFlows);
}
if (runManualCycleBtn) {
  runManualCycleBtn.addEventListener("click", runManualCycle);
}
if (autopilotToggleBtn) {
  autopilotToggleBtn.addEventListener("click", toggleAutopilot);
}
if (inspectFlowBtn) {
  inspectFlowBtn.addEventListener("click", inspectFlow);
}
if (flowModalClose) {
  flowModalClose.addEventListener("click", closeFlowModal);
}
if (flowModal) {
  flowModal.addEventListener("click", (event) => {
    if (event.target === flowModal) closeFlowModal();
  });
}

async function bootstrap() {
  if (reliabilityState) reliabilityState.textContent = "Workspace online";
  if (signalDot) signalDot.classList.remove("is-warning");
  await Promise.all([loadTasks(), loadActivity(), loadMetrics(), loadAutopilot()]);
}

bootstrap().catch((error) => {
  if (reliabilityState) reliabilityState.textContent = "Attention needed";
  if (signalDot) signalDot.classList.add("is-warning");
  showToast(error.message || "Workspace failed to initialize");
});

window.setInterval(() => {
  Promise.allSettled([loadTasks(), loadActivity(), loadMetrics(), loadAutopilot()]);
}, 30000);
