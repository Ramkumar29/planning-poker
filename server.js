const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// In-memory rooms
const rooms = {};

function getOrCreateRoom(code) {
  if (!rooms[code]) {
    rooms[code] = { code, story: "What are we estimating?", members: [], revealed: false };
  }
  return rooms[code];
}

// ── Serve frontend ────────────────────────────────────────────────
app.get("/", (req, res) => res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Planning Poker 🃏</title>
<script src="/socket.io/socket.io.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',sans-serif;min-height:100vh;background:linear-gradient(270deg,#f8f0ff,#e8f4ff,#f0fff8,#fff8e8);background-size:400% 400%;animation:gradientShift 8s ease infinite}
@keyframes gradientShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes wiggle{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
@keyframes pop{0%{transform:scale(0.5);opacity:0}70%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(77,150,255,0.5)}50%{box-shadow:0 0 0 14px rgba(77,150,255,0)}}
@keyframes confettiFall{0%{transform:translateY(-20px) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}
@keyframes slideIn{0%{transform:translateY(14px);opacity:0}100%{transform:translateY(0);opacity:1}}
@keyframes fadeIn{0%{opacity:0}100%{opacity:1}}
@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
.card-btn{transition:all 0.18s;cursor:pointer}
.card-btn:hover{transform:translateY(-10px) scale(1.12) rotate(-2deg)!important;box-shadow:0 18px 36px rgba(0,0,0,0.2)!important}
.card-btn:active{transform:scale(0.93)!important}
.glass{background:rgba(255,255,255,0.88);backdrop-filter:blur(12px);border-radius:22px;box-shadow:0 6px 32px rgba(0,0,0,0.09)}
input{font-family:inherit;font-size:15px;border:2px solid #e0e0e0;border-radius:13px;padding:11px 14px;width:100%;transition:border 0.2s;outline:none}
input:focus{border-color:#4D96FF}
button{font-family:inherit;cursor:pointer;border:none;font-weight:800}
.btn-primary{background:linear-gradient(90deg,#4D96FF,#C77DFF);color:#fff;border-radius:14px;padding:13px;font-size:16px;box-shadow:0 6px 20px rgba(77,150,255,0.3);transition:transform 0.15s}
.btn-primary:hover{transform:scale(1.03)}
.btn-danger{background:linear-gradient(90deg,#FF6B6B,#F72585);color:#fff;border-radius:14px;padding:12px;font-size:15px}
.btn-green{background:linear-gradient(90deg,#6BCB77,#00C9A7);color:#fff;border-radius:14px;padding:12px;font-size:15px}
#confetti-container{position:fixed;inset:0;pointer-events:none;z-index:999;overflow:hidden}
.screen{display:none;padding:20px}
.screen.active{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh}
</style>
</head>
<body>
<div id="confetti-container"></div>

<!-- JOIN SCREEN -->
<div id="screen-join" class="screen active">
  <div class="glass" style="padding:44px 40px;width:380px;text-align:center;animation:pop 0.4s ease-out">
    <div style="font-size:54px;animation:bounce 1.4s ease-in-out infinite;display:inline-block">🃏</div>
    <h1 style="font-size:26px;font-weight:900;color:#1a1a2e;margin:10px 0 4px">Planning Poker</h1>
    <p style="color:#aaa;font-size:13px;margin-bottom:28px">Estimate together. Argue lovingly. 🎲</p>
    <input id="inp-name" placeholder="Your name 👤" style="margin-bottom:12px"/>
    <input id="inp-code" placeholder="Room code — leave blank to create new" style="margin-bottom:6px;text-transform:uppercase;letter-spacing:3px;text-align:center"/>
    <p id="join-err" style="color:#FF6B6B;font-size:13px;font-weight:700;min-height:18px;margin-bottom:8px"></p>
    <button class="btn-primary" style="width:100%" onclick="joinOrCreate()">Join / Create Room 🚀</button>
    <div style="margin-top:20px;display:flex;justify-content:center;gap:8px;font-size:22px">
      <span style="animation:bounce 1.0s ease-in-out infinite;display:inline-block">🦊</span>
      <span style="animation:bounce 1.1s ease-in-out infinite;display:inline-block">🐸</span>
      <span style="animation:bounce 1.2s ease-in-out infinite;display:inline-block">🦄</span>
      <span style="animation:bounce 1.3s ease-in-out infinite;display:inline-block">🐙</span>
      <span style="animation:bounce 1.4s ease-in-out infinite;display:inline-block">🦋</span>
    </div>
  </div>
</div>

<!-- GAME SCREEN -->
<div id="screen-game" class="screen" style="justify-content:flex-start;padding:0">
  <!-- Header -->
  <div id="header" style="width:100%;background:linear-gradient(90deg,#4D96FF,#C77DFF,#FF6B6B);background-size:200%;animation:gradientShift 5s ease infinite;padding:14px 22px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 6px 24px rgba(77,150,255,0.28);flex-wrap:wrap;gap:8px">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:26px;animation:wiggle 2s ease-in-out infinite;display:inline-block">🃏</span>
      <div>
        <div style="font-weight:900;font-size:19px;color:#fff">Planning Poker</div>
        <div id="hdr-sub" style="color:rgba(255,255,255,0.78);font-size:11px"></div>
      </div>
    </div>
    <button id="btn-copy-code" onclick="copyCode()" style="background:rgba(255,255,255,0.18);border:2px solid rgba(255,255,255,0.5);border-radius:13px;padding:7px 16px;color:#fff;font-size:15px;letter-spacing:3px;font-weight:900"></button>
    <div style="display:flex;align-items:center;gap:8px">
      <div id="hdr-avatar" style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 0 0 3px rgba(255,255,255,0.4)"></div>
      <span id="hdr-name" style="color:#fff;font-weight:700;font-size:14px"></span>
      <button onclick="leaveRoom()" style="background:rgba(255,255,255,0.18);color:#fff;border:1.5px solid rgba(255,255,255,0.35);border-radius:10px;padding:5px 12px;font-size:12px;font-weight:700">Leave 👋</button>
    </div>
  </div>

  <div style="max-width:880px;width:100%;margin:0 auto;padding:20px 16px">

    <!-- Story bar -->
    <div class="glass" style="padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:12px">
      <span style="font-size:20px">📋</span>
      <div id="story-text" style="flex:1;font-weight:700;font-size:15px;color:#1a1a2e"></div>
      <input id="story-input" placeholder="Story title…" style="flex:1;display:none"/>
      <button id="story-edit-btn" onclick="toggleStoryEdit()" style="background:#f0f4ff;border-radius:10px;padding:6px 14px;color:#4D96FF;font-size:13px">✏️ Edit</button>
      <button id="story-save-btn" onclick="saveStory()" style="background:#6BCB77;color:#fff;border-radius:10px;padding:6px 14px;font-size:13px;display:none">Save ✓</button>
    </div>

    <!-- Team cards -->
    <div class="glass" style="padding:20px;margin-bottom:16px">
      <div style="font-weight:800;font-size:15px;color:#1a1a2e;margin-bottom:16px">👥 The Crew <span id="all-voted-badge" style="display:none;background:#6BCB77;color:#fff;border-radius:20px;padding:2px 12px;font-size:12px;margin-left:8px;animation:pop 0.3s ease-out">Everyone voted! 🎉</span></div>
      <div id="members-grid" style="display:flex;flex-wrap:wrap;gap:16px"></div>
    </div>

    <!-- Results -->
    <div id="results-box" style="display:none;border-radius:20px;padding:20px 24px;margin-bottom:16px;animation:pop 0.5s ease-out"></div>

    <!-- Action buttons -->
    <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <button id="btn-reveal" class="btn-green" style="flex:1" onclick="revealVotes()">👁️ Reveal Votes</button>
      <button class="btn-danger" style="flex:1" onclick="resetVotes()">🔄 New Round</button>
    </div>

    <!-- Voting cards -->
    <div id="voting-section" class="glass" style="padding:22px">
      <div style="font-weight:800;font-size:15px;color:#1a1a2e;margin-bottom:16px">🎴 Your Estimate <span id="my-vote-badge" style="display:none;background:#6BCB77;color:#fff;border-radius:20px;padding:2px 12px;font-size:12px;animation:pop 0.3s ease-out"></span></div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center" id="cards-grid"></div>
      <p id="vote-hint" style="text-align:center;margin-top:14px;color:#aaa;font-size:13px">Tap a card to vote</p>
    </div>

  </div>
</div>

<script>
const FIBONACCI = [1,2,3,5,8,13,21,"?","☕"];
const COLORS = ["#FF6B6B","#FFD93D","#6BCB77","#4D96FF","#C77DFF","#FF9A3C","#00C9A7","#F72585","#43AA8B","#F8961E"];
const EMOJIS = ["🦊","🐸","🦄","🐙","🦋","🐯","🦁","🐬","🦖","🐳"];

const socket = io();
let myName="", myRoom="", myVote=null, roomState=null;

function ptColor(p){
  if(p==="?"||p==="☕") return "#888";
  if(p<=3) return "#6BCB77";
  if(p<=8) return "#FFD93D";
  return "#FF6B6B";
}

function showScreen(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  document.getElementById("screen-"+id).classList.add("active");
}

function joinOrCreate(){
  const name=document.getElementById("inp-name").value.trim();
  const code=document.getElementById("inp-code").value.trim().toUpperCase();
  const err=document.getElementById("join-err");
  if(!name){err.textContent="⚠️ Enter your name!";return;}
  err.textContent="";
  myName=name;
  socket.emit("join", {name, code});
}

socket.on("join-error", msg=>{
  document.getElementById("join-err").textContent="⚠️ "+msg;
});

socket.on("room-update", state=>{
  roomState=state;
  myRoom=state.code;
  showScreen("game");
  renderGame(state);
});

function renderGame(state){
  const me = state.members.find(m=>m.name===myName);
  if(!me) return;

  // Header
  document.getElementById("hdr-sub").textContent=state.members.length+" player"+(state.members.length!==1?"s":"")+" · "+state.members.filter(m=>m.vote!==null).length+"/"+state.members.length+" voted";
  document.getElementById("btn-copy-code").textContent=state.code+" 📋";
  document.getElementById("hdr-avatar").style.background=me.color;
  document.getElementById("hdr-avatar").textContent=me.emoji;
  document.getElementById("hdr-name").textContent=myName;

  // Story
  document.getElementById("story-text").textContent=state.story;

  // All voted badge
  const allVoted=state.members.length>0&&state.members.every(m=>m.vote!==null);
  document.getElementById("all-voted-badge").style.display=allVoted?"inline":"none";

  // Members grid
  const grid=document.getElementById("members-grid");
  grid.innerHTML="";
  state.members.forEach((m,i)=>{
    const col=document.createElement("div");
    col.style.cssText="display:flex;flex-direction:column;align-items:center;gap:8px;animation:slideIn 0.3s ease-out "+i*0.06+"s both";
    const card=document.createElement("div");
    const bg=state.revealed
      ?(m.vote!==null?ptColor(typeof m.vote==="number"?m.vote:99):"#eee")
      :(m.vote!==null?("linear-gradient(135deg,"+m.color+",#4D96FF)"):"rgba(240,244,255,0.9)");
    card.style.cssText="width:62px;height:88px;border-radius:16px;display:flex;align-items:center;justify-content:center;background:"+bg+";box-shadow:"+(m.vote!==null&&!state.revealed?"0 6px 20px "+m.color+"66":"0 4px 12px rgba(0,0,0,0.1)")+";border:3px solid "+(state.revealed?"transparent":m.vote!==null?m.color:"#ddd")+";transition:all 0.4s;font-weight:900;font-size:"+(state.revealed&&m.vote!==null?22:18)+"px;color:#fff";
    card.textContent=state.revealed?(m.vote!==null?m.vote:"–"):(m.vote!==null?"✅":"🂠");
    const av=document.createElement("div");
    av.style.cssText="width:36px;height:36px;border-radius:50%;background:"+m.color+";display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 3px 10px "+m.color+"66";
    av.textContent=m.emoji;
    const nm=document.createElement("div");
    nm.style.cssText="font-size:11px;font-weight:700;color:#555;text-align:center;max-width:72px;word-break:break-word";
    nm.textContent=m.name+(m.isAdmin?" 👑":"");
    col.appendChild(card); col.appendChild(av); col.appendChild(nm);
    grid.appendChild(col);
  });

  // Reveal button
  const revBtn=document.getElementById("btn-reveal");
  revBtn.disabled=state.revealed;
  revBtn.style.opacity=state.revealed?"0.45":"1";
  revBtn.textContent=state.revealed?"✅ Revealed!":allVoted?"🚀 Reveal Cards!":"👁️ Reveal ("+state.members.filter(m=>m.vote!==null).length+"/"+state.members.length+")";
  revBtn.style.animation=allVoted&&!state.revealed?"pulse 2s infinite":"none";

  // Results
  const numV=state.members.map(m=>m.vote).filter(v=>typeof v==="number");
  const rb=document.getElementById("results-box");
  if(state.revealed&&numV.length>0){
    const avg=(numV.reduce((a,b)=>a+b,0)/numV.length).toFixed(1);
    const mx=Math.max(...numV), mn=Math.min(...numV);
    const cons=numV.length===state.members.length&&new Set(numV).size===1;
    rb.style.display="block";
    rb.style.background=cons?"linear-gradient(135deg,#e8fff0,#d4f5e9)":"linear-gradient(135deg,#fff8e8,#ffecd2)";
    rb.style.border="2.5px solid "+(cons?"#6BCB77":"#FFD93D");
    rb.innerHTML=\`<div style="font-weight:900;font-size:17px;margin-bottom:14px;color:#1a1a2e;display:flex;align-items:center;gap:10px">
      \${cons?'<span style="animation:spin 1s linear infinite;display:inline-block">🏆</span> Perfect consensus! You are all in sync!':'<span style="animation:wiggle 1s ease-in-out infinite;display:inline-block">🧐</span> Discuss and re-vote!'}
    </div>
    <div style="display:flex;gap:28px;flex-wrap:wrap">
      \${[{l:"Average",v:avg,i:"📊",c:"#4D96FF"},{l:"Lowest",v:mn,i:"🐢",c:"#6BCB77"},{l:"Highest",v:mx,i:"🚀",c:"#FF6B6B"}].map(s=>\`<div style="text-align:center"><div style="font-size:22px">\${s.i}</div><div style="font-weight:900;font-size:28px;color:\${s.c}">\${s.v}</div><div style="font-size:12px;color:#888;font-weight:600">\${s.l}</div></div>\`).join("")}
    </div>
    \${!cons?'<div style="margin-top:10px;font-size:13px;color:#888;font-style:italic">😅 Gap of '+(mx-mn)+' pts — let\'s talk it out!</div>':''}\`;
  } else {
    rb.style.display="none";
  }

  // My vote & cards
  myVote = me.vote;
  const badge=document.getElementById("my-vote-badge");
  badge.style.display=myVote!==null?"inline":"none";
  badge.textContent="You picked "+myVote+"!";
  const hint=document.getElementById("vote-hint");
  hint.textContent=state.revealed?"Votes revealed! Start a new round below.":(myVote!==null?"🎯 Locked in "+myVote+" — waiting for reveal... 👀":"Tap a card to vote");
  hint.style.color=myVote!==null?"#4D96FF":"#aaa";
  hint.style.fontWeight=myVote!==null?"700":"400";
  document.getElementById("voting-section").style.display=state.revealed?"none":"block";

  renderCards(state.revealed);
}

function renderCards(revealed){
  if(revealed) return;
  const g=document.getElementById("cards-grid");
  g.innerHTML="";
  FIBONACCI.forEach(val=>{
    const sel=myVote===val;
    const btn=document.createElement("button");
    btn.className="card-btn";
    btn.textContent=val;
    btn.style.cssText="width:64px;height:92px;border-radius:18px;border:none;background:"+(sel?ptColor(typeof val==="number"?val:99):"rgba(255,255,255,0.95)")+";color:"+(sel?"#fff":"#333")+";font-weight:900;font-size:"+(sel?26:21)+"px;box-shadow:"+(sel?"0 8px 28px rgba(0,0,0,0.2)":"0 3px 12px rgba(0,0,0,0.09)")+";transform:"+(sel?"translateY(-10px) scale(1.1)":"none")+";outline:"+(sel?"3px solid #1a1a2e":"none")+";position:relative";
    btn.onclick=()=>castVote(val);
    if(sel){
      const tick=document.createElement("div");
      tick.style.cssText="position:absolute;top:-6px;right:-6px;width:18px;height:18px;background:#6BCB77;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff";
      tick.textContent="✓";
      btn.appendChild(tick);
    }
    g.appendChild(btn);
  });
}

function castVote(val){
  if(roomState?.revealed) return;
  socket.emit("vote",{room:myRoom,vote:val});
}
function revealVotes(){ socket.emit("reveal",{room:myRoom}); }
function resetVotes(){ socket.emit("reset",{room:myRoom}); }
function leaveRoom(){ socket.emit("leave",{room:myRoom}); showScreen("join"); }
function copyCode(){
  navigator.clipboard.writeText(myRoom).catch(()=>{});
  const btn=document.getElementById("btn-copy-code");
  btn.textContent="✅ Copied!";
  setTimeout(()=>btn.textContent=myRoom+" 📋",2000);
}
function toggleStoryEdit(){
  document.getElementById("story-text").style.display="none";
  document.getElementById("story-input").style.display="block";
  document.getElementById("story-input").value=roomState?.story||"";
  document.getElementById("story-edit-btn").style.display="none";
  document.getElementById("story-save-btn").style.display="block";
}
function saveStory(){
  const v=document.getElementById("story-input").value.trim();
  if(v) socket.emit("set-story",{room:myRoom,story:v});
  document.getElementById("story-text").style.display="block";
  document.getElementById("story-input").style.display="none";
  document.getElementById("story-edit-btn").style.display="block";
  document.getElementById("story-save-btn").style.display="none";
}

// Confetti
socket.on("consensus",()=>{
  const c=document.getElementById("confetti-container");
  c.innerHTML="";
  for(let i=0;i<36;i++){
    const d=document.createElement("div");
    d.style.cssText="position:absolute;left:"+(Math.random()*100)+"%;top:-20px;width:"+(8+Math.random()*10)+"px;height:"+(8+Math.random()*10)+"px;border-radius:"+(Math.random()>.5?"50%":"3px")+";background:"+COLORS[i%COLORS.length]+";animation:confettiFall "+(1.3+Math.random()*2)+"s ease-in "+(Math.random()*.9)+"s forwards";
    c.appendChild(d);
  }
  setTimeout(()=>c.innerHTML="",4000);
});
</script>
</body>
</html>`));

// ── Socket logic ──────────────────────────────────────────────────
io.on("connection", socket => {

  socket.on("join", ({ name, code }) => {
    if (!name) return;
    const roomCode = code || Math.random().toString(36).substr(2,5).toUpperCase();
    const room = getOrCreateRoom(roomCode);

    // Reject duplicate names
    if (room.members.find(m => m.name === name)) {
      socket.emit("join-error", "Name already taken in this room!");
      return;
    }

    const idx = room.members.length;
    room.members.push({
      name,
      color: COLORS[idx % COLORS.length],
      emoji: EMOJIS[idx % EMOJIS.length],
      vote: null,
      isAdmin: idx === 0,
      socketId: socket.id
    });

    socket.join(roomCode);
    socket.data = { name, room: roomCode };
    io.to(roomCode).emit("room-update", sanitize(room));
  });

  socket.on("vote", ({ room, vote }) => {
    const r = rooms[room]; if (!r) return;
    const m = r.members.find(m => m.socketId === socket.id);
    if (m) { m.vote = vote; io.to(room).emit("room-update", sanitize(r)); }
  });

  socket.on("reveal", ({ room }) => {
    const r = rooms[room]; if (!r) return;
    r.revealed = true;
    io.to(room).emit("room-update", sanitize(r));
    const votes = r.members.map(m => m.vote).filter(v => typeof v === "number");
    if (votes.length > 0 && votes.length === r.members.length && new Set(votes).size === 1) {
      io.to(room).emit("consensus");
    }
  });

  socket.on("reset", ({ room }) => {
    const r = rooms[room]; if (!r) return;
    r.revealed = false;
    r.members.forEach(m => m.vote = null);
    io.to(room).emit("room-update", sanitize(r));
  });

  socket.on("set-story", ({ room, story }) => {
    const r = rooms[room]; if (!r) return;
    r.story = story;
    io.to(room).emit("room-update", sanitize(r));
  });

  socket.on("leave", ({ room }) => {
    removeFromRoom(socket, room);
  });

  socket.on("disconnect", () => {
    const { name, room } = socket.data || {};
    if (room) removeFromRoom(socket, room);
  });
});

function removeFromRoom(socket, roomCode) {
  const r = rooms[roomCode]; if (!r) return;
  r.members = r.members.filter(m => m.socketId !== socket.id);
  if (r.members.length === 0) { delete rooms[roomCode]; return; }
  if (!r.members.find(m => m.isAdmin)) r.members[0].isAdmin = true;
  socket.leave(roomCode);
  io.to(roomCode).emit("room-update", sanitize(r));
}

function sanitize(room) {
  return { ...room, members: room.members.map(({ socketId, ...rest }) => rest) };
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("🃏 Planning Poker running on port", PORT));
