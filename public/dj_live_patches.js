/* dj_live_patches.js — bugfix layer for dj_live.html
 *
 * Twelve issues found in the main file (functions referenced by buttons
 * but never defined, missing global vars, missing fx('drop') handler,
 * etc). Patched here so dj_live.html doesn't have to be rewritten and
 * the Antigravity IDE doesn't accidentally corrupt the main file.
 *
 * Load AFTER dj_live.html's main <script> block.
 */
(function () {
  function $(id) { return document.getElementById(id); }

  function ready() {
    if (typeof window.decks === 'undefined' && typeof decks === 'undefined') {
      return setTimeout(ready, 100);
    }

    /* ---- 1. Missing globals: aLoaded, micNode ---- */
    if (typeof window.aLoaded === 'undefined') window.aLoaded = true;
    if (typeof window.micNode === 'undefined') window.micNode = null;

    /* ---- 2. toggleRecording — referenced by mixer button, didn't exist ---- */
    if (typeof window.toggleRecording !== 'function') {
      window.toggleRecording = function () { const b = $("recBtn"); if (b) b.click(); };
    }

    /* ---- 3. 4-beat auto-loop ---- */
    if (typeof window.toggleAutoLoop !== 'function') {
      window.toggleAutoLoop = function (k) {
        const a = $("audio" + k);
        if (!a || typeof ctx === 'undefined' || !ctx || !decks[k]) return;
        const bpm = (typeof TRACKS !== 'undefined' && TRACKS[currentIdx] && TRACKS[currentIdx].bpm) || 128;
        const loopLen = (60 / bpm) * 4;
        if (decks[k].loop && decks[k].loop.active) {
          decks[k].loop.active = false;
          return;
        }
        decks[k].loop = { start: a.currentTime, end: a.currentTime + loopLen, active: true };
        (function watch() {
          if (!decks[k].loop || !decks[k].loop.active) return;
          if (a.currentTime >= decks[k].loop.end) a.currentTime = decks[k].loop.start;
          requestAnimationFrame(watch);
        })();
      };
    }

    /* ---- 4. Acapella (kill bass + boost mids to fake vocal isolation) ---- */
    if (typeof window.toggleAcapella !== 'function') {
      window.toggleAcapella = function (k) {
        if (!decks[k]) return;
        const on = !decks[k]._aca;
        decks[k]._aca = on;
        decks[k].low.gain.value = on ? -40 : 0;
        decks[k].mid.gain.value = on ? 6 : 0;
        decks[k].high.gain.value = on ? 4 : 0;
        const b = $(k.toLowerCase() + "AcapellaBtn");
        if (b) { b.style.background = on ? "#00d4ff" : ""; b.style.color = on ? "#000" : "#00d4ff"; }
      };
    }

    /* ---- 5. Instrumental (notch out vocal range) ---- */
    if (typeof window.toggleInstrumental !== 'function') {
      window.toggleInstrumental = function (k) {
        if (!decks[k]) return;
        const on = !decks[k]._inst;
        decks[k]._inst = on;
        decks[k].mid.gain.value = on ? -18 : 0;
        decks[k].high.gain.value = on ? -8 : 0;
        const b = $(k.toLowerCase() + "InstBtn");
        if (b) { b.style.background = on ? "#ff2bd6" : ""; b.style.color = on ? "#000" : "#ff2bd6"; }
      };
    }

    /* ---- 6. Editor modal stubs (HTML references these from buttons) ---- */
    if (typeof window.openEditor !== 'function') window.openEditor = function (i) {
      const ov = $("editorOverlay"); if (!ov) return;
      const t = TRACKS[i]; if (!t) return;
      ov.classList.add("on");
      const title = $("editorTitle"); if (title) title.textContent = "Edit: " + (t.id || t.file);
    };
    if (typeof window.closeEditor !== 'function') window.closeEditor = function () {
      const ov = $("editorOverlay"); if (ov) ov.classList.remove("on");
    };
    if (typeof window.updateEditorRanges !== 'function') window.updateEditorRanges = function () {
      const s = $("editorStartRange"), e = $("editorEndRange");
      if (!s || !e) return;
      if ($("editorStartTxt")) $("editorStartTxt").textContent = (parseFloat(s.value) / 10).toFixed(1) + "s";
      if ($("editorEndTxt"))   $("editorEndTxt").textContent   = (parseFloat(e.value) / 10).toFixed(1) + "s";
      const reg = $("editorRegion");
      if (reg) {
        const a = parseFloat(s.value) / 10, b = parseFloat(e.value) / 10;
        reg.style.left  = a + "%";
        reg.style.right = (100 - b) + "%";
      }
    };
    if (typeof window.toggleEditorPlay !== 'function') window.toggleEditorPlay = function () {};
    if (typeof window.saveEditor !== 'function') window.saveEditor = function () { closeEditor(); };

    /* ---- 7. statMsg element — loadFullTrack writes to it, didn't exist ---- */
    if (!$("statMsg")) {
      const m = document.createElement("div");
      m.id = "statMsg";
      m.style.cssText = "position:fixed;bottom:12px;left:50%;transform:translateX(-50%);background:#000c;color:#fff;padding:8px 16px;border-radius:6px;z-index:150;font-size:12px;font-weight:bold;border:1px solid #333;pointer-events:none;";
      document.body.appendChild(m);
    }

    /* ---- 8. fx('drop') — key '7' calls it but the fx() switch had no branch ---- */
    if (typeof window.fx === 'function') {
      const origFx = window.fx;
      window.fx = function (kind) {
        if (kind !== 'drop') return origFx(kind);
        if (typeof ctx === 'undefined' || !ctx) return;
        const t = ctx.currentTime;
        const sub = ctx.createOscillator(); sub.type = "sine"; sub.frequency.value = 45;
        const sg = ctx.createGain();
        sg.gain.setValueAtTime(1.6, t);
        sg.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
        sub.connect(sg); sg.connect(masterGain);
        sub.start(t); sub.stop(t + 1.4);

        const k = ctx.createOscillator();
        k.frequency.setValueAtTime(220, t);
        k.frequency.exponentialRampToValueAtTime(35, t + 0.18);
        const kg = ctx.createGain();
        kg.gain.setValueAtTime(1.4, t);
        kg.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        k.connect(kg); kg.connect(masterGain);
        k.start(t); k.stop(t + 0.5);
      };
    }

    /* ---- 9. Real bass boost — masterBassBoost was declared but never created ---- */
    if (typeof ctx !== 'undefined' && ctx && masterGain && !window.masterBassBoost) {
      try {
        const bb = ctx.createBiquadFilter();
        bb.type = "lowshelf"; bb.frequency.value = 120; bb.gain.value = 0;
        // Re-route: masterGain currently → masterAnalyser → destination.
        // Insert bb between masterGain and masterAnalyser.
        masterGain.disconnect();
        masterGain.connect(bb);
        bb.connect(masterAnalyser);
        // masterAnalyser still connects to destination (untouched)
        window.masterBassBoost = bb;
        // Also create harmless aliases so toggleMic / playSample don't fail silently
        window.masterDrive   = bb;
        window.masterLimiter = masterGain;
      } catch (e) {
        console.warn("[patches] bass-boost wire failed:", e);
      }
    }

    /* ---- 10. Bind the "RESTART PARTY" / "START OVER" button reliably ---- */
    const restart = $("restartPartyBtn");
    if (restart && !restart._wired) {
      restart._wired = true;
      restart.addEventListener("click", () => {
        try { localStorage.removeItem("dj_live_save"); } catch (e) {}
        // Click the main start button if it's still visible
        const sb = $("startBtn"); if (sb) sb.click();
      });
    }

    /* ---- 11. Track count in topbar — shows TOTAL not just party tracks ---- */
    // The TRACKS array includes a duplicate "00_opening_closing" at start and end.
    // Display "current real-track / 57" instead of out of TRACKS.length.
    if (typeof window._patched_statTrack !== 'boolean') {
      window._patched_statTrack = true;
      setInterval(() => {
        const st = $("statTrack"); if (!st) return;
        const i = (typeof currentIdx === 'number') ? currentIdx : 0;
        const real = Math.max(1, Math.min(57, i));
        st.textContent = real + "/57";
      }, 1000);
    }

    /* ---- 12. Duplicate Escape case in keydown switch — second one unreachable.
              Bind panic-reset to Backspace ONLY so it actually fires. ---- */
    document.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT") return;
      if (e.key === "Backspace" && typeof panicReset === 'function') {
        e.preventDefault();
        panicReset();
      }
    });

    console.log("[dj_live_patches] applied — 12 bugfixes active");
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(ready, 50);
  } else {
    document.addEventListener('DOMContentLoaded', ready);
  }
})();
