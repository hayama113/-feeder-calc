import { DATA } from './data.js';
export function tyreById(id){ return DATA.tyres.find(t=>t.id===id) || DATA.tyres[2]; }
export function renderTyreSelectors(state){
  const root = document.getElementById('tyre-selectors'); if(!root) return;
  const opts = DATA.tyres.map(t=>`<option value="${t.id}">${t.icon} ${t.name} / ${t.abbr}</option>`).join('');
  root.innerHTML = [0,1,2].map(i=>`<label>Set ${i+1}<select class="tyre-set" data-index="${i}">${opts}</select></label>`).join('') + `<label>Start Tyre<select id="start-tyre">${opts}</select></label>`;
  document.querySelectorAll('.tyre-set').forEach(sel=>{ sel.value = state.setup.tyreSets[Number(sel.dataset.index)] || 'm'; sel.addEventListener('change',()=>{ state.setup.tyreSets[Number(sel.dataset.index)] = sel.value; window.ASR.save(); }); });
  document.getElementById('start-tyre').value = state.setup.startTyre || state.setup.tyreSets[0];
  document.getElementById('start-tyre').addEventListener('change',e=>{ state.setup.startTyre=e.target.value; window.ASR.save(); });
}
export function tyreBadges(ids){ return ids.map(id=>{ const t=tyreById(id); return `<span class="tyre-badge" style="border-color:${t.color}">${t.icon} ${t.name}/${t.abbr}</span>`; }).join(''); }
export function getWeatherTyreMultiplier(weather, tyre){
  const wet = weather === 'damp' ? 0.55 : weather === 'light_rain' ? 1 : 0;
  if(!wet) return tyre.dryMod;
  return tyre.wetMod + (weather==='damp' && (tyre.id==='i'||tyre.id==='m') ? 0.02 : 0);
}
export function tapWindowByWeather(weather){
  if(weather==='dry') return {perfect:.18, good:.30, normal:.60, late:1.0};
  if(weather==='damp') return {perfect:.16, good:.27, normal:.52, late:.85};
  return {perfect:.14, good:.24, normal:.45, late:.75};
}
