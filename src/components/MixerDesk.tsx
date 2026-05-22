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
      <header className={`bg-gradient-to-b from-[#1c1c20] to-[#111115] rounded-xl p-3 border border-white/5 text-center shadow-[0_4px_10px_rgba(0,0,0,0.5)] relative overflow-hidden`}>
        <div className={`absolute top-0 left-0 w-full h-1 bg-${color}`} />
        <h3 className={`font-bold font-mono tracking-widest text-[14px] text-white`}>CH {deckId}</h3>
      </header>
      
      <fieldset className="flex-1 flex flex-col gap-3 bg-[#0a0a0c] rounded-2xl p-4 border border-white/10 shadow-[0_8px_20px_rgba(0,0,0,0.6)]">
        <legend className="sr-only">EQ Controls</legend>
        
        {bands.map(eq => (
          <div key={eq.label} className="bg-gradient-to-b from-[#1a1a20] to-[#111115] rounded-full p-2.5 border border-white/5 w-full grid grid-cols-[36px_1fr_36px] gap-4 items-center shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)]">
            <label className="text-[10px] font-mono text-neutral-400 font-bold text-center block px-1">{eq.label}</label>
            <input
              type="range"
              min="-12"
              max="12"
              step="0.5"
              value={eq.value}
              onChange={(e) => onEQChange(deckId, eq.band, parseFloat(e.target.value))}
              className={`w-full h-1.5 bg-[#0a0a0c] accent-${color.replace('neon-', '')}-500 rounded-lg appearance-none cursor-pointer outline-none shadow-inner block`}
            />
            <span className="text-[10px] font-mono text-neutral-300 text-center font-bold block bg-black/40 rounded px-1">
              {eq.value > 0 ? '+' : ''}{eq.value}
            </span>
          </div>
        ))}
        
        {/* Filter Knob placeholder */}
        <div className="mt-4 flex flex-col items-center gap-3 bg-gradient-to-b from-[#1c1c20] to-[#111115] rounded-2xl p-4 border border-white/5 shadow-[0_4px_10px_rgba(0,0,0,0.3)]">
          <div className="w-14 h-14 rounded-full bg-gradient-to-b from-[#222] to-[#111] border-[3px] border-[#333] shadow-[0_6px_10px_rgba(0,0,0,0.8)] flex items-center justify-center relative cursor-pointer active:scale-95 transition-transform">
            <div className={`absolute top-0 bottom-1/2 w-1 bg-${color} rounded-t-full origin-bottom shadow-[0_0_8px_rgba(255,255,255,0.2)]`} />
            <div className="w-8 h-8 rounded-full bg-[#0a0a0c] shadow-inner" />
          </div>
          <span className="text-[10px] font-mono font-bold tracking-widest text-neutral-400 bg-black/50 px-3 py-1 rounded-full border border-white/5">FLTR</span>
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
    <article className="bg-gradient-to-b from-[#1a1a20] to-[#0a0a0c] rounded-[32px] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] border-2 border-[#222] flex flex-col h-full relative">
      
      {/* Glow highlight */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-48 h-[2px] bg-gradient-to-r from-transparent via-white/20 to-transparent shadow-[0_0_15px_rgba(255,255,255,0.1)]`} />

      {/* Mixer Header */}
      <header className="flex items-center justify-between mb-8 border-b border-white/5 pb-4 bg-[#111115] -mx-2 px-4 py-3 rounded-2xl shadow-[0_4px_15px_rgba(0,0,0,0.4)]">
        <h2 className="font-bold tracking-widest text-sm flex items-center gap-3">
          <Sliders className="w-5 h-5 text-neutral-400" />
          <span className="text-white">CENTRAL <span className="text-neutral-500 font-light">MIXER</span></span>
        </h2>
        <div className="flex gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse delay-75" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse delay-150" />
        </div>
      </header>

      {/* Top Section: Master / Global FX */}
      <section className="flex flex-col gap-4 relative mb-6">
        
        {/* Master Volume */}
        <fieldset className="flex flex-col gap-3 bg-[#0a0a0c] p-5 rounded-2xl border border-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
          <legend className="sr-only">Master Volume</legend>
          <div className="flex justify-between items-center bg-[#1a1a20] px-4 py-2 rounded-xl border border-white/5">
            <span className="font-mono text-[11px] text-neutral-400 font-bold flex items-center gap-2 block">
              <Volume2 className="w-4 h-4 text-white" />MASTER VOL
            </span>
            {stateA.bpm === stateB.bpm && stateA.bpm > 0 && (
              <span className="text-[10px] font-mono font-bold text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.3)] animate-pulse block">
                SYNCED
              </span>
            )}
          </div>
          <div className="px-2 pt-2">
            <input
              type="range"
              min="0"
              max="1.0"
              step="0.01"
              value={masterVolume}
              onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
              className="w-full h-2 bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 rounded-full appearance-none cursor-pointer outline-none shadow-[inset_0_2px_5px_rgba(0,0,0,0.5)] block"
              style={{
                ['--thumb-size' as any]: '24px',
                WebkitAppearance: 'none'
              }}
            />
          </div>
        </fieldset>
        
        {/* FX Toggles */}
        <fieldset className="flex flex-col gap-3 bg-[#0a0a0c] p-5 rounded-2xl border border-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
          <legend className="font-mono text-[11px] text-neutral-500 font-bold tracking-widest mb-1 bg-[#1a1a20] px-3 py-1 rounded-full border border-white/5 inline-block -mt-8 ml-2 absolute">GLOBAL FX</legend>
          <div className="grid grid-cols-2 gap-5 mt-2">
            <button
              type="button"
              onClick={() => onToggleFX("delay", !delayActive)}
              className={`p-4 rounded-xl text-[12px] font-mono font-bold transition-all flex flex-col items-center justify-center gap-1 shadow-[0_6px_10px_rgba(0,0,0,0.5)] border-t border-t-white/10 border-b-4 block w-full active:translate-y-1 active:border-b-0 ${
                delayActive 
                  ? "bg-gradient-to-b from-cyan-900 to-cyan-950 text-neon-cyan border-b-cyan-700 ring-2 ring-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.4)]" 
                  : "bg-gradient-to-b from-neutral-800 to-neutral-900 text-neutral-400 border-b-black hover:text-white"
              }`}
            >
              <span className={`w-2 h-2 rounded-full mb-1 ${delayActive ? 'bg-neon-cyan shadow-[0_0_8px_#06b6d4]' : 'bg-neutral-600'}`} />
              ECHO
            </button>
            <button
              type="button"
              onClick={() => onToggleFX("reverb", !reverbActive)}
              className={`p-4 rounded-xl text-[12px] font-mono font-bold transition-all flex flex-col items-center justify-center gap-1 shadow-[0_6px_10px_rgba(0,0,0,0.5)] border-t border-t-white/10 border-b-4 block w-full active:translate-y-1 active:border-b-0 ${
                reverbActive 
                  ? "bg-gradient-to-b from-purple-900 to-purple-950 text-neon-purple border-b-purple-700 ring-2 ring-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.4)]" 
                  : "bg-gradient-to-b from-neutral-800 to-neutral-900 text-neutral-400 border-b-black hover:text-white"
              }`}
            >
              <span className={`w-2 h-2 rounded-full mb-1 ${reverbActive ? 'bg-neon-purple shadow-[0_0_8px_#a855f7]' : 'bg-neutral-600'}`} />
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
      <article className="bg-[#111115] rounded-2xl p-5 border border-white/5 mb-8 shadow-[inset_0_2px_15px_rgba(0,0,0,0.5)]">
        <header className="mb-4 bg-[#1a1a20] px-4 py-2 rounded-xl border border-white/5 inline-block">
          <h4 className="text-[12px] flex items-center gap-2 font-mono font-bold text-neon-cyan m-0 tracking-widest">
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
              className={`p-4 rounded-xl border transition-all flex flex-col justify-center gap-1.5 min-h-[80px] block w-full shadow-[0_6px_10px_rgba(0,0,0,0.5)] active:translate-y-1 active:shadow-inner ${
                isTransitioning 
                  ? "bg-neutral-900 border-white/5 opacity-40 cursor-not-allowed" 
                  : "bg-gradient-to-b from-[#222] to-[#111] border-t-white/10 border-b-black border-l-white/5 border-r-white/5 hover:border-white/20 hover:from-[#2a2a30] hover:to-[#1a1a20]"
              }`}
            >
              <strong className="block text-[13px] font-bold text-white tracking-wide text-left">{preset.label}</strong>
              <span className="block text-[10px] font-mono text-neutral-400 leading-tight text-left">{preset.desc}</span>
            </button>
          ))}
        </div>
      </article>

      {/* Crossfader Area */}
      <fieldset className="bg-gradient-to-b from-[#0a0a0c] to-[#111115] rounded-2xl p-8 border border-white/10 mt-auto relative shadow-[inset_0_10px_20px_rgba(0,0,0,0.8)]">
        <legend className="sr-only">Crossfader</legend>
        
        {/* Crossfader track */}
        <div className="absolute top-1/2 left-10 right-10 h-2.5 bg-black rounded-full -translate-y-1/2 border border-white/5 shadow-[inset_0_2px_5px_rgba(0,0,0,0.9)]" />
        
        {/* Markers */}
        <div className="absolute top-1/2 left-1/2 w-0.5 h-8 bg-white/20 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_4px_rgba(255,255,255,0.2)]" />
        <div className="absolute top-1/2 left-10 w-0.5 h-5 bg-white/10 -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute top-1/2 right-10 w-0.5 h-5 bg-white/10 translate-x-1/2 -translate-y-1/2" />
        <div className="absolute top-1/2 left-1/4 w-0.5 h-3 bg-white/5 -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute top-1/2 right-1/4 w-0.5 h-3 bg-white/5 translate-x-1/2 -translate-y-1/2" />
        
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={crossfader}
          onChange={(e) => setCrossfader(parseFloat(e.target.value))}
          className="w-full appearance-none bg-transparent relative z-10 cursor-pointer outline-none block"
          style={{
            ['--thumb-size' as any]: '48px',
            WebkitAppearance: 'none'
          }}
        />

        <style dangerouslySetInnerHTML={{__html: `
          input[type=range]::-webkit-slider-thumb {
            -webkit-appearance: none;
            height: 48px;
            width: 28px;
            border-radius: 4px;
            background: linear-gradient(to bottom, #2a2a30, #171717);
            border: 2px solid #111;
            border-top: 1px solid rgba(255,255,255,0.3);
            box-shadow: 0 8px 15px rgba(0,0,0,0.8), inset 0 0 4px rgba(255,255,255,0.1);
            cursor: pointer;
            margin-top: -22px;
            position: relative;
            transition: transform 0.05s;
          }
          input[type=range]::-webkit-slider-thumb:active {
            transform: scale(0.95);
            box-shadow: 0 4px 8px rgba(0,0,0,0.8), inset 0 0 4px rgba(255,255,255,0.1);
          }
          input[type=range]::-webkit-slider-thumb::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 3px;
            height: 24px;
            background: rgba(255,255,255,0.8);
            border-radius: 2px;
            box-shadow: 0 0 5px rgba(255,255,255,0.4);
          }
        `}} />
      </fieldset>
    </article>
  );
}
