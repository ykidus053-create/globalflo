const invoiceForm = document.getElementById("invoice-form");
const invoiceStatus = document.getElementById("invoice-status");

if (invoiceForm) {
  invoiceForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!invoiceForm.dataset.method) {
      invoiceStatus.textContent = "Select a payment method before submitting.";
      return;
    }

    invoiceStatus.textContent = "Creating your request and routing it to finance...";
    const payload = Object.fromEntries(new FormData(invoiceForm));

    try {
      const response = await fetch(`/api/payments/${invoiceForm.dataset.method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();

      if (response.ok) {
        invoiceStatus.textContent = body.message;
        invoiceForm.reset();
      } else {
        invoiceStatus.textContent = body.detail || "We could not complete the request yet.";
      }
    } catch (error) {
      invoiceStatus.textContent = "Payment portal offline. Try again shortly.";
      console.error(error);
    }
  });
}
