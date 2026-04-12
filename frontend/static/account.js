const form = document.getElementById("account-form");
const status = document.getElementById("account-status");
const THEME_KEY = "globalflow_theme";
const API_BASE = String(window.GLOBALFLOW_API_BASE || "").replace(/\/$/, "");

function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path}`;
}

function populateForm(body) {
  if (!form || !body) return;
  const profile = body.profile || {};
  const settings = body.settings || {};

  ["name", "email", "role", "timezone"].forEach((name) => {
    const input = form.querySelector(`[name="${name}"]`);
    if (input && profile[name]) input.value = profile[name];
  });

  ["daily_digest", "alert_channel", "automation_tier", "theme"].forEach((name) => {
    const input = form.querySelector(`[name="${name}"]`);
    if (input && settings[name]) input.value = settings[name];
  });
}

async function hydrateFromServer() {
  if (!form) return;
  try {
    const response = await fetch(apiUrl("/api/account"));
    const body = await response.json().catch(() => ({}));
    if (response.ok) populateForm(body);
  } catch (error) {
    console.error(error);
  }
}

function applyTheme(theme) {
  if (theme !== "light" && theme !== "dark") return;
  document.documentElement.setAttribute("data-theme", theme);
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // no-op when storage is unavailable
  }
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute("content", theme === "dark" ? "#0f172a" : "#f7f8fa");
  }
}

if (form) {
  const themeSelect = form.querySelector('select[name="theme"]');
  if (themeSelect) {
    const activeTheme = document.documentElement.getAttribute("data-theme");
    if (activeTheme === "light" || activeTheme === "dark") {
      themeSelect.value = activeTheme;
    }
    themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    if (status) {
      status.textContent = "Saving changes...";
    }
    const payload = Object.fromEntries(new FormData(form));

    try {
      const response = await fetch(apiUrl("/api/account"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (status) {
        if (response.ok) {
          status.textContent = "Profile updated.";
          const theme = body?.settings?.theme;
          applyTheme(theme);
        } else {
          status.textContent = body.detail || "Could not update yet.";
        }
      }
    } catch (error) {
      if (status) {
        status.textContent = "Connection issue. Try again.";
      }
      console.error(error);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  hydrateFromServer();
}
