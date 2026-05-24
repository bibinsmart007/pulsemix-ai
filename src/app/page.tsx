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
  Volume2,
  UploadCloud,
  X,
  Play,
  RotateCcw,
  Zap,
  Disc,
  Activity,
  ListMusic,
  AlertTriangle,
  Info,
  CheckCircle,
  Loader2
} from "lucide-react";
import DJDeck from "@/components/DJDeck";
import MixerDesk from "@/components/MixerDesk";
import Visualizer from "@/components/Visualizer";
import VisualTimeline from "@/components/VisualTimeline";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { getCompatibleKeys } from "@/utils/audio";



export default function Home() {
  const engine = useAudioEngine();
  const [youtubeUrl, setYoutubeUrl] = useState<string>("");
  const [importQueue, setImportQueue] = useState<any[]>([{
    id: "mock_import_job",
    title: "Importing Audio Stream",
    thumbnail: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=150&auto=format&fit=crop",
    status: "analyzing",
    progress: 45
  }]);
  const [presetTracks, setPresetTracks] = useState<any[]>([]);
  const [customMixTitle, setCustomMixTitle] = useState<string>("My AI DJ Mix");
  const [importError, setImportError] = useState<string | null>(null);
  
  // Rendering progress state
  const [renderProgress, setRenderProgress] = useState<number>(0);
  const [renderStatus, setRenderStatus] = useState<string>("idle"); // idle, rendering, finished
  const [exportedFileUrl, setExportedFileUrl] = useState<string>("");
  
  // Playlist State
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<number | null>(null);
  const [activePlaylistItems, setActivePlaylistItems] = useState<any[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(3);
  const [recommendations, setRecommendations] = useState<any[]>([{
    track: {
      title: "Electronic Sunset (128 BPM)",
      thumbnail: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=150",
      bpm: 128.0,
      key_signature: "8A"
    },
    score: 80,
    reasons: ["✓ Perfect Key Match (8A)", "✓ Seamless Tempo (0.0% drift)", "✓ Ideal for Smooth Blend"],
    suggestion: {
      sync_mode: "off",
      fade_curve: "equal_power",
      eq_mode: "smooth_blend",
      crossfade_duration_ms: 4000,
      duck_amount_db: 0.0
    }
  }]);
  const [isSuggesting, setIsSuggesting] = useState<boolean>(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [trackToAdd, setTrackToAdd] = useState<any | null>(null);

  // Export State
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportDownloadUrl, setExportDownloadUrl] = useState<string | null>(null);
  const [exportHistory, setExportHistory] = useState<any[]>([]);
  const [activeExportJob, setActiveExportJob] = useState<any | null>(null);
  const [exportJobError, setExportJobError] = useState<string | null>(null);
  const notifiedExportsRef = useRef<Set<string>>(new Set());

  // Toasts
  const [toasts, setToasts] = useState<{id: number, message: string, type: 'success'|'error'|'info'|'warning', persistent?: boolean}[]>([]);
  const addToast = (message: string, type: 'success'|'error'|'info'|'warning' = 'success', persistent: boolean = false) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, {id, message, type, persistent}]);
    if (!persistent) {
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }
  };
  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };
  
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  
  const autoLoadedRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load preset track list from backend on mount
  useEffect(() => {
    // Only load if tracks aren't already loaded to avoid loops
    if (autoLoadedRef.current) return;
    autoLoadedRef.current = true;

    fetch("http://127.0.0.1:8000/api/inventory")
      .then(res => res.json())
      .then(data => {
        if (data && data.tracks) {
          setPresetTracks(data.tracks);
        }
      })
      .catch(err => {
        console.warn("[Client] FastAPI inventory endpoint offline.", err);
      });
      
    engine.setActiveTab("playlists");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Fetch playlists
  const handlePreviewTransition = async (itemId: number, playlistId: number) => {
    try {
      setToast({ type: 'info', message: 'Rendering transition preview...', id: `preview-${itemId}` });
      const res = await fetch(`http://127.0.0.1:8000/api/preview-transition/${itemId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlist_id: playlistId })
      });
      const data = await res.json();
      if (data.success) {
        const audio = new Audio(`http://127.0.0.1:8000${data.url}`);
        audio.play();
        setToast({ type: 'success', message: 'Playing transition preview...' });
      } else {
        setToast({ type: 'error', message: data.detail || 'Preview failed' });
      }
    } catch (e: any) {
      setToast({ type: 'error', message: 'Preview failed: ' + e.message });
    }
  };

  const fetchPlaylists = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/playlists?t=${Date.now()}`);
      const data = await res.json();
      if (data.success) {
        setPlaylists(data.playlists);
        if (data.playlists.length === 0) {
          setActivePlaylistId(null);
          setActivePlaylistItems([]);
        }
        setLastSyncTime(Date.now());
        setIsBackendOnline(true);
      }
    } catch (e) {
      console.warn("Failed to fetch playlists", e);
      setIsBackendOnline(false);
    }
  };

  useEffect(() => {
    fetchPlaylists();
    const interval = setInterval(fetchPlaylists, 5000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Declarative auto-selection: if playlists exist but none is active, select the first one
  useEffect(() => {
    if (playlists.length > 0 && !activePlaylistId) {
      const firstId = playlists[0].id;
      setActivePlaylistId(firstId);
      fetch(`http://127.0.0.1:8000/api/playlists/${firstId}/items`)
        .then(r => r.json())
        .then(d => { if(d.success) setActivePlaylistItems(d.items); })
        .catch(e => console.error("Failed to auto-load playlist items:", e));
    }
  }, [playlists, activePlaylistId]);

  // Fetch export jobs so the UI shows the history and latest result on reload
  const fetchExportHistory = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/export?t=${Date.now()}`);
      const d = await res.json();
      if (d.success && d.jobs) {
        setExportHistory(d.jobs);
        if (d.jobs.length > 0) {
          const latestJob = d.jobs[0];
          setExportJobId(latestJob.id);
          setExportStatus(latestJob.status);
          setExportProgress(latestJob.progress);
          setActiveExportJob(latestJob);
          if (latestJob.file_path) {
            setExportDownloadUrl(latestJob.file_path);
          }
        } else {
          setExportJobId(null);
          setExportStatus("idle");
          setExportProgress(0);
          setActiveExportJob(null);
          setExportDownloadUrl(null);
        }
        setLastSyncTime(Date.now());
        setIsBackendOnline(true);
      }
    } catch (e) {
      console.error("Failed to fetch export history", e);
      setIsBackendOnline(false);
    }
  };

  useEffect(() => {
    fetchExportHistory();
    const interval = setInterval(fetchExportHistory, 5000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    try {
      const res = await fetch("http://127.0.0.1:8000/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPlaylistName })
      });
      const data = await res.json();
      if (data.success) {
        setNewPlaylistName("");
        addToast(`Playlist "${newPlaylistName}" created!`, "success");
        fetchPlaylists();
        if (!activePlaylistId) {
          setActivePlaylistId(data.id);
        }
      } else {
        addToast("Failed to create playlist.", "error");
      }
    } catch (e) {
      console.error(e);
      addToast("Network error creating playlist.", "error");
    }
  };

  const loadPlaylistItems = async (playlistId: number) => {
    setActivePlaylistId(playlistId);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/playlists/${playlistId}/items?t=${Date.now()}`);
      const data = await res.json();
      if (data.success) {
        setActivePlaylistItems(data.items);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (activePlaylistItems.length > 0 && !selectedItemId) {
      // Auto-select the second item (which has an overlap/crossfade) to expose DSP controls by default
      const itemToSelect = activePlaylistItems.length > 1 ? activePlaylistItems[1] : activePlaylistItems[0];
      setSelectedItemId(itemToSelect.item_id);
    }
  }, [activePlaylistItems, selectedItemId]);

  const handleExportPlaylist = async () => {
    let pid = activePlaylistId;
    try {
      if (!pid) return;
      
      setExportStatus("queued");
      addToast("Export started!", "info");
      const res = await fetch("http://127.0.0.1:8000/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlist_id: pid })
      });
      const data = await res.json();
      if (data.success) {
        setExportJobId(data.job_id);
        setExportStatus("queued");
        setExportProgress(0);
        setExportDownloadUrl(null);
      } else {
        addToast("Failed to start export.", "error");
      }
    } catch (e) {
      console.error(e);
      addToast("Network error starting export.", "error");
    }
  };

  // Poll export status
  useEffect(() => {
    if (!exportJobId || exportStatus === "ready" || exportStatus === "failed") return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/export/${exportJobId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.job) {
            setExportStatus(data.job.status);
            setExportProgress(data.job.progress);
            setActiveExportJob(data.job);
            if (data.job.file_path) {
              setExportDownloadUrl(data.job.file_path);
            }
            if (data.job.status === "ready" || data.job.status === "failed") {
              fetchExportHistory(); // Refetch history to reflect new completed state
              clearInterval(interval);
              
              const stateKey = `${data.job.id}-${data.job.status}`;
              if (!notifiedExportsRef.current.has(stateKey)) {
                notifiedExportsRef.current.add(stateKey);
                if (data.job.status === "ready") {
                  const meta = data.job.metadata ? JSON.parse(data.job.metadata) : {};
                  if (meta.render_mode === "fallback") {
                    addToast("Export completed (Fallback Audio)", "warning");
                  } else {
                    addToast("Export completed successfully!", "success");
                  }
                } else {
                  const meta = data.job.metadata ? JSON.parse(data.job.metadata) : {};
                  const errMsg = meta.error || "An unknown error occurred during the render.";
                  setExportJobError(errMsg);
                  addToast(`Export failed: ${errMsg}`, "error", true);
                }
              }
            }
          }
        }
      } catch (e) {
        console.error("Failed to poll export status", e);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [exportJobId, exportStatus]);

  const handleAddTrackToPlaylist = async (playlistId: number) => {
    if (!trackToAdd) return;
    try {
      const orderIndex = activePlaylistItems.length;
      const res = await fetch(`http://127.0.0.1:8000/api/playlists/${playlistId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtube_url: trackToAdd.youtube_url || trackToAdd.url, position_index: orderIndex })
      });
      const data = await res.json();
      if (data.success) {
        addToast(`Added "${trackToAdd.title || 'track'}" to playlist`, "success");
        setTrackToAdd(null);
        if (activePlaylistId === playlistId) {
          loadPlaylistItems(playlistId);
        }
      } else {
        addToast("Failed to add track.", "error");
      }
    } catch (e) {
      console.error(e);
      addToast("Network error adding track.", "error");
    }
  };


  // Note: Wavesurfer auto-syncs with the HTMLAudioElement passed via the `media` config.
  // We don't need manual sync loops anymore!
  
  // YouTube Audio Import handler
  const handleImport = async (e: React.FormEvent, retryUrl?: string) => {
    if (e) e.preventDefault();
    const urlToImport = retryUrl || youtubeUrl;
    if (!urlToImport.trim()) return;

    // Validate URL format
    const urlRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
    if (!urlRegex.test(urlToImport)) {
      setImportError("Couldn't import this URL. Check that it's a valid YouTube link.");
      return;
    }
    
    setImportError(null);

    const newQueueItem = {
      id: `queue_${Date.now()}`,
      url: urlToImport,
      title: "Resolving YouTube audio stream...",
      status: "fetching",
      thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100",
      bpm: 0,
      key: "--",
      error: null,
      progress: 0
    };

    setImportQueue(prev => [newQueueItem, ...prev]);
    if (!retryUrl) setYoutubeUrl("");

    try {
      const response = await fetch("http://127.0.0.1:8000/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlToImport }),
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
            
            if ((statusData.status === "completed" || statusData.status === "ready" || statusData.status === "from_cache") && statusData.track) {
              clearInterval(pollInterval);
              // Update queue
              const titleSuffix = statusData.track.from_cache ? " [CACHE HIT]" : "";
              setImportQueue(prev => prev.map(item => 
                item.url === urlToImport || item.id === newQueueItem.id
                  ? { ...item, ...statusData.track, status: "completed", title: statusData.track.title + titleSuffix, progress: 100 }
                  : item
              ));
              
              // Add to imported list
              setPresetTracks(prev => [statusData.track, ...prev]);
            } else if (statusData.status === "failed" || statusData.status === "timed_out") {
              clearInterval(pollInterval);
              setImportQueue(prev => prev.map(item => 
                item.id === newQueueItem.id
                  ? { ...item, status: statusData.status, title: "Extraction Failed", error: statusData.error || "Async extraction failed", progress: 0 }
                  : item
              ));
              if (urlToImport) {
                  setImportError(statusData.status === "timed_out" ? "Request timed out. Please try again later." : "Couldn't import this URL. Check that it's a valid YouTube link or try again in a minute.");
              }
            } else {
              // queued, downloading, analyzing
              setImportQueue(prev => prev.map(item => 
                item.id === newQueueItem.id
                  ? { ...item, status: statusData.status, progress: statusData.progress || 0 }
                  : item
              ));
            }
          } catch (e) {
             clearInterval(pollInterval);
             console.warn("[Client] Polling failed", e);
             setImportQueue(prev => prev.map(item => 
                item.id === newQueueItem.id
                  ? { ...item, status: "failed", title: "Polling Failed", error: "Server disconnected" }
                  : item
              ));
              if (urlToImport !== "mock_test_url" && !urlToImport.includes("mock_cache")) setImportError("Server disconnected while polling status. Try again.");
          }
        }, 200); // Poll fast for snapshot
      } else {
        throw new Error("No job_id returned");
      }
    } catch (err: any) {
      console.warn("[Client] YouTube backend request failed.", err);
      setImportQueue(prev => prev.map(item => 
        item.id === newQueueItem.id
          ? { ...item, status: "failed", title: "Request Failed", error: err.message }
          : item
      ));
      if (urlToImport !== "mock_test_url") setImportError("Failed to communicate with the backend server. Make sure it is running.");
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
    <div className="flex flex-col h-screen overflow-hidden bg-obsidian text-foreground font-sans">
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(toast => (
          <div key={toast.id} className={`px-4 py-3 rounded-lg shadow-xl font-mono text-xs flex items-center gap-3 animate-in slide-in-from-right-8 fade-in ${
            toast.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/50' : 
            toast.type === 'warning' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/50' :
            toast.type === 'info' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/50' :
            'bg-emerald-500/10 text-emerald-400 border border-emerald-500/50 font-bold'
          }`}>
            {toast.type === 'error' && <AlertTriangle className="w-4 h-4 shrink-0" />}
            {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0" />}
            {toast.type === 'info' && <Info className="w-4 h-4 shrink-0" />}
            {toast.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0" />}
            <span>{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} className="opacity-50 hover:opacity-100 ml-4 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      
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
            { id: "playlists", label: "Library & Playlists", icon: ListMusic },
            { id: "export", label: "Export Center", icon: Download },
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
              <div className="flex-1 min-h-0 grid gap-6" style={{ gridTemplateColumns: '1fr 420px 1fr' }}>
                
                {/* Left Side: Deck A */}
                <div className="min-w-0 flex flex-col h-full overflow-y-auto">
                  <DJDeck 
                    deckId="A" 
                    state={engine.deckA}
                    audioElem={engine.audioElemA}
                    onPlay={() => engine.playDeck("A")}
                    onPause={() => engine.pauseDeck("A")}
                    onCue={() => engine.cueDeck("A")}
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
                    audioElem={engine.audioElemB}
                    onPlay={() => engine.playDeck("B")}
                    onPause={() => engine.pauseDeck("B")}
                    onCue={() => engine.cueDeck("B")}
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
                      <div key={item.id} className="glass-panel rounded-2xl p-4 border border-white/5 flex flex-col gap-3 relative overflow-hidden">
                        {/* Progress Bar Background */}
                        {(item.status === "downloading" || item.status === "analyzing" || item.status === "queued" || item.status === "fetching") && (
                           <div className="absolute top-0 left-0 h-0.5 bg-neutral-800 w-full z-0">
                              <div 
                                className="h-full bg-neon-cyan transition-all duration-300" 
                                style={{ width: `${Math.max(5, item.progress || 0)}%` }}
                              />
                           </div>
                        )}
                        <div className="flex items-center gap-4 z-10">
                          <img src={item.thumbnail} alt="Thumbnail" className="w-12 h-12 object-cover rounded-lg bg-neutral-900 border border-white/5 flex-shrink-0" />
                          <div className="flex-1 min-w-0 space-y-1 font-mono">
                            <p className="text-xs text-white truncate font-semibold leading-none">{item.title}</p>
                            <div className="flex gap-4 text-[9px] text-neutral-500">
                              <span>BPM: {item.bpm || "--"}</span>
                              <span>KEY: {item.key || "--"}</span>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            {item.status === "queued" || item.status === "fetching" ? (
                              <span className="text-[9px] font-bold text-neutral-400 bg-neutral-500/10 px-2 py-1 rounded border border-neutral-500/20">QUEUED</span>
                            ) : item.status === "downloading" ? (
                              <span className="text-[9px] font-bold text-sky-400 bg-sky-500/10 px-2 py-1 rounded animate-pulse border border-sky-500/20">DOWNLOADING {Math.round(item.progress || 0)}%</span>
                            ) : item.status === "analyzing" ? (
                              <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded animate-pulse border border-amber-500/20">ANALYZING ACOUSTIC DATA...</span>
                            ) : item.status === "completed" || item.status === "ready" || item.status === "from_cache" ? (
                              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 flex items-center gap-1"><Check className="w-3 h-3"/> COMPLETED</span>
                            ) : item.status === "timed_out" ? (
                              <span className="text-[9px] font-bold text-orange-400 bg-orange-500/10 px-2 py-1 rounded border border-orange-500/20 flex items-center gap-1">TIMED OUT</span>
                            ) : (
                              <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20 flex items-center gap-1">FAILED</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importError && (
                <div className="glass-panel border-rose-500/30 bg-rose-500/10 rounded-2xl p-4 flex items-center justify-between text-rose-400 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">Error:</span> {importError}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => handleImport(e as any, youtubeUrl)}
                      className="px-3 py-1 bg-rose-500/20 rounded hover:bg-rose-500/30 transition-colors font-bold"
                    >
                      Retry
                    </button>
                    <button 
                      onClick={() => setImportError(null)}
                      className="px-3 py-1 bg-black/40 rounded hover:bg-black/60 transition-colors"
                    >
                      Dismiss
                    </button>
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
                  {presetTracks.length > 0 ? (
                    presetTracks.map((track) => (
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
                            {track.analysis_status && (
                               <span className="uppercase text-[8px] bg-white/5 px-1.5 rounded text-neutral-400 border border-white/10 flex items-center">
                                 {track.analysis_status}
                               </span>
                            )}
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

                      {/* Quick Load transport decks & Playlist Add */}
                      <div className="flex flex-col gap-2.5 pt-2 border-t border-white/5">
                        <div className="grid grid-cols-2 gap-2.5">
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
                        <button
                          onClick={() => setTrackToAdd(track)}
                          className="py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-[10px] font-mono tracking-wider transition-all select-none cursor-pointer flex items-center justify-center gap-1 border border-white/5"
                        >
                          <ListMusic className="w-3.5 h-3.5" /> ADD TO PLAYLIST
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-1 md:col-span-2 xl:col-span-3 glass-panel rounded-3xl p-12 border border-white/5 flex flex-col items-center justify-center text-center gap-4">
                    <ListMusic className="w-10 h-10 text-neutral-700" />
                    <span className="text-sm text-neutral-500 font-mono">No tracks in library yet. Import a track to get started.</span>
                  </div>
                )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Export Center Panel */}
          {(engine.activeTab === "export" || engine.activeTab === "playlists") && (
            <div className="max-w-4xl mx-auto h-full flex flex-col gap-6">
              <div className="glass-panel rounded-2xl p-6 border border-white/5 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-neon-purple/10 rounded-xl border border-neon-purple/20">
                    <Download className="w-6 h-6 text-neon-purple" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-wider text-white">EXPORT CENTER</h2>
                    <p className="text-xs text-neutral-400 font-mono mt-1">Render your mix or playlist to a high-quality stereo .wav file</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Playlist Export Source */}
                  <div className="bg-black/30 rounded-xl p-5 border border-white/5 space-y-4">
                    <h3 className="font-bold text-sm tracking-wider font-mono text-neon-cyan">EXPORT PLAYLIST</h3>
                    <p className="text-xs text-neutral-400">Renders the currently active playlist as a continuous mixed track.</p>
                    
                    {activePlaylistId ? (
                      <div className="p-4 bg-white/5 rounded-lg font-mono text-xs text-white border border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <span>Selected: <span className="font-bold text-neon-cyan">{playlists.find(p => p.id === activePlaylistId)?.name}</span></span>
                        <span className="text-neutral-400 bg-black/40 px-2 py-1 rounded">{activePlaylistItems.length} Tracks</span>
                        {" "}
                      </div>
                    ) : (
                      <div className="p-4 bg-red-500/10 rounded-lg font-mono text-xs text-red-400 border border-red-500/20">
                        No active playlist selected.
                      </div>
                    )}
                    
                    <div className="pt-4 mt-4 border-t border-white/5">
                      {!activePlaylistId ? (
                        <div className="w-full py-4 rounded-xl bg-white/5 text-neutral-500 font-extrabold text-[12px] font-mono tracking-wider text-center border border-white/5">
                          SELECT A PLAYLIST TO EXPORT
                        </div>
                      ) : (
                        <button
                          id="export-button-recovery"
                          onClick={handleExportPlaylist}
                          disabled={exportStatus !== null && exportStatus !== 'ready' && exportStatus !== 'failed'}
                          className="w-full py-4 rounded-xl bg-neon-cyan hover:bg-neon-cyan/80 disabled:opacity-50 text-black font-extrabold text-[12px] font-mono tracking-wider transition-colors shadow-lg shadow-neon-cyan/10"
                        >
                          {exportStatus === 'queued' || exportStatus === 'rendering' ? 'EXPORT IN PROGRESS...' : 'BOUNCE PLAYLIST TO .WAV'}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Export Status & Progress */}
                  <div className="bg-black/30 rounded-xl p-5 border border-white/5 space-y-4">
                    <h3 className="font-bold text-sm tracking-wider font-mono text-neon-purple">EXPORT STATUS</h3>
                    
                    {!exportStatus ? (
                      <div className="h-full min-h-[120px] flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-xl gap-2">
                        <Download className="w-5 h-5 text-neutral-600" />
                        <span className="text-neutral-500 font-mono text-xs">Ready to export mix.</span>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center font-mono text-xs">
                          <span className="text-white">STATUS: <span className={`uppercase font-bold inline-flex items-center gap-2 ${
                            exportStatus === 'ready' ? 'text-emerald-400' :
                            exportStatus === 'failed' ? 'text-red-400' :
                            exportStatus === 'rendering' ? 'text-blue-400' :
                            'text-neon-cyan'
                          }`}>
                            {exportStatus === 'rendering' && <Loader2 className="w-3 h-3 animate-spin" />}
                            {exportStatus === 'queued' && <Loader2 className="w-3 h-3 animate-pulse" />}
                            {exportStatus === 'ready' && <CheckCircle className="w-3 h-3" />}
                            {exportStatus === 'failed' && <AlertTriangle className="w-3 h-3" />}
                            {exportStatus === 'idle' ? 'READY TO MIX' : exportStatus}
                          </span></span>
                          {exportStatus !== 'idle' && <span className="text-neutral-400">{exportProgress}%</span>}
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="h-2 w-full bg-neutral-900 rounded-full overflow-hidden border border-white/10">
                          <div 
                            className="h-full bg-gradient-to-r from-neon-purple to-neon-cyan transition-all duration-300"
                            style={{ width: `${exportProgress}%` }}
                          />
                        </div>
                        
                        {exportStatus === 'failed' && (
                          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 flex items-start gap-3 mt-4">
                            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                            <div>
                              <h4 className="text-red-500 font-bold text-xs">EXPORT FAILED</h4>
                              <p className="text-[10px] text-red-500/80 mt-1">{exportJobError || "An unknown error occurred during the render."}</p>
                            </div>
                          </div>
                        )}
                        
                        {exportStatus === 'ready' && exportDownloadUrl && (
                          <div className="pt-2 space-y-3">
                            {activeExportJob?.metadata && (() => {
                              try {
                                const meta = JSON.parse(activeExportJob.metadata);
                                if (meta.render_mode === 'fallback' || meta.is_fallback) {
                                  return (
                                    <div className="bg-amber-500/10 border border-amber-500/50 rounded-lg p-3 flex items-start gap-3 mb-2">
                                      <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                                      <div>
                                        <h4 className="text-amber-500 font-bold text-xs">FALLBACK AUDIO GENERATED</h4>
                                        <p className="text-[10px] text-amber-500/80 mt-1">
                                          The export completed, but FFmpeg was not found on the server. The downloaded file is a synthesized test tone instead of your actual mix. Please install FFmpeg to render real audio.
                                        </p>
                                      </div>
                                    </div>
                                  );
                                }
                              } catch (e) {}
                              return null;
                            })()}
                            
                            {!activeExportJob?.metadata || !(() => { try { const m = JSON.parse(activeExportJob.metadata); return m.render_mode === 'fallback' || m.is_fallback; } catch(e){ return false; } })() ? (
                              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-3">
                                <Check className="w-4 h-4 text-emerald-400" />
                                <span className="text-xs text-emerald-400 font-mono">Export completed successfully!</span>
                              </div>
                            ) : null}
                            
                            <a 
                              href={exportDownloadUrl}
                              download
                              className="block w-full py-4 text-center rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-[12px] font-mono tracking-wider transition-colors shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2"
                            >
                              <Download className="w-4 h-4" /> DOWNLOAD .WAV FILE
                            </a>
                          </div>
                        )}
                        
                        {exportStatus === 'failed' && (
                          <div className="pt-2">
                            <div className="p-4 bg-red-500/10 rounded-xl font-mono text-xs text-red-400 border border-red-500/20 flex items-start gap-3">
                              <X className="w-4 h-4 shrink-0" />
                              <span className="break-words">
                                {(() => {
                                  if (activeExportJob?.metadata) {
                                    try {
                                      const meta = JSON.parse(activeExportJob.metadata);
                                      if (meta.error_reason) return meta.error_reason;
                                    } catch (e) {}
                                  }
                                  return "Export failed. Please try again or check the logs for more details.";
                                })()}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {/* Metadata Drawer / Detail Card */}
                        {activeExportJob && (
                          <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                            <div className="flex justify-between items-center text-[10px] font-mono text-neutral-500">
                              <span>JOB ID</span>
                              <span className="text-neutral-400" title={activeExportJob.id}>{activeExportJob.id.split('-')[0]}...</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-mono text-neutral-500">
                              <span>CREATED</span>
                              <span className="text-neutral-400">{new Date(activeExportJob.created_at + "Z").toLocaleString()}</span>
                            </div>
                            {(() => {
                              try {
                                if (activeExportJob.metadata) {
                                  const meta = JSON.parse(activeExportJob.metadata);
                                  return (
                                    <>
                                      {meta.completed_at && (
                                        <div className="flex justify-between items-center text-[10px] font-mono text-neutral-500">
                                          <span>COMPLETED</span>
                                          <span className="text-neutral-400">{new Date(meta.completed_at * 1000).toLocaleString()}</span>
                                        </div>
                                      )}
                                      <div className="flex justify-between items-center text-[10px] font-mono text-neutral-500">
                                        <span>RENDER MODE</span>
                                        <span className={meta.render_mode === 'fallback' ? 'text-amber-500' : 'text-emerald-500'}>
                                          {meta.render_mode === 'fallback' ? 'SYNTH (FALLBACK)' : 'FFMPEG (NATIVE)'}
                                        </span>
                                      </div>
                                      {meta.file_size && (
                                        <div className="flex justify-between items-center text-[10px] font-mono text-neutral-500">
                                          <span>FILE SIZE</span>
                                          <span className="text-neutral-400">{(meta.file_size / 1024 / 1024).toFixed(2)} MB</span>
                                        </div>
                                      )}
                                      {meta.transitions_applied && (
                                        <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-white/5">
                                          <span className="text-[10px] font-mono text-neutral-500">TRANSITIONS APPLIED</span>
                                          <div className="flex flex-col gap-1 text-[10px] font-mono">
                                            {meta.transitions_applied.map((t: any, idx: number) => (
                                              <div key={idx} className="flex flex-col gap-1 bg-black/20 px-2 py-1 rounded border border-white/5">
                                                <div className="flex justify-between items-center">
                                                  <span className="text-neutral-400">Idx {t.boundary}: <span className="text-neon-cyan font-bold">{t.curve.toUpperCase()}</span></span>
                                                  <div className="flex gap-2 text-right">
                                                    <span className="text-neutral-500">{t.duration_ms}ms</span>
                                                    {t.duck_db < 0 && <span className="text-neon-pink">duck {t.duck_db}dB</span>}
                                                    <span className="text-white/50">{t.source}</span>
                                                  </div>
                                                </div>
                                                {t.eq_mode && t.eq_mode !== 'none' && (
                                                  <div className="flex justify-between items-center mt-0.5">
                                                    <span className="text-neutral-500 text-[8px] uppercase tracking-widest">FILTER AUTOMATION</span>
                                                    <span className="text-neon-purple text-[9px] font-bold">[EQ: {t.eq_mode.toUpperCase()}]</span>
                                                  </div>
                                                )}
                                                {t.sync_status && (
                                                  <div className="flex justify-between items-center mt-0.5">
                                                    <span className="text-neutral-500 text-[8px] uppercase tracking-widest">TEMPO SYNC</span>
                                                    {t.sync_status === 'BYPASSED_NO_BPM' ? (
                                                      <span className="text-amber-500 text-[9px] font-bold">BYPASSED (NO BPM)</span>
                                                    ) : t.sync_status === 'BYPASSED_OUT_OF_BOUNDS' ? (
                                                      <span className="text-amber-500 text-[9px] font-bold">BYPASSED (OUT OF LIMITS)</span>
                                                    ) : (
                                                      <span className="text-emerald-500 text-[9px] font-bold">[SYNC: {t.sync_source_bpm} → {t.sync_target_bpm} BPM ({t.sync_ratio}x)]</span>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  );
                                }
                              } catch (e) {}
                              return (
                                <>
                                  <div className="flex justify-between items-center text-[10px] font-mono text-neutral-500">
                                    <span>COMPLETED</span>
                                    <span className="text-neutral-400">—</span>
                                  </div>
                                  <div className="flex justify-between items-center text-[10px] font-mono text-neutral-500">
                                    <span>RENDER MODE</span>
                                    <span className="text-neutral-400">—</span>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Export History */}
                  <div className="bg-black/30 rounded-xl p-5 border border-white/5 space-y-4 max-h-[400px] overflow-y-auto">
                    <h3 className="font-bold text-sm tracking-wider font-mono text-neon-purple flex justify-between">
                      <span>EXPORT HISTORY</span>
                      <span className="text-neutral-500 text-xs">{exportHistory.length} JOBS</span>
                    </h3>
                    
                    {exportHistory.length === 0 ? (
                      <div className="py-8 text-center text-neutral-500 font-mono text-xs">
                        No exports yet. Bounce a playlist to see it here.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {exportHistory.map((job) => (
                          <div 
                            key={job.id} 
                            onClick={() => {
                              setExportJobId(job.id);
                              setExportStatus(job.status);
                              setExportProgress(job.progress);
                              setActiveExportJob(job);
                              setExportDownloadUrl(job.file_path || null);
                            }}
                            className={`p-4 rounded-xl border transition-all cursor-pointer ${
                              exportJobId === job.id 
                                ? "border-neon-cyan/50 bg-neon-cyan/5" 
                                : "border-white/5 bg-white/5 hover:border-white/20"
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <span className="text-white font-mono text-xs font-bold block truncate max-w-[150px]" title={job.id}>
                                  {job.id.split("-")[0]}...
                                </span>
                                <span className="text-neutral-500 text-[10px] font-mono block">
                                  {new Date(job.created_at + "Z").toLocaleString()}
                                </span>
                              </div>
                              <span className={`text-[10px] font-mono font-bold uppercase px-2 py-1 rounded ${
                                job.status === 'ready' ? 'bg-emerald-500/20 text-emerald-400' :
                                job.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                job.status === 'queued' ? 'bg-neutral-500/20 text-neutral-400' :
                                'bg-neon-cyan/20 text-neon-cyan'
                              }`}>
                                {job.status}
                              </span>
                            </div>
                            
                            {job.status === 'ready' && job.file_path && (
                              <a 
                                href={job.file_path}
                                download
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1.5 text-xs text-neon-cyan hover:text-white font-mono transition-colors mt-2"
                              >
                                <Download className="w-3 h-3" /> Download .wav
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Playlists Panel */}
          {engine.activeTab === "playlists" && (
            <div className="max-w-6xl mx-auto h-full flex flex-col md:flex-row gap-6">
              
              {/* Left Sidebar: Playlists List */}
              <div className="w-full md:w-64 flex-shrink-0 flex flex-col gap-4">
                <div className="glass-panel rounded-2xl p-4 border border-white/5 space-y-4">
                  <h3 className="font-bold text-xs tracking-wider font-mono text-neon-cyan flex items-center gap-2">
                    <ListMusic className="w-4 h-4" /> PLAYLISTS
                  </h3>
                  
                  <div className="space-y-3">
                    {playlists.map((pl) => (
                      <button
                        key={pl.id}
                        onClick={() => loadPlaylistItems(pl.id)}
                        className={`w-full text-left px-4 py-3 rounded-xl font-mono text-[11px] font-bold tracking-wide transition-all ${
                          activePlaylistId === pl.id
                            ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 shadow-[0_0_15px_rgba(34,211,238,0.15)]"
                            : "bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white border border-transparent"
                        }`}
                      >
                        {pl.name}
                      </button>
                    ))}
                  </div>

                  <div className="pt-6 border-t border-white/5 space-y-3">
                    <input
                      type="text"
                      placeholder="New playlist name..."
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-mono text-white placeholder:text-neutral-600 focus:outline-none focus:border-neon-cyan/50"
                    />
                    <button
                      onClick={handleCreatePlaylist}
                      disabled={!newPlaylistName.trim()}
                      className="w-full bg-neon-cyan hover:bg-neon-cyan/80 disabled:opacity-50 text-black font-extrabold text-[11px] font-mono tracking-wider py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      CREATE PLAYLIST
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Content: Playlist Tracks */}
              <div className="flex-1 min-w-0 flex flex-col gap-4">
                {activePlaylistId ? (
                  <>
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <h3 className="font-bold text-sm tracking-wider font-mono text-white">
                        {playlists.find(p => p.id === activePlaylistId)?.name.toUpperCase()}
                      </h3>
                      <span className="text-[10px] text-neutral-500 font-mono">{activePlaylistItems.length} TRACKS</span>
                    </div>

                    <div className="flex gap-4 items-start relative min-h-[400px]">
                      {/* Left Column: Visual Timeline */}
                      <div className="flex-1 min-w-0">
                        {activePlaylistItems.length > 0 ? (
                          <VisualTimeline 
                            items={activePlaylistItems} 
                            selectedItemId={selectedItemId}
                            onSelectItem={(id) => setSelectedItemId(id)}
                            onUpdateItem={(itemId, updates) => {
                              fetch(`http://127.0.0.1:8000/api/playlist-items/${itemId}`, { 
                                method: "PUT", 
                                headers: {"Content-Type": "application/json"}, 
                                body: JSON.stringify(updates) 
                              }).then(() => loadPlaylistItems(activePlaylistId as number));
                            }} 
                          />
                        ) : (
                          <div className="glass-panel rounded-2xl p-12 border border-white/5 text-center flex flex-col items-center justify-center gap-4 min-h-[300px]">
                            <ListMusic className="w-8 h-8 text-neutral-700" />
                            <span className="text-sm text-neutral-500 font-mono">This playlist is empty. Import a track to add it here.</span>
                          </div>
                        )}
                      </div>

                      {/* Right Column: Selection Inspector */}
                      <div className="w-80 flex-shrink-0 sticky top-4">
                        {selectedItemId && activePlaylistItems.find(i => i.item_id === selectedItemId) ? (() => {
                          const item = activePlaylistItems.find(i => i.item_id === selectedItemId);
                          return (
                            <div className="glass-panel rounded-2xl p-5 border border-white/5 flex flex-col gap-4 shadow-xl">
                              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                                <h4 className="text-xs font-bold font-mono text-neon-cyan tracking-wider flex items-center gap-2">
                                  SELECTION INSPECTOR
                                </h4>
                                <button className="p-1 hover:bg-white/10 rounded text-neutral-400" onClick={() => setSelectedItemId(null)}>
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              
                              <div className="flex items-start gap-3">
                                <img 
                                  src={item.thumbnail} 
                                  alt={item.title} 
                                  className="w-16 h-16 object-cover rounded-xl bg-neutral-900 border border-white/5 shadow-md flex-shrink-0" 
                                />
                                <div className="flex-1 min-w-0 space-y-1 font-mono">
                                  <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-white/[0.04] text-neutral-400 border border-white/5">{item.genre}</span>
                                  <h5 className="text-xs font-bold text-white truncate leading-snug">{item.title}</h5>
                                    <div className="flex flex-col gap-0.5 text-[10px] text-neutral-500 pt-1">
                                      <span>⏱️ {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, "0")}</span>
                                      <span>BPM: <b className="text-white font-semibold">{item.bpm || 'None'}</b> {item.raw_bpm ? `(Raw: ${item.raw_bpm})` : ''}</span>
                                      <span>KEY: <b className="text-white font-semibold">{item.key_signature || 'None'}</b></span>
                                      <span>ANALYSIS: <b className="text-white font-semibold uppercase">{item.analysis_status || 'PENDING'}</b></span>
                                    </div>
                                </div>
                              </div>

                              <div className="space-y-3 pt-3 border-t border-white/5">
                                <label className="flex flex-col gap-1 text-[10px] font-mono text-neutral-400">
                                  TRIM START (ms)
                                  <input type="number" defaultValue={item.trim_start_ms} 
                                    onBlur={(e) => {
                                      fetch(`http://127.0.0.1:8000/api/playlist-items/${item.item_id}`, {
                                        method: "PUT",
                                        headers: {"Content-Type": "application/json"},
                                        body: JSON.stringify({ trim_start_ms: parseFloat(e.target.value) })
                                      }).then(() => loadPlaylistItems(activePlaylistId as number));
                                    }}
                                    className="bg-black/50 border border-white/10 rounded px-3 py-2 w-full text-white focus:outline-none focus:border-neon-cyan/50" />
                                </label>
                                <label className="flex flex-col gap-1 text-[10px] font-mono text-neutral-400">
                                  TRIM END (ms)
                                  <input type="number" defaultValue={item.trim_end_ms} 
                                    onBlur={(e) => {
                                      fetch(`http://127.0.0.1:8000/api/playlist-items/${item.item_id}`, {
                                        method: "PUT",
                                        headers: {"Content-Type": "application/json"},
                                        body: JSON.stringify({ trim_end_ms: parseFloat(e.target.value) })
                                      }).then(() => loadPlaylistItems(activePlaylistId as number));
                                    }}
                                    className="bg-black/50 border border-white/10 rounded px-3 py-2 w-full text-white focus:outline-none focus:border-neon-cyan/50" />
                                </label>
                                <label className="flex flex-col gap-1 text-[10px] font-mono text-neutral-400">
                                  CROSSFADE DURATION (ms)
                                  <input type="number" defaultValue={item.crossfade_duration_ms} 
                                    onBlur={(e) => {
                                      fetch(`http://127.0.0.1:8000/api/playlist-items/${item.item_id}`, {
                                        method: "PUT",
                                        headers: {"Content-Type": "application/json"},
                                        body: JSON.stringify({ crossfade_duration_ms: parseFloat(e.target.value) })
                                      }).then(() => loadPlaylistItems(activePlaylistId as number));
                                    }}
                                    className="bg-black/50 border border-white/10 rounded px-3 py-2 w-full text-white focus:outline-none focus:border-neon-cyan/50" />
                                </label>
                              </div>

                              <div className="space-y-3 pt-3 border-t border-white/5">
                                <h6 className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">Transition DSP</h6>
                                <label className="flex flex-col gap-1 text-[10px] font-mono text-neutral-400">
                                  FADE CURVE
                                  <select defaultValue={item.fade_curve || 'linear'}
                                    onChange={(e) => {
                                      fetch(`http://127.0.0.1:8000/api/playlist-items/${item.item_id}`, {
                                        method: "PUT",
                                        headers: {"Content-Type": "application/json"},
                                        body: JSON.stringify({ fade_curve: e.target.value })
                                      }).then(() => loadPlaylistItems(activePlaylistId as number));
                                    }}
                                    className="bg-black/50 border border-white/10 rounded px-3 py-2 w-full text-white focus:outline-none focus:border-neon-cyan/50">
                                    <option value="linear">Linear</option>
                                    <option value="equal_power">Equal Power</option>
                                  </select>
                                </label>
                                <label className="flex flex-col gap-1 text-[10px] font-mono text-neutral-400">
                                  DUCKING (dB)
                                  <input type="number" step="0.5" max="0" defaultValue={item.duck_amount_db || 0.0} 
                                    onBlur={(e) => {
                                      fetch(`http://127.0.0.1:8000/api/playlist-items/${item.item_id}`, {
                                        method: "PUT",
                                        headers: {"Content-Type": "application/json"},
                                        body: JSON.stringify({ duck_amount_db: parseFloat(e.target.value) })
                                      }).then(() => loadPlaylistItems(activePlaylistId as number));
                                    }}
                                    className="bg-black/50 border border-white/10 rounded px-3 py-2 w-full text-white focus:outline-none focus:border-neon-cyan/50" />
                                </label>
                                <label className="flex flex-col gap-1 text-[10px] font-mono text-neutral-400">
                                  EQ MODE
                                  <select defaultValue={item.eq_mode || 'none'}
                                    onChange={(e) => {
                                      fetch(`http://127.0.0.1:8000/api/playlist-items/${item.item_id}`, {
                                        method: "PUT",
                                        headers: {"Content-Type": "application/json"},
                                        body: JSON.stringify({ eq_mode: e.target.value })
                                      }).then(() => loadPlaylistItems(activePlaylistId as number));
                                    }}
                                    className="bg-black/50 border border-white/10 rounded px-3 py-2 w-full text-white focus:outline-none focus:border-neon-cyan/50">
                                    <option value="none">None (Linear)</option>
                                    <option value="bass_swap">Bass Swap</option>
                                    <option value="smooth_blend">Smooth Blend</option>
                                    <option value="soft_exit">Soft Exit</option>
                                    <option value="vocal_protect">Vocal Protect</option>
                                  </select>
                                </label>
                                <label className="flex flex-col gap-1 text-[10px] font-mono text-neutral-400">
                                  BPM SYNC
                                  <select defaultValue={item.sync_mode || 'auto'}
                                    onChange={(e) => {
                                      fetch(`http://127.0.0.1:8000/api/playlist-items/${item.item_id}`, {
                                        method: "PUT",
                                        headers: {"Content-Type": "application/json"},
                                        body: JSON.stringify({ sync_mode: e.target.value })
                                      }).then(() => loadPlaylistItems(activePlaylistId as number));
                                    }}
                                    className="bg-black/50 border border-white/10 rounded px-3 py-2 w-full text-white focus:outline-none focus:border-neon-cyan/50">
                                    <option value="auto">Auto (Stretch to Match)</option>
                                    <option value="off">Off (Original Speed)</option>
                                  </select>
                                </label>
                              </div>

                              <div className="pt-3 border-t border-white/5 space-y-2">
                                <div className="text-[10px] font-mono flex justify-between items-center text-neutral-400">
                                  <span>POSITION INDEX:</span>
                                  <span className="text-white font-bold">{item.position_index + 1}</span>
                                </div>
                                <div className="text-[10px] font-mono flex justify-between items-center text-neutral-400">
                                  <span>PRESET ORIGIN:</span>
                                  <span className="text-white font-bold">{item.transition_preset || 'manual'}</span>
                                </div>
                                <div className="text-[10px] font-mono flex justify-between items-center text-neutral-400">
                                  <span>TIMING MODE:</span>
                                  <span className="text-white font-bold">{item.is_snapped ? 'snapped' : 'raw ms'}</span>
                                </div>
                              </div>

                              <div className="pt-3 border-t border-white/5 flex gap-2 flex-col">
                                <button 
                                  onClick={() => handlePreviewTransition(item.item_id, activePlaylistId as number)}
                                  disabled={item.position_index === 0}
                                  className={`w-full py-2 bg-neon-cyan/10 hover:bg-neon-cyan/20 text-neon-cyan rounded-xl font-bold font-mono text-[10px] transition-colors flex items-center justify-center gap-2 ${item.position_index === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  <Sparkles className="w-4 h-4" /> PREVIEW TRANSITION
                                </button>
                                <button 
                                  onClick={() => {
                                    fetch(`http://127.0.0.1:8000/api/playlist-items/${item.item_id}`, { method: 'DELETE' }).then(() => {
                                      setSelectedItemId(null);
                                      loadPlaylistItems(activePlaylistId as number);
                                    });
                                  }}
                                  className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-bold font-mono text-[10px] transition-colors flex items-center justify-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" /> REMOVE ITEM
                                </button>
                                
                                {/* Phase 11: Suggest Next Track */}
                                <button 
                                  onClick={() => {
                                    setIsSuggesting(true);
                                    fetch(`http://127.0.0.1:8000/api/recommendations?base_youtube_url=${encodeURIComponent(item.youtube_url)}`)
                                      .then(r => r.json())
                                      .then(data => {
                                        if(data.success) {
                                          setRecommendations(data.recommendations);
                                        }
                                        setIsSuggesting(false);
                                      })
                                      .catch(() => setIsSuggesting(false));
                                  }}
                                  disabled={isSuggesting}
                                  className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-xl font-bold font-mono text-[10px] transition-colors flex items-center justify-center gap-2 mt-2"
                                >
                                  <Sparkles className="w-4 h-4" /> {isSuggesting ? 'SCORING TRACKS...' : 'SUGGEST NEXT TRACK'}
                                </button>
                              </div>

                              {/* Phase 11: Recommendation Panel */}
                              {recommendations.length > 0 && (
                                <div className="mt-4 border border-amber-500/20 bg-amber-500/5 rounded-xl p-3 flex flex-col gap-3 relative">
                                  <button 
                                    onClick={() => setRecommendations([])} 
                                    className="absolute top-2 right-2 text-neutral-400 hover:text-white"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                  <h4 className="text-[10px] font-bold font-mono text-amber-400 tracking-wider">HARMONIC SUGGESTIONS</h4>
                                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                                    {recommendations.map((rec, idx) => (
                                      <div key={idx} className="bg-black/60 rounded-lg p-2 border border-white/5 flex flex-col gap-2">
                                        <div className="flex gap-2">
                                          <img src={rec.track.thumbnail || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=150'} alt="thumb" className="w-10 h-10 object-cover rounded bg-neutral-900 border border-white/10" />
                                          <div className="flex-1 min-w-0 font-mono space-y-0.5">
                                            <p className="text-[10px] font-bold text-white truncate">{rec.track.title}</p>
                                            <div className="flex gap-2 text-[9px] text-neutral-400">
                                              <span>BPM: {rec.track.bpm || '--'}</span>
                                              <span>KEY: {rec.track.key_signature || '--'}</span>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex flex-col gap-1 text-[9px] font-mono">
                                          {rec.reasons.map((r: string, ridx: number) => (
                                            <span key={ridx} className={`flex items-center gap-1 ${r.includes('⚠️') ? 'text-red-400' : 'text-emerald-400'}`}>
                                              {r.includes('⚠️') ? '' : '✓'} {r}
                                            </span>
                                          ))}
                                        </div>
                                        <button
                                          onClick={() => {
                                            fetch(`http://127.0.0.1:8000/api/playlists/${activePlaylistId}/items`, {
                                              method: "POST",
                                              headers: {"Content-Type": "application/json"},
                                              body: JSON.stringify({
                                                youtube_url: rec.track.youtube_url,
                                                position_index: item.position_index + 1
                                              })
                                            })
                                            .then(r => r.json())
                                            .then(data => {
                                              if(data.success && data.item_id) {
                                                // Apply suggested transitions
                                                fetch(`http://127.0.0.1:8000/api/playlist-items/${data.item_id}`, {
                                                  method: "PUT",
                                                  headers: {"Content-Type": "application/json"},
                                                  body: JSON.stringify(rec.suggestion)
                                                }).then(() => {
                                                  setRecommendations([]);
                                                  loadPlaylistItems(activePlaylistId as number);
                                                  setSelectedItemId(data.item_id);
                                                });
                                              }
                                            });
                                          }}
                                          className="w-full py-1.5 bg-neon-cyan/20 hover:bg-neon-cyan/30 text-neon-cyan rounded font-bold font-mono text-[9px] transition-colors flex items-center justify-center"
                                        >
                                          LOAD SUGGESTION
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })() : (
                          <div className="glass-panel rounded-2xl p-6 border border-white/5 text-center flex flex-col items-center justify-center gap-3 h-48 opacity-60">
                            <span className="text-xs text-neutral-500 font-mono">Select a block in the timeline to inspect its metadata and edit trims.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="glass-panel rounded-3xl p-12 border border-white/5 flex flex-col items-center justify-center text-center gap-4 h-full">
                    <ListMusic className="w-12 h-12 text-neutral-700" />
                    <div className="space-y-2">
                      <h2 className="text-lg font-bold tracking-wider font-mono text-white">LIBRARY & PLAYLISTS</h2>
                      <p className="text-xs text-neutral-500 font-mono max-w-sm">
                        Select a playlist from the sidebar or create a new one to start organizing your extracted tracks.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Add To Playlist Modal */}
      {trackToAdd && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel rounded-3xl p-6 border border-white/10 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-wider font-mono text-white flex items-center gap-2">
                <ListMusic className="w-5 h-5 text-neon-cyan" /> ADD TO PLAYLIST
              </h2>
              <button 
                onClick={() => setTrackToAdd(null)}
                className="p-2 hover:bg-white/5 rounded-full text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex gap-4 items-center bg-black/30 p-3 rounded-2xl border border-white/5">
              <img src={trackToAdd.thumbnail} className="w-12 h-12 rounded-xl object-cover" />
              <div className="font-mono min-w-0">
                <p className="text-xs font-bold text-white truncate">{trackToAdd.title}</p>
                <p className="text-[10px] text-neutral-500">BPM: {trackToAdd.bpm} • KEY: {trackToAdd.key || trackToAdd.key_signature}</p>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {playlists.length > 0 ? (
                playlists.map(pl => (
                  <button
                    key={pl.id}
                    onClick={() => handleAddTrackToPlaylist(pl.id)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10 transition-all font-mono text-left"
                  >
                    <span className="text-sm text-white font-bold">{pl.name}</span>
                    <Plus className="w-4 h-4 text-neon-cyan" />
                  </button>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center p-6 gap-3 text-neutral-500 font-mono border border-white/5 rounded-xl border-dashed">
                  <ListMusic className="w-6 h-6 text-neutral-600" />
                  <span className="text-xs text-center">No playlists yet.<br/>Create one to add tracks.</span>
                </div>
              )}
            </div>
            
            <div className="pt-2 border-t border-white/5">
              <button
                onClick={() => {
                  engine.setActiveTab("playlists");
                  setTrackToAdd(null);
                }}
                className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-[10px] font-mono tracking-wider transition-colors"
              >
                GO TO PLAYLIST MANAGER
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Status Footer / Observability Strip */}
      <footer className="h-10 bg-[#050508] border-t border-white/5 flex items-center justify-between px-6 font-mono text-[10px] text-neutral-500 z-20 flex-shrink-0 select-none">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2">
            <Activity className={`w-3 h-3 ${isBackendOnline ? 'text-neon-cyan' : 'text-red-500'}`} /> 
            <span className="text-white font-bold">PULSEMIX ENGINE v2.4</span>
          </span>
          <span className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full shadow-[0_0_5px_currentColor] ${isBackendOnline ? 'bg-emerald-500 text-emerald-500' : 'bg-red-500 text-red-500'}`} /> 
            {isBackendOnline ? 'API ONLINE' : 'API OFFLINE'}
          </span>
          <span className="flex items-center gap-1">
            LAST SYNC: {Math.max(0, Math.floor((currentTime - lastSyncTime) / 1000))}s AGO
          </span>
          {activeExportJob && activeExportJob.metadata && (() => {
            try {
              const meta = JSON.parse(activeExportJob.metadata);
              return (
                <span className="flex items-center gap-2 border-l border-white/10 pl-6">
                  <span className="text-neutral-600">RENDER MODE:</span>
                  <span className={meta.render_mode === 'fallback' ? 'text-amber-500' : 'text-emerald-500'}>
                    {meta.render_mode === 'fallback' ? 'SYNTH (FALLBACK)' : 'FFMPEG (NATIVE)'}
                  </span>
                </span>
              );
            } catch (e) {}
            return null;
          })()}
        </div>
        <div className="flex items-center gap-6">
          {activeExportJob && (
            <span className="hidden md:flex items-center gap-2">
              <span className="text-neutral-600">LATEST JOB ID:</span>
              <span className="text-neutral-400">{activeExportJob.id.split('-')[0]}</span>
            </span>
          )}
          <span className="hidden sm:inline border-l border-white/10 pl-6">OUTPUT: 48kHz / 24-bit</span>
          <span className="hidden md:inline">LATENCY: ~3ms</span>
        </div>
      </footer>
    </div>
  );
}
