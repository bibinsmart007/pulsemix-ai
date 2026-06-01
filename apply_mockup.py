import re
import os

with open("public/dj_live.html", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Topbar Replacement
topbar_replacement = """<div class="topbar">
  <h1>PULSEMIX LIVE</h1>
  <span class="badge live" id="liveBadge">REAL-TIME DJ</span>
  <button class="btn" id="recBtn" style="background:#400; color:#f55; border-color:#f55; margin-left: 10px;">🔴 REC SET</button>
  
  <div class="mode-tabs" style="display:flex; gap:5px; margin-left:15px; background:rgba(0,0,0,0.5); padding:5px; border-radius:8px;">
    <button class="btn active" id="modeBtnLive" onclick="setMode('livedj')" style="font-size:11px; padding:6px 12px;">LIVE DJ</button>
    <button class="btn" id="modeBtnAuto" onclick="setMode('autodj')" style="font-size:11px; padding:6px 12px;">AUTO DJ</button>
    <button class="btn" id="modeBtnPrep" onclick="setMode('prep')" style="font-size:11px; padding:6px 12px;">PREP</button>
    <button class="btn" id="modeBtnRec" onclick="setMode('rec')" style="font-size:11px; padding:6px 12px;">RECORD</button>
  </div>
  <span class="badge" id="masterClipBadge" style="display:none; margin-left:10px; background:#ff3300; color:#fff; border-color:#fff;">LIMITER ACTIVE</span>

  <div class="spacer"></div>
  
  <div style="display:flex; gap:15px; font-family:'Orbitron', monospace; font-size:12px; font-weight:800; color:var(--dim);">
      <div>CPU: <span style="color:#00ff7f;">14%</span></div>
      <div>LATENCY: <span style="color:#00ff7f;">3ms</span></div>
      <div id="topClock" style="color:#fff;">00:00:00</div>
  </div>
  
  <button class="btn" onclick="toggleFullscreen()" style="margin-left:15px;">FULLSCREEN (F)</button>
</div>"""

content = re.sub(r'<div class="topbar">.*?</div>\s*<div class="performance-zone">', topbar_replacement + '\n\n<div class="performance-zone">', content, flags=re.DOTALL)

# 2. Performance Zone Replacement
performance_zone_replacement = """<div class="performance-zone">
  
  <!-- DECK A -->
  <div class="deck active" id="deckA">
    <!-- Metadata Header -->
    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
       <div style="display:flex; gap:12px; align-items:center;">
         <div style="width:45px; height:45px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:20px;">🎵</div>
         <div>
           <div class="deck-title" id="aTitle">—</div>
           <div style="font-size:11px; color:var(--dim); font-weight:bold;">PULSEMIX ARTIST</div>
         </div>
       </div>
       <div style="text-align:right;">
          <div style="font-family:'Orbitron', monospace; font-size:24px; font-weight:900; color:var(--deck-color);"><span id="aRemainTxt">-00:00</span></div>
          <div style="font-size:10px; color:var(--dim); font-weight:800; letter-spacing:1px;">BPM: <span id="aBpmTxt">128.0</span> &nbsp;|&nbsp; KEY: Am &nbsp;|&nbsp; <span id="aTime" style="color:#aaa;">0:00 / 0:00</span></div>
       </div>
    </div>
    
    <!-- Waveform & Jog -->
    <div class="wave" style="margin-top:10px;"><canvas id="aWave"></canvas><div class="wave-progress" id="aProg"></div></div>
    <div class="deck-row" style="margin-top:-2px;"><input type="range" class="scrubber a-scrubber" id="aSeekBar" min="0" max="100" step="0.1" value="0"></div>
    
    <div class="jog-container" style="margin: 10px 0;">
      <div class="jog-wheel" id="aJog">
        <div class="jog-grooves"></div>
        <div class="jog-marker-container" id="aJogRot"><div class="jog-marker"></div></div>
        <div class="jog-center" id="aJogCenter" onclick="togglePlay('A')" style="cursor:pointer; z-index:10;">BRAKE</div>
      </div>
    </div>
    
    <!-- Performance Controls -->
    <div style="font-size:10px; font-weight:900; color:var(--dim); letter-spacing:1px; margin-bottom:5px;">HOT CUES</div>
    <div class="hotcue-row" style="margin:0 0 10px 0;">
      <button class="cue-btn" id="btn-cue-A-0" onmousedown="handleHotCue('A', 0, event)" oncontextmenu="event.preventDefault(); handleHotCue('A', 0, event)">1</button>
      <button class="cue-btn" id="btn-cue-A-1" onmousedown="handleHotCue('A', 1, event)" oncontextmenu="event.preventDefault(); handleHotCue('A', 1, event)">2</button>
      <button class="cue-btn" id="btn-cue-A-2" onmousedown="handleHotCue('A', 2, event)" oncontextmenu="event.preventDefault(); handleHotCue('A', 2, event)">3</button>
      <button class="cue-btn" id="btn-cue-A-3" onmousedown="handleHotCue('A', 3, event)" oncontextmenu="event.preventDefault(); handleHotCue('A', 3, event)">4</button>
    </div>
    
    <div style="font-size:10px; font-weight:900; color:var(--dim); letter-spacing:1px; margin-bottom:5px;">LOOP</div>
    <div style="display:flex; gap:8px; margin-bottom:10px;">
       <button class="btn" onclick="toggleAutoLoop('A')" style="flex:1; padding:6px 0; font-size:10px;">IN</button>
       <button class="btn" onclick="toggleAutoLoop('A')" style="flex:1; padding:6px 0; font-size:10px;">OUT</button>
       <button class="btn" style="flex:1; padding:6px 0; font-size:10px;">1/2</button>
       <button class="btn" style="flex:1; padding:6px 0; font-size:10px;">2X</button>
    </div>

    <div style="font-size:10px; font-weight:900; color:var(--dim); letter-spacing:1px; margin-bottom:5px;">BEAT JUMP</div>
    <div style="display:flex; gap:8px; margin-bottom:10px;">
       <button class="btn" onclick="seek('A', -8)" style="flex:1; padding:6px 0; font-size:10px;">-8</button>
       <button class="btn" onclick="seek('A', -4)" style="flex:1; padding:6px 0; font-size:10px;">-4</button>
       <button class="btn" onclick="seek('A', 4)" style="flex:1; padding:6px 0; font-size:10px;">+4</button>
       <button class="btn" onclick="seek('A', 8)" style="flex:1; padding:6px 0; font-size:10px;">+8</button>
    </div>
    
    <div style="display:flex; gap:8px;">
       <button class="btn" style="flex:1; padding:8px 0; font-size:11px; background:#222;">SYNC</button>
       <button class="btn" style="flex:1; padding:8px 0; font-size:11px; background:#222;">MASTER</button>
       <button class="btn" style="flex:1; padding:8px 0; font-size:11px; background:#222;">KEY LOCK</button>
    </div>
  </div>

  <!-- MIXER CENTER -->
  <div class="mixer" style="display:flex; flex-direction:column; background:rgba(20,20,30,0.8); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:15px; box-shadow:0 15px 35px rgba(0,0,0,0.8);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; background:#050505; padding:10px; border-radius:8px; border:1px solid #222;">
         <div style="text-align:center;">
            <div style="font-size:9px; font-weight:bold; color:var(--dim); letter-spacing:1px; margin-bottom:4px;">BOOTH</div>
            <input type="range" class="knob" style="width:40px;">
         </div>
         <div style="text-align:center;">
             <div style="font-size:11px; font-weight:900; color:var(--text); letter-spacing:2px; margin-bottom:4px;">MASTER VU</div>
             <div class="master-meter" style="display:flex; gap:2px; justify-content:center; align-items:flex-end; height:30px; background:#111; padding:4px; border-radius:4px; box-shadow:inset 0 2px 5px #000;">
                 <div class="meter-bar on"></div><div class="meter-bar on"></div><div class="meter-bar on"></div><div class="meter-bar on"></div><div class="meter-bar on hot"></div><div class="meter-bar on hot"></div><div class="meter-bar on peak"></div>
             </div>
         </div>
         <div style="text-align:center;">
            <div style="font-size:9px; font-weight:bold; color:var(--dim); letter-spacing:1px; margin-bottom:4px;">PHONES</div>
            <input type="range" class="knob" style="width:40px;">
         </div>
      </div>
      
      <!-- Channels -->
      <div style="display:flex; gap:15px; flex:1;">
         
         <!-- Channel A Strip -->
         <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:8px; background:rgba(0,0,0,0.4); padding:10px 5px; border-radius:8px; border:1px solid rgba(255,0,127,0.2); box-shadow:inset 0 0 20px rgba(0,0,0,0.8);">
             <div style="font-size:12px; font-weight:900; color:var(--deck-color); text-shadow:0 0 10px rgba(255,0,127,0.5);">CH A</div>
             
             <div style="text-align:center;"><input type="range" class="knob" id="aTempo" min="-15" max="15" step="0.1" value="0"><br><span class="val" style="font-size:9px;">GAIN</span></div>
             <div style="text-align:center;"><input type="range" class="knob" id="aHigh" min="-40" max="12" step="1" value="0"><br><span class="val" style="font-size:9px;">HI</span></div>
             <div style="text-align:center;"><input type="range" class="knob" id="aMid" min="-40" max="12" step="1" value="0"><br><span class="val" style="font-size:9px;">MID</span></div>
             <div style="text-align:center;"><input type="range" class="knob" id="aLow" min="-40" max="12" step="1" value="0"><br><span class="val" style="font-size:9px;">LOW</span></div>
             <div style="text-align:center; margin-bottom:10px;"><input type="range" class="knob" id="aHPF" min="20" max="20000" step="10" value="20"><br><span class="val" style="font-size:9px;">FILTER</span></div>
             
             <button class="btn" style="width:100%; border-radius:4px; padding:6px 0; font-size:11px; font-weight:bold; border-color:var(--deck-color); color:var(--deck-color); box-shadow:0 0 10px rgba(255,0,127,0.2);">CUE</button>
             
             <!-- Vertical Fader replacing horizontal VOL -->
             <div style="flex:1; display:flex; justify-content:center; align-items:flex-end; padding-top:15px; padding-bottom:10px;">
                 <input type="range" id="aVol" min="0" max="1" step="0.01" value="1" style="writing-mode: vertical-lr; direction: rtl; appearance: slider-vertical; width:24px; height:100px; cursor:pointer;">
             </div>
         </div>
         
         <!-- Channel B Strip -->
         <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:8px; background:rgba(0,0,0,0.4); padding:10px 5px; border-radius:8px; border:1px solid rgba(0,240,255,0.2); box-shadow:inset 0 0 20px rgba(0,0,0,0.8);">
             <div style="font-size:12px; font-weight:900; color:var(--deck-color); text-shadow:0 0 10px rgba(0,240,255,0.5);">CH B</div>
             
             <div style="text-align:center;"><input type="range" class="knob" id="bTempo" min="-15" max="15" step="0.1" value="0"><br><span class="val" style="font-size:9px;">GAIN</span></div>
             <div style="text-align:center;"><input type="range" class="knob" id="bHigh" min="-40" max="12" step="1" value="0"><br><span class="val" style="font-size:9px;">HI</span></div>
             <div style="text-align:center;"><input type="range" class="knob" id="bMid" min="-40" max="12" step="1" value="0"><br><span class="val" style="font-size:9px;">MID</span></div>
             <div style="text-align:center;"><input type="range" class="knob" id="bLow" min="-40" max="12" step="1" value="0"><br><span class="val" style="font-size:9px;">LOW</span></div>
             <div style="text-align:center; margin-bottom:10px;"><input type="range" class="knob" id="bLPF" min="200" max="20000" step="10" value="20000"><br><span class="val" style="font-size:9px;">FILTER</span></div>
             
             <button class="btn" style="width:100%; border-radius:4px; padding:6px 0; font-size:11px; font-weight:bold; border-color:var(--deck-color); color:var(--deck-color); box-shadow:0 0 10px rgba(0,240,255,0.2);">CUE</button>
             
             <!-- Vertical Fader replacing horizontal VOL -->
             <div style="flex:1; display:flex; justify-content:center; align-items:flex-end; padding-top:15px; padding-bottom:10px;">
                 <input type="range" id="bVol" min="0" max="1" step="0.01" value="0" style="writing-mode: vertical-lr; direction: rtl; appearance: slider-vertical; width:24px; height:100px; cursor:pointer;">
             </div>
         </div>
      </div>
      
      <!-- Crossfader -->
      <div class="crossfader-container" style="max-width:100%; padding:15px; background:rgba(0,0,0,0.6); margin-top:15px; border-radius:8px; border:1px solid #333;">
          <input type="range" id="crossfader" min="-1" max="1" step="0.01" value="-1" style="width:100%; appearance:none; height:6px; background:#000; border-radius:3px; outline:none;">
          <div style="display:flex; justify-content:space-between; margin-top:8px; font-weight:bold; color:#666; font-size:11px;"><span>A</span><span>B</span></div>
      </div>
  </div>

  <!-- DECK B -->
  <div class="deck" id="deckB">
    <!-- Metadata Header -->
    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
       <div style="display:flex; gap:12px; align-items:center;">
         <div style="width:45px; height:45px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:20px;">🎵</div>
         <div>
           <div class="deck-title" id="bTitle">—</div>
           <div style="font-size:11px; color:var(--dim); font-weight:bold;">PULSEMIX ARTIST</div>
         </div>
       </div>
       <div style="text-align:right;">
          <div style="font-family:'Orbitron', monospace; font-size:24px; font-weight:900; color:var(--deck-color);"><span id="bRemainTxt">-00:00</span></div>
          <div style="font-size:10px; color:var(--dim); font-weight:800; letter-spacing:1px;">BPM: <span id="bBpmTxt">128.0</span> &nbsp;|&nbsp; KEY: Bm &nbsp;|&nbsp; <span id="bTime" style="color:#aaa;">0:00 / 0:00</span></div>
       </div>
    </div>
    
    <!-- Waveform & Jog -->
    <div class="wave" style="margin-top:10px;"><canvas id="bWave"></canvas><div class="wave-progress" id="bProg"></div></div>
    <div class="deck-row" style="margin-top:-2px;"><input type="range" class="scrubber b-scrubber" id="bSeekBar" min="0" max="100" step="0.1" value="0"></div>
    
    <div class="jog-container" style="margin: 10px 0;">
      <div class="jog-wheel" id="bJog">
        <div class="jog-grooves"></div>
        <div class="jog-marker-container" id="bJogRot"><div class="jog-marker"></div></div>
        <div class="jog-center" id="bJogCenter" onclick="togglePlay('B')" style="cursor:pointer; z-index:10;">BRAKE</div>
      </div>
    </div>
    
    <!-- Performance Controls -->
    <div style="font-size:10px; font-weight:900; color:var(--dim); letter-spacing:1px; margin-bottom:5px;">HOT CUES</div>
    <div class="hotcue-row" style="margin:0 0 10px 0;">
      <button class="cue-btn" id="btn-cue-B-0" onmousedown="handleHotCue('B', 0, event)" oncontextmenu="event.preventDefault(); handleHotCue('B', 0, event)">1</button>
      <button class="cue-btn" id="btn-cue-B-1" onmousedown="handleHotCue('B', 1, event)" oncontextmenu="event.preventDefault(); handleHotCue('B', 1, event)">2</button>
      <button class="cue-btn" id="btn-cue-B-2" onmousedown="handleHotCue('B', 2, event)" oncontextmenu="event.preventDefault(); handleHotCue('B', 2, event)">3</button>
      <button class="cue-btn" id="btn-cue-B-3" onmousedown="handleHotCue('B', 3, event)" oncontextmenu="event.preventDefault(); handleHotCue('B', 3, event)">4</button>
    </div>
    
    <div style="font-size:10px; font-weight:900; color:var(--dim); letter-spacing:1px; margin-bottom:5px;">LOOP</div>
    <div style="display:flex; gap:8px; margin-bottom:10px;">
       <button class="btn" onclick="toggleAutoLoop('B')" style="flex:1; padding:6px 0; font-size:10px;">IN</button>
       <button class="btn" onclick="toggleAutoLoop('B')" style="flex:1; padding:6px 0; font-size:10px;">OUT</button>
       <button class="btn" style="flex:1; padding:6px 0; font-size:10px;">1/2</button>
       <button class="btn" style="flex:1; padding:6px 0; font-size:10px;">2X</button>
    </div>

    <div style="font-size:10px; font-weight:900; color:var(--dim); letter-spacing:1px; margin-bottom:5px;">BEAT JUMP</div>
    <div style="display:flex; gap:8px; margin-bottom:10px;">
       <button class="btn" onclick="seek('B', -8)" style="flex:1; padding:6px 0; font-size:10px;">-8</button>
       <button class="btn" onclick="seek('B', -4)" style="flex:1; padding:6px 0; font-size:10px;">-4</button>
       <button class="btn" onclick="seek('B', 4)" style="flex:1; padding:6px 0; font-size:10px;">+4</button>
       <button class="btn" onclick="seek('B', 8)" style="flex:1; padding:6px 0; font-size:10px;">+8</button>
    </div>
    
    <div style="display:flex; gap:8px;">
       <button class="btn" style="flex:1; padding:8px 0; font-size:11px; background:#222;">SYNC</button>
       <button class="btn" style="flex:1; padding:8px 0; font-size:11px; background:#222;">MASTER</button>
       <button class="btn" style="flex:1; padding:8px 0; font-size:11px; background:#222;">KEY LOCK</button>
    </div>
  </div>
</div>"""

content = re.sub(r'<div class="performance-zone">.*?</div>\n</div>\n\n<div class="bottom">', performance_zone_replacement + '\n\n<div class="bottom">', content, flags=re.DOTALL)

# 3. Add clock ticking logic
js_additions = """
// Clock
setInterval(() => {
    const d = new Date();
    const el = document.getElementById('topClock');
    if (el) el.innerText = d.toLocaleTimeString('en-US', { hour12: false });
}, 1000);
"""
content = content.replace('</script>', f'{js_additions}\n</script>')

with open("public/dj_live.html", "w", encoding="utf-8") as f:
    f.write(content)

print("Mockup Apply Complete.")
