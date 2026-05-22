"use client";

import React from "react";
import { Play, Pause, RotateCcw, Zap, Disc } from "lucide-react";
import { DeckState } from "@/types/audio";

interface DJDeckProps {
  deckId: "A" | "B";
  state: DeckState;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (seconds: number) => void;
  onBpmChange: (bpm: number) => void;
  onPitchChange: (pitch: number) => void;
  onSync: () => void;
  onVinylStop: () => void;
  onSetHotCue: (index: number, time: number) => void;
  onTriggerHotCue: (index: number) => void;
  onToggleLoop: (bars: number) => void;
  onFileDrop: (file: File) => void;
}

export default function DJDeck({
  deckId,
  state,
  onPlay,
  onPause,
  onSeek,
  onBpmChange,
  onPitchChange,
  onSync,
  onVinylStop,
  onSetHotCue,
  onTriggerHotCue,
  onToggleLoop,
  onFileDrop,
}: DJDeckProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const isA = deckId === "A";
  const accentColor = isA ? "text-neon-cyan" : "text-neon-purple";
  const borderColor = isA ? "border-neon-cyan/20" : "border-neon-purple/20";
  const glowBorderClass = isA ? "focus-within:border-neon-cyan/40" : "focus-within:border-neon-purple/40";
  const accentBg = isA ? "bg-neon-cyan" : "bg-neon-purple";

  // Helper: Format seconds to MM:SS
  const formatTime = (timeInSecs: number) => {
    if (isNaN(timeInSecs) || timeInSecs <= 0) return "00:00.0";
    const mins = Math.floor(timeInSecs / 60);
    const secs = Math.floor(timeInSecs % 60);
    const ms = Math.floor((timeInSecs % 1) * 10);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  const handlePitchSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onPitchChange(val);
  };

  const handleSeekSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onSeek(val);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileDrop(e.dataTransfer.files[0]);
    }
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`glass-panel rounded-3xl p-5 shadow-2xl border ${isDragging ? 'border-neon-pink bg-neon-pink/5 scale-[1.02]' : 'border-white/5'} flex flex-col gap-5 relative transition-all duration-300 ${glowBorderClass} h-full`}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-3xl border-2 border-dashed border-neon-pink">
          <p className="font-mono text-neon-pink font-bold text-xl tracking-widest pointer-events-none">DROP FILE TO LOAD TO DECK {deckId}</p>
        </div>
      )}

      {/* Glow corner highlights */}
      <div className={`absolute top-0 ${isA ? 'left-6' : 'right-6'} w-24 h-[1px] bg-gradient-to-r from-transparent via-${isA ? 'neon-cyan' : 'neon-purple'}/50 to-transparent`} />

      {/* Deck Header: Title & Time */}
      <section className="bg-black/30 rounded-2xl p-4 border border-white/5 flex flex-col gap-2 relative">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${state.playing ? 'animate-pulse' : ''} ${accentBg}`} />
              <p className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">
                Deck {deckId} <span className="text-neutral-600 px-1">•</span> {state.genre || 'No Genre'}
              </p>
            </div>
            
            <h3 className="font-bold text-lg tracking-wide truncate text-white" title={state.title}>
              {state.loading ? "Loading track..." : state.title || "No Track Loaded"}
            </h3>
          </div>

          <div className="text-right flex-shrink-0">
            <div className={`text-3xl font-light font-mono ${accentColor}`}>
              {formatTime(state.currentTime)}
            </div>
            <div className="text-[10px] text-neutral-500 font-mono tracking-wider">
              -{formatTime(Math.max(0, state.duration - state.currentTime))} 
            </div>
          </div>
        </div>
      </section>

      {/* 2. Metadata Row (Compact Grid) */}
      <section className="grid grid-cols-3 gap-2 w-full mb-6">
        <div className="bg-black/40 border border-white/5 rounded-lg px-3 py-2 flex items-center justify-between shadow-sm">
          <span className="text-[10px] text-neutral-500 font-mono font-bold">KEY</span>
          <b className="text-white text-[11px] font-mono">{state.key || '--'}</b>
        </div>
        <div className="bg-black/40 border border-white/5 rounded-lg px-3 py-2 flex items-center justify-between shadow-sm">
          <span className="text-[10px] text-neutral-500 font-mono font-bold">BPM</span>
          <b className="text-white text-[11px] font-mono">{state.bpm ? state.bpm.toFixed(1) : '--'}</b>
        </div>
        <div className="bg-black/40 border border-white/5 rounded-lg px-3 py-2 flex items-center justify-between shadow-sm col-span-3 sm:col-span-1">
          <span className="text-[10px] text-neutral-500 font-mono font-bold">TIME</span>
          <div className="flex items-center gap-1 font-mono">
            <b className={`${accentColor} text-[11px]`}>{formatTime(state.currentTime)}</b>
            <span className="text-neutral-600 text-[10px]">/ {formatTime(state.duration)}</span>
          </div>
        </div>
      </section>

      {/* Waveform Visualization (Wide Full Width) */}
      <section className="bg-black/30 rounded-2xl p-6 border-2 border-dashed border-white/10 relative my-6">
        <div className="relative w-full">
          {/* Mounting slot for wavesurfer */}
          <div 
            id={`waveform-${deckId}`} 
            className="w-full h-16 bg-black/60 border border-white/5 rounded-xl overflow-hidden relative"
          >
            {!state.trackLoaded && !state.loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/40 select-none">
                {/* Fake waveform SVG placeholder */}
                <div className="w-full h-full absolute inset-0 opacity-10 flex items-center justify-center gap-[2px] px-2 overflow-hidden pointer-events-none">
                  {Array.from({ length: 80 }).map((_, i) => (
                    <div key={i} className="w-1 bg-neutral-500 rounded-full" style={{ height: `${20 + Math.random() * 60}%` }} />
                  ))}
                </div>
                
                <div className="z-10 flex flex-col items-center gap-2 bg-neutral-900/80 border border-white/10 px-6 py-3 rounded-2xl shadow-lg cursor-pointer hover:bg-neutral-800 transition-colors">
                  <div className="flex items-center gap-2 text-neutral-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    <span className="text-[11px] font-bold tracking-wider"> LOAD AUDIO FILE </span>
                  </div>
                  <span className="text-[9px] text-neutral-500 font-mono"> Drop file here to begin </span>
                </div>
              </div>
            )}
            
            {state.loading && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-[10px] text-neon-cyan font-mono animate-pulse bg-black/70">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-ping" />
                 LOADING AUDIO... 
              </div>
            )}
          </div>

          {/* Seek overlay slider */}
          {state.trackLoaded && !state.loading && (
            <input 
              type="range"
              min="0"
              max={state.duration || 100}
              step="0.1"
              value={state.currentTime}
              onChange={handleSeekSlider}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-15"
            />
          )}
        </div>
      </section>

      {/* 4. Platter & Pitch Fader Area */}
      <section className="bg-black/30 rounded-2xl p-6 border border-white/5 flex flex-col gap-6 relative mb-6">
        <div className="flex-1 flex items-center justify-center gap-8 py-2">
        {/* Jog Wheel Platter */}
        <div className="relative w-48 h-48 rounded-full bg-neutral-950 flex items-center justify-center border-4 border-neutral-900 shadow-inner group">
          {/* Vinyl grooves */}
          <div className="absolute inset-2 rounded-full border border-neutral-800/30" />
          <div className="absolute inset-6 rounded-full border border-neutral-800/30" />
          <div className="absolute inset-10 rounded-full border border-neutral-800/30" />
          <div className="absolute inset-14 rounded-full border border-neutral-800/30" />
          
          {/* Spin Ring */}
          <div 
            className={`absolute inset-1 rounded-full border-2 border-dashed transition-all duration-1000 ${
              state.playing 
                ? `border-${accentColor.replace('text-', '')}/30 animate-jog-spin` 
                : 'border-transparent'
            }`}
            style={{ animationDuration: `${2 / (1 + state.pitch)}s` }}
          />
          
          {/* Center Hub */}
          <div 
            className={`w-20 h-20 rounded-full bg-neutral-900 shadow-2xl flex items-center justify-center relative border border-white/5 ${
              state.playing ? 'animate-jog-spin' : ''
            }`}
            style={{ animationDuration: `${2 / (1 + state.pitch)}s` }}
          >
            <div className={`w-8 h-8 rounded-full ${accentBg}/10 flex items-center justify-center border border-${accentColor.replace('text-', '')}/20 relative`}>
              <Disc className={`w-4 h-4 ${accentColor}`} />
              <div className="w-1.5 h-1.5 rounded-full bg-black absolute center" />
            </div>
            {/* Marker */}
            <div className={`absolute top-0 bottom-1/2 w-0.5 ${accentBg} shadow-[0_0_8px_${accentBg}] origin-bottom`} />
          </div>

          {/* Platter Pitch Label */}
          <div className="absolute bottom-4 font-mono text-[9px] font-semibold text-neutral-500">
            {state.pitch >= 0 ? "+" : ""}{(state.pitch * 100).toFixed(1)}% 
          </div>
        </div>

        {/* Pitch Slider Vertical */}
        <div className="flex flex-col items-center h-48 w-12 bg-black/40 border border-white/5 py-4 rounded-2xl relative">
          <span className="text-[8px] text-neutral-500 font-mono font-bold">+10</span>
          <input 
            type="range"
            min="-0.10"
            max="0.10"
            step="0.001"
            value={state.pitch}
            onChange={handlePitchSlider}
            className={`accent-${accentBg.replace('bg-', '')} h-32 my-2 vertical-slider appearance-none w-1 bg-neutral-800 rounded outline-none cursor-row-resize`}
            style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' } as any}
          />
          <span className="text-[8px] text-neutral-500 font-mono font-bold">-10</span>
          
          <button 
            onClick={() => onPitchChange(0)}
            className={`absolute -right-8 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded border text-[8px] font-mono font-bold ${
              state.pitch === 0 
                ? "bg-neutral-800 text-neutral-400 border-neutral-700" 
                : "bg-transparent text-neutral-500 border-neutral-700 hover:text-white"
            }`}
          >
             0% 
          </button>
        </div>
      </div>
      </section>

      {/* 5. Bottom Controls: Hot Cues, Loops, Transport */}
      <section className="bg-black/30 rounded-2xl p-6 border border-white/5 mt-auto">
        <fieldset className="grid grid-cols-12 gap-4">
          <legend className="sr-only"> Deck Controls </legend>
          
          {/* Hot Cues (4 pads) */}
          <section className="col-span-5 bg-black/40 rounded-xl p-2.5 border border-white/5 flex flex-col gap-2" aria-label="Hot Cues">
            <h4 className="text-[9px] font-mono text-neutral-500 font-bold px-1 m-0">HOT CUES</h4>
            <div className="grid grid-cols-4 gap-2 flex-1">
              {[0, 1, 2, 3].map(i => {
                const hasCue = state.hotCues && state.hotCues[i] !== null;
                // Industry standard cue colors
                const cueColors = ["bg-rose-500", "bg-blue-500", "bg-amber-500", "bg-emerald-500"];
                const cueShadows = ["shadow-rose-500", "shadow-blue-500", "shadow-amber-500", "shadow-emerald-500"];
                
                return (
                  <button
                    key={i}
                    onClick={() => hasCue ? onTriggerHotCue(i) : onSetHotCue(i, state.currentTime)}
                    aria-label={`Hot Cue ${i + 1}`}
                    className={`rounded cursor-pointer font-mono text-[11px] font-bold transition-all shadow-inner h-full min-h-[36px] ${
                      hasCue 
                        ? `${cueColors[i]} text-black border border-white/30 shadow-[0_0_10px_rgba(0,0,0,0.5)] ${cueShadows[i]}` 
                        : 'bg-neutral-800/80 text-neutral-500 border border-neutral-700/50 hover:bg-neutral-700'
                    }`}
                  >
                    <span> {i + 1} </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Transport buttons */}
          <section className="col-span-7 bg-black/40 rounded-xl p-2.5 border border-white/5 flex gap-2" aria-label="Transport Controls">
            <button 
              onClick={() => onSeek(0)}
              disabled={!state.trackLoaded}
              className="flex-1 rounded-lg border border-white/5 bg-neutral-900 hover:bg-neutral-800 text-[10px] font-mono font-bold text-neutral-300 flex flex-col items-center justify-center gap-1 disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span> CUE </span>
            </button>
            
            <button
              onClick={state.playing ? onPause : onPlay}
              disabled={!state.trackLoaded || state.loading}
              className={`flex-[1.5] rounded-lg border flex flex-col items-center justify-center gap-1 text-[11px] font-bold disabled:opacity-50 transition-all ${
                state.playing
                  ? `bg-neutral-900 border-${accentColor.replace('text-', '')}/50 text-white`
                  : `${accentBg} text-black border-transparent hover:brightness-110`
              }`}
            >
              {state.playing 
                ? <><Pause className="w-4 h-4 fill-current" /><span> PAUSE </span></> 
                : <><Play className="w-4 h-4 fill-current" /><span> PLAY </span></>}
            </button>

            <button
              onClick={onSync}
              disabled={state.loading || !state.trackLoaded}
              className="flex-1 rounded-lg border border-white/5 bg-neutral-900 hover:bg-neutral-800 text-[10px] font-mono font-bold text-neutral-300 flex flex-col items-center justify-center gap-1 disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
              <span> SYNC </span>
            </button>

            <button
              onClick={() => onToggleLoop(4)}
              disabled={!state.trackLoaded}
              className={`flex-1 rounded-lg border flex flex-col items-center justify-center gap-1 text-[10px] font-mono font-bold disabled:opacity-50 transition-all ${
                state.loopActive 
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' 
                  : 'bg-neutral-900 text-neutral-500 border-white/5 hover:text-white'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span> LOOP </span>
            </button>
          </section>
        </fieldset>
      </section>
    </div>
  );
}
