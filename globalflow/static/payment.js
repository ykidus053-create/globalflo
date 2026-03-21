const form = document.getElementById("payment-form");
const status = document.getElementById("payment-status");
const trigger = document.getElementById("payment-form-trigger");

function currentMethod() {
  const segments = window.location.pathname.split("/");
  return segments.pop() || segments.pop();
}

if (trigger && form) {
  trigger.addEventListener("click", () => {
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    status.textContent = "Sending your finance request…";
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
      } else {
        status.textContent = body.detail || "We could not submit it yet.";
      }
    } catch (error) {
      status.textContent = "Payment portal unavailable. Try again shortly.";
      console.error(error);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}
