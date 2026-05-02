import os, httpx
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

UPSTREAM = os.environ.get("UPSTREAM_CHAT_URL", "").rstrip("/")

HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EliteOmni</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',sans-serif;background:#0a0a0a;color:#e0e0e0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center}
  #app{width:100%;max-width:780px;height:100vh;display:flex;flex-direction:column;padding:20px;gap:16px}
  h1{text-align:center;font-size:1.6rem;font-weight:700;letter-spacing:3px;color:#fff}
  .sub{text-align:center;font-size:0.8rem;color:#555;margin-top:-10px}
  #messages{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:12px;padding:10px 0}
  .msg{max-width:80%;padding:12px 16px;border-radius:18px;line-height:1.5;font-size:0.95rem;white-space:pre-wrap;word-break:break-word}
  .user{background:#1a73e8;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
  .bot{background:#1e1e1e;color:#e0e0e0;align-self:flex-start;border-bottom-left-radius:4px;border:1px solid #2a2a2a}
  #form{display:flex;gap:10px;align-items:flex-end}
  #input{flex:1;background:#1e1e1e;border:1px solid #333;border-radius:24px;padding:12px 20px;color:#e0e0e0;font-size:0.95rem;outline:none;resize:none;max-height:120px;font-family:inherit}
  #input:focus{border-color:#1a73e8}
  #send{background:#1a73e8;color:#fff;border:none;border-radius:50%;width:46px;height:46px;font-size:1.4rem;cursor:pointer;flex-shrink:0;transition:background 0.2s}
  #send:hover{background:#1558b0}
  #send:disabled{background:#333;cursor:not-allowed}
  ::-webkit-scrollbar{width:4px}
  ::-webkit-scrollbar-thumb{background:#333;border-radius:4px}
</style>
</head>
<body>
<div id="app">
  <h1>ELITEOMNI</h1>
  <p class="sub">Mistral-7B &middot; v4.0</p>
  <div id="messages">
    <div class="msg bot">Hello! I am EliteOmni, powered by Mistral-7B. How can I help you?</div>
  </div>
  <form id="form">
    <textarea id="input" placeholder="Type a message..." rows="1"></textarea>
    <button id="send" type="submit">&#10148;</button>
  </form>
</div>
<script>
const form=document.getElementById('form');
const input=document.getElementById('input');
const send=document.getElementById('send');
const msgs=document.getElementById('messages');
let history=[];

function addMsg(text,role){
  const d=document.createElement('div');
  d.className='msg '+(role==='user'?'user':'bot');
  d.textContent=text;
  msgs.appendChild(d);
  msgs.scrollTop=msgs.scrollHeight;
  return d;
}

input.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.dispatchEvent(new Event('submit'));}
});
input.addEventListener('input',()=>{
  input.style.height='auto';
  input.style.height=Math.min(input.scrollHeight,120)+'px';
});

form.addEventListener('submit',async e=>{
  e.preventDefault();
  const msg=input.value.trim();
  if(!msg)return;
  input.value='';input.style.height='auto';
  addMsg(msg,'user');
  send.disabled=true;input.disabled=true;
  const thinking=addMsg('...','bot');
  try{
    const r=await fetch('/chat',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({message:msg,history})
    });
    const data=await r.json();
    const reply=data.response||data.text||JSON.stringify(data);
    thinking.textContent=reply;
    history.push({role:'user',content:msg},{role:'assistant',content:reply});
    if(history.length>20)history=history.slice(-20);
  }catch(err){
    thinking.textContent='Error: '+err.message;
  }finally{
    send.disabled=false;input.disabled=false;input.focus();
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
        return JSONResponse({"response": "UPSTREAM_CHAT_URL not set."}, status_code=503)
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(UPSTREAM + "/chat", json=body)
            return r.json()
    except Exception as e:
        return JSONResponse({"detail": str(e)}, status_code=503)
