"use client";

import React, { useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Zap, Disc } from "lucide-react";
import { DeckState } from "@/types/audio";

interface DJDeckProps {
  deckId: "A" | "B";
  state: DeckState;
  audioElem: HTMLAudioElement | null;
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
    <article className="flex flex-col items-end justify-center bg-[#050508] px-5 py-4 rounded-xl border border-white/10 shadow-[inset_0_4px_15px_rgba(0,0,0,0.8)] min-w-[150px]">
      <header className="sr-only">
        <h2>Deck Timer</h2>
      </header>
      <div className={`text-4xl font-light font-mono tracking-tight ${accentColor} drop-shadow-[0_0_10px_currentColor]`}>
        {formatTime(currentTime)}
      </div>
      <div className="text-[11px] text-neutral-500 font-mono tracking-widest mt-1 font-bold">
        -{formatTime(Math.max(0, duration - currentTime))}
      </div>
    </article>
  );
}

// Sub-Component: Info Card
function InfoCard({ title, value, span = false }: { title: string; value: React.ReactNode; span?: boolean }) {
  return (
    <article className={`bg-[#0a0a0e] border border-white/10 rounded-xl px-5 py-3 flex flex-col justify-center shadow-[0_4px_10px_rgba(0,0,0,0.4)] ${span ? 'col-span-3 sm:col-span-1' : ''}`}>
      <header className="mb-1.5 border-b border-white/5 pb-1">
        <h4 className="text-[10px] text-neutral-500 font-mono font-bold tracking-[0.15em] uppercase">{title}</h4>
      </header>
      <div className="text-white text-[15px] font-mono font-bold tracking-wide">
        {value}
      </div>
    </article>
  );
}

// Sub-Component: Pitch Card
function PitchCard({ pitch, onPitchChange, accentBg }: { pitch: number, onPitchChange: (p: number) => void, accentBg: string }) {
  return (
    <article className="flex flex-col items-center bg-[#0a0a0c] border border-[#222] p-4 rounded-2xl shadow-[0_8px_20px_rgba(0,0,0,0.6)] min-w-[100px]">
      <header className="w-full text-center mb-3">
        <h4 className="text-[9px] font-mono font-bold text-neutral-500 tracking-widest border-b border-white/10 pb-2">PITCH</h4>
      </header>
      
      <ul className="flex flex-col items-center justify-between h-[160px] w-full bg-[#111115] border border-[#1a1a20] py-3 rounded-xl shadow-[inset_0_4px_15px_rgba(0,0,0,1)] relative list-none p-0 m-0">
        <li className="w-full flex justify-center block">
          <div className="bg-black px-3 py-2 rounded text-center border border-white/5 shadow-inner min-w-[50px] block">
            <span className="text-[11px] text-neutral-300 font-mono font-bold block">+10%</span>
          </div>
        </li>

        <li className="flex-1 w-full flex justify-center py-2 block">
          <div className="block h-32 w-3">
            <input 
              id="pitch-slider"
              type="range"
              min="-0.10"
              max="0.10"
              step="0.001"
              value={pitch}
              onChange={(e) => onPitchChange(parseFloat(e.target.value))}
              className={`accent-${accentBg.replace('bg-', '')} h-full vertical-slider appearance-none w-full bg-black rounded-full border border-neutral-800 outline-none cursor-row-resize shadow-inner block`}
              style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' } as any}
            />
          </div>
        </li>
        
        <li className="w-full flex justify-center block">
          <div className="bg-black px-3 py-2 rounded text-center border border-white/5 shadow-inner min-w-[50px] block">
            <span className="text-[11px] text-neutral-300 font-mono font-bold block">-10%</span>
          </div>
        </li>
        
        <li className="w-full flex justify-center block mt-3">
          <button 
            type="button"
            onClick={() => onPitchChange(0)}
            className={`w-[80%] py-1.5 rounded-full text-[9px] font-mono font-bold transition-all border-[2px] shadow-[0_4px_10px_rgba(0,0,0,0.8)] block active:scale-95 ${
              pitch === 0 
                ? "bg-[#111] text-neutral-600 border-[#222] shadow-inner" 
                : "bg-gradient-to-b from-[#222] to-black text-white hover:border-white/40 border-[#444]"
            }`}
          >
            RESET
          </button>
        </li>
      </ul>
    </article>
  );
}

// Sub-Component: Controls Card
function ControlsCard({ 
  state, accentColor, accentBg, 
  onSeek, onPause, onPlay, onSync, onToggleLoop, onSetHotCue, onTriggerHotCue 
}: any) {
  return (
    <article className="grid grid-cols-12 gap-6 mt-auto">
      
      {/* Hot Cues Module */}
      <section className="col-span-5 bg-[#111115] rounded-[20px] p-5 border border-[#222] flex flex-col gap-5 shadow-[0_8px_20px_rgba(0,0,0,0.5)]">
        <header className="flex items-center gap-3 border-b border-[#222] pb-3">
          <h3 className="text-[11px] font-mono text-neutral-400 font-bold tracking-[0.2em]">HOT CUES</h3>
          <div className="flex-1 h-[1px] bg-gradient-to-r from-white/10 to-transparent" />
        </header>
        
        <ul className="grid grid-cols-4 gap-3 flex-1 w-full list-none p-0 m-0">
          {[0, 1, 2, 3].map(i => {
            const hasCue = state.hotCues && state.hotCues[i] !== null;
            const cueColors = ["from-rose-600 to-rose-900", "from-blue-600 to-blue-900", "from-amber-500 to-amber-800", "from-emerald-500 to-emerald-800"];
            
            return (
              <li key={i} className="block w-full">
                <button
                  type="button"
                  onClick={() => hasCue ? onTriggerHotCue(i) : onSetHotCue(i, state.currentTime)}
                  className={`w-full aspect-square rounded-[16px] cursor-pointer font-mono text-[16px] font-bold transition-all flex items-center justify-center border-[3px] shadow-[0_6px_0_rgba(0,0,0,0.8)] active:translate-y-[6px] active:shadow-none block min-w-[48px] min-h-[48px] ${
                    hasCue 
                      ? `bg-gradient-to-b ${cueColors[i]} text-white border-white/20 hover:brightness-110` 
                      : 'bg-[#1a1a20] text-neutral-600 border-[#0a0a0c] hover:bg-[#222]'
                  }`}
                >
                  <span className="block w-full text-center">{i + 1}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Transport Module */}
      <section className="col-span-7 bg-[#111115] rounded-[20px] p-5 border border-[#222] flex flex-col gap-5 shadow-[0_8px_20px_rgba(0,0,0,0.5)]">
        <header className="flex items-center gap-3 border-b border-[#222] pb-3">
          <h3 className="text-[11px] font-mono text-neutral-400 font-bold tracking-[0.2em]">TRANSPORT</h3>
          <div className="flex-1 h-[1px] bg-gradient-to-r from-white/10 to-transparent" />
        </header>

        <ul className="grid grid-cols-4 gap-3 flex-1 w-full list-none p-0 m-0">
          <li className="block w-full">
            <button 
              type="button"
              onClick={() => onSeek(0)}
              disabled={!state.trackLoaded}
              className="w-full h-full min-h-[64px] rounded-[16px] border-[3px] border-white/10 bg-[#1a1a20] hover:bg-[#222] text-white flex flex-col items-center justify-center gap-2 disabled:opacity-50 shadow-[0_6px_0_rgba(0,0,0,0.8)] active:translate-y-[6px] active:shadow-none block min-w-[64px]"
            >
              <RotateCcw className="w-6 h-6 text-neutral-400 block" />
              <span className="block text-[12px] font-mono font-bold tracking-widest text-neutral-300 w-full text-center">CUE</span>
            </button>
          </li>
          
          <li className="block w-full">
            <button
              type="button"
              onClick={state.playing ? onPause : onPlay}
              disabled={!state.trackLoaded || state.loading}
              className={`w-full h-full min-h-[64px] rounded-[16px] border-[3px] flex flex-col items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-[0_6px_0_rgba(0,0,0,0.8)] active:translate-y-[6px] active:shadow-none block min-w-[64px] ${
                state.playing
                  ? `bg-black border-${accentColor.replace('text-', '')}/50 text-white shadow-[0_2px_0_rgba(0,0,0,0.8),inset_0_0_20px_rgba(0,0,0,0.5)] translate-y-[4px]`
                  : `bg-gradient-to-b ${accentBg === 'bg-neon-cyan' ? 'from-cyan-500 to-cyan-700' : 'from-purple-500 to-purple-700'} border-white/20 text-white hover:brightness-110`
              }`}
            >
              {state.playing 
                ? <><Pause className={`w-7 h-7 fill-current ${accentColor} block`} /><span className={`block text-[13px] font-bold tracking-widest ${accentColor} w-full text-center`}>PAUSE</span></> 
                : <><Play className="w-7 h-7 fill-current block" /><span className="block text-[13px] font-bold tracking-widest w-full text-center">PLAY</span></>}
            </button>
          </li>

          <li className="block w-full">
            <button
              type="button"
              onClick={onSync}
              disabled={state.loading || !state.trackLoaded}
              className="w-full h-full min-h-[64px] rounded-[16px] border-[3px] border-amber-500/20 bg-gradient-to-b from-[#1a1a20] to-[#111] hover:bg-[#222] text-white flex flex-col items-center justify-center gap-2 disabled:opacity-50 shadow-[0_6px_0_rgba(0,0,0,0.8)] active:translate-y-[6px] active:shadow-none block group min-w-[64px]"
            >
              <Zap className="w-6 h-6 text-amber-500 fill-amber-500/20 group-hover:fill-amber-500 transition-colors block" />
              <span className="block text-[12px] font-mono font-bold tracking-widest text-amber-500 w-full text-center">SYNC</span>
            </button>
          </li>

          <li className="block w-full">
            <button
              type="button"
              onClick={() => onToggleLoop(4)}
              disabled={!state.trackLoaded}
              className={`w-full h-full min-h-[64px] rounded-[16px] border-[3px] flex flex-col items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-[0_6px_0_rgba(0,0,0,0.8)] active:translate-y-[6px] active:shadow-none block min-w-[64px] ${
                state.loopActive 
                  ? 'bg-gradient-to-b from-amber-500 to-amber-700 text-black border-amber-300' 
                  : 'bg-[#1a1a20] border-white/10 hover:bg-[#222] text-neutral-400'
              }`}
            >
              <RotateCcw className={`w-6 h-6 ${state.loopActive ? 'text-black' : ''} block`} />
              <span className={`block text-[12px] font-mono font-bold tracking-widest ${state.loopActive ? 'text-black' : ''} w-full text-center`}>LOOP</span>
            </button>
          </li>
        </ul>
      </section>
    </article>
  );
}

export default function DJDeck({
  deckId, state, audioElem, onPlay, onPause, onSeek, onBpmChange, onPitchChange,
  onSync, onVinylStop, onSetHotCue, onTriggerHotCue, onToggleLoop, onFileDrop
}: DJDeckProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const isA = deckId === "A";
  const accentColor = isA ? "text-neon-cyan" : "text-neon-purple";
  const glowBorderClass = isA ? "focus-within:border-neon-cyan/40" : "focus-within:border-neon-purple/40";
  const accentBg = isA ? "bg-neon-cyan" : "bg-neon-purple";
  const waveColor = isA ? "rgba(0, 243, 255, 0.15)" : "rgba(189, 0, 255, 0.15)";
  const progressColor = isA ? "rgba(0, 243, 255, 0.8)" : "rgba(189, 0, 255, 0.8)";
  const cursorColor = isA ? "#00f3ff" : "#bd00ff";

  const wavesurferRef = useRef<any>(null);
  const regionsPluginRef = useRef<any>(null);

  // Initialize and update Wavesurfer instance
  useEffect(() => {
    if (typeof window === "undefined" || !state.trackLoaded || !audioElem) return;

    let ws: any = null;
    let regions: any = null;
    
    const container = document.querySelector(`#waveform-${deckId}`);
    if (container) {
      container.innerHTML = ""; // Clear
      
      Promise.all([
        import("wavesurfer.js"),
        import("wavesurfer.js/dist/plugins/regions.esm.js")
      ]).then(([WaveSurfer, RegionsPlugin]) => {
        regions = RegionsPlugin.default.create();
        regionsPluginRef.current = regions;
        
        ws = WaveSurfer.default.create({
          container: `#waveform-${deckId}`,
          media: audioElem,
          waveColor: waveColor,
          progressColor: progressColor,
          cursorColor: cursorColor,
          cursorWidth: 2,
          height: 94, // slightly less than container h-24
          barWidth: 2,
          barGap: 1.5,
          interact: true,
          plugins: [regions],
        });
        
        ws.on('interaction', (newTime: number) => {
          onSeek(newTime);
        });
        
        wavesurferRef.current = ws;
      });
    }

    return () => {
      if (ws) ws.destroy();
    };
  }, [state.trackLoaded, audioElem, deckId, waveColor, progressColor, cursorColor]);

  // Sync Hot Cues to Regions
  useEffect(() => {
    if (!regionsPluginRef.current || !state.hotCues) return;
    
    const regions = regionsPluginRef.current;
    regions.clearRegions();
    
    const cueColors = ["rgba(225, 29, 72, 0.5)", "rgba(37, 99, 235, 0.5)", "rgba(217, 119, 6, 0.5)", "rgba(16, 185, 129, 0.5)"];
    
    state.hotCues.forEach((time, i) => {
      if (time !== null) {
        regions.addRegion({
          start: time,
          end: time + 0.1, // tiny duration just for visual marker
          color: cueColors[i],
          drag: false,
          resize: false,
          content: `Q${i + 1}`,
        });
      }
    });
  }, [state.hotCues]);

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
      className={`bg-gradient-to-b from-[#16161a] to-[#050508] rounded-[36px] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.9)] border-2 ${isDragging ? 'border-neon-pink bg-neon-pink/5 scale-[1.02]' : 'border-[#1a1a20]'} flex flex-col gap-6 relative transition-all duration-300 ${glowBorderClass} h-full overflow-y-auto`}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm rounded-[34px] border-[4px] border-dashed border-neon-pink">
          <p className="font-mono text-neon-pink font-bold text-2xl tracking-[0.3em] pointer-events-none">DROP AUDIO FILE TO LOAD</p>
        </div>
      )}

      {/* Glow corner highlights */}
      <div className={`absolute top-0 ${isA ? 'left-10' : 'right-10'} w-40 h-[3px] bg-gradient-to-r from-transparent via-${isA ? 'neon-cyan' : 'neon-purple'} to-transparent opacity-80`} />

      {/* 1. Top Header: Title & Time */}
      <header className="bg-black/60 rounded-[20px] p-6 border border-white/5 flex flex-col gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
        <div className="flex justify-between items-center gap-8">
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="flex items-center gap-4">
              <span className={`w-3.5 h-3.5 rounded-full ${state.playing ? 'animate-pulse' : ''} ${accentBg} shadow-[0_0_15px_currentColor]`} />
              <div className="flex items-center gap-2 bg-[#111] px-4 py-1.5 rounded-full border border-white/10">
                <p className="text-[12px] uppercase font-bold tracking-[0.2em] text-white">DECK {deckId}</p>
                <div className="w-1 h-1 rounded-full bg-neutral-600" />
                <p className="text-[11px] uppercase font-bold tracking-widest text-neutral-400">{state.genre || 'NO GENRE'}</p>
              </div>
            </div>
            <h3 className="font-bold text-2xl tracking-wide truncate text-white drop-shadow-lg" title={state.title}>
              {state.loading ? "Loading track..." : state.title || "No Track Loaded"}
            </h3>
          </div>
          <TimerCard currentTime={state.currentTime} duration={state.duration} accentColor={accentColor} />
        </div>
      </header>

      {/* 2. Metadata Row (Compact Grid) */}
      <section className="grid grid-cols-3 gap-6 w-full">
        <InfoCard title="KEY" value={state.key || '--'} />
        <InfoCard title="BPM" value={state.bpm ? state.bpm.toFixed(1) : '--'} />
        <InfoCard 
          title="TIME ELAPSED / REMAINING" 
          span 
          value={
            <div className="flex items-center justify-between font-mono mt-0.5">
              <span className={`${accentColor} text-[16px]`}>{formatTime(state.currentTime)}</span>
              <span className="text-neutral-600 text-[14px] font-bold mx-2">/</span>
              <span className="text-neutral-400 text-[14px]">{formatTime(state.duration)}</span>
            </div>
          } 
        />
      </section>

      {/* 3. Upload / Waveform Placeholder */}
      <article className="bg-[#050508] rounded-[20px] p-3 border border-[#222] shadow-[inset_0_4px_25px_rgba(0,0,0,0.9)]">
        <header className="sr-only">
          <h2>Waveform display</h2>
        </header>
        <div className="relative w-full">
          <div id={`waveform-${deckId}`} className="w-full h-24 bg-gradient-to-b from-[#111] to-black rounded-xl overflow-hidden relative border border-[#222]">
            {!state.trackLoaded && !state.loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
                <div className="z-10 flex items-center gap-3 bg-[#1a1a20] border border-white/20 px-8 py-4 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:bg-[#222] transition-colors cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-300"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  <span className="text-[13px] font-bold tracking-[0.2em] text-white">LOAD AUDIO</span>
                </div>
              </div>
            )}
            {state.loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                 <span className={`text-[14px] font-bold ${accentColor} font-mono tracking-[0.3em] animate-pulse`}>LOADING...</span>
              </div>
            )}
          </div>
        </div>
      </article>

      {/* 4. Platter & Pitch Fader Area */}
      <section className="bg-[#111115] rounded-[24px] p-8 border border-[#222] flex flex-col shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
        <header className="sr-only">
          <h2>Platter and Pitch Control</h2>
        </header>
        <div className="flex-1 flex items-center justify-between gap-10">
          
          {/* Jog Wheel Platter */}
          <div className="flex-1 flex justify-center">
            <div className="relative w-56 h-56 rounded-full bg-black flex items-center justify-center border-[10px] border-[#1a1a20] shadow-[0_20px_50px_rgba(0,0,0,1),inset_0_5px_20px_rgba(0,0,0,0.8)]">
              <div className="absolute inset-3 rounded-full border-[2px] border-white/5 shadow-inner" />
              <div className="absolute inset-8 rounded-full border-[2px] border-white/5 shadow-inner" />
              <div className="absolute inset-14 rounded-full border-[2px] border-white/5 shadow-inner" />
              <div 
                className={`absolute inset-0 rounded-full border-4 border-dashed transition-all duration-1000 ${
                  state.playing ? `border-${accentColor.replace('text-', '')}/50 animate-jog-spin shadow-[0_0_40px_rgba(255,255,255,0.1)]` : 'border-transparent'
                }`}
                style={{ animationDuration: `${2 / (1 + state.pitch)}s` }}
              />
              <div 
                className={`w-28 h-28 rounded-full bg-gradient-to-b from-[#2a2a30] to-[#111] shadow-[0_15px_30px_rgba(0,0,0,0.9)] flex items-center justify-center relative border-[6px] border-[#333] ${
                  state.playing ? 'animate-jog-spin' : ''
                }`}
                style={{ animationDuration: `${2 / (1 + state.pitch)}s` }}
              >
                <div className={`w-12 h-12 rounded-full ${accentBg}/20 flex items-center justify-center border-2 border-${accentColor.replace('text-', '')}/40 shadow-inner`}>
                  <Disc className={`w-6 h-6 ${accentColor}`} />
                </div>
                <div className={`absolute top-0 bottom-1/2 w-1.5 ${accentBg} shadow-[0_0_15px_${accentBg}] origin-bottom rounded-t-full`} />
              </div>
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
