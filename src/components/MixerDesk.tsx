"use client";

import React from "react";
import { Sliders, Sparkles, Volume2, RefreshCw } from "lucide-react";
import { DeckState } from "@/types/audio";

interface MixerDeskProps {
  stateA: DeckState;
  stateB: DeckState;
  isPlaying: boolean;
  crossfader: number;
  setCrossfader: (val: number) => void;
  masterVolume: number;
  setMasterVolume: (val: number) => void;
  isTransitioning: boolean;
  transitionProgress: number;
  onTriggerTransition: (preset: "echo-out" | "bass-swap" | "edm-rise" | "reverb-blend", duration: number) => void;
  delayActive: boolean;
  reverbActive: boolean;
  onToggleFX: (fx: "delay" | "reverb", active: boolean) => void;
  onEQChange: (deck: "A" | "B", band: "low" | "mid" | "high", db: number) => void;
  onFilterChange: (deck: "A" | "B", val: number) => void;
  onVolumeChange: (deck: "A" | "B", vol: number) => void;
}

// A reusable Channel Strip component to keep the file clean
function ChannelStrip({
  deckId,
  state,
  onEQChange,
  onFilterChange,
  onVolumeChange
}: {
  deckId: "A" | "B";
  state: DeckState;
  onEQChange: (band: "low" | "mid" | "high", db: number) => void;
  onFilterChange: (val: number) => void;
  onVolumeChange: (vol: number) => void;
}) {
  const accentColor = deckId === "A" ? "text-neon-cyan" : "text-neon-purple";
  const accentBg = deckId === "A" ? "bg-neon-cyan" : "bg-neon-purple";

  // Helper to color EQ based on value (boost = green, cut = red, flat = neutral)
  const getValColor = (val: number) => {
    if (val > 0) return "text-emerald-400";
    if (val < 0) return "text-rose-400";
    return "text-neutral-400";
  };

  return (
    <section className="flex flex-col items-center gap-6 w-full relative z-10 bg-black/30 border border-white/5 rounded-2xl py-4 px-2 shadow-inner" aria-labelledby={`ch-${deckId}-title`}>
      <h3 id={`ch-${deckId}-title`} className="sr-only">CHANNEL {deckId} STRIP</h3>
      <div className="font-mono text-[10px] font-bold text-neutral-500 mb-2">
        <span className={accentColor}>CH {deckId}</span>
      </div>

      {/* EQ Knobs */}
      <fieldset className="w-full flex flex-col gap-2">
        <legend className="sr-only">EQ Controls</legend>
        {[
          { label: "HI", value: state.eqHigh, band: "high" as const },
          { label: "MID", value: state.eqMid, band: "mid" as const },
          { label: "LOW", value: state.eqLow, band: "low" as const },
        ].map(eq => (
          <div key={eq.label} className="bg-black/40 rounded-lg p-3 border border-white/5 w-full flex items-center justify-between">
            <label className="text-[10px] font-mono text-neutral-400 font-bold">&nbsp;{eq.label}&nbsp;</label>
            <input
              type="range"
              min="-12"
              max="12"
              step="0.5"
              value={eq.value}
              onChange={(e) => onEQChange(eq.band, parseFloat(e.target.value))}
              className="w-12 h-1 bg-neutral-800 accent-neutral-300 rounded-lg appearance-none cursor-pointer outline-none"
            />
          </div>
        ))}
      </fieldset>

      {/* Filter Knob */}
      <div className="bg-black/40 rounded-lg p-3 border border-white/5 w-full flex flex-col gap-2 mt-2">
        <div className="flex items-center justify-between w-full">
          <label className="text-[10px] font-mono text-neon-pink font-bold">&nbsp;FLTR&nbsp;</label>
          <input
            type="range"
            min="-100"
            max="100"
            step="1"
            value={state.filter}
            onChange={(e) => onFilterChange(parseInt(e.target.value))}
            className="w-12 h-1 bg-neutral-800 accent-neon-pink rounded-lg appearance-none cursor-pointer outline-none"
          />
        </div>
        <div className="flex justify-between w-full px-1">
          <span className="text-[7px] font-mono text-neon-cyan opacity-70">LPF</span>
          <span className={`text-[7px] font-mono font-bold ${state.filter === 0 ? "text-neutral-500" : state.filter < 0 ? "text-neon-cyan" : "text-neon-pink"}`}>
            &nbsp;{state.filter === 0 ? "FLAT" : state.filter < 0 ? "LOW-PASS" : "HI-PASS"}&nbsp;
          </span>
          <span className="text-[7px] font-mono text-neon-pink opacity-70">HPF</span>
        </div>
      </div>

      {/* Volume Fader */}
      <div className="flex flex-col items-center gap-2 pt-4 w-full">
        <div className="relative flex flex-col items-center py-2 px-2.5 bg-black/50 border border-white/10 rounded-xl">
          {/* VU Meter */}
          <div className="absolute left-2 top-3 bottom-3 w-1 flex flex-col justify-between pointer-events-none rounded overflow-hidden">
            <span className={`h-1 w-full ${state.volume > 0.8 && state.playing ? 'bg-red-500' : 'bg-red-950'}`} />
            <span className={`h-1.5 w-full ${state.volume > 0.6 && state.playing ? 'bg-amber-500' : 'bg-amber-950'}`} />
            <span className={`h-2.5 w-full ${state.volume > 0.3 && state.playing ? 'bg-emerald-500' : 'bg-emerald-950'}`} />
            <span className={`h-4 w-full ${state.volume > 0.0 && state.playing ? 'bg-emerald-500' : 'bg-emerald-950'}`} />
          </div>
          <input
            type="range"
            min="0"
            max="1.0"
            step="0.01"
            value={state.volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className={`accent-${accentBg.replace('bg-', '')} h-28 my-1 vertical-slider appearance-none w-1 bg-neutral-800 rounded outline-none cursor-pointer`}
            style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' } as any}
          />
        </div>
      </div>
    </section>
  );
}

export default function MixerDesk({
  stateA,
  stateB,
  isPlaying,
  crossfader,
  setCrossfader,
  masterVolume,
  setMasterVolume,
  isTransitioning,
  transitionProgress,
  onTriggerTransition,
  delayActive,
  reverbActive,
  onToggleFX,
  onEQChange,
  onFilterChange,
  onVolumeChange
}: MixerDeskProps) {
  const transitionPresets = [
    { id: "bass-swap", label: "Bass Swap", desc: "Swap low-ends", color: "from-neon-cyan to-blue-600" },
    { id: "echo-out", label: "Echo Out", desc: "Deep delay tail", color: "from-neon-purple to-neon-pink" },
    { id: "reverb-blend", label: "Reverb Blend", desc: "Room blend", color: "from-emerald-500 to-teal-600" },
    { id: "edm-rise", label: "EDM Rise", desc: "Pitch sweep", color: "from-neon-pink to-amber-500" },
  ] as const;

  return (
    <article aria-labelledby="mixer-title" className="glass-panel rounded-3xl p-4 border-2 border-white/10 bg-[#0a0a0c] flex flex-col gap-6 shadow-2xl relative select-none w-full max-w-sm mx-auto h-full overflow-hidden">
      <h2 id="mixer-title" className="sr-only">CENTRAL MIXER</h2>
      
      {/* Top Header: Master Vol & FX */}
      <section className="flex flex-col bg-black/30 border border-white/5 p-4 rounded-2xl gap-3 relative" aria-label="Master Controls">
        
        {/* Master Volume */}
        <div className="flex flex-col gap-2 bg-black/40 p-3 rounded-xl border border-white/5">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[10px] text-neutral-400 font-bold flex items-center gap-1"><Volume2 className="w-3 h-3" />&nbsp;MASTER&nbsp;VOL&nbsp;</span>
            {/* BPM Sync Indicator */}
            {stateA.bpm === stateB.bpm && stateA.bpm > 0 && (
              <span className="text-[8px] font-mono font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.2)] animate-pulse">
                &nbsp;BPM&nbsp;SYNCED&nbsp;
              </span>
            )}
          </div>
          <input
            type="range"
            min="0"
            max="1.0"
            step="0.01"
            value={masterVolume}
            onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
            className="w-full mt-1 accent-white bg-neutral-800 h-1.5 rounded appearance-none cursor-pointer outline-none"
          />
        </div>
        
        {/* FX Toggles */}
        <div className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-white/5">
          <span className="font-mono text-[10px] text-neutral-400 font-bold">&nbsp;GLOBAL&nbsp;FX&nbsp;</span>
          <div className="flex gap-2">
            <button
              title="Echo Delay Effect (Tail)"
              onClick={() => onToggleFX("delay", !delayActive)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-mono transition-all ${
                delayActive ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50" : "bg-neutral-900 text-neutral-500 border border-white/5 hover:text-white"
              }`}
            >
              <span>&nbsp;ECHO&nbsp;</span>
            </button>
            <button
              title="Room Reverb Effect"
              onClick={() => onToggleFX("reverb", !reverbActive)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-mono transition-all ${
                reverbActive ? "bg-neon-purple/20 text-neon-purple border border-neon-purple/50" : "bg-neutral-900 text-neutral-500 border border-white/5 hover:text-white"
              }`}
            >
              <span>&nbsp;RVB&nbsp;</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Channel Strips (A & B side by side) */}
      <div className="flex-1 flex justify-between px-4 relative">
        {/* Decorative center divider */}
        <div className="absolute top-0 bottom-0 w-[1px] bg-white/[0.03] left-1/2 -translate-x-1/2 pointer-events-none" />

        <ChannelStrip 
          deckId="A" 
          state={stateA} 
          onEQChange={(b, v) => onEQChange("A", b, v)} 
          onFilterChange={(v) => onFilterChange("A", v)} 
          onVolumeChange={(v) => onVolumeChange("A", v)} 
        />
        <ChannelStrip 
          deckId="B" 
          state={stateB} 
          onEQChange={(b, v) => onEQChange("B", b, v)} 
          onFilterChange={(v) => onFilterChange("B", v)} 
          onVolumeChange={(v) => onVolumeChange("B", v)} 
        />
      </div>

      {/* AI Automated Transitions (Collapsible or compact) */}
      <section className="bg-black/30 rounded-2xl p-4 border border-white/5 space-y-3" aria-label="AI Transitions">
        <h4 className="text-[10px] flex items-center gap-1.5 font-mono text-neon-cyan">
          <Sparkles className="w-3 h-3" />&nbsp;AI&nbsp;TRANSITIONS&nbsp;
        </h4>
        <div className="flex flex-col gap-3">
          {transitionPresets.map((preset) => (
            <button
              key={preset.id}
              title={preset.desc}
              onClick={() => onTriggerTransition(preset.id, 8)}
              disabled={isTransitioning}
              className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-center gap-1 min-h-[56px] shadow-sm ${
                isTransitioning 
                  ? "bg-neutral-900 border-white/5 opacity-40 cursor-not-allowed" 
                  : "bg-[#111113] border-white/10 hover:border-white/30 hover:bg-neutral-800 hover:-translate-y-0.5"
              }`}
            >
              <strong className="text-[10px] font-mono text-white font-bold tracking-wide">&nbsp;{preset.label}&nbsp;</strong>
              <span className="sr-only"> - </span>
              <span className="text-[8px] font-mono text-neutral-400 leading-tight">&nbsp;{preset.desc}&nbsp;</span>
            </button>
          ))}
        </div>
        
        {isTransitioning && (
          <div className="space-y-1.5 font-mono">
            <div className="flex justify-between text-[9px] text-neon-pink">
              <span>&nbsp;CROSSFADING...&nbsp;</span>
              <span>&nbsp;{transitionProgress.toFixed(0)}%&nbsp;</span>
            </div>
            <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-neon-cyan to-neon-pink transition-all duration-100"
                style={{ width: `${transitionProgress}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {/* Crossfader */}
      <section className="bg-black/30 rounded-2xl p-4 border border-white/5 space-y-3 pb-3 mt-8" aria-label="Crossfader">
        <div className="flex justify-between text-[9px] font-mono text-neutral-500">
          <span className={crossfader < 0 ? "text-neon-cyan font-bold" : ""}>&nbsp;A&nbsp;</span>
          <span>&nbsp;CROSSFADER&nbsp;</span>
          <span className={crossfader > 0 ? "text-neon-purple font-bold" : ""}>&nbsp;B&nbsp;</span>
        </div>
        <div className="relative py-2 px-3 bg-black/60 border border-white/5 rounded-xl overflow-hidden">
          {/* Dynamic Background Gradient Indicator */}
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
            background: crossfader < 0 
              ? `linear-gradient(to right, #00f3ff ${Math.abs(crossfader)}%, transparent 50%)`
              : crossfader > 0 
                ? `linear-gradient(to left, #bd00ff ${crossfader}%, transparent 50%)`
                : 'transparent'
          }} />
          <div className="absolute inset-x-8 h-0.5 bg-neutral-800 pointer-events-none rounded top-1/2 -translate-y-1/2" />
          <input
            type="range"
            min="-100"
            max="100"
            value={crossfader}
            onChange={(e) => setCrossfader(parseInt(e.target.value))}
            className={`w-full bg-transparent h-2 rounded appearance-none cursor-pointer outline-none relative z-10 ${
              crossfader < -10 ? 'accent-neon-cyan' : crossfader > 10 ? 'accent-neon-purple' : 'accent-neutral-400'
            }`}
          />
        </div>
      </section>

    </article>
  );
}
