import { DATA } from './data.js';
import { lang } from './i18n.js';
export function evaluateAwards(result, state){
  const unlocked = [];
  const checks = {
    booby: result.position === 21,
    spin_master: result.spins >= 3,
    jump_start: result.jumpStart,
    finish_first: result.finished,
    contact_ok: result.contacts >= 2,
    pit_lost: result.pitPenalty,
    pit_master: result.pitPerfect,
    fast_start: result.startReaction !== null && result.startReaction <= 0.18,
    apex_hunter: result.perfectCorners >= 5,
    first_win: result.position === 1
  };
  for(const aw of DATA.awards){
    if(checks[aw.id] && !state.awards[aw.id]){ state.awards[aw.id] = { unlockedAt: new Date().toISOString() }; unlocked.push(aw); }
  }
  return unlocked;
}
export function renderAwards(state){
  const el = document.getElementById('awards-list'); if(!el) return;
  const isJa = lang()==='ja';
  el.innerHTML = DATA.awards.map(aw=>{
    const unlocked = !!state.awards[aw.id];
    const name = unlocked ? (isJa ? aw.nameJa : aw.nameEn) : '？？？？？？？？？';
    const desc = unlocked ? (isJa ? aw.descJa : aw.descEn) : 'Hidden Award';
    return `<div class="award-card ${unlocked?'':'locked'}"><b>${name}</b><div class="rarity">${'★'.repeat(aw.rarity)}${'☆'.repeat(5-aw.rarity)}</div><p class="muted">${desc}</p></div>`;
  }).join('');
}
