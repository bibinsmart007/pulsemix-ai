"use client";

import React from "react";
import { Sliders, Sparkles, Volume2, RefreshCw } from "lucide-react";
import Visualizer from "./Visualizer";

interface MixerDeskProps {
  analyserNode: AnalyserNode | null;
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
}

export default function MixerDesk({
  analyserNode,
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
}: MixerDeskProps) {
  const transitionPresets = [
    { id: "bass-swap", label: "Bass Swap", desc: "Instantly swaps low-ends at the beat drop", color: "from-neon-cyan to-blue-600" },
    { id: "echo-out", label: "Echo Out", desc: "Adds deep delay tail & sweeps highpass", color: "from-neon-purple to-neon-pink" },
    { id: "reverb-blend", label: "Reverb Blend", desc: "Blends both tracks in a cathedral room", color: "from-emerald-500 to-teal-600" },
    { id: "edm-rise", label: "EDM Rise", desc: "Pitches up outgoing track with rising sweep", color: "from-neon-pink to-amber-500" },
  ] as const;

  return (
    <div className="glass-panel rounded-3xl p-6 border border-white/5 flex flex-col gap-6 flex-1 shadow-2xl relative select-none">
      {/* Visualizer header block */}
      <div className="h-44 w-full relative">
        <Visualizer analyser={analyserNode} isPlaying={isPlaying} />
      </div>

      {/* Central FX Sends & Master Volume Row */}
      <div className="grid grid-cols-3 gap-6 items-center">
        {/* FX Sends panel */}
        <div className="bg-black/40 border border-white/5 p-3 rounded-2xl flex flex-col gap-2.5">
          <span className="font-mono text-[8px] font-bold text-neutral-500 text-center uppercase tracking-widest">MASTER FX</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onToggleFX("delay", !delayActive)}
              className={`py-2 rounded-xl text-[10px] font-mono font-bold tracking-wider transition-all duration-300 ${
                delayActive
                  ? "bg-neon-cyan/15 border border-neon-cyan text-neon-cyan text-glow-cyan"
                  : "bg-neutral-900 border border-white/5 text-neutral-400 hover:text-white"
              }`}
            >
              ECHO (3/16)
            </button>
            <button
              onClick={() => onToggleFX("reverb", !reverbActive)}
              className={`py-2 rounded-xl text-[10px] font-mono font-bold tracking-wider transition-all duration-300 ${
                reverbActive
                  ? "bg-neon-purple/15 border border-neon-purple text-neon-purple text-glow-purple"
                  : "bg-neutral-900 border border-white/5 text-neutral-400 hover:text-white"
              }`}
            >
              CLUB REVERB
            </button>
          </div>
        </div>

        {/* Master Volume Controller */}
        <div className="bg-black/40 border border-white/5 p-3 rounded-2xl flex flex-col gap-2 items-center">
          <span className="font-mono text-[8px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-1">
            <Volume2 className="w-3 h-3 text-neutral-400" /> MASTER VOLUME
          </span>
          <input
            type="range"
            min="0"
            max="1.0"
            step="0.01"
            value={masterVolume}
            onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
            className="w-full accent-neon-cyan bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer outline-none"
          />
          <span className="font-mono text-[9px] font-bold text-neutral-300">
            {(masterVolume * 100).toFixed(0)}%
          </span>
        </div>

        {/* AI status panel */}
        <div className="bg-black/40 border border-white/5 p-3 rounded-2xl flex flex-col justify-center items-center h-full">
          <span className="font-mono text-[8px] font-bold text-neutral-500 uppercase tracking-widest">BEAT STATE</span>
          <div className="flex items-center gap-1.5 mt-2">
            <span className={`w-2 h-2 rounded-full ${isPlaying ? "bg-neon-cyan animate-pulse shadow-neon-cyan shadow-[0_0_8px]" : "bg-neutral-600"}`} />
            <span className="font-mono text-[10px] font-bold text-white">
              {isPlaying ? "4/4 GRID LOCK" : "SYNC IDLE"}
            </span>
          </div>
        </div>
      </div>

      {/* AI Automated Transitions Launcher */}
      <div className="bg-black/60 rounded-2xl p-5 border border-white/[0.03] space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-xs tracking-wider flex items-center gap-1.5 font-mono text-glow-cyan text-neon-cyan">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" /> AI TRANSITION AUTOMATOR
          </h4>
          <span className="text-[9px] text-neutral-500 font-mono">CHOOSE PRESET & PRESS LAUNCH</span>
        </div>

        {/* Preset grids */}
        <div className="grid grid-cols-2 gap-3">
          {transitionPresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onTriggerTransition(preset.id, 8)}
              disabled={isTransitioning}
              className={`p-3.5 rounded-xl border border-white/5 bg-neutral-900/40 hover:bg-neutral-800 text-left transition-all duration-300 group cursor-pointer disabled:opacity-40 disabled:hover:bg-neutral-900/40`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-xs font-mono text-white group-hover:text-neon-cyan transition-colors">
                  {preset.label}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[7px] font-mono uppercase bg-gradient-to-r ${preset.color} text-black font-extrabold`}>
                  LAUNCH
                </span>
              </div>
              <p className="text-[9px] text-neutral-500 leading-normal">
                {preset.desc}
              </p>
            </button>
          ))}
        </div>

        {/* Transition Execution HUD Progress Bar */}
        {isTransitioning && (
          <div className="space-y-2 pt-1.5 border-t border-white/5 font-mono">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-neon-pink text-glow-pink font-bold flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> CROSSFADING CHANNELS...
              </span>
              <span className="text-neutral-400 font-bold">{transitionProgress.toFixed(0)}%</span>
            </div>
            <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-neon-cyan via-neon-purple to-neon-pink transition-all duration-100 ease-out"
                style={{ width: `${transitionProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Horizontal Crossfader slider bar */}
      <div className="space-y-2 pt-2 select-none">
        <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono font-bold px-1">
          <span className={crossfader < 0 ? "text-neon-cyan" : "text-neutral-400"}>DECK A (LEFT)</span>
          <span className="text-neutral-400">CROSSFADER</span>
          <span className={crossfader > 0 ? "text-neon-purple" : "text-neutral-400"}>DECK B (RIGHT)</span>
        </div>
        <div className="relative flex items-center justify-center py-2.5 px-4 bg-black/60 border border-white/[0.03] rounded-2xl">
          {/* Dual-color neon gradient center indicator */}
          <div className="absolute inset-x-12 h-1 bg-gradient-to-r from-neon-cyan via-black to-neon-purple pointer-events-none rounded opacity-30" />
          
          <input
            type="range"
            min="-100"
            max="100"
            value={crossfader}
            onChange={(e) => setCrossfader(parseInt(e.target.value))}
            className="w-full accent-white bg-neutral-800 h-1 rounded appearance-none cursor-pointer outline-none z-10"
          />
        </div>
        <div className="text-center font-mono text-[9px] text-neutral-500">
          POSITION: {crossfader === 0 ? "MIDPOINT CENTER" : crossfader < 0 ? `DECK A -${Math.abs(crossfader)}%` : `DECK B +${crossfader}%`}
        </div>
      </div>
    </div>
  );
}
