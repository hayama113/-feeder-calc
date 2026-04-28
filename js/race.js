import { DATA } from './data.js';
import { playSfx, startBgm } from './sound.js';
import { tyreById, getWeatherTyreMultiplier } from './tyres.js';
import { evaluateAwards } from './awards.js';
import { addRanking } from './ranking.js';

let race = null;

export function startRace(state, onDone, testMode=false){
  const course = DATA.courses[0];
  const laps = Number(state.setup.mode);
  const totalDistance = course.distance * laps;
  const grid = state.qualifying?.grid || [];
  const playerGrid = grid.findIndex(d=>d.type==='player');
  race = {
    state, course, laps, totalDistance, index:0, running:true, paused:false, onDone,
    startedAt:performance.now(), currentEventIndex:-1, eventQueue:buildEventQueue(laps), log:[],
    stats:{contacts:0,spins:0,penalties:0,perfectCorners:0,pitDone:0,pitPerfect:false,jumpStart:false,startReaction:null,pitPenalty:false,appealResult:null},
    racers:grid.map((d,i)=>({ ...d, progress: Math.max(0, (grid.length-i)*0.2), finished:false, finishTime:null, tyreWear:100, currentTyre: state.setup.startTyre || 'm'})),
    playerIndex: playerGrid<0?0:playerGrid, testMode, impact:{beforePenalty:null, afterReview:null, afterAppeal:null, final:null}
  };
  showRaceUI(); startBgm(state,'race'); lightSequence(()=>cueEvent({type:'start'}));
}
function buildEventQueue(laps){
  const q=[];
  for(let lap=1; lap<=laps; lap++){
    for(let c=1; c<=12; c++){
      if(c===5) q.push({type:'abc', lap});
      if(c===8) q.push({type:'pit', lap});
      if(c===10) q.push({type:'abc', lap});
      q.push({type:'corner', lap, direction: ((lap+c)%2===0?'left':'right'), corner:c});
    }
  }
  return q;
}
function showRaceUI(){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-race').classList.add('active');
  document.getElementById('race-view').className='race-view driver';
  document.getElementById('tap-button').disabled=true;
  document.getElementById('pause-race').onclick=showPauseMenu;
  renderProgress(); updateHud('Ready');
}
function lightSequence(done){
  const lights = document.getElementById('lights');
  lights.innerHTML = Array.from({length:5},()=>'<span class="light"></span>').join('');
  document.getElementById('race-message').textContent='START SIGNAL';
  const nodes = [...lights.querySelectorAll('.light')]; let i=0;
  const tick = setInterval(()=>{
    if(!race?.running){ clearInterval(tick); return; }
    if(i<5){ nodes[i].classList.add('on'); playSfx(race.state,'startLight'); i++; }
    else { clearInterval(tick); nodes.forEach(n=>n.classList.remove('on')); document.getElementById('race-message').textContent='BLACK OUT!'; playSfx(race.state,'blackout'); setTimeout(done, 80); }
  },520);
}
function nextEvent(){ race.currentEventIndex++; return race.eventQueue[race.currentEventIndex]; }
function cueNext(){
  const ev = nextEvent();
  if(!ev){ finishRace(); return; }
  cueEvent(ev);
}
function cueEvent(ev){
  if(!race.running) return;
  const type = ev.type;
  const title = type==='corner' ? (ev.direction==='left'?'LEFT CORNER':'RIGHT CORNER') : type==='abc' ? 'ABC ZONE' : type==='pit' ? 'PIT ENTRY' : 'TAP ON BLACKOUT';
  updateHud(title);
  if(type==='start') return startSimpleTap(ev);
  if(type==='corner') return showCornerPreview(ev);
  showGenericPreview(ev, title);
}
function showGenericPreview(ev, title){
  const view = document.getElementById('race-view');
  view.className = 'race-view driver';
  view.innerHTML = `<div class="event-preview"><div class="event-preview-card"><h2>${title}</h2><div class="arrow">${ev.type==='pit'?'▥':'⚡'}</div><p>2...1...</p></div></div><div id="race-message" class="race-message"></div>`;
  document.getElementById('tap-button').disabled = true;
  setTimeout(()=>startSimpleTap(ev), 2000);
}
function showCornerPreview(ev){
  const view = document.getElementById('race-view');
  view.className = 'race-view driver';
  const arrow = ev.direction==='left'?'←':'→';
  view.innerHTML = `<div class="event-preview"><div class="event-preview-card"><h2>${ev.direction==='left'?'LEFT CORNER':'RIGHT CORNER'}</h2><div class="arrow">${arrow}</div><p>2...1...</p></div></div><div id="race-message" class="race-message"></div>`;
  document.getElementById('tap-button').disabled = true;
  setTimeout(()=>startCornerTap(ev), 2000);
}
function startSimpleTap(ev){
  if(!race.running) return;
  const btn = document.getElementById('tap-button');
  const view = document.getElementById('race-view');
  view.className = ev.type==='pit' ? 'race-view driver' : 'race-view';
  view.innerHTML = `<div id="race-message" class="race-message">${ev.type==='start'?'TAP ON BLACKOUT':ev.type==='pit'?'PIT SIGNAL - TAP':'ABC ZONE - TAP'}</div>`;
  btn.disabled=false; btn.textContent='TAP';
  const cueAt = performance.now();
  const timeout = setTimeout(()=>handleTap(ev, performance.now()-cueAt, true), 1700);
  btn.onclick = ()=>{ clearTimeout(timeout); handleTap(ev, performance.now()-cueAt, false); };
}
function startCornerTap(ev){
  if(!race.running) return;
  const btn = document.getElementById('tap-button');
  const view = document.getElementById('race-view');
  const direction = ev.direction || 'left';
  const duration = difficultySweepMs();
  const rot = direction==='left' ? '-18deg' : '18deg';
  view.className = 'race-view';
  view.innerHTML = `<div class="corner-game ${direction}" style="--sweep:${duration}ms;--car-rot:${rot};--lane-rot:${direction==='left'?'-12deg':'12deg'}"><div class="corner-lane"></div><div class="apex-box"></div><div class="corner-car"></div></div><div id="race-message" class="race-message">TAP AT APEX</div>`;
  btn.disabled=false; btn.textContent='TAP';
  const targetAt = performance.now() + duration * 0.55;
  let used = false;
  const finish = (auto=false)=>{
    if(used) return; used = true;
    btn.disabled=true; btn.onclick=null; view.onclick=null;
    const delta = auto ? 9999 : Math.abs(performance.now() - targetAt);
    handleCornerTap(ev, delta, auto);
  };
  const timeout = setTimeout(()=>finish(true), duration + 430);
  const tap = (e)=>{ e.preventDefault(); clearTimeout(timeout); finish(false); };
  btn.onclick = tap; view.onclick = tap;
}
function difficultySweepMs(){ const d=race.state.setup.difficulty; return d==='B'?1650:d==='A'?1450:1280; }
function handleTap(ev, ms, autoMiss){
  const btn = document.getElementById('tap-button'); btn.disabled=true; btn.onclick=null;
  const reaction = autoMiss ? 2 : ms/1000;
  const quality = judgeSimple(ev.type, reaction);
  applyPlayer(ev.type, reaction, quality); applyCpu(); renderProgress(); feedback(quality);
  document.getElementById('race-message').textContent = `${quality} ${reaction.toFixed(3)}s`;
  checkFinish(); if(race.running) setTimeout(()=>cueNext(), 1150);
}
function handleCornerTap(ev, deltaMs, autoMiss){
  const reaction = autoMiss ? 9 : deltaMs/1000;
  const quality = judgeCorner(reaction);
  applyPlayer('corner', reaction, quality); applyCpu(); renderProgress(); feedback(quality);
  const msg = document.getElementById('race-message'); if(msg) msg.textContent = `${quality} Δ${reaction.toFixed(3)}s`;
  checkFinish(); if(race.running) setTimeout(()=>cueNext(), 1250);
}
function judgeSimple(type, reaction){
  if(type==='start'){
    if(reaction < .05){ race.stats.jumpStart=true; addPenalty('Jump start',2); return 'JUMP'; }
    if(reaction<=.18) return 'PERFECT'; if(reaction<=.30) return 'GOOD'; if(reaction<=.60) return 'NORMAL'; if(reaction<=1.0) return 'LATE'; return 'MISS';
  }
  if(reaction<=.18) return 'PERFECT'; if(reaction<=.32) return 'GOOD'; if(reaction<=.62) return 'NORMAL'; if(reaction<=1.0) return 'LATE'; return 'MISS';
}
function judgeCorner(delta){
  const d = race.state.setup.difficulty;
  const base = d==='B' ? {p:.10,g:.20,n:.35,l:.55} : d==='A' ? {p:.08,g:.16,n:.28,l:.45} : {p:.06,g:.12,n:.22,l:.35};
  const p = race.racers[race.playerIndex];
  const weather = race.state.setup.weather;
  const tyre = tyreById(p.currentTyre);
  const wearFactor = p.tyreWear < 20 ? .72 : p.tyreWear < 40 ? .84 : p.tyreWear < 70 ? .93 : 1;
  const weatherFactor = weather==='light_rain' ? .78 : weather==='damp' ? .88 : 1;
  const mismatch = tyreMismatchFactor(weather, tyre);
  const f = wearFactor * weatherFactor * mismatch;
  if(delta <= base.p*f) return 'PERFECT';
  if(delta <= base.g*f) return 'GOOD';
  if(delta <= base.n*f) return 'NORMAL';
  if(delta <= base.l*f) return 'LATE';
  return 'MISS';
}
function tyreMismatchFactor(weather, tyre){
  if(weather==='dry' && (tyre.id==='i'||tyre.id==='r')) return .82;
  if(weather==='light_rain' && ['ss','s','m','h'].includes(tyre.id)) return .78;
  if(weather==='damp' && ['ss','s'].includes(tyre.id)) return .86;
  return 1;
}
function applyPlayer(type, reaction, quality){
  const p = race.racers[race.playerIndex];
  const tyre = tyreById(p.currentTyre);
  const weather = race.state.setup.weather;
  const weatherTyre = getWeatherTyreMultiplier(weather, tyre);
  const wearMod = tyreWearMoveMod(p.tyreWear);
  let gain = type==='start' ? 2.0 : type==='abc' ? 7.2 : type==='pit' ? 2.4 : 5.4;
  const qmod = {PERFECT:1.28, GOOD:1.04, NORMAL:.76, LATE:.45, MISS:.18, JUMP:.12}[quality] || .18;
  if(type==='start') race.stats.startReaction = reaction;
  if(type==='corner' && quality==='PERFECT') race.stats.perfectCorners++;
  if(type==='pit') { race.stats.pitDone++; if(quality==='PERFECT') race.stats.pitPerfect=true; changeTyreAfterPit(p); }
  if((quality==='MISS' || quality==='LATE') && Math.random()< (weather==='light_rain'?0.30:weather==='damp'?0.17:0.08)){
    race.stats.spins++; race.log.push({kind:'incident', text:'Spin after late input', penalty:0}); gain *= .15;
  }
  if(type==='abc' && quality==='MISS'){ addPenalty('ABC force use failed', 2); }
  p.progress += Math.max(.2, gain*qmod*weatherTyre*wearMod);
  p.tyreWear = Math.max(0, p.tyreWear - tyre.wear*(weather==='dry' && (tyre.id==='r'?1.6:tyre.id==='i'?1.25:1)) );
  if(p.tyreWear<=0) p.progress -= .8;
}
function tyreWearMoveMod(w){ if(w<=0) return .50; if(w<20) return .75; if(w<40) return .88; if(w<70) return .95; return 1; }
function changeTyreAfterPit(p){
  const used = race.stats.pitDone;
  const sets = race.state.setup.tyreSets;
  const next = sets[Math.min(used, sets.length-1)] || sets[0];
  p.currentTyre = next; p.tyreWear = 100;
}
function applyCpu(){
  const difficulty = race.state.setup.difficulty; const base = difficulty==='B'?3.4:difficulty==='A'?4.4:5.3;
  const perf = Object.fromEntries(DATA.teams.map(t=>[t.id,t.perf]));
  for(const [i,r] of race.racers.entries()){
    if(i===race.playerIndex || r.finished) continue;
    const personality = r.personality==='attack'?0.42:r.personality==='stable'?0.20:r.personality==='defense'?0.08:0;
    const mistake = Math.random() < (difficulty==='B'?.12:difficulty==='A'?.07:.035);
    let gain = base + Math.random()*2.0 + personality + (perf[r.teamId]||0)*0.18;
    if(mistake) gain *= .35;
    if(r.personality==='attack' && Math.random()<.04){ race.stats.contacts++; race.log.push({kind:'incident', text:`Contact with ${r.name}`, penalty:2}); if(Math.random()<.45) addPenalty(`Contact with ${r.name}`,2); }
    r.progress += gain;
    if(!r.finished && r.progress>=race.totalDistance){ r.finished=true; r.finishTime=(performance.now()-race.startedAt)/1000; }
  }
}
function addPenalty(text, cells){ race.stats.penalties++; race.log.push({kind:'penalty', text, penalty:cells}); }
function checkFinish(){
  for(const r of race.racers){ if(!r.finished && r.progress>=race.totalDistance){ r.finished=true; r.finishTime=(performance.now()-race.startedAt)/1000; }}
  const p = race.racers[race.playerIndex];
  if(p.finished || race.currentEventIndex >= race.eventQueue.length-1){ finishRace(); }
}
function finishRace(){
  if(!race.running) return;
  race.running=false;
  const state = race.state;
  const p = race.racers[race.playerIndex];
  const beforeSorted = [...race.racers].sort((a,b)=> b.progress-a.progress || (a.finishTime||9999)-(b.finishTime||9999));
  race.impact.beforePenalty = beforeSorted.findIndex(r=>r.type==='player')+1;
  if(state.setup.mode==='3' && race.stats.pitDone < 1){ race.stats.pitPenalty=true; addPenalty('Pit Stop Rule Violation',10); p.progress -= 10; }
  const afterReviewSorted = [...race.racers].sort((a,b)=> b.progress-a.progress || (a.finishTime||9999)-(b.finishTime||9999));
  race.impact.afterReview = afterReviewSorted.findIndex(r=>r.type==='player')+1;
  race.impact.afterAppeal = race.impact.afterReview;
  const sorted = afterReviewSorted;
  const position = sorted.findIndex(r=>r.type==='player')+1;
  race.impact.final = position;
  const time = p.finishTime || ((performance.now()-race.startedAt)/1000);
  const score = calcScore(position, time);
  const rank = score>=900?'S':score>=750?'A':score>=600?'B':score>=450?'C':'D';
  const result = { finished:true, position, time, score, rank, course:race.course.name, mode:state.setup.mode, difficulty:state.setup.difficulty, weather:state.setup.weather, tyres:[state.setup.startTyre, ...state.setup.tyreSets], contacts:race.stats.contacts, spins:race.stats.spins, penalties:race.stats.penalties, pitPenalty:race.stats.pitPenalty, pitPerfect:race.stats.pitPerfect, jumpStart:race.stats.jumpStart, startReaction:race.stats.startReaction, perfectCorners:race.stats.perfectCorners, log:race.log, impact:race.impact };
  const unlocked = race.testMode ? [] : evaluateAwards(result, state);
  if(!race.testMode) addRanking(state, {position,time,score,rank,course:result.course,mode:result.mode,difficulty:result.difficulty,weather:result.weather,tyres:result.tyres,penalties:result.penalties,contacts:result.contacts,appealResult:null});
  state.lastResult = {...result, unlockedAwards: unlocked.map(a=>a.id)};
  window.ASR.save(); window.ASR.renderResult(state.lastResult, unlocked);
}
function calcScore(position, time){
  let score = 400 - (position-1)*14;
  score += Math.max(0, 250 - race.currentEventIndex*1.1);
  score += Math.max(0, 150 - race.stats.contacts*28 - race.stats.spins*22);
  score += Math.max(0, 100 - race.stats.pitPenalty*80);
  score -= Math.min(100, race.stats.penalties*18);
  score -= Math.min(100, race.stats.contacts*20 + race.stats.spins*16);
  return Math.max(0, Math.min(1000, Math.round(score)));
}
function updateHud(event){
  const p = race?.racers?.[race.playerIndex]; if(!p) return;
  const sorted = [...race.racers].sort((a,b)=>b.progress-a.progress);
  const pos = sorted.findIndex(r=>r.type==='player')+1;
  const left = Math.max(0, race.eventQueue.length - Math.max(0,race.currentEventIndex+1));
  const detail = countRemainingEvents();
  document.getElementById('hud-position').textContent = `P${pos} / 22`;
  document.getElementById('hud-event').textContent = event;
  document.getElementById('hud-weather').textContent = race.state.setup.weather;
  const tyre=tyreById(p.currentTyre);
  const stateLabel = tyreState(p.tyreWear);
  const warn = tyreWarning(p, tyre);
  document.getElementById('hud-tyre').innerHTML = `${tyre.icon} ${tyre.name} / ${Math.round(p.tyreWear)}% / ${stateLabel}${warn?`<br><span class="tyre-warning">${warn}</span>`:''}`;
  document.getElementById('hud-events-left').innerHTML = `Events Left: ${left}<br>Corner:${detail.corner} ABC:${detail.abc} Pit:${detail.pit}`;
}
function tyreState(w){ if(w<=0) return 'ZERO'; if(w<20) return 'CRITICAL'; if(w<40) return 'WORN'; if(w<70) return 'USED'; return 'GOOD'; }
function tyreWarning(p, tyre){
  const weather=race.state.setup.weather;
  if(p.tyreWear<40) return 'PACE DOWN / PIT RECOMMENDED';
  if(weather==='light_rain' && ['ss','s','m','h'].includes(tyre.id)) return 'TYRE MISMATCH';
  if(weather==='dry' && ['i','r'].includes(tyre.id)) return 'TYRE MISMATCH';
  return '';
}
function countRemainingEvents(){
  const rest = race.eventQueue.slice(Math.max(0,race.currentEventIndex+1));
  return {
    corner: rest.filter(e=>e.type==='corner').length,
    abc: rest.filter(e=>e.type==='abc').length,
    pit: rest.filter(e=>e.type==='pit').length
  };
}
function renderProgress(){
  if(!race) return;
  const el = document.getElementById('progress-track');
  const sorted=[...race.racers].sort((a,b)=>b.progress-a.progress);
  const topIds = new Set(sorted.slice(0,3).map(r=>r.id));
  const pprog = race.racers[race.playerIndex].progress;
  el.innerHTML='<svg class="track-svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path class="track-line" d="M14,62 C18,16 46,10 66,22 C91,38 88,74 63,76 C47,94 17,88 14,62 Z"/><path class="track-glow" d="M14,62 C18,16 46,10 66,22 C91,38 88,74 63,76 C47,94 17,88 14,62 Z"/></svg><span class="map-label pit">PIT</span><span class="map-label abc1">ABC</span><span class="map-label abc2">ABC</span>';
  for(const r of race.racers){
    const m=document.createElement('span');
    let cls='map-marker';
    if(r.type==='player') cls+=' player'; else if(topIds.has(r.id)) cls+=' top'; else if(Math.abs(r.progress-pprog)<12) cls+=' near';
    m.className=cls; const pt = mapPoint((r.progress%race.totalDistance)/race.totalDistance);
    m.style.left=pt.x+'%'; m.style.top=pt.y+'%'; m.title=r.name; el.appendChild(m);
  }
  updateHud(document.getElementById('hud-event').textContent || 'Race');
}
function mapPoint(t){
  const a = t * Math.PI * 2 - Math.PI/2;
  const wobble = Math.sin(a*3) * 6;
  return { x: 50 + Math.cos(a)*38 + Math.sin(a*2)*5, y: 51 + Math.sin(a)*29 + wobble };
}
function feedback(quality){
  const view=document.getElementById('race-view');
  const q = quality==='PERFECT'?'perfect':quality==='GOOD'?'good':quality==='NORMAL'?'normal':'miss';
  view.classList.remove('feedback-perfect','feedback-good','feedback-normal','feedback-miss');
  void view.offsetWidth;
  view.classList.add(`feedback-${q}`);
  playSfx(race.state, quality==='PERFECT'?'perfect':quality==='GOOD'?'good':quality==='NORMAL'?'normal':quality==='LATE'?'late':'miss');
  if(navigator.vibrate){
    const vib = quality==='PERFECT'?[60,20,40]:quality==='GOOD'?[35]:quality==='NORMAL'?[18]:quality==='MISS'?[80,40,80]:[];
    if(vib.length) navigator.vibrate(vib);
  }
}
function showPauseMenu(){
  if(!race?.running) return;
  const menu=document.createElement('div'); menu.className='pause-menu';
  menu.innerHTML=`<div class="pause-card"><h2>Pause</h2><p class="muted">Offline prototype: quit has no rating penalty. Online version will reduce rating.</p><div class="button-grid"><button id="resume-race" class="primary">Resume</button><button id="quit-race" class="danger">Quit Race</button></div></div>`;
  document.body.appendChild(menu);
  document.getElementById('resume-race').onclick=()=>menu.remove();
  document.getElementById('quit-race').onclick=()=>{ menu.remove(); confirmQuit(); };
}
function confirmQuit(){
  const menu=document.createElement('div'); menu.className='pause-menu';
  menu.innerHTML=`<div class="pause-card"><h2>Quit Race?</h2><p class="muted">オフラインではペナルティなし。オンライン本番ではレーティング減点対象です。</p><div class="button-grid"><button id="quit-top">トップへ戻る</button><button id="quit-retry" class="primary">決勝だけ再走</button><button id="quit-cancel">キャンセル</button></div></div>`;
  document.body.appendChild(menu);
  document.getElementById('quit-top').onclick=()=>{ race.running=false; menu.remove(); window.ASR.nav('home'); };
  document.getElementById('quit-retry').onclick=()=>{ menu.remove(); startRace(race.state, race.onDone, race.testMode); };
  document.getElementById('quit-cancel').onclick=()=>menu.remove();
}
export function retryLastRace(state, onDone){ if(state.qualifying) startRace(state, onDone); }
