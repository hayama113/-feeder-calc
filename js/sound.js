let ctx;
function audio(){ if(!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); return ctx; }
export function beep(state, freq=440, ms=80, type='sine'){
  if(state.settings.muted || Number(state.settings.volume) <= 0) return;
  const a = audio(); const osc = a.createOscillator(); const gain = a.createGain();
  osc.type = type; osc.frequency.value = freq; gain.gain.value = Number(state.settings.volume) * 0.12;
  osc.connect(gain); gain.connect(a.destination); osc.start();
  gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + ms/1000); osc.stop(a.currentTime + ms/1000 + 0.02);
}
export function sequence(state, base=520){ [0,1,2].forEach(i=>setTimeout(()=>beep(state, base+i*80, 70, 'triangle'), i*90)); }
