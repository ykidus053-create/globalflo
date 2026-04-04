const signalCells = Array.from(document.querySelectorAll(".wf-signal-cell[data-ripple='true']"));
const operatorGrid = document.getElementById("operator-grid");
const activityFeed = document.getElementById("activity-feed");

function installSignalRipples() {
  if (!signalCells.length) return;
  signalCells.forEach((cell) => {
    cell.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button != null && event.button !== 0) return;
        const rect = cell.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = (event.clientX || rect.left + rect.width / 2) - rect.left - size / 2;
        const y = (event.clientY || rect.top + rect.height / 2) - rect.top - size / 2;

        const ripple = document.createElement("span");
        ripple.className = "ripple";
        ripple.style.width = `${size}px`;
        ripple.style.height = `${size}px`;
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;

        cell.querySelectorAll(".ripple").forEach((node) => node.remove());
        cell.appendChild(ripple);
        window.setTimeout(() => ripple.remove(), 700);
      },
      { passive: true }
    );
  });
}

function installOperatorDragDrop() {
  if (!operatorGrid) return;
  const cards = () => Array.from(operatorGrid.querySelectorAll(".wf-operator-card"));
  let dragSource = null;

  cards().forEach((card) => {
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
  });
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
installOperatorDragDrop();
window.setInterval(syncOperatorBadgesFromActivity, 6000);
