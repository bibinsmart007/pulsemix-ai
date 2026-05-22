"use client";

import React from "react";
import { Sliders, Volume2, Sparkles } from "lucide-react";
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
  onTriggerTransition: (presetId: "echo-out" | "bass-swap" | "edm-rise" | "reverb-blend", durationBars: number) => void;
  delayActive: boolean;
  reverbActive: boolean;
  onToggleFX: (fxType: "delay" | "reverb", active: boolean) => void;
  onEQChange: (deckId: "A" | "B", band: "high" | "mid" | "low", val: number) => void;
  onFilterChange: (deckId: "A" | "B", val: number) => void;
  onVolumeChange: (deckId: "A" | "B", val: number) => void;
}

// Sub-Component: Channel Strip
function ChannelStrip({ 
  deckId, state, onEQChange, onVolumeChange, color 
}: { 
  deckId: "A"|"B", state: DeckState, onEQChange: any, onVolumeChange: any, color: string 
}) {
  const bands = [
    { label: "HI", value: state.eqHigh, band: "high" as const },
    { label: "MID", value: state.eqMid, band: "mid" as const },
    { label: "LOW", value: state.eqLow, band: "low" as const },
  ];

  return (
    <article className="flex-1 flex flex-col gap-4">
      <header className={`bg-neutral-900/80 rounded-xl p-3 border border-white/5 text-center shadow-inner relative overflow-hidden`}>
        <div className={`absolute top-0 left-0 w-full h-1 bg-${color}`} />
        <h3 className="font-bold font-mono tracking-widest text-[11px] text-white">CH {deckId}</h3>
      </header>
      
      <fieldset className="flex-1 flex flex-col gap-2 bg-black/20 rounded-2xl p-4 border border-white/5">
        <legend className="sr-only">EQ Controls</legend>
        {bands.map(eq => (
          <div key={eq.label} className="bg-[#0a0a0c] rounded-xl p-3.5 border border-white/10 w-full grid grid-cols-[40px_1fr_40px] gap-4 items-center shadow-md mb-2">
            <label className="text-[10px] font-mono text-neutral-400 font-bold text-left block">{eq.label}</label>
            <input
              type="range"
              min="-12"
              max="12"
              step="0.5"
              value={eq.value}
              onChange={(e) => onEQChange(deckId, eq.band, parseFloat(e.target.value))}
              className="w-full h-1.5 bg-neutral-800 accent-neutral-300 rounded-lg appearance-none cursor-pointer outline-none block"
            />
            <span className="text-[10px] font-mono text-neutral-500 text-right font-bold block">
              {eq.value > 0 ? '+' : ''}{eq.value}
            </span>
          </div>
        ))}
        
        {/* Filter Knob placeholder */}
        <div className="mt-4 flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-neutral-900 border-2 border-neutral-700 shadow-inner flex items-center justify-center relative">
            <div className="w-1 h-3 bg-white/50 rounded-full absolute top-1" />
          </div>
          <span className="text-[9px] font-mono font-bold text-neutral-500">FLTR</span>
        </div>
      </fieldset>
    </article>
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
    { id: 'bass-swap', label: 'Bass Swap', desc: 'Swap low-ends' },
    { id: 'echo-out', label: 'Echo Out', desc: 'Deep delay tail' },
    { id: 'edm-rise', label: 'EDM Rise', desc: 'HPF + LPF sweep' },
    { id: 'reverb-blend', label: 'Reverb Blend', desc: 'Instant 100% switch' },
  ];

  return (
    <article className="glass-panel rounded-3xl p-6 shadow-2xl border border-white/5 flex flex-col h-full bg-gradient-to-b from-neutral-900/50 to-black/80">
      
      {/* Mixer Header */}
      <header className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
        <h2 className="font-bold tracking-widest text-sm flex items-center gap-2">
          <Sliders className="w-5 h-5 text-neutral-400" />
          <span className="text-white">CENTRAL</span>
          <span className="text-neutral-500">MIXER</span>
        </h2>
        <div className="flex gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500/50 animate-pulse" />
          <div className="w-2 h-2 rounded-full bg-amber-500/50 animate-pulse delay-75" />
          <div className="w-2 h-2 rounded-full bg-emerald-500/50 animate-pulse delay-150" />
        </div>
      </header>

      {/* Top Section: Master / Global FX */}
      <section className="flex flex-col gap-3 relative mb-6">
        
        {/* Master Volume */}
        <fieldset className="flex flex-col gap-3 bg-[#0a0a0c] p-5 rounded-2xl border border-white/10 shadow-md">
          <legend className="sr-only">Master Volume</legend>
          <div className="flex justify-between items-center">
            <span className="font-mono text-[11px] text-neutral-400 font-bold flex items-center gap-2 block">
              <Volume2 className="w-4 h-4" />MASTER VOL
            </span>
            {stateA.bpm === stateB.bpm && stateA.bpm > 0 && (
              <span className="text-[9px] font-mono font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.2)] animate-pulse block">
                BPM SYNCED
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
            className="w-full mt-3 accent-white bg-neutral-800 h-2 rounded appearance-none cursor-pointer outline-none block"
          />
        </fieldset>
        
        {/* FX Toggles */}
        <fieldset className="flex flex-col gap-3 bg-[#0a0a0c] p-5 rounded-2xl border border-white/10 shadow-md">
          <legend className="font-mono text-[11px] text-neutral-400 font-bold tracking-wider mb-1 block">GLOBAL FX</legend>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => onToggleFX("delay", !delayActive)}
              className={`p-3 rounded-xl text-[11px] font-mono font-bold transition-all shadow-inner border block w-full ${
                delayActive ? "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/50" : "bg-neutral-900 text-neutral-500 border-white/10 hover:bg-neutral-800 hover:text-white"
              }`}
            >
              ECHO
            </button>
            <button
              type="button"
              onClick={() => onToggleFX("reverb", !reverbActive)}
              className={`p-3 rounded-xl text-[11px] font-mono font-bold transition-all shadow-inner border block w-full ${
                reverbActive ? "bg-neon-purple/20 text-neon-purple border-neon-purple/50" : "bg-neutral-900 text-neutral-500 border-white/10 hover:bg-neutral-800 hover:text-white"
              }`}
            >
              REVERB
            </button>
          </div>
        </fieldset>
      </section>

      {/* Middle Section: Channel Strips */}
      <section className="flex gap-6 flex-1 mb-8">
        <ChannelStrip deckId="A" state={stateA} onEQChange={onEQChange} onVolumeChange={onVolumeChange} color="neon-cyan" />
        <ChannelStrip deckId="B" state={stateB} onEQChange={onEQChange} onVolumeChange={onVolumeChange} color="neon-purple" />
      </section>

      {/* AI Transitions Area */}
      <article className="bg-black/40 rounded-2xl p-5 border border-white/5 mb-8">
        <header className="mb-4">
          <h4 className="text-[11px] flex items-center gap-2 font-mono font-bold text-neon-cyan m-0">
            <Sparkles className="w-4 h-4" />AI TRANSITIONS
          </h4>
        </header>
        <div className="grid grid-cols-2 gap-4">
          {transitionPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onTriggerTransition(preset.id as "echo-out" | "bass-swap" | "edm-rise" | "reverb-blend", 8)}
              disabled={isTransitioning}
              className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-center gap-2 shadow-lg min-h-[72px] block w-full ${
                isTransitioning 
                  ? "bg-neutral-900 border-white/5 opacity-40 cursor-not-allowed" 
                  : "bg-[#0a0a0c] border-white/10 hover:border-white/30 hover:bg-neutral-800 hover:-translate-y-1 active:scale-95"
              }`}
            >
              <strong className="block text-[12px] font-mono text-white font-bold tracking-wide">{preset.label}</strong>
              <span className="block text-[9px] font-mono text-neutral-400 leading-tight">{preset.desc}</span>
            </button>
          ))}
        </div>
      </article>

      {/* Crossfader Area */}
      <fieldset className="bg-[#0a0a0c] rounded-2xl p-6 border border-white/10 mt-auto relative shadow-inner">
        <legend className="sr-only">Crossfader</legend>
        
        {/* Crossfader track */}
        <div className="absolute top-1/2 left-8 right-8 h-1.5 bg-black rounded-full -translate-y-1/2 border border-white/5" />
        
        {/* Markers */}
        <div className="absolute top-1/2 left-1/2 w-0.5 h-6 bg-white/10 -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute top-1/2 left-8 w-0.5 h-4 bg-white/10 -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute top-1/2 right-8 w-0.5 h-4 bg-white/10 translate-x-1/2 -translate-y-1/2" />
        
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={crossfader}
          onChange={(e) => setCrossfader(parseFloat(e.target.value))}
          className="w-full appearance-none bg-transparent relative z-10 cursor-pointer outline-none block"
          style={{
            ['--thumb-size' as any]: '40px',
            WebkitAppearance: 'none'
          }}
        />

        <style dangerouslySetInnerHTML={{__html: `
          input[type=range]::-webkit-slider-thumb {
            -webkit-appearance: none;
            height: 40px;
            width: 24px;
            border-radius: 4px;
            background: #171717;
            border: 2px solid #333;
            box-shadow: 0 0 10px rgba(0,0,0,0.8), inset 0 0 4px rgba(255,255,255,0.1);
            cursor: pointer;
            margin-top: -19px;
            position: relative;
          }
          input[type=range]::-webkit-slider-thumb::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 2px;
            height: 20px;
            background: rgba(255,255,255,0.5);
            border-radius: 2px;
          }
        `}} />
      </fieldset>
    </article>
  );
}
