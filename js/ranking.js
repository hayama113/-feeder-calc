export function addRanking(state, record){
  const base = {...record, savedAt: new Date().toISOString()};
  state.rankings.race.push(base); state.rankings.time.push(base); state.rankings.score.push(base);
  state.rankings.race = sortRace(state.rankings.race).slice(0,10);
  state.rankings.time = sortTime(state.rankings.time).slice(0,10);
  state.rankings.score = sortScore(state.rankings.score).slice(0,10);
}
function sortRace(a){ return [...a].sort((x,y)=> x.position-y.position || x.time-y.time || y.score-x.score); }
function sortTime(a){ return [...a].sort((x,y)=> x.time-y.time || x.position-y.position || y.score-x.score); }
function sortScore(a){ return [...a].sort((x,y)=> y.score-x.score || x.position-y.position || x.time-y.time); }
export function renderRanking(state, type='race'){
  const el = document.getElementById('ranking-list'); if(!el) return;
  const list = state.rankings[type] || [];
  if(!list.length){ el.innerHTML = '<div class="panel muted">No records yet.</div>'; return; }
  el.innerHTML = list.map((r,i)=>`<div class="rank-row"><b>#${i+1} P${r.position} / ${r.time.toFixed(2)}s / ${r.score}</b><br><span class="muted">${r.course} / ${r.mode} Lap / ${r.difficulty} / ${r.weather}</span><br><span>Tyres: ${r.tyres.join(' → ')} / Penalties: ${r.penalties} / Contacts: ${r.contacts} / Appeal: ${r.appealResult || '-'}</span></div>`).join('');
}
