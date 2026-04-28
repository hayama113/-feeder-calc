let ctx;
let musicTimer = null;
let musicScene = null;
let beat = 0;

function audio(){
  if(!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}
export function unlockAudio(state){
  if(state) state.settings.soundEnabled = !state.settings.muted;
  const a = audio();
  if(a.state === 'suspended') a.resume().catch(()=>{});
}
function canPlay(state){ return !!state?.settings?.soundEnabled && !state.settings.muted && Number(state.settings.volume) > 0; }
function tone(state, freq=440, ms=80, type='sine', gainMul=1){
  if(!canPlay(state)) return;
  const a = audio();
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, a.currentTime);
  gain.gain.setValueAtTime(Math.max(0.0001, Number(state.settings.volume) * 0.10 * gainMul), a.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + ms/1000);
  osc.connect(gain); gain.connect(a.destination); osc.start(); osc.stop(a.currentTime + ms/1000 + 0.03);
}
function noiseHit(state, ms=80, gainMul=.5){
  if(!canPlay(state)) return;
  const a = audio();
  const buffer = a.createBuffer(1, a.sampleRate * ms/1000, a.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i=0;i<data.length;i++) data[i] = (Math.random()*2-1) * Math.pow(1-i/data.length, 2);
  const src = a.createBufferSource(); const gain = a.createGain();
  src.buffer = buffer; gain.gain.value = Number(state.settings.volume) * 0.07 * gainMul;
  src.connect(gain); gain.connect(a.destination); src.start();
}
export function beep(state, freq=440, ms=80, type='sine'){ tone(state, freq, ms, type, 1); }
export function sequence(state, base=520){ [0,1,2].forEach(i=>setTimeout(()=>tone(state, base+i*80, 70, 'triangle', 1.05), i*90)); }
export function playSfx(state, name){
  if(name==='perfect'){ tone(state,880,80,'triangle',1.8); setTimeout(()=>tone(state,1320,90,'triangle',1.55),70); noiseHit(state,90,.7); return; }
  if(name==='good'){ tone(state,680,85,'triangle',1.15); setTimeout(()=>tone(state,920,65,'triangle',.95),65); return; }
  if(name==='normal'){ tone(state,520,80,'sine',.85); return; }
  if(name==='late'){ tone(state,250,110,'sawtooth',.85); return; }
  if(name==='miss'){ tone(state,120,150,'sawtooth',1.35); noiseHit(state,120,.55); return; }
  if(name==='warning'){ tone(state,180,110,'square',1.25); setTimeout(()=>tone(state,180,110,'square',1.25),150); return; }
  if(name==='award'){ [650,820,1040,1320].forEach((f,i)=>setTimeout(()=>tone(state,f,95,'triangle',1.35),i*95)); return; }
  if(name==='podium'){ [520,660,820,990,1320].forEach((f,i)=>setTimeout(()=>tone(state,f,120,'triangle',1.45),i*120)); noiseHit(state,220,.6); return; }
  if(name==='startLight'){ tone(state,280,70,'square',1.1); return; }
  if(name==='blackout'){ tone(state,90,180,'sawtooth',1.4); noiseHit(state,120,.5); return; }
  tone(state,440,80,'sine',1);
}
function musicStep(state, scene){
  if(!canPlay(state)) return;
  const volumeBase = scene==='race' ? 0.42 : scene==='qualifying' ? 0.30 : scene==='result' ? 0.24 : 0.25;
  const patterns = {
    home: [110,0,165,0,220,0,165,0],
    qualifying: [330,0,440,0,392,0,494,0],
    race: [82,0,123,0,98,0,146,0],
    result: [220,0,277,0,330,0,277,0]
  };
  const p = patterns[scene] || patterns.home;
  const f = p[beat % p.length];
  if(f){ tone(state, f, scene==='race'?90:140, scene==='race'?'sawtooth':'triangle', volumeBase); }
  if(scene==='race' && beat % 2 === 0) noiseHit(state, 35, .16);
  beat++;
}
export function startBgm(state, scene='home'){
  if(!state?.settings?.soundEnabled || state.settings.muted) return;
  if(musicScene === scene && musicTimer) return;
  stopBgm(); musicScene = scene; beat = 0;
  const bpm = scene==='race' ? 158 : scene==='qualifying' ? 132 : 104;
  const interval = Math.round(60000 / bpm / 2);
  musicTimer = setInterval(()=>musicStep(state, scene), interval);
  musicStep(state, scene);
}
export function stopBgm(){ if(musicTimer){ clearInterval(musicTimer); musicTimer=null; } musicScene=null; }
