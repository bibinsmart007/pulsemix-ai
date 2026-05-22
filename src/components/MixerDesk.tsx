"use client";

import React from "react";
import { Sliders, Volume2, Sparkles, Activity } from "lucide-react";
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
    <article className="flex-1 flex flex-col gap-5">
      <header className="bg-[#111115] rounded-[16px] p-4 border border-[#222] text-center shadow-[0_6px_15px_rgba(0,0,0,0.5)] relative overflow-hidden flex items-center justify-center">
        <div className={`absolute top-0 left-0 w-full h-[6px] bg-${color}`} />
        <h3 className="font-bold font-mono tracking-widest text-[16px] text-white mt-1 whitespace-nowrap">{"CH " + deckId}</h3>
      </header>
      
      <div className="flex-1 flex flex-col gap-6 bg-[#0a0a0c] rounded-[24px] p-6 border border-[#222] shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
        
        {/* EQ Section */}
        <section className="flex flex-col space-y-3">
          <header className="border-b border-[#222] pb-2 mb-1">
            <h4 className="text-[10px] font-mono font-bold text-neutral-500 tracking-[0.2em] text-center block">EQ</h4>
          </header>
          
          <ul className="flex flex-col space-y-4 list-none p-0 m-0 w-full">
            {bands.map(eq => (
              <li key={eq.label} className="w-full block">
                <div className="bg-[#111115] rounded-[12px] py-3 px-3 border border-[#222] w-full flex items-center justify-between gap-4 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]">
                  <div className="w-[44px] shrink-0 block">
                    <label className="text-[10px] bg-black border border-[#333] rounded px-1.5 py-1 text-neutral-400 font-bold text-center block tracking-widest shadow-inner">{eq.label}</label>
                  </div>
                  
                  <div className="flex-1 relative h-2.5 block">
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="0.5"
                      value={eq.value}
                      onChange={(e) => onEQChange(deckId, eq.band, parseFloat(e.target.value))}
                      className={`absolute inset-0 w-full h-full bg-black accent-${color.replace('neon-', '')}-500 rounded-full appearance-none cursor-pointer outline-none shadow-[inset_0_2px_5px_rgba(0,0,0,0.8)] block z-10`}
                    />
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-4 bg-white/20" />
                  </div>

                  <div className="w-[44px] shrink-0 block">
                    <span className={`text-[11px] font-mono text-white text-center font-bold block rounded border py-1 shadow-[0_2px_5px_rgba(0,0,0,0.5)] w-full ${eq.value === 0 ? 'bg-[#1a1a20] border-[#333] text-neutral-400' : 'bg-gradient-to-b from-[#222] to-black border-[#444]'}`}>
                      {eq.value > 0 ? '+' : ''}{eq.value}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Filter Section */}
        <section className="flex flex-col gap-4 mt-2 border-t border-[#222] pt-6">
          <div className="flex flex-col items-center gap-4 bg-[#111115] rounded-[20px] p-5 border border-[#222] shadow-[inset_0_2px_15px_rgba(0,0,0,0.8)]">
            <header>
              <h4 className="text-[11px] font-mono font-bold tracking-[0.2em] text-neutral-500 bg-black px-4 py-1.5 rounded-full border border-[#222]">FLTR</h4>
            </header>
            
            <div className="w-16 h-16 rounded-full bg-gradient-to-b from-[#2a2a30] to-[#111] border-[4px] border-[#333] shadow-[0_8px_15px_rgba(0,0,0,0.9)] flex items-center justify-center relative cursor-pointer active:scale-95 transition-transform">
              <div className={`absolute top-0 bottom-1/2 w-1.5 bg-${color} rounded-t-full origin-bottom shadow-[0_0_10px_rgba(255,255,255,0.3)]`} />
              <div className="w-8 h-8 rounded-full bg-black shadow-inner border border-white/5" />
            </div>
          </div>
        </section>

      </div>
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
    <article className="bg-[#111115] rounded-[36px] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.9)] border-2 border-[#1a1a20] flex flex-col h-full relative overflow-y-auto">
      
      {/* Glow highlight */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-64 h-[3px] bg-gradient-to-r from-transparent via-white/30 to-transparent shadow-[0_0_20px_rgba(255,255,255,0.2)]`} />

      {/* Mixer Header */}
      <header className="flex items-center justify-between mb-8 bg-black/60 px-6 py-4 rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.5)] border border-[#222]">
        <h2 className="font-bold tracking-widest text-[16px] flex items-center gap-3">
          <Sliders className="w-6 h-6 text-neutral-400" />
          <span className="text-white drop-shadow-md">CENTRAL MIXER</span>
        </h2>
        <div className="flex gap-3 bg-[#111] px-4 py-2 rounded-full border border-white/10">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)] animate-pulse delay-75" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] animate-pulse delay-150" />
        </div>
      </header>

      {/* Top Section: Master / Global FX */}
      <section className="grid grid-cols-2 gap-6 relative mb-8">
        
        {/* Master Volume Block */}
        <ul className="flex flex-col bg-[#0a0a0c] p-6 rounded-[24px] border border-[#222] shadow-[0_8px_25px_rgba(0,0,0,0.6)] gap-4 list-none m-0">
          <li className="block w-full">
            <header className="flex justify-between items-center bg-[#111115] px-5 py-3 rounded-xl border border-[#222] shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
              <h3 className="font-mono text-[12px] text-white font-bold flex items-center gap-2 tracking-[0.1em]">
                <Volume2 className="w-4 h-4 text-neutral-400" /> MASTER
              </h3>
              {stateA.bpm === stateB.bpm && stateA.bpm > 0 && (
                <span className="text-[10px] font-mono font-bold text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.4)] animate-pulse tracking-widest block">
                  SYNCED
                </span>
              )}
            </header>
          </li>
          
          <li className="block w-full flex-1 flex flex-col justify-center px-2 py-4">
            <input
              type="range"
              min="0"
              max="1.0"
              step="0.01"
              value={masterVolume}
              onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
              className="w-full h-2.5 bg-gradient-to-r from-emerald-500 via-amber-500 to-red-600 rounded-full appearance-none cursor-pointer outline-none shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)] block"
              style={{
                ['--thumb-size' as any]: '28px',
                WebkitAppearance: 'none'
              }}
            />
          </li>
          
          <li className="block w-full text-center mt-2">
            <div className="bg-gradient-to-b from-[#222] to-black border border-[#444] shadow-[0_4px_10px_rgba(0,0,0,0.8)] rounded-full px-5 py-1.5 inline-flex items-center justify-center min-w-[80px]">
              <span className="text-[11px] font-mono text-white font-bold tracking-widest block whitespace-nowrap">
                {"VOL " + (masterVolume * 100).toFixed(0) + "%"}
              </span>
            </div>
          </li>
        </ul>
        
        {/* FX Toggles Block */}
        <article className="flex flex-col bg-[#0a0a0c] p-6 rounded-[24px] border border-[#222] shadow-[0_8px_25px_rgba(0,0,0,0.6)] gap-4">
          <header className="flex items-center bg-[#111115] px-5 py-3 rounded-xl border border-[#222] shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
            <h3 className="font-mono text-[12px] text-white font-bold flex items-center gap-2 tracking-[0.1em]">
              <Activity className="w-4 h-4 text-neutral-400" /> GLOBAL FX
            </h3>
          </header>

          <ul className="grid grid-cols-2 gap-4 flex-1 list-none p-0 m-0 w-full">
            <li className="block w-full">
              <button
                type="button"
                onClick={() => onToggleFX("delay", !delayActive)}
                className={`rounded-[16px] text-[13px] font-mono font-bold transition-all flex flex-col items-center justify-center gap-2 shadow-[0_6px_0_rgba(0,0,0,0.8)] border-[3px] block w-full active:translate-y-[6px] active:shadow-none min-h-[64px] ${
                  delayActive 
                    ? "bg-cyan-950 text-cyan-400 border-cyan-800 shadow-[0_2px_0_rgba(0,0,0,0.8),inset_0_0_20px_rgba(6,182,212,0.4)] translate-y-[4px]" 
                    : "bg-[#1a1a20] text-neutral-400 border-white/10 hover:text-white hover:bg-[#222]"
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${delayActive ? 'bg-cyan-400 shadow-[0_0_12px_#22d3ee]' : 'bg-neutral-700'}`} />
                <span className="block w-full text-center">ECHO</span>
              </button>
            </li>
            <li className="block w-full">
              <button
                type="button"
                onClick={() => onToggleFX("reverb", !reverbActive)}
                className={`rounded-[16px] text-[13px] font-mono font-bold transition-all flex flex-col items-center justify-center gap-2 shadow-[0_6px_0_rgba(0,0,0,0.8)] border-[3px] block w-full active:translate-y-[6px] active:shadow-none min-h-[64px] ${
                  reverbActive 
                    ? "bg-purple-950 text-purple-400 border-purple-800 shadow-[0_2px_0_rgba(0,0,0,0.8),inset_0_0_20px_rgba(168,85,247,0.4)] translate-y-[4px]" 
                    : "bg-[#1a1a20] text-neutral-400 border-white/10 hover:text-white hover:bg-[#222]"
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${reverbActive ? 'bg-purple-400 shadow-[0_0_12px_#c084fc]' : 'bg-neutral-700'}`} />
                <span className="block w-full text-center">REVERB</span>
              </button>
            </li>
          </ul>
        </article>
      </section>

      {/* Middle Section: Channel Strips */}
      <section className="flex gap-8 flex-1 mb-8">
        <ChannelStrip deckId="A" state={stateA} onEQChange={onEQChange} onVolumeChange={onVolumeChange} color="neon-cyan" />
        <ChannelStrip deckId="B" state={stateB} onEQChange={onEQChange} onVolumeChange={onVolumeChange} color="neon-purple" />
      </section>

      {/* AI Transitions Block */}
      <article className="bg-[#0a0a0c] rounded-[24px] p-6 border border-[#222] mb-8 shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
        <header className="flex items-center gap-3 border-b border-[#222] pb-4 mb-5">
          <h3 className="text-[14px] flex items-center gap-2 font-mono font-bold text-neon-cyan tracking-[0.2em] uppercase">
            <Sparkles className="w-5 h-5" /> AI TRANSITIONS
          </h3>
          <div className="flex-1 h-[1px] bg-gradient-to-r from-neon-cyan/20 to-transparent" />
        </header>

        <ul className="grid grid-cols-2 gap-4 list-none p-0 m-0 w-full">
          {transitionPresets.map((preset) => (
            <li key={preset.id} className="block w-full">
              <button
                type="button"
                onClick={() => onTriggerTransition(preset.id as "echo-out" | "bass-swap" | "edm-rise" | "reverb-blend", 8)}
                disabled={isTransitioning}
                className={`p-5 rounded-[16px] border-[2px] transition-all flex flex-col gap-2 min-h-[96px] block w-full shadow-[0_6px_15px_rgba(0,0,0,0.6)] active:translate-y-1 active:shadow-inner ${
                  isTransitioning 
                    ? "bg-[#111] border-[#222] opacity-40 cursor-not-allowed" 
                    : "bg-gradient-to-b from-[#1a1a20] to-[#111] border-[#333] hover:border-white/20 hover:from-[#222] hover:to-[#1a1a20]"
                }`}
              >
                <h4 className="block text-[15px] font-bold text-white tracking-wide text-left drop-shadow-md w-full m-0 p-0">{preset.label}</h4>
                <p className="block text-[11px] font-mono text-neutral-400 leading-relaxed text-left border-t border-white/5 pt-2 w-full m-0">{preset.desc}</p>
              </button>
            </li>
          ))}
        </ul>
      </article>

      {/* Crossfader Area */}
      <article className="bg-gradient-to-b from-[#050508] to-[#0a0a0e] rounded-[24px] p-10 border border-[#222] mt-auto relative shadow-[inset_0_15px_30px_rgba(0,0,0,1)]">
        <header className="sr-only">
          <h3>Crossfader</h3>
        </header>
        
        {/* Crossfader track */}
        <div className="absolute top-1/2 left-12 right-12 h-3 bg-black rounded-full -translate-y-1/2 border border-white/10 shadow-[inset_0_4px_10px_rgba(0,0,0,1)]" />
        
        {/* Markers */}
        <div className="absolute top-1/2 left-1/2 w-0.5 h-10 bg-white/30 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_5px_rgba(255,255,255,0.4)]" />
        <div className="absolute top-1/2 left-12 w-0.5 h-6 bg-white/20 -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute top-1/2 right-12 w-0.5 h-6 bg-white/20 translate-x-1/2 -translate-y-1/2" />
        <div className="absolute top-1/2 left-[30%] w-0.5 h-4 bg-white/10 -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute top-1/2 right-[30%] w-0.5 h-4 bg-white/10 translate-x-1/2 -translate-y-1/2" />
        
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={crossfader}
          onChange={(e) => setCrossfader(parseFloat(e.target.value))}
          className="w-full appearance-none bg-transparent relative z-10 cursor-pointer outline-none block"
          style={{
            ['--thumb-size' as any]: '56px',
            WebkitAppearance: 'none'
          }}
        />

        <style dangerouslySetInnerHTML={{__html: `
          input[type=range]::-webkit-slider-thumb {
            -webkit-appearance: none;
            height: 56px;
            width: 32px;
            border-radius: 6px;
            background: linear-gradient(to bottom, #333, #111);
            border: 3px solid #000;
            border-top: 2px solid rgba(255,255,255,0.4);
            box-shadow: 0 10px 20px rgba(0,0,0,0.9), inset 0 0 5px rgba(255,255,255,0.2);
            cursor: pointer;
            margin-top: -26px;
            position: relative;
            transition: transform 0.05s;
          }
          input[type=range]::-webkit-slider-thumb:active {
            transform: scale(0.95);
            box-shadow: 0 4px 10px rgba(0,0,0,0.9), inset 0 0 5px rgba(255,255,255,0.2);
          }
          input[type=range]::-webkit-slider-thumb::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 4px;
            height: 28px;
            background: rgba(255,255,255,0.9);
            border-radius: 2px;
            box-shadow: 0 0 8px rgba(255,255,255,0.6);
          }
        `}} />
      </article>
    </article>
  );
}
