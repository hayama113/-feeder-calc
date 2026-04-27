import { DATA } from './data.js';
import { beep, sequence } from './sound.js';
import { tyreById, getWeatherTyreMultiplier, tapWindowByWeather } from './tyres.js';
import { evaluateAwards } from './awards.js';
import { addRanking } from './ranking.js';

let race = null;
export function startRace(state, onDone, testMode=false){
  const course = DATA.courses[0]; const laps = Number(state.setup.mode); const totalDistance = course.distance * laps; const grid = state.qualifying?.grid || [];
  const playerGrid = grid.findIndex(d=>d.type==='player');
  race = { state, course, laps, totalDistance, index:0, running:true, startedAt:performance.now(), eventNo:0, log:[], stats:{contacts:0,spins:0,penalties:0,perfectCorners:0,pitDone:0,pitPerfect:false,jumpStart:false,startReaction:null,pitPenalty:false,appealResult:null}, racers:grid.map((d,i)=>({ ...d, progress: Math.max(0, (grid.length-i)*0.15), finished:false, finishTime:null, tyreWear:100, currentTyre: state.setup.startTyre || 'm'})), playerIndex: playerGrid<0?0:playerGrid, testMode };
  showRaceUI();
  lightSequence(()=>cueEvent('start'));
}
function showRaceUI(){ document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active')); document.getElementById('screen-race').classList.add('active'); document.getElementById('race-view').classList.add('driver'); document.getElementById('tap-button').disabled=true; renderProgress(); updateHud('Ready'); }
function lightSequence(done){
  const lights = document.getElementById('lights'); lights.innerHTML = Array.from({length:5},()=>'<span class="light"></span>').join('');
  const nodes = [...lights.querySelectorAll('.light')]; let i=0;
  const tick = setInterval(()=>{ if(i<5){ nodes[i].classList.add('on'); beep(race.state,260+i*50,70); i++; } else { clearInterval(tick); nodes.forEach(n=>n.classList.remove('on')); document.getElementById('race-message').textContent='BLACK OUT!'; setTimeout(done, 80); } },520);
}
function nextEventType(){
  const c = race.course; race.eventNo++;
  if(race.eventNo===1) return 'corner';
  const posInLap = race.eventNo % 15;
  if(race.laps===3 && race.eventNo===22 && race.stats.pitDone===0) return 'pit';
  if(posInLap===5 || posInLap===11) return 'abc';
  return 'corner';
}
function cueEvent(type){
  if(!race.running) return;
  const msg = type==='start'?'TAP ON BLACKOUT': type==='corner'?'TAP AT APEX': type==='abc'?'ABC ZONE - TAP': 'PIT SIGNAL - TAP';
  const view = document.getElementById('race-view'); view.classList.toggle('driver', type==='start' || type==='pit');
  updateHud(msg); document.getElementById('race-message').textContent = msg;
  const btn = document.getElementById('tap-button'); btn.disabled=false; btn.textContent='TAP';
  const cueAt = performance.now(); const timeout = setTimeout(()=>handleTap(type, performance.now()-cueAt, true), 1600);
  btn.onclick = ()=>{ clearTimeout(timeout); handleTap(type, performance.now()-cueAt, false); };
}
function handleTap(type, ms, autoMiss){
  const btn = document.getElementById('tap-button'); btn.disabled=true; btn.onclick=null;
  const reaction = autoMiss ? 2 : ms/1000; const quality = judge(type, reaction);
  applyPlayer(type, reaction, quality); applyCpu(); renderProgress(); sequence(race.state, quality==='PERFECT'?760:quality==='MISS'?180:480);
  document.getElementById('race-message').textContent = `${quality} ${reaction.toFixed(3)}s`;
  checkFinish();
  if(race.running) setTimeout(()=>cueEvent(nextEventType()), 850);
}
function judge(type, reaction){
  if(type==='start'){
    if(reaction < .05){ race.stats.jumpStart=true; addPenalty('Jump start',2); return 'JUMP'; }
    if(reaction<=.18) return 'PERFECT'; if(reaction<=.30) return 'GOOD'; if(reaction<=.60) return 'NORMAL'; if(reaction<=1.0) return 'LATE'; return 'MISS';
  }
  const w = tapWindowByWeather(race.state.setup.weather);
  if(reaction<=w.perfect) return 'PERFECT'; if(reaction<=w.good) return 'GOOD'; if(reaction<=w.normal) return 'NORMAL'; if(reaction<=w.late) return 'LATE'; return 'MISS';
}
function applyPlayer(type, reaction, quality){
  const p = race.racers[race.playerIndex]; const tyre = tyreById(p.currentTyre); const weather = race.state.setup.weather; const mod = getWeatherTyreMultiplier(weather, tyre);
  let gain = type==='start' ? 1.0 : type==='abc' ? 1.4 : type==='pit' ? 0.7 : 1.05;
  const qmod = {PERFECT:1.25, GOOD:1.0, NORMAL:.72, LATE:.42, MISS:.25, JUMP:.15}[quality] || .25;
  if(type==='start') race.stats.startReaction = reaction;
  if(type==='corner' && quality==='PERFECT') race.stats.perfectCorners++;
  if(type==='pit') { race.stats.pitDone++; if(quality==='PERFECT') race.stats.pitPerfect=true; changeTyreAfterPit(p); }
  if((quality==='MISS' || quality==='LATE') && Math.random()< (weather==='light_rain'?0.28:weather==='damp'?0.16:0.08)){ race.stats.spins++; race.log.push({kind:'incident', text:'Spin after late input', penalty:0}); gain *= .15; }
  if(type==='abc' && quality==='MISS'){ addPenalty('ABC force use failed', 2); }
  p.progress += gain*qmod*mod;
  p.tyreWear = Math.max(0, p.tyreWear - tyre.wear*(weather==='dry' && (tyre.id==='r'?1.6:tyre.id==='i'?1.25:1)) );
  if(p.tyreWear<=0) p.progress -= .3;
}
function changeTyreAfterPit(p){
  const used = race.stats.pitDone; const sets = race.state.setup.tyreSets; const next = sets[Math.min(used, sets.length-1)] || sets[0]; p.currentTyre = next; p.tyreWear = 100;
}
function applyCpu(){
  const difficulty = race.state.setup.difficulty; const base = difficulty==='B'?0.62:difficulty==='A'?0.82:1.02;
  const perf = Object.fromEntries(DATA.teams.map(t=>[t.id,t.perf]));
  for(const [i,r] of race.racers.entries()){
    if(i===race.playerIndex || r.finished) continue;
    const personality = r.personality==='attack'?0.08:r.personality==='stable'?0.03:r.personality==='defense'?0.01:0;
    const mistake = Math.random() < (difficulty==='B'?.12:difficulty==='A'?.07:.03);
    let gain = base + Math.random()*0.55 + personality + (perf[r.teamId]||0)*0.035;
    if(mistake) gain *= .35;
    if(r.personality==='attack' && Math.random()<.05){ race.stats.contacts++; race.log.push({kind:'incident', text:`Contact with ${r.name}`, penalty:2}); if(Math.random()<.5) addPenalty(`Contact with ${r.name}`,2); }
    r.progress += gain;
  }
}
function addPenalty(text, cells){ race.stats.penalties++; race.log.push({kind:'penalty', text, penalty:cells}); }
function checkFinish(){
  for(const r of race.racers){ if(!r.finished && r.progress>=race.totalDistance){ r.finished=true; r.finishTime=(performance.now()-race.startedAt)/1000; }}
  const p = race.racers[race.playerIndex];
  if(p.finished || race.eventNo > race.totalDistance*1.7){ finishRace(); }
}
function finishRace(){
  race.running=false; const state = race.state; const p = race.racers[race.playerIndex];
  if(state.setup.mode==='3' && race.stats.pitDone < 1){ race.stats.pitPenalty=true; addPenalty('Pit Stop Rule Violation',10); p.progress -= 10; }
  const sorted = [...race.racers].sort((a,b)=> b.progress-a.progress || (a.finishTime||9999)-(b.finishTime||9999));
  const position = sorted.findIndex(r=>r.type==='player')+1;
  const time = p.finishTime || ((performance.now()-race.startedAt)/1000);
  const score = calcScore(position, time);
  const rank = score>=900?'S':score>=750?'A':score>=600?'B':score>=450?'C':'D';
  const result = { finished:true, position, time, score, rank, course:race.course.name, mode:state.setup.mode, difficulty:state.setup.difficulty, weather:state.setup.weather, tyres:[state.setup.startTyre, ...state.setup.tyreSets], contacts:race.stats.contacts, spins:race.stats.spins, penalties:race.stats.penalties, pitPenalty:race.stats.pitPenalty, pitPerfect:race.stats.pitPerfect, jumpStart:race.stats.jumpStart, startReaction:race.stats.startReaction, perfectCorners:race.stats.perfectCorners, log:race.log };
  const unlocked = race.testMode ? [] : evaluateAwards(result, state);
  if(!race.testMode) addRanking(state, {position,time,score,rank,course:result.course,mode:result.mode,difficulty:result.difficulty,weather:result.weather,tyres:result.tyres,penalties:result.penalties,contacts:result.contacts,appealResult:null});
  state.lastResult = {...result, unlockedAwards: unlocked.map(a=>a.id)}; window.ASR.save(); window.ASR.renderResult(state.lastResult, unlocked); }
function calcScore(position, time){
  let score = 400 - (position-1)*14;
  score += Math.max(0, 250 - race.eventNo*0.6);
  score += Math.max(0, 150 - race.stats.contacts*28 - race.stats.spins*22);
  score += Math.max(0, 100 - race.stats.pitPenalty*80);
  score -= Math.min(100, race.stats.penalties*18);
  score -= Math.min(100, race.stats.contacts*20 + race.stats.spins*16);
  return Math.max(0, Math.min(1000, Math.round(score)));
}
function updateHud(event){
  const p = race?.racers?.[race.playerIndex]; if(!p) return;
  const sorted = [...race.racers].sort((a,b)=>b.progress-a.progress); const pos = sorted.findIndex(r=>r.type==='player')+1;
  document.getElementById('hud-position').textContent = `P${pos} / 22`; document.getElementById('hud-event').textContent = event;
  document.getElementById('hud-weather').textContent = race.state.setup.weather; const tyre=tyreById(p.currentTyre); document.getElementById('hud-tyre').textContent = `${tyre.icon} ${tyre.name} / ${Math.round(p.tyreWear)}%`;
}
function renderProgress(){
  if(!race) return; const el = document.getElementById('progress-track'); const sorted=[...race.racers].sort((a,b)=>b.progress-a.progress);
  const topIds = new Set(sorted.slice(0,3).map(r=>r.id)); const pprog = race.racers[race.playerIndex].progress;
  el.innerHTML='';
  for(const r of race.racers){ const m=document.createElement('span'); let cls='marker'; if(r.type==='player') cls+=' player'; else if(topIds.has(r.id)) cls+=' top'; else if(Math.abs(r.progress-pprog)<5) cls+=' near'; m.className=cls; m.style.left=(Math.min(98, Math.max(2, (r.progress/race.totalDistance)*96+2)))+'%'; m.title=r.name; el.appendChild(m); }
  updateHud(document.getElementById('hud-event').textContent || 'Race');
}
export function retryLastRace(state, onDone){ if(state.qualifying) startRace(state, onDone); }
