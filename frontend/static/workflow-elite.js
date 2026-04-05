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
const enterVRButton = document.getElementById("enter-vr");
const exitVRButton = document.getElementById("exit-vr");
const vrStatus = document.getElementById("vr-status");
const vrCanvas = document.getElementById("vr-canvas");
const aiPromptInput = document.getElementById("ai-prompt");
const aiGenerateOutput = document.getElementById("ai-generate-output");
const aiPredictOutput = document.getElementById("ai-predict-output");
const aiAuditOutput = document.getElementById("ai-audit-output");
const aiHandoffOutput = document.getElementById("ai-handoff-output");
const aiMethodButtons = Array.from(document.querySelectorAll("[data-ai-method]"));
const aiReviewGate = document.getElementById("ai-review-gate");
const API_BASE = String(window.GLOBALFLOW_API_BASE || "").replace(/\/$/, "");
const liveAnnouncer = (() => {
  let node = document.getElementById("wf-live-announcer");
  if (!node) {
    node = document.createElement("div");
    node.id = "wf-live-announcer";
    node.setAttribute("aria-live", "polite");
    node.setAttribute("aria-atomic", "true");
    node.className = "sr-only";
    document.body.appendChild(node);
  }
  return node;
})();

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
let xrSession = null;
let xrRefSpace = null;
let xrGl = null;
let xrMode = "none";
let inlineFallbackRaf = null;
let inlineFallbackActive = false;
let inlineFallbackYaw = 0;
let inlineFallbackPitch = 0;
let pointerLockActive = false;
let pointerLockNoticeShown = false;
let eliteStars = [];
const ELITE_VR = {
  framebufferScaleFactor: 1.45,
  maxDpr: 2.2,
  starCount: 140,
  cameraSmoothing: 0.08,
};
const toneRules = [
  { tone: "urgency", pattern: /deadline|risk|blocked|escal|retry|alert/i },
  { tone: "trust", pattern: /billing|invoice|payment|audit|compliance/i },
  { tone: "success", pattern: /complete|ready|stable|live|healthy/i },
  { tone: "insight", pattern: /analysis|signal|coverage|telemetry|ops/i },
];

function toast(message) {
  const el = document.getElementById("toast");
  if (liveAnnouncer) liveAnnouncer.textContent = message;
  if (!el) return;
  el.textContent = message;
  el.classList.add("is-visible");
  window.setTimeout(() => el.classList.remove("is-visible"), 2200);
}

function apiUrl(path) {
  if (!path) return API_BASE || "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path}`;
}

async function postJson(path, payload) {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.message || "Request failed");
  }
  return data;
}

function initEliteStars() {
  eliteStars = Array.from({ length: ELITE_VR.starCount }).map(() => ({
    x: Math.random(),
    y: Math.random(),
    z: 0.2 + Math.random() * 0.8,
    drift: -0.0005 - Math.random() * 0.0015,
  }));
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
  const refreshOperatorA11yOrder = () => {
    const ordered = cards();
    const total = ordered.length;
    ordered.forEach((card, index) => {
      card.setAttribute("aria-posinset", String(index + 1));
      card.setAttribute("aria-setsize", String(total));
    });
  };
  let source = null;

  cards().forEach((card) => {
    card.setAttribute("tabindex", "0");
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
      refreshOperatorA11yOrder();
      card.focus();
      toast("Operator priority updated");
    });
  });
  refreshOperatorA11yOrder();
}

function installBoardDnD() {
  if (!workflowBoard) return;
  let source = null;
  const lanes = Array.from(workflowBoard.querySelectorAll(".wf-lane"));
  const cards = Array.from(workflowBoard.querySelectorAll(".wf-lane-card"));

  cards.forEach((card) => {
    card.setAttribute("tabindex", "0");
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
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const lane = card.closest(".wf-lane");
      if (!lane) return;

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const laneIndex = lanes.indexOf(lane);
        const targetIndex = event.key === "ArrowLeft" ? laneIndex - 1 : laneIndex + 1;
        if (targetIndex < 0 || targetIndex >= lanes.length) return;
        const targetLane = lanes[targetIndex];
        targetLane.appendChild(card);
        const sourceBadge = lane.querySelector("header span");
        const targetBadge = targetLane.querySelector("header span");
        if (sourceBadge) sourceBadge.textContent = String(lane.querySelectorAll(".wf-lane-card").length);
        if (targetBadge) targetBadge.textContent = String(targetLane.querySelectorAll(".wf-lane-card").length);
        card.focus();
        toast(`Moved to ${targetLane.querySelector("h3")?.textContent || "lane"}`);
        return;
      }

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
      toast("Workflow lane updated");
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

function detectTone(text) {
  const source = String(text || "");
  const match = toneRules.find((rule) => rule.pattern.test(source));
  return match ? match.tone : "trust";
}

function installAdaptiveStates() {
  document.querySelectorAll(".wf-signal-cell").forEach((cell) => {
    if (!cell.dataset.tone) {
      cell.dataset.tone = detectTone(cell.textContent || "");
    }
  });
  document.querySelectorAll(".wf-operator-card .wf-badge").forEach((badge) => {
    if (!badge.dataset.state || badge.dataset.state === "ready") {
      const tone = detectTone(badge.closest(".wf-operator-card")?.textContent || "");
      badge.dataset.state = tone === "urgency" ? "review" : tone === "success" ? "online" : "ready";
    }
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
      if (xrSession) {
        xrSession.end().catch(() => {});
      }
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

function setVRStatus(message) {
  if (vrStatus) vrStatus.textContent = message;
}

function toggleVRButtons(inSession) {
  if (enterVRButton) enterVRButton.disabled = inSession;
  if (exitVRButton) exitVRButton.disabled = !inSession;
}

async function ensureXRSupport() {
  if (!("xr" in navigator) || !navigator.xr) {
    xrMode = "inline-fallback";
    setVRStatus("WebXR unavailable. Inline immersive mode is ready.");
    toggleVRButtons(false);
    return true;
  }

  const supportsImmersiveVR = await navigator.xr.isSessionSupported("immersive-vr").catch(() => false);
  if (supportsImmersiveVR) {
    xrMode = "immersive-vr";
    setVRStatus("Elite immersive VR ready.");
    toggleVRButtons(false);
    return true;
  }

  const supportsImmersiveAR = await navigator.xr.isSessionSupported("immersive-ar").catch(() => false);
  if (supportsImmersiveAR) {
    xrMode = "immersive-ar";
    setVRStatus("Elite immersive AR available.");
    toggleVRButtons(false);
    return true;
  }

  const supportsInline = await navigator.xr.isSessionSupported("inline").catch(() => false);
  if (supportsInline) {
    xrMode = "inline";
    setVRStatus("Elite inline XR mode ready.");
    toggleVRButtons(false);
    return true;
  }

  xrMode = "inline-fallback";
  setVRStatus("Native XR sessions not available. Inline immersive mode is ready.");
  toggleVRButtons(false);
  return true;
}

function renderXRFrame(time, frame) {
  if (!xrSession || !xrRefSpace || !xrGl) return;
  xrSession.requestAnimationFrame(renderXRFrame);
  const pose = frame.getViewerPose(xrRefSpace);
  const layer = xrSession.renderState.baseLayer;
  if (!pose || !layer) return;

  xrGl.bindFramebuffer(xrGl.FRAMEBUFFER, layer.framebuffer);
  xrGl.enable(xrGl.DEPTH_TEST);
  xrGl.clearColor(0.03, 0.06, 0.12, 1.0);
  xrGl.clear(xrGl.COLOR_BUFFER_BIT | xrGl.DEPTH_BUFFER_BIT);

  let controllers = 0;
  let hands = 0;
  for (const source of xrSession.inputSources) {
    if (source.targetRayMode === "tracked-pointer") controllers += 1;
    if (source.hand) hands += 1;
  }
  if (vrStatus) {
    vrStatus.textContent = `VR live: ${pose.views.length} view(s), ${controllers} controller(s), ${hands} hand-tracking source(s).`;
  }

  for (const view of pose.views) {
    const viewport = layer.getViewport(view);
    if (!viewport) continue;
    xrGl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
    const hue = view.eye === "left" ? 0.12 : 0.18;
    xrGl.clearColor(hue, 0.08, 0.24, 1.0);
    xrGl.clear(xrGl.COLOR_BUFFER_BIT | xrGl.DEPTH_BUFFER_BIT);
  }
}

async function enterVR() {
  if (xrSession || inlineFallbackActive) return;

  if (xrMode === "inline-fallback" || !("xr" in navigator) || !navigator.xr) {
    startInlineFallback();
    return;
  }

  try {
    const requestedMode = xrMode === "immersive-ar" ? "immersive-ar" : xrMode === "inline" ? "inline" : "immersive-vr";
    const requiredFeatures = requestedMode === "inline" ? [] : ["local-floor"];
    xrSession = await navigator.xr.requestSession(requestedMode, {
      requiredFeatures,
      optionalFeatures: [
        "bounded-floor",
        "hand-tracking",
        "layers",
        "anchors",
        "hit-test",
        "plane-detection",
        "depth-sensing",
      ],
    });
    xrSession.addEventListener("end", () => {
      xrSession = null;
      xrRefSpace = null;
      xrGl = null;
      toggleVRButtons(false);
      setVRStatus("XR session ended.");
      toast("XR session ended");
    });
    xrSession.addEventListener("selectstart", () => toast("VR select start"));
    xrSession.addEventListener("selectend", () => toast("VR select end"));

    if (!vrCanvas) throw new Error("VR canvas not found");
    xrGl = vrCanvas.getContext("webgl", { xrCompatible: true, antialias: true, alpha: false });
    if (!xrGl) throw new Error("WebGL context unavailable");

    await xrGl.makeXRCompatible();
    await xrSession.updateRenderState({
      baseLayer: new XRWebGLLayer(xrSession, xrGl, { framebufferScaleFactor: ELITE_VR.framebufferScaleFactor }),
    });
    xrRefSpace = await xrSession.requestReferenceSpace(requestedMode === "inline" ? "viewer" : "local-floor");
    toggleVRButtons(true);
    setVRStatus(`XR session active (${requestedMode}, elite profile).`);
    toast(`Entered ${requestedMode}`);
    xrSession.requestAnimationFrame(renderXRFrame);
  } catch (error) {
    setVRStatus(`XR start failed: ${error?.message || "unknown error"}. Launching inline immersive mode.`);
    xrSession = null;
    xrRefSpace = null;
    xrGl = null;
    toggleVRButtons(false);
    startInlineFallback();
  }
}

async function exitVR() {
  if (xrSession) {
    try {
      await xrSession.end();
    } catch (_) {}
    return;
  }
  stopInlineFallback();
}

function drawInlineFallbackFrame() {
  if (!inlineFallbackActive || !vrCanvas) return;
  const gl = vrCanvas.getContext("2d");
  if (!gl) return;

  const dpr = Math.min(window.devicePixelRatio || 1, ELITE_VR.maxDpr);
  const width = Math.max(640, Math.floor((vrCanvas.clientWidth || 640) * dpr));
  const height = Math.max(240, Math.floor((vrCanvas.clientHeight || 240) * dpr));
  if (vrCanvas.width !== width) vrCanvas.width = width;
  if (vrCanvas.height !== height) vrCanvas.height = height;

  gl.setTransform(1, 0, 0, 1, 0, 0);
  gl.scale(dpr, dpr);
  const vw = width / dpr;
  const vh = height / dpr;

  inlineFallbackYaw += 0.008;
  const t = inlineFallbackYaw;
  const cx = vw * (0.5 + Math.cos(t + inlineFallbackPitch * 0.35) * 0.18);
  const cy = vh * (0.5 + Math.sin(t * 0.8 + inlineFallbackPitch * 0.5) * 0.12);

  const bg = gl.createLinearGradient(0, 0, vw, vh);
  bg.addColorStop(0, "#061327");
  bg.addColorStop(1, "#10294f");
  gl.fillStyle = bg;
  gl.fillRect(0, 0, vw, vh);

  gl.save();
  gl.globalCompositeOperation = "lighter";
  eliteStars.forEach((star) => {
    star.x += star.drift * (1 + inlineFallbackPitch * 0.15);
    if (star.x < 0) star.x = 1;
    const sx = star.x * vw;
    const sy = (star.y + Math.sin(t + star.x * 6) * 0.003) * vh;
    const r = 0.5 + star.z * 1.8;
    gl.fillStyle = `rgba(190,220,255,${0.25 + star.z * 0.65})`;
    gl.beginPath();
    gl.arc(sx, sy, r, 0, Math.PI * 2);
    gl.fill();
  });
  gl.restore();

  for (let i = 0; i < 14; i += 1) {
    const depth = (i + 1) / 14;
    const w = vw * (0.1 + depth * 0.8);
    const h = vh * (0.06 + depth * 0.52);
    const x = cx - w / 2 + Math.sin(t + i + inlineFallbackPitch) * 10;
    const y = cy - h / 2 + Math.cos(t * 0.7 + i + inlineFallbackPitch * 0.8) * 7;
    gl.strokeStyle = `rgba(111,176,255,${0.1 + depth * 0.28})`;
    gl.lineWidth = 1.5;
    gl.strokeRect(x, y, w, h);
  }

  gl.fillStyle = "rgba(230,243,255,0.92)";
  gl.font = "600 13px Manrope, sans-serif";
  gl.fillText("Elite inline immersive mode active", 14, 22);
  gl.fillStyle = "rgba(191,208,232,0.92)";
  gl.fillText("Headset XR unavailable: running high-fidelity simulation.", 14, 42);

  inlineFallbackRaf = requestAnimationFrame(drawInlineFallbackFrame);
}

function startInlineFallback() {
  if (inlineFallbackActive) return;
  inlineFallbackActive = true;
  if (!eliteStars.length) initEliteStars();
  toggleVRButtons(true);
  setVRStatus("Inline immersive mode active (elite profile).");
  toast("Entered elite inline immersive mode");
  if (vrCanvas && !pointerLockNoticeShown) {
    pointerLockNoticeShown = true;
    toast("Click canvas for mouse-look");
  }
  drawInlineFallbackFrame();
}

function stopInlineFallback() {
  if (!inlineFallbackActive) return;
  inlineFallbackActive = false;
  if (inlineFallbackRaf) {
    cancelAnimationFrame(inlineFallbackRaf);
    inlineFallbackRaf = null;
  }
  toggleVRButtons(false);
  setVRStatus("Inline immersive mode ended.");
  toast("Exited inline immersive mode");
}

function installElitePointerTracking() {
  if (!vrCanvas) return;
  vrCanvas.addEventListener("click", () => {
    if (!inlineFallbackActive || !vrCanvas.requestPointerLock || pointerLockActive) return;
    vrCanvas.requestPointerLock();
  });
  document.addEventListener("pointerlockchange", () => {
    pointerLockActive = document.pointerLockElement === vrCanvas;
  });
  document.addEventListener("mousemove", (event) => {
    if (!inlineFallbackActive) return;
    if (pointerLockActive) {
      inlineFallbackPitch += event.movementY * 0.0012;
      inlineFallbackYaw += event.movementX * 0.0015;
    } else {
      inlineFallbackPitch += ((event.clientY / window.innerHeight) - 0.5 - inlineFallbackPitch) * ELITE_VR.cameraSmoothing;
    }
    inlineFallbackPitch = Math.max(-0.8, Math.min(0.8, inlineFallbackPitch));
  }, { passive: true });
}

function installRealVR() {
  ensureXRSupport().catch(() => {
    setVRStatus("WebXR capability check failed.");
    if (enterVRButton) enterVRButton.disabled = true;
  });
  if (enterVRButton) enterVRButton.addEventListener("click", enterVR);
  if (exitVRButton) exitVRButton.addEventListener("click", exitVR);
}

function formatLines(lines) {
  return lines.filter(Boolean).join("\n");
}

async function runGenerativeMethod() {
  const prompt = (aiPromptInput?.value || "minimalist workflow dashboard").trim();
  if (aiGenerateOutput) aiGenerateOutput.textContent = "Generating variants...";
  try {
    const data = await postJson("/api/ai/generate-variants", { prompt });
    const lines = [
      `Prompt: ${data.prompt || prompt}`,
      "Generated layout/content variants:",
      ...((data.variants || []).map((v) => `- ${v.name}: ${v.layout} | ${v.copy} | ${v.purpose}`)),
      `Recommendation: ${data.recommendation || "Run A/B test on top two variants."}`,
    ];
    if (aiGenerateOutput) aiGenerateOutput.textContent = formatLines(lines);
  } catch (error) {
    if (aiGenerateOutput) aiGenerateOutput.textContent = `Generation failed: ${error.message}`;
  }
}

async function runPredictiveMethod() {
  const lanes = Array.from(document.querySelectorAll(".wf-lane"));
  const lanePayload = {};
  lanes.forEach((lane) => {
    const key = lane.dataset.lane || "unknown";
    lanePayload[key] = lane.querySelectorAll(".wf-lane-card").length;
  });
  if (aiPredictOutput) aiPredictOutput.textContent = "Predicting next best actions...";
  try {
    const data = await postJson("/api/ai/predict-flow", { lanes: lanePayload });
    const lines = [
      `Lane load index: ${Number(data.load_index || 0).toFixed(1)} (${data.risk || "unknown"} risk)`,
      ...Object.entries(data.lanes || {}).map(([lane, count]) => `- ${lane}: ${count}`),
      "Predicted optimization actions:",
      ...((data.recommendations || []).map((r) => `- ${r}`)),
    ];
    if (aiPredictOutput) aiPredictOutput.textContent = formatLines(lines);
  } catch (error) {
    if (aiPredictOutput) aiPredictOutput.textContent = `Prediction failed: ${error.message}`;
  }
}

function parseRgb(color) {
  const match = String(color).match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const [r, g, b] = match[1].split(",").slice(0, 3).map((v) => Number(v.trim()));
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return { r, g, b };
}

function luminance({ r, g, b }) {
  const toLin = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

function contrastRatio(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}

async function runAccessibilityMethod() {
  const sampleNodes = Array.from(document.querySelectorAll(".wf-ai-card, .wf-signal-cell, .wf-operator-card, .wf-lane-card, .activity-entry p")).slice(0, 36);
  let lowContrast = 0;
  sampleNodes.forEach((node) => {
    const style = getComputedStyle(node);
    const fg = parseRgb(style.color);
    const bg = parseRgb(style.backgroundColor);
    if (!fg || !bg) return;
    const ratio = contrastRatio(fg, bg);
    if (ratio < 4.5) lowContrast += 1;
  });

  if (aiAuditOutput) aiAuditOutput.textContent = "Running accessibility audit...";
  try {
    const data = await postJson("/api/ai/audit-ui", {
      sampled_nodes: sampleNodes.length,
      contrast_warnings: lowContrast,
      keyboard_support: true,
      reduced_motion: true,
    });
    const lines = [
      `Automated UX+accessibility score: ${data.score}/100`,
      ...((data.findings || []).map((f) => `- ${f}`)),
      "Next steps:",
      ...((data.next_steps || []).map((s) => `- ${s}`)),
    ];
    if (aiAuditOutput) aiAuditOutput.textContent = formatLines(lines);
  } catch (error) {
    if (aiAuditOutput) aiAuditOutput.textContent = `Audit failed: ${error.message}`;
  }
}

async function runHandoffMethod() {
  const lanes = {};
  document.querySelectorAll(".wf-lane").forEach((lane) => {
    lanes[lane.dataset.lane || "unknown"] = lane.querySelectorAll(".wf-lane-card").length;
  });
  const variant = document.body?.dataset?.uxVariant || "A";
  if (aiHandoffOutput) aiHandoffOutput.textContent = "Generating handoff spec...";
  try {
    const handoff = await postJson("/api/ai/handoff", {
      lanes,
      operators: document.querySelectorAll(".wf-operator-card").length,
      signals: document.querySelectorAll(".wf-signal-cell").length,
      variant,
    });
    if (aiHandoffOutput) aiHandoffOutput.textContent = JSON.stringify(handoff, null, 2);
  } catch (error) {
    if (aiHandoffOutput) aiHandoffOutput.textContent = `Handoff failed: ${error.message}`;
  }
}

function installAIMethods() {
  if (!aiMethodButtons.length) return;
  aiMethodButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const method = button.dataset.aiMethod;
      const isGatedMethod = method === "generate" || method === "predict" || method === "handoff";
      if (isGatedMethod && aiReviewGate && !aiReviewGate.checked) {
        const message = "Enable human review gate before running this AI action.";
        if (method === "generate" && aiGenerateOutput) aiGenerateOutput.textContent = message;
        if (method === "predict" && aiPredictOutput) aiPredictOutput.textContent = message;
        if (method === "handoff" && aiHandoffOutput) aiHandoffOutput.textContent = message;
        toast(message);
        return;
      }
      button.disabled = true;
      try {
        if (method === "generate") await runGenerativeMethod();
        if (method === "predict") await runPredictiveMethod();
        if (method === "audit") await runAccessibilityMethod();
        if (method === "handoff") await runHandoffMethod();
      } finally {
        button.disabled = false;
      }
    });
  });
  runPredictiveMethod().catch(() => {});
}

function installLandmarkA11y() {
  if (workflowBoard && !workflowBoard.hasAttribute("role")) {
    workflowBoard.setAttribute("role", "region");
    workflowBoard.setAttribute("aria-label", "Workflow lanes");
  }
  if (operatorGrid && !operatorGrid.hasAttribute("role")) {
    operatorGrid.setAttribute("role", "list");
    operatorGrid.querySelectorAll(".wf-operator-card").forEach((card) => card.setAttribute("role", "listitem"));
  }
}

installSignalRipples();
installDensityControls();
installOperatorDnD();
installBoardDnD();
installEventFeedLoader();
installHeroActions();
installAdaptiveStates();
installDepthParallax();
installLaserPointer();
installImmersiveControls();
installImmersiveModal();
installShortcuts();
installRealVR();
installElitePointerTracking();
installAIMethods();
installLandmarkA11y();
