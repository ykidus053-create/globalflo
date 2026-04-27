import os
import time
from pathlib import Path
from typing import Any, Dict

import requests
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel


MODEL_ID = os.getenv("MODEL_ID", "kidusllm/EliteOmniReasoner")
HF_TOKEN = os.getenv("HF_TOKEN", "")

#
# Hugging Face has been migrating serverless inference traffic from the legacy
# `api-inference.huggingface.co/models/{MODEL_ID}` endpoint to the router-based
# endpoint. The router endpoint is currently the most reliable for new setups.
#
# You can override with HF_API_URL if you want a custom endpoint.
HF_API_URL = os.getenv("HF_API_URL", "").strip()
API_URL_PRIMARY = (
    HF_API_URL
    or f"https://router.huggingface.co/hf-inference/models/{MODEL_ID}"
)
# Fallback for older org setups / docs that still reference the legacy endpoint.
API_URL_FALLBACK = f"https://api-inference.huggingface.co/models/{MODEL_ID}"

HEADERS = {"Authorization": f"Bearer {HF_TOKEN}"} if HF_TOKEN else {}
# Help HF support debug requests + avoid some proxy edge cases.
HEADERS.setdefault("User-Agent", "eliteomni-api/1.0 (render; fastapi)")

APP_TITLE = os.getenv("APP_TITLE", "GlobalFlo Assistant")
APP_BUILD = (
    os.getenv("RENDER_GIT_COMMIT")
    or os.getenv("RENDER_COMMIT")
    or os.getenv("GIT_COMMIT")
    or "unknown"
)

app = FastAPI()

# Serve design assets (copied from your GlobalFlo web UI) for a consistent look.
STATIC_DIR = Path(__file__).parent / "static"
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


class GenReq(BaseModel):
    prompt: str
    max_new_tokens: int = 200
    temperature: float = 0.7


@app.get("/", response_class=HTMLResponse)
def root():
    # "Design-only" GlobalFlo look + assistant chat hub (no automation page content).
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{APP_TITLE}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/static/style.css">
  <style>
    /* Chat hub additions on top of GlobalFlo design tokens */
    .chat-shell {{
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--spacing-4);
    }}
    .chat-card {{
      background: rgba(20, 26, 41, 0.6);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--spacing-5);
    }}
    .chat-log {{
      height: 420px;
      overflow: auto;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: rgba(11, 15, 25, 0.55);
      padding: var(--spacing-3);
    }}
    .chat-msg {{ margin-bottom: var(--spacing-3); }}
    .chat-role {{
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--color-text-muted);
      margin-bottom: var(--spacing-1);
    }}
    .chat-bubble {{
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: rgba(255, 255, 255, 0.03);
      padding: var(--spacing-3);
      white-space: pre-wrap;
    }}
    .chat-row {{
      margin-top: var(--spacing-3);
      display: flex;
      gap: var(--spacing-2);
    }}
    .chat-input {{
      flex: 1;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-full);
      padding: var(--spacing-3) var(--spacing-4);
      background: rgba(11, 15, 25, 0.55);
      color: var(--color-text-primary);
      outline: none;
    }}
    .chat-input:focus {{
      border-color: rgba(56, 189, 248, 0.4);
      box-shadow: var(--shadow-glass);
    }}
    .chat-send {{
      border-radius: var(--radius-full);
      padding: var(--spacing-3) var(--spacing-5);
      background: var(--color-accent-main);
      color: var(--color-bg-base);
      border: none;
      font-weight: 700;
      cursor: pointer;
      transition: all var(--transition-fast);
      box-shadow: 0 4px 14px 0 rgba(56, 189, 248, 0.25);
    }}
    .chat-send:hover {{ transform: translateY(-1px); box-shadow: var(--shadow-glow); }}
    .mini {{
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      margin-top: var(--spacing-2);
      line-height: 1.45;
    }}
    code {{
      background: rgba(255,255,255,0.06);
      padding: 0.1rem 0.35rem;
      border-radius: 0.4rem;
      border: 1px solid var(--color-border);
    }}
  </style>
</head>
<body>
  <main>
    <header class="hero" aria-labelledby="hero-title">
      <span class="eyebrow" aria-label="Mode">Assistant Mode</span>
      <h1 id="hero-title">GlobalFlo Chat Hub</h1>
      <p class="lead">Design matches your GlobalFlo main UI. This page contains only the assistant chat hub.</p>
      <div class="mini">API health: <code>/health</code> | API docs: <code>/docs</code> | Generate: <code>POST /generate</code></div>
    </header>

    <section class="chat-shell" aria-label="Chat Hub">
      <article class="chat-card">
        <div class="chat-log" id="chatLog" aria-label="Conversation log"></div>
        <div class="chat-row">
          <input id="chatInput" class="chat-input" placeholder="Type a message..." />
          <button id="chatSend" class="chat-send">Send</button>
        </div>
        <div class="mini">Model backend: <code>{MODEL_ID}</code> (HF Serverless Inference API).</div>
      </article>
    </section>
  </main>

  <script>
    const log = document.getElementById("chatLog");
    const inp = document.getElementById("chatInput");
    const btn = document.getElementById("chatSend");

    function add(role, text) {{
      const wrap = document.createElement("div");
      wrap.className = "chat-msg";
      wrap.innerHTML = `<div class="chat-role"></div><div class="chat-bubble"></div>`;
      wrap.querySelector(".chat-role").textContent = role;
      wrap.querySelector(".chat-bubble").textContent = text;
      log.appendChild(wrap);
      log.scrollTop = log.scrollHeight;
      return wrap.querySelector(".chat-bubble");
    }}

    async function callGenerate(prompt) {{
      const res = await fetch("/generate", {{
        method: "POST",
        headers: {{ "Content-Type": "application/json" }},
        body: JSON.stringify({{ prompt, max_new_tokens: 200, temperature: 0.7 }})
      }});
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return data.text ?? JSON.stringify(data);
    }}

    async function send() {{
      const msg = (inp.value || "").trim();
      if (!msg) return;
      inp.value = "";
      add("User", msg);
      const bubble = add("Assistant", "Thinking...");
      try {{
        bubble.textContent = await callGenerate(msg);
      }} catch (e) {{
        bubble.textContent = "ERROR: " + e.message;
      }}
    }}

    btn.addEventListener("click", send);
    inp.addEventListener("keydown", (e) => {{
      if (e.key === "Enter") send();
    }});
    add("System", "Ready.");
  </script>
</body>
</html>
"""


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "ok": True,
        "model": MODEL_ID,
        "api_url_primary": API_URL_PRIMARY,
        "api_url_fallback": API_URL_FALLBACK,
        "ts": int(time.time()),
        "build": APP_BUILD,
        "token_present": bool(HF_TOKEN),
    }


@app.post("/generate")
def generate(req: GenReq) -> Dict[str, Any]:
    try:
        payload = {
            "inputs": req.prompt,
            "parameters": {
                "max_new_tokens": int(req.max_new_tokens),
                "temperature": float(req.temperature),
                "return_full_text": False,
            },
            # HF Serverless Inference API: wait for cold model to load instead of failing fast.
            "options": {"wait_for_model": True},
        }
        last_exc: Exception | None = None
        last_resp: requests.Response | None = None

        def call(url: str) -> requests.Response:
            return requests.post(url, headers=HEADERS, json=payload, timeout=180)

        for url in (API_URL_PRIMARY, API_URL_FALLBACK):
            try:
                r = call(url)
                last_resp = r
                # The legacy endpoint often returns an HTML "Cannot POST /models/..." page when
                # it's routed to the wrong backend. Treat that as a hard failure and fallback.
                if r.status_code == 404 and ("Cannot POST" in (r.text or "")):
                    continue
                return _handle_hf_response(r, url)
            except requests.RequestException as e:
                last_exc = e
                continue

        # If both attempts failed at the transport level (DNS, TLS, timeout, etc).
        if last_exc and last_resp is None:
            return JSONResponse(
                status_code=502,
                content={
                    "error": "upstream_request_failed",
                    "detail": str(last_exc),
                    "upstream_primary": API_URL_PRIMARY,
                    "upstream_fallback": API_URL_FALLBACK,
                },
            )

        # If we got a response but couldn't parse/handle it for some reason.
        if last_resp is not None:
            return JSONResponse(
                status_code=502,
                content={
                    "error": "upstream_unhandled",
                    "upstream_status": last_resp.status_code,
                    "upstream_text": (last_resp.text or "")[:4000],
                    "upstream_primary": API_URL_PRIMARY,
                    "upstream_fallback": API_URL_FALLBACK,
                },
            )
        raise RuntimeError("upstream_request_failed_no_detail")
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": "internal_error", "detail": repr(e), "model": MODEL_ID},
        )


def _handle_hf_response(r: requests.Response, upstream_url: str) -> Any:
    # Pass upstream errors through with context so the UI can show the real cause
    # (missing HF_TOKEN, model loading, rate limit, etc).
    if r.status_code != 200:
        text = (r.text or "").strip()
        # HF often returns JSON error bodies; keep raw text too.
        try:
            body = r.json()
        except Exception:
            body = None
        hint = None
        if r.status_code in (401, 403) and not HF_TOKEN:
            hint = "HF_TOKEN is not set on the Render service. Add it as an env var/secret."
        if (
            r.status_code == 400
            and isinstance(body, dict)
            and isinstance(body.get("error"), str)
            and "not supported by provider hf-inference" in body["error"]
        ):
            hint = (
                "HF 'hf-inference' serverless does not support this model repo. "
                "Fix options: (1) set MODEL_ID to a supported Hub model (e.g. 'gpt2'), "
                "or (2) create a Hugging Face Inference Endpoint for your model and set "
                "HF_API_URL to that endpoint URL."
            )
        if r.status_code == 503:
            hint = hint or "HF serverless may be loading the model or refusing due to size/hardware."
        return JSONResponse(
            status_code=502,
            content={
                "error": "upstream_error",
                "upstream": upstream_url,
                "upstream_status": r.status_code,
                "upstream_body": body,
                "upstream_text": text[:4000],
                "hint": hint,
                "model": MODEL_ID,
            },
        )

    try:
        data = r.json()
    except Exception:
        return JSONResponse(
            status_code=502,
            content={
                "error": "bad_upstream_json",
                "upstream": upstream_url,
                "upstream_text": (r.text or "")[:4000],
            },
        )

    if isinstance(data, list) and data and isinstance(data[0], dict):
        return {"text": data[0].get("generated_text", str(data))}
    if isinstance(data, dict) and "generated_text" in data:
        return {"text": data["generated_text"]}
    return {"text": str(data)}
