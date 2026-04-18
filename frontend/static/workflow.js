const signalGrid = document.querySelector(".wf-signal-grid");
const signalCells = Array.from(document.querySelectorAll(".wf-signal-cell[data-ripple='true']"));
const densityButtons = Array.from(document.querySelectorAll(".wf-density"));
const operatorGrid = document.getElementById("operator-grid");
const activityFeed = document.getElementById("activity-feed");
const workflowBoard = document.getElementById("wf-board");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const moreSignals = [
  { tone: "trust", label: "SLA on track", value: "96%", detail: "Run latency under threshold." },
  { tone: "urgency", label: "Escalations", value: "3", detail: "High-priority queues." },
  { tone: "speed", label: "Avg retries", value: "1.2", detail: "Low rerun overhead." },
  { tone: "insight", label: "Coverage", value: "94%", detail: "Telemetry completeness." },
];
let signalCursor = 0;

const toneRules = [
  { tone: "urgency", badge: "Urgent", pattern: /deadline|escal|risk|blocked|retry|alert/i },
  { tone: "trust", badge: "Trusted", pattern: /billing|invoice|payment|compliance|audit/i },
  { tone: "success", badge: "Stable", pattern: /complete|ready|healthy|resolved|live/i },
  { tone: "insight", badge: "Insight", pattern: /coverage|telemetry|analysis|signal|ops/i },
];

function resolveWorkflowMotionProfile() {
  const lowPower =
    (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
    navigator.connection?.saveData === true;
  document.body.dataset.motionProfile = prefersReducedMotion ? "balanced" : "guided";
  document.body.dataset.motionPerformance = prefersReducedMotion || lowPower ? "low" : "high";
  document.body.dataset.motionIntent = "guided";
  document.body.dataset.motionStory = "analysis";
}

function initWorkflowMotion() {
  const sections = document.querySelectorAll(".wf-section");
  sections.forEach((section, index) => {
    section.classList.add("motion-section");
    section.style.setProperty("--motion-order", String(index));
  });
  if (!prefersReducedMotion && typeof IntersectionObserver !== "undefined") {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.remove("is-before", "is-active", "is-after");
          entry.target.style.setProperty("--motion-visibility", entry.intersectionRatio.toFixed(3));
          if (entry.isIntersecting) {
            entry.target.classList.add("is-active");
            const story = {
              signals: "analysis",
              immersive: "decision",
              operators: "decision",
              board: "execute",
            }[entry.target.id];
            if (story) document.body.dataset.motionStory = story;
            document.documentElement.style.setProperty("--gf-scene-progress", entry.intersectionRatio.toFixed(3));
          } else if (entry.boundingClientRect.top > 0) {
            entry.target.classList.add("is-before");
          } else {
            entry.target.classList.add("is-after");
          }
        });
      },
      { threshold: [0.25, 0.55, 0.8] }
    );
    sections.forEach((section) => observer.observe(section));
  }

  const cards = document.querySelectorAll(".wf-signal-cell, .wf-operator-card, .wf-lane-card, .wf-ai-card, .activity-entry");
  cards.forEach((card) => {
    card.classList.add("motion-depth-card");
    if (prefersReducedMotion) return;
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5;
      const py = (event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5;
      card.style.setProperty("--card-tilt-x", `${(px * 7).toFixed(2)}deg`);
      card.style.setProperty("--card-tilt-y", `${(py * -7).toFixed(2)}deg`);
      card.classList.add("is-guided-hover");
    });
    card.addEventListener("pointerleave", () => {
      card.classList.remove("is-guided-hover");
      card.style.removeProperty("--card-tilt-x");
      card.style.removeProperty("--card-tilt-y");
    });
  });

  if (!prefersReducedMotion) {
    let lastScrollY = window.scrollY;
    window.addEventListener(
      "scroll",
      () => {
        const velocity = Math.min(1.4, Math.abs(window.scrollY - lastScrollY) / Math.max(window.innerHeight, 1));
        document.documentElement.style.setProperty("--gf-scroll-velocity", velocity.toFixed(3));
        lastScrollY = window.scrollY;
      },
      { passive: true }
    );
  }
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
  if (!signalCells.length) return;
  signalCells.forEach((cell) => bindRipple(cell));
}

function applyDensity(density) {
  const cozy = density !== "compact";
  document.body.classList.toggle("wf-compact", !cozy);
  document.body.dataset.motionIntent = cozy ? "guided" : "rapid";
  document.body.dataset.motionProfile = cozy ? "guided" : "power";
  densityButtons.forEach((button) => {
    const active = button.dataset.density === (cozy ? "cozy" : "compact");
    button.classList.toggle("is-active", active);
    button.classList.toggle("is-guided-focus", active);
  });
}

function installDensityControls() {
  if (!densityButtons.length) return;
  densityButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyDensity(button.dataset.density || "cozy");
    });
  });

  // Adaptive fallback using container width.
  if (signalGrid && "ResizeObserver" in window) {
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width < 980) {
          applyDensity("compact");
        } else {
          applyDensity("cozy");
        }
      }
    });
    ro.observe(signalGrid);
  }
}

function appendMoreSignals() {
  if (!signalGrid || signalCursor >= moreSignals.length) return;
  const item = moreSignals[signalCursor++];
  const cell = document.createElement("button");
  cell.className = "wf-signal-cell";
  cell.type = "button";
  cell.dataset.tone = item.tone;
  cell.dataset.tooltip = item.detail;
  cell.dataset.ripple = "true";
  cell.setAttribute("aria-label", `${item.label} ${item.value}`);
  cell.innerHTML = `<span>${item.label}</span><strong>${item.value}</strong><small>${item.detail}</small>`;
  signalGrid.appendChild(cell);
  bindRipple(cell);
}

function installInfiniteSignalScroll() {
  if (!signalGrid) return;
  window.addEventListener(
    "scroll",
    () => {
      const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 220;
      if (nearBottom) appendMoreSignals();
    },
    { passive: true }
  );
}

function installOperatorCards() {
  if (!operatorGrid) return;
  const cards = () => Array.from(operatorGrid.querySelectorAll(".wf-operator-card"));
  let dragSource = null;

  cards().forEach((card) => {
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-grabbed", "false");
    card.addEventListener("click", () => {
      card.classList.toggle("is-expanded");
    });

    card.addEventListener("dragstart", () => {
      dragSource = card;
      card.classList.add("is-dragging");
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("is-dragging");
      cards().forEach((node) => node.classList.remove("is-drop-target"));
      dragSource = null;
    });

    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (dragSource && dragSource !== card) {
        card.classList.add("is-drop-target");
      }
    });

    card.addEventListener("dragleave", () => {
      card.classList.remove("is-drop-target");
    });

    card.addEventListener("drop", (event) => {
      event.preventDefault();
      card.classList.remove("is-drop-target");
      if (!dragSource || dragSource === card) return;

      const cardRect = card.getBoundingClientRect();
      const isAfter = event.clientY > cardRect.top + cardRect.height / 2;
      operatorGrid.insertBefore(dragSource, isAfter ? card.nextSibling : card);
    });

    card.addEventListener("keydown", (event) => {
      if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const nodes = cards();
      const idx = nodes.indexOf(card);
      const next = event.key === "ArrowUp" ? idx - 1 : idx + 1;
      if (next < 0 || next >= nodes.length) return;
      const target = nodes[next];
      if (event.key === "ArrowUp") {
        operatorGrid.insertBefore(card, target);
      } else {
        operatorGrid.insertBefore(card, target.nextSibling);
      }
      card.focus();
    });
  });
}

function installBoardDragDrop() {
  if (!workflowBoard) return;
  let source = null;
  const cards = workflowBoard.querySelectorAll(".wf-lane-card");
  const lanes = workflowBoard.querySelectorAll(".wf-lane");

  cards.forEach((card) => {
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-grabbed", "false");
    card.addEventListener("dragstart", () => {
      source = card;
      card.classList.add("is-dragging");
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("is-dragging");
      lanes.forEach((lane) => lane.classList.remove("is-drop-target"));
      source = null;
    });

    card.addEventListener("keydown", (event) => {
      if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const lane = card.closest(".wf-lane");
      if (!lane) return;
      const laneCards = Array.from(lane.querySelectorAll(".wf-lane-card"));
      const current = laneCards.indexOf(card);
      const nextIndex = event.key === "ArrowUp" ? current - 1 : current + 1;
      if (nextIndex < 0 || nextIndex >= laneCards.length) return;
      const target = laneCards[nextIndex];
      if (event.key === "ArrowUp") {
        lane.insertBefore(card, target);
      } else {
        lane.insertBefore(card, target.nextSibling);
      }
      card.focus();
    });
  });

  lanes.forEach((lane) => {
    lane.addEventListener("dragover", (event) => {
      event.preventDefault();
      lane.classList.add("is-drop-target");
    });

    lane.addEventListener("dragleave", () => {
      lane.classList.remove("is-drop-target");
    });

    lane.addEventListener("drop", (event) => {
      event.preventDefault();
      lane.classList.remove("is-drop-target");
      if (!source) return;
      lane.appendChild(source);
      const count = lane.querySelectorAll(".wf-lane-card").length;
      const chip = lane.querySelector("header span");
      if (chip) chip.textContent = String(count);
    });
  });
}

function detectTone(text) {
  const match = toneRules.find((rule) => rule.pattern.test(String(text || "")));
  return match || { tone: "trust", badge: "Trusted" };
}

function installAdaptiveStates() {
  if (signalGrid) {
    signalGrid.querySelectorAll(".wf-signal-cell").forEach((cell) => {
      if (cell.dataset.tone) return;
      const content = cell.textContent || "";
      cell.dataset.tone = detectTone(content).tone;
    });
  }
  if (operatorGrid) {
    operatorGrid.querySelectorAll(".wf-operator-card").forEach((card) => {
      const badge = card.querySelector(".wf-badge");
      if (!badge) return;
      const rule = detectTone(card.textContent || "");
      if (!badge.dataset.state || badge.dataset.state === "ready") {
        badge.dataset.state = rule.tone === "urgency" ? "review" : rule.tone === "success" ? "online" : "ready";
      }
    });
  }
}

function syncOperatorBadgesFromActivity() {
  if (!activityFeed || !operatorGrid) return;
  const entries = activityFeed.querySelectorAll(".activity-entry");
  if (!entries.length) return;

  const hasFailure = Array.from(entries).some((entry) =>
    /error|failed|blocked|timeout/i.test(entry.textContent || "")
  );
  const hasWarning = Array.from(entries).some((entry) =>
    /review|warn|retry|manual/i.test(entry.textContent || "")
  );

  const badges = operatorGrid.querySelectorAll(".wf-badge");
  badges.forEach((badge) => {
    if (hasFailure) {
      badge.dataset.state = "review";
      badge.textContent = "Review";
      return;
    }
    if (hasWarning) {
      badge.dataset.state = "ready";
      badge.textContent = "Ready";
      return;
    }
    badge.dataset.state = "online";
    badge.textContent = "Live";
  });
}

installSignalRipples();
resolveWorkflowMotionProfile();
initWorkflowMotion();
installDensityControls();
installInfiniteSignalScroll();
installOperatorCards();
installBoardDragDrop();
installAdaptiveStates();
window.setInterval(syncOperatorBadgesFromActivity, 6000);
