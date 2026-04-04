const signalGrid = document.querySelector(".wf-signal-grid");
const signalCells = Array.from(document.querySelectorAll(".wf-signal-cell[data-ripple='true']"));
const densityButtons = Array.from(document.querySelectorAll(".wf-density"));
const operatorGrid = document.getElementById("operator-grid");
const workflowBoard = document.getElementById("wf-board");
const activityFeed = document.getElementById("elite-activity-feed");
const activitySentinel = document.getElementById("activity-sentinel");

const queuedEvents = [
  { kind: "billing", title: "Settlement handoff confirmed", detail: "Finance route acknowledged in 18s." },
  { kind: "calls", title: "Owner follow-up completed", detail: "3 pending calls moved to complete." },
  { kind: "files", title: "Contract batch classified", detail: "12 uploads attached to active workflows." },
  { kind: "tax", title: "Jurisdiction alert resolved", detail: "Deadline reminders rebalanced by risk." },
  { kind: "ops", title: "Retry window optimized", detail: "Mean retry delay reduced by 14%." },
];
let queuedIndex = 0;

function toast(message) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("is-visible");
  window.setTimeout(() => el.classList.remove("is-visible"), 2200);
}

function createRipple(host, x, y) {
  const rect = host.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left = `${x - rect.left - size / 2}px`;
  ripple.style.top = `${y - rect.top - size / 2}px`;
  host.querySelectorAll(".ripple").forEach((node) => node.remove());
  host.appendChild(ripple);
  window.setTimeout(() => ripple.remove(), 700);
}

function bindRipple(el) {
  el.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button != null && event.button !== 0) return;
      const px = event.clientX || el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2;
      const py = event.clientY || el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2;
      createRipple(el, px, py);
    },
    { passive: true }
  );
}

function installSignalRipples() {
  signalCells.forEach((cell) => bindRipple(cell));
}

function applyDensity(mode) {
  const compact = mode === "compact";
  document.body.classList.toggle("wf-compact", compact);
  densityButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.density === (compact ? "compact" : "cozy"));
  });
}

function installDensityControls() {
  densityButtons.forEach((button) => {
    button.addEventListener("click", () => applyDensity(button.dataset.density || "cozy"));
  });

  if (signalGrid && "ResizeObserver" in window) {
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        applyDensity(entry.contentRect.width < 980 ? "compact" : "cozy");
      }
    });
    ro.observe(signalGrid);
  }
}

function installOperatorDnD() {
  if (!operatorGrid) return;
  const cards = () => Array.from(operatorGrid.querySelectorAll(".wf-operator-card"));
  let source = null;

  cards().forEach((card) => {
    card.addEventListener("dragstart", () => {
      source = card;
      card.classList.add("is-dragging");
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("is-dragging");
      cards().forEach((node) => node.classList.remove("is-drop-target"));
      source = null;
    });
    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (source && source !== card) card.classList.add("is-drop-target");
    });
    card.addEventListener("dragleave", () => card.classList.remove("is-drop-target"));
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      card.classList.remove("is-drop-target");
      if (!source || source === card) return;
      const rect = card.getBoundingClientRect();
      const placeAfter = event.clientY > rect.top + rect.height / 2;
      operatorGrid.insertBefore(source, placeAfter ? card.nextSibling : card);
      toast("Operator priority updated");
    });
  });
}

function installBoardDnD() {
  if (!workflowBoard) return;
  let source = null;
  const lanes = Array.from(workflowBoard.querySelectorAll(".wf-lane"));
  const cards = Array.from(workflowBoard.querySelectorAll(".wf-lane-card"));

  cards.forEach((card) => {
    card.addEventListener("dragstart", () => {
      source = card;
      card.classList.add("is-dragging");
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("is-dragging");
      lanes.forEach((lane) => lane.classList.remove("is-drop-target"));
      source = null;
    });
  });

  lanes.forEach((lane) => {
    lane.addEventListener("dragover", (event) => {
      event.preventDefault();
      lane.classList.add("is-drop-target");
    });
    lane.addEventListener("dragleave", () => lane.classList.remove("is-drop-target"));
    lane.addEventListener("drop", (event) => {
      event.preventDefault();
      lane.classList.remove("is-drop-target");
      if (!source) return;
      lane.appendChild(source);
      const count = lane.querySelectorAll(".wf-lane-card").length;
      const badge = lane.querySelector("header span");
      if (badge) badge.textContent = String(count);
      toast("Workflow lane updated");
    });
  });
}

function appendEvent() {
  if (!activityFeed || queuedIndex >= queuedEvents.length) return;
  const event = queuedEvents[queuedIndex++];
  const article = document.createElement("article");
  article.className = "activity-entry";
  article.innerHTML = `<p class="kind">${event.kind}</p><h4>${event.title}</h4><p class="activity-detail">${event.detail}</p>`;
  activityFeed.appendChild(article);
}

function installEventFeedLoader() {
  if (!activitySentinel || !("IntersectionObserver" in window)) {
    window.addEventListener(
      "scroll",
      () => {
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 160) appendEvent();
      },
      { passive: true }
    );
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) appendEvent();
    });
  }, { rootMargin: "180px 0px" });
  io.observe(activitySentinel);
}

function installHeroActions() {
  const launch = document.getElementById("launch-orchestration");
  const inspect = document.getElementById("inspect-flow");
  if (launch) launch.addEventListener("click", () => toast("Orchestration started"));
  if (inspect) inspect.addEventListener("click", () => toast("Telemetry panel synced"));
}

installSignalRipples();
installDensityControls();
installOperatorDnD();
installBoardDnD();
installEventFeedLoader();
installHeroActions();
