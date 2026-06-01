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

  const T = beatInterval * 4; 
  
  bAudio.play().catch(e => console.warn(e));
  if($("bPlayCircle")) $("bPlayCircle").innerHTML = "&#10074;&#10074;";
  $("bBadge").textContent = "INCOMING";
  $("deckB").classList.add("active"); $("deckB").classList.remove("cued");

  B.lpf.frequency.cancelScheduledValues(now); B.lpf.frequency.value = 20000;
  B.hpf.frequency.cancelScheduledValues(now); B.hpf.frequency.value = 20;
  B.low.gain.cancelScheduledValues(now); B.low.gain.value = 0; 

  if (mixIntervalId) clearInterval(mixIntervalId);
  const mixStart = ctx.currentTime;
  
  if ($("crossfader")) { $("crossfader").value = 0; applyCrossfader(0); }
  
  A.low.gain.cancelScheduledValues(now);
  A.low.gain.setValueAtTime(A.low.gain.value || 0, now);
  A.low.gain.linearRampToValueAtTime(-40, now + 0.1); 
  
  A.mid.gain.cancelScheduledValues(now);
  A.mid.gain.linearRampToValueAtTime(-10, now + T * 0.5);

  A.hpf.frequency.cancelScheduledValues(now);
  A.hpf.frequency.setValueAtTime(20, now);
  A.hpf.frequency.exponentialRampToValueAtTime(10000, now + T * 0.8); 

  mixIntervalId = setInterval(() => {
    let progress = (ctx.currentTime - mixStart) / T;
    if (progress >= 1) { progress = 1; clearInterval(mixIntervalId); }
    if ($("crossfader")) {
      $("crossfader").value = progress;
      applyCrossfader(progress);
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

