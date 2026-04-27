import { DATA } from './data.js';
import { beep } from './sound.js';
export function startQualifying(state, onDone){
  const area = document.getElementById('qual-area'); const scoreEl = document.getElementById('qual-score'); const timeEl = document.getElementById('qual-time'); const comboEl = document.getElementById('qual-combo');
  area.innerHTML = ''; let score=0, combo=0, time=15.0, active=null, running=true; const diff=state.setup.difficulty;
  const cfg = diff==='B' ? {size:.08, interval:820, feint:0, penalty:0} : diff==='A' ? {size:.06, interval:680, feint:.10, penalty:1} : {size:.045, interval:540, feint:.20, penalty:2};
  function place(){
    if(!running) return; if(active) active.remove();
    const isFeint = Math.random() < cfg.feint;
    const rect = area.getBoundingClientRect(); const size = Math.max(30, rect.width*cfg.size); const marginX = rect.width*.08, marginTop = rect.height*.10, marginBot = rect.height*.15;
    const x = marginX + Math.random()*(rect.width - marginX*2 - size); const y = marginTop + Math.random()*(rect.height - marginTop - marginBot - size);
    const dot = document.createElement('button'); dot.className = 'target-dot' + (isFeint ? ' feint':''); dot.style.width=dot.style.height=size+'px'; dot.style.left=x+'px'; dot.style.top=y+'px'; dot.setAttribute('aria-label','target');
    dot.addEventListener('pointerdown', ev=>{ ev.preventDefault(); if(!running) return; if(isFeint){ score -= cfg.penalty; combo=0; beep(state,160,100,'sawtooth'); } else { combo++; score += 1 + Math.min(5, Math.floor(combo/5)); beep(state,760,70,'triangle'); } scoreEl.textContent=score; comboEl.textContent=combo; place(); });
    area.appendChild(dot); active=dot;
  }
  area.addEventListener('pointerdown', function miss(e){ if(!running) { area.removeEventListener('pointerdown',miss); return; } if(e.target===area){ score-=1; combo=0; scoreEl.textContent=score; comboEl.textContent=combo; beep(state,140,90,'sawtooth'); }});
  place();
  const timer = setInterval(()=>{ time-=0.1; timeEl.textContent=Math.max(0,time).toFixed(1); if(time<=0){ clearInterval(timer); running=false; if(active) active.remove(); const grid = buildGrid(state, score); state.qualifying = { score, grid }; onDone(grid, score); } },100);
}
function buildGrid(state, playerScore){
  const teamPerf = Object.fromEntries(DATA.teams.map(t=>[t.id,t.perf]));
  const cpu = DATA.drivers.map(d=>({ type:'cpu', ...d, qScore: Math.round(20 + Math.random()*80 + (teamPerf[d.teamId]||0)*4 + (d.personality==='stable'?3:d.personality==='attack'?2:0)) }));
  const player = { type:'player', id:'player', name:'You', country:'Player', flag:'⭐', teamId: state.player.teamId, personality:'player', qScore: playerScore + 45 };
  return [player, ...cpu].sort((a,b)=>b.qScore-a.qScore).map((d,i)=>({...d, grid:i+1}));
}
