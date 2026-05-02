import os, httpx
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

UPSTREAM = os.environ.get("UPSTREAM_CHAT_URL", "").rstrip("/")

HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EliteOmni</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=Syne:wght@700;800&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #080b12;
  --surface: #0e1420;
  --surface2: #141928;
  --border: #1e2740;
  --accent: #4f8ef7;
  --accent2: #7c5cfc;
  --text: #e8ecf4;
  --text2: #6b7a99;
  --user-bg: linear-gradient(135deg, #4f8ef7, #7c5cfc);
  --bot-bg: #0e1420;
  --radius: 18px;
  --glow: 0 0 40px rgba(79,142,247,0.08);
}
*, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }

body {
  font-family: 'DM Sans', sans-serif;
  background: var(--bg);
  color: var(--text);
  height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
}

/* Ambient background */
body::before {
  content: '';
  position: fixed;
  top: -200px; left: 50%;
  transform: translateX(-50%);
  width: 800px; height: 400px;
  background: radial-gradient(ellipse, rgba(79,142,247,0.06) 0%, transparent 70%);
  pointer-events: none;
  z-index: 0;
}

#app {
  width: 100%;
  max-width: 760px;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;
}

/* Header */
header {
  padding: 22px 28px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.logo {
  display: flex;
  align-items: center;
  gap: 10px;
}
.logo-icon {
  width: 32px; height: 32px;
  background: var(--user-bg);
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px;
}
.logo-text {
  font-family: 'Syne', sans-serif;
  font-weight: 800;
  font-size: 1.05rem;
  letter-spacing: 2px;
  background: linear-gradient(135deg, #e8ecf4, #8fa4d8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.badge {
  font-size: 0.72rem;
  color: var(--text2);
  background: var(--surface2);
  border: 1px solid var(--border);
  padding: 4px 10px;
  border-radius: 20px;
  letter-spacing: 0.5px;
}

/* Starters */
#starters {
  padding: 24px 28px 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-shrink: 0;
  transition: opacity 0.3s, max-height 0.4s;
  max-height: 300px;
  overflow: hidden;
}
#starters.hidden { opacity: 0; max-height: 0; pointer-events: none; padding: 0; }
.starter-label {
  font-size: 0.78rem;
  color: var(--text2);
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 500;
}
.starters-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.starter {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 11px 14px;
  font-size: 0.82rem;
  color: var(--text2);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  font-family: 'DM Sans', sans-serif;
  line-height: 1.4;
}
.starter:hover {
  border-color: var(--accent);
  color: var(--text);
  background: var(--surface2);
}

/* Messages */
#messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px 28px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  scroll-behavior: smooth;
}
#messages::-webkit-scrollbar { width: 3px; }
#messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

.msg-wrap {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  animation: fadeUp 0.3s ease;
}
.msg-wrap.user { flex-direction: row-reverse; }

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

.avatar {
  width: 28px; height: 28px;
  border-radius: 8px;
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px;
  margin-top: 2px;
}
.avatar.bot { background: var(--user-bg); }
.avatar.user { background: var(--surface2); border: 1px solid var(--border); }

.msg-content { max-width: 78%; display: flex; flex-direction: column; gap: 4px; }

.msg {
  padding: 11px 16px;
  border-radius: 16px;
  font-size: 0.92rem;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}
.user .msg {
  background: var(--user-bg);
  color: #fff;
  border-bottom-right-radius: 4px;
}
.bot .msg {
  background: var(--bot-bg);
  border: 1px solid var(--border);
  color: var(--text);
  border-bottom-left-radius: 4px;
}

/* Actions under bot message */
.msg-actions {
  display: flex;
  gap: 6px;
  padding-left: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}
.msg-wrap:hover .msg-actions { opacity: 1; }
.action-btn {
  background: none;
  border: none;
  color: var(--text2);
  font-size: 0.78rem;
  cursor: pointer;
  padding: 3px 8px;
  border-radius: 6px;
  display: flex; align-items: center; gap: 4px;
  transition: all 0.15s;
  font-family: 'DM Sans', sans-serif;
}
.action-btn:hover { background: var(--surface2); color: var(--text); }
.action-btn.liked { color: #4ade80; }
.action-btn.disliked { color: #f87171; }

/* Typing indicator */
.typing { display: flex; gap: 4px; align-items: center; padding: 14px 16px; }
.dot {
  width: 6px; height: 6px;
  background: var(--text2);
  border-radius: 50%;
  animation: bounce 1.2s infinite;
}
.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce {
  0%,60%,100% { transform: translateY(0); }
  30% { transform: translateY(-6px); }
}

/* Input area */
#input-area {
  padding: 16px 28px 24px;
  flex-shrink: 0;
  border-top: 1px solid var(--border);
}
#form {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 10px 10px 10px 18px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
#form:focus-within {
  border-color: rgba(79,142,247,0.5);
  box-shadow: 0 0 0 3px rgba(79,142,247,0.08);
}
#input {
  flex: 1;
  background: none;
  border: none;
  color: var(--text);
  font-size: 0.92rem;
  font-family: 'DM Sans', sans-serif;
  resize: none;
  outline: none;
  max-height: 130px;
  line-height: 1.5;
  padding: 2px 0;
}
#input::placeholder { color: var(--text2); }
#send {
  width: 38px; height: 38px;
  background: var(--user-bg);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  transition: opacity 0.2s, transform 0.1s;
}
#send:hover { opacity: 0.88; }
#send:active { transform: scale(0.94); }
#send:disabled { opacity: 0.35; cursor: not-allowed; }
.hint {
  text-align: center;
  font-size: 0.72rem;
  color: var(--text2);
  margin-top: 10px;
  opacity: 0.6;
}

@media (max-width: 600px) {
  header, #starters, #messages, #input-area { padding-left: 16px; padding-right: 16px; }
  .starters-grid { grid-template-columns: 1fr; }
  .msg-content { max-width: 88%; }
}
</style>
</head>
<body>
<div id="app">
  <header>
    <div class="logo">
      <div class="logo-icon">✦</div>
      <span class="logo-text">ELITEOMNI</span>
    </div>
    <span class="badge">Mistral-7B · v4.0</span>
  </header>

  <div id="starters">
    <p class="starter-label">Try asking</p>
    <div class="starters-grid">
      <button class="starter" onclick="useStarter(this)">Explain how the internet works, step by step</button>
      <button class="starter" onclick="useStarter(this)">Write a Python function to find duplicates in a list</button>
      <button class="starter" onclick="useStarter(this)">What are the best evidence-based study techniques?</button>
      <button class="starter" onclick="useStarter(this)">Help me negotiate a higher salary</button>
    </div>
  </div>

  <div id="messages"></div>

  <div id="input-area">
    <form id="form">
      <textarea id="input" placeholder="Ask EliteOmni anything..." rows="1"></textarea>
      <button id="send" type="submit">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </form>
    <p class="hint">Enter to send · Shift+Enter for new line</p>
  </div>
</div>

<script>
const form     = document.getElementById('form');
const input    = document.getElementById('input');
const sendBtn  = document.getElementById('send');
const msgs     = document.getElementById('messages');
const starters = document.getElementById('starters');
let history    = [];
let started    = false;

function hideStarters() {
  if (!started) { starters.classList.add('hidden'); started = true; }
}

function useStarter(el) {
  input.value = el.textContent;
  input.focus();
  form.dispatchEvent(new Event('submit'));
}

function addMsg(text, role) {
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap ' + role;

  const av = document.createElement('div');
  av.className = 'avatar ' + role;
  av.textContent = role === 'user' ? '★' : '✦';

  const content = document.createElement('div');
  content.className = 'msg-content';

  const bubble = document.createElement('div');
  bubble.className = 'msg';
  bubble.textContent = text;
  content.appendChild(bubble);

  if (role === 'bot') {
    const actions = document.createElement('div');
    actions.className = 'msg-actions';
    actions.innerHTML = `
      <button class="action-btn" onclick="feedback(this,'up')" title="Good response">👍 Good</button>
      <button class="action-btn" onclick="feedback(this,'down')" title="Bad response">👎 Bad</button>
      <button class="action-btn" onclick="copyMsg(this)" title="Copy">⎘ Copy</button>
    `;
    content.appendChild(actions);
  }

  wrap.appendChild(av);
  wrap.appendChild(content);
  msgs.appendChild(wrap);
  msgs.scrollTop = msgs.scrollHeight;
  return bubble;
}

function feedback(btn, type) {
  const btns = btn.parentElement.querySelectorAll('.action-btn');
  btns.forEach(b => b.classList.remove('liked','disliked'));
  btn.classList.add(type === 'up' ? 'liked' : 'disliked');
}

function copyMsg(btn) {
  const bubble = btn.closest('.msg-content').querySelector('.msg');
  navigator.clipboard.writeText(bubble.textContent).then(() => {
    btn.textContent = '✓ Copied'; setTimeout(() => btn.textContent = '⎘ Copy', 1500);
  });
}

function addTyping() {
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap bot'; wrap.id = 'typing';
  const av = document.createElement('div');
  av.className = 'avatar bot'; av.textContent = '✦';
  const bubble = document.createElement('div');
  bubble.className = 'msg';
  bubble.innerHTML = '<div class="typing"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';
  wrap.appendChild(av); wrap.appendChild(document.createElement('div'));
  wrap.children[1].className = 'msg-content';
  wrap.children[1].appendChild(bubble);
  msgs.appendChild(wrap);
  msgs.scrollTop = msgs.scrollHeight;
  return wrap;
}

function setLoading(on) {
  sendBtn.disabled = on;
  input.disabled = on;
}

input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.dispatchEvent(new Event('submit')); }
});
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 130) + 'px';
});

form.addEventListener('submit', async e => {
  e.preventDefault();
  const msg = input.value.trim();
  if (!msg || sendBtn.disabled) return;
  input.value = ''; input.style.height = 'auto';
  hideStarters();
  addMsg(msg, 'user');
  setLoading(true);
  const typing = addTyping();

  try {
    const r = await fetch('/chat', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({message: msg, history})
    });
    const data = await r.json();
    const reply = data.response || data.text || data.detail || 'No response received.';
    typing.remove();
    addMsg(reply, 'bot');
    history.push({role:'user',content:msg},{role:'assistant',content:reply});
    if (history.length > 20) history = history.slice(-20);
  } catch(err) {
    typing.remove();
    addMsg('Connection error: ' + err.message + '. Please try again.', 'bot');
  } finally {
    setLoading(false); input.focus();
  }
});
</script>
</body>
</html>"""

@app.get("/", response_class=HTMLResponse)
async def index():
    return HTML

@app.get("/health")
async def health():
    return {"status": "ok", "upstream": UPSTREAM}

@app.post("/chat")
async def chat(request: Request):
    body = await request.json()
    if not UPSTREAM:
        return JSONResponse({"response": "UPSTREAM_CHAT_URL not configured."}, status_code=503)
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(UPSTREAM + "/chat", json=body)
            return r.json()
    except Exception as e:
        return JSONResponse({"detail": str(e)}, status_code=503)
