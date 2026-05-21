"use client";

import React from "react";
import { SlidersHorizontal } from "lucide-react";
import { DeckState } from "@/types/audio";

interface EQControlsProps {
  deckId: "A" | "B";
  state: DeckState;
  onEQChange: (band: "low" | "mid" | "high", db: number) => void;
  onFilterChange: (val: number) => void;
  onVolumeChange: (vol: number) => void;
}

export default function EQControls({
  deckId,
  state,
  onEQChange,
  onFilterChange,
  onVolumeChange,
}: EQControlsProps) {
  const isA = deckId === "A";
  const accentColor = isA ? "text-neon-cyan" : "text-neon-purple";
  const accentBg = isA ? "bg-neon-cyan" : "bg-neon-purple";
  const accentBorder = isA ? "border-neon-cyan/30" : "border-neon-purple/30";

  // Helper to color EQ based on value (boost = green, cut = red, flat = neutral)
  const getValColor = (val: number) => {
    if (val > 0) return "text-emerald-400";
    if (val < 0) return "text-rose-400";
    return "text-neutral-400";
  };

  return (
    <div className="glass-panel rounded-3xl p-5 border border-white/5 flex flex-col items-center justify-between gap-6 w-full max-w-[130px] shadow-lg select-none relative">
      {/* Decorative vertical metallic structural line */}
      <div className="absolute top-10 bottom-10 w-[1px] bg-white/[0.02] left-1/2 -translate-x-1/2 pointer-events-none" />

      {/* Header */}
      <div className="font-mono text-[9px] font-bold text-neutral-500 flex flex-col items-center gap-1 z-10">
        <span className={accentColor}>CH {deckId}</span>
        <span>EQUALIZER</span>
      </div>

      {/* High EQ Knob Row */}
      <div className="flex flex-col items-center gap-1.5 w-full z-10">
        <label className="text-[8px] font-mono text-neutral-400 font-bold">HI EQ</label>
        <div className="relative w-full flex items-center justify-center">
          <input
            type="range"
            min="-12"
            max="12"
            step="0.5"
            value={state.eqHigh}
            onChange={(e) => onEQChange("high", parseFloat(e.target.value))}
            className="w-16 h-1 bg-neutral-800 accent-neutral-200 rounded-lg appearance-none cursor-pointer outline-none"
          />
        </div>
        <span className={`text-[8.5px] font-mono font-semibold ${getValColor(state.eqHigh)}`}>
          {state.eqHigh > 0 ? "+" : ""}
          {state.eqHigh.toFixed(1)} dB
        </span>
      </div>

      {/* Mid EQ Knob Row */}
      <div className="flex flex-col items-center gap-1.5 w-full z-10">
        <label className="text-[8px] font-mono text-neutral-400 font-bold">MID EQ</label>
        <div className="relative w-full flex items-center justify-center">
          <input
            type="range"
            min="-12"
            max="12"
            step="0.5"
            value={state.eqMid}
            onChange={(e) => onEQChange("mid", parseFloat(e.target.value))}
            className="w-16 h-1 bg-neutral-800 accent-neutral-200 rounded-lg appearance-none cursor-pointer outline-none"
          />
        </div>
        <span className={`text-[8.5px] font-mono font-semibold ${getValColor(state.eqMid)}`}>
          {state.eqMid > 0 ? "+" : ""}
          {state.eqMid.toFixed(1)} dB
        </span>
      </div>

      {/* Low EQ Knob Row */}
      <div className="flex flex-col items-center gap-1.5 w-full z-10">
        <label className="text-[8px] font-mono text-neutral-400 font-bold">LOW EQ</label>
        <div className="relative w-full flex items-center justify-center">
          <input
            type="range"
            min="-12"
            max="12"
            step="0.5"
            value={state.eqLow}
            onChange={(e) => onEQChange("low", parseFloat(e.target.value))}
            className="w-16 h-1 bg-neutral-800 accent-neutral-200 rounded-lg appearance-none cursor-pointer outline-none"
          />
        </div>
        <span className={`text-[8.5px] font-mono font-semibold ${getValColor(state.eqLow)}`}>
          {state.eqLow > 0 ? "+" : ""}
          {state.eqLow.toFixed(1)} dB
        </span>
      </div>

      {/* Bipolar Pioneer Color Filter Sweep Knob */}
      <div className="flex flex-col items-center gap-1.5 w-full pt-2 border-t border-white/5 z-10">
        <label className="text-[8px] font-mono text-neon-pink font-bold">LPF / HPF</label>
        <div className="relative w-full flex items-center justify-center">
          <input
            type="range"
            min="-100"
            max="100"
            step="1"
            value={state.filter}
            onChange={(e) => onFilterChange(parseInt(e.target.value))}
            className="w-16 h-1 bg-neutral-800 accent-neon-pink rounded-lg appearance-none cursor-pointer outline-none"
          />
        </div>
        <span className={`text-[8px] font-mono font-bold ${
          state.filter === 0 
            ? "text-neutral-500" 
            : state.filter < 0 
              ? "text-neon-cyan text-glow-cyan" 
              : "text-neon-pink text-glow-pink"
        }`}>
          {state.filter === 0 
            ? "FLAT" 
            : state.filter < 0 
              ? `LPF: ${Math.abs(state.filter)}%` 
              : `HPF: ${state.filter}%`
          }
        </span>
      </div>

      {/* Channel Volume Gain Slider */}
      <div className="flex flex-col items-center gap-2 pt-3 border-t border-white/5 w-full z-10">
        <label className="text-[8.5px] font-mono text-neutral-400 font-bold">GAIN</label>
        <div className="relative flex flex-col items-center w-full py-1.5 px-2 bg-black/50 border border-white/[0.03] rounded-xl">
          {/* VU Meter graphics */}
          <div className="absolute left-2.5 top-3 bottom-3 w-1.5 flex flex-col justify-between pointer-events-none rounded overflow-hidden">
            <span className={`h-1.5 w-full rounded-sm ${state.volume > 0.8 && state.playing ? 'bg-red-500' : 'bg-red-950'}`} />
            <span className={`h-1.5 w-full rounded-sm ${state.volume > 0.6 && state.playing ? 'bg-amber-500' : 'bg-amber-950'}`} />
            <span className={`h-2.5 w-full rounded-sm ${state.volume > 0.3 && state.playing ? 'bg-emerald-500' : 'bg-emerald-950'}`} />
            <span className={`h-3 w-full rounded-sm ${state.volume > 0.1 && state.playing ? 'bg-emerald-500' : 'bg-emerald-950'}`} />
            <span className={`h-4 w-full rounded-sm ${state.volume > 0.0 && state.playing ? 'bg-emerald-500' : 'bg-emerald-950'}`} />
          </div>

          <input
            type="range"
            min="0"
            max="1.0"
            step="0.01"
            value={state.volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className={`accent-${isA ? 'neon-cyan' : 'neon-purple'} h-24 my-1 vertical-slider appearance-none w-1 bg-neutral-800 rounded outline-none cursor-pointer`}
            style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' } as any}
          />
        </div>
        <span className="text-[9px] font-mono font-semibold text-neutral-300">
          {(state.volume * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
