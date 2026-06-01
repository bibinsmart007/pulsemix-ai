import re
import os

with open("public/dj_live.html", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update Body CSS
content = content.replace(
    "body { display: grid; grid-template-rows: auto auto auto auto auto; gap: 15px; padding: 15px; }",
    "body { display: flex; flex-direction: column; gap: 10px; padding: 10px; height: 100vh; overflow: hidden; }"
)

# 2. Add structural CSS for Performance Zone and Library
css_additions = """
  .performance-zone { display: grid; grid-template-columns: 1fr 280px 1fr; gap: 15px; flex: 1; min-height: 0; }
  .library-tray { flex: 0 0 32vh; margin: 0; overflow-y: auto; background: rgba(10,10,15,0.8); }
  
  /* Library List Redesign */
  .lib-list { display: flex; flex-direction: column; gap: 4px; }
  .lib-item { display: grid; grid-template-columns: 50px 1fr 1fr 80px 80px; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 6px; cursor: pointer; align-items: center; transition: 0.1s; border: 1px solid transparent; }
  .lib-item:hover { background: rgba(255,255,255,0.07); }
  .lib-item.selected { background: rgba(255,0,127,0.15); border-color: rgba(255,0,127,0.5); }
  .lib-item-title { font-weight: bold; font-size: 14px; }
  .lib-item-artist { color: var(--dim); font-size: 12px; }
  .lib-item-meta { font-family: 'Orbitron', monospace; font-size: 11px; color: var(--accent2); }
  
  .lib-action-tray { display: flex; gap: 15px; justify-content: center; padding: 10px; background: #000; border-top: 1px solid var(--border); position: sticky; bottom: 0; z-index: 20; opacity: 0; pointer-events: none; transition: 0.2s; }
  .lib-action-tray.active { opacity: 1; pointer-events: auto; }
  
  /* Hiding the .bottom section */
  .bottom { display: none; }
"""
content = content.replace("</style>", f"{css_additions}\n</style>")

# 3. Extract and re-arrange the Decks and Mixer
import re
# We'll use a simpler approach: string replacement to inject the wrapper.
content = content.replace('<div class="decks">', '<div class="performance-zone">')
content = content.replace('</div>\n\n<div class="mixer">', '\n<div class="mixer">')
# Close the performance-zone after mixer
content = content.replace('</div>\n\n<div class="bottom">', '</div>\n</div>\n\n<div class="bottom">')

# 4. Modify Deck B to only have cyan styling, Deck A pink.
content = content.replace('var(--accent)', 'var(--deck-color, var(--accent))')
content = content.replace('var(--accent2)', 'var(--deck-color, var(--accent2))')
content = content.replace('rgba(255, 0, 127', 'var(--deck-glow, rgba(255, 0, 127)')
content = content.replace('rgba(0, 240, 255', 'var(--deck-glow, rgba(0, 240, 255)')

css_decks = """
  .deck#deckA { --deck-color: #ff007f; --deck-glow: rgba(255,0,127,0.6); border-top: 3px solid #ff007f; }
  .deck#deckB { --deck-color: #00f0ff; --deck-glow: rgba(0,240,255,0.6); border-top: 3px solid #00f0ff; }
  .jog-wheel { width: 140px; height: 140px; } /* Adjust jog wheel for 3-col layout */
  .wave { height: 90px; }
"""
content = content.replace("</style>", f"{css_decks}\n</style>")

# 5. Rewrite renderLibrary logic in JS
render_lib_search = """  function renderLibrary() {"""
render_lib_replace = """
  let selectedLibraryIndex = -1;
  window.selectTrack = function(index) {
    selectedLibraryIndex = index;
    document.querySelectorAll('.lib-item').forEach(el => el.classList.remove('selected'));
    document.getElementById('lib-item-' + index).classList.add('selected');
    document.getElementById('libActionTray').classList.add('active');
  };
  
  function renderLibrary() {
    const list = $("libraryList");
    if (!list) return;
    list.innerHTML = "";
    
    // Inject action tray if it doesn't exist
    if(!document.getElementById('libActionTray')) {
      const tray = document.createElement('div');
      tray.id = 'libActionTray';
      tray.className = 'lib-action-tray';
      tray.innerHTML = `
        <button class="btn" style="border-color:#ff007f; color:#ff007f; padding:10px 30px; font-weight:900;" onclick="if(selectedLibraryIndex!==-1) loadTrackFromLibrary('A', selectedLibraryIndex)">LOAD TO DECK A</button>
        <button class="btn" style="border-color:#00f0ff; color:#00f0ff; padding:10px 30px; font-weight:900;" onclick="if(selectedLibraryIndex!==-1) loadTrackFromLibrary('B', selectedLibraryIndex)">LOAD TO DECK B</button>
      `;
      $("libraryTray").appendChild(tray);
    }
    
    // Header Row
    list.innerHTML += `
      <div style="display:grid; grid-template-columns: 50px 1fr 1fr 80px 80px; padding:0 10px; color:var(--dim); font-size:10px; font-weight:800; letter-spacing:1px;">
        <span>ART</span><span>TITLE</span><span>ARTIST</span><span>BPM</span><span>KEY</span>
      </div>
    `;

    [...TRACKS].reverse().forEach((t) => {
      const index = TRACKS.indexOf(t);
      const div = document.createElement("div");
      div.className = "lib-item";
      div.id = "lib-item-" + index;
      div.onclick = () => selectTrack(index);
      
      // Mocking better metadata out of raw IDs
      let mockTitle = "Pulse Track " + t.n;
      let mockArtist = "PulseMix DJ";
      if(t.file.includes("opening")) mockTitle = "Opening Set";
      
      div.innerHTML = `
        <div><div style="width:30px;height:30px;background:#222;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:16px;">🎵</div></div>
        <div class="lib-item-title">${mockTitle}</div>
        <div class="lib-item-artist">${mockArtist}</div>
        <div class="lib-item-meta">${t.bpm ? Math.round(t.bpm) : '128.0'}</div>
        <div class="lib-item-meta">Am</div>
      `;
      list.appendChild(div);
    });
"""

# Doing regex replacement for renderLibrary block
# Since we know `renderLibrary()` up to `renderUpNext();\n    }`
import re
content = re.sub(r'function renderLibrary\(\) \{[\s\S]*?renderUpNext\(\);\s*\}', render_lib_replace + "\n    renderUpNext();\n  }", content)


with open("public/dj_live.html", "w", encoding="utf-8") as f:
    f.write(content)

print("Layout Refactor Complete.")
