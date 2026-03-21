const invoiceForm = document.getElementById("invoice-form");
const invoiceStatus = document.getElementById("invoice-status");
const PAID_KEY = "globalflow_paid";

if (invoiceForm) {
  invoiceForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!invoiceForm.dataset.method) {
      if (invoiceStatus) invoiceStatus.textContent = "Select a payment method before submitting.";
      return;
    }

    if (invoiceStatus) invoiceStatus.textContent = "Creating your request and routing it to finance...";
    const payload = Object.fromEntries(new FormData(invoiceForm));
    const submitButton = invoiceForm.querySelector("button[type='submit']");
    if (submitButton) submitButton.disabled = true;

    try {
      const response = await fetch(`/api/payments/${invoiceForm.dataset.method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));

      if (response.ok) {
        if (invoiceStatus) invoiceStatus.textContent = body.message;
        try {
          window.localStorage.setItem(PAID_KEY, "true");
        } catch {
          // no-op when storage is unavailable
        }
        const redirectUrl = body.redirect_url || "/automation";
        window.setTimeout(() => {
          window.location.assign(redirectUrl);
        }, 900);
        invoiceForm.reset();
      } else {
        if (invoiceStatus) invoiceStatus.textContent = body.detail || "We could not complete the request yet.";
      }
    } catch (error) {
      if (invoiceStatus) invoiceStatus.textContent = "Payment portal offline. Try again shortly.";
      console.error(error);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}
