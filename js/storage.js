const STORAGE_KEY = 'asr_pwa_v010_state';
const DEFAULT_STATE = {
  settings: {
    language: (navigator.language || 'en').startsWith('ja') ? 'ja' : 'en',
    volume: 0.35,
    muted: false,
    soundPrompted: false,
    soundEnabled: false
  },
  player: { name: 'You', teamId: 'redline' },
  setup: { mode: '1', difficulty: 'B', weather: 'dry', tyreSets: ['m','s','h'], startTyre: 'm' },
  qualifying: null,
  lastResult: null,
  awards: {},
  rankings: { race: [], time: [], score: [] },
  testChecks: {}
};
export function loadState(){
  try { return merge(DEFAULT_STATE, JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); }
  catch { return structuredClone(DEFAULT_STATE); }
}
function merge(base, patch){
  const out = Array.isArray(base) ? [...base] : {...base};
  if (!patch || typeof patch !== 'object') return out;
  for (const [k,v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k]) out[k] = merge(base[k], v);
    else out[k] = v;
  }
  return out;
}
export function saveState(state){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
export function resetSection(state, section){
  if(section === 'all') { localStorage.removeItem(STORAGE_KEY); return loadState(); }
  state[section] = structuredClone(DEFAULT_STATE[section]); saveState(state); return state;
}
export function defaultState(){ return structuredClone(DEFAULT_STATE); }
