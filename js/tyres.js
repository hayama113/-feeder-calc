import { DATA } from './data.js';
export function tyreById(id){ return DATA.tyres.find(t=>t.id===id) || DATA.tyres[2]; }
export function renderTyreSelectors(state){
  const root = document.getElementById('tyre-selectors'); if(!root) return;
  const opts = DATA.tyres.map(t=>`<option value="${t.id}">${t.icon} ${t.name} / ${t.abbr}</option>`).join('');
  const exchange = state.setup.exchangeTyre || state.setup.tyreSets?.[0] || 's';
  state.setup.startTyre = state.setup.startTyre || 'm';
  state.setup.exchangeTyre = exchange;
  state.setup.tyreSets = [exchange];
  root.innerHTML = `
    <label>Start Tyre / スタートタイヤ<select id="start-tyre">${opts}</select></label>
    <label>Exchange Tyre / 交換タイヤ<select id="exchange-tyre">${opts}</select></label>
    <p class="muted tyre-note">ピットイン時は交換タイヤへ1回交換します。複数セット選択は廃止しました。</p>
  `;
  document.getElementById('start-tyre').value = state.setup.startTyre;
  document.getElementById('exchange-tyre').value = state.setup.exchangeTyre;
  document.getElementById('start-tyre').addEventListener('change',e=>{ state.setup.startTyre=e.target.value; window.ASR.save(); });
  document.getElementById('exchange-tyre').addEventListener('change',e=>{ state.setup.exchangeTyre=e.target.value; state.setup.tyreSets=[e.target.value]; window.ASR.save(); });
  window.ASR.save();
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
