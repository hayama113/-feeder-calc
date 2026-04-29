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
function safeVolume(state, mul=1){ return Math.max(0.0001, Number(state.settings.volume) * mul); }
function tone(state, freq=440, ms=80, type='sine', gainMul=1){
  if(!canPlay(state)) return;
  const a = audio();
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, a.currentTime);
  gain.gain.setValueAtTime(safeVolume(state, 0.10 * gainMul), a.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + ms/1000);
  osc.connect(gain); gain.connect(a.destination); osc.start(); osc.stop(a.currentTime + ms/1000 + 0.03);
}
function noiseHit(state, ms=80, gainMul=.5, hp=0){
  if(!canPlay(state)) return;
  const a = audio();
  const buffer = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * ms/1000)), a.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i=0;i<data.length;i++) data[i] = (Math.random()*2-1) * Math.pow(1-i/data.length, 2);
  const src = a.createBufferSource(); const gain = a.createGain();
  src.buffer = buffer; gain.gain.value = safeVolume(state, 0.07 * gainMul);
  if(hp){ const filter = a.createBiquadFilter(); filter.type='highpass'; filter.frequency.value=hp; src.connect(filter); filter.connect(gain); }
  else src.connect(gain);
  gain.connect(a.destination); src.start();
}
function polyChord(state, freqs, ms=180, type='sawtooth', gainMul=.35){
  if(!canPlay(state)) return;
  const a = audio();
  const bus = a.createGain();
  bus.gain.setValueAtTime(safeVolume(state, 0.018 * gainMul), a.currentTime);
  bus.gain.exponentialRampToValueAtTime(0.001, a.currentTime + ms/1000);
  bus.connect(a.destination);
  // 36 voices = 32和音以上のレーシング用コードレイヤー。
  const voices = [];
  for(let octave=0; octave<3; octave++){
    for(const f of freqs){
      for(const detune of [-7, 0, 7, 13]) voices.push({freq:f*Math.pow(2,octave), detune});
    }
  }
  voices.slice(0,36).forEach((v,i)=>{
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(v.freq, a.currentTime);
    osc.detune.setValueAtTime(v.detune, a.currentTime);
    gain.gain.setValueAtTime(1/Math.sqrt(voices.length), a.currentTime);
    osc.connect(gain); gain.connect(bus);
    osc.start(a.currentTime + i*0.0008);
    osc.stop(a.currentTime + ms/1000 + 0.02);
  });
}
export function beep(state, freq=440, ms=80, type='sine'){ tone(state, freq, ms, type, 1); }
export function sequence(state, base=520){ [0,1,2].forEach(i=>setTimeout(()=>tone(state, base+i*80, 70, 'triangle', 1.05), i*90)); }
export function playSfx(state, name){
  if(name==='perfect'){ tone(state,880,80,'triangle',1.8); setTimeout(()=>tone(state,1320,90,'triangle',1.55),70); noiseHit(state,90,.7,900); return; }
  if(name==='good'){ tone(state,680,85,'triangle',1.15); setTimeout(()=>tone(state,920,65,'triangle',.95),65); return; }
  if(name==='normal'){ tone(state,520,80,'sine',.85); return; }
  if(name==='late'){ tone(state,250,110,'sawtooth',.85); return; }
  if(name==='miss'){ tone(state,120,150,'sawtooth',1.35); noiseHit(state,120,.55,250); return; }
  if(name==='warning'){ tone(state,180,110,'square',1.25); setTimeout(()=>tone(state,180,110,'square',1.25),150); return; }
  if(name==='award'){ [650,820,1040,1320].forEach((f,i)=>setTimeout(()=>tone(state,f,95,'triangle',1.35),i*95)); return; }
  if(name==='podium'){ [520,660,820,990,1320].forEach((f,i)=>setTimeout(()=>tone(state,f,120,'triangle',1.45),i*120)); noiseHit(state,220,.6,500); return; }
  if(name==='startLight'){ tone(state,280,70,'square',1.1); return; }
  if(name==='blackout'){ tone(state,90,180,'sawtooth',1.4); noiseHit(state,120,.5,300); polyChord(state,[82,123,185],220,'sawtooth',.42); return; }
  tone(state,440,80,'sine',1);
}
function musicStep(state, scene){
  if(!canPlay(state)) return;
  if(scene==='race'){
    const bass = [82,82,98,82,123,110,98,73,82,82,146,123,98,110,73,82];
    const lead = [659,740,784,988,880,784,740,659,740,784,988,1175,988,880,784,740];
    const f = bass[beat % bass.length];
    tone(state, f, 105, beat%4===0?'square':'sawtooth', .62);
    if(beat % 2 === 0) tone(state, lead[beat % lead.length], 58, 'triangle', .38);
    if(beat % 4 === 2) tone(state, lead[(beat+5) % lead.length]*1.5, 48, 'sawtooth', .22);
    if(beat % 2 === 0) noiseHit(state, 36, .24, 850);
    if(beat % 4 === 0) noiseHit(state, 70, .38, 140);
    if(beat % 8 === 0) polyChord(state, [82,123,165], 260, 'sawtooth', .50);
    if(beat % 16 === 12) polyChord(state, [98,146,196], 220, 'square', .38);
    beat++; return;
  }
  const volumeBase = scene==='qualifying' ? 0.34 : scene==='result' ? 0.24 : 0.25;
  const patterns = {
    home: [110,0,165,0,220,0,165,0],
    qualifying: [330,0,440,0,392,0,494,0],
    result: [220,0,277,0,330,0,277,0]
  };
  const p = patterns[scene] || patterns.home;
  const f = p[beat % p.length];
  if(f){ tone(state, f, scene==='qualifying'?110:140, scene==='qualifying'?'sawtooth':'triangle', volumeBase); }
  if(scene==='qualifying' && beat % 4 === 0) polyChord(state,[330,392,494],140,'triangle',.22);
  beat++;
}
export function startBgm(state, scene='home'){
  if(!state?.settings?.soundEnabled || state.settings.muted) return;
  if(musicScene === scene && musicTimer) return;
  stopBgm(); musicScene = scene; beat = 0;
  const bpm = scene==='race' ? 176 : scene==='qualifying' ? 138 : 108;
  const interval = Math.round(60000 / bpm / 2);
  musicTimer = setInterval(()=>musicStep(state, scene), interval);
  musicStep(state, scene);
}
export function stopBgm(){ if(musicTimer){ clearInterval(musicTimer); musicTimer=null; } musicScene=null; }
