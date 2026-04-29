import { DATA } from './data.js';
import { beep, playSfx } from './sound.js';

let activeQualifyingSession = null;

function cleanupQualifyingSession(){
  if(!activeQualifyingSession) return;
  const s = activeQualifyingSession;
  s.running = false;
  if(s.timer) clearInterval(s.timer);
  if(s.spawnTimer) clearTimeout(s.spawnTimer);
  if(s.lifeTimer) clearTimeout(s.lifeTimer);
  if(s.controller) s.controller.abort();
  if(s.active && s.active.isConnected) s.active.remove();
  activeQualifyingSession = null;
}

export function startQualifying(state, onDone){
  cleanupQualifyingSession();
  const area = document.getElementById('qual-area');
  const scoreEl = document.getElementById('qual-score');
  const timeEl = document.getElementById('qual-time');
  const comboEl = document.getElementById('qual-combo');
  const session = { running:true, timer:null, spawnTimer:null, lifeTimer:null, active:null, controller:new AbortController() };
  activeQualifyingSession = session;
  area.innerHTML = '';
  let score=0, combo=0, time=15.0;
  const diff=state.setup.difficulty;
  const cfg = diff==='B'
    ? {size:.20, interval:820, feint:0, penalty:0, cls:'diff-b'}
    : diff==='A'
      ? {size:.16, interval:680, feint:.10, penalty:1, cls:'diff-a'}
      : {size:.13, interval:540, feint:.20, penalty:2, cls:'diff-s'};

  function updateHud(){ scoreEl.textContent=score; comboEl.textContent=combo; }
  function clearActive(){
    if(session.lifeTimer){ clearTimeout(session.lifeTimer); session.lifeTimer=null; }
    if(session.spawnTimer){ clearTimeout(session.spawnTimer); session.spawnTimer=null; }
    if(session.active && session.active.isConnected) session.active.remove();
    session.active = null;
  }
  function scheduleNext(delay=cfg.interval){
    if(!session.running || activeQualifyingSession!==session) return;
    if(session.spawnTimer) clearTimeout(session.spawnTimer);
    session.spawnTimer = setTimeout(place, delay);
  }
  function finish(){
    if(activeQualifyingSession!==session) return;
    session.running=false;
    clearActive();
    if(session.timer) clearInterval(session.timer);
    session.controller.abort();
    activeQualifyingSession=null;
    const grid = buildGrid(state, score);
    state.qualifying = { score, grid };
    onDone(grid, score);
  }
  function place(){
    if(!session.running || activeQualifyingSession!==session) return;
    clearActive();
    const isFeint = Math.random() < cfg.feint;
    const rect = area.getBoundingClientRect();
    const size = Math.max(diff==='S'?72:84, rect.width*cfg.size);
    const marginX = rect.width*.08, marginTop = rect.height*.10, marginBot = rect.height*.15;
    const x = marginX + Math.random()*Math.max(1,(rect.width - marginX*2 - size));
    const y = marginTop + Math.random()*Math.max(1,(rect.height - marginTop - marginBot - size));
    const dot = document.createElement('button');
    dot.className = `target-dot ${cfg.cls}${isFeint ? ' feint':''}`;
    dot.style.width=dot.style.height=size+'px'; dot.style.left=x+'px'; dot.style.top=y+'px';
    dot.setAttribute('aria-label', isFeint ? 'feint target' : 'target');
    dot.addEventListener('pointerdown', ev=>{
      ev.preventDefault(); ev.stopPropagation();
      if(!session.running || activeQualifyingSession!==session) return;
      if(isFeint){ score -= cfg.penalty; combo=0; playSfx(state,'miss'); }
      else { combo++; score += 1 + Math.min(5, Math.floor(combo/5)); playSfx(state, combo>8?'perfect':'good'); }
      updateHud();
      clearActive();
      place();
    }, {signal:session.controller.signal});
    area.appendChild(dot); session.active=dot;
    session.lifeTimer = setTimeout(()=>{
      if(!session.running || activeQualifyingSession!==session) return;
      // ダミー点線は押さなくても自然消滅。未タップ時は減点しない。
      clearActive();
      scheduleNext(Math.max(120, cfg.interval*.45));
    }, cfg.interval);
  }
  area.addEventListener('pointerdown', function miss(e){
    if(!session.running || activeQualifyingSession!==session) return;
    if(e.target===area){ score-=1; combo=0; updateHud(); beep(state,140,90,'sawtooth'); }
  }, {signal:session.controller.signal});
  updateHud();
  place();
  session.timer = setInterval(()=>{
    if(!session.running || activeQualifyingSession!==session) return;
    time-=0.1; timeEl.textContent=Math.max(0,time).toFixed(1);
    if(time<=0) finish();
  },100);
}
function buildGrid(state, playerScore){
  const teamPerf = Object.fromEntries(DATA.teams.map(t=>[t.id,t.perf]));
  const cpu = DATA.drivers.map(d=>({ type:'cpu', ...d, qScore: Math.round(20 + Math.random()*80 + (teamPerf[d.teamId]||0)*4 + (d.personality==='stable'?3:d.personality==='attack'?2:0)) }));
  const player = { type:'player', id:'player', name:'You', country:'Player', flag:'⭐', teamId: state.player.teamId, personality:'player', qScore: playerScore + 45 };
  return [player, ...cpu].sort((a,b)=>b.qScore-a.qScore).map((d,i)=>({...d, grid:i+1}));
}
