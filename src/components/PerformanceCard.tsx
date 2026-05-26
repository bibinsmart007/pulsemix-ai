"use client";

import React from "react";
import { Headphones } from "lucide-react";
import { DeckState } from "@/types/audio";

interface PerformanceCardProps {
  state: DeckState;
  onEqChange: (band: "low" | "mid" | "high", db: number) => void;
  onFilterChange: (val: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleCue: () => void;
  accentBg: string;
}

export function PerformanceCard({
  state, onEqChange, onFilterChange, onVolumeChange, onToggleCue, accentBg
}: PerformanceCardProps) {
  
  // Helper for sliders with double-click reset
  const VerticalSlider = ({ 
    label, value, min, max, step, onChange, onReset, marks 
  }: any) => (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-32 w-4">
        {/* Zero mark line */}
        {marks && (
          <div className="absolute w-6 h-[2px] bg-white/20 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0" />
        )}
        <input 
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          onDoubleClick={onReset}
          className={`accent-${accentBg.replace('bg-', '')} h-full vertical-slider appearance-none w-full bg-black rounded-full border border-neutral-800 outline-none cursor-row-resize shadow-inner block z-10 relative`}
          style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' } as any}
        />
      </div>
      <span className="text-[9px] font-mono font-bold text-neutral-500">{label}</span>
    </div>
  );

  return (
    <article className="bg-[#111115] rounded-[24px] p-5 border border-[#222] shadow-[0_10px_40px_rgba(0,0,0,0.5)] w-full flex flex-col gap-4">
      <header className="flex items-center gap-3 border-b border-[#222] pb-3">
        <h3 className="text-[11px] font-mono text-neutral-400 font-bold tracking-[0.2em]">PERFORMANCE EQ & FILTER</h3>
        <div className="flex-1 h-[1px] bg-gradient-to-r from-white/10 to-transparent" />
      </header>

      <div className="flex justify-between items-center gap-4">
        {/* EQ Section */}
        <div className="flex gap-4 bg-[#0a0a0c] p-3 rounded-xl border border-white/5">
          <VerticalSlider 
            label="HIGH" value={state.eqHigh} min={-12} max={12} step={0.1} 
            onChange={(v: number) => onEqChange("high", v)} onReset={() => onEqChange("high", 0)} marks={true}
          />
          <VerticalSlider 
            label="MID" value={state.eqMid} min={-12} max={12} step={0.1} 
            onChange={(v: number) => onEqChange("mid", v)} onReset={() => onEqChange("mid", 0)} marks={true}
          />
          <VerticalSlider 
            label="LOW" value={state.eqLow} min={-12} max={12} step={0.1} 
            onChange={(v: number) => onEqChange("low", v)} onReset={() => onEqChange("low", 0)} marks={true}
          />
        </div>

        {/* Filter Section */}
        <div className="flex flex-col items-center flex-1 gap-2">
          <span className="text-[10px] font-mono font-bold text-neutral-500 tracking-widest">FILTER (LPF - HPF)</span>
          <div className="relative w-full max-w-[150px]">
             {/* Center detent marker */}
             <div className="absolute w-[2px] h-6 bg-white/20 left-1/2 -translate-x-1/2 -top-2 z-0" />
             <input 
                type="range"
                min={-100} max={100} step={1}
                value={state.filter}
                onChange={(e) => onFilterChange(parseFloat(e.target.value))}
                onDoubleClick={() => onFilterChange(0)}
                className={`w-full accent-${accentBg.replace('bg-', '')} h-2 bg-black rounded-full border border-neutral-800 outline-none cursor-pointer z-10 relative`}
             />
          </div>
        </div>

        {/* Gain & CUE Section */}
        <div className="flex gap-4 items-center bg-[#0a0a0c] p-3 rounded-xl border border-white/5">
          <VerticalSlider 
            label="GAIN" value={state.volume} min={0} max={1} step={0.01} 
            onChange={onVolumeChange} onReset={() => onVolumeChange(0.8)} marks={false}
          />
          
          <button
            onClick={onToggleCue}
            className={`flex flex-col items-center justify-center gap-2 w-14 h-14 rounded-full border-[2px] transition-all ${
              state.cueEnabled 
                ? `bg-${accentBg.replace('bg-', '')}/20 border-${accentBg.replace('bg-', '')} text-white shadow-[0_0_15px_${accentBg.replace('bg-', '')}]` 
                : 'bg-black border-neutral-800 text-neutral-500 hover:border-neutral-600'
            }`}
          >
            <Headphones className="w-5 h-5" />
            <span className="text-[8px] font-mono font-bold tracking-widest">CUE</span>
          </button>
        </div>
      </div>
    </article>
  );
}
