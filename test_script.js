

const TRACKS = [
  {n:0,id:"FijiPMjRtWA",file:"00_opening_closing.webm",skip:0},
  {n:1,id:"v84ZYg0mDyg",file:"01_v84ZYg0mDyg.webm"},{n:2,id:"p3T2ST7sfSA",file:"02_p3T2ST7sfSA.webm"},
  {n:3,id:"bQKSTm4fcyE",file:"03_bQKSTm4fcyE.webm"},{n:4,id:"dR9B_gPxjkk",file:"04_dR9B_gPxjkk.webm"},
  {n:5,id:"WcuwdItUHFI",file:"05_WcuwdItUHFI.webm"},{n:6,id:"16y1AkoZkmQ",file:"06_16y1AkoZkmQ.webm"},
  {n:7,id:"tSi6Dn1H36Y",file:"07_tSi6Dn1H36Y.webm"},{n:8,id:"6QBy_Oa5ZmM",file:"08_6QBy_Oa5ZmM.webm"},
  {n:9,id:"VkoXNF01HdM",file:"09_VkoXNF01HdM.webm"},{n:10,id:"HUqf84AZ0mM",file:"10_HUqf84AZ0mM.webm"},
  {n:11,id:"vCEvCXuglqo",file:"11_vCEvCXuglqo.webm"},{n:12,id:"vx2u5uUu3DE",file:"12_vx2u5uUu3DE.webm"},
  {n:13,id:"9jK-NcRmVcw",file:"13_9jK-NcRmVcw.webm"},{n:14,id:"UQ6LGrr8iEg",file:"14_UQ6LGrr8iEg.webm"},
  {n:15,id:"llyiQ4I-mcQ",file:"15_llyiQ4I-mcQ.webm"},{n:16,id:"6Zbi0XmGtMw",file:"16_6Zbi0XmGtMw.webm"},
  {n:17,id:"x4maoo4A3x4",file:"17_x4maoo4A3x4.webm"},{n:18,id:"-tJYN-eG1zk",file:"18_-tJYN-eG1zk.webm"},
  {n:19,id:"9C3eTrcjBYU",file:"19_9C3eTrcjBYU.webm"},{n:20,id:"kCXOuYGKSoo",file:"20_kCXOuYGKSoo.webm"},
  {n:21,id:"zMs-VMzDCtE",file:"21_zMs-VMzDCtE.webm"},{n:22,id:"Tfi3oWgZp1Y",file:"22_Tfi3oWgZp1Y.webm"},
  {n:23,id:"hBT1gbs6xpg",file:"23_hBT1gbs6xpg.webm"},{n:24,id:"RISXVCxMQtM",file:"24_RISXVCxMQtM.webm"},
  {n:25,id:"UR-r3xNX1sU",file:"25_UR-r3xNX1sU.webm"},{n:26,id:"Eo9hZz3oizk",file:"26_Eo9hZz3oizk.webm"},
  {n:27,id:"DEOABYWiJd4",file:"27_DEOABYWiJd4.webm"},{n:28,id:"CG-I7aNLh04",file:"28_CG-I7aNLh04.webm"},
  {n:29,id:"qwnSAPl2wl0",file:"29_qwnSAPl2wl0.webm"},{n:30,id:"_rGo1s6iEjc",file:"30__rGo1s6iEjc.webm"},
  {n:31,id:"GTk3vz-KDq4",file:"31_GTk3vz-KDq4.webm"},{n:32,id:"CBUQRI9NUow",file:"32_CBUQRI9NUow.webm"},
  {n:33,id:"5dWeeUIZFgA",file:"33_5dWeeUIZFgA.webm"},{n:34,id:"EgmXTmj62ic",file:"34_EgmXTmj62ic.webm"},
  {n:35,id:"CMY3lppK124",file:"35_CMY3lppK124.webm"},{n:36,id:"s_HTAQoHIF0",file:"36_s_HTAQoHIF0.webm"},
  {n:37,id:"LLpldGBqpgM",file:"37_LLpldGBqpgM.webm"},{n:38,id:"TOwI70KWSrw",file:"38_TOwI70KWSrw.webm"},
  {n:39,id:"giA1Y3VB3CM",file:"39_giA1Y3VB3CM.webm"},{n:40,id:"S3ToKKawk_A",file:"40_S3ToKKawk_A.webm"},
  {n:41,id:"oRmg3Q9qFLw",file:"41_oRmg3Q9qFLw.webm"},{n:42,id:"Bbwcg0-JHjY",file:"42_Bbwcg0-JHjY.webm"},
  {n:43,id:"tbbum13VHSk",file:"43_tbbum13VHSk.webm"},{n:44,id:"2gjt_-Lw5Ak",file:"44_2gjt_-Lw5Ak.webm"},
  {n:45,id:"L-kKWXZ5wwc",file:"45_L-kKWXZ5wwc.webm"},{n:46,id:"cKyxTcwkvJc",file:"46_cKyxTcwkvJc.webm"},
  {n:47,id:"Np29xQZiCQk",file:"47_Np29xQZiCQk.webm"},{n:48,id:"2qCpY38ompo",file:"48_2qCpY38ompo.webm"},
  {n:49,id:"ufHLYw9q7vQ",file:"49_ufHLYw9q7vQ.webm"},{n:50,id:"Jn5hsfbhWx4",file:"50_Jn5hsfbhWx4.webm"},
  {n:51,id:"ZadVivopeKk",file:"51_ZadVivopeKk.webm"},{n:52,id:"xdAJc8aEnjg",file:"52_xdAJc8aEnjg.webm"},
  {n:53,id:"MzRJJRu0o2E",file:"53_MzRJJRu0o2E.webm"},{n:54,id:"zpsVpnvFfZQ",file:"54_zpsVpnvFfZQ.webm"},
  {n:55,id:"ekr2nIex040",file:"55_ekr2nIex040.webm"},{n:56,id:"Ppo3oPo4NYw",file:"56_Ppo3oPo4NYw.webm"},
  {n:57,id:"fRD_3vJagxk",file:"57_fRD_3vJagxk.webm"},
  {n:58,id:"FijiPMjRtWA",file:"00_opening_closing.webm",skip:0}
];

const MUSIC_BASE = "/music/party_29may/";
const TRANSITION_SEC   = 4;
const TRIGGER_BEFORE   = 5;
const SKIP_INTRO_SEC   = 45;
const SNIPPET_LEN_SEC  = 35;
let   AUTO_MIX         = true;
let   FESTIVAL_FX      = true;
let   SNIPPET_MODE     = true;
let currentTrackPlayStart = 0;

let ctx = null, masterAnalyser = null, bgVisualizerCtx = null;
const decks = { A: { cues: [null, null, null, null] }, B: { cues: [null, null, null, null] } };
let masterGain, masterBassBoost, masterDrive, masterEQ_Low, masterEQ_High, masterLimiter;
let darbukaBuffer = null, chendaBuffer = null;
let startTime = Date.now();
let currentIdx = 0, nextIdx = 1;
let bLoaded = false, mixing = false;
let globalEchoDelay, globalEchoFeedback, globalEchoReturn;
let tapeStopRaf = null;
let mixTimeoutId = null;
let mixIntervalId = null;

let bgBeatInterval = null;
let bgBeatBpm = 128.0;
let nextBgBeatTime = 0;
let tapTimes = [];

let masterDest = null;
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;

let waveDataA = [];
let waveDataB = [];

function $(id) { return document.getElementById(id); }

function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = ctx.createGain();
  masterGain.gain.value = 1.0;
  
  masterAnalyser = ctx.createAnalyser();
  masterAnalyser.fftSize = 256;
  masterGain.connect(masterAnalyser);
  masterAnalyser.connect(ctx.destination);
  
  try {
    masterDest = ctx.createMediaStreamDestination();
    masterGain.connect(masterDest);
    mediaRecorder = new MediaRecorder(masterDest.stream, { mimeType: 'audio/webm' });
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'audio/webm' });
        recordedChunks = [];
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PulseMix_Live_Set_${new Date().toISOString().slice(0,10)}.webm`;
        a.click();
    };
  } catch (err) {
    console.warn("Recording not supported in this browser:", err);
  }
  
  bgVisualizerCtx = $("bgVisualizer").getContext("2d");

  for (const k of ["A", "B"]) {
    const audio = $("audio" + k);
    const src = ctx.createMediaElementSource(audio);
    const low  = ctx.createBiquadFilter(); low.type  = "lowshelf";  low.frequency.value = 200;
    const mid  = ctx.createBiquadFilter(); mid.type  = "peaking";   mid.frequency.value = 1000; mid.Q.value = 1;
    const high = ctx.createBiquadFilter(); high.type = "highshelf"; high.frequency.value = 4000;
    const hpf  = ctx.createBiquadFilter(); hpf.type  = "highpass";  hpf.frequency.value = 20;
    const lpf  = ctx.createBiquadFilter(); lpf.type  = "lowpass";   lpf.frequency.value = 20000;
    const gain = ctx.createGain(); gain.gain.value = (k === "A" ? 1 : 0);
    const analyser = ctx.createAnalyser(); analyser.fftSize = 256;
    src.connect(low); low.connect(mid); mid.connect(high);
    high.connect(hpf); hpf.connect(lpf); lpf.connect(gain);
    gain.connect(analyser);
    decks[k] = { ...decks[k], audio, src, low, mid, high, hpf, lpf, gain, analyser };
  }
  
  globalEchoDelay = ctx.createDelay(2.0);
  globalEchoDelay.delayTime.value = 0.375;
  globalEchoFeedback = ctx.createGain();
  globalEchoFeedback.gain.value = 0.55;
  globalEchoReturn = ctx.createGain();
  globalEchoReturn.gain.value = 0;
  
  globalEchoDelay.connect(globalEchoFeedback);
  globalEchoFeedback.connect(globalEchoDelay);
  globalEchoDelay.connect(globalEchoReturn);
  globalEchoReturn.connect(masterGain);

  decks.A.analyser.connect(masterGain);
  decks.A.analyser.connect(globalEchoDelay);
  decks.B.analyser.connect(masterGain);
  decks.B.analyser.connect(globalEchoDelay);
  
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  oscGain.gain.value = 0;
  osc.connect(oscGain);
  oscGain.connect(masterGain);
  osc.start();
}


function handleHotCue(deckKey, idx, e) {
  if (e.button === 2 || e.shiftKey) {
    decks[deckKey].cues[idx] = null;
  } else {
    if (decks[deckKey].cues[idx] === null) {
      const audio = document.getElementById("audio" + deckKey);
      if (audio.duration) { decks[deckKey].cues[idx] = audio.currentTime; }
    } else {
      const audio = document.getElementById("audio" + deckKey);
      audio.currentTime = decks[deckKey].cues[idx];
      if (audio.paused) { 
        audio.play().catch(()=>{}); 
        document.getElementById(deckKey.toLowerCase() + "Play").textContent = "PAUSE"; 
      }
    }
  }
  renderHotCues(deckKey);
}

function renderHotCues(deckKey) {
  const deckCues = decks[deckKey].cues;
  const waveEl = document.getElementById(deckKey.toLowerCase() + "Wave").parentElement;
  waveEl.querySelectorAll('.cue-marker').forEach(el => el.remove());
  const audio = document.getElementById("audio" + deckKey);
  const duration = audio.duration || 1;
  for (let i = 0; i < 4; i++) {
     const btn = document.getElementById(`btn-cue-${deckKey}-${i}`);
     if (deckCues[i] !== null) {
        btn.classList.add("active", `color-${i}`);
        if (audio.duration) {
            const pct = (deckCues[i] / duration) * 100;
            const marker = document.createElement("div");
            marker.className = `cue-marker color-${i}`;
            marker.style.left = `${pct}%`;
            waveEl.appendChild(marker);
        }
     } else { btn.classList.remove("active", `color-${i}`); }
  }
}

function loadOnDeck(deckLetter, index) {
  if (index >= TRACKS.length) return;
  const t = TRACKS[index];
  const audio = $("audio" + deckLetter);
  audio.src = t.url || (MUSIC_BASE + encodeURIComponent(t.file));
  audio.load();
  $(deckLetter.toLowerCase() + "Title").textContent = (t.isRequest ? "[REQ] " : "") + `#${t.n} — ${t.id}`;
  decks[deckLetter].cues = [null, null, null, null];
  
  // Auto-Skip intro (e.g. Saregama Carvaan ads) using the mathematically detected first beat
  audio.addEventListener("canplay", function onCp() {
      audio.removeEventListener("canplay", onCp);
      if (t.skip !== undefined) {
          audio.currentTime = t.skip;
      } else if (t.first_beat && t.first_beat > 5) {
          audio.currentTime = t.first_beat;
      } else {
          audio.currentTime = 10; // Default 10s skip to bypass Saregama Carvaan ads
      }
  });

  renderHotCues(deckLetter);
  
  if (!t.bpm) {
    detectBPM(audio.src).then(bpm => {
      if (bpm) t.bpm = bpm;
    });
  }
}

async function detectBPM(url) {
  try {
    const res = await fetch(url, { headers: { "Range": "bytes=0-3000000" }});
    const arrayBuffer = await res.arrayBuffer();
    const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 44100 * 20, 44100);
    const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
    const data = audioBuffer.getChannelData(0);
    let max = 0;
    for (let i = 0; i < data.length; i++) if (Math.abs(data[i]) > max) max = Math.abs(data[i]);
    const threshold = max * 0.8;
    const peaks = [];
    for (let i = 0; i < data.length; i++) {
        if (Math.abs(data[i]) > threshold) {
            peaks.push(i / audioBuffer.sampleRate);
            i += 10000;
        }
    }
    const intervals = {};
    for (let i = 0; i < peaks.length; i++) {
        for (let j = 1; j < 5 && i + j < peaks.length; j++) {
            const diff = peaks[i + j] - peaks[i];
            const tempo = Math.round(60 / diff);
            if (tempo > 80 && tempo < 180) {
                intervals[tempo] = (intervals[tempo] || 0) + 1;
            }
        }
    }
    let guessedBPM = 0, maxCount = 0;
    for (const t in intervals) {
        if (intervals[t] > maxCount) { maxCount = intervals[t]; guessedBPM = parseInt(t); }
    }
    return guessedBPM;
  } catch (e) {
    return 0;
  }
}

function loadNextOnDeckB() {
  if (currentIdx + 1 < TRACKS.length) {
    nextIdx = currentIdx + 1;
    loadOnDeck("B", nextIdx);
    bLoaded = true;
    const t = TRACKS[nextIdx];
    $("nextTitle").textContent = (t.isRequest ? "[REQ] " : "") + `#${t.n} — ${t.id}`;
  }
}

function togglePlay(which) {
  setTimeout(() => {
    const a = $("audio" + which);
    const btn = $(which.toLowerCase() + "PlayCircle");
    if(btn) {
       btn.innerHTML = a.paused ? "&#9658;" : "&#10074;&#10074;";
    }
  }, 50);
  if (!ctx) initAudio();
  if (ctx.state === "suspended") ctx.resume();
  const a = $("audio" + which);
  if (a.paused) { 
    a.play().catch(e => console.warn(e)); 
    let oldBtn = $(which.toLowerCase() + "Play");
    if(oldBtn) oldBtn.textContent = "PAUSE"; 
  } else { 
    a.pause(); 
    let oldBtn = $(which.toLowerCase() + "Play");
    if(oldBtn) oldBtn.textContent = "PLAY"; 
  }
}

function seek(which, dx) {
  const a = $("audio" + which);
  a.currentTime = Math.max(0, Math.min((a.duration || 0) - 1, a.currentTime + dx));
}

function resetEQ(which) {
  for (const knob of ["Low", "Mid", "High"]) {
    const el = $(which.toLowerCase() + knob);
    el.value = 0; el.dispatchEvent(new Event("input"));
  }
  if (which === "A") { $("aHPF").value = 20; $("aHPF").dispatchEvent(new Event("input")); }
  else { $("bLPF").value = 20000; $("bLPF").dispatchEvent(new Event("input")); }
}

function triggerMix() {
  if (mixing || !ctx) return;
  if (!bLoaded) loadNextOnDeckB();
  if (!bLoaded) return;
  mixing = true;
  $("liveBadge").textContent = "MIXING";

  const activeA = $("deckA").classList.contains("active");
  const aAudio = $("audioA"), bAudio = $("audioB");
  const now = ctx.currentTime;
  
  const outIdx = activeA ? currentIdx : currentIdx + 1;
  const inIdx = activeA ? currentIdx + 1 : currentIdx;
  const outBpm = TRACKS[outIdx]?.bpm || 128;
  const inBpm = TRACKS[inIdx]?.bpm || 128;
  const inFirstBeat = TRACKS[inIdx]?.first_beat || 0;
  
  const A = decks.A, B = decks.B;

  let ratio = 1.0;
  if (outBpm > 0 && inBpm > 0) {
     ratio = outBpm / inBpm;
     if (ratio > 0.85 && ratio < 1.15) {
         bAudio.playbackRate = ratio;
         bAudio.preservesPitch = true;
     }
  }

  const bps = (outBpm / 60);
  const beatInterval = 1.0 / bps;
  const aPhase = aAudio.currentTime % beatInterval;
  
  const targetSkip = (TRACKS[nextIdx].skip !== undefined) ? TRACKS[nextIdx].skip : inFirstBeat;
  bAudio.currentTime = Math.max(0, targetSkip - aPhase);

  // Extend mix to 16 beats (~7.5s at 128bpm)
  const T = beatInterval * 16; 
  
  bAudio.play().catch(e => console.warn(e));
  if($("bPlayCircle")) $("bPlayCircle").innerHTML = "&#10074;&#10074;";
  $("bBadge").textContent = "INCOMING";
  $("deckB").classList.add("active"); $("deckB").classList.remove("cued");

  // INCOMING TRACK (Deck B) starts with NO BASS
  B.lpf.frequency.cancelScheduledValues(now); B.lpf.frequency.value = 20000;
  B.hpf.frequency.cancelScheduledValues(now); B.hpf.frequency.value = 20;
  B.low.gain.cancelScheduledValues(now); 
  B.low.gain.value = -40; // Kill bass on incoming track
  
  if (mixIntervalId) clearInterval(mixIntervalId);
  const mixStart = ctx.currentTime;
  
  // Start crossfader at the very left (-1)
  if ($("crossfader")) { $("crossfader").value = -1; applyCrossfader(-1); }
  
  // OUTGOING TRACK (Deck A) EQ & FX
  A.low.gain.cancelScheduledValues(now);
  A.low.gain.setValueAtTime(A.low.gain.value || 0, now);
  
  // Bass swap at exactly halfway through the mix (8 beats)
  A.low.gain.setValueAtTime(A.low.gain.value || 0, now + T * 0.5);
  A.low.gain.linearRampToValueAtTime(-40, now + T * 0.5 + 0.1); 
  
  // Bring incoming bass IN at exactly halfway through the mix
  B.low.gain.setValueAtTime(-40, now + T * 0.5);
  B.low.gain.linearRampToValueAtTime(0, now + T * 0.5 + 0.1);

  // High-Pass Filter Wash out on Deck A during the second half
  A.hpf.frequency.cancelScheduledValues(now);
  A.hpf.frequency.setValueAtTime(20, now + T * 0.5);
  A.hpf.frequency.exponentialRampToValueAtTime(4000, now + T); 

  // Add echo delay tail on A during last 4 beats for smooth transition
  const activeK = activeA ? "A" : "B";
  globalEchoReturn.gain.cancelScheduledValues(now);
  globalEchoReturn.gain.setValueAtTime(0, now);
  globalEchoReturn.gain.setValueAtTime(0, now + T * 0.75); // Start echoing last 4 beats
  globalEchoReturn.gain.linearRampToValueAtTime(1, now + T * 0.9);
  globalEchoReturn.gain.linearRampToValueAtTime(0, now + T + 4); // Fade out echo

  // Volume Crossfade Update Loop
  mixIntervalId = setInterval(() => {
    let progress = (ctx.currentTime - mixStart) / T;
    if (progress >= 1) { progress = 1; clearInterval(mixIntervalId); }
    if ($("crossfader")) {
      // Map progress (0 to 1) to crossfader (-1 to 1)
      const faderVal = -1 + (progress * 2);
      $("crossfader").value = faderVal;
      applyCrossfader(faderVal);
    }
  }, 20);

  if (mixTimeoutId) clearTimeout(mixTimeoutId);
  mixTimeoutId = setTimeout(finishMix, T * 1000);
}

function finishMix() {
  const aAudio = $("audioA"), bAudio = $("audioB");
  aAudio.pause();
  if($("aPlayCircle")) $("aPlayCircle").innerHTML = "&#9658;";

  const A = decks.A;
  A.low.gain.cancelScheduledValues(ctx.currentTime); A.low.gain.value = 0;
  A.mid.gain.value = 0; A.high.gain.value = 0;
  A.hpf.frequency.cancelScheduledValues(ctx.currentTime); A.hpf.frequency.value = 20;
  A.lpf.frequency.value = 20000;
  A.gain.gain.cancelScheduledValues(ctx.currentTime); A.gain.gain.value = 0;
  
  if ($("crossfader")) { $("crossfader").value = -1; applyCrossfader(-1); }

  currentIdx = nextIdx;
  $("aTitle").textContent = `#${TRACKS[currentIdx].n} — ${TRACKS[currentIdx].id}`;
  $("aBadge").textContent = "PLAYING";
  $("bBadge").textContent = "CUED";
  $("deckA").classList.add("active");
  $("deckB").classList.remove("active");

  const nowSec = bAudio.currentTime;
  aAudio.src = MUSIC_BASE + encodeURIComponent(TRACKS[currentIdx].file);
  aAudio.load();
  decks.A.cues = [null, null, null, null]; renderHotCues('A');
  aAudio.addEventListener("canplaythrough", function onCp() {
    aAudio.removeEventListener("canplaythrough", onCp);
    aAudio.currentTime = nowSec;
    A.gain.gain.value = 1;
    aAudio.play().catch(()=>{});
    currentTrackPlayStart = ctx.currentTime;

    decks.B.gain.gain.cancelScheduledValues(ctx.currentTime);
    decks.B.gain.gain.setValueAtTime(decks.B.gain.gain.value, ctx.currentTime);
    decks.B.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
    setTimeout(() => {
      bAudio.pause(); bAudio.currentTime = 0;
      bAudio.playbackRate = 1.0;
      if($("bPlayCircle")) $("bPlayCircle").innerHTML = "&#9658;";
      const B = decks.B;
      B.hpf.frequency.value = 20; B.lpf.frequency.value = 20000;
      B.low.gain.value = 0; B.mid.gain.value = 0; B.high.gain.value = 0;
      B.gain.gain.value = 0;
      B.cues = [null, null, null, null]; renderHotCues('B');
      bLoaded = false;
      if (currentIdx + 1 < TRACKS.length) loadNextOnDeckB();
      else { $("nextTitle").textContent = "— end of playlist —"; $("bTitle").textContent = "—"; }
      mixing = false;
      $("liveBadge").textContent = "REAL-TIME DJ";
      $("statTrack").textContent = `${currentIdx + 1}/${TRACKS.length}`;
      renderUpNext();
    }, 600);
  }, { once: true });
}

setInterval(() => {
  if (!ctx || mixing) return;
  const aAudio = $("audioA");
  if (aAudio.paused) return;
  if (!aAudio.duration || isNaN(aAudio.duration)) return;
  if (SNIPPET_MODE) {
    const playedThisTrack = ctx.currentTime - currentTrackPlayStart;
    if (AUTO_MIX && playedThisTrack > SNIPPET_LEN_SEC) triggerMix();
  } else {
    const remain = aAudio.duration - aAudio.currentTime;
    if (AUTO_MIX && remain < TRIGGER_BEFORE && remain > 0) triggerMix();
  }
}, 250);

function toggleAutoMix() {
  AUTO_MIX = !AUTO_MIX;
  const t = $("autoToggle");
  if(AUTO_MIX) { t.classList.add("on"); t.children[1].textContent="ON"; }
  else { t.classList.remove("on"); t.children[1].textContent="OFF"; }
  $("statAuto").textContent = AUTO_MIX ? "ON" : "OFF";
}

function toggleFestFx() {
  FESTIVAL_FX = !FESTIVAL_FX;
  const t = $("festFxToggle");
  if(FESTIVAL_FX) { t.classList.add("on"); t.children[1].textContent="ON"; }
  else { t.classList.remove("on"); t.children[1].textContent="OFF"; }
}

function toggleSnippetMode() {
  SNIPPET_MODE = !SNIPPET_MODE;
  $("statSnippet").textContent = SNIPPET_MODE ? "60s/track" : "full song";
  if (ctx) currentTrackPlayStart = ctx.currentTime;
}

function wireKnob(id, fn, fmt) {
  const el = $(id), val = $(id + "Val");
  if (!el) return;
  el.addEventListener("input", () => { const v = parseFloat(el.value); fn(v); val.textContent = fmt(v); });
}

function playSynthKick(time) {
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.frequency.setValueAtTime(150, time); o.frequency.exponentialRampToValueAtTime(40, time + 0.1);
  g.gain.setValueAtTime(1.2, time); g.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
  o.connect(g); g.connect(masterGain); o.start(time); o.stop(time + 0.4);
}

function scheduleBgBeat() {
  if (!bgBeatInterval || !ctx) return;
  const t = ctx.currentTime;
  while (nextBgBeatTime < t + 0.1) {
    playSynthKick(nextBgBeatTime);
    nextBgBeatTime += 60 / bgBeatBpm;
  }
  bgBeatInterval = requestAnimationFrame(scheduleBgBeat);
}

function toggleBgBeat() {
  if (!ctx) initAudio();
  if (bgBeatInterval) {
    cancelAnimationFrame(bgBeatInterval);
    bgBeatInterval = null;
    $("bgBeatBtn").textContent = "OFF";
    $("bgBeatBtn").style.background = "";
    $("bgBeatBtn").style.color = "";
  } else {
    nextBgBeatTime = ctx.currentTime + 0.05;
    bgBeatInterval = requestAnimationFrame(scheduleBgBeat);
    $("bgBeatBtn").textContent = "ON";
    $("bgBeatBtn").style.background = "var(--accent)";
    $("bgBeatBtn").style.color = "#000";
  }
}

function tapTempo() {
  if (!ctx) initAudio();
  const now = Date.now();
  tapTimes.push(now);
  if (tapTimes.length > 4) tapTimes.shift();
  if (tapTimes.length === 4) {
    const diffs = [];
    for (let i = 1; i < 4; i++) diffs.push(tapTimes[i] - tapTimes[i-1]);
    const avgDiff = diffs.reduce((a,b)=>a+b, 0) / 3;
    const bpm = 60000 / avgDiff;
    if (bpm > 70 && bpm < 180) {
      bgBeatBpm = bpm;
      $("bgBeatTempo").value = bgBeatBpm.toFixed(1);
      $("bgBeatTempoVal").textContent = bgBeatBpm.toFixed(1);
    }
  }
  if (bgBeatInterval) {
    nextBgBeatTime = ctx.currentTime + 0.01;
  }
}

let micStream = null;
let micGraph = null;



function init() {
  wireKnob("bgBeatTempo", v => { bgBeatBpm = v; }, v => v.toFixed(1));
  wireKnob("aVol",  v => decks.A && (decks.A.gain.gain.cancelScheduledValues(ctx.currentTime), decks.A.gain.gain.value = v), v => Math.round(v*100)+"%");
  wireKnob("aLow",  v => decks.A && (decks.A.low.gain.cancelScheduledValues(ctx.currentTime), decks.A.low.gain.value = v),  v => v + " dB");
  wireKnob("aMid",  v => decks.A && (decks.A.mid.gain.value = v),  v => v + " dB");
  wireKnob("aHigh", v => decks.A && (decks.A.high.gain.value = v), v => v + " dB");
  wireKnob("aHPF",  v => decks.A && (decks.A.hpf.frequency.cancelScheduledValues(ctx.currentTime), decks.A.hpf.frequency.value = v), v => v < 30 ? "off" : Math.round(v)+" Hz");
  wireKnob("aTempo", v => { const a = $("audioA"); a.playbackRate = 1 + v/100; a.preservesPitch = true; }, v => (v>0?"+":"")+v.toFixed(1)+"%");
  wireKnob("bVol",  v => decks.B && (decks.B.gain.gain.cancelScheduledValues(ctx.currentTime), decks.B.gain.gain.value = v), v => Math.round(v*100)+"%");
  wireKnob("bLow",  v => decks.B && (decks.B.low.gain.cancelScheduledValues(ctx.currentTime), decks.B.low.gain.value = v),  v => v + " dB");
  wireKnob("bMid",  v => decks.B && (decks.B.mid.gain.value = v),  v => v + " dB");
  wireKnob("bHigh", v => decks.B && (decks.B.high.gain.value = v), v => v + " dB");
  wireKnob("bLPF",  v => decks.B && (decks.B.lpf.frequency.cancelScheduledValues(ctx.currentTime), decks.B.lpf.frequency.value = v), v => v > 19500 ? "off" : Math.round(v)+" Hz");
  wireKnob("bTempo", v => { const a = $("audioB"); a.playbackRate = 1 + v/100; a.preservesPitch = true; }, v => (v>0?"+":"")+v.toFixed(1)+"%");

  const setupScrub = (deckLetter) => {
    const waveDiv = $("deck" + deckLetter).querySelector(".wave");
    const seekBar = $(deckLetter.toLowerCase() + "SeekBar");
    
    let isDragging = false;
    const scrubTo = (e) => {
      const rect = waveDiv.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const a = $("audio" + deckLetter);
      if (a.duration) a.currentTime = pct * a.duration;
    };
    waveDiv.addEventListener("mousedown", (e) => { isDragging = true; scrubTo(e); });
    window.addEventListener("mousemove", (e) => { if(isDragging) scrubTo(e); });
    window.addEventListener("mouseup", () => isDragging = false);
    waveDiv.style.cursor = "ew-resize";
    
    seekBar.addEventListener("input", (e) => {
      const a = $("audio" + deckLetter);
      if (a.duration) a.currentTime = (e.target.value / 100) * a.duration;
    });
  };
  setupScrub("A");
  setupScrub("B");

  $("recBtn").addEventListener("click", () => {
      if (!mediaRecorder) { initAudio(); if(!mediaRecorder) return; }
      if (isRecording) {
          mediaRecorder.stop();
          isRecording = false;
          $("recBtn").style.background = "#400";
          $("recBtn").textContent = "🔴 REC SET";
          $("recBtn").style.boxShadow = "none";
      } else {
          recordedChunks = [];
          mediaRecorder.start();
          isRecording = true;
          $("recBtn").style.background = "#f00";
          $("recBtn").textContent = "⏹ STOP REC";
          $("recBtn").style.boxShadow = "0 0 15px red";
      }
  });

  $("restartPartyBtn").addEventListener("click", () => {
    localStorage.removeItem("dj_live_save");
    $("startBtn").click();
  });

  $("startBtn").addEventListener("click", async () => {
    try {
      initAudio();
      if (ctx.state === "suspended") await ctx.resume();
      
      let startIdx = 0;
      let startTimeOffset = -1;
      try {
        const saved = JSON.parse(localStorage.getItem("dj_live_save") || "null");
        if (saved && (Date.now() - saved.timestamp < 12 * 60 * 60 * 1000)) {
          startIdx = saved.idx;
          startTimeOffset = saved.time;
        }
      } catch (e) {}
      
      loadOnDeck("A", startIdx);
      if (startIdx < TRACKS.length - 1) loadOnDeck("B", startIdx + 1);
      
      const aAudio = $("audioA");
      
      $("startGate").style.display = "none";
      if($("aPlayCircle")) $("aPlayCircle").innerHTML = "&#10074;&#10074;";
      currentTrackPlayStart = ctx.currentTime;
      
      const setupTime = () => {
        if (startTimeOffset >= 0) {
            aAudio.currentTime = startTimeOffset;
        } else {
            aAudio.currentTime = TRACKS[startIdx]?.skip !== undefined ? TRACKS[startIdx].skip : 10;
        }
      };
      if (aAudio.readyState >= 1) setupTime();
      else aAudio.addEventListener("loadedmetadata", setupTime, { once: true });
      
      aAudio.play().catch(e => console.error(e));
      
      setInterval(() => {
        const activeA = $("deckA").classList.contains("active");
        const a = activeA ? $("audioA") : $("audioB");
        if (!a.paused) {
          localStorage.setItem("dj_live_save", JSON.stringify({
            idx: activeA ? currentIdx : currentIdx + 1,
            time: a.currentTime,
            timestamp: Date.now()
          }));
        }
      }, 5000);
      
      updateUI();
    } catch (e) {
      $("startGate").style.display = "flex";
      $("startErr").style.display = "block";
      $("startErr").textContent = "Playback failed: " + e.message;
    }
  });

  setInterval(() => {
    for (const k of ["A", "B"]) {
      const a = $("audio" + k);
      const t = a.currentTime || 0, d = a.duration || 0;
      $(k.toLowerCase() + "Time").textContent = fmtTime(t) + " / " + fmtTime(d);
      $(k.toLowerCase() + "Prog").style.width = d ? (t/d*100) + "%" : "0%";
    }
    if (ctx) {
      if (SNIPPET_MODE) {
        const played = ctx.currentTime - currentTrackPlayStart;
        const left = Math.max(0, SNIPPET_LEN_SEC - played);
        $("aRemainTxt").textContent = "-" + fmtTime(left);
        $("nextEta").textContent = AUTO_MIX && left > 0 ? `auto-mix in ${Math.ceil(left)}s` : "";
      } else {
        const aA = $("audioA");
        const rem = (aA.duration || 0) - (aA.currentTime || 0);
        $("aRemainTxt").textContent = "-" + (rem > 0 ? fmtTime(rem) : "00:00");
        $("nextEta").textContent = AUTO_MIX && rem < 60 && rem > 0 ? `auto-mix in ${Math.ceil(rem - TRIGGER_BEFORE)}s` : "";
      }
    }
    const total = (Date.now() - startTime) / 1000;
    $("statElapsed").textContent = fmtTime(total, true);
  }, 250);

  drawWaves();
  renderUpNext();
  buildTracklistOverlay();
}

function fmtTime(s, withHours = false) {
  if (!isFinite(s)) return "0:00";
  const sec = Math.floor(s % 60), min = Math.floor(s / 60) % 60, hr = Math.floor(s / 3600);
  if (withHours || hr > 0) return `${hr}:${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  return `${min}:${String(sec).padStart(2,"0")}`;
}

function drawWaves() {
  for (const k of ["A", "B"]) {
    const canvas = $(k.toLowerCase() + "Wave");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr;
  }
}

const bgVisualizerData = new Uint8Array(128);

function updateUI() {
  if (!ctx) { requestAnimationFrame(updateUI); return; }
  
  const activeA = $("deckA").classList.contains("active");
  const outIdx = activeA ? currentIdx : currentIdx + 1;
  const inIdx = activeA ? currentIdx + 1 : currentIdx;
  
  const fmtTime = (s) => {
      if (isNaN(s)) return "00:00";
      const m = Math.floor(Math.abs(s) / 60);
      const sec = Math.floor(Math.abs(s) % 60);
      return m.toString().padStart(2, '0') + ":" + sec.toString().padStart(2, '0');
  };

  const outBpm = TRACKS[outIdx]?.bpm || 128.0;
  const inBpm = TRACKS[inIdx]?.bpm || 128.0;
  
  $("aBpmTxt").textContent = ($("audioA").playbackRate * (activeA ? outBpm : inBpm)).toFixed(1);
  $("bBpmTxt").textContent = ($("audioB").playbackRate * (activeA ? inBpm : outBpm)).toFixed(1);
  
  ["A", "B"].forEach(k => {
    const a = $("audio" + k);
    
    const rem = a.duration ? a.duration - a.currentTime : 0;
    $(k.toLowerCase() + "RemainTxt").textContent = "-" + fmtTime(rem);
    
    $(k.toLowerCase() + "Time").textContent = `${fmtTime(a.currentTime)} / ${fmtTime(a.duration || 0)}`;
    
    const prog = a.duration ? (a.currentTime / a.duration) * 100 : 0;
    $(k.toLowerCase() + "Prog").style.width = prog + "%";
    
    // Update the visual seek bar, but don't interfere if they are actively dragging it
    const seekBar = $(k.toLowerCase() + "SeekBar");
    if (document.activeElement !== seekBar) {
        seekBar.value = prog;
    }
    
    const canvas = $(k.toLowerCase() + "Wave");
    const waveData = k === 'A' ? waveDataA : waveDataB;
    if (waveData && waveData.length > 0) {
      if (canvas.width !== canvas.offsetWidth) canvas.width = canvas.offsetWidth;
      if (canvas.height !== canvas.offsetHeight) canvas.height = canvas.offsetHeight;
      const wCtx = canvas.getContext("2d");
      
      wCtx.fillStyle = '#050507';
      wCtx.fillRect(0, 0, canvas.width, canvas.height);
      const playedWidth = (a.currentTime / (a.duration || 1)) * canvas.width;
      
      wCtx.lineWidth = 2;
      wCtx.beginPath();
      const step = Math.ceil(waveData.length / canvas.width);
      for (let i = 0; i < canvas.width; i++) {
        let min = 1, max = -1;
        for (let j = 0; j < step; j++) {
          const v = waveData[(i * step) + j];
          if (v < min) min = v;
          if (v > max) max = v;
        }
        wCtx.moveTo(i, (1 + min) * canvas.height / 2);
        wCtx.lineTo(i, (1 + max) * canvas.height / 2);
      }
      wCtx.strokeStyle = 'rgba(255,255,255,0.2)';
      wCtx.stroke();
      
      wCtx.save();
      wCtx.beginPath();
      wCtx.rect(0, 0, playedWidth, canvas.height);
      wCtx.clip();
      
      wCtx.beginPath();
      for (let i = 0; i < playedWidth; i++) {
        let min = 1, max = -1;
        for (let j = 0; j < step; j++) {
          const v = waveData[(i * step) + j];
          if (v < min) min = v;
          if (v > max) max = v;
        }
        wCtx.moveTo(i, (1 + min) * canvas.height / 2);
        wCtx.lineTo(i, (1 + max) * canvas.height / 2);
      }
      wCtx.strokeStyle = k === 'A' ? '#ff2bd6' : '#00d4ff';
      wCtx.stroke();
      wCtx.restore();
    }
  });
  
  if (masterAnalyser && bgVisualizerCtx) {
      const cvs = $("bgVisualizer");
      if (cvs.width !== window.innerWidth || cvs.height !== window.innerHeight) {
          cvs.width = window.innerWidth;
          cvs.height = window.innerHeight;
      }
      masterAnalyser.getByteFrequencyData(bgVisualizerData);
      
      const vctx = bgVisualizerCtx;
      vctx.fillStyle = "rgba(10, 10, 15, 0.2)";
      vctx.fillRect(0, 0, cvs.width, cvs.height);
      
      let bassEnergy = 0;
      for(let i=0; i<5; i++) bassEnergy += bgVisualizerData[i];
      bassEnergy /= 5;
      
      if (bassEnergy > 50) {
          const radius = (bassEnergy / 255) * Math.min(cvs.width, cvs.height) * 0.4;
          const gradient = vctx.createRadialGradient(cvs.width/2, cvs.height/2, 0, cvs.width/2, cvs.height/2, radius);
          gradient.addColorStop(0, `rgba(0, 255, 159, ${bassEnergy/255})`);
          gradient.addColorStop(1, "transparent");
          vctx.fillStyle = gradient;
          vctx.beginPath();
          vctx.arc(cvs.width/2, cvs.height/2, radius, 0, Math.PI*2);
          vctx.fill();
      }
  }
  
  ["A", "B"].forEach(k => {
    const a = $("audio" + k);
    const jogRot = $(k.toLowerCase() + "JogRot");
    const wheel = $(k.toLowerCase() + "Jog");
    if (jogRot && a && typeof jogState !== 'undefined') {
      const rotDeg = ((a.currentTime||0) % 1.8) / 1.8 * 360;
      if (wheel.classList.contains("spinback")) {
        jogState[k].angle -= 30;
        jogRot.style.transform = `rotate(${jogState[k].angle}deg)`;
      } else {
        jogRot.style.transform = `rotate(${rotDeg}deg)`;
        jogState[k].angle = rotDeg;
      }
      if (!a.paused && !jogState[k].isBraking && !jogState[k].isDragging && !wheel.classList.contains("spinback")) {
        wheel.classList.add("playing");
      } else if (a.paused) {
        wheel.classList.remove("playing");
      }
    }
    const d = decks[k];
    const data = new Uint8Array(d.analyser.frequencyBinCount);
    d.analyser.getByteFrequencyData(data);
    const meter = $(k.toLowerCase() + "Meter");
    if (!meter.children.length) for (let i = 0; i < 8; i++) meter.appendChild(document.createElement("span"));
    const avg = data.slice(2, 30).reduce((a,b) => a+b, 0) / 28 / 255;
    for (let i = 0; i < 8; i++) {
      const b = meter.children[i];
      b.className = "meter-bar" + (avg > i/8 ? " on" : "") + (i >= 6 ? " hot" : "") + (i >= 7 ? " peak" : "");
    }
  });
  requestAnimationFrame(updateUI);
}

function fx(kind) {
  if (!ctx) initAudio();
  const pad = $("pad" + ({kick:1,snare:2,hat:3,echo:4,horn:5,riser:6,tapestop:8,siren:9}[kind]));
  if (pad) { pad.classList.add("hit"); setTimeout(() => pad.classList.remove("hit"), 100); }
  const t = ctx.currentTime;
  const out = ctx.createGain(); out.gain.value = 0.7; out.connect(masterGain);
  if (kind === "kick") {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.5);
  } else if (kind === "snare") {
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i/data.length);
    noise.buffer = buf;
    const g = ctx.createGain(); g.gain.value = 0.5;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1500;
    noise.connect(hp); hp.connect(g); g.connect(out); noise.start(t);
  } else if (kind === "hat") {
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i/data.length);
    noise.buffer = buf;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 7000;
    const g = ctx.createGain(); g.gain.value = 0.3;
    noise.connect(hp); hp.connect(g); g.connect(out); noise.start(t);
  } else if (kind === "echo") {
    const activeK = $("deckA").classList.contains("active") ? "A" : "B";
    const A = decks[activeK];
    A.gain.gain.cancelScheduledValues(t);
    A.gain.gain.setValueAtTime(A.gain.gain.value || 1, t);
    A.gain.gain.linearRampToValueAtTime(0, t + 0.05);
    globalEchoReturn.gain.cancelScheduledValues(t);
    globalEchoReturn.gain.setValueAtTime(1, t);
    globalEchoReturn.gain.setValueAtTime(1, t + 4);
    globalEchoReturn.gain.linearRampToValueAtTime(0, t + 6);
    setTimeout(() => { $("audio" + activeK).pause(); }, 100);
  } else if (kind === "horn") {
    const o1 = ctx.createOscillator(); o1.type = "sawtooth";
    const o2 = ctx.createOscillator(); o2.type = "sawtooth";
    const o3 = ctx.createOscillator(); o3.type = "sawtooth";
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    const ws = ctx.createWaveShaper();
    const curve = new Float32Array(4096);
    for(let i=0; i<4096; i++) { const x = i*2/4096 - 1; curve[i] = (3 + 10)*x*57 / (10 + 57*Math.abs(x)); }
    ws.curve = curve;
    for (let i=0; i<3; i++) {
        const time = t + i*0.12;
        o1.frequency.setValueAtTime(400, time); o1.frequency.linearRampToValueAtTime(320, time + 0.1);
        o2.frequency.setValueAtTime(800, time); o2.frequency.linearRampToValueAtTime(640, time + 0.1);
        o3.frequency.setValueAtTime(405, time); o3.frequency.linearRampToValueAtTime(325, time + 0.1);
        g.gain.setValueAtTime(0, time);
        g.gain.linearRampToValueAtTime(0.8, time + 0.02);
        g.gain.linearRampToValueAtTime(0, time + 0.1);
    }
    const finalStart = t + 0.36;
    o1.frequency.setValueAtTime(400, finalStart); o1.frequency.exponentialRampToValueAtTime(200, finalStart + 1.2);
    o2.frequency.setValueAtTime(800, finalStart); o2.frequency.exponentialRampToValueAtTime(400, finalStart + 1.2);
    o3.frequency.setValueAtTime(405, finalStart); o3.frequency.exponentialRampToValueAtTime(205, finalStart + 1.2);
    g.gain.setValueAtTime(0, finalStart);
    g.gain.linearRampToValueAtTime(0.8, finalStart + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, finalStart + 1.2);
    o1.connect(ws); o2.connect(ws); o3.connect(ws); ws.connect(g); g.connect(out);
    o1.start(t); o2.start(t); o3.start(t); o1.stop(finalStart + 1.2); o2.stop(finalStart + 1.2); o3.stop(finalStart + 1.2);
  } else if (kind === "riser") {
    const o = ctx.createOscillator(); o.type = "sawtooth";
    o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(8000, t + 4);
    const lfo = ctx.createOscillator(); lfo.type = "sine";
    lfo.frequency.setValueAtTime(4, t); lfo.frequency.exponentialRampToValueAtTime(32, t + 4);
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 100;
    lfo.connect(lfoGain); lfoGain.connect(o.frequency);
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter(); filter.type = "highpass";
    filter.frequency.setValueAtTime(100, t); filter.frequency.exponentialRampToValueAtTime(10000, t + 4);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1.5, t + 3.8);
    g.gain.linearRampToValueAtTime(0, t + 4);
    o.connect(g); noise.connect(filter); filter.connect(g); g.connect(out); 
    o.start(t); lfo.start(t); noise.start(t); o.stop(t + 4); lfo.stop(t + 4); noise.stop(t + 4);
    for(let i=0; i<32; i++) {
        let hitTime = t;
        if(i < 8) hitTime += i * 0.25; else if (i < 16) hitTime += 2 + (i-8) * 0.125; else if (i < 24) hitTime += 3 + (i-16) * 0.0625; else hitTime += 3.5 + (i-24) * 0.03125;
        if(hitTime >= t + 4) break;
        const sh = ctx.createBufferSource(); sh.buffer = buf;
        const shf = ctx.createBiquadFilter(); shf.type = "highpass"; shf.frequency.value = 1500;
        const shg = ctx.createGain(); shg.gain.setValueAtTime(0.8 * (i/32), hitTime);
        shg.gain.exponentialRampToValueAtTime(0.01, hitTime + 0.1);
        sh.connect(shf); shf.connect(shg); shg.connect(out);
        sh.start(hitTime); sh.stop(hitTime + 0.1);
    }
  } else if (kind === "siren") {
    const o = ctx.createOscillator(); o.type = "square";
    const lfo = ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 0.6;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 500;
    lfo.connect(lfoGain); lfoGain.connect(o.frequency);
    o.frequency.value = 700;
    const delay = ctx.createDelay(); delay.delayTime.value = 0.35;
    const fb = ctx.createGain(); fb.gain.value = 0.4;
    delay.connect(fb); fb.connect(delay);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.15, t);
    g.gain.linearRampToValueAtTime(0, t + 5.0);
    o.connect(g); g.connect(out); g.connect(delay); delay.connect(out);
    o.start(t); lfo.start(t); o.stop(t + 5.0); lfo.stop(t + 5.0);
  } else if (kind === "tapestop") {
    const activeK = $("deckA").classList.contains("active") ? "A" : "B";
    const audioEl = $("audio" + activeK);
    audioEl.preservesPitch = false;
    let rate = audioEl.playbackRate || 1;
    if (tapeStopRaf) cancelAnimationFrame(tapeStopRaf);
    const k = ctx.createOscillator(); k.frequency.setValueAtTime(120, t); k.frequency.exponentialRampToValueAtTime(30, t+0.3);
    const kg = ctx.createGain(); kg.gain.setValueAtTime(1.5, t); kg.gain.exponentialRampToValueAtTime(0.001, t+0.5);
    k.connect(kg); kg.connect(out); k.start(t); k.stop(t+0.5);
    const step = () => {
      rate -= 0.02;
      if (rate < 0.05) {
        audioEl.pause();
        audioEl.playbackRate = 1;
        audioEl.preservesPitch = true;
      } else {
        audioEl.playbackRate = rate;
        tapeStopRaf = requestAnimationFrame(step);
      }
    };
    tapeStopRaf = requestAnimationFrame(step);
  }
}

function panicReset() {
  if (!ctx) return;
  const t = ctx.currentTime;
  mixing = false;
  if (globalEchoReturn) {
    globalEchoReturn.gain.cancelScheduledValues(t);
    globalEchoReturn.gain.value = 0;
  }
  if (tapeStopRaf) {
    cancelAnimationFrame(tapeStopRaf);
    tapeStopRaf = null;
  }
  for (const k of ["A", "B"]) {
    const a = $("audio" + k);
    a.playbackRate = 1;
    a.preservesPitch = true;
    if (decks[k]) {
      decks[k].gain.gain.cancelScheduledValues(t);
      if ($("deck" + k).classList.contains("active")) {
        decks[k].gain.gain.value = 1;
        if (a.paused && a.currentTime > 0 && a.currentTime < (a.duration||999)) a.play().catch(()=>{});
      } else {
        decks[k].gain.gain.value = 0;
      }
      resetEQ(k);
    }
  }
}

function buildTracklistOverlay() {
  const list = $("ovList"); list.innerHTML = "";
  TRACKS.forEach((t, idx) => {
    const row = document.createElement("div");
    row.className = "ov-row";
    let reqStyle = t.isRequest ? 'color: var(--warn); font-weight: bold;' : '';
    let reqTag = t.isRequest ? '[REQUEST] ' : '';
    row.innerHTML = `<div class="ov-num" style="${reqStyle}">${String(t.n).padStart(2,"0")}</div><div style="flex:1; ${reqStyle}">${reqTag}Track #${t.n} — ${t.id}</div><button class="btn" style="background: var(--ok); color: #000; padding: 4px 8px; font-size: 11px;" onclick="event.stopPropagation(); loadFullTrack(${idx})">PLAY FULL</button>`;
    row.addEventListener("click", () => jumpToTrack(idx));
    list.appendChild(row);
  });
  $("ovSearch").addEventListener("input", () => {
    const q = $("ovSearch").value.toLowerCase();
    [...list.children].forEach((r, i) => {
      const t = TRACKS[i];
      const match = !q || t.id.toLowerCase().includes(q) || String(t.n).includes(q);
      r.style.display = match ? "" : "none";
    });
  });
}

function jumpToTrack(idx) {
  const A = decks.A, B = decks.B;
  $("audioA").pause(); $("audioB").pause();
  currentIdx = idx; nextIdx = idx + 1;
  if (A) {
    A.low.gain.value = 0; A.mid.gain.value = 0; A.high.gain.value = 0;
    A.hpf.frequency.value = 20; A.lpf.frequency.value = 20000; A.gain.gain.value = 1;
  }
  if (B) {
    B.low.gain.value = 0; B.mid.gain.value = 0; B.high.gain.value = 0;
    B.hpf.frequency.value = 20; B.lpf.frequency.value = 20000; B.gain.gain.value = 0;
  }
  loadOnDeck("A", currentIdx);
  $("audioA").addEventListener("canplaythrough", () => {
    $("audioA").currentTime = TRACKS[currentIdx].skip !== undefined ? TRACKS[currentIdx].skip : 10;
    $("audioA").play().catch(()=>{});
    if($("aPlayCircle")) $("aPlayCircle").innerHTML = "&#10074;&#10074;";
    if (ctx) currentTrackPlayStart = ctx.currentTime;
  }, { once: true });
  if (nextIdx < TRACKS.length) loadNextOnDeckB();
  else { bLoaded = false; $("nextTitle").textContent = "— end of playlist —"; }
  mixing = false;
  $("statTrack").textContent = `${currentIdx + 1}/${TRACKS.length}`;
  renderUpNext();
  toggleTracklist();
}

function toggleTracklist() {
  $("overlay").classList.toggle("on");
  if ($("overlay").classList.contains("on")) setTimeout(() => $("ovSearch").focus(), 50);
}

function renderUpNext() {
  const list = $("upnextList"); list.innerHTML = "";
  for (let i = currentIdx; i < Math.min(currentIdx + 6, TRACKS.length); i++) {
    const row = document.createElement("div");
    row.className = "upnext-row" + (i === currentIdx ? " current" : "") + (i === nextIdx ? " cued" : "");
    row.innerHTML = `<span class="num">#${TRACKS[i].n}</span><span>${TRACKS[i].id}</span>`;
    row.addEventListener("click", () => jumpToTrack(i));
    list.appendChild(row);
  }
}

  // --- LIBRARY AND FILE UPLOAD LOGIC ---
  function processLocalFiles(files) {
    let added = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.type.startsWith("audio/") || f.name.match(/\.(mp3|wav|flac|aac|m4a|ogg)$/i)) {
        const url = URL.createObjectURL(f);
        TRACKS.push({
          n: TRACKS.length + 1,
          id: f.name.replace(/\.[^/.]+$/, ""),
          file: f.name,
          url: url,
          skip: 0,
          bpm: null
        });
        added++;
      }
    }
    if (added > 0) renderLibrary();
  }

  function renderLibrary() {
    const list = $("libraryList");
    if (!list) return;
    list.innerHTML = "";
    
    // Show tracks in reverse order so newest are at the top
    [...TRACKS].reverse().forEach((t) => {
      // Find original index
      const index = TRACKS.indexOf(t);
      const div = document.createElement("div");
      div.className = "lib-item";
      div.innerHTML = `
        <div class="lib-item-title">${t.n}. ${t.id}</div>
        <div class="lib-item-bpm">${t.bpm ? Math.round(t.bpm) : '---'}</div>
        <div class="lib-item-actions">
          <button class="btn" onclick="openEditor(${index})" style="border-color:#555; color:#aaa; font-size:9px; padding:4px 6px;">✂️ EDIT</button>
          <button class="btn" onclick="loadTrackFromLibrary('A', ${index})" style="border-color:#ff2bd6; color:#ff2bd6;">LOAD A</button>
          <button class="btn" onclick="loadTrackFromLibrary('B', ${index})" style="border-color:#00d4ff; color:#00d4ff;">LOAD B</button>
        </div>
      `;
      list.appendChild(div);
    });
    renderUpNext();
  }

  window.loadTrackFromLibrary = function(deckLetter, index) {
    if (AUTO_MIX) toggleAutoMix(); // Disable auto-mix if user is taking manual control
    loadOnDeck(deckLetter, index);
  };

  const fileInput = $("localFileInput");
  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      processLocalFiles(e.target.files);
      e.target.value = ""; // Reset input
    });
  }

  const dragZone = document.body;
  dragZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    $("libDragZone").classList.add("dragover");
  });
  dragZone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    if (e.target === dragZone || e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        $("libDragZone").classList.remove("dragover");
    }
  });
  dragZone.addEventListener("drop", (e) => {
    e.preventDefault();
    $("libDragZone").classList.remove("dragover");
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processLocalFiles(e.dataTransfer.files);
    }
  });

  // Initial Library Render
  renderLibrary();

  // --- CROSSFADER LOGIC ---
  function applyCrossfader(val) {
    // Equal-Power Crossfade Algorithm
    const blend = (val + 1) / 2; // Maps -1..1 to 0..1
    const gainA = Math.cos(blend * 0.5 * Math.PI);
    const gainB = Math.sin(blend * 0.5 * Math.PI);
    
    if (decks.A) {
      decks.A.gain.gain.cancelScheduledValues(ctx.currentTime);
      decks.A.gain.gain.value = gainA;
    }
    if (decks.B) {
      decks.B.gain.gain.cancelScheduledValues(ctx.currentTime);
      decks.B.gain.gain.value = gainB;
    }
  }

  const crossfaderEl = $("crossfader");
  if (crossfaderEl) {
    crossfaderEl.addEventListener("input", (e) => {
      if (AUTO_MIX) toggleAutoMix(); // Disable Auto-Mix when manual fader is grabbed
      const val = parseFloat(e.target.value);
      applyCrossfader(val);
    });
  }

document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  switch (e.key) {
    case " ": e.preventDefault(); togglePlay("A"); break;
    case "m": case "M": triggerMix(); break;
    case "t": case "T": toggleTracklist(); break;
    case "Escape": if ($("overlay").classList.contains("on")) toggleTracklist(); break;
    case "f": case "F": toggleFullscreen(); break;
    case "s": case "S": toggleSnippetMode(); break;
    case "ArrowLeft": seek("A", -15); break;
    case "ArrowRight": seek("A", 15); break;
    case "ArrowUp": adjustTempo("A", 0.5); break;
    case "ArrowDown": adjustTempo("A", -0.5); break;
    case "r": case "R": $("aTempo").value = 0; $("aTempo").dispatchEvent(new Event("input")); break;
    case "1": fx("kick"); break;
    case "2": fx("snare"); break;
    case "3": fx("hat"); break;
    case "4": fx("echo"); break;
    case "5": fx("horn"); break;
    case "6": fx("riser"); break;
    case "7": fx("drop"); break;
    case "8": fx("tapestop"); break;
    case "Escape": 
    case "Backspace": panicReset(); if ($("overlay").classList.contains("on")) toggleTracklist(); break;
  }
});

function adjustTempo(which, dx) {
  const el = $(which.toLowerCase() + "Tempo");
  el.value = Math.max(-15, Math.min(15, parseFloat(el.value) + dx));
  el.dispatchEvent(new Event("input"));
}

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
}

document.addEventListener("DOMContentLoaded", init);

let jogState = { A: { isDragging: false, isBraking: false, lastX: 0, startX: 0, angle: 0 }, B: { isDragging: false, isBraking: false, lastX: 0, startX: 0, angle: 0 } };
["A", "B"].forEach(k => {
  const wheel = $("" + k.toLowerCase() + "Jog");
  const center = $("" + k.toLowerCase() + "JogCenter");
  const audio = $("audio" + k);
  
  center.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    jogState[k].isBraking = true;
    wheel.classList.add("braking");
    wheel.classList.remove("playing");
    audio.playbackRate = 0.01;
  });
  const releaseBrake = () => {
    if(!jogState[k].isBraking) return;
    jogState[k].isBraking = false;
    wheel.classList.remove("braking");
    audio.playbackRate = 1 + parseFloat($("" + k.toLowerCase() + "Tempo").value)/100;
  };
  center.addEventListener("pointerup", releaseBrake);
  center.addEventListener("pointerleave", releaseBrake);

  wheel.addEventListener("pointerdown", (e) => {
    if(jogState[k].isBraking) return;
    jogState[k].isDragging = true;
    jogState[k].startX = e.clientX;
    jogState[k].lastX = e.clientX;
    wheel.classList.add("nudging");
    wheel.classList.remove("playing");
    wheel.setPointerCapture(e.pointerId);
  });
  wheel.addEventListener("pointermove", (e) => {
    if(!jogState[k].isDragging) return;
    const deltaX = e.clientX - jogState[k].lastX;
    jogState[k].lastX = e.clientX;
    const baseRate = 1 + parseFloat($("" + k.toLowerCase() + "Tempo").value)/100;
    
    // Very gentle nudge (100 pixels = 15% pitch bend)
    let newRate = baseRate + (deltaX * 0.0015);
    newRate = Math.max(0.1, Math.min(newRate, 2.5));
    audio.playbackRate = newRate;
    
    // Require a fast, aggressive swipe for spinback (60px delta in one frame)
    if (deltaX < -60) {
       triggerSpinback(k);
       jogState[k].isDragging = false;
       wheel.classList.remove("nudging");
       wheel.releasePointerCapture(e.pointerId);
    }
  });
  const releaseNudge = (e) => {
    if(!jogState[k].isDragging) return;
    jogState[k].isDragging = false;
    wheel.classList.remove("nudging");
    const baseRate = 1 + parseFloat($("" + k.toLowerCase() + "Tempo").value)/100;
    audio.playbackRate = baseRate;
  };
  wheel.addEventListener("pointerup", releaseNudge);
  wheel.addEventListener("pointercancel", releaseNudge);
});

function triggerSpinback(k) {
  const wheel = $("" + k.toLowerCase() + "Jog");
  const audio = $("audio" + k);
  wheel.classList.add("spinback");
  if(ctx) {
    const o = ctx.createOscillator(); o.type = "sawtooth";
    o.frequency.setValueAtTime(800, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    o.connect(g);
    if(decks[k]) g.connect(decks[k].gain);
    o.start(); o.stop(ctx.currentTime + 0.3);
  }
  audio.currentTime = Math.max(0, audio.currentTime - 4);
  audio.pause();
  setTimeout(() => wheel.classList.remove("spinback"), 300);
}

function loadFullTrack(idx) {
  const t = TRACKS[idx];
  t.skip = 0;
  
  const isAActive = $("deckA").classList.contains("active");
  const targetK = isAActive ? "B" : "A";
  
  loadOnDeck(targetK, idx);
  
  if (targetK === "A") {
    currentIdx = idx;
    aLoaded = true;
  } else {
    nextIdx = idx;
    bLoaded = true;
    $("nextTitle").textContent = (t.isRequest ? "[REQ] " : "") + `#${t.n} — ${t.id}`;
  }
  
  $("statMsg").textContent = `Loaded ${t.id} (FULL) into Deck ${targetK}`;
  setTimeout(() => $("statMsg").textContent = "", 3000);
  toggleTracklist();
  renderUpNext();
}

document.getElementById("reqBtn").addEventListener("click", async () => {
    const url = $("reqUrl").value.trim();
    if (!url) return;
    $("reqBtn").disabled = true;
    $("reqStatus").style.color = "var(--warn)";
    $("reqStatus").textContent = "Downloading...";
    
    try {
        const res = await fetch("http://127.0.0.1:8766/api/request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: url })
        });
        const data = await res.json();
        
        if (data.success) {
            $("reqStatus").style.color = "var(--ok)";
            $("reqStatus").textContent = "Ready in library";
            $("reqUrl").value = "";
            
            TRACKS.push({
                n: TRACKS.length,
                id: data.title,
                url: data.filename,
                skip: 0,
                isRequest: true
            });
            buildTracklistOverlay();
            renderUpNext();
        } else {
            $("reqStatus").style.color = "var(--warn)";
            $("reqStatus").textContent = "Failed";
        }
    } catch (e) {
        $("reqStatus").style.color = "var(--warn)";
        $("reqStatus").textContent = "Network Error";
    }
    $("reqBtn").disabled = false;
    setTimeout(() => $("reqStatus").textContent = "", 4000);
});


let bassBoostActive = false;
function toggleBassBoost() {
  if (!ctx) initAudio();
  bassBoostActive = !bassBoostActive;
  if (bassBoostActive) {
      if(masterBassBoost) masterBassBoost.gain.value = 15;
      const b = document.getElementById("bassBoostBtn");
      if(b) { b.style.background = "#ff0055"; b.style.borderColor = "#ff0055"; }
  } else {
      if(masterBassBoost) masterBassBoost.gain.value = 0;
      const b = document.getElementById("bassBoostBtn");
      if(b) { b.style.background = "#222"; b.style.borderColor = "#555"; }
  }
}

let micActive = false;
async function toggleMic() {
  if (!ctx) initAudio();
  if (!micActive) {
      try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micNode = ctx.createMediaStreamSource(micStream);
          if (masterDrive) micNode.connect(masterDrive);
          micActive = true;
          const b = document.getElementById("micBtn");
          if(b) { b.innerHTML = "🎙️ MIC ON"; b.style.background = "#f00"; b.style.borderColor = "#f00"; }
      } catch(e) { alert("Mic error: " + e.message); }
  } else {
      if (micStream) micStream.getTracks().forEach(t => t.stop());
      if (micNode) micNode.disconnect();
      micNode = null; micStream = null;
      micActive = false;
      const b = document.getElementById("micBtn");
      if(b) { b.innerHTML = "🎙️ MIC OFF"; b.style.background = "#222"; b.style.borderColor = "#555"; }
  }
}

function playSample(type) {
    if (!ctx) initAudio();
    if (ctx.state === "suspended") ctx.resume();
    const t = ctx.currentTime;
    
    if (type === 'kick') {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); if(masterLimiter) gain.connect(masterLimiter); else gain.connect(masterGain);
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.5);
        gain.gain.setValueAtTime(1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        osc.start(t); osc.stop(t + 0.5);
    } 
    else if (type === 'snare') {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'triangle'; osc.connect(gain); if(masterLimiter) gain.connect(masterLimiter); else gain.connect(masterGain);
        osc.frequency.setValueAtTime(250, t);
        gain.gain.setValueAtTime(1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        osc.start(t); osc.stop(t + 0.2);
        const bufferSize = ctx.sampleRate * 0.2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource(); noise.buffer = buffer;
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'highpass'; noiseFilter.frequency.value = 1000;
        noise.connect(noiseFilter); noiseFilter.connect(gain);
        noise.start(t);
    }
    else if (type === 'darbuka') {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'sine'; osc.connect(gain); if(masterLimiter) gain.connect(masterLimiter); else gain.connect(masterGain);
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
        gain.gain.setValueAtTime(1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        osc.start(t); osc.stop(t + 0.15);
    }
    else if (type === 'chenda') {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'square'; osc.connect(gain); if(masterLimiter) gain.connect(masterLimiter); else gain.connect(masterGain);
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.linearRampToValueAtTime(200, t + 0.2);
        gain.gain.setValueAtTime(0.8, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        osc.start(t); osc.stop(t + 0.3);
    }
    else if (type === 'drums') {
        for(let i=0; i<3; i++) {
            let delay = i * 0.15;
            const osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.connect(gain); if(masterLimiter) gain.connect(masterLimiter); else gain.connect(masterGain);
            osc.frequency.setValueAtTime(200 - (i*40), t + delay);
            osc.frequency.exponentialRampToValueAtTime(0.01, t + delay + 0.3);
            gain.gain.setValueAtTime(1, t + delay);
            gain.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.3);
            osc.start(t + delay); osc.stop(t + delay + 0.3);
        }
    }
    else if (type === 'violin') {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'sawtooth'; osc.connect(gain); if(masterLimiter) gain.connect(masterLimiter); else gain.connect(masterGain);
        const lfo = ctx.createOscillator(); lfo.frequency.value = 6;
        const lfoGain = ctx.createGain(); lfoGain.gain.value = 10;
        lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
        osc.frequency.setValueAtTime(659.25, t);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.5, t + 0.1);
        gain.gain.setValueAtTime(0.5, t + 0.5);
        gain.gain.linearRampToValueAtTime(0, t + 0.8);
        lfo.start(t); osc.start(t); osc.stop(t + 0.8); lfo.stop(t + 0.8);
    }
}

function stopDeck(which) {
  const a = $("audio" + which);
  if (a) {
    a.pause();
    a.currentTime = 0;
  }
  const btn = $(which.toLowerCase() + "PlayCircle");
  if (btn) {
    btn.innerHTML = "&#9658;"; // Play icon
  }
}
