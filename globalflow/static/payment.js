const form = document.getElementById("payment-form");
const status = document.getElementById("payment-status");
const trigger = document.getElementById("payment-form-trigger");

function currentMethod() {
  const segments = window.location.pathname.split("/");
  return segments.pop() || segments.pop();
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
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

if (form) {
  fillFromQuery();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "Sending your finance request...";
    const payload = Object.fromEntries(new FormData(form));
    try {
      const response = await fetch(`/api/payments/${currentMethod()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (response.ok) {
        status.textContent = body.message;
        form.reset();
        fillFromQuery();
      } else {
        status.textContent = body.detail || "We could not submit it yet.";
      }
    } catch (error) {
      status.textContent = "Payment portal unavailable. Try again shortly.";
      console.error(error);
    }
  });
}
