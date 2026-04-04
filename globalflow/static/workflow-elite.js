const signalGrid = document.querySelector(".wf-signal-grid");
const signalCells = Array.from(document.querySelectorAll(".wf-signal-cell[data-ripple='true']"));
const densityButtons = Array.from(document.querySelectorAll(".wf-density"));
const operatorGrid = document.getElementById("operator-grid");
const workflowBoard = document.getElementById("wf-board");
const activityFeed = document.getElementById("elite-activity-feed");
const activitySentinel = document.getElementById("activity-sentinel");
const immersiveToggles = Array.from(document.querySelectorAll("[data-immersive-mode]"));
const immersiveModal = document.getElementById("immersive-modal");
const openImmersiveInspector = document.getElementById("open-immersive-inspector");
const closeImmersiveModal = document.getElementById("close-immersive-modal");
const laserCursor = document.getElementById("laser-cursor");
const laserTrail = document.getElementById("laser-trail");

const immersiveState = {
  laser: true,
  depth: true,
  comfort: false,
};

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

function updateImmersiveClassState() {
  document.body.classList.toggle("immersive-laser", immersiveState.laser);
  document.body.classList.toggle("immersive-depth", immersiveState.depth);
  document.body.classList.toggle("immersive-comfort", immersiveState.comfort);
}

function updateImmersiveToggleState() {
  immersiveToggles.forEach((button) => {
    const mode = button.dataset.immersiveMode;
    button.classList.toggle("is-active", Boolean(immersiveState[mode]));
    button.setAttribute("aria-pressed", immersiveState[mode] ? "true" : "false");
  });
}

function applyDepthTilt(target, clientX, clientY) {
  if (!immersiveState.depth) return;
  const rect = target.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width - 0.5;
  const y = (clientY - rect.top) / rect.height - 0.5;
  const max = immersiveState.comfort ? 4 : 7;
  const rx = (y * -max).toFixed(2);
  const ry = (x * max).toFixed(2);
  target.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-2px)`;
}

function installDepthParallax() {
  const targets = Array.from(
    document.querySelectorAll(".wf-signal-cell, .wf-operator-card, .wf-lane-card")
  );
  targets.forEach((target) => {
    target.addEventListener("pointermove", (event) => {
      if (!immersiveState.depth) return;
      applyDepthTilt(target, event.clientX, event.clientY);
    });
    target.addEventListener("pointerleave", () => {
      target.style.transform = "";
    });
  });
}

function installLaserPointer() {
  if (!laserCursor || !laserTrail) return;
  let tx = 0;
  let ty = 0;
  let lx = 0;
  let ly = 0;

  function animateTrail() {
    lx += (tx - lx) * 0.17;
    ly += (ty - ly) * 0.17;
    laserTrail.style.transform = `translate(${lx}px, ${ly}px)`;
    requestAnimationFrame(animateTrail);
  }

  window.addEventListener(
    "pointermove",
    (event) => {
      if (!immersiveState.laser) return;
      tx = event.clientX;
      ty = event.clientY;
      laserCursor.style.transform = `translate(${tx}px, ${ty}px)`;
    },
    { passive: true }
  );

  animateTrail();
}

function setImmersiveMode(mode, value) {
  immersiveState[mode] = value;
  updateImmersiveClassState();
  updateImmersiveToggleState();
  const label = mode.charAt(0).toUpperCase() + mode.slice(1);
  toast(`${label} ${value ? "enabled" : "disabled"}`);
}

function installImmersiveControls() {
  immersiveToggles.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.immersiveMode;
      setImmersiveMode(mode, !immersiveState[mode]);
    });
  });
  updateImmersiveClassState();
  updateImmersiveToggleState();
}

function openImmersiveModal() {
  if (!immersiveModal) return;
  immersiveModal.classList.add("is-open");
  immersiveModal.setAttribute("aria-hidden", "false");
}

function closeImmersiveInspectorModal() {
  if (!immersiveModal) return;
  immersiveModal.classList.remove("is-open");
  immersiveModal.setAttribute("aria-hidden", "true");
}

function installImmersiveModal() {
  if (openImmersiveInspector) {
    openImmersiveInspector.addEventListener("click", openImmersiveModal);
  }
  if (closeImmersiveModal) {
    closeImmersiveModal.addEventListener("click", closeImmersiveInspectorModal);
  }
  if (immersiveModal) {
    immersiveModal.addEventListener("click", (event) => {
      if (event.target === immersiveModal) closeImmersiveInspectorModal();
    });
  }
}

function installShortcuts() {
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeImmersiveInspectorModal();
      return;
    }
    if (event.key.toLowerCase() === "i") {
      openImmersiveModal();
      return;
    }
    if (event.key.toLowerCase() === "l") {
      setImmersiveMode("laser", !immersiveState.laser);
      return;
    }
    if (event.key.toLowerCase() === "d") {
      setImmersiveMode("depth", !immersiveState.depth);
      return;
    }
    if (event.key.toLowerCase() === "c") {
      setImmersiveMode("comfort", !immersiveState.comfort);
      return;
    }
  });
}

installSignalRipples();
installDensityControls();
installOperatorDnD();
installBoardDnD();
installEventFeedLoader();
installHeroActions();
installDepthParallax();
installLaserPointer();
installImmersiveControls();
installImmersiveModal();
installShortcuts();
