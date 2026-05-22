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
    <article className="flex flex-col items-end justify-center bg-[#0a0a0c] px-5 py-3 rounded-xl border border-white/10 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] min-w-[140px]">
      <header className="sr-only">
        <h2>Deck Timer</h2>
      </header>
      <div className={`text-3xl font-light font-mono tracking-tight ${accentColor}`}>
        {formatTime(currentTime)}
      </div>
      <div className="text-[10px] text-neutral-500 font-mono tracking-widest mt-1">
        -{formatTime(Math.max(0, duration - currentTime))}
      </div>
    </article>
  );
}

// Sub-Component: Info Card
function InfoCard({ title, value, span = false }: { title: string; value: React.ReactNode; span?: boolean }) {
  return (
    <article className={`bg-gradient-to-b from-[#1c1c20] to-[#111115] border border-white/5 rounded-xl px-5 py-3 flex flex-col justify-center shadow-[0_4px_10px_rgba(0,0,0,0.5)] ${span ? 'col-span-3 sm:col-span-1' : ''}`}>
      <header className="mb-1">
        <h4 className="text-[9px] text-neutral-500 font-mono font-bold tracking-widest uppercase">{title}</h4>
      </header>
      <div className="text-white text-[14px] font-mono font-bold tracking-wide">
        {value}
      </div>
    </article>
  );
}

// Sub-Component: Pitch Card
function PitchCard({ pitch, onPitchChange, accentBg }: { pitch: number, onPitchChange: (p: number) => void, accentBg: string }) {
  return (
    <fieldset className="flex flex-col items-center justify-between h-[260px] w-20 bg-gradient-to-b from-[#1a1a20] to-[#0a0a0c] border border-white/10 py-5 rounded-2xl shadow-[0_8px_20px_rgba(0,0,0,0.8)] relative">
      <legend className="sr-only">Pitch Control</legend>
      
      <div className="bg-black/60 px-2 py-1 rounded border border-white/5 shadow-inner w-12 text-center">
        <label htmlFor="pitch-slider" className="text-[10px] text-neutral-400 font-mono font-bold block">+10</label>
      </div>

      <input 
        id="pitch-slider"
        type="range"
        min="-0.10"
        max="0.10"
        step="0.001"
        value={pitch}
        onChange={(e) => onPitchChange(parseFloat(e.target.value))}
        className={`accent-${accentBg.replace('bg-', '')} h-36 my-2 vertical-slider appearance-none w-2 bg-neutral-900 rounded-full border border-black outline-none cursor-row-resize shadow-inner block`}
        style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' } as any}
      />
      
      <div className="bg-black/60 px-2 py-1 rounded border border-white/5 shadow-inner w-12 text-center">
        <label htmlFor="pitch-slider" className="text-[10px] text-neutral-400 font-mono font-bold block">-10</label>
      </div>
      
      <button 
        type="button"
        onClick={() => onPitchChange(0)}
        className={`absolute -right-12 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg border text-[9px] font-mono font-bold transition-all shadow-md ${
          pitch === 0 
            ? "bg-[#0a0a0c] text-neutral-600 border-white/5 shadow-inner" 
            : "bg-neutral-800 text-white border-white/20 hover:bg-neutral-700 hover:scale-105"
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
    <article className="bg-[#111115] rounded-2xl p-5 border border-white/5 mt-auto shadow-[inset_0_2px_20px_rgba(0,0,0,0.5)]">
      <header className="sr-only">
        <h2>Deck Controls</h2>
      </header>
      <div className="grid grid-cols-12 gap-5">
        
        {/* Hot Cues Card */}
        <fieldset className="col-span-5 bg-[#0a0a0c] rounded-2xl p-4 border border-white/10 flex flex-col gap-4 shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
          <legend className="text-[10px] font-mono text-neutral-500 font-bold px-3 py-1 bg-[#1a1a20] rounded-full border border-white/5 ml-2 tracking-widest">HOT CUES</legend>
          <div className="grid grid-cols-4 gap-3 flex-1 px-1 pb-1">
            {[0, 1, 2, 3].map(i => {
              const hasCue = state.hotCues && state.hotCues[i] !== null;
              const cueColors = ["from-rose-500 to-rose-700", "from-blue-500 to-blue-700", "from-amber-400 to-amber-600", "from-emerald-400 to-emerald-600"];
              const cueShadows = ["shadow-[0_0_15px_rgba(244,63,94,0.4)]", "shadow-[0_0_15px_rgba(59,130,246,0.4)]", "shadow-[0_0_15px_rgba(251,191,36,0.4)]", "shadow-[0_0_15px_rgba(16,185,129,0.4)]"];
              const ringColors = ["ring-rose-500/50", "ring-blue-500/50", "ring-amber-500/50", "ring-emerald-500/50"];
              
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => hasCue ? onTriggerHotCue(i) : onSetHotCue(i, state.currentTime)}
                  aria-label={`Hot Cue ${i + 1}`}
                  className={`aspect-square rounded-xl cursor-pointer font-mono text-[14px] font-bold transition-all flex items-center justify-center w-full block ${
                    hasCue 
                      ? `bg-gradient-to-b ${cueColors[i]} text-black border-t border-white/40 border-b-2 border-b-black ${cueShadows[i]} ring-2 ${ringColors[i]} ring-offset-2 ring-offset-black active:translate-y-0.5 active:border-b-0` 
                      : 'bg-gradient-to-b from-[#2a2a30] to-[#1a1a20] text-neutral-500 border-t border-t-white/10 border-b-2 border-b-black shadow-[0_4px_10px_rgba(0,0,0,0.5)] hover:text-white active:translate-y-0.5 active:border-b-0'
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Transport Card */}
        <fieldset className="col-span-7 bg-[#0a0a0c] rounded-2xl p-4 border border-white/10 flex flex-col gap-4 shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
          <legend className="text-[10px] font-mono text-neutral-500 font-bold px-3 py-1 bg-[#1a1a20] rounded-full border border-white/5 ml-2 tracking-widest">TRANSPORT</legend>
          <div className="grid grid-cols-4 gap-4 px-1 pb-1 flex-1">
            <button 
              type="button"
              onClick={() => onSeek(0)}
              disabled={!state.trackLoaded}
              className="w-full h-full min-h-[64px] rounded-xl border-t border-t-white/20 border-b-4 border-b-black bg-gradient-to-b from-neutral-800 to-neutral-900 hover:from-neutral-700 hover:to-neutral-800 text-[11px] font-mono font-bold text-white flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 shadow-[0_6px_10px_rgba(0,0,0,0.6)] active:translate-y-1 active:border-b-0 active:shadow-inner"
            >
              <RotateCcw className="w-5 h-5" />
              <span className="block">CUE</span>
            </button>
            
            <button
              type="button"
              onClick={state.playing ? onPause : onPlay}
              disabled={!state.trackLoaded || state.loading}
              className={`w-full h-full min-h-[64px] rounded-xl border-t border-t-white/40 border-b-4 border-b-black flex flex-col items-center justify-center gap-1.5 text-[12px] font-bold disabled:opacity-50 transition-all shadow-[0_6px_15px_rgba(0,0,0,0.6)] active:translate-y-1 active:border-b-0 active:shadow-inner ${
                state.playing
                  ? `bg-gradient-to-b from-[#1a1a20] to-[#0a0a0c] text-white ring-2 ring-${accentColor.replace('text-', '')}/50 shadow-[inset_0_0_15px_rgba(0,0,0,0.8)]`
                  : `bg-gradient-to-b ${accentBg === 'bg-neon-cyan' ? 'from-cyan-400 to-cyan-600' : 'from-purple-400 to-purple-600'} text-black shadow-[0_0_15px_rgba(0,0,0,0.4)]`
              }`}
            >
              {state.playing 
                ? <><Pause className="w-6 h-6 fill-current" /><span className="block">PAUSE</span></> 
                : <><Play className="w-6 h-6 fill-current" /><span className="block text-[13px]">PLAY</span></>}
            </button>

            <button
              type="button"
              onClick={onSync}
              disabled={state.loading || !state.trackLoaded}
              className="w-full h-full min-h-[64px] rounded-xl border-t border-t-white/20 border-b-4 border-b-black bg-gradient-to-b from-neutral-800 to-neutral-900 hover:from-neutral-700 hover:to-neutral-800 text-[11px] font-mono font-bold text-white flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 shadow-[0_6px_10px_rgba(0,0,0,0.6)] active:translate-y-1 active:border-b-0 active:shadow-inner"
            >
              <Zap className="w-5 h-5 text-amber-400 fill-amber-400/20" />
              <span className="block">SYNC</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleLoop(4)}
              disabled={!state.trackLoaded}
              className={`w-full h-full min-h-[64px] rounded-xl border-t border-t-white/20 border-b-4 border-b-black flex flex-col items-center justify-center gap-1.5 text-[11px] font-mono font-bold disabled:opacity-50 transition-all shadow-[0_6px_10px_rgba(0,0,0,0.6)] active:translate-y-1 active:border-b-0 active:shadow-inner ${
                state.loopActive 
                  ? 'bg-gradient-to-b from-amber-500 to-amber-700 text-black border-t-white/40 ring-2 ring-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.4)]' 
                  : 'bg-gradient-to-b from-neutral-800 to-neutral-900 hover:from-neutral-700 hover:to-neutral-800 text-white'
              }`}
            >
              <RotateCcw className="w-5 h-5" />
              <span className="block">LOOP</span>
            </button>
          </div>
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
      className={`bg-gradient-to-b from-[#1a1a20] to-[#0a0a0c] rounded-[32px] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] border-2 ${isDragging ? 'border-neon-pink bg-neon-pink/5 scale-[1.02]' : 'border-[#222]'} flex flex-col gap-6 relative transition-all duration-300 ${glowBorderClass} h-full`}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-3xl border-2 border-dashed border-neon-pink">
          <p className="font-mono text-neon-pink font-bold text-xl tracking-widest pointer-events-none">DROP FILE TO LOAD TO DECK {deckId}</p>
        </div>
      )}

      {/* Glow corner highlights */}
      <div className={`absolute top-0 ${isA ? 'left-8' : 'right-8'} w-32 h-[2px] bg-gradient-to-r from-transparent via-${isA ? 'neon-cyan' : 'neon-purple'}/60 to-transparent shadow-[0_0_15px_rgba(255,255,255,0.2)]`} />

      {/* 1. Top Header: Title & Time */}
      <header className="bg-gradient-to-b from-[#111115] to-[#0a0a0c] rounded-2xl p-5 border border-white/5 flex flex-col gap-3 relative shadow-[0_4px_15px_rgba(0,0,0,0.4)]">
        <div className="flex justify-between items-center gap-6">
          <div className="flex-1 min-w-0 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-2">
              <span className={`w-3 h-3 rounded-full ${state.playing ? 'animate-pulse' : ''} ${accentBg} shadow-[0_0_10px_rgba(255,255,255,0.2)]`} />
              <p className="text-[11px] uppercase font-bold tracking-[0.2em] text-neutral-400 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                Deck {deckId}
              </p>
              <p className="text-[10px] uppercase font-bold tracking-widest text-neutral-500">
                {state.genre || 'No Genre'}
              </p>
            </div>
            <h3 className="font-bold text-xl tracking-wide truncate text-white drop-shadow-md" title={state.title}>
              {state.loading ? "Loading track..." : state.title || "No Track Loaded"}
            </h3>
          </div>
          <TimerCard currentTime={state.currentTime} duration={state.duration} accentColor={accentColor} />
        </div>
      </header>

      {/* 2. Metadata Row (Compact Grid) */}
      <section className="grid grid-cols-3 gap-5 w-full">
        <InfoCard title="KEY" value={state.key || '--'} />
        <InfoCard title="BPM" value={state.bpm ? state.bpm.toFixed(1) : '--'} />
        <InfoCard 
          title="TIME ELAPSED / REMAINING" 
          span 
          value={
            <div className="flex items-center gap-2 font-mono mt-0.5">
              <span className={`${accentColor} text-[15px]`}>{formatTime(state.currentTime)}</span>
              <span className="text-neutral-600 text-[12px] font-bold">/</span>
              <span className="text-neutral-400 text-[13px]">{formatTime(state.duration)}</span>
            </div>
          } 
        />
      </section>

      {/* 3. Upload / Waveform Placeholder */}
      <article className="bg-[#111115] rounded-2xl p-2 border border-[#222] relative shadow-[inset_0_4px_20px_rgba(0,0,0,0.8)]">
        <header className="sr-only">
          <h2>Waveform display</h2>
        </header>
        <div className="relative w-full">
          <div id={`waveform-${deckId}`} className="w-full h-20 bg-black/80 rounded-xl overflow-hidden relative border border-white/5 shadow-inner">
            {!state.trackLoaded && !state.loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-transparent select-none">
                <div className="z-10 flex flex-col items-center gap-2 bg-black/60 border border-white/10 px-8 py-3 rounded-full shadow-lg cursor-pointer hover:bg-neutral-800 hover:scale-105 transition-all">
                  <div className="flex items-center gap-3 text-neutral-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    <span className="text-[12px] font-bold tracking-[0.2em]"> LOAD AUDIO </span>
                  </div>
                </div>
              </div>
            )}
            {state.loading && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-[11px] font-bold text-neon-cyan font-mono animate-pulse bg-black/70 tracking-widest">
                 LOADING... 
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
      <section className="bg-gradient-to-b from-[#111115] to-[#0a0a0c] rounded-2xl p-6 border border-white/5 flex flex-col relative shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
        <header className="sr-only">
          <h2>Platter and Pitch Control</h2>
        </header>
        <div className="flex-1 flex items-center justify-between gap-8 py-4 px-6">
          {/* Jog Wheel Platter */}
          <div className="relative w-56 h-56 rounded-full bg-[#111] flex items-center justify-center border-[8px] border-[#222] shadow-[0_20px_50px_rgba(0,0,0,0.9),inset_0_4px_15px_rgba(0,0,0,1)] group">
            <div className="absolute inset-2 rounded-full border border-white/5 shadow-inner" />
            <div className="absolute inset-6 rounded-full border border-white/5 shadow-inner" />
            <div className="absolute inset-10 rounded-full border border-white/5 shadow-inner" />
            <div className="absolute inset-14 rounded-full border border-white/5 shadow-inner" />
            <div 
              className={`absolute inset-0 rounded-full border-2 border-dashed transition-all duration-1000 ${
                state.playing ? `border-${accentColor.replace('text-', '')}/40 animate-jog-spin shadow-[0_0_30px_rgba(255,255,255,0.1)]` : 'border-transparent'
              }`}
              style={{ animationDuration: `${2 / (1 + state.pitch)}s` }}
            />
            <div 
              className={`w-24 h-24 rounded-full bg-gradient-to-b from-[#222] to-[#111] shadow-[0_10px_20px_rgba(0,0,0,0.9)] flex items-center justify-center relative border-4 border-[#333] ${
                state.playing ? 'animate-jog-spin' : ''
              }`}
              style={{ animationDuration: `${2 / (1 + state.pitch)}s` }}
            >
              <div className={`w-10 h-10 rounded-full ${accentBg}/20 flex items-center justify-center border border-${accentColor.replace('text-', '')}/40 relative shadow-inner`}>
                <Disc className={`w-5 h-5 ${accentColor}`} />
                <div className="w-2 h-2 rounded-full bg-black absolute center shadow-inner" />
              </div>
              <div className={`absolute top-0 bottom-1/2 w-1 ${accentBg} shadow-[0_0_12px_${accentBg}] origin-bottom rounded-t-full`} />
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
