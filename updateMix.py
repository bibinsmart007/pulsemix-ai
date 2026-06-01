import os

with open("public/dj_live.html", "r", encoding="utf-8") as f:
    html = f.read()

old_func = """function triggerMix() {
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
}"""

new_func = """function triggerMix() {
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
}"""

if old_func in html:
    html = html.replace(old_func, new_func)
    print("Function replaced successfully!")
else:
    print("Error: Could not find old function in html!")

with open("public/dj_live.html", "w", encoding="utf-8") as f:
    f.write(html)
