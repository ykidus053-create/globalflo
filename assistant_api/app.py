import os
import time
from typing import Any, Dict

import requests
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from pydantic import BaseModel


MODEL_ID = os.getenv("MODEL_ID", "kidusllm/EliteOmniReasoner")
HF_TOKEN = os.getenv("HF_TOKEN", "")

API_URL = f"https://api-inference.huggingface.co/models/{MODEL_ID}"
HEADERS = {"Authorization": f"Bearer {HF_TOKEN}"} if HF_TOKEN else {}

app = FastAPI()


class GenReq(BaseModel):
    prompt: str
    max_new_tokens: int = 200
    temperature: float = 0.7


@app.get("/", response_class=HTMLResponse)
def root():
    # Lightweight landing page so users don't see FastAPI 404 at /
    return f"""
    <html><body style="font-family:system-ui,Segoe UI,Roboto,Arial;margin:24px;max-width:860px">
      <h1>EliteOmni API</h1>
      <p>Model: <code>{MODEL_ID}</code></p>
      <ul>
        <li><a href="/docs">/docs</a></li>
        <li><a href="/health">/health</a></li>
      </ul>
      <p>POST <code>/generate</code> with JSON: <code>{{"prompt":"...","max_new_tokens":200,"temperature":0.7}}</code></p>
    </body></html>
    """


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"ok": True, "model": MODEL_ID, "ts": int(time.time())}


@app.post("/generate")
def generate(req: GenReq) -> Dict[str, Any]:
    payload = {
        "inputs": req.prompt,
        "parameters": {
            "max_new_tokens": int(req.max_new_tokens),
            "temperature": float(req.temperature),
            "return_full_text": False,
        },
    }
    r = requests.post(API_URL, headers=HEADERS, json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()

    if isinstance(data, list) and data and isinstance(data[0], dict):
        return {"text": data[0].get("generated_text", str(data))}
    if isinstance(data, dict) and "generated_text" in data:
        return {"text": data["generated_text"]}
    return {"text": str(data)}

