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
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>EliteOmni</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&family=Space+Grotesk:wght@700&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#060810;
  --s1:#0c1018;
  --s2:#111620;
  --s3:#171d2b;
  --border:#1f2840;
  --a1:#5b8fff;
  --a2:#8b5cf6;
  --a3:#06d6a0;
  --text:#dde4f0;
  --text2:#5a6a8a;
  --text3:#8494b8;
  --r:16px;
}
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;overflow:hidden}
body{
  font-family:'Outfit',sans-serif;
  background:var(--bg);
  color:var(--text);
  display:flex;
  flex-direction:column;
  align-items:center;
}
/* Ambient glow */
body::before{
  content:'';position:fixed;
  top:-300px;left:50%;transform:translateX(-50%);
  width:1000px;height:600px;
  background:radial-gradient(ellipse,rgba(91,143,255,.05) 0%,transparent 65%);
  pointer-events:none;z-index:0;
}
body::after{
  content:'';position:fixed;
  bottom:-200px;left:30%;
  width:500px;height:400px;
  background:radial-gradient(ellipse,rgba(139,92,246,.04) 0%,transparent 65%);
  pointer-events:none;z-index:0;
}

#shell{
  width:100%;max-width:800px;
  height:100dvh;
  display:flex;flex-direction:column;
  position:relative;z-index:1;
}

/* ── Header ── */
header{
  padding:18px 24px;
  display:flex;align-items:center;justify-content:space-between;
  border-bottom:1px solid var(--border);
  flex-shrink:0;
  backdrop-filter:blur(12px);
}
.brand{display:flex;align-items:center;gap:10px}
.brand-icon{
  width:34px;height:34px;border-radius:10px;
  background:linear-gradient(135deg,var(--a1),var(--a2));
  display:flex;align-items:center;justify-content:center;
  font-size:16px;box-shadow:0 0 20px rgba(91,143,255,.3);
}
.brand-name{
  font-family:'Space Grotesk',sans-serif;
  font-size:1rem;letter-spacing:2.5px;
  background:linear-gradient(135deg,#dde4f0,#7a90c0);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
}
.status{
  display:flex;align-items:center;gap:6px;
  font-size:.73rem;color:var(--text2);
  background:var(--s2);border:1px solid var(--border);
  padding:5px 12px;border-radius:20px;
}
.dot-live{
  width:6px;height:6px;border-radius:50%;
  background:var(--a3);
  box-shadow:0 0 6px var(--a3);
  animation:pulse 2s infinite;
}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}

/* ── Starters ── */
#starters{
  padding:20px 24px 0;flex-shrink:0;
  transition:opacity .35s,max-height .4s ease,padding .35s;
  max-height:220px;overflow:hidden;
}
#starters.gone{opacity:0;max-height:0;padding:0;pointer-events:none}
.sl{font-size:.72rem;color:var(--text2);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:10px}
.sg{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.sc{
  background:var(--s1);border:1px solid var(--border);
  border-radius:12px;padding:10px 14px;
  font-size:.82rem;color:var(--text3);
  cursor:pointer;text-align:left;font-family:'Outfit',sans-serif;
  line-height:1.45;transition:all .18s;
}
.sc:hover{border-color:var(--a1);color:var(--text);background:var(--s2);transform:translateY(-1px)}

/* ── Messages ── */
#msgs{
  flex:1;overflow-y:auto;
  padding:20px 24px;
  display:flex;flex-direction:column;gap:14px;
  scroll-behavior:smooth;
}
#msgs::-webkit-scrollbar{width:3px}
#msgs::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}

.mw{display:flex;gap:10px;align-items:flex-start;animation:rise .28s ease}
.mw.user{flex-direction:row-reverse}
@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

.av{
  width:30px;height:30px;border-radius:9px;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;font-size:14px;margin-top:1px;
}
.av.bot{background:linear-gradient(135deg,var(--a1),var(--a2));box-shadow:0 0 12px rgba(91,143,255,.25)}
.av.user{background:var(--s3);border:1px solid var(--border)}

.mc{max-width:78%;display:flex;flex-direction:column;gap:5px}

.mb{
  padding:11px 15px;border-radius:15px;
  font-size:.91rem;line-height:1.68;
  white-space:pre-wrap;word-break:break-word;
}
.user .mb{
  background:linear-gradient(135deg,var(--a1),var(--a2));
  color:#fff;border-bottom-right-radius:4px;
}
.bot .mb{
  background:var(--s1);border:1px solid var(--border);
  color:var(--text);border-bottom-left-radius:4px;
}
.bot .mb.err{border-color:rgba(248,113,113,.3);background:rgba(248,113,113,.05);color:#f87171}

/* Feedback row */
.fb{
  display:flex;gap:4px;padding-left:2px;
  opacity:0;transition:opacity .18s;pointer-events:none;
}
.mw:hover .fb{opacity:1;pointer-events:all}
.fb button{
  background:none;border:none;
  color:var(--text2);font-size:.75rem;
  cursor:pointer;padding:3px 8px;border-radius:7px;
  display:flex;align-items:center;gap:3px;
  font-family:'Outfit',sans-serif;transition:all .15s;
}
.fb button:hover{background:var(--s3);color:var(--text)}
.fb button.ok{color:#4ade80}
.fb button.bad{color:#f87171}

/* Regen button (user messages) */
.regen{
  display:none;font-size:.73rem;color:var(--text2);
  background:none;border:1px solid var(--border);
  border-radius:7px;padding:3px 9px;cursor:pointer;
  font-family:'Outfit',sans-serif;transition:all .15s;align-self:flex-end;
}
.mw.user:hover .regen{display:block}
.regen:hover{border-color:var(--a1);color:var(--a1)}

/* Typing */
.typing{display:flex;gap:5px;align-items:center;padding:13px 15px}
.dot2{
  width:6px;height:6px;background:var(--text2);border-radius:50%;
  animation:bop 1.1s infinite;
}
.dot2:nth-child(2){animation-delay:.18s}
.dot2:nth-child(3){animation-delay:.36s}
@keyframes bop{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-7px)}}

/* ── Input ── */
#ia{padding:14px 24px 20px;flex-shrink:0;border-top:1px solid var(--border)}
#form{
  display:flex;align-items:flex-end;gap:9px;
  background:var(--s1);border:1px solid var(--border);
  border-radius:18px;padding:9px 9px 9px 16px;
  transition:border-color .2s,box-shadow .2s;
}
#form:focus-within{
  border-color:rgba(91,143,255,.45);
  box-shadow:0 0 0 3px rgba(91,143,255,.07);
}
#inp{
  flex:1;background:none;border:none;
  color:var(--text);font-size:.91rem;font-family:'Outfit',sans-serif;
  resize:none;outline:none;max-height:130px;line-height:1.55;padding:2px 0;
}
#inp::placeholder{color:var(--text2)}
#sb{
  width:38px;height:38px;
  background:linear-gradient(135deg,var(--a1),var(--a2));
  border:none;border-radius:11px;color:#fff;
  font-size:.95rem;cursor:pointer;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;
  transition:opacity .18s,transform .1s;
  box-shadow:0 2px 12px rgba(91,143,255,.25);
}
#sb:hover{opacity:.88}
#sb:active{transform:scale(.93)}
#sb:disabled{opacity:.3;cursor:not-allowed;box-shadow:none}
.hint{text-align:center;font-size:.7rem;color:var(--text2);margin-top:8px;opacity:.5}

@media(max-width:600px){
  header,#starters,#msgs,#ia{padding-left:14px;padding-right:14px}
  .sg{grid-template-columns:1fr}
  .mc{max-width:87%}
}
</style>
</head>
<body>
<div id="shell">

  <header>
    <div class="brand">
      <div class="brand-icon">✦</div>
      <span class="brand-name">ELITEOMNI</span>
    </div>
    <div class="status"><div class="dot-live"></div>Mistral-7B · v4.1</div>
  </header>

  <div id="starters">
    <p class="sl">Suggested prompts</p>
    <div class="sg">
      <button class="sc" onclick="useStarter(this)">Explain how the internet works step by step</button>
      <button class="sc" onclick="useStarter(this)">Write a Python function to find duplicates in a list</button>
      <button class="sc" onclick="useStarter(this)">What are the best evidence-based study techniques?</button>
      <button class="sc" onclick="useStarter(this)">Help me negotiate a higher salary — practical advice</button>
    </div>
  </div>

  <div id="msgs">
    <div class="mw bot">
      <div class="av bot">✦</div>
      <div class="mc">
        <div class="mb">Hello! I'm EliteOmni, your AI assistant powered by Mistral-7B. Ask me anything — coding, research, writing, math, or just thinking through a problem together.</div>
        <div class="fb">
          <button onclick="fb(this,'ok')">👍 Good</button>
          <button onclick="fb(this,'bad')">👎 Bad</button>
          <button onclick="cp(this)">⎘ Copy</button>
        </div>
      </div>
    </div>
  </div>

  <div id="ia">
    <form id="form">
      <textarea id="inp" placeholder="Ask anything..." rows="1"></textarea>
      <button id="sb" type="submit">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </form>
    <p class="hint">Enter ↵ to send · Shift+Enter for new line</p>
  </div>
</div>

<script>
const form=document.getElementById('form');
const inp=document.getElementById('inp');
const sb=document.getElementById('sb');
const msgs=document.getElementById('msgs');
const starters=document.getElementById('starters');
let history=[];
let lastUserMsg='';

function hideStarters(){starters.classList.add('gone')}

function useStarter(el){inp.value=el.textContent.trim();inp.focus();form.dispatchEvent(new Event('submit'))}

function addBot(text,isErr=false){
  const w=document.createElement('div');w.className='mw bot';
  const av=document.createElement('div');av.className='av bot';av.textContent='✦';
  const mc=document.createElement('div');mc.className='mc';
  const mb=document.createElement('div');mb.className='mb'+(isErr?' err':'');mb.textContent=text;
  const fb2=document.createElement('div');fb2.className='fb';
  fb2.innerHTML=`<button onclick="fb(this,'ok')">👍 Good</button><button onclick="fb(this,'bad')">👎 Bad</button><button onclick="cp(this)">⎘ Copy</button>`;
  mc.appendChild(mb);mc.appendChild(fb2);
  w.appendChild(av);w.appendChild(mc);
  msgs.appendChild(w);msgs.scrollTop=msgs.scrollHeight;
  return mb;
}

function addUser(text){
  const w=document.createElement('div');w.className='mw user';
  const av=document.createElement('div');av.className='av user';av.textContent='★';
  const mc=document.createElement('div');mc.className='mc';
  const mb=document.createElement('div');mb.className='mb';mb.textContent=text;
  const rg=document.createElement('button');rg.className='regen';rg.textContent='↺ Retry';
  rg.onclick=()=>{inp.value=lastUserMsg;form.dispatchEvent(new Event('submit'))};
  mc.appendChild(mb);mc.appendChild(rg);
  w.appendChild(av);w.appendChild(mc);
  msgs.appendChild(w);msgs.scrollTop=msgs.scrollHeight;
}

function addTyping(){
  const w=document.createElement('div');w.className='mw bot';w.id='typing';
  const av=document.createElement('div');av.className='av bot';av.textContent='✦';
  const mc=document.createElement('div');mc.className='mc';
  const mb=document.createElement('div');mb.className='mb';
  mb.innerHTML='<div class="typing"><div class="dot2"></div><div class="dot2"></div><div class="dot2"></div></div>';
  mc.appendChild(mb);w.appendChild(av);w.appendChild(mc);
  msgs.appendChild(w);msgs.scrollTop=msgs.scrollHeight;
  return w;
}

function fb(btn,type){
  const row=btn.parentElement;
  row.querySelectorAll('button').forEach(b=>b.classList.remove('ok','bad'));
  btn.classList.add(type==='ok'?'ok':'bad');
}

function cp(btn){
  const mb=btn.closest('.mc').querySelector('.mb');
  navigator.clipboard.writeText(mb.textContent).then(()=>{
    const orig=btn.textContent;btn.textContent='✓ Copied';
    setTimeout(()=>btn.textContent=orig,1800);
  });
}

inp.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.dispatchEvent(new Event('submit'));}
});
inp.addEventListener('input',()=>{
  inp.style.height='auto';
  inp.style.height=Math.min(inp.scrollHeight,130)+'px';
});

form.addEventListener('submit',async e=>{
  e.preventDefault();
  const msg=inp.value.trim();
  if(!msg||sb.disabled)return;
  lastUserMsg=msg;
  inp.value='';inp.style.height='auto';
  hideStarters();addUser(msg);
  sb.disabled=true;inp.disabled=true;
  const t=addTyping();

  try{
    const r=await fetch('/chat',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({message:msg,history})
    });
    const data=await r.json();
    const reply=data.response||data.text||data.detail||'No response.';
    t.remove();
    if(reply.startsWith('Error')||reply.startsWith('Connection'))addBot(reply,true);
    else addBot(reply);
    history.push({role:'user',content:msg},{role:'assistant',content:reply});
    if(history.length>20)history=history.slice(-20);
  }catch(err){
    t.remove();
    addBot('Connection error: '+err.message+'. Please try again.',true);
  }finally{
    sb.disabled=false;inp.disabled=false;inp.focus();
  }
});
</script>
</body>
</html>"""

@app.get("/", response_class=HTMLResponse)
async def index(): return HTML

@app.get("/health")
async def health(): return {"status":"ok","upstream":UPSTREAM}

@app.post("/chat")
async def chat(request: Request):
    body = await request.json()
    if not UPSTREAM:
        return JSONResponse({"response":"UPSTREAM_CHAT_URL not configured."},status_code=503)
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(UPSTREAM+"/chat", json=body)
            return r.json()
    except Exception as e:
        return JSONResponse({"detail":str(e)},status_code=503)
