"""
EliteOmni API — Production Backend
Fixes: system prompt, chat template, generation params, anti-hallucination
"""

import os
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Optional, List
import httpx

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="EliteOmni API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

HF_TOKEN   = os.environ.get("HF_TOKEN", "")
MODEL_ID   = os.environ.get("MODEL_ID", "kidusllm/EliteOmniReasoner")
HF_API_URL = f"https://api-inference.huggingface.co/models/{MODEL_ID}"

SYSTEM_PROMPT = """You are EliteOmni, an intelligent and helpful AI assistant created by Kidus.
You answer questions accurately and concisely.
Rules you must always follow:
- Only say things you are confident about. If unsure, say "I am not certain, but..."
- Never fabricate commands, instructions, or fictional dialogues.
- Never continue with (A), (B), (C) style enumeration unless the user asks for it.
- Do not roleplay as multiple characters or invent fake conversations.
- Keep answers focused and relevant to the user question.
- Be warm, direct, and genuinely helpful."""

GENERATION_PARAMS = {
    "max_new_tokens": 300,
    "temperature": 0.4,
    "top_p": 0.85,
    "top_k": 40,
    "repetition_penalty": 1.3,
    "do_sample": True,
    "return_full_text": False,
}

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Message]] = []

class ChatResponse(BaseModel):
    response: str
    model: str

def build_prompt(message: str, history: List[Message]) -> str:
    prompt = f"<s>[INST] <<SYS>>\n{SYSTEM_PROMPT}\n<</SYS>>\n\n"
    for i, msg in enumerate(history[-6:]):
        if msg.role == "user":
            if i == 0:
                prompt += f"{msg.content} [/INST] "
            else:
                prompt += f"<s>[INST] {msg.content} [/INST] "
        elif msg.role == "assistant":
            prompt += f"{msg.content} </s>"
    if history:
        prompt += f"<s>[INST] {message} [/INST]"
    else:
        prompt += f"{message} [/INST]"
    return prompt

async def query_hf(prompt: str) -> str:
    headers = {}
    if HF_TOKEN:
        headers["Authorization"] = f"Bearer {HF_TOKEN}"
    payload = {
        "inputs": prompt,
        "parameters": GENERATION_PARAMS,
        "options": {"wait_for_model": True, "use_cache": False}
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(HF_API_URL, headers=headers, json=payload)
        if resp.status_code == 503:
            raise HTTPException(status_code=503, detail="Model is loading. Wait 30 seconds and retry.")
        if resp.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid HuggingFace token.")
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=f"HF API error: {resp.text}")
        data = resp.json()
    if isinstance(data, list) and len(data) > 0:
        raw = data[0].get("generated_text", "").strip()
    elif isinstance(data, dict):
        raw = data.get("generated_text", "").strip()
    else:
        raw = str(data).strip()
    for token in ["[/INST]", "[INST]", "<s>", "</s>", "<<SYS>>", "<</SYS>>"]:
        raw = raw.replace(token, "").strip()
    return raw if raw else "I was not able to generate a response. Please try again."

@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL_ID, "hf_token_set": bool(HF_TOKEN)}

@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    prompt = build_prompt(req.message.strip(), req.history or [])
    response_text = await query_hf(prompt)
    return ChatResponse(response=response_text, model=MODEL_ID)

@app.get("/", response_class=HTMLResponse)
async def root():
    return HTMLResponse(content=FALLBACK_HTML)

FALLBACK_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EliteOmni</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;700;800&display=swap');
  :root{--bg:#0a0a0f;--surface:#13131a;--border:#1e1e2e;--accent:#7c6aff;--accent2:#ff6a88;--text:#e8e8f0;}
  *{margin:0;padding:0;box-sizing:border-box;}
  body{background:var(--bg);color:var(--text);font-family:'Space Mono',monospace;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;}
  .container{width:min(680px,95vw);height:90vh;display:flex;flex-direction:column;border:1px solid var(--border);border-radius:16px;overflow:hidden;background:var(--surface);}
  header{padding:20px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;}
  .logo{width:36px;height:36px;background:linear-gradient(135deg,var(--accent),var(--accent2));border-radius:8px;}
  h1{font-family:'Syne',sans-serif;font-size:1.1rem;font-weight:800;letter-spacing:0.05em;}
  .tag{font-size:0.65rem;color:var(--accent);background:#7c6aff15;padding:2px 8px;border-radius:20px;border:1px solid #7c6aff30;}
  #messages{flex:1;overflow-y:auto;padding:24px;display:flex;flex-direction:column;gap:16px;}
  .msg{max-width:85%;padding:12px 16px;border-radius:12px;font-size:0.85rem;line-height:1.6;}
  .user{align-self:flex-end;background:linear-gradient(135deg,var(--accent),#5a4adf);color:#fff;border-bottom-right-radius:4px;}
  .assistant{align-self:flex-start;background:#1a1a28;border:1px solid var(--border);border-bottom-left-radius:4px;}
  .assistant .label{font-size:0.65rem;color:var(--accent);margin-bottom:6px;font-weight:700;letter-spacing:0.1em;}
  .thinking{display:flex;gap:4px;padding:4px 0;}
  .thinking span{width:6px;height:6px;background:var(--accent);border-radius:50%;animation:bounce 1.2s infinite;}
  .thinking span:nth-child(2){animation-delay:.2s;}
  .thinking span:nth-child(3){animation-delay:.4s;}
  @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
  footer{padding:16px;border-top:1px solid var(--border);display:flex;gap:12px;}
  #input{flex:1;background:#0d0d16;border:1px solid var(--border);border-radius:10px;padding:12px 16px;color:var(--text);font-family:'Space Mono',monospace;font-size:0.85rem;resize:none;height:48px;}
  #input:focus{outline:none;border-color:var(--accent);}
  #send{background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;color:#fff;padding:0 20px;border-radius:10px;cursor:pointer;font-family:'Syne',sans-serif;font-weight:700;}
  #send:disabled{opacity:.4;cursor:not-allowed;}
</style>
</head>
<body>
<div class="container">
  <header><div class="logo"></div><h1>ELITEOMNI</h1><span class="tag">v2.0</span></header>
  <div id="messages">
    <div class="msg assistant"><div class="label">ELITEOMNI</div>Hello! I am EliteOmni. How can I help you today?</div>
  </div>
  <footer>
    <textarea id="input" placeholder="Ask me anything..."></textarea>
    <button id="send">Send</button>
  </footer>
</div>
<script>
  const messages=document.getElementById('messages'),input=document.getElementById('input'),send=document.getElementById('send');
  let history=[];
  function addMsg(role,text){const d=document.createElement('div');d.className='msg '+role;d.innerHTML=role==='assistant'?'<div class="label">ELITEOMNI</div>'+text.replace(/\n/g,'<br>'):text;messages.appendChild(d);messages.scrollTop=messages.scrollHeight;return d;}
  function addThinking(){const d=document.createElement('div');d.className='msg assistant';d.innerHTML='<div class="label">ELITEOMNI</div><div class="thinking"><span></span><span></span><span></span></div>';messages.appendChild(d);messages.scrollTop=messages.scrollHeight;return d;}
  async function sendMessage(){const text=input.value.trim();if(!text)return;input.value='';send.disabled=true;addMsg('user',text);const t=addThinking();try{const r=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,history})});const data=await r.json();t.remove();if(r.ok){addMsg('assistant',data.response);history.push({role:'user',content:text},{role:'assistant',content:data.response});if(history.length>12)history=history.slice(-12);}else{addMsg('assistant','Error: '+(data.detail||'Unknown'));}}catch(e){t.remove();addMsg('assistant','Network error.');}send.disabled=false;}
  send.addEventListener('click',sendMessage);
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}});
</script>
</body>
</html>"""
