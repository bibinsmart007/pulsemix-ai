import re

js_code = """
// Modes
function setMode(mode) {
  document.body.className = 'mode-' + mode;
  document.querySelectorAll('.mode-tabs .btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('modeBtn' + mode.charAt(0).toUpperCase() + mode.slice(1));
  if (btn) btn.classList.add('active');
}
setMode('livedj');

// Clip Detection
setInterval(() => {
  if(!masterLimiter) return;
  const reduction = masterLimiter.reduction;
  const reductionValue = typeof reduction === 'number' ? reduction : reduction.value;
  const badge = document.getElementById('masterClipBadge');
  if (badge) {
      if (reductionValue < -0.5) {
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
  }
}, 100);

// Error States & Preloading
['A', 'B'].forEach(k => {
  const audio = document.getElementById('audio' + k);
  if (audio) {
      audio.onerror = () => {
        showError("Failed to load audio for Deck " + k);
      };
      audio.onstalled = () => {
        console.warn("Audio stalled for Deck " + k);
      };
  }
});

function showError(msg) {
  const err = document.getElementById('startErr');
  if (err) {
      err.innerText = msg;
      err.style.display = 'block';
      setTimeout(() => err.style.display = 'none', 5000);
  }
}

// Waveform logic hook
function drawWaveform(deckKey) {
  const canvas = document.getElementById(deckKey.toLowerCase() + 'Wave');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = deckKey === 'A' ? 'var(--deck-glow, rgba(255, 0, 127), 0.5)' : 'var(--deck-glow, rgba(0, 240, 255), 0.5)';
  // Simple mock static waveform representation for now
  for(let i=0; i<w; i+=4) {
    const v = Math.random() * h * 0.8 + 2;
    ctx.fillRect(i, h/2 - v/2, 2, v);
  }
}


// Clock
setInterval(() => {
    const d = new Date();
    const el = document.getElementById('topClock');
    if (el) el.innerText = d.toLocaleTimeString('en-US', { hour12: false });
}, 1000);


// Loop and Beat Jump Logic
let loopStates = { A: { in: null, out: null, active: false, interval: null }, B: { in: null, out: null, active: false, interval: null } };

function loopIn(k) {
  const audio = document.getElementById('audio' + k);
  if(!audio) return;
  loopStates[k].in = audio.currentTime;
  if(loopStates[k].out && loopStates[k].in >= loopStates[k].out) loopStates[k].out = null;
  loopStates[k].active = true;
  checkLoop(k);
}

function loopOut(k) {
  const audio = document.getElementById('audio' + k);
  if(!audio || loopStates[k].in === null) return;
  loopStates[k].out = audio.currentTime;
  loopStates[k].active = true;
  checkLoop(k);
}

function checkLoop(k) {
  if(loopStates[k].interval) clearInterval(loopStates[k].interval);
  if(loopStates[k].active && loopStates[k].in !== null && loopStates[k].out !== null) {
     loopStates[k].interval = setInterval(() => {
        const audio = document.getElementById('audio' + k);
        if(audio && audio.currentTime >= loopStates[k].out) {
           audio.currentTime = loopStates[k].in;
        }
     }, 10);
  }
}

function halveLoop(k) {
  if(loopStates[k].in !== null && loopStates[k].out !== null) {
      const diff = loopStates[k].out - loopStates[k].in;
      loopStates[k].out = loopStates[k].in + (diff / 2);
  }
}

function doubleLoop(k) {
  if(loopStates[k].in !== null && loopStates[k].out !== null) {
      const diff = loopStates[k].out - loopStates[k].in;
      loopStates[k].out = loopStates[k].in + (diff * 2);
  }
}

function beatJump(k, beats) {
  const audio = document.getElementById('audio' + k);
  if(!audio) return;
  const bpmText = document.getElementById(k.toLowerCase() + 'BpmTxt').innerText;
  const bpm = parseFloat(bpmText) || 128.0;
  const secondsPerBeat = 60 / bpm;
  audio.currentTime += (beats * secondsPerBeat);
}
"""

with open("public/dj_live.html", "r", encoding="utf-8") as f:
    content = f.read()

# Only append if not already there
if "function drawWaveform" not in content:
    content = content.replace("</script>", js_code + "\n</script>", 1)

with open("public/dj_live.html", "w", encoding="utf-8") as f:
    f.write(content)

print("Applied missing JS functions to the main block.")
