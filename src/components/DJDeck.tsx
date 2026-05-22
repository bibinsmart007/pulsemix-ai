"use client";

import React from "react";
import { Play, Pause, RotateCcw, Zap, Disc, Music } from "lucide-react";
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

// Sub-Component: Timer Card
function TimerCard({ currentTime, duration, accentColor }: { currentTime: number, duration: number, accentColor: string }) {
  const formatTime = (timeInSecs: number) => {
    if (isNaN(timeInSecs) || timeInSecs <= 0) return "00:00.0";
    const mins = Math.floor(timeInSecs / 60);
    const secs = Math.floor(timeInSecs % 60);
    const ms = Math.floor((timeInSecs % 1) * 10);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  return (
    <article className="text-right flex-shrink-0 bg-[#0a0a0c] p-4 rounded-xl border border-white/10 shadow-inner min-w-[120px]">
      <header className="sr-only">
        <h2>Deck Timer</h2>
      </header>
      <div className={`text-3xl font-light font-mono ${accentColor}`}>
        {formatTime(currentTime)}
      </div>
      <div className="text-[10px] text-neutral-500 font-mono tracking-wider">
        -{formatTime(Math.max(0, duration - currentTime))}
      </div>
    </article>
  );
}

// Sub-Component: Info Card
function InfoCard({ title, value, span = false }: { title: string; value: React.ReactNode; span?: boolean }) {
  return (
    <article className={`bg-[#0a0a0c] border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between shadow-md ${span ? 'col-span-3 sm:col-span-1' : ''}`}>
      <header>
        <h4 className="text-[10px] text-neutral-500 font-mono font-bold m-0 p-0 leading-none">{title}</h4>
      </header>
      <div className="text-white text-[12px] font-mono leading-none">
        {value}
      </div>
    </article>
  );
}

// Sub-Component: Pitch Card
function PitchCard({ pitch, onPitchChange, accentBg }: { pitch: number, onPitchChange: (p: number) => void, accentBg: string }) {
  return (
    <fieldset className="flex flex-col items-center justify-center h-[200px] w-16 bg-[#0a0a0c] border border-white/10 py-4 rounded-2xl relative shadow-inner">
      <legend className="sr-only">Pitch Control</legend>
      <label htmlFor="pitch-slider" className="text-[9px] text-neutral-500 font-mono font-bold block mb-2">+10</label>
      <input 
        id="pitch-slider"
        type="range"
        min="-0.10"
        max="0.10"
        step="0.001"
        value={pitch}
        onChange={(e) => onPitchChange(parseFloat(e.target.value))}
        className={`accent-${accentBg.replace('bg-', '')} h-32 my-1 vertical-slider appearance-none w-1.5 bg-neutral-800 rounded outline-none cursor-row-resize block`}
        style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' } as any}
      />
      <label htmlFor="pitch-slider" className="text-[9px] text-neutral-500 font-mono font-bold block mt-2">-10</label>
      
      <button 
        type="button"
        onClick={() => onPitchChange(0)}
        className={`absolute -right-10 top-1/2 -translate-y-1/2 px-2 py-1 rounded border text-[9px] font-mono font-bold ${
          pitch === 0 
            ? "bg-neutral-800 text-neutral-400 border-neutral-700" 
            : "bg-transparent text-neutral-500 border-neutral-700 hover:text-white hover:bg-neutral-800"
        }`}
      >
        0%
      </button>
    </fieldset>
  );
}

// Sub-Component: Controls Card
function ControlsCard({ 
  state, accentColor, accentBg, 
  onSeek, onPause, onPlay, onSync, onToggleLoop, onSetHotCue, onTriggerHotCue 
}: any) {
  return (
    <article className="bg-black/30 rounded-2xl p-6 border border-white/5 mt-auto">
      <header className="sr-only">
        <h2>Deck Controls</h2>
      </header>
      <div className="grid grid-cols-12 gap-4">
        
        {/* Hot Cues Card */}
        <fieldset className="col-span-5 bg-[#0a0a0c] rounded-2xl p-4 border border-white/10 flex flex-col gap-3 shadow-md">
          <legend className="text-[10px] font-mono text-neutral-500 font-bold px-2 m-0 tracking-wider">HOT CUES</legend>
          <div className="grid grid-cols-4 gap-3 flex-1">
            {[0, 1, 2, 3].map(i => {
              const hasCue = state.hotCues && state.hotCues[i] !== null;
              const cueColors = ["bg-rose-500", "bg-blue-500", "bg-amber-500", "bg-emerald-500"];
              const cueShadows = ["shadow-rose-500", "shadow-blue-500", "shadow-amber-500", "shadow-emerald-500"];
              
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => hasCue ? onTriggerHotCue(i) : onSetHotCue(i, state.currentTime)}
                  aria-label={`Hot Cue ${i + 1}`}
                  className={`rounded-lg cursor-pointer font-mono text-[12px] font-bold transition-all shadow-inner h-full min-h-[44px] block w-full ${
                    hasCue 
                      ? `${cueColors[i]} text-black border border-white/30 shadow-[0_0_10px_rgba(0,0,0,0.5)] ${cueShadows[i]}` 
                      : 'bg-neutral-800/80 text-neutral-500 border border-neutral-700/50 hover:bg-neutral-700 hover:text-neutral-300'
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Transport Card */}
        <fieldset className="col-span-7 bg-[#0a0a0c] rounded-2xl p-4 border border-white/10 grid grid-cols-4 gap-3 shadow-md">
          <legend className="sr-only">Transport</legend>
          <button 
            type="button"
            onClick={() => onSeek(0)}
            disabled={!state.trackLoaded}
            className="w-full h-full min-h-[56px] rounded-xl border border-white/10 bg-neutral-900 hover:bg-neutral-800 text-[11px] font-mono font-bold text-neutral-300 flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 shadow-inner"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="block">CUE</span>
          </button>
          
          <button
            type="button"
            onClick={state.playing ? onPause : onPlay}
            disabled={!state.trackLoaded || state.loading}
            className={`w-full h-full min-h-[56px] rounded-xl border flex flex-col items-center justify-center gap-1.5 text-[12px] font-bold disabled:opacity-50 transition-all shadow-inner ${
              state.playing
                ? `bg-neutral-900 border-${accentColor.replace('text-', '')}/50 text-white`
                : `${accentBg} text-black border-transparent hover:brightness-110`
            }`}
          >
            {state.playing 
              ? <><Pause className="w-5 h-5 fill-current" /><span className="block">PAUSE</span></> 
              : <><Play className="w-5 h-5 fill-current" /><span className="block">PLAY</span></>}
          </button>

          <button
            type="button"
            onClick={onSync}
            disabled={state.loading || !state.trackLoaded}
            className="w-full h-full min-h-[56px] rounded-xl border border-white/10 bg-neutral-900 hover:bg-neutral-800 text-[11px] font-mono font-bold text-neutral-300 flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 shadow-inner"
          >
            <Zap className="w-4 h-4 text-amber-500 fill-amber-500/20" />
            <span className="block">SYNC</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleLoop(4)}
            disabled={!state.trackLoaded}
            className={`w-full h-full min-h-[56px] rounded-xl border flex flex-col items-center justify-center gap-1.5 text-[11px] font-mono font-bold disabled:opacity-50 transition-all shadow-inner ${
              state.loopActive 
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' 
                : 'bg-neutral-900 text-neutral-500 border-white/10 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span className="block">LOOP</span>
          </button>
        </fieldset>
      </div>
    </article>
  );
}

export default function DJDeck({
  deckId, state, onPlay, onPause, onSeek, onBpmChange, onPitchChange,
  onSync, onVinylStop, onSetHotCue, onTriggerHotCue, onToggleLoop, onFileDrop
}: DJDeckProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const isA = deckId === "A";
  const accentColor = isA ? "text-neon-cyan" : "text-neon-purple";
  const glowBorderClass = isA ? "focus-within:border-neon-cyan/40" : "focus-within:border-neon-purple/40";
  const accentBg = isA ? "bg-neon-cyan" : "bg-neon-purple";

  const handleSeekSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSeek(parseFloat(e.target.value));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileDrop(e.dataTransfer.files[0]);
    }
  };

  const formatTime = (timeInSecs: number) => {
    if (isNaN(timeInSecs) || timeInSecs <= 0) return "00:00.0";
    const mins = Math.floor(timeInSecs / 60);
    const secs = Math.floor(timeInSecs % 60);
    const ms = Math.floor((timeInSecs % 1) * 10);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  return (
    <article 
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragging(false)}
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

      {/* 1. Top Header: Title & Time */}
      <header className="bg-black/30 rounded-2xl p-4 border border-white/5 flex flex-col gap-2 relative mb-2">
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
          <TimerCard currentTime={state.currentTime} duration={state.duration} accentColor={accentColor} />
        </div>
      </header>

      {/* 2. Metadata Row (Compact Grid) */}
      <section className="grid grid-cols-3 gap-4 w-full mb-6">
        <InfoCard title="KEY" value={state.key || '--'} />
        <InfoCard title="BPM" value={state.bpm ? state.bpm.toFixed(1) : '--'} />
        <InfoCard 
          title="TIME" 
          span 
          value={
            <div className="flex items-center gap-1 font-mono">
              <span className={`${accentColor}`}>{formatTime(state.currentTime)}</span>
              <span className="text-neutral-600 text-[10px] ml-1">/ {formatTime(state.duration)}</span>
            </div>
          } 
        />
      </section>

      {/* 3. Upload / Waveform Placeholder */}
      <article className="bg-black/30 rounded-2xl p-6 border-2 border-dashed border-white/10 relative my-2">
        <header className="sr-only">
          <h2>Waveform display</h2>
        </header>
        <div className="relative w-full">
          <div id={`waveform-${deckId}`} className="w-full h-16 bg-black/60 border border-white/5 rounded-xl overflow-hidden relative">
            {!state.trackLoaded && !state.loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/40 select-none">
                <div className="z-10 flex flex-col items-center gap-2 bg-neutral-900/80 border border-white/10 px-6 py-3 rounded-2xl shadow-lg cursor-pointer hover:bg-neutral-800 transition-colors">
                  <div className="flex items-center gap-2 text-neutral-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    <span className="text-[11px] font-bold tracking-wider"> LOAD AUDIO FILE </span>
                  </div>
                </div>
              </div>
            )}
            {state.loading && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-[10px] text-neon-cyan font-mono animate-pulse bg-black/70">
                 LOADING AUDIO... 
              </div>
            )}
          </div>
          {state.trackLoaded && !state.loading && (
            <input 
              type="range" min="0" max={state.duration || 100} step="0.1" value={state.currentTime} onChange={handleSeekSlider}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-15"
            />
          )}
        </div>
      </article>

      {/* 4. Platter & Pitch Fader Area */}
      <section className="bg-black/30 rounded-2xl p-6 border border-white/5 flex flex-col gap-6 relative my-2">
        <header className="sr-only">
          <h2>Platter and Pitch Control</h2>
        </header>
        <div className="flex-1 flex items-center justify-center gap-8 py-2">
          {/* Jog Wheel Platter */}
          <div className="relative w-48 h-48 rounded-full bg-neutral-950 flex items-center justify-center border-4 border-neutral-900 shadow-inner group">
            <div className="absolute inset-2 rounded-full border border-neutral-800/30" />
            <div className="absolute inset-6 rounded-full border border-neutral-800/30" />
            <div className="absolute inset-10 rounded-full border border-neutral-800/30" />
            <div className="absolute inset-14 rounded-full border border-neutral-800/30" />
            <div 
              className={`absolute inset-1 rounded-full border-2 border-dashed transition-all duration-1000 ${
                state.playing ? `border-${accentColor.replace('text-', '')}/30 animate-jog-spin` : 'border-transparent'
              }`}
              style={{ animationDuration: `${2 / (1 + state.pitch)}s` }}
            />
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
              <div className={`absolute top-0 bottom-1/2 w-0.5 ${accentBg} shadow-[0_0_8px_${accentBg}] origin-bottom`} />
            </div>
          </div>

          <PitchCard pitch={state.pitch} onPitchChange={onPitchChange} accentBg={accentBg} />
        </div>
      </section>

      {/* 5. Bottom Controls */}
      <ControlsCard 
        state={state} accentColor={accentColor} accentBg={accentBg}
        onSeek={onSeek} onPause={onPause} onPlay={onPlay} onSync={onSync} 
        onToggleLoop={onToggleLoop} onSetHotCue={onSetHotCue} onTriggerHotCue={onTriggerHotCue}
      />
    </article>
  );
}
