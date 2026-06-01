import re

css = """
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;600;800&display=swap');
  
  :root {
    --bg: #030305;
    --bg2: rgba(20, 20, 30, 0.4);
    --panel: rgba(25, 25, 35, 0.6);
    --accent: #ff007f;
    --accent-glow: rgba(255, 0, 127, 0.6);
    --accent2: #00f0ff;
    --accent2-glow: rgba(0, 240, 255, 0.6);
    --warn: #ff3300;
    --ok: #00ff7f;
    --text: #ffffff;
    --dim: #8b9bb4;
    --border: rgba(255, 255, 255, 0.08);
    --glass: blur(20px);
  }
  
  * { box-sizing: border-box; }
  
  html, body {
    margin: 0; padding: 0;
    background: radial-gradient(circle at 50% -20%, #1a1a2e, var(--bg) 60%);
    color: var(--text);
    font-family: 'Inter', sans-serif;
    height: 100%; overflow-x: hidden; overflow-y: auto;
    user-select: none;
  }
  
  body::before {
    content: '';
    position: fixed; inset: 0; z-index: -2;
    background-image: 
      linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
  }
  
  body { display: grid; grid-template-rows: auto auto auto auto auto; gap: 15px; padding: 15px; }
  
  .glass-panel {
    background: var(--panel);
    backdrop-filter: var(--glass);
    -webkit-backdrop-filter: var(--glass);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }
  
  .topbar { display: flex; align-items: center; gap: 15px; padding: 12px 20px; flex-wrap: wrap; }
  .topbar h1 { margin: 0; font-family: 'Orbitron', sans-serif; font-size: 22px; font-weight: 900; letter-spacing: 3px; background: linear-gradient(90deg, var(--accent2), var(--accent)); -webkit-background-clip: text; background-clip: text; color: transparent; text-shadow: 0 0 20px rgba(255, 0, 127, 0.4); }
  .topbar .stat { font-size: 13px; color: var(--dim); font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
  .topbar .stat b { color: var(--text); font-family: 'Orbitron', sans-serif; }
  
  .badge { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; letter-spacing: 1px; background: rgba(0, 255, 127, 0.1); color: var(--ok); border: 1px solid rgba(0, 255, 127, 0.3); }
  .badge.warn { background: rgba(255, 51, 0, 0.1); color: var(--warn); border-color: rgba(255, 51, 0, 0.3); }
  .badge.live { background: rgba(255, 0, 127, 0.1); color: var(--accent); border-color: var(--accent); animation: pulse-neon 2s infinite; }
  
  @keyframes pulse-neon {
    0%, 100% { box-shadow: 0 0 5px var(--accent-glow); text-shadow: 0 0 5px var(--accent); }
    50% { box-shadow: 0 0 15px var(--accent-glow); text-shadow: 0 0 15px var(--accent); }
  }
  
  .spacer { flex: 1; }
  .decks { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  
  .deck { 
    background: var(--bg2); backdrop-filter: var(--glass); -webkit-backdrop-filter: var(--glass);
    border: 1px solid var(--border); border-radius: 16px; padding: 20px; 
    display: flex; flex-direction: column; gap: 12px; position: relative; overflow: hidden;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .deck.active { border-color: var(--accent); box-shadow: 0 0 30px rgba(255, 0, 127, 0.15), inset 0 0 20px rgba(255, 0, 127, 0.05); }
  .deck.cued { border-color: var(--accent2); box-shadow: 0 0 30px rgba(0, 240, 255, 0.15), inset 0 0 20px rgba(0, 240, 255, 0.05); }
  
  .deck-label { font-family: 'Orbitron', sans-serif; font-size: 13px; font-weight: 900; letter-spacing: 3px; color: var(--dim); display: flex; align-items: center; gap: 10px; }
  .deck.active .deck-label { color: var(--accent); text-shadow: 0 0 10px var(--accent-glow); }
  .deck.cued .deck-label { color: var(--accent2); text-shadow: 0 0 10px var(--accent2-glow); }
  
  .deck-title { font-size: 18px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text); margin-bottom: 5px; }
  .deck-meta { font-size: 12px; color: var(--dim); display: flex; gap: 15px; font-weight: 600; font-family: 'Orbitron', monospace; }
  
  .digital-display { 
    display: flex; justify-content: space-between; font-family: 'Orbitron', monospace; font-size: 32px; font-weight: 900; 
    color: var(--accent); background: rgba(0,0,0,0.6); border: 1px solid rgba(255,0,127,0.3); border-radius: 8px; 
    padding: 8px 15px; box-shadow: inset 0 0 20px rgba(0,0,0,1), 0 0 10px var(--accent-glow); align-items: baseline; 
    text-shadow: 0 0 10px var(--accent);
  }
  .deck#deckB .digital-display { color: var(--accent2); border-color: rgba(0,240,255,0.3); box-shadow: inset 0 0 20px rgba(0,0,0,1), 0 0 10px var(--accent2-glow); text-shadow: 0 0 10px var(--accent2); }
  
  .digital-label { font-size: 10px; color: rgba(255,255,255,0.5); font-family: 'Inter', sans-serif; letter-spacing: 2px; margin-right: 8px; text-shadow: none; }
  
  .wave { height: 70px; background: rgba(0,0,0,0.5); border-radius: 8px; position: relative; overflow: hidden; border: 1px solid var(--border); box-shadow: inset 0 5px 15px rgba(0,0,0,0.8); }
  .wave canvas { width: 100%; height: 100%; display: block; filter: drop-shadow(0 0 5px rgba(255,255,255,0.3)); }
  .wave-progress { position: absolute; top: 0; left: 0; bottom: 0; width: 0%; background: linear-gradient(90deg, transparent, rgba(255, 0, 127, 0.3)); pointer-events: none; mix-blend-mode: screen; }
  .deck#deckB .wave-progress { background: linear-gradient(90deg, transparent, rgba(0, 240, 255, 0.3)); }
  
  #bgVisualizer { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: -1; pointer-events: none; opacity: 0.5; filter: blur(4px); mix-blend-mode: screen; }
  
  .deck-row { display: flex; gap: 12px; align-items: center; }
  .deck-row label { font-size: 10px; font-weight: 800; color: var(--dim); width: 40px; letter-spacing: 1px; }
  
  /* Knobs & Sliders */
  .knob { flex: 1; -webkit-appearance: none; appearance: none; height: 6px; background: rgba(0,0,0,0.5); border-radius: 3px; outline: none; border: 1px solid rgba(255,255,255,0.1); box-shadow: inset 0 1px 3px rgba(0,0,0,0.8); }
  .knob::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%; background: linear-gradient(135deg, #444, #111); cursor: pointer; border: 2px solid var(--accent); box-shadow: 0 0 10px var(--accent-glow), inset 0 2px 4px rgba(255,255,255,0.3); transition: transform 0.1s; }
  .knob::-webkit-slider-thumb:active { transform: scale(1.2); }
  .deck#deckB .knob::-webkit-slider-thumb { border-color: var(--accent2); box-shadow: 0 0 10px var(--accent2-glow), inset 0 2px 4px rgba(255,255,255,0.3); }
  
  .deck-row .val { font-size: 12px; font-family: 'Orbitron', monospace; color: var(--text); width: 55px; text-align: right; }
  
  .deck-btns { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 5px; }
  .btn { 
    background: rgba(255,255,255,0.05); color: var(--text); border: 1px solid rgba(255,255,255,0.1); 
    padding: 10px 16px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 700; 
    letter-spacing: 1.5px; transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    backdrop-filter: blur(5px); text-transform: uppercase;
  }
  .btn:hover { background: rgba(255,255,255,0.1); transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
  .btn:active { transform: translateY(1px); }
  .btn.primary { background: linear-gradient(135deg, #ff007f, #cc0066); border-color: transparent; color: #fff; box-shadow: 0 0 15px rgba(255,0,127,0.4); text-shadow: 0 1px 3px rgba(0,0,0,0.5); }
  .btn.primary:hover { box-shadow: 0 0 25px rgba(255,0,127,0.6); filter: brightness(1.1); }
  .btn.cyan { background: linear-gradient(135deg, #00f0ff, #0099cc); border-color: transparent; color: #000; box-shadow: 0 0 15px rgba(0,240,255,0.4); }
  .btn.cyan:hover { box-shadow: 0 0 25px rgba(0,240,255,0.6); filter: brightness(1.1); }
  
  .mixer { 
    background: var(--bg2); backdrop-filter: var(--glass); -webkit-backdrop-filter: var(--glass);
    border: 1px solid var(--border); border-radius: 16px; padding: 20px; 
    display: grid; grid-template-columns: 1fr auto 1fr; gap: 20px; align-items: center; 
    box-shadow: 0 15px 35px rgba(0,0,0,0.6);
  }
  
  .next-info { font-size: 12px; color: var(--dim); text-align: center; }
  .next-info b { color: var(--accent2); font-size: 16px; display: block; margin-top: 5px; text-shadow: 0 0 10px rgba(0,240,255,0.3); }
  
  .auto-toggle { display: flex; align-items: center; gap: 10px; padding: 10px 15px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; font-size: 12px; font-weight: 800; letter-spacing: 1px; cursor: pointer; transition: 0.2s; }
  .auto-toggle.on { background: rgba(0, 255, 127, 0.15); border-color: var(--ok); color: var(--ok); box-shadow: 0 0 15px rgba(0,255,127,0.2); text-shadow: 0 0 5px var(--ok); }
  
  .bottom { display: grid; grid-template-columns: 1fr 380px; gap: 20px; }
  
  .fx-grid { 
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; 
    background: var(--bg2); backdrop-filter: var(--glass); border: 1px solid var(--border); 
    border-radius: 16px; padding: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  }
  .pad { 
    background: linear-gradient(180deg, #2a2a35, #1a1a25); border: 1px solid rgba(255,255,255,0.05); 
    border-radius: 8px; padding: 15px 5px; text-align: center; cursor: pointer; font-size: 10px; 
    font-weight: 800; letter-spacing: 1px; transition: all 0.1s; color: var(--dim);
    box-shadow: 0 4px 6px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.1);
  }
  .pad b { font-size: 18px; font-family: 'Orbitron', sans-serif; display: block; margin-bottom: 5px; color: var(--text); }
  .pad:active, .pad.hit { 
    background: var(--accent); color: #fff; transform: translateY(2px) scale(0.97); 
    box-shadow: 0 0 20px var(--accent-glow), inset 0 2px 10px rgba(0,0,0,0.5); border-color: #fff;
  }
  .pad.special { background: linear-gradient(180deg, #352a35, #251a25); }
  .pad.special:active, .pad.special.hit { background: var(--accent2); box-shadow: 0 0 20px var(--accent2-glow); color: #000; }
  
  .right-panel { 
    background: var(--bg2); backdrop-filter: var(--glass); border: 1px solid var(--border); 
    border-radius: 16px; padding: 15px; display: flex; flex-direction: column; gap: 10px; overflow: hidden;
  }
  .right-panel h3 { margin: 0; font-family: 'Orbitron', sans-serif; font-size: 12px; color: var(--text); letter-spacing: 2px; }
  
  .upnext-list { flex: 1; overflow-y: auto; font-size: 12px; max-height: 140px; }
  .upnext-list::-webkit-scrollbar { width: 6px; }
  .upnext-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
  .upnext-row { padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; gap: 12px; cursor: pointer; transition: 0.2s; border-radius: 4px; }
  .upnext-row:hover { background: rgba(255,255,255,0.05); }
  .upnext-row .num { color: var(--dim); width: 28px; font-family: 'Orbitron', monospace; font-weight: bold; }
  .upnext-row.current { background: rgba(255,0,127,0.1); color: #fff; font-weight: 600; border-left: 3px solid var(--accent); }
  .upnext-row.cued { background: rgba(0,240,255,0.1); color: #fff; font-weight: 600; border-left: 3px solid var(--accent2); }
  
  /* Jog Wheels */
  .jog-container { display: flex; justify-content: center; margin: 20px 0 15px 0; perspective: 1000px; }
  .jog-wheel { 
    width: 180px; height: 180px; border-radius: 50%; 
    background: conic-gradient(from 0deg, #111, #333, #111, #333, #111);
    border: 6px solid #0f0f15; position: relative; cursor: grab; display: flex; align-items: center; justify-content: center; 
    box-shadow: 0 15px 35px rgba(0,0,0,0.8), inset 0 0 20px rgba(0,0,0,1); 
    overflow: hidden; transition: all 0.3s; touch-action: none; transform: rotateX(10deg);
  }
  .jog-wheel::after {
    content: ''; position: absolute; inset: 0; border-radius: 50%;
    background: repeating-radial-gradient(circle at 50% 50%, transparent 0, transparent 2px, rgba(0,0,0,0.5) 2.5px, rgba(0,0,0,0.5) 3px);
    pointer-events: none;
  }
  .jog-wheel:active { cursor: grabbing; }
  .jog-center { 
    width: 70px; height: 70px; border-radius: 50%; border: 3px solid #444; z-index: 2; 
    display: flex; align-items: center; justify-content: center; font-family: 'Orbitron', sans-serif; font-size: 11px; font-weight: 900; 
    cursor: crosshair; background: radial-gradient(circle, #222, #050505); 
    box-shadow: inset 0 2px 10px rgba(255,255,255,0.2), 0 5px 15px rgba(0,0,0,0.8); 
    color: var(--dim); letter-spacing: 1px; transition: 0.2s;
  }
  .jog-center:active { background: var(--warn); color: #000; border-color: #fff; box-shadow: 0 0 20px rgba(255,51,0,0.8); }
  .jog-marker-container { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
  .jog-marker { position: absolute; top: 10px; left: 50%; width: 4px; height: 20px; transform: translateX(-50%); background: #fff; border-radius: 2px; box-shadow: 0 0 8px #fff; }
  
  .jog-wheel.playing { border-color: #1a1a25; animation: spin 2s linear infinite; }
  @keyframes spin { 100% { transform: rotateX(10deg) rotateZ(360deg); } }
  
  .deck#deckA .jog-wheel.nudging { border-color: var(--accent); box-shadow: 0 15px 35px rgba(0,0,0,0.8), 0 0 30px var(--accent-glow); }
  .deck#deckB .jog-wheel.nudging { border-color: var(--accent2); box-shadow: 0 15px 35px rgba(0,0,0,0.8), 0 0 30px var(--accent2-glow); }
  
  /* Custom Scrubber Bar */
  input[type=range].scrubber { -webkit-appearance: none; width: 100%; height: 8px; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1); outline: none; border-radius: 4px; cursor: ew-resize; margin: 0; padding: 0; box-shadow: inset 0 2px 5px rgba(0,0,0,0.8); }
  input[type=range].scrubber::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 20px; border-radius: 4px; background: #fff; cursor: ew-resize; box-shadow: 0 0 10px rgba(255,255,255,0.8); }
  input[type=range].a-scrubber::-webkit-slider-thumb { background: var(--accent); box-shadow: 0 0 15px var(--accent); border: 2px solid #fff; }
  input[type=range].b-scrubber::-webkit-slider-thumb { background: var(--accent2); box-shadow: 0 0 15px var(--accent2); border: 2px solid #fff; }
  
  /* Crossfader */
  .crossfader-container { 
    width: 100%; max-width: 250px; background: rgba(0,0,0,0.8); border: 1px solid rgba(255,255,255,0.1); 
    border-radius: 8px; padding: 20px 15px 10px 15px; margin-top: 15px; position: relative; 
    box-shadow: inset 0 5px 15px rgba(0,0,0,0.9), 0 5px 15px rgba(0,0,0,0.5);
  }
  .crossfader-container::before { content: ''; position: absolute; left: 50%; top: 10px; bottom: 10px; width: 2px; background: rgba(255,255,255,0.15); border-radius: 1px; }
  #crossfader { -webkit-appearance: none; width: 100%; height: 8px; background: #000; outline: none; border-radius: 4px; position: relative; z-index: 2; margin: 0; box-shadow: inset 0 2px 5px rgba(0,0,0,1); }
  #crossfader::-webkit-slider-thumb { 
    -webkit-appearance: none; appearance: none; width: 30px; height: 50px; 
    background: linear-gradient(180deg, #666, #222); border: 2px solid #111; 
    border-radius: 4px; cursor: ew-resize; box-shadow: 0 8px 15px rgba(0,0,0,0.8), inset 0 2px 4px rgba(255,255,255,0.4); 
    position: relative;
  }
  .xfader-labels { display: flex; justify-content: space-between; font-family: 'Orbitron', sans-serif; font-size: 12px; font-weight: 900; color: #666; margin-top: 10px; }
  
  /* Hot Cues */
  .hotcue-row { display: flex; gap: 8px; justify-content: space-between; margin: 10px 0; }
  .cue-btn { 
    flex: 1; height: 36px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); 
    border-radius: 6px; color: var(--dim); font-family: 'Orbitron', sans-serif; font-weight: 900; 
    font-size: 14px; cursor: pointer; transition: 0.2s; box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);
  }
  .cue-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
  .cue-btn.active.color-0 { background: var(--accent); color: #fff; box-shadow: 0 0 15px var(--accent-glow); border-color: #fff; }
  .cue-btn.active.color-1 { background: var(--accent2); color: #000; box-shadow: 0 0 15px var(--accent2-glow); border-color: #fff; }
  .cue-btn.active.color-2 { background: #ffea00; color: #000; box-shadow: 0 0 15px rgba(255,234,0,0.6); border-color: #fff; }
  .cue-btn.active.color-3 { background: #00ff66; color: #000; box-shadow: 0 0 15px rgba(0,255,102,0.6); border-color: #fff; }
  
  .cue-marker { position: absolute; top: 0; bottom: 0; width: 3px; z-index: 5; pointer-events: none; border-radius: 1.5px; }
  .cue-marker.color-0 { background: #ff007f; box-shadow: 0 0 10px #ff007f; }
  .cue-marker.color-1 { background: #00f0ff; box-shadow: 0 0 10px #00f0ff; }
  .cue-marker.color-2 { background: #ffea00; box-shadow: 0 0 10px #ffea00; }
  .cue-marker.color-3 { background: #00ff66; box-shadow: 0 0 10px #00ff66; }
  
  .sampler-btn { padding: 15px 5px; font-family: 'Orbitron', sans-serif; font-size: 10px; font-weight: 900; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; cursor: pointer; transition: 0.1s; letter-spacing: 1px; color: #ccc; }
  .sampler-btn:active { transform: scale(0.92); background: #fff !important; color: #000 !important; box-shadow: 0 0 20px #fff; }
  
  /* Music Player Transport Bar Styles */
  .player-bar {
      background: rgba(0,0,0,0.6);
      border-radius: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 10px 25px;
      gap: 18px;
      box-shadow: inset 0 2px 10px rgba(0,0,0,0.8), 0 5px 15px rgba(0,0,0,0.5);
      margin-top: 15px;
      border: 1px solid rgba(255,255,255,0.1);
  }
  .player-icon-btn {
      background: transparent; border: none; color: #888; font-size: 18px; cursor: pointer; transition: 0.2s; padding: 5px;
  }
  .player-icon-btn:hover { color: #fff; text-shadow: 0 0 10px #fff; transform: scale(1.1); }
  .player-play-btn {
      width: 55px; height: 55px; border-radius: 50%;
      background: linear-gradient(135deg, #00f0ff, #0066cc);
      border: 2px solid #fff;
      box-shadow: 0 0 20px rgba(0, 240, 255, 0.6), inset 0 2px 5px rgba(255,255,255,0.5);
      color: white; font-size: 22px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: 0.1s; outline: none; text-shadow: 0 2px 4px rgba(0,0,0,0.5);
  }
  .deck#deckA .player-play-btn { background: linear-gradient(135deg, #ff007f, #cc0066); box-shadow: 0 0 20px rgba(255, 0, 127, 0.6), inset 0 2px 5px rgba(255,255,255,0.5); }
  .player-play-btn:active { box-shadow: inset 0 5px 15px rgba(0,0,0,0.8); transform: scale(0.9); }
  .player-vol-slider { -webkit-appearance: none; width: 90px; height: 6px; background: #000; border-radius: 3px; outline: none; border: 1px solid rgba(255,255,255,0.1); }
  .player-vol-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #fff; cursor: pointer; box-shadow: 0 0 8px rgba(255,255,255,0.8); }
  
  .divider { width: 2px; height: 25px; background: rgba(255,255,255,0.1); border-radius: 1px; }

  /* Meters */
  .meter { display: flex; gap: 3px; align-items: center; }
  .meter-bar { width: 6px; height: 18px; background: rgba(0,0,0,0.5); border-radius: 2px; border: 1px solid rgba(255,255,255,0.05); }
  .meter-bar.on { background: var(--ok); box-shadow: 0 0 8px var(--ok); border-color: transparent; }
  .meter-bar.on.hot { background: #ffea00; box-shadow: 0 0 8px #ffea00; }
  .meter-bar.on.peak { background: var(--warn); box-shadow: 0 0 8px var(--warn); }
  
  /* Library */
  .library-tray { background: var(--bg2); backdrop-filter: var(--glass); border: 1px solid var(--border); border-radius: 16px; margin: 20px; padding: 25px; display: flex; flex-direction: column; gap: 15px; position: relative; z-index: 10; box-shadow: 0 15px 40px rgba(0,0,0,0.5); }
  .lib-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px; }
  .lib-header h3 { margin: 0; font-family: 'Orbitron', sans-serif; letter-spacing: 2px; }
  .lib-drag-zone { border: 2px dashed rgba(255,255,255,0.2); border-radius: 12px; padding: 25px; text-align: center; color: var(--dim); transition: 0.2s; background: rgba(0,0,0,0.3); font-size: 14px; font-weight: 600; }
  .lib-drag-zone.dragover { border-color: var(--accent2); background: rgba(0, 240, 255, 0.1); color: #fff; box-shadow: 0 0 20px rgba(0,240,255,0.2); }
  
  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.95); z-index: 100; display: none; padding: 40px; flex-direction: column; backdrop-filter: blur(10px); }
  .overlay.on { display: flex; }
"""

with open("public/dj_live.html", "r", encoding="utf-8") as f:
    html = f.read()

# Replace all <style> blocks with a single majestic one
# We will match from the first <style> to the last </style>
pattern = r'<style>[\s\S]*?</style>'
html = re.sub(pattern, f'<style>\n{css}\n</style>', html)

with open("public/dj_live.html", "w", encoding="utf-8") as f:
    f.write(html)
print("CSS Upgraded!")
