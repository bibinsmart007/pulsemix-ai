const fs = require('fs');
let lines = fs.readFileSync('public/dj_live.html', 'utf8').split('\\n');

const deckA = \`    <div class="player-bar" style="margin-bottom:8px;">
      <button class="player-icon-btn" onclick="toggleAutoMix()" title="Toggle Auto-Mix">&#128256;</button>
      <button class="player-icon-btn" onclick="toggleAutoLoop('A')" title="Loop 4 Beats">&#128257;</button>
      <div class="divider"></div>
      <button class="player-icon-btn" onclick="seek('A', -9999); togglePlay('A');" title="Stop">&#9209;</button>
      <button class="player-icon-btn" onclick="seek('A', -10)" title="Rewind 10s">&#9194;</button>
      <button class="player-play-btn" onclick="togglePlay('A')" id="aPlayCircle">&#9658;</button>
      <button class="player-icon-btn" onclick="seek('A', 10)" title="Forward 10s">&#9193;</button>
      <div class="divider"></div>
      <span style="color:#aaa; font-size:14px;">&#128266;</span>
      <input type="range" class="player-vol-slider" min="0" max="1" step="0.01" value="1" oninput="if(decks.A) { decks.A.gain.gain.value = this.value; }">
    </div>
    <div class="deck-btns">
      <button class="btn" onclick="resetEQ('A')">RESET EQ</button>
      <button class="btn" id="aAcapellaBtn" onclick="toggleAcapella('A')" style="border-color:#00d4ff; color:#00d4ff; font-size: 10px;">&#127897;&#65039; ACA</button>
      <button class="btn" id="aInstBtn" onclick="toggleInstrumental('A')" style="border-color:#ff2bd6; color:#ff2bd6; font-size: 10px;">&#127929; INST</button>
    </div>\`;

const deckB = \`    <div class="player-bar" style="margin-bottom:8px;">
      <button class="player-icon-btn" onclick="toggleAutoMix()" title="Toggle Auto-Mix">&#128256;</button>
      <button class="player-icon-btn" onclick="toggleAutoLoop('B')" title="Loop 4 Beats">&#128257;</button>
      <div class="divider"></div>
      <button class="player-icon-btn" onclick="seek('B', -9999); togglePlay('B');" title="Stop">&#9209;</button>
      <button class="player-icon-btn" onclick="seek('B', -10)" title="Rewind 10s">&#9194;</button>
      <button class="player-play-btn" onclick="togglePlay('B')" id="bPlayCircle">&#9658;</button>
      <button class="player-icon-btn" onclick="seek('B', 10)" title="Forward 10s">&#9193;</button>
      <div class="divider"></div>
      <span style="color:#aaa; font-size:14px;">&#128266;</span>
      <input type="range" class="player-vol-slider" min="0" max="1" step="0.01" value="1" oninput="if(decks.B) { decks.B.gain.gain.value = this.value; }">
    </div>
    <div class="deck-btns">
      <button class="btn cyan" onclick="loadNextOnDeckB()">LOAD NEXT</button>
      <button class="btn" onclick="resetEQ('B')">RESET EQ</button>
      <button class="btn" id="bAcapellaBtn" onclick="toggleAcapella('B')" style="border-color:#00d4ff; color:#00d4ff; font-size: 10px;">&#127897;&#65039; ACA</button>
      <button class="btn" id="bInstBtn" onclick="toggleInstrumental('B')" style="border-color:#ff2bd6; color:#ff2bd6; font-size: 10px;">&#127929; INST</button>
    </div>\`;

// Splice lines 332-364 (index 331 to 363 -> 33 items)
lines.splice(331, 33, deckB);

// Splice lines 292-300 (index 291 to 299 -> 9 items)
lines.splice(291, 9, deckA);

fs.writeFileSync('public/dj_live.html', lines.join('\\n'));
console.log("Success");
