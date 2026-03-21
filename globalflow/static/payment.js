const form = document.getElementById("payment-form");
const status = document.getElementById("payment-status");
const trigger = document.getElementById("payment-form-trigger");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function currentMethod() {
  const segments = window.location.pathname.split("/");
  return (segments.pop() || segments.pop() || "").toLowerCase();
}

function fillFromQuery() {
  if (!form) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const tier = params.get("tier");
  const amount = params.get("amount");
  const tierInput = form.querySelector('[name="tier"]');
  const amountInput = form.querySelector('[name="amount"]');

  if (tier && tierInput) {
    tierInput.value = tier;
  }

  if (amount && amountInput) {
    amountInput.value = amount;
  }
}

if (trigger && form) {
  trigger.addEventListener("click", () => {
    form.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
  });
}

if (form) {
  fillFromQuery();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (status) status.textContent = "Sending your finance request...";
    const payload = Object.fromEntries(new FormData(form));
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      const response = await fetch(`/api/payments/${currentMethod()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));

      if (response.ok) {
        if (status) status.textContent = body.message;
        form.reset();
        fillFromQuery();
      } else {
        if (status) status.textContent = body.detail || "We could not submit it yet.";
      }
    } catch (error) {
      if (status) status.textContent = "Payment portal unavailable. Try again shortly.";
      console.error(error);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}
