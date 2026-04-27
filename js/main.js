import { DATA } from './data.js';
import { loadState, saveState, resetSection } from './storage.js';
import { setLanguage, applyI18n, t, lang } from './i18n.js';
import { renderTyreSelectors, tyreBadges, tyreById } from './tyres.js';
import { startQualifying } from './qualifying.js';
import { startRace, retryLastRace } from './race.js';
import { renderAwards } from './awards.js';
import { renderRanking } from './ranking.js';
import { beep } from './sound.js';

let state = loadState();
window.ASR = { save:()=>saveState(state), renderResult };
const screens = ['home','setup','garage','tyres','qualifying','grid','weather','final','race','result','awards','rankings','settings','test'];
function nav(name){ screens.forEach(s=>document.getElementById(`screen-${s}`)?.classList.toggle('active', s===name)); if(name==='awards') renderAwards(state); if(name==='rankings') renderRanking(state, 'race'); if(name==='garage') renderTeams(); if(name==='tyres') renderTyreSelectors(state); if(name==='weather') renderWeather(); if(name==='final') renderFinal(); }
function modal(text, onOk){ const m=document.getElementById('modal'); document.getElementById('modal-text').textContent=text; m.classList.remove('hidden'); const ok=document.getElementById('modal-ok'); const cancel=document.getElementById('modal-cancel'); const close=()=>m.classList.add('hidden'); ok.onclick=()=>{ close(); onOk?.(); }; cancel.onclick=close; }
function syncControls(){
  setLanguage(state.settings.language); applyI18n();
  document.getElementById('language-select').value=state.settings.language; document.getElementById('volume-range').value=state.settings.volume; document.getElementById('mute-check').checked=state.settings.muted;
  document.getElementById('race-mode').value=state.setup.mode; document.getElementById('difficulty').value=state.setup.difficulty; document.getElementById('weather-select').value=state.setup.weather;
}
function wire(){
  document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>nav(b.dataset.nav)));
  document.getElementById('to-tyres').onclick=()=>{ saveSetup(); nav('tyres'); };
  document.getElementById('to-qualifying').onclick=()=>{ saveSetup(); nav('qualifying'); prepareQualifying(); };
  document.getElementById('grid-to-tyres').onclick=()=>nav('tyres');
  document.getElementById('weather-to-final').onclick=()=>nav('final');
  document.getElementById('race-start').onclick=()=>startRace(state, renderResult);
  document.getElementById('retry-race').onclick=()=>modal(lang()==='ja'?'同じ予選結果・同じ設定で決勝だけ再走します。よろしいですか？':'Retry race with the same grid and settings?',()=>retryLastRace(state, renderResult));
  document.getElementById('retry-qualifying-grid').onclick=retryQualifying;
  document.getElementById('retry-qualifying-final').onclick=retryQualifying;
  document.getElementById('language-select').onchange=e=>{state.settings.language=e.target.value; saveState(state); syncControls();};
  document.getElementById('volume-range').oninput=e=>{state.settings.volume=Number(e.target.value); saveState(state); beep(state,520);};
  document.getElementById('mute-check').onchange=e=>{state.settings.muted=e.target.checked; saveState(state);};
  document.getElementById('reset-settings').onclick=()=>modal('設定をリセットします。',()=>{state=resetSection(state,'settings'); syncControls();});
  document.getElementById('reset-rankings').onclick=()=>modal('ランキングをリセットします。',()=>{state=resetSection(state,'rankings');});
  document.getElementById('reset-awards').onclick=()=>modal('アワードをリセットします。',()=>{state=resetSection(state,'awards'); renderAwards(state);});
  document.getElementById('reset-last-result').onclick=()=>modal('直近リザルトをリセットします。',()=>{state.lastResult=null; saveState(state);});
  document.getElementById('reset-all').onclick=()=>modal('全データを初期化します。もう一度確認が必要です。',()=>modal('本当にすべて削除しますか？',()=>{state=resetSection(state,'all'); syncControls(); nav('home');}));
  document.getElementById('open-test-mode').onclick=()=>modal('テストモードを起動します。このモードではランキング保存・アワード解除は行われません。開始しますか？',()=>{renderTestMode(); nav('test');});
  document.getElementById('reset-test-checks').onclick=()=>modal('テストチェックをすべてリセットします。',()=>{state.testChecks={}; saveState(state); renderTestMode();});
  document.querySelectorAll('[data-rank-type]').forEach(b=>b.onclick=()=>renderRanking(state,b.dataset.rankType));
}
function saveSetup(){ state.setup.mode=document.getElementById('race-mode').value; state.setup.difficulty=document.getElementById('difficulty').value; state.setup.weather=document.getElementById('weather-select').value; saveState(state); }
function renderTeams(){ const el=document.getElementById('team-list'); el.innerHTML=DATA.teams.map(team=>`<button class="team-card ${state.player.teamId===team.id?'selected':''}" data-team="${team.id}"><b>${team.name}</b><br><span class="muted">${team.style}</span><div class="team-swatch"><span style="background:${team.main}"></span><span style="background:${team.sub}"></span><span style="background:${team.accent}"></span></div></button>`).join(''); el.querySelectorAll('[data-team]').forEach(b=>b.onclick=()=>{state.player.teamId=b.dataset.team; saveState(state); renderTeams();}); }
function prepareQualifying(){ const area=document.getElementById('qual-area'); area.innerHTML='<button id="qual-start" class="primary">START</button>'; document.getElementById('qual-score').textContent='0'; document.getElementById('qual-combo').textContent='0'; document.getElementById('qual-time').textContent='15.0'; document.getElementById('qual-start').onclick=()=>startQualifying(state,(grid)=>{saveState(state); renderGrid(grid); nav('grid');}); }
function renderGrid(grid){ const teamMap=Object.fromEntries(DATA.teams.map(t=>[t.id,t])); document.getElementById('grid-list').innerHTML=grid.map(d=>`<div class="grid-row ${d.type==='player'?'player':''}"><b>P${d.grid} ${d.flag} ${d.country} ${d.name}</b><br><span class="muted">${teamMap[d.teamId]?.name || '-'} / Q Score ${d.qScore}</span></div>`).join(''); }
function retryQualifying(){ modal(lang()==='ja'?'予選結果を破棄して、予選をやり直します。現在のスターティンググリッドはリセットされます。よろしいですか？':'Retry qualifying? Current starting grid will be reset.',()=>{state.qualifying=null; saveState(state); nav('qualifying'); prepareQualifying();}); }
function renderWeather(){ const w=state.setup.weather; const label = t(w); const rec = w==='dry'?'Soft / Medium / Hard':w==='damp'?'Medium / Intermediate / Soft':'Intermediate / Rain / Medium'; document.getElementById('weather-card').innerHTML=`<h3>${label}</h3><p>Track: ${w==='dry'?'Dry':w==='damp'?'Damp':'Wet'} / Track Temp: Normal</p><p>Official Tyre Allocation: ${rec}</p><label>${t('weather')}<select id="weather-select-final"><option value="dry">Dry / ドライ</option><option value="damp">Damp / ダンプ</option><option value="light_rain">Light Rain / 小雨</option></select></label><p class="muted">決勝直前まで天候変更可能。予選結果は保持します。</p>`; const sel=document.getElementById('weather-select-final'); sel.value=state.setup.weather; sel.onchange=e=>{state.setup.weather=e.target.value; document.getElementById('weather-select').value=e.target.value; saveState(state); renderWeather();}; }
function renderFinal(){ const course=DATA.courses[0]; const team=DATA.teams.find(t=>t.id===state.player.teamId); document.getElementById('final-card').innerHTML=`<p><b>${t('course')}</b>: ${course.name} / ${course.distance} cells / ${course.corners} corners</p><p><b>${t('mode')}</b>: ${state.setup.mode} Lap${state.setup.mode==='3'?'s / Pit stop required: 1':''}</p><p><b>${t('weather')}</b>: ${state.setup.weather}</p><p><b>${t('team')}</b>: ${team?.name}</p><p><b>${t('tyre')}</b>: Start ${tyreById(state.setup.startTyre).name}<br>${tyreBadges(state.setup.tyreSets)}</p>`; }
function renderResult(result, unlocked=[]){
  nav('result');
  const comment = result.score>=900?'完璧に近い走りです':result.score>=750?'速く安定したレースでした':result.score>=600?'良い走りです。精度を上げましょう':result.score>=450?'ミスでタイムを失っています':'まずはクリーン完走を目指しましょう';
  const log = (result.log||[]).map((l,i)=>`<li>${i+1}. ${l.text} ${l.penalty?`Penalty -${l.penalty} cells`:''}</li>`).join('') || '<li>No incidents.</li>';
  const awards = unlocked.length ? unlocked.map(a=>`<li>${lang()==='ja'?a.nameJa:a.nameEn} <span class="rarity">${'★'.repeat(a.rarity)}</span></li>`).join('') : '<li>-</li>';
  document.getElementById('result-card').innerHTML=`<h3>P${result.position} / 22</h3><p>${t('time')}: ${result.time.toFixed(2)}s</p><p>${t('score')}: <b>${result.score} / 1000</b> / ${t('rank')}: <b>${result.rank}</b></p><p class="muted">${comment}</p><p>Contacts: ${result.contacts} / Spins: ${result.spins} / Penalties: ${result.penalties}</p><h3>${t('unlockedAwards')}</h3><ul>${awards}</ul><h3>${t('raceControl')}</h3><ul>${log}</ul><p class="muted">Spec Version: 0.1.0 / Build: Initial ZIP Test</p>`;
}
function renderTestMode(){
  const items=['予選テスト','スタートテスト','コーナータップテスト','ピットテスト','ABC Zoneテスト','タイヤ消耗テスト','天候補正テスト','審議・抗議テスト','保存・リセット確認'];
  document.getElementById('test-checklist').innerHTML=items.map((name,i)=>`<label class="check-item"><input type="checkbox" data-test="t${i}" ${state.testChecks['t'+i]?'checked':''}>${name}</label>`).join('');
  document.querySelectorAll('[data-test]').forEach(c=>c.onchange=e=>{state.testChecks[e.target.dataset.test]=e.target.checked; saveState(state);});
}
if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{})); }
wire(); syncControls(); renderTeams(); renderTyreSelectors(state); nav('home');
