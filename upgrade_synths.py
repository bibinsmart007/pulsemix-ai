import os
import re

with open("public/dj_live.html", "r", encoding="utf-8") as f:
    html = f.read()

# 1. Upgrade playSynthKick
new_playSynthKick = """
// Hard EDM/Trap Kick (Afrojack style)
function playSynthKick(t) {
  if (!ctx) return;
  // Body (Punch)
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.08);
  g.gain.setValueAtTime(1.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  
  // Transient (Click)
  const click = ctx.createOscillator();
  const clickG = ctx.createGain();
  click.type = "square";
  click.frequency.setValueAtTime(4000, t);
  click.frequency.exponentialRampToValueAtTime(100, t + 0.03);
  clickG.gain.setValueAtTime(0.8, t);
  clickG.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  
  // Sub-bass tail
  const sub = ctx.createOscillator();
  const subG = ctx.createGain();
  sub.type = "sine";
  sub.frequency.setValueAtTime(45, t);
  subG.gain.setValueAtTime(0, t);
  subG.gain.linearRampToValueAtTime(0.8, t + 0.05);
  subG.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

  // Distortion for extra grit
  const dist = ctx.createWaveShaper();
  const curve = new Float32Array(44100);
  for(let i=0; i<44100; i++) {
    let x = (i * 2 / 44100) - 1;
    curve[i] = (3 + 20) * x * 20 * (Math.PI/180) / (Math.PI + 20 * Math.abs(x));
  }
  dist.curve = curve;
  
  o.connect(g); click.connect(clickG); sub.connect(subG);
  g.connect(dist); clickG.connect(dist); subG.connect(dist);
  
  const outNode = window.masterLimiter ? window.masterLimiter : masterGain;
  dist.connect(outNode);

  o.start(t); o.stop(t + 0.4);
  click.start(t); click.stop(t + 0.03);
  sub.start(t); sub.stop(t + 0.5);
}
"""

html = re.sub(r'function playSynthKick\(t\)\s*\{[\s\S]*?o\.start\(t\);\s*o\.stop\(t\s*\+\s*0\.5\);\s*\}', new_playSynthKick.strip(), html)

# 2. Upgrade playSample
old_playSample_pattern = r'function playSample\(type\)\s*\{[\s\S]*?lfo\.start\(t\);\s*\}'

new_playSample = """function playSample(type) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const outNode = window.masterLimiter ? window.masterLimiter : masterGain;

    if (type === 'kick') {
        playSynthKick(t);
    }
    else if (type === 'snare') {
        // EDM Snare
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(250, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
        gain.gain.setValueAtTime(1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        osc.connect(gain); gain.connect(outNode);
        osc.start(t); osc.stop(t + 0.2);

        // Noise body
        const bufferSize = ctx.sampleRate * 0.2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource(); noise.buffer = buffer;
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'highpass'; noiseFilter.frequency.value = 1000;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(1, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(outNode);
        noise.start(t);
    }
    else if (type === 'darbuka') {
        // Darbuka 'Tek' (High pitched rim hit)
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(300, t + 0.1);
        gain.gain.setValueAtTime(1.5, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        osc.connect(gain); gain.connect(outNode);
        
        // Add metallic noise
        const bSize = ctx.sampleRate * 0.1;
        const buf = ctx.createBuffer(1, bSize, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for(let i=0; i<bSize; i++) d[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource(); noise.buffer = buf;
        const nFilt = ctx.createBiquadFilter(); nFilt.type = 'bandpass'; nFilt.frequency.value = 3000;
        const nGain = ctx.createGain(); nGain.gain.setValueAtTime(0.8, t); nGain.gain.exponentialRampToValueAtTime(0.01, t+0.1);
        noise.connect(nFilt); nFilt.connect(nGain); nGain.connect(outNode);
        
        osc.start(t); osc.stop(t + 0.15); noise.start(t);
    }
    else if (type === 'chenda') {
        // Chenda strike (Sharp, loud, stick hit)
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(200, t + 0.15);
        gain.gain.setValueAtTime(2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.setValueAtTime(5000, t); filter.frequency.exponentialRampToValueAtTime(500, t + 0.15);
        
        osc.connect(filter); filter.connect(gain); gain.connect(outNode);
        osc.start(t); osc.stop(t + 0.2);
    }
    else if (type === 'drums') {
        // Fast EDM Drum fill (3 fast hits)
        for(let i=0; i<4; i++) {
            let delay = i * 0.12; // 16th notes roughly
            const osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(200, t + delay);
            osc.frequency.exponentialRampToValueAtTime(60, t + delay + 0.1);
            gain.gain.setValueAtTime(1.5, t + delay);
            gain.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.1);
            osc.connect(gain); gain.connect(outNode);
            osc.start(t + delay); osc.stop(t + delay + 0.1);
        }
    }
    else if (type === 'violin') {
        // Dramatic Synth String staccato
        const osc1 = ctx.createOscillator(), osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'sawtooth'; osc2.type = 'sawtooth';
        osc1.frequency.value = 880; // A5
        osc2.frequency.value = 884; // Detuned
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.8, t + 0.05); // quick attack
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6); // smooth decay
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(8000, t);
        filter.frequency.exponentialRampToValueAtTime(1000, t + 0.6);
        
        osc1.connect(filter); osc2.connect(filter); filter.connect(gain); gain.connect(outNode);
        osc1.start(t); osc1.stop(t + 0.6);
        osc2.start(t); osc2.stop(t + 0.6);
    }
}"""

html = re.sub(old_playSample_pattern, new_playSample.strip(), html)

with open("public/dj_live.html", "w", encoding="utf-8") as f:
    f.write(html)
print("Synths upgraded successfully!")
