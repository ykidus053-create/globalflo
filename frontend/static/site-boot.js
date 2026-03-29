const LOADER_MIN_MS = 700;
const loader = document.getElementById("site-loader");
const loaderStart = performance.now();

function finishLoader() {
  const body = document.body;
  if (!body || !loader) return;
  const elapsed = performance.now() - loaderStart;
  const wait = Math.max(0, LOADER_MIN_MS - elapsed);
  window.setTimeout(() => {
    body.classList.remove("is-loading");
    body.classList.add("is-loaded");
    window.setTimeout(() => {
      loader.remove();
    }, 700);
  }, wait);
}

if (document.readyState === "complete") {
  finishLoader();
} else {
  window.addEventListener("load", finishLoader, { once: true });
}

window.setTimeout(finishLoader, 2200);
