import re

with open("public/dj_live.html", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update HTML Buttons for Deck A
deckA_loop = """<button class="btn" onclick="loopIn('A')" style="flex:1; padding:6px 0; font-size:10px;">IN</button>
       <button class="btn" onclick="loopOut('A')" style="flex:1; padding:6px 0; font-size:10px;">OUT</button>
       <button class="btn" onclick="halveLoop('A')" style="flex:1; padding:6px 0; font-size:10px;">1/2</button>
       <button class="btn" onclick="doubleLoop('A')" style="flex:1; padding:6px 0; font-size:10px;">2X</button>"""

deckA_jump = """<button class="btn" onclick="beatJump('A', -8)" style="flex:1; padding:6px 0; font-size:10px;">-8</button>
       <button class="btn" onclick="beatJump('A', -4)" style="flex:1; padding:6px 0; font-size:10px;">-4</button>
       <button class="btn" onclick="beatJump('A', 4)" style="flex:1; padding:6px 0; font-size:10px;">+4</button>
       <button class="btn" onclick="beatJump('A', 8)" style="flex:1; padding:6px 0; font-size:10px;">+8</button>"""

# Find and replace Deck A loop block
content = re.sub(
    r'<button class="btn" onclick="toggleAutoLoop\(\'A\'\)"[^>]*>IN</button>\s*<button class="btn" onclick="toggleAutoLoop\(\'A\'\)"[^>]*>OUT</button>\s*<button class="btn"[^>]*>1/2</button>\s*<button class="btn"[^>]*>2X</button>',
    deckA_loop,
    content
)

# Find and replace Deck A beat jump block
content = re.sub(
    r'<button class="btn" onclick="seek\(\'A\', -8\)"[^>]*>-8</button>\s*<button class="btn" onclick="seek\(\'A\', -4\)"[^>]*>-4</button>\s*<button class="btn" onclick="seek\(\'A\', 4\)"[^>]*>\+4</button>\s*<button class="btn" onclick="seek\(\'A\', 8\)"[^>]*>\+8</button>',
    deckA_jump,
    content
)

# 2. Update HTML Buttons for Deck B
deckB_loop = """<button class="btn" onclick="loopIn('B')" style="flex:1; padding:6px 0; font-size:10px;">IN</button>
       <button class="btn" onclick="loopOut('B')" style="flex:1; padding:6px 0; font-size:10px;">OUT</button>
       <button class="btn" onclick="halveLoop('B')" style="flex:1; padding:6px 0; font-size:10px;">1/2</button>
       <button class="btn" onclick="doubleLoop('B')" style="flex:1; padding:6px 0; font-size:10px;">2X</button>"""

deckB_jump = """<button class="btn" onclick="beatJump('B', -8)" style="flex:1; padding:6px 0; font-size:10px;">-8</button>
       <button class="btn" onclick="beatJump('B', -4)" style="flex:1; padding:6px 0; font-size:10px;">-4</button>
       <button class="btn" onclick="beatJump('B', 4)" style="flex:1; padding:6px 0; font-size:10px;">+4</button>
       <button class="btn" onclick="beatJump('B', 8)" style="flex:1; padding:6px 0; font-size:10px;">+8</button>"""

# Find and replace Deck B loop block
content = re.sub(
    r'<button class="btn" onclick="toggleAutoLoop\(\'B\'\)"[^>]*>IN</button>\s*<button class="btn" onclick="toggleAutoLoop\(\'B\'\)"[^>]*>OUT</button>\s*<button class="btn"[^>]*>1/2</button>\s*<button class="btn"[^>]*>2X</button>',
    deckB_loop,
    content
)

# Find and replace Deck B beat jump block
content = re.sub(
    r'<button class="btn" onclick="seek\(\'B\', -8\)"[^>]*>-8</button>\s*<button class="btn" onclick="seek\(\'B\', -4\)"[^>]*>-4</button>\s*<button class="btn" onclick="seek\(\'B\', 4\)"[^>]*>\+4</button>\s*<button class="btn" onclick="seek\(\'B\', 8\)"[^>]*>\+8</button>',
    deckB_jump,
    content
)

# 3. Inject JS Logic
js_code = """
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

content = content.replace("</script>", js_code + "\n</script>")

with open("public/dj_live.html", "w", encoding="utf-8") as f:
    f.write(content)

print("Wiring Complete.")
