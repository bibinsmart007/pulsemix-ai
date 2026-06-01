import re
import os

with open("public/dj_live.html", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update Labels
content = content.replace('SNIPPET [S]', 'Snippet Mode (S)')
content = content.replace('TRACKLIST [T]', 'Tracklist (T)')
content = content.replace('FULL [F]', 'Fullscreen (F)')
content = content.replace('MIX NOW [M]', 'Mix Now (M)')
content = content.replace('&#127897;&#65039; ACA', '&#127897;&#65039; Acapella Extract')
content = content.replace('&#127929; INST', '&#127929; Instrumental Extract')

# 2. Add Modes Switcher & Clip Badge
mode_html = """
  <div class="mode-tabs" style="display:flex; gap:5px; margin-left:15px; background:rgba(0,0,0,0.5); padding:5px; border-radius:8px;">
    <button class="btn active" id="modeBtnLive" onclick="setMode('livedj')" style="font-size:11px; padding:6px 12px;">LIVE DJ</button>
    <button class="btn" id="modeBtnAuto" onclick="setMode('autodj')" style="font-size:11px; padding:6px 12px;">AUTO DJ</button>
    <button class="btn" id="modeBtnPrep" onclick="setMode('prep')" style="font-size:11px; padding:6px 12px;">PREP</button>
    <button class="btn" id="modeBtnRec" onclick="setMode('rec')" style="font-size:11px; padding:6px 12px;">RECORD</button>
  </div>
  <span class="badge" id="masterClipBadge" style="display:none; margin-left:10px; background:#ff3300; color:#fff; border-color:#fff; animation:none;">LIMITER ACTIVE</span>
"""

content = content.replace('<div class="spacer"></div>', f'<div class="spacer"></div>{mode_html}')

# 3. Add CSS for modes and better hierarchy
css_additions = """
  .mode-tabs .btn.active { background: var(--accent); color: #fff; box-shadow: 0 0 10px var(--accent-glow); }
  
  /* Mode Visibility Rules */
  body.mode-livedj .library-tray { display: none; }
  body.mode-autodj .deck-btns, body.mode-autodj .fx-grid, body.mode-autodj .hotcue-row, body.mode-autodj .mixer .btn { opacity: 0.2; pointer-events: none; }
  body.mode-prep .decks, body.mode-prep .mixer, body.mode-prep .fx-grid { display: none; }
  body.mode-rec .decks, body.mode-rec .fx-grid { opacity: 0.5; }
  
  /* Hierarchy Improvements */
  .player-play-btn { width: 70px; height: 70px; font-size: 30px; } /* Enlarge Play */
  .btn.primary { font-size: 14px; padding: 12px 24px; } /* Enlarge Mix Now */
  .library-tray .btn.primary { font-size: 14px; padding: 10px 20px; background: var(--accent2); }
"""
content = content.replace('</style>', f'{css_additions}\n</style>')

# 4. Audio Routing (Limiter)
routing_search = """masterGain.connect(masterAnalyser);
  masterAnalyser.connect(ctx.destination);"""
routing_replace = """masterLimiter = ctx.createDynamicsCompressor();
  masterLimiter.threshold.value = -1.0;
  masterLimiter.knee.value = 0.0;
  masterLimiter.ratio.value = 20.0;
  masterLimiter.attack.value = 0.005;
  masterLimiter.release.value = 0.050;
  
  masterGain.connect(masterLimiter);
  masterLimiter.connect(masterAnalyser);
  masterAnalyser.connect(ctx.destination);"""
content = content.replace(routing_search, routing_replace)

# 5. Peak/Clip detection interval
js_additions = """
// Modes
function setMode(mode) {
  document.body.className = 'mode-' + mode;
  document.querySelectorAll('.mode-tabs .btn').forEach(b => b.classList.remove('active'));
  document.getElementById('modeBtn' + mode.charAt(0).toUpperCase() + mode.slice(1)).classList.add('active');
}
setMode('livedj');

// Clip Detection
setInterval(() => {
  if(!masterLimiter) return;
  const reduction = masterLimiter.reduction;
  const reductionValue = typeof reduction === 'number' ? reduction : reduction.value;
  const badge = document.getElementById('masterClipBadge');
  if (reductionValue < -0.5) {
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}, 100);

// Error States & Preloading
['A', 'B'].forEach(k => {
  const audio = document.getElementById('audio' + k);
  audio.onerror = () => {
    showError("Failed to load audio for Deck " + k);
  };
  audio.onstalled = () => {
    console.warn("Audio stalled for Deck " + k);
  };
});

function showError(msg) {
  const err = document.getElementById('startErr');
  err.innerText = msg;
  err.style.display = 'block';
  setTimeout(() => err.style.display = 'none', 5000);
}

// Waveform logic hook
function drawWaveform(deckKey) {
  const canvas = document.getElementById(deckKey.toLowerCase() + 'Wave');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = deckKey === 'A' ? 'rgba(255, 0, 127, 0.5)' : 'rgba(0, 240, 255, 0.5)';
  // Simple mock static waveform representation for now
  for(let i=0; i<w; i+=4) {
    const v = Math.random() * h * 0.8 + 2;
    ctx.fillRect(i, h/2 - v/2, 2, v);
  }
}
"""

# Inject JS at the end
content = content.replace('</script>', f'{js_additions}\n</script>')

# Hook drawWaveform into loadNextOnDeck
content = re.sub(r'(decks\[deckKey\]\.audio\.play\(\);)', r'\1\n  drawWaveform(deckKey);', content)

# 6. Safety Stop Modal
stop_search = "function stopDeck(k) {"
stop_replace = """function stopDeck(k) {
  if (decks[k].gain.gain.value > 0.1 && document.getElementById('audio' + k).currentTime > 0 && !document.getElementById('audio' + k).paused) {
     if(!confirm("Deck " + k + " is LIVE on the master output! Are you sure you want to stop it?")) return;
  }
"""
content = content.replace(stop_search, stop_replace)

with open("public/dj_live.html", "w", encoding="utf-8") as f:
    f.write(content)

print("Upgrade Complete.")
