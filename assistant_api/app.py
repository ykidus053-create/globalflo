import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# ── Config ─────────────────────────────────────────────────────
MODEL_ID   = os.getenv("MODEL_ID", "mistralai/Mistral-7B-Instruct-v0.3")
HF_TOKEN   = os.getenv("HF_TOKEN", "")
UPSTREAM   = (os.getenv("UPSTREAM_CHAT_URL", "") or "").strip().rstrip("/")
APP_BUILD  = os.getenv("RENDER_GIT_COMMIT", "unknown")

# ── Correct endpoint for Mistral (chat completions format) ──────
HF_CHAT_URL = "https://api-inference.huggingface.co/v1/chat/completions"

SYSTEM_PROMPT = """You are EliteOmni, an intelligent and helpful AI assistant created by Kidus.
Answer questions accurately and concisely.
Rules:
- Only say things you are confident about. If unsure, say: I am not certain, but...
- Never fabricate commands or fictional dialogues.
- Never use (A)(B)(C) enumeration unless the user asks for it.
- Keep answers focused and relevant.
- Be warm, direct, and genuinely helpful."""

HEADERS = {
    "Authorization": f"Bearer {HF_TOKEN}",
    "Content-Type": "application/json",
}

app = FastAPI(title="EliteOmni API", version="3.0.0")

STATIC_DIR = Path(__file__).parent / "static"
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


# ── Request models ──────────────────────────────────────────────
class Message(BaseModel):
    role: str
    content: str

class ChatReq(BaseModel):
    session_id: Optional[str] = None
    message: str
    history: Optional[List[Message]] = []
    max_new_tokens: int = 300
    temperature: float = 0.4


# ── HF Chat Completions call ────────────────────────────────────
def call_mistral(message: str, history: List[Message], max_tokens: int, temperature: float) -> str:
    if not HF_TOKEN:
        return "ERROR: HF_TOKEN is not set. Add it in Render → Environment."

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for m in (history or [])[-4:]:
        messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": message})

    payload = {
        "model": MODEL_ID,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "top_p": 0.85,
        "repetition_penalty": 1.3,
        "stream": False,
    }

    try:
        r = requests.post(HF_CHAT_URL, headers=HEADERS, json=payload, timeout=120)
    except requests.RequestException as e:
        return f"Network error: {e}"

    if r.status_code == 401:
        return "ERROR: Invalid HF_TOKEN. Check Render → Environment."
    if r.status_code == 503:
        return "Model is loading on HuggingFace. Please wait 30 seconds and try again."
    if r.status_code != 200:
        return f"HF API error {r.status_code}: {r.text[:500]}"

    try:
        data = r.json()
        return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        return f"Failed to parse response: {e} — raw: {r.text[:300]}"


# ── Routes ──────────────────────────────────────────────────────
@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "ok": True,
        "model": MODEL_ID,
        "hf_token_set": bool(HF_TOKEN),
        "endpoint": HF_CHAT_URL,
        "build": APP_BUILD,
        "ts": int(time.time()),
    }


@app.post("/chat")
def chat(req: ChatReq) -> Any:
    # If an upstream URL is set, proxy to it
    if UPSTREAM:
        try:
            r = requests.post(f"{UPSTREAM}/chat", json=req.model_dump(), timeout=180)
            try:
                return JSONResponse(status_code=r.status_code, content=r.json())
            except Exception:
                return JSONResponse(status_code=r.status_code, content={"text": r.text[:4000]})
        except Exception as e:
            return JSONResponse(status_code=502, content={"error": str(e)})

    # Use Mistral via HF chat completions
    reply = call_mistral(
        message=req.message,
        history=req.history or [],
        max_tokens=req.max_new_tokens,
        temperature=req.temperature,
    )
    return {"text": reply, "session_id": req.session_id, "model": MODEL_ID}


@app.get("/", response_class=HTMLResponse)
def root():
    return HTMLResponse(content=UI_HTML)


# ── Embedded UI ─────────────────────────────────────────────────
UI_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EliteOmni · Mistral-7B</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap" rel="stylesheet">
<style>
  :root{--bg:#0a0a0f;--surface:#13131a;--border:#1e1e2e;--accent:#7c6aff;--accent2:#ff6a88;--text:#e8e8f0;--muted:#6b6b80;}
  *{margin:0;padding:0;box-sizing:border-box;}
  body{background:var(--bg);color:var(--text);font-family:'Space Mono',monospace;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background-image:radial-gradient(circle at 20% 30%,#7c6aff18,transparent 40%),radial-gradient(circle at 80% 70%,#ff6a8812,transparent 40%);}
  .wrap{width:min(700px,96vw);height:92vh;display:flex;flex-direction:column;border:1px solid var(--border);border-radius:18px;overflow:hidden;background:var(--surface);}
  header{padding:18px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;background:#0d0d16;}
  .logo{width:32px;height:32px;background:linear-gradient(135deg,var(--accent),var(--accent2));border-radius:8px;flex-shrink:0;}
  h1{font-family:'Syne',sans-serif;font-size:1rem;font-weight:800;letter-spacing:.06em;}
  .tag{font-size:.6rem;color:var(--accent);background:#7c6aff12;padding:2px 8px;border-radius:20px;border:1px solid #7c6aff25;margin-left:auto;}
  #log{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:14px;scroll-behavior:smooth;}
  #log::-webkit-scrollbar{width:3px;}#log::-webkit-scrollbar-thumb{background:var(--border);}
  .msg{max-width:88%;padding:11px 15px;border-radius:12px;font-size:.82rem;line-height:1.65;}
  .user{align-self:flex-end;background:linear-gradient(135deg,var(--accent),#5a4adf);color:#fff;border-bottom-right-radius:3px;}
  .bot{align-self:flex-start;background:#191925;border:1px solid var(--border);border-bottom-left-radius:3px;}
  .bot .lbl{font-size:.6rem;color:var(--accent);margin-bottom:5px;font-weight:700;letter-spacing:.1em;}
  .dot-wrap{display:flex;gap:4px;padding:3px 0;}
  .dot{width:6px;height:6px;background:var(--accent);border-radius:50%;animation:hop 1.1s infinite;}
  .dot:nth-child(2){animation-delay:.18s;}.dot:nth-child(3){animation-delay:.36s;}
  @keyframes hop{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
  footer{padding:14px 16px;border-top:1px solid var(--border);display:flex;gap:10px;background:#0d0d16;}
  #inp{flex:1;background:#0b0b14;border:1px solid var(--border);border-radius:10px;padding:11px 14px;color:var(--text);font-family:'Space Mono',monospace;font-size:.82rem;resize:none;height:46px;line-height:1.4;transition:border-color .2s;}
  #inp:focus{outline:none;border-color:var(--accent);}
  #btn{background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;color:#fff;padding:0 18px;border-radius:10px;cursor:pointer;font-family:'Syne',sans-serif;font-weight:700;font-size:.82rem;transition:opacity .15s,transform .1s;}
  #btn:hover{opacity:.88;}#btn:active{transform:scale(.97);}#btn:disabled{opacity:.35;cursor:not-allowed;}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="logo"></div>
    <h1>ELITEOMNI</h1>
    <span class="tag">Mistral-7B · v3.0</span>
  </header>
  <div id="log">
    <div class="msg bot"><div class="lbl">ELITEOMNI</div>Hello! I am EliteOmni, powered by Mistral-7B. How can I help you?</div>
  </div>
  <footer>
    <textarea id="inp" placeholder="Ask me anything..." rows="1"></textarea>
    <button id="btn">Send</button>
  </footer>
</div>
<script>
  const log=document.getElementById('log'),inp=document.getElementById('inp'),btn=document.getElementById('btn');
  let hist=[];
  const addMsg=(role,html)=>{const d=document.createElement('div');d.className='msg '+(role==='bot'?'bot':'user');d.innerHTML=role==='bot'?'<div class="lbl">ELITEOMNI</div>'+html:html;log.appendChild(d);log.scrollTop=log.scrollHeight;return d;};
  const thinking=()=>{const d=document.createElement('div');d.className='msg bot';d.innerHTML='<div class="lbl">ELITEOMNI</div><div class="dot-wrap"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';log.appendChild(d);log.scrollTop=log.scrollHeight;return d;};
  const send=async()=>{
    const txt=inp.value.trim();if(!txt)return;
    inp.value='';btn.disabled=true;
    addMsg('user',txt.replace(/</g,'&lt;'));
    const t=thinking();
    try{
      const r=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:txt,history:hist,max_new_tokens:300,temperature:0.4})});
      const d=await r.json();t.remove();
      const reply=(d.text||d.response||JSON.stringify(d)).replace(/</g,'&lt;').replace(/\n/g,'<br>');
      addMsg('bot',reply);
      hist.push({role:'user',content:txt},{role:'assistant',content:d.text||d.response||''});
      if(hist.length>10)hist=hist.slice(-10);
    }catch(e){t.remove();addMsg('bot','Network error: '+e.message);}
    btn.disabled=false;inp.focus();
  };
  btn.addEventListener('click',send);
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});
</script>
</body>
</html>"""
