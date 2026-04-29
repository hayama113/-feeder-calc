import { DATA } from './data.js';
import { loadState, saveState, resetSection } from './storage.js';
import { setLanguage, applyI18n, t, lang } from './i18n.js';
import { renderTyreSelectors, tyreBadges, tyreById } from './tyres.js';
import { startQualifying } from './qualifying.js';
import { startRace } from './race.js';
import { renderAwards } from './awards.js';
import { renderRanking } from './ranking.js';
import { beep, unlockAudio, startBgm, stopBgm, playSfx } from './sound.js';

let state = loadState();
let lastUnlocked = [];
const screens = ['home','setup','garage','tyres','qualifying','grid','weather','final','race','result','showcase','awards','rankings','settings','test'];
window.ASR = { save:()=>saveState(state), renderResult, nav };

function nav(name){
  if(name==='qualifying') prepareQualifying();
  screens.forEach(s=>document.getElementById(`screen-${s}`)?.classList.toggle('active', s===name));
  if(name==='awards') renderAwards(state);
  if(name==='rankings') renderRanking(state, 'race');
  if(name==='garage') renderTeams();
  if(name==='tyres'){ renderTyreSelectors(state); updateTyreNextButton(); }
  if(name==='weather') renderWeather();
  if(name==='final') renderFinal();
  startBgmForScreen(name);
}
function startBgmForScreen(name){
  if(['home','setup','garage','settings','tyres','weather','final'].includes(name)) startBgm(state,'home');
  else if(name==='qualifying') startBgm(state,'qualifying');
  else if(name==='result' || name==='showcase' || name==='awards' || name==='rankings') startBgm(state,'result');
}
function updateTyreNextButton(){
  const btn=document.getElementById('to-qualifying'); if(!btn) return;
  btn.textContent = lang()==='ja'?'予選開始':'Start Qualifying';
}
function modal(text, onOk, onCancel){
  const m=document.getElementById('modal'); document.getElementById('modal-text').textContent=text; m.classList.remove('hidden');
  const ok=document.getElementById('modal-ok'); const cancel=document.getElementById('modal-cancel');
  const close=()=>m.classList.add('hidden');
  ok.onclick=()=>{ close(); onOk?.(); };
  cancel.onclick=()=>{ close(); onCancel?.(); };
}
function syncControls(){
  setLanguage(state.settings.language); applyI18n();
  document.getElementById('language-select').value=state.settings.language;
  document.getElementById('volume-range').value=state.settings.volume;
  document.getElementById('mute-check').checked=state.settings.muted;
  document.getElementById('race-mode').value=state.setup.mode;
  document.getElementById('difficulty').value=state.setup.difficulty;
  document.getElementById('weather-select').value=state.setup.weather;
}
function wire(){
  document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>{ if(b.dataset.nav==='setup'){ state.qualifying=null; saveState(state); } nav(b.dataset.nav); }));
  document.getElementById('to-tyres').onclick=()=>{ saveSetup(); nav('tyres'); };
  document.getElementById('to-qualifying').onclick=()=>{
    saveSetup();
    state.qualifying=null;
    saveState(state);
    nav('qualifying');
  };
  document.getElementById('grid-to-tyres').onclick=()=>nav('weather');
  document.getElementById('weather-to-final').onclick=()=>nav('final');
  document.getElementById('race-start').onclick=()=>startRace(state, renderResult);
  document.getElementById('retry-race').onclick=()=>modal(lang()==='ja'?'再走は毎回、予選から開始します。よろしいですか？':'Retry from qualifying?',()=>{ state.qualifying=null; saveState(state); nav('qualifying'); });
  document.getElementById('retry-qualifying-grid').onclick=retryQualifying;
  document.getElementById('retry-qualifying-final').onclick=retryQualifying;
  document.getElementById('continue-showcase').onclick=()=>startPostRaceShow();
  document.getElementById('language-select').onchange=e=>{state.settings.language=e.target.value; saveState(state); syncControls();};
  document.getElementById('volume-range').oninput=e=>{state.settings.volume=Number(e.target.value); saveState(state); beep(state,520); startBgmForScreen(currentScreen());};
  document.getElementById('mute-check').onchange=e=>{state.settings.muted=e.target.checked; state.settings.soundEnabled=!e.target.checked; saveState(state); if(e.target.checked) stopBgm(); else { unlockAudio(state); startBgmForScreen(currentScreen()); }};
  document.getElementById('reset-settings').onclick=()=>modal('設定をリセットします。',()=>{state=resetSection(state,'settings'); syncControls();});
  document.getElementById('reset-rankings').onclick=()=>modal('ランキングをリセットします。',()=>{state=resetSection(state,'rankings');});
  document.getElementById('reset-awards').onclick=()=>modal('アワードをリセットします。',()=>{state=resetSection(state,'awards'); renderAwards(state);});
  document.getElementById('reset-last-result').onclick=()=>modal('直近リザルトをリセットします。',()=>{state.lastResult=null; saveState(state);});
  document.getElementById('reset-all').onclick=()=>modal('全データを初期化します。もう一度確認が必要です。',()=>modal('本当にすべて削除しますか？',()=>{state=resetSection(state,'all'); syncControls(); nav('home');}));
  document.getElementById('open-test-mode').onclick=()=>modal('テストモードを起動します。このモードではランキング保存・アワード解除は行われません。開始しますか？',()=>{renderTestMode(); nav('test');});
  document.getElementById('reset-test-checks').onclick=()=>modal('テストチェックをすべてリセットします。',()=>{state.testChecks={}; saveState(state); renderTestMode();});
  document.querySelectorAll('[data-rank-type]').forEach(b=>b.onclick=()=>renderRanking(state,b.dataset.rankType));
}
function currentScreen(){ const active=[...document.querySelectorAll('.screen')].find(s=>s.classList.contains('active')); return active?.id?.replace('screen-','') || 'home'; }
function promptSoundIfNeeded(){
  if(state.settings.soundPrompted) return;
  modal(lang()==='ja'?'音を有効にしますか？\nBGMと効果音を再生します。':'Enable sound?\nBGM and sound effects will play.',()=>{
    state.settings.soundPrompted=true; state.settings.soundEnabled=true; state.settings.muted=false; saveState(state); syncControls(); unlockAudio(state); startBgm(state,'home');
  },()=>{
    state.settings.soundPrompted=true; state.settings.soundEnabled=false; state.settings.muted=true; saveState(state); syncControls();
  });
}
function saveSetup(){ state.setup.mode=document.getElementById('race-mode').value; state.setup.difficulty=document.getElementById('difficulty').value; state.setup.weather=document.getElementById('weather-select').value; saveState(state); }
function renderTeams(){
  const el=document.getElementById('team-list');
  el.innerHTML=DATA.teams.map(team=>`<button class="team-card ${state.player.teamId===team.id?'selected':''}" data-team="${team.id}"><b>${team.name}</b><br><span class="muted">${team.style}</span><div class="team-swatch"><span style="background:${team.main}"></span><span style="background:${team.sub}"></span><span style="background:${team.accent}"></span></div></button>`).join('');
  el.querySelectorAll('[data-team]').forEach(b=>b.onclick=()=>{state.player.teamId=b.dataset.team; saveState(state); renderTeams();});
}
function prepareQualifying(){
  const area=document.getElementById('qual-area');
  area.innerHTML=`<div class="qual-start-wrap"><div class="qual-start-card"><div class="mini-lights"><span></span><span></span><span></span><span></span><span></span></div><p class="muted">${lang()==='ja'?'制限時間内に光る○をタップしてグリッドを決めます。':'Tap the glowing circles before time runs out to set your grid.'}</p><button id="qual-start" class="primary">${lang()==='ja'?'予選開始':'Start Qualifying'}</button></div></div>`;
  document.getElementById('qual-score').textContent='0'; document.getElementById('qual-combo').textContent='0'; document.getElementById('qual-time').textContent='15.0';
  document.getElementById('qual-start').onclick=()=>startQualifying(state,(grid)=>{saveState(state); renderGrid(grid); nav('grid');});
}
function renderGrid(grid){
  const teamMap=Object.fromEntries(DATA.teams.map(t=>[t.id,t]));
  document.getElementById('grid-list').innerHTML=grid.map(d=>`<div class="grid-row ${d.type==='player'?'player':''}"><b>P${d.grid} ${d.flag} ${d.country} ${d.name}</b><br><span class="muted">${teamMap[d.teamId]?.name || '-'} / Q Score ${d.qScore}</span></div>`).join('');
}
function retryQualifying(){ modal(lang()==='ja'?'予選結果を破棄して、予選をやり直します。現在のスターティンググリッドはリセットされます。よろしいですか？':'Retry qualifying? Current starting grid will be reset.',()=>{state.qualifying=null; saveState(state); nav('qualifying'); prepareQualifying();}); }
function renderWeather(){
  const w=state.setup.weather; const label = t(w); const rec = w==='dry'?'Soft / Medium / Hard':w==='damp'?'Medium / Intermediate / Soft':'Intermediate / Rain / Medium';
  document.getElementById('weather-card').innerHTML=`<h3>${label}</h3><p>Track: ${w==='dry'?'Dry':w==='damp'?'Damp':'Wet'} / Track Temp: Normal</p><p>Official Tyre Allocation: ${rec}</p><label>${t('weather')}<select id="weather-select-final"><option value="dry">Dry / ドライ</option><option value="damp">Damp / ダンプ</option><option value="light_rain">Light Rain / 小雨</option></select></label><p class="muted">決勝直前まで天候変更可能。予選結果は保持します。</p>`;
  const sel=document.getElementById('weather-select-final'); sel.value=state.setup.weather;
  sel.onchange=e=>{state.setup.weather=e.target.value; document.getElementById('weather-select').value=e.target.value; saveState(state); renderWeather();};
}
function renderFinal(){
  const course=DATA.courses[0]; const team=DATA.teams.find(t=>t.id===state.player.teamId);
  const exchange = state.setup.exchangeTyre || state.setup.tyreSets?.[0] || 'm';
  document.getElementById('final-card').innerHTML=`<p><b>${t('course')}</b>: ${course.name} / ${course.distance} cells / ${course.corners} corners</p><p><b>${t('mode')}</b>: ${state.setup.mode} Lap${state.setup.mode==='3'?'s / Pit stop required: 1':''}</p><p><b>${t('weather')}</b>: ${state.setup.weather}</p><p><b>${t('team')}</b>: ${team?.name}</p><p><b>${t('tyre')}</b>: Start ${tyreById(state.setup.startTyre).name}<br>Exchange ${tyreBadges([exchange])}</p>`;
}
function renderResult(result, unlocked=[]){
  lastUnlocked = unlocked || [];
  nav('result'); playSfx(state,'warning');
  const comment = result.score>=900?'完璧に近い走りです':result.score>=750?'速く安定したレースでした':result.score>=600?'良い走りです。精度を上げましょう':result.score>=450?'ミスでタイムを失っています':'まずはクリーン完走を目指しましょう';
  const impact = result.impact || {beforePenalty:result.position,afterReview:result.position,afterAppeal:result.position,final:result.position};
  const log = (result.log||[]).map((l,i)=>`<li>${i+1}. ${l.text} ${l.penalty?`Penalty -${l.penalty} cells`:''}</li>`).join('') || '<li>No incidents.</li>';
  const awards = unlocked.length ? unlocked.map(a=>`<li>${lang()==='ja'?a.nameJa:a.nameEn} <span class="rarity">${'★'.repeat(a.rarity)}</span></li>`).join('') : '<li>-</li>';
  document.getElementById('continue-showcase').style.display = (result.position<=3 || unlocked.length) ? '' : 'none';
  document.getElementById('result-card').innerHTML=`<h3>P${result.position} / 22</h3><p>${t('time')}: ${result.time.toFixed(2)}s</p><p>${t('score')}: <b>${result.score} / 1000</b> / ${t('rank')}: <b>${result.rank}</b></p><p class="muted">${comment}</p><p>Contacts: ${result.contacts} / Spins: ${result.spins} / Penalties: ${result.penalties}</p><div class="tabs"><button class="active" id="tab-impact">${lang()==='ja'?'順位変動':'Race Impact'}</button><button id="tab-log">${lang()==='ja'?'詳細ログ':'Control Log'}</button></div><div id="result-tab-body" class="impact-card"></div><h3>${t('unlockedAwards')}</h3><ul>${awards}</ul><p class="muted">Spec Version: 0.2.0 / Build: Racing UI + Corner Tap</p>`;
  const body=document.getElementById('result-tab-body');
  const renderImpact=()=>{ document.getElementById('tab-impact').classList.add('active'); document.getElementById('tab-log').classList.remove('active'); body.className='impact-card'; body.innerHTML=`<p>${lang()==='ja'?'ペナルティ前':'Before Penalty'}: P${impact.beforePenalty ?? result.position}</p><p>${lang()==='ja'?'審議後':'After Review'}: P${impact.afterReview ?? result.position}</p><p>${lang()==='ja'?'抗議後':'After Appeal'}: P${impact.afterAppeal ?? result.position}</p><p><b>${lang()==='ja'?'最終順位':'Final Position'}: P${impact.final ?? result.position}</b></p>`; };
  const renderLog=()=>{ document.getElementById('tab-log').classList.add('active'); document.getElementById('tab-impact').classList.remove('active'); body.className='log-card'; body.innerHTML=`<ul>${log}</ul>`; };
  document.getElementById('tab-impact').onclick=renderImpact; document.getElementById('tab-log').onclick=renderLog; renderImpact();
}
function startPostRaceShow(){
  const result = state.lastResult; if(!result){ nav('result'); return; }
  const unlocked = (lastUnlocked && lastUnlocked.length) ? lastUnlocked : DATA.awards.filter(a=>result.unlockedAwards?.includes(a.id));
  const items=[];
  if(result.position<=3) items.push({type:'podium', result});
  for(const aw of unlocked) items.push({type:'award', award:aw});
  if(!items.length){ nav('result'); return; }
  showItem(items,0);
}
function showItem(items, index){
  nav('showcase');
  const root=document.getElementById('showcase-root'); const item=items[index];
  if(item.type==='podium'){
    playSfx(state,'podium');
    root.innerHTML=`<div class="show-card confetti"><button class="skip-btn" id="skip-show">Skip</button><div class="big">PODIUM FINISH</div><p class="muted">P${item.result.position} / Champagne Fight</p><div class="podium-box"><div class="podium-step p2">2</div><div class="podium-step p1">1</div><div class="podium-step p3">3</div></div><div class="champagne">🍾 ✦ ✦</div></div>${showActions(index,items.length)}`;
  } else {
    const aw=item.award; playSfx(state,'award');
    const anim = aw.id.includes('spin') ? 'spin' : aw.id.includes('apex') ? 'apex' : 'flash';
    root.innerHTML=`<div class="show-card confetti"><button class="skip-btn" id="skip-show">Skip</button><div class="big">AWARD UNLOCKED</div><p class="muted">${'★'.repeat(aw.rarity)}${'☆'.repeat(5-aw.rarity)}</p><div class="award-anim ${anim}" style="font-size:76px;margin:28px auto">🏁</div><h2>${lang()==='ja'?aw.nameJa:aw.nameEn}</h2><p>${lang()==='ja'?aw.descJa:aw.descEn}</p></div>${showActions(index,items.length)}`;
  }
  document.getElementById('skip-show').onclick=()=>nav('result');
  document.getElementById('show-prev').onclick=()=> index>0 ? showItem(items,index-1) : nav('result');
  document.getElementById('show-next').onclick=()=> index<items.length-1 ? showItem(items,index+1) : nav('result');
}
function showActions(index,total){ return `<div class="show-actions"><button id="show-prev">${index===0?'Result':'Back'}</button><button id="show-next" class="primary">${index<total-1?'Next':'Result'}</button><button onclick="window.ASR.nav('result')">Result</button></div>`; }
function renderTestMode(){
  const items=['予選テスト','スタートテスト','コーナータップテスト','ピットテスト','ABC Zoneテスト','タイヤ消耗テスト','天候補正テスト','審議・抗議テスト','保存・リセット確認'];
  document.getElementById('test-checklist').innerHTML=items.map((name,i)=>`<label class="check-item"><input type="checkbox" data-test="t${i}" ${state.testChecks['t'+i]?'checked':''}>${name}</label>`).join('');
  document.querySelectorAll('[data-test]').forEach(c=>c.onchange=e=>{state.testChecks[e.target.dataset.test]=e.target.checked; saveState(state);});
}
if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{})); }
wire(); syncControls(); renderTeams(); renderTyreSelectors(state); nav('home'); setTimeout(promptSoundIfNeeded, 500);
