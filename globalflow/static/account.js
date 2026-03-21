const form = document.getElementById("account-form");
const status = document.getElementById("account-status");

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    if (status) {
      status.textContent = "Saving changes…";
    }
    const payload = Object.fromEntries(new FormData(form));
    try {
      const response = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (status) {
        if (response.ok) {
          status.textContent = "Profile updated.";
        } else {
          status.textContent = body.detail || "Could not update yet.";
        }
      }
    } catch (error) {
      if (status) {
        status.textContent = "Connection issue. Try again.";
      }
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}
