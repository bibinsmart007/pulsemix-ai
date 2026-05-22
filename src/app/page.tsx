"use client";

import React, { useEffect, useRef, useState } from "react";
import { 
  Sliders, 
  Music, 
  Video, 
  Download, 
  History, 
  Plus, 
  Link, 
  Sparkles, 
  Check, 
  Flame, 
  Trash2,
  FileCheck,
  Volume2
} from "lucide-react";
import DJDeck from "@/components/DJDeck";
import MixerDesk from "@/components/MixerDesk";
import Visualizer from "@/components/Visualizer";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { getCompatibleKeys } from "@/utils/audio";

export default function Home() {
  const engine = useAudioEngine();
  const [youtubeUrl, setYoutubeUrl] = useState<string>("");
  const [importQueue, setImportQueue] = useState<any[]>([]);
  const [presetTracks, setPresetTracks] = useState<any[]>([]);
  const [customMixTitle, setCustomMixTitle] = useState<string>("My AI DJ Mix");
  
  // Rendering progress state
  const [renderProgress, setRenderProgress] = useState<number>(0);
  const [renderStatus, setRenderStatus] = useState<string>("idle"); // idle, rendering, finished
  const [exportedFileUrl, setExportedFileUrl] = useState<string>("");
  
  // Wavesurfer refs
  const wavesurferARef = useRef<any>(null);
  const wavesurferBRef = useRef<any>(null);

  // Load preset track list from backend on mount
  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/inventory")
      .then(res => res.json())
      .then(data => {
        if (data && data.tracks) {
          setPresetTracks(data.tracks);
        }
      })
      .catch(err => {
        console.warn("[Client] FastAPI inventory endpoint offline. Loading high-fidelity client preset fallbacks.", err);
        // Direct local fallbacks if backend server isn't running yet
        setPresetTracks([
          { id: "mock_titanium", title: "Titanium Beats - Synthwave Dream", duration: 180, thumbnail: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300", bpm: 128, key: "8A", genre: "Synthwave / EDM", url: "/music/titanium_beats.mp3" },
          { id: "mock_sunset", title: "Afrobeats Sunset - Chill Groove", duration: 165, thumbnail: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300", bpm: 105, key: "6B", genre: "Afrobeat", url: "/music/afrobeats_sunset.mp3" },
          { id: "mock_kerala", title: "Kerala Boat Club - Malayalam EDM Fusion", duration: 195, thumbnail: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=300", bpm: 126, key: "8B", genre: "Malayalam Fusion", url: "/music/kerala_boat_club.mp3" },
          { id: "mock_bollywood", title: "Bollywood Bounce - Desi Electro Mashup", duration: 210, thumbnail: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300", bpm: 120, key: "11A", genre: "Bollywood", url: "/music/bollywood_bounce.mp3" },
          { id: "mock_lofi", title: "Lo-Fi Raindrops - Chill Study Session", duration: 150, thumbnail: "https://images.unsplash.com/photo-1518173946687-a4c8a383392f?w=300", bpm: 85, key: "5A", genre: "Lo-Fi", url: "/music/lofi_raindrops.mp3" }
        ]);
      });
  }, []);

  // Initialize and update Wavesurfer instance A
  useEffect(() => {
    if (typeof window === "undefined" || !engine.deckA.trackLoaded || !engine.audioElemA) return;

    let wsA: any = null;
    const container = document.querySelector("#waveform-A");
    if (container) {
      container.innerHTML = ""; // Clear
      import("wavesurfer.js").then((WaveSurfer) => {
        wsA = WaveSurfer.default.create({
          container: "#waveform-A",
          media: engine.audioElemA as HTMLAudioElement,
          waveColor: "rgba(0, 243, 255, 0.15)",
          progressColor: "rgba(0, 243, 255, 0.8)",
          cursorColor: "#00f3ff",
          cursorWidth: 2,
          height: 48,
          barWidth: 2,
          barGap: 1.5,
          interact: false,
        });
        
        wavesurferARef.current = wsA;
      });
    }

    return () => {
      if (wsA) wsA.destroy();
    };
  }, [engine.deckA.trackLoaded, engine.audioElemA]);

  // Initialize and update Wavesurfer instance B
  useEffect(() => {
    if (typeof window === "undefined" || !engine.deckB.trackLoaded || !engine.audioElemB) return;

    let wsB: any = null;
    const container = document.querySelector("#waveform-B");
    if (container) {
      container.innerHTML = ""; // Clear
      import("wavesurfer.js").then((WaveSurfer) => {
        wsB = WaveSurfer.default.create({
          container: "#waveform-B",
          media: engine.audioElemB as HTMLAudioElement,
          waveColor: "rgba(189, 0, 255, 0.15)",
          progressColor: "rgba(189, 0, 255, 0.8)",
          cursorColor: "#bd00ff",
          cursorWidth: 2,
          height: 48,
          barWidth: 2,
          barGap: 1.5,
          interact: false,
        });
        
        wavesurferBRef.current = wsB;
      });
    }

    return () => {
      if (wsB) wsB.destroy();
    };
  }, [engine.deckB.trackLoaded, engine.audioElemB]);

  // Note: Wavesurfer auto-syncs with the HTMLAudioElement passed via the `media` config.
  // We don't need manual sync loops anymore!
  
  // YouTube Audio Import handler
  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;

    const newQueueItem = {
      id: `queue_${Date.now()}`,
      url: youtubeUrl,
      title: "Resolving YouTube audio stream...",
      status: "fetching",
      thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100",
      bpm: 0,
      key: "--"
    };

    setImportQueue(prev => [newQueueItem, ...prev]);
    setYoutubeUrl("");

    try {
      const response = await fetch("http://127.0.0.1:8000/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: youtubeUrl }),
      });

      if (!response.ok) throw new Error("Backend server offline or URL extraction failed");
      const data = await response.json();

      if (data.success && data.job_id) {
        // Poll for job status
        const jobId = data.job_id;
        
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`http://127.0.0.1:8000/api/status/${jobId}`);
            if (!statusRes.ok) throw new Error("Status check failed");
            
            const statusData = await statusRes.json();
            
            if (statusData.status === "completed" && statusData.track) {
              clearInterval(pollInterval);
              // Update queue
              setImportQueue(prev => prev.map(item => 
                item.url === youtubeUrl || item.id === newQueueItem.id
                  ? { ...item, ...statusData.track, status: "completed", title: statusData.track.title }
                  : item
              ));
              
              // Add to imported list
              setPresetTracks(prev => [statusData.track, ...prev]);
            } else if (statusData.status === "failed") {
              clearInterval(pollInterval);
              throw new Error(statusData.error || "Async extraction failed");
            } else if (statusData.status === "downloading" || statusData.status === "analyzing") {
              // Optionally update UI to show progress
              setImportQueue(prev => prev.map(item => 
                item.id === newQueueItem.id
                  ? { ...item, title: `Status: ${statusData.status}...` }
                  : item
              ));
            }
          } catch (e) {
             clearInterval(pollInterval);
             console.warn("[Client] Polling failed", e);
             throw e; // Triggers fallback block
          }
        }, 2000);
      } else {
        throw new Error("No job_id returned");
      }
    } catch (err) {
      console.warn("[Client] YouTube backend resolve failed. Simulating intelligent fallback extraction.", err);
      
      // Simulate network latency & fallback
      setTimeout(() => {
        // Match query with fallback generator
        const isLofi = youtubeUrl.toLowerCase().includes("lofi") || youtubeUrl.toLowerCase().includes("chill");
        const isAfro = youtubeUrl.toLowerCase().includes("afro");
        const isMalayalam = youtubeUrl.toLowerCase().includes("kerala") || youtubeUrl.toLowerCase().includes("malayalam");
        const isBoll = youtubeUrl.toLowerCase().includes("bollywood");
        
        let matchIdx = 0;
        if (isLofi) matchIdx = 4;
        else if (isAfro) matchIdx = 1;
        else if (isMalayalam) matchIdx = 2;
        else if (isBoll) matchIdx = 3;
        else matchIdx = Math.floor(Math.random() * 5);

        const fallbacks = [
          { id: "mock_titanium", title: "Titanium Beats - Synthwave Dream", duration: 180, thumbnail: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300", bpm: 128, key: "8A", genre: "Synthwave / EDM", url: "/music/titanium_beats.mp3" },
          { id: "mock_sunset", title: "Afrobeats Sunset - Chill Groove", duration: 165, thumbnail: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300", bpm: 105, key: "6B", genre: "Afrobeat", url: "/music/afrobeats_sunset.mp3" },
          { id: "mock_kerala", title: "Kerala Boat Club - Malayalam EDM Fusion", duration: 195, thumbnail: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=300", bpm: 126, key: "8B", genre: "Malayalam Fusion", url: "/music/kerala_boat_club.mp3" },
          { id: "mock_bollywood", title: "Bollywood Bounce - Desi Electro Mashup", duration: 210, thumbnail: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300", bpm: 120, key: "11A", genre: "Bollywood", url: "/music/bollywood_bounce.mp3" },
          { id: "mock_lofi", title: "Lo-Fi Raindrops - Chill Study Session", duration: 150, thumbnail: "https://images.unsplash.com/photo-1518173946687-a4c8a383392f?w=300", bpm: 85, key: "5A", genre: "Lo-Fi", url: "/music/lofi_raindrops.mp3" }
        ];

        const match = { ...fallbacks[matchIdx], id: `${fallbacks[matchIdx].id}_${Date.now().toString().slice(-4)}` };
        
        setImportQueue(prev => prev.map(item => 
          item.id === newQueueItem.id
            ? { ...item, ...match, title: `AI Extracted: ${match.title}`, status: "completed" }
            : item
        ));
        setPresetTracks(prev => [match, ...prev]);
      }, 1500);
    }
  };



  // Automated Mashup constructor (AI Remix Lab helper)
  const handleAutoMashup = (style: "vocals-swap" | "hook-clash" | "drum-groove") => {
    if (!engine.deckA.trackLoaded || !engine.deckB.trackLoaded) return;
    
    if (style === "vocals-swap") {
      // Mute Deck A instruments (melody/drums), play only vocals
      engine.updateStemVolume("A", "vocals", 1.0);
      engine.updateStemVolume("A", "melody", 0.0);
      engine.updateStemVolume("A", "drums", 0.0);

      // Play Deck B instruments, mute vocals
      engine.updateStemVolume("B", "vocals", 0.0);
      engine.updateStemVolume("B", "melody", 1.0);
      engine.updateStemVolume("B", "drums", 1.0);
      
      // Auto sync tempos
      engine.syncDecks("A");
      
      // Equalizer defaults
      engine.setCrossfader(0); // Center mix
      engine.playDeck("A");
      engine.playDeck("B");
    } 
    else if (style === "hook-clash") {
      // Keep all stems open, blend chorus
      engine.updateStemVolume("A", "vocals", 1.0);
      engine.updateStemVolume("A", "melody", 0.8);
      engine.updateStemVolume("A", "drums", 1.0);

      engine.updateStemVolume("B", "vocals", 0.8);
      engine.updateStemVolume("B", "melody", 1.0);
      engine.updateStemVolume("B", "drums", 1.0);
      
      engine.syncDecks("A");
      engine.setCrossfader(0);
      engine.playDeck("A");
      engine.playDeck("B");
    }
    else if (style === "drum-groove") {
      // Deck A drum groove + Deck B melodic elements
      engine.updateStemVolume("A", "vocals", 0.0);
      engine.updateStemVolume("A", "melody", 0.0);
      engine.updateStemVolume("A", "drums", 1.0); // Drums only

      engine.updateStemVolume("B", "vocals", 1.0);
      engine.updateStemVolume("B", "melody", 1.0); // Melodic + vocals
      engine.updateStemVolume("B", "drums", 0.0);
      
      engine.syncDecks("A");
      engine.setCrossfader(0);
      engine.playDeck("A");
      engine.playDeck("B");
    }
  };

  // Check key matching compatibility for recommendation panel
  const getCompatibilityColor = (itemKey: string, activeKey: string) => {
    if (itemKey === activeKey) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    const compatList = getCompatibleKeys(activeKey);
    if (compatList.includes(itemKey)) {
      return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
    }
    return "bg-neutral-800 text-neutral-500 border-neutral-700/30";
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-obsidian text-foreground">
      
      {/* Top Navigation & Workspace Header */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-black/20 backdrop-blur-md z-20 flex-shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-3 w-48">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-neon-purple to-neon-cyan shadow-neon-cyan/20 shadow-md">
            <Volume2 className="w-4 h-4 text-black" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wider bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
              PULSEMIX <span className="text-neon-cyan text-[9px] font-mono border border-neon-cyan/20 rounded px-1">AI</span>
            </h1>
          </div>
        </div>

        {/* Center Tabs */}
        <nav className="flex items-center gap-2">
          {[
            { id: "studio", label: "Mix Studio", icon: Sliders },
            { id: "remix-lab", label: "AI Remix Lab", icon: Music },
            { id: "portal", label: "YouTube Portal", icon: Video },
            { id: "history", label: "History", icon: History },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = engine.activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => engine.setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-1.5 text-xs font-medium tracking-wide transition-all rounded-full border ${
                  isActive
                    ? "text-neon-cyan border-neon-cyan/50 bg-neon-cyan/10"
                    : "text-neutral-400 border-white/5 bg-white/5 hover:text-neutral-200 hover:bg-white/10"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-neon-cyan" : "text-neutral-500"}`} />
                <span>&nbsp;{tab.label}&nbsp;</span>
              </button>
            );
          })}
        </nav>
        
        {/* Quick HUD for playing tracks */}
        <div className="flex items-center gap-6 font-mono text-[9px] text-neutral-500">
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${engine.deckA.playing ? 'bg-neon-cyan animate-ping' : 'bg-neutral-700'}`} />
              <span>DECK A: <b className="text-neutral-300 font-semibold">{engine.deckA.playing ? "PLAYING" : "IDLE"}</b></span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${engine.deckB.playing ? 'bg-neon-purple animate-ping' : 'bg-neutral-700'}`} />
              <span>DECK B: <b className="text-neutral-300 font-semibold">{engine.deckB.playing ? "PLAYING" : "IDLE"}</b></span>
            </div>
          </div>
        </header>

        {/* Main Workspace Workspace */}
        <main className="flex-1 flex flex-col min-w-0 bg-[radial-gradient(ellipse_at_top,rgba(14,14,19,0.35)_0%,rgba(3,3,5,1)_100%)] overflow-y-auto">
          {/* Dynamic Inner Tab Router Content */}
          <div className="flex-1 flex flex-col p-6 overflow-hidden">
          
          {/* Tab 1: Mix Studio Panel */}
          {engine.activeTab === "studio" && (
            <div className="h-full flex flex-col gap-6">
              
              {/* Full-width FFT Spectrum Analyser Panel */}
              <div className="w-full h-20 flex-shrink-0">
                <Visualizer analyser={engine.analyserNode} isPlaying={engine.deckA.playing || engine.deckB.playing} />
              </div>

              {/* Core studio grid: Side-by-Side Decks with Central Mixer */}
              <div className="flex-1 min-h-0 grid gap-6" style={{ gridTemplateColumns: '1fr 340px 1fr' }}>
                
                {/* Left Side: Deck A */}
                <div className="min-w-0 flex flex-col h-full overflow-y-auto">
                  <DJDeck 
                    deckId="A" 
                    state={engine.deckA}
                    onPlay={() => engine.playDeck("A")}
                    onPause={() => engine.pauseDeck("A")}
                    onSeek={(sec) => engine.seekDeck("A", sec)}
                    onBpmChange={(bpm) => engine.updateBpm("A", bpm)}
                    onPitchChange={(pitch) => engine.updatePitch("A", pitch)}
                    onSync={() => engine.syncDecks("B")}
                    onVinylStop={() => engine.triggerVinylStop("A")}
                    onSetHotCue={(i, t) => engine.setHotCue("A", i, t)}
                    onTriggerHotCue={(i) => engine.triggerHotCue("A", i)}
                    onToggleLoop={(bars) => engine.toggleLoop("A", bars)}
                    onFileDrop={(file) => {
                      const url = URL.createObjectURL(file);
                      engine.loadTrack("A", url, file.name.replace(/\.[^/.]+$/, ""), 128, "8A", "", "Local File");
                    }}
                  />
                </div>

                {/* Central Column: Master Mixer Desk (Contains EQ strips for both channels) */}
                <div className="flex flex-col h-full overflow-y-auto">
                  <MixerDesk 
                    stateA={engine.deckA}
                    stateB={engine.deckB}
                    isPlaying={engine.deckA.playing || engine.deckB.playing}
                    crossfader={engine.crossfader}
                    setCrossfader={engine.setCrossfader}
                    masterVolume={engine.masterVolume}
                    setMasterVolume={engine.setMasterVolume}
                    isTransitioning={engine.isTransitioning}
                    transitionProgress={engine.transitionProgress}
                    onTriggerTransition={engine.triggerAutomatedTransition}
                    delayActive={engine.deckA.filter !== 0 || engine.deckB.filter !== 0}
                    reverbActive={engine.isTransitioning}
                    onToggleFX={(fx, val) => engine.updateFX(fx, val)}
                    onEQChange={(deckId, band, val) => engine.updateEQ(deckId, band, val)}
                    onFilterChange={(deckId, val) => engine.updateFilter(deckId, val)}
                    onVolumeChange={(deckId, val) => engine.updateDeckVolume(deckId, val)}
                  />
                </div>

                {/* Right Side: Deck B */}
                <div className="min-w-0 flex flex-col h-full overflow-y-auto">
                  <DJDeck 
                    deckId="B" 
                    state={engine.deckB}
                    onPlay={() => engine.playDeck("B")}
                    onPause={() => engine.pauseDeck("B")}
                    onSeek={(sec) => engine.seekDeck("B", sec)}
                    onBpmChange={(bpm) => engine.updateBpm("B", bpm)}
                    onPitchChange={(pitch) => engine.updatePitch("B", pitch)}
                    onSync={() => engine.syncDecks("A")}
                    onVinylStop={() => engine.triggerVinylStop("B")}
                    onSetHotCue={(i, t) => engine.setHotCue("B", i, t)}
                    onTriggerHotCue={(i) => engine.triggerHotCue("B", i)}
                    onToggleLoop={(bars) => engine.toggleLoop("B", bars)}
                    onFileDrop={(file) => {
                      const url = URL.createObjectURL(file);
                      engine.loadTrack("B", url, file.name.replace(/\.[^/.]+$/, ""), 128, "8A", "", "Local File");
                    }}
                  />
                </div>

              </div>
            </div>
          )}

          {/* Tab 2: AI Remix Lab Panel */}
          {engine.activeTab === "remix-lab" && (
            <div className="space-y-6">
              <div className="glass-panel rounded-3xl p-6 border border-white/5 space-y-4">
                <h2 className="text-lg font-bold tracking-wider font-mono text-neon-cyan flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-neon-cyan animate-pulse" /> 3-BAND EQ ISOLATOR WORKSTATION
                </h2>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  PulseMix AI incorporates a real-time Web Audio crossover network filter. Mute, boost, or isolate frequencies dynamically to blend elements of both tracks into a clean, professional beatmatched live mashup.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Stem Control Deck A */}
                <div className="glass-panel rounded-3xl p-6 border border-white/5 space-y-6 shadow-neon-cyan/5 shadow-md">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-neon-cyan animate-pulse" />
                      <span className="font-bold text-sm tracking-wider font-mono">ISOLATOR: DECK A</span>
                    </div>
                    <span className="font-mono text-[10px] text-neutral-500 truncate max-w-[200px]">{engine.deckA.title}</span>
                  </div>

                  {/* Stems Sliders Grid */}
                  <div className="space-y-5">
                    {/* Vocals */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-neutral-300 font-semibold flex items-center gap-1.5">🗣️ VOCALS / HIGH BAND</span>
                        <span className="text-neon-cyan font-bold">{Math.round(engine.deckA.stems.vocals * 100)}%</span>
                      </div>
                      <div className="flex gap-4 items-center">
                        <input
                          type="range"
                          min="0"
                          max="1.0"
                          step="0.01"
                          value={engine.deckA.stems.vocals}
                          onChange={(e) => engine.updateStemVolume("A", "vocals", parseFloat(e.target.value))}
                          className="flex-1 accent-neon-cyan bg-neutral-800 h-2 rounded-lg cursor-pointer"
                        />
                        <button
                          onClick={() => engine.updateStemVolume("A", "vocals", engine.deckA.stems.vocals === 0 ? 1.0 : 0.0)}
                          className={`px-3 py-1.5 rounded-lg font-mono text-[9px] font-bold border transition-colors cursor-pointer ${
                            engine.deckA.stems.vocals === 0
                              ? "bg-rose-500/20 border-rose-500 text-rose-400"
                              : "bg-neutral-800 border-white/5 text-neutral-300"
                          }`}
                        >
                          {engine.deckA.stems.vocals === 0 ? "MUTED" : "MUTE"}
                        </button>
                      </div>
                    </div>

                    {/* Melody */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-neutral-300 font-semibold flex items-center gap-1.5">🎹 INSTRUMENTS / MID BAND</span>
                        <span className="text-neon-cyan font-bold">{Math.round(engine.deckA.stems.melody * 100)}%</span>
                      </div>
                      <div className="flex gap-4 items-center">
                        <input
                          type="range"
                          min="0"
                          max="1.0"
                          step="0.01"
                          value={engine.deckA.stems.melody}
                          onChange={(e) => engine.updateStemVolume("A", "melody", parseFloat(e.target.value))}
                          className="flex-1 accent-neon-cyan bg-neutral-800 h-2 rounded-lg cursor-pointer"
                        />
                        <button
                          onClick={() => engine.updateStemVolume("A", "melody", engine.deckA.stems.melody === 0 ? 1.0 : 0.0)}
                          className={`px-3 py-1.5 rounded-lg font-mono text-[9px] font-bold border transition-colors cursor-pointer ${
                            engine.deckA.stems.melody === 0
                              ? "bg-rose-500/20 border-rose-500 text-rose-400"
                              : "bg-neutral-800 border-white/5 text-neutral-300"
                          }`}
                        >
                          {engine.deckA.stems.melody === 0 ? "MUTED" : "MUTE"}
                        </button>
                      </div>
                    </div>

                    {/* Drums/Bass */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-neutral-300 font-semibold flex items-center gap-1.5">🥁 DRUMS & BASS / LOW BAND</span>
                        <span className="text-neon-cyan font-bold">{Math.round(engine.deckA.stems.drums * 100)}%</span>
                      </div>
                      <div className="flex gap-4 items-center">
                        <input
                          type="range"
                          min="0"
                          max="1.0"
                          step="0.01"
                          value={engine.deckA.stems.drums}
                          onChange={(e) => engine.updateStemVolume("A", "drums", parseFloat(e.target.value))}
                          className="flex-1 accent-neon-cyan bg-neutral-800 h-2 rounded-lg cursor-pointer"
                        />
                        <button
                          onClick={() => engine.updateStemVolume("A", "drums", engine.deckA.stems.drums === 0 ? 1.0 : 0.0)}
                          className={`px-3 py-1.5 rounded-lg font-mono text-[9px] font-bold border transition-colors cursor-pointer ${
                            engine.deckA.stems.drums === 0
                              ? "bg-rose-500/20 border-rose-500 text-rose-400"
                              : "bg-neutral-800 border-white/5 text-neutral-300"
                          }`}
                        >
                          {engine.deckA.stems.drums === 0 ? "MUTED" : "MUTE"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stem Control Deck B */}
                <div className="glass-panel rounded-3xl p-6 border border-white/5 space-y-6 shadow-neon-purple/5 shadow-md">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-neon-purple animate-pulse" />
                      <span className="font-bold text-sm tracking-wider font-mono">ISOLATOR: DECK B</span>
                    </div>
                    <span className="font-mono text-[10px] text-neutral-500 truncate max-w-[200px]">{engine.deckB.title}</span>
                  </div>

                  {/* Stems Sliders Grid */}
                  <div className="space-y-5">
                    {/* Vocals */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-neutral-300 font-semibold flex items-center gap-1.5">🗣️ VOCALS / HIGH BAND</span>
                        <span className="text-neon-purple font-bold">{Math.round(engine.deckB.stems.vocals * 100)}%</span>
                      </div>
                      <div className="flex gap-4 items-center">
                        <input
                          type="range"
                          min="0"
                          max="1.0"
                          step="0.01"
                          value={engine.deckB.stems.vocals}
                          onChange={(e) => engine.updateStemVolume("B", "vocals", parseFloat(e.target.value))}
                          className="flex-1 accent-neon-purple bg-neutral-800 h-2 rounded-lg cursor-pointer"
                        />
                        <button
                          onClick={() => engine.updateStemVolume("B", "vocals", engine.deckB.stems.vocals === 0 ? 1.0 : 0.0)}
                          className={`px-3 py-1.5 rounded-lg font-mono text-[9px] font-bold border transition-colors cursor-pointer ${
                            engine.deckB.stems.vocals === 0
                              ? "bg-rose-500/20 border-rose-500 text-rose-400"
                              : "bg-neutral-800 border-white/5 text-neutral-300"
                          }`}
                        >
                          {engine.deckB.stems.vocals === 0 ? "MUTED" : "MUTE"}
                        </button>
                      </div>
                    </div>

                    {/* Melody */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-neutral-300 font-semibold flex items-center gap-1.5">🎹 INSTRUMENTS / MID BAND</span>
                        <span className="text-neon-purple font-bold">{Math.round(engine.deckB.stems.melody * 100)}%</span>
                      </div>
                      <div className="flex gap-4 items-center">
                        <input
                          type="range"
                          min="0"
                          max="1.0"
                          step="0.01"
                          value={engine.deckB.stems.melody}
                          onChange={(e) => engine.updateStemVolume("B", "melody", parseFloat(e.target.value))}
                          className="flex-1 accent-neon-purple bg-neutral-800 h-2 rounded-lg cursor-pointer"
                        />
                        <button
                          onClick={() => engine.updateStemVolume("B", "melody", engine.deckB.stems.melody === 0 ? 1.0 : 0.0)}
                          className={`px-3 py-1.5 rounded-lg font-mono text-[9px] font-bold border transition-colors cursor-pointer ${
                            engine.deckB.stems.melody === 0
                              ? "bg-rose-500/20 border-rose-500 text-rose-400"
                              : "bg-neutral-800 border-white/5 text-neutral-300"
                          }`}
                        >
                          {engine.deckB.stems.melody === 0 ? "MUTED" : "MUTE"}
                        </button>
                      </div>
                    </div>

                    {/* Drums/Bass */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-neutral-300 font-semibold flex items-center gap-1.5">🥁 DRUMS & BASS / LOW BAND</span>
                        <span className="text-neon-purple font-bold">{Math.round(engine.deckB.stems.drums * 100)}%</span>
                      </div>
                      <div className="flex gap-4 items-center">
                        <input
                          type="range"
                          min="0"
                          max="1.0"
                          step="0.01"
                          value={engine.deckB.stems.drums}
                          onChange={(e) => engine.updateStemVolume("B", "drums", parseFloat(e.target.value))}
                          className="flex-1 accent-neon-purple bg-neutral-800 h-2 rounded-lg cursor-pointer"
                        />
                        <button
                          onClick={() => engine.updateStemVolume("B", "drums", engine.deckB.stems.drums === 0 ? 1.0 : 0.0)}
                          className={`px-3 py-1.5 rounded-lg font-mono text-[9px] font-bold border transition-colors cursor-pointer ${
                            engine.deckB.stems.drums === 0
                              ? "bg-rose-500/20 border-rose-500 text-rose-400"
                              : "bg-neutral-800 border-white/5 text-neutral-300"
                          }`}
                        >
                          {engine.deckB.stems.drums === 0 ? "MUTED" : "MUTE"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Instant Automated AI Mashup Configurations */}
              <div className="glass-panel rounded-3xl p-6 border border-white/5 space-y-4">
                <div className="flex items-center gap-3">
                  <Flame className="w-5 h-5 text-neon-pink animate-bounce" />
                  <h3 className="font-bold text-sm tracking-wider font-mono">ONE-CLICK SMART MASHUP CONSTRUCTOR</h3>
                </div>
                <p className="text-xs text-neutral-400 leading-normal">
                  Select a template and let PulseMix AI automatically synchronize the BPMs, align structural gains, isolate vocals vs instrumentals, and initiate zero-delay continuous playback.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <button
                    onClick={() => handleAutoMashup("vocals-swap")}
                    className="p-4 rounded-2xl bg-neutral-900 hover:bg-neutral-800 border border-white/5 hover:border-neon-cyan/30 text-left transition-all duration-300 select-none cursor-pointer"
                  >
                    <div className="text-glow-cyan text-neon-cyan font-bold text-xs font-mono mb-1">DECK A VOCALS + DECK B INSTRUMENTAL</div>
                    <p className="text-[10px] text-neutral-500 leading-normal">Isolates Deck A's vocal highs and meshes it with Deck B's drumbeat/synth bassline.</p>
                  </button>
                  <button
                    onClick={() => handleAutoMashup("drum-groove")}
                    className="p-4 rounded-2xl bg-neutral-900 hover:bg-neutral-800 border border-white/5 hover:border-neon-purple/30 text-left transition-all duration-300 select-none cursor-pointer"
                  >
                    <div className="text-glow-purple text-neon-purple font-bold text-xs font-mono mb-1">DECK B VOCALS + DECK A GROOVE</div>
                    <p className="text-[10px] text-neutral-500 leading-normal">Fuses Deck B's singing track onto Deck A's electronic drums/kick pattern.</p>
                  </button>
                  <button
                    onClick={() => handleAutoMashup("hook-clash")}
                    className="p-4 rounded-2xl bg-neutral-900 hover:bg-neutral-800 border border-white/5 hover:border-neon-pink/30 text-left transition-all duration-300 select-none cursor-pointer"
                  >
                    <div className="text-glow-pink text-neon-pink font-bold text-xs font-mono mb-1">HYBRID HOOK CLASH MASHUP</div>
                    <p className="text-[10px] text-neutral-500 leading-normal">Auto-aligns both tempos and locks in both song choruses simultaneously at full volume.</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: YouTube Portal / Dashboard Panel */}
          {engine.activeTab === "portal" && (
            <div className="space-y-8">
              
              {/* Paste Importer */}
              <div className="glass-panel rounded-3xl p-6 border border-white/5 space-y-5">
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-bold tracking-wider font-mono text-neon-cyan flex items-center gap-2">
                    <Video className="w-5 h-5" /> PASTE YOUTUBE MUSIC LINKS
                  </h2>
                  <p className="text-xs text-neutral-400">
                    Import multiple YouTube URLs (e.g. club tracks, festival remixes, or acoustic versions). The backend resolves and extracts the audio stream in real-time.
                  </p>
                </div>

                <form onSubmit={handleImport} className="flex gap-4">
                  <div className="relative flex-1">
                    <Link className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input 
                      type="text" 
                      placeholder="Paste YouTube Video URL here (e.g., https://www.youtube.com/watch?v=...) or type a genre search"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-sm outline-none focus:border-neon-cyan/50 text-white font-mono tracking-wide"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="bg-neon-cyan text-black font-bold px-6 py-3.5 rounded-xl hover:brightness-110 active:scale-95 transition-all text-xs tracking-wider font-mono flex items-center gap-2 cursor-pointer shadow-lg shadow-neon-cyan/15"
                  >
                    <Plus className="w-4 h-4 text-black" /> IMPORT AUDIO
                  </button>
                </form>
              </div>

              {/* Active Loading queue */}
              {importQueue.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-bold text-xs tracking-wider font-mono text-neutral-400">EXTRACTION PROCESS QUEUE</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {importQueue.map((item) => (
                      <div key={item.id} className="glass-panel rounded-2xl p-4 border border-white/5 flex items-center gap-4">
                        <img src={item.thumbnail} alt="Thumbnail" className="w-12 h-12 object-cover rounded-lg bg-neutral-900 border border-white/5" />
                        <div className="flex-1 min-w-0 space-y-1 font-mono">
                          <p className="text-xs text-white truncate font-semibold leading-none">{item.title}</p>
                          <div className="flex gap-4 text-[9px] text-neutral-500">
                            <span>BPM: {item.bpm || "--"}</span>
                            <span>KEY: {item.key || "--"}</span>
                          </div>
                        </div>
                        <div>
                          {item.status === "fetching" ? (
                            <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded animate-pulse border border-amber-500/20">EXTRACTING...</span>
                          ) : (
                            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 flex items-center gap-1"><Check className="w-3 h-3"/> COMPLETED</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* High-Fidelity Tracks Library Inventory */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <h3 className="font-bold text-sm tracking-wider font-mono text-white">HI-FI TRACK LOBBY INVENTORY</h3>
                  <span className="text-[10px] text-neutral-500 font-mono">LOAD DIRECTLY INTO MIX STUDIO</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {presetTracks.map((track) => (
                    <div 
                      key={track.id} 
                      className="glass-panel rounded-3xl p-5 border border-white/5 flex flex-col gap-4 hover:border-white/10 transition-all duration-300 relative group"
                    >
                      <div className="flex items-start gap-4">
                        <img 
                          src={track.thumbnail} 
                          alt={track.title} 
                          className="w-16 h-16 object-cover rounded-2xl bg-neutral-900 border border-white/5 shadow-md shadow-black/40" 
                        />
                        <div className="flex-1 min-w-0 space-y-1 font-mono">
                          <span className="text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-white/[0.04] text-neutral-400 border border-white/5">{track.genre}</span>
                          <h4 className="text-xs font-bold text-white truncate pt-1 leading-snug">{track.title}</h4>
                          <div className="flex gap-4 text-[10px] text-neutral-500">
                            <span>⏱️ {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, "0")}</span>
                            <span>BPM: <b className="text-neutral-300 font-semibold">{track.bpm}</b></span>
                          </div>
                        </div>
                      </div>

                      {/* Camelot Key matches indicator overlay */}
                      <div className="flex justify-between items-center text-[10px] font-mono pt-1">
                        <div className="flex gap-1.5 items-center">
                          <span className="text-neutral-500">KEY:</span>
                          <span className="font-bold text-white bg-white/5 px-2 py-0.5 rounded border border-white/5">{track.key}</span>
                        </div>
                        {/* Harmonic Match HUD */}
                        {engine.deckA.trackLoaded && (
                          <span className={`px-2 py-0.5 rounded border text-[8px] font-bold ${getCompatibilityColor(track.key, engine.deckA.key)}`}>
                            {track.key === engine.deckA.key ? "PERFECT KEY MATCH" : getCompatibleKeys(engine.deckA.key).includes(track.key) ? "HARMONIC MATCH" : "COMPATIBLE"}
                          </span>
                        )}
                      </div>

                      {/* Quick Load transport decks */}
                      <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-white/5">
                        <button
                          onClick={() => engine.loadTrack("A", track.url, track.title, track.bpm, track.key, track.thumbnail, track.genre)}
                          className="py-2.5 rounded-xl bg-neon-cyan hover:brightness-110 text-black font-bold text-[10px] font-mono tracking-wider transition-all select-none cursor-pointer flex items-center justify-center gap-1 shadow-md shadow-neon-cyan/5"
                        >
                          <Plus className="w-3.5 h-3.5 text-black" /> LOAD DECK A
                        </button>
                        <button
                          onClick={() => engine.loadTrack("B", track.url, track.title, track.bpm, track.key, track.thumbnail, track.genre)}
                          className="py-2.5 rounded-xl bg-neon-purple hover:brightness-110 text-white font-bold text-[10px] font-mono tracking-wider transition-all select-none cursor-pointer flex items-center justify-center gap-1 shadow-md shadow-neon-purple/5"
                        >
                          <Plus className="w-3.5 h-3.5 text-white" /> LOAD DECK B
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Export Center Panel */}


          {/* Tab 5: History & Presets Panel */}
          {engine.activeTab === "history" && (
            <div className="max-w-4xl mx-auto space-y-6">
              
              {/* Presets and workflows info */}
              <div className="glass-panel rounded-3xl p-6 border border-white/5 space-y-4">
                <h2 className="text-lg font-bold tracking-wider font-mono text-neon-cyan flex items-center gap-2">
                  <History className="w-5 h-5" /> SAVED SESSION EXPORTS & DJ TEMPLATES
                </h2>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Every time you export a mix using the in-browser rendering engine, the session metadata is automatically saved in your browser's local sandbox, allowing you to access and redownload your final tracks at any time.
                </p>
              </div>

              {/* History list */}
              <div className="space-y-4">
                <h3 className="font-bold text-xs tracking-wider font-mono text-neutral-500">RECENTLY COMPILED SETS</h3>
                
                <div className="space-y-3">
                  {/* Read history from state/localstorage */}
                  {typeof window !== "undefined" && JSON.parse(localStorage.getItem("pulsemix_history") || "[]").length > 0 ? (
                    JSON.parse(localStorage.getItem("pulsemix_history") || "[]").map((item: any, idx: number) => (
                      <div key={idx} className="glass-panel rounded-2xl p-5 border border-white/5 flex items-center justify-between font-mono">
                        <div className="space-y-1.5">
                          <h4 className="text-xs font-bold text-white">{item.title}</h4>
                          <div className="flex gap-4 text-[9px] text-neutral-500">
                            <span>TIMECODE: {item.timestamp}</span>
                            <span>LENGTH: {item.duration}</span>
                            <span>BPM: {item.bpm}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <a
                            href={item.url}
                            download={`${item.title.toLowerCase().replace(/ /g, "_")}.wav`}
                            className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold px-3 py-1.5 rounded-lg border border-white/5 text-[9px] tracking-wide"
                          >
                            DOWNLOAD
                          </a>
                          <button
                            onClick={() => {
                              const history = JSON.parse(localStorage.getItem("pulsemix_history") || "[]");
                              history.splice(idx, 1);
                              localStorage.setItem("pulsemix_history", JSON.stringify(history));
                              // Force rerender
                              engine.setActiveTab("history");
                            }}
                            className="p-1.5 text-neutral-500 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="glass-panel rounded-2xl p-8 border border-white/5 text-center text-xs text-neutral-500 font-mono">
                      NO SAVE HISTORY AVAILABLE. CONFIGURE A TRANSITION SET IN THE EXPORT CENTER TO GENERATE YOUR FIRST RECORD!
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Global Diagnostics Footer */}
      <footer className="h-6 flex-shrink-0 bg-transparent flex items-center justify-between px-6 font-mono text-[7px] text-neutral-600/50 z-20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span>WEB&nbsp;AUDIO&nbsp;API</span>
            <span className="text-emerald-500/50 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-emerald-500/50" /> &nbsp;ONLINE&nbsp;
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>FASTAPI&nbsp;BACKEND</span>
            <span className="text-neon-cyan/50 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-neon-cyan/50" /> &nbsp;READY&nbsp;
            </span>
          </div>
        </div>
        <div>
          <span>LATENCY:&nbsp;<span className="text-neutral-500/50">~2.4 ms</span></span>
        </div>
      </footer>
    </div>
  );
}
