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
  const shadowColor = isA ? "shadow-neon-cyan/10" : "shadow-neon-purple/10";
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
      className={`glass-panel rounded-3xl p-6 ${shadowColor} shadow-xl border ${isDragging ? 'border-neon-pink bg-neon-pink/5 scale-[1.02]' : 'border-white/5'} flex flex-col gap-6 relative transition-all duration-300 ${glowBorderClass}`}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-3xl border-2 border-dashed border-neon-pink">
          <p className="font-mono text-neon-pink font-bold text-xl tracking-widest pointer-events-none">DROP FILE TO LOAD TO DECK {deckId}</p>
        </div>
      )}
      {/* Glow corner highlights */}
      <div className={`absolute top-0 ${isA ? 'left-6' : 'right-6'} w-24 h-[1px] bg-gradient-to-r from-transparent via-${isA ? 'neon-cyan' : 'neon-purple'}/50 to-transparent`} />

      {/* Deck Header LCD HUD */}
      <div className="bg-black/60 rounded-2xl p-4 border border-white/[0.03] flex items-center justify-between font-mono relative overflow-hidden">
        {/* Glow grid background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_60%,rgba(0,243,255,0.02)_100%)] pointer-events-none" />
        
        <div className="space-y-1.5 z-10 max-w-[65%]">
          <p className={`text-[10px] uppercase font-bold tracking-widest ${accentColor}`}>
            DECK {deckId} • {state.genre}
          </p>
          <h3 className="font-bold text-sm tracking-wide truncate text-white" title={state.title}>
            {state.loading ? "LOADING AUDIO STREAM..." : state.title}
          </h3>
          <div className="flex gap-4 text-[10px] text-neutral-500">
            <span>KEY: <b className="text-neutral-300 font-semibold">{state.key}</b></span>
            <span>ORIGINAL: {state.originalKey}</span>
          </div>
        </div>

        {/* Digital Time Code display */}
        <div className="text-right z-10">
          <div className={`text-2xl font-bold tracking-wider font-mono ${accentColor} text-glow-${isA ? 'cyan' : 'purple'}`}>
            {formatTime(state.currentTime)}
          </div>
          <div className="text-[9px] text-neutral-500 font-mono tracking-wider">
            REMAINING: -{formatTime(Math.max(0, state.duration - state.currentTime))}
          </div>
        </div>
      </div>

      {/* Center Platter & Jog Wheel Area + Pitch Fader */}
      <div className="flex items-center justify-between gap-6 py-2">
        {/* Jog Wheel Platter */}
        <div className="flex-1 flex justify-center items-center relative">
          <div className={`relative w-44 h-44 rounded-full bg-neutral-950 flex items-center justify-center border-4 border-neutral-900 shadow-inner group ${state.playing ? 'animate-[pulse_3s_ease-in-out_infinite]' : ''}`}>
            
            {/* Outer vinyl grooves */}
            <div className="absolute inset-2 rounded-full border border-neutral-800/40" />
            <div className="absolute inset-6 rounded-full border border-neutral-800/40" />
            <div className="absolute inset-10 rounded-full border border-neutral-800/40" />
            <div className="absolute inset-14 rounded-full border border-neutral-800/40" />
            
            {/* Platter Spin Ring */}
            <div 
              className={`absolute inset-0.5 rounded-full border-2 border-dashed transition-all duration-1000 ${
                state.playing 
                  ? `${isA ? 'border-neon-cyan/20 animate-jog-spin' : 'border-neon-purple/20 animate-jog-spin'}` 
                  : 'border-transparent'
              }`}
              style={{ animationDuration: `${2 / (1 + state.pitch)}s` }}
            />
            
            {/* Rotating Platter Center */}
            <div 
              className={`w-20 h-20 rounded-full bg-neutral-900 shadow-2xl flex items-center justify-center relative border border-white/5 ${
                state.playing ? 'animate-jog-spin' : ''
              }`}
              style={{ animationDuration: `${2 / (1 + state.pitch)}s` }}
            >
              {/* Slipmat center hub */}
              <div className={`w-8 h-8 rounded-full ${accentBg}/10 flex items-center justify-center border border-${isA ? 'neon-cyan' : 'neon-purple'}/20 relative`}>
                <Disc className={`w-4 h-4 ${accentColor}`} />
                {/* Spindle hole */}
                <div className="w-1.5 h-1.5 rounded-full bg-black absolute center" />
              </div>
              
              {/* Platter playhead visual line marker */}
              <div className={`absolute top-0 bottom-1/2 w-0.5 ${accentBg} shadow-${isA ? 'neon-cyan' : 'neon-purple'} shadow-[0_0_8px] origin-bottom`} />
            </div>

            {/* Pitch Speed display inside platter */}
            <div className="absolute bottom-3 font-mono text-[9px] text-neutral-500 font-semibold select-none">
              PITCH: <span className={state.pitch !== 0 ? accentColor : "text-neutral-400"}>
                {state.pitch >= 0 ? "+" : ""}
                {(state.pitch * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Vertical Tempo / Pitch Slider */}
        <div className="flex flex-col items-center h-44 w-12 bg-black/40 border border-white/5 py-4 px-1 rounded-2xl relative select-none">
          <span className="text-[8px] text-neutral-500 font-mono font-bold">+10</span>
          
          <input 
            type="range"
            min="-0.10"
            max="0.10"
            step="0.001"
            value={state.pitch}
            onChange={handlePitchSlider}
            className={`accent-${isA ? 'neon-cyan' : 'neon-purple'} h-24 my-2 vertical-slider appearance-none w-1 bg-neutral-800 rounded outline-none cursor-row-resize`}
            style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' } as any}
          />
          
          <span className="text-[8px] text-neutral-500 font-mono font-bold">-10</span>
          
          {/* Zero pitch lock button */}
          <button 
            onClick={() => onPitchChange(0)}
            className={`absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded border text-[7px] font-mono font-semibold tracking-tighter ${
              state.pitch === 0 
                ? "bg-neutral-800 text-neutral-400 border-neutral-700" 
                : `bg-transparent text-neutral-500 border-transparent hover:text-white`
            }`}
          >
            LOCK
          </button>
        </div>
      </div>

      {/* 100x Upgrade: Hot Cues & Loops */}
      <div className="grid grid-cols-2 gap-4">
        {/* Hot Cues (4 pads) */}
        <div className="bg-black/40 rounded-xl p-2 border border-white/5 space-y-2">
          <div className="text-[9px] font-mono text-neutral-500 font-bold px-1 flex justify-between">
            <span>HOT CUES</span>
            <span className="text-neutral-600">SET / JUMP</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map(i => {
              const hasCue = state.hotCues && state.hotCues[i] !== null;
              return (
                <button
                  key={i}
                  onClick={() => hasCue ? onTriggerHotCue(i) : onSetHotCue(i, state.currentTime)}
                  className={`h-8 rounded cursor-pointer font-mono text-[10px] font-bold transition-all shadow-[inset_0_-2px_4px_rgba(0,0,0,0.6)] ${
                    hasCue 
                      ? `${accentBg} text-black border border-white/20 shadow-${isA ? 'neon-cyan' : 'neon-purple'}/50 brightness-110` 
                      : 'bg-neutral-800 text-neutral-500 border border-neutral-700/50 hover:bg-neutral-700'
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Auto Loop */}
        <div className="bg-black/40 rounded-xl p-2 border border-white/5 space-y-2 flex flex-col justify-between">
          <div className="text-[9px] font-mono text-neutral-500 font-bold px-1 flex justify-between">
            <span>AUTO LOOP</span>
            <span className="text-neutral-600">{state.loopActive ? "ACTIVE" : "OFF"}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onToggleLoop(4)}
              className={`flex-1 h-8 rounded cursor-pointer font-mono text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${
                state.loopActive 
                  ? 'bg-amber-500 text-black border border-amber-300 shadow-amber-500/50 shadow-md animate-pulse' 
                  : 'bg-neutral-800 text-neutral-400 border border-neutral-700/50 hover:bg-neutral-700'
              }`}
            >
              <RotateCcw className="w-3 h-3" />
              4 BARS
            </button>
          </div>
        </div>
      </div>

      {/* Waveform Visualization Slot */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono">
          <span>WAVEFORM PREVIEW</span>
          <span>BPM: <b className="text-neutral-300 font-semibold">{state.bpm.toFixed(1)}</b> (ORIGINAL: {state.originalBpm})</span>
        </div>
        
        {/* Seekable Playhead slider overlapping Waveform container */}
        <div className="relative">
          {/* Real mounting slot for wavesurfer */}
          <div 
            id={`waveform-${deckId}`} 
            className="w-full h-12 bg-black/60 border border-white/5 rounded-xl overflow-hidden relative"
          >
            {/* Decorative placeholder visual grid before audio loads */}
            {!state.trackLoaded && !state.loading && (
              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-neutral-600 font-mono select-none">
                PASTE A LINK OR LOAD A DEMO SONG TO GENERATE WAVEFORM
              </div>
            )}
            
            {state.loading && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-[10px] text-neon-cyan font-mono animate-pulse bg-black/70">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-ping" />
                DOWNLOADING & EXTRACTING AUDIO BUFFERS...
              </div>
            )}
          </div>

          {/* Simple seek overlay bar */}
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
      </div>

      {/* Transport Control Buttons (Transport Desk) */}
      <div className="grid grid-cols-5 gap-3 mt-1">
        {/* Cue point button */}
        <button 
          onClick={() => onSeek(0)}
          disabled={!state.trackLoaded}
          className={`py-3.5 rounded-xl border border-white/5 bg-neutral-900/60 hover:bg-neutral-800 text-xs font-mono font-bold tracking-widest text-neutral-300 shadow active:scale-95 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>CUE</span>
        </button>

        {/* Play/Pause Button */}
        <button
          onClick={state.playing ? onPause : onPlay}
          disabled={!state.trackLoaded || state.loading}
          className={`col-span-2 py-3.5 rounded-xl border flex items-center justify-center gap-2 text-sm font-bold tracking-widest cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shadow-md ${
            state.playing
              ? `bg-black/40 border-${isA ? 'neon-cyan' : 'neon-purple'}/50 text-white shadow-${isA ? 'neon-cyan' : 'neon-purple'}/10`
              : `${accentBg} text-black border-transparent hover:brightness-110 shadow-lg shadow-${isA ? 'neon-cyan' : 'neon-purple'}/20`
          }`}
        >
          {state.playing ? (
            <>
              <Pause className="w-4 h-4 fill-current" />
              <span>PAUSE</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>PLAY</span>
            </>
          )}
        </button>

        {/* Vinyl Stop Button */}
        <button 
          onClick={onVinylStop}
          disabled={!state.playing}
          className="py-3.5 rounded-xl border border-white/5 bg-neutral-900/60 hover:bg-neutral-800 text-[10px] font-mono font-bold tracking-wider text-neutral-400 active:scale-95 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title="Vinyl Tape Stop Stop"
        >
          <span className="text-neon-pink font-semibold">TAPE</span>
          <span>STOP</span>
        </button>

        {/* BPM Sync button */}
        <button
          onClick={onSync}
          disabled={state.loading}
          className={`py-3.5 rounded-xl border border-white/5 bg-neutral-900/60 hover:bg-neutral-800 text-xs font-mono font-bold tracking-wider text-neutral-300 active:scale-95 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
          title="Sync BPM to other Deck"
        >
          <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
          <span>SYNC</span>
        </button>
      </div>
    </div>
  );
}
