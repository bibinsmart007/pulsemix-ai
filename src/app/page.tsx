"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
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
  Upload,
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
  Loader2,
  Star,
  XCircle,
  HelpCircle,
  Command,
  Search,
  Keyboard
} from "lucide-react";
import DJDeck from "@/components/DJDeck";
import MixerDesk from "@/components/MixerDesk";
import Visualizer from "@/components/Visualizer";
import VisualTimeline from "@/components/VisualTimeline";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { useTimelinePlayback } from "@/hooks/useTimelinePlayback";
import { computeTimelineBlocks } from "@/utils/timeline";
import { getCompatibleKeys } from "@/utils/audio";

import CloudLibrary, { CloudProject } from "@/components/CloudLibrary";
import SharedProjectViewer from "@/components/SharedProjectViewer";
import ReviewPanel, { ProjectComment } from "@/components/ReviewPanel";
import PublishModal, { PublishConfig } from "@/components/PublishModal";
import AccessManager, { PublishLink } from "@/components/AccessManager";
import { usePresence, ActiveSession } from "@/hooks/usePresence";
import ExportTimeline from "@/components/ExportTimeline";

// Phase 41: Async Feedback & Global Activity
export interface GlobalJob {
  id: string;
  title: string;
  type: 'ai_generation' | 'export' | 'download' | 'stem_extraction' | 'restore';
  status: 'Queued' | 'Processing' | 'Completed' | 'Failed';
  progress?: number;
  error?: string;
}

export interface ToastInfo {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info';
  actionLabel?: string;
  action?: () => void;
}

export default function Home() {
  const engine = useAudioEngine();
  
  const [youtubeUrl, setYoutubeUrl] = useState<string>("");
  const [draftUrl, setDraftUrl] = useState<string>("");
  const [aiPrompt, setAiPrompt] = useState<string>("");
  const [isGeneratingMix, setIsGeneratingMix] = useState<boolean>(false);
  const [mixVariations, setMixVariations] = useState<any[]>([]);
  const [selectedVariationIndex, setSelectedVariationIndex] = useState<number>(0);
  const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);

  // Phase 35: AI Sessions
  const [currentAiSessionId, setCurrentAiSessionId] = useState<number | null>(null);
  const [aiSessionsList, setAiSessionsList] = useState<any[]>([]);
  const [showSessionsPanel, setShowSessionsPanel] = useState<boolean>(false);

  // Phase 36: Compare Mode
  const [isCompareMode, setIsCompareMode] = useState<boolean>(false);
  const [selectedForCompare, setSelectedForCompare] = useState<number[]>([]);
  const [compareData, setCompareData] = useState<any>(null);

  // Phase 38: Guide Overlay
  const [showGuideOverlay, setShowGuideOverlay] = useState<boolean>(false);

  // Phase 39: Guidance Hints
  const [dismissedHints, setDismissedHints] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window !== "undefined") {
      const onboarded = localStorage.getItem('pulsemix_onboarded');
      if (!onboarded) {
        setShowGuideOverlay(true);
      }
      
      const hintsStr = localStorage.getItem('pulsemix_hints');
      if (hintsStr) {
        try {
          setDismissedHints(JSON.parse(hintsStr));
        } catch (e) {}
      }
    }
  }, []);

  const dismissHint = (key: string) => {
    setDismissedHints(prev => {
      const next = { ...prev, [key]: true };
      localStorage.setItem('pulsemix_hints', JSON.stringify(next));
      return next;
    });
  };

  const resetHints = () => {
    setDismissedHints({});
    localStorage.removeItem('pulsemix_hints');
  };



  // Phase 37: Session Filtering
  const [sessionsFilter, setSessionsFilter] = useState<'all' | 'favorites' | 'applied'>('all');

  // Phase 40: Command Palette & Keyboard Shortcuts
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandSelectedIndex, setCommandSelectedIndex] = useState(0);

  const COMMANDS = [
    { id: 'nav-assistant', title: 'Go to AI Assistant', category: 'Navigation', aliases: ['mix', 'generate', 'ai'], action: () => engine.setActiveTab('assistant') },
    { id: 'nav-studio', title: 'Go to Mix Studio', category: 'Navigation', aliases: ['decks', 'mixer', 'play'], action: () => engine.setActiveTab('studio') },
    { id: 'nav-library', title: 'Go to Library', category: 'Navigation', aliases: ['tracks', 'playlists', 'versions'], action: () => engine.setActiveTab('playlists') },
    { id: 'nav-export', title: 'Go to Export Center', category: 'Navigation', aliases: ['render', 'bounce', 'download'], action: () => engine.setActiveTab('export') },
    { id: 'ui-guide', title: 'Show Workspace Guide', category: 'Help', aliases: ['help', 'onboarding', 'shortcuts'], action: () => setShowGuideOverlay(true) },
    { id: 'ui-hints', title: 'Reset Feature Hints', category: 'Help', aliases: ['tips', 'reset'], action: () => resetHints() },
    { id: 'nav-runs', title: 'Open Recent Runs', category: 'Session', aliases: ['history', 'compare'], action: () => engine.setActiveTab('assistant') },
  ];

  const filteredCommands = COMMANDS.filter(cmd => {
    const q = commandQuery.toLowerCase();
    if (!q) return true;
    return cmd.title.toLowerCase().includes(q) || cmd.aliases.some(a => a.includes(q)) || cmd.category.toLowerCase().includes(q);
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global Command Palette (Cmd/Ctrl + K)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
        setCommandQuery("");
        setCommandSelectedIndex(0);
        return;
      }

      // Context-aware protection: Ignore single-key/shift shortcuts if typing in an input
      if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        return;
      }

      if (!showCommandPalette) {
        // Fast Navigation (Shift + Key)
        if (e.shiftKey) {
          if (e.key === 'A') { e.preventDefault(); engine.setActiveTab('assistant'); }
          if (e.key === 'M') { e.preventDefault(); engine.setActiveTab('studio'); }
          if (e.key === 'L') { e.preventDefault(); engine.setActiveTab('playlists'); }
          if (e.key === 'E') { e.preventDefault(); engine.setActiveTab('export'); }
        }
      } else {
        // Command Palette Navigation
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowCommandPalette(false);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setCommandSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setCommandSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const cmd = filteredCommands[commandSelectedIndex];
          if (cmd) {
            cmd.action();
            setShowCommandPalette(false);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCommandPalette, filteredCommands, commandSelectedIndex, engine]);


  // Phase 41: Async States
  const [globalJobs, setGlobalJobs] = useState<GlobalJob[]>([]);

  const updateGlobalJob = (id: string, update: Partial<GlobalJob> | ((prev: GlobalJob) => GlobalJob)) => {
    setGlobalJobs(prev => {
      const exists = prev.find(j => j.id === id);
      if (!exists) {
        if (typeof update === 'function') return prev;
        return [...prev, { id, title: 'Job', type: 'ai_generation', status: 'Processing', ...update } as GlobalJob];
      }
      return prev.map(j => {
        if (j.id === id) {
          const next = typeof update === 'function' ? update(j as GlobalJob) : { ...j, ...update };
          if (next.status === 'Completed' && j.status !== 'Completed') {
            setTimeout(() => {
              setGlobalJobs(current => current.filter(c => c.id !== id));
            }, 3000);
          }
          return next;
        }
        return j;
      });
    });
  };

  const removeGlobalJob = (id: string) => {
    setGlobalJobs(prev => prev.filter(j => j.id !== id));
  };
  
  const addGlobalJob = (id: string, name: string) => {
    setGlobalJobs(prev => [...prev, { id, title: name, type: 'ai_generation', status: 'Processing', progress: 0 }]);
  };

  useEffect(() => {
    if (engine.deckA.stem_status === "READY") {
      updateGlobalJob("extract-deckA", { status: "Completed", title: "Stems Ready (Deck A)" });
      addToast("Finished extracting stems for Deck A", "success");
    } else if (engine.deckA.stem_status === "FAILED") {
      removeGlobalJob("extract-deckA");
      addToast("Failed to extract stems for Deck A", "error");
    }
  }, [engine.deckA.stem_status]);

  useEffect(() => {
    if (engine.deckB.stem_status === "READY") {
      updateGlobalJob("extract-deckB", { status: "Completed", title: "Stems Ready (Deck B)" });
      addToast("Finished extracting stems for Deck B", "success");
    } else if (engine.deckB.stem_status === "FAILED") {
      removeGlobalJob("extract-deckB");
      addToast("Failed to extract stems for Deck B", "error");
    }
  }, [engine.deckB.stem_status]);


  const fetchAiSessions = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/ai/sessions");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAiSessionsList(data.sessions || []);
        }
      }
    } catch (e) {
      console.error("Failed to fetch AI sessions", e);
    }
  };

  useEffect(() => {
    if (engine.activeTab === "ai_assistant") {
      fetchAiSessions();
    }
  }, [engine.activeTab]);

  const handleLoadSession = async (sessionId: number) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/ai/sessions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.session) {
          setCurrentAiSessionId(data.session.id);
          setAiPrompt(data.session.prompt || "");
          setMixVariations(data.session.variations || []);
          setSelectedVariationIndex(data.session.selected_variation_index || 0);
          setShowSessionsPanel(false);
          stopPreview();
          addToast("Session loaded.", "info");
        }
      }
    } catch (e) {
      addToast("Failed to load session", "error");
    }
  };

  const handleRateSession = async (sessionId: number, rating: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/ai/sessions/${sessionId}/rate`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating })
      });
      if (res.ok) {
        fetchAiSessions();
      }
    } catch (error) {
      addToast("Failed to rate session", "error");
    }
  };

  const handleDuplicateSession = async (sessionId: number, e: React.MouseEvent) => {

    e.stopPropagation();
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/ai/sessions/${sessionId}/duplicate`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          addToast("Session duplicated.", "success");
          fetchAiSessions();
          handleLoadSession(data.session_id);
        }
      }
    } catch (e) {
      addToast("Failed to duplicate session", "error");
    }
  };

  const handleCompareSessions = async () => {
    if (selectedForCompare.length !== 2) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/ai/sessions/compare?id1=${selectedForCompare[0]}&id2=${selectedForCompare[1]}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCompareData(data);
          setIsCompareMode(true);
          setShowSessionsPanel(false);
        }
      }
    } catch (e) {
      addToast("Failed to compare sessions", "error");
    }
  };

  const toggleCompareSelection = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (selectedForCompare.includes(id)) {
      setSelectedForCompare(selectedForCompare.filter(s => s !== id));
    } else {
      if (selectedForCompare.length < 2) {
        setSelectedForCompare([...selectedForCompare, id]);
      } else {
        addToast("You can only compare 2 sessions.", "warning");
      }
    }
  };


  
  // Refs for preview playback
  const previewAudioARef = useRef<HTMLAudioElement | null>(null);
  const previewAudioBRef = useRef<HTMLAudioElement | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Clean up preview audio when unmounting or switching tabs
  useEffect(() => {
    return () => stopPreview();
  }, [engine.activeTab]);

  const stopPreview = () => {
    if (previewAudioARef.current) {
      previewAudioARef.current.pause();
      previewAudioARef.current.src = "";
    }
    if (previewAudioBRef.current) {
      previewAudioBRef.current.pause();
      previewAudioBRef.current.src = "";
    }
    setPlayingPreviewId(null);
  };

  const handleAiPreviewTransition = (variant: any) => {
    if (playingPreviewId === variant.variation_id) {
      stopPreview();
      return;
    }
    stopPreview();
    
    const { deck_a, deck_b } = variant;
    setPlayingPreviewId(variant.variation_id);

    const audioA = new Audio(deck_a.url);
    const audioB = new Audio(deck_b.url);
    
    // Simulate a quick crossfade: play A for 3 seconds, fade out A and fade in B over 2 seconds
    audioA.volume = 1.0;
    audioB.volume = 0.0;
    
    audioA.play().catch(e => console.error("Preview play failed:", e));
    audioB.play().catch(e => console.error("Preview play failed:", e));

    previewAudioARef.current = audioA;
    previewAudioBRef.current = audioB;

    let fadeTimer: NodeJS.Timeout;
    let stopTimer: NodeJS.Timeout;

    fadeTimer = setTimeout(() => {
      // Simulate crossfade
      let steps = 20;
      let curr = 0;
      const interval = setInterval(() => {
        curr++;
        if (curr >= steps) {
          clearInterval(interval);
          if (audioA) audioA.volume = 0;
          if (audioB) audioB.volume = 1;
        } else {
          if (audioA) audioA.volume = 1 - (curr / steps);
          if (audioB) audioB.volume = (curr / steps);
        }
      }, 100);
    }, 3000);

    stopTimer = setTimeout(() => {
      stopPreview();
    }, 8000); // 8 seconds total preview
  };

  
  const [importQueue, setImportQueue] = useState<any[]>([]);
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
  
  // Phase 20: Publishing
  const [showPublishModal, setShowPublishModal] = useState<boolean>(false);
  const [publishTargetVersion, setPublishTargetVersion] = useState<number | null>(null);
  const [publishTargetExports, setPublishTargetExports] = useState<any[]>([]);
  const [publishPackageType, setPublishPackageType] = useState<string>("private_preview");
  const [publishNotes, setPublishNotes] = useState<string>("");
  const [publicPublishData, setPublicPublishData] = useState<any | null>(null);

  // Phase 21: Access Control
  const [publishAllowDownload, setPublishAllowDownload] = useState<boolean>(false);
  const [publishExpiresHours, setPublishExpiresHours] = useState<number | null>(null);
  const [publishPassword, setPublishPassword] = useState<string>("");
  const [publishRecipientLabel, setPublishRecipientLabel] = useState<string>("");
  const [activePublishLinks, setActivePublishLinks] = useState<any[]>([]);
  const [showLinksModal, setShowLinksModal] = useState<boolean>(false);
  const [publicAuthPassword, setPublicAuthPassword] = useState<string>("");
  const [publicNeedsPassword, setPublicNeedsPassword] = useState<boolean>(false);
  const [publicPublishError, setPublicPublishError] = useState<string | null>(null);

  // Phase 22: Component States
  const [showCloudModal, setShowCloudModal] = useState<boolean>(false);
  const [cloudProject, setCloudProject] = useState<CloudProject | null>(null);
  
  const [isReviewMode, setIsReviewMode] = useState<boolean>(false);
  const [isReviewPanelOpen, setIsReviewPanelOpen] = useState<boolean>(false);
  const [projectComments, setProjectComments] = useState<ProjectComment[]>([]);
  const [currentVersionId, setCurrentVersionId] = useState<number | null>(null);
  
  // Phase 25: Presence
  const { activeSessions, setAction, setFocusTarget } = usePresence(
    cloudProject?.id || null,
    currentVersionId,
    "Guest_" + Math.floor(Math.random() * 1000)
  );
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [activePlaylistItems, setActivePlaylistItems] = useState<any[]>([]);
  const [recoveringItem, setRecoveringItem] = useState<any>(null);
  const manualFileRef = useRef<HTMLInputElement>(null);
  const [autoPhraseSnap, setAutoPhraseSnap] = useState(true);

  const positionedBlocks = useMemo(() => computeTimelineBlocks(activePlaylistItems, autoPhraseSnap), [activePlaylistItems, autoPhraseSnap]);
  const playback = useTimelinePlayback(engine, positionedBlocks);

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
  const [showAuditionDropdown, setShowAuditionDropdown] = useState(false);

  // Export State
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportDownloadUrl, setExportDownloadUrl] = useState<string | null>(null);
  const [activeExportJob, setActiveExportJob] = useState<any | null>(null);
  const [exportHistory, setExportHistory] = useState<any[]>([]);
  
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportNameInput, setExportNameInput] = useState("");

  const [masterBusMode, setMasterBusMode] = useState<string>('Balanced');
  const [globalExportSettings, setGlobalExportSettings] = useState({ crossfade_duration_ms: 2000, fade_curve: 'linear', eq_mode: 'none' });
  const [exportJobError, setExportJobError] = useState<string | null>(null);
  const notifiedExportsRef = useRef<Set<string>>(new Set());

  // Toasts
  const [toasts, setToasts] = useState<{id: number, message: string, type: 'success'|'error'|'info'|'warning', persistent?: boolean, actionLabel?: string, action?: () => void}[]>([]);
  const addToast = (message: string, type: 'success'|'error'|'info'|'warning' = 'success', persistent: boolean = false, actionLabel?: string, action?: () => void) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, {id, message, type, persistent, actionLabel, action}]);
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
  const handleAutobuildSet = async (playlistId: number) => {
    try {
      addToast("Generating transition suggestions...", "info");
      const res = await fetch(`/api/playlists/${playlistId}/transition-suggestions`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to generate suggestions");

      const updates = data.suggestions.map((sug: any) => ({
        item_id: activePlaylistItems[sug.boundary].item_id,
        trim_start_ms: sug.trim_start_ms,
        trim_end_ms: sug.trim_end_ms,
        is_snapped: true,
        transition_preset: sug.transition_preset
      }));

      await fetch(`/api/playlists/${playlistId}/autobuild`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates })
      });

      addToast("Suggestions applied!", "success");
      loadPlaylistItems(playlistId);
    } catch (err: any) {
      addToast(err.message, "error");
    }
  };

  const handleImportPackage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      addToast("Importing package...", "info");
      const buffer = await file.arrayBuffer();
      const isZip = file.name.endsWith('.zip');
      const isJson = file.name.endsWith('.json');
      
      if (!isZip && !isJson) {
        addToast("Unsupported file type. Please use .zip or .json", "error");
        return;
      }

      const res = await fetch("/api/playlists/import", {
        method: "POST",
        headers: {
          "Content-Type": isZip ? "application/zip" : "application/json"
        },
        body: buffer
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Import failed");

      if (data.warnings && data.warnings.length > 0) {
        addToast(`Imported with ${data.warnings.length} missing tracks`, "success");
      } else {
        addToast(data.message || "Import successful", "success");
      }
      
      fetchPlaylists();
      setActivePlaylistId(data.playlist_id);
      loadPlaylistItems(data.playlist_id);
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      if (importFileRef.current) importFileRef.current.value = "";
    }
  };

  const handleRecoverAuto = async (item: any) => {
    try {
      addGlobalJob(`recover-${item.item_id}`, `Recovering ${item.title}`);
      await fetch("http://localhost:8000/api/tracks/recover/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: item.youtube_url })
      });
      setRecoveringItem(null);
    } catch(e) {}
  };

  const handleRecoverManual = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !recoveringItem) return;
    const file = e.target.files[0];
    
    try {
      const buffer = await file.arrayBuffer();
      addGlobalJob(`recover-manual-${recoveringItem.item_id}`, `Uploading ${file.name}`);
      
      await fetch("http://localhost:8000/api/tracks/recover/manual", {
        method: "POST",
        headers: {
          "x-youtube-url": recoveringItem.youtube_url,
          "x-filename": file.name,
          "Content-Type": "application/octet-stream"
        },
        body: buffer
      });
      
      setRecoveringItem(null);
    } catch(err) {}
  };

  const handlePreviewTransition = async (itemId: number, playlistId: number) => {
    try {
      addToast('Rendering transition preview...', 'info');
      const res = await fetch(`http://127.0.0.1:8000/api/preview-transition/${itemId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlist_id: playlistId })
      });
      const data = await res.json();
      if (data.success) {
        const audio = new Audio(`http://127.0.0.1:8000${data.url}`);
        audio.play();
        addToast('Playing transition preview...', 'success');
      } else {
        addToast(data.detail || 'Preview failed', 'error');
      }
    } catch (e: any) {
      addToast('Preview failed: ' + e.message, 'error');
    }
  };

  // Phase 20/21/26: Publishing Handlers
  const handlePublishVersion = async (config: PublishConfig) => {
    if (!publishTargetVersion) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/cloud/versions/${publishTargetVersion}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          package_type: config.packageType,
          notes: config.notes,
          allow_download: config.allowDownload,
          expires_in_hours: config.expiresHours,
          password: config.password,
          recipient_label: config.recipientLabel,
          export_ids: config.exportIds
        })
      });
      const data = await res.json();
      if (data.success) {
        addToast("Version published!", "success");
        setShowPublishModal(false);
        setPublishTargetExports([]);
        
        // Simulate opening the public link
        handleOpenPublicLink(data.publish_token);
      }
    } catch (e) {
      addToast("Failed to publish", "error");
    }
  };

  const handleOpenPublicLink = async (token: string, password?: string) => {
    try {
      let url = `http://127.0.0.1:8000/api/public/publish/${token}`;
      if (password) url += `?pwd=${encodeURIComponent(password)}`;
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.success) {
        setPublicPublishData({...data.package, publish_token: token});
        setPublicNeedsPassword(false);
        setPublicPublishError(null);
      } else if (data.needs_password) {
        setPublicNeedsPassword(true);
        setPublicPublishData({ publish_token: token }); // store token to retry
      } else if (data.error) {
        setPublicPublishError(data.error);
        setPublicPublishData({ publish_token: token });
      }
    } catch (e) {
      addToast("Failed to load public link", "error");
    }
  };

  const handleFetchActiveLinks = async (versionId: number) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/cloud/versions/${versionId}/links`);
      const data = await res.json();
      if (data.success) {
        setActivePublishLinks(data.links);
        setShowLinksModal(true);
      }
    } catch (e) {
      addToast("Failed to load links", "error");
    }
  };

  const handleRevokeLink = async (token: string, versionId: number) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/cloud/publish/${token}/revoke`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        addToast("Link revoked", "success");
        handleFetchActiveLinks(versionId); // refresh
      }
    } catch (e) {
      addToast("Failed to revoke link", "error");
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

  const loadPlaylistItems = async (playlistId: number, currentSnap: boolean = autoPhraseSnap) => {
    setActivePlaylistId(playlistId);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/playlists/${playlistId}/items?t=${Date.now()}&auto_phrase_snap=${currentSnap}`);
      const data = await res.json();
      if (data.success) {
        setActivePlaylistItems(data.items);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (activePlaylistId) {
      loadPlaylistItems(activePlaylistId, autoPhraseSnap);
    }
  }, [autoPhraseSnap, activePlaylistId]);

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
      
      const name = exportNameInput.trim() || `Export_${new Date().toISOString().split('T')[0]}`;
      
      setExportStatus("queued");
      setShowExportModal(false);
      addToast("Export started!", "info");
      const res = await fetch("http://127.0.0.1:8000/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlist_id: pid, export_name: name, auto_phrase_snap: autoPhraseSnap })
      });
      const data = await res.json();
      if (data.success) {
        setExportJobId(data.job_id);
        setExportStatus("queued");
        setExportProgress(0);
        setExportDownloadUrl(null);
        updateGlobalJob(data.job_id, { title: 'Exporting Mix', type: 'export', status: 'Queued' });
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
            updateGlobalJob(data.job.id, { progress: data.job.progress, status: data.job.status === 'completed' ? 'Completed' : data.job.status === 'failed' ? 'Failed' : 'Processing' });
            if (data.job.file_path) {
              setExportDownloadUrl(data.job.file_path);
            }
            if (data.job.status === "completed" || data.job.status === "failed") {
              fetchExportHistory(); // Refetch history to reflect new completed state
              clearInterval(interval);
              
              const stateKey = `${data.job.id}-${data.job.status}`;
              if (!notifiedExportsRef.current.has(stateKey)) {
                notifiedExportsRef.current.add(stateKey);
                if (data.job.status === "completed") {
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
  const handleGenerateMix = async () => {
    const validTracks = importQueue.filter(q => q.status === 'completed' || q.status === 'ready' || q.status === 'from_cache');
    if (validTracks.length < 2) {
      addToast("At least 2 completed tracks are needed to generate a mix.", "warning");
      return;
    }

    setIsGeneratingMix(true);
    setMixVariations([]);
    setSelectedVariationIndex(0);
    
    const jobId = `ai-gen-${Date.now()}`;
    updateGlobalJob(jobId, { title: 'AI Mix Generation', type: 'ai_generation', status: 'Processing' });

    try {
      const response = await fetch("http://127.0.0.1:8000/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt,
          tracks: validTracks
        })
      });

      if (!response.ok) {
        throw new Error("Failed to generate mix variations");
      }

      const data = await response.json();
      if (data.success && data.variations && data.variations.length > 0) {
        setMixVariations(data.variations);
        setSelectedVariationIndex(0); // Select primary by default
        
        // Auto-save the AI Session
        try {
          const saveRes = await fetch("http://127.0.0.1:8000/api/ai/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              session_id: currentAiSessionId,
              prompt: aiPrompt,
              input_tracks: validTracks,
              variations: data.variations,
              selected_variation_index: 0
            })
          });
          const saveData = await saveRes.json();
          if (saveData.success) {
            setCurrentAiSessionId(saveData.session_id);
            fetchAiSessions(); // Refresh list
          }
        } catch (saveErr) {
          console.error("Failed to save AI session state", saveErr);
        }
        
        updateGlobalJob(jobId, { status: 'Completed', progress: 100 });
        addToast("AI Variations Ready", "success", false, "View Runs", () => engine.setActiveTab('assistant'));
      } else {
        throw new Error(data.error || "Unknown generation error");
      }
    } catch (e: any) {
      console.error(e);
      updateGlobalJob(jobId, { status: 'Failed', error: e.message });
      addToast("Failed to generate mix: " + e.message, "error");
    } finally {
      setIsGeneratingMix(false);
    }
  };

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
        updateGlobalJob(jobId, { title: `Import: ${urlToImport.substring(0, 20)}...`, type: 'download', status: 'Queued' });
        
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
              updateGlobalJob(jobId, { status: 'Completed', progress: 100, title: statusData.track.title });
              
              // Add to imported list
              setPresetTracks(prev => [statusData.track, ...prev]);
            } else if (statusData.status === "failed" || statusData.status === "timed_out") {
              clearInterval(pollInterval);
              setImportQueue(prev => prev.map(item => 
                item.id === newQueueItem.id
                  ? { ...item, status: statusData.status, title: "Extraction Failed", error: statusData.error || "Async extraction failed", progress: 0 }
                  : item
              ));
              updateGlobalJob(jobId, { status: 'Failed', error: statusData.error || "Async extraction failed" });
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
              updateGlobalJob(jobId, { status: 'Processing', progress: statusData.progress || 0 });
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
            <span className="flex-1">{toast.message}</span>
            {toast.actionLabel && toast.action && (
              <button 
                onClick={() => {
                  toast.action!();
                  removeToast(toast.id);
                }} 
                className="ml-2 px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-[10px] uppercase font-bold tracking-wider"
              >
                {toast.actionLabel}
              </button>
            )}
            <button onClick={() => removeToast(toast.id)} className="opacity-50 hover:opacity-100 ml-2 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      
      {/* Component Modals */}
      <CloudLibrary 
        isOpen={showCloudModal}
        onClose={() => setShowCloudModal(false)}
        activePlaylistId={activePlaylistId}
        cloudProject={cloudProject}
        onSaveCloudVersion={() => {}}
        onLoadSharedProject={(token) => {
          const jobId = `restore-${Date.now()}`;
          updateGlobalJob(jobId, { title: 'Restoring Cloud Project...', type: 'restore', status: 'Processing', progress: 30 });
          setTimeout(() => {
            updateGlobalJob(jobId, { status: 'Completed', progress: 100 });
            addToast("Project restored from cloud", "success", false, "View", () => setShowCloudModal(false));
          }, 2000);
        }}
        onViewPublishLinks={(versionId) => {
          setPublishTargetVersion(versionId);
          fetch(`http://127.0.0.1:8000/api/cloud/versions/${versionId}/links`)
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                setActivePublishLinks(data.links);
                setShowLinksModal(true);
              }
            });
        }}
        onPublishVersion={(versionId) => {
          setPublishTargetVersion(versionId);
          if (cloudProject) {
            fetch(`http://localhost:8000/api/cloud/projects/${cloudProject.id}/exports`)
              .then(res => res.json())
              .then(data => {
                if (data.success) {
                  setPublishTargetExports(data.exports.filter((e: any) => e.version_id === versionId));
                }
              })
              .finally(() => {
                setShowPublishModal(true);
              });
          } else {
            setShowPublishModal(true);
          }
        }}
        activeSessions={activeSessions}
      />
      <PublishModal 
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        onPublish={handlePublishVersion}
        availableExports={publishTargetExports}
      />
      <AccessManager 
        isOpen={showLinksModal}
        onClose={() => setShowLinksModal(false)}
        activeLinks={activePublishLinks}
        onRevoke={async (token) => {}}
      />
      <ReviewPanel 
        isOpen={isReviewPanelOpen}
        onClose={() => setIsReviewPanelOpen(false)}
        currentVersionId={currentVersionId}
        activeSessions={activeSessions}
        onSetFocus={(target) => setFocusTarget(target)}
      />
      <SharedProjectViewer 
        isReviewMode={isReviewMode}
        sharedProject={cloudProject}
        onExitReviewMode={() => setIsReviewMode(false)}
        onToggleReviewPanel={() => setIsReviewPanelOpen(!isReviewPanelOpen)}
        isReviewPanelOpen={isReviewPanelOpen}
        activeSessions={activeSessions}
      />

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
            { id: "assistant", label: "AI Assistant", icon: Sparkles },
            { id: "studio", label: "Mix Studio", icon: Sliders },
            { id: "export", label: "Export Center", icon: Download },
            { id: "playlists", label: "Library", icon: ListMusic },
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
        
        {/* Quick HUD & Help */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 font-mono text-[9px] text-neutral-500">
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${engine.deckA.playing ? 'bg-neon-cyan animate-ping' : 'bg-neutral-700'}`} />
              <span>DECK A: <b className="text-neutral-300 font-semibold">{engine.deckA.playing ? "PLAYING" : "IDLE"}</b></span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${engine.deckB.playing ? 'bg-neon-purple animate-ping' : 'bg-neutral-700'}`} />
              <span>DECK B: <b className="text-neutral-300 font-semibold">{engine.deckB.playing ? "PLAYING" : "IDLE"}</b></span>
            </div>
          </div>
          
          <button 
            onClick={() => setShowGuideOverlay(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
            title="Help & Guide"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="text-[10px] font-mono font-bold tracking-wider">GUIDE</span>
            <span className="text-[9px] font-mono font-bold bg-white/10 px-1.5 py-0.5 rounded ml-1">⌘K</span>
          </button>
        </div>
      </header>

      {showGuideOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-fade-in">
          <div className="bg-[#0a0a0e] border border-white/10 rounded-2xl w-full max-w-4xl shadow-[0_0_50px_rgba(0,0,0,1)] flex flex-col overflow-hidden max-h-screen">
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40">
              <div>
                <h2 className="text-2xl font-black italic tracking-tighter text-white">WORKSPACE GUIDE</h2>
                <p className="text-sm text-neutral-400 font-mono mt-1">Where to find powerful features in PulseMix</p>
              </div>
              <button onClick={() => { setShowGuideOverlay(false); localStorage.setItem('pulsemix_onboarded', 'true'); }} className="p-2 hover:bg-white/10 rounded-full text-neutral-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 bg-[radial-gradient(ellipse_at_top,rgba(14,14,19,0.35)_0%,rgba(3,3,5,1)_100%)] overflow-y-auto">
              
              {/* AI Assistant */}
              <div className="bg-black/40 border border-white/5 rounded-xl p-6 hover:border-neon-cyan/30 transition-colors flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-neon-cyan/10 flex items-center justify-center text-neon-cyan"><Sparkles className="w-5 h-5"/></div>
                  <h3 className="text-lg font-bold text-white">AI Assistant</h3>
                </div>
                <p className="text-sm text-neutral-400 italic mb-4">Your creative ideation and planning center.</p>
                <ul className="text-xs font-mono text-neutral-300 space-y-2 mb-6 flex-1">
                  <li>• <span className="text-neon-cyan">Recent Runs</span> (History of generated ideas)</li>
                  <li>• <span className="text-neon-cyan">Branch Comparison</span> (Side-by-side session diffs)</li>
                  <li>• <span className="text-neon-cyan">Favorites & Curation</span> (Star and filter best ideas)</li>
                </ul>
                <button onClick={() => { engine.setActiveTab('assistant'); setShowGuideOverlay(false); localStorage.setItem('pulsemix_onboarded', 'true'); }} className="w-full py-2.5 bg-white/5 hover:bg-neon-cyan hover:text-black border border-white/10 hover:border-neon-cyan rounded font-mono text-xs font-bold text-white transition-all">GO TO AI ASSISTANT</button>
              </div>

              {/* Mix Studio */}
              <div className="bg-black/40 border border-white/5 rounded-xl p-6 hover:border-neon-purple/30 transition-colors flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-neon-purple/10 flex items-center justify-center text-neon-purple"><Sliders className="w-5 h-5"/></div>
                  <h3 className="text-lg font-bold text-white">Mix Studio</h3>
                </div>
                <p className="text-sm text-neutral-400 italic mb-4">The core audio engine for real-time manipulation.</p>
                <ul className="text-xs font-mono text-neutral-300 space-y-2 mb-6 flex-1">
                  <li>• <span className="text-neon-purple">DJ Decks & Mixer</span> (EQ, Filters, Crossfader)</li>
                  <li>• <span className="text-neon-purple">Stem Extraction</span> (Isolate vocals/drums in real-time)</li>
                  <li>• <span className="text-neon-purple">Time Stretching</span> (BPM lock & sync)</li>
                </ul>
                <button onClick={() => { engine.setActiveTab('studio'); setShowGuideOverlay(false); localStorage.setItem('pulsemix_onboarded', 'true'); }} className="w-full py-2.5 bg-white/5 hover:bg-neon-purple hover:text-black border border-white/10 hover:border-neon-purple rounded font-mono text-xs font-bold text-white transition-all">GO TO MIX STUDIO</button>
              </div>

              {/* Library */}
              <div className="bg-black/40 border border-white/5 rounded-xl p-6 hover:border-white/30 transition-colors flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white"><ListMusic className="w-5 h-5"/></div>
                  <h3 className="text-lg font-bold text-white">Library</h3>
                </div>
                <p className="text-sm text-neutral-400 italic mb-4">Content, state, and project management.</p>
                <ul className="text-xs font-mono text-neutral-300 space-y-2 mb-6 flex-1">
                  <li>• <span className="text-white">Track Database</span> (Browse and analyze local audio)</li>
                  <li>• <span className="text-white">Cloud Projects</span> (Switch between workspaces)</li>
                  <li>• <span className="text-white">Version History</span> (Travel back to older states)</li>
                </ul>
                <button onClick={() => { engine.setActiveTab('playlists'); setShowGuideOverlay(false); localStorage.setItem('pulsemix_onboarded', 'true'); }} className="w-full py-2.5 bg-white/5 hover:bg-white hover:text-black border border-white/10 hover:border-white rounded font-mono text-xs font-bold text-white transition-all">GO TO LIBRARY</button>
              </div>

              {/* Export Center */}
              <div className="bg-black/40 border border-white/5 rounded-xl p-6 hover:border-green-400/30 transition-colors flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400"><Download className="w-5 h-5"/></div>
                  <h3 className="text-lg font-bold text-white">Export Center</h3>
                </div>
                <p className="text-sm text-neutral-400 italic mb-4">Rendering and final deliverables.</p>
                <ul className="text-xs font-mono text-neutral-300 space-y-2 mb-6 flex-1">
                  <li>• <span className="text-green-400">Playlists</span> (Drag-and-drop set building)</li>
                  <li>• <span className="text-green-400">Export Queue</span> (Offline rendering engine)</li>
                  <li>• <span className="text-green-400">Final Audio</span> (Download MP3/WAV deliverables)</li>
                </ul>
                <button onClick={() => { engine.setActiveTab('export'); setShowGuideOverlay(false); localStorage.setItem('pulsemix_onboarded', 'true'); }} className="w-full py-2.5 bg-white/5 hover:bg-green-400 hover:text-black border border-white/10 hover:border-green-400 rounded font-mono text-xs font-bold text-white transition-all">GO TO EXPORT CENTER</button>
              </div>

            </div>
            <div className="p-6 bg-black/80 border-t border-white/10">
              <h3 className="text-xs font-bold font-mono text-neutral-400 mb-4 flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-neutral-500" /> KEYBOARD SHORTCUTS
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-[10px] font-mono">
                <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-white/5 border border-white/5">
                  <span className="text-neutral-500 font-bold uppercase">Command Palette</span>
                  <span className="text-neon-cyan font-bold bg-neon-cyan/10 px-2 py-1 rounded inline-block w-fit">Cmd/Ctrl + K</span>
                </div>
                <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-white/5 border border-white/5">
                  <span className="text-neutral-500 font-bold uppercase">Go to AI Assistant</span>
                  <span className="text-white font-bold bg-white/10 px-2 py-1 rounded inline-block w-fit">Shift + A</span>
                </div>
                <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-white/5 border border-white/5">
                  <span className="text-neutral-500 font-bold uppercase">Go to Mix Studio</span>
                  <span className="text-white font-bold bg-white/10 px-2 py-1 rounded inline-block w-fit">Shift + M</span>
                </div>
                <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-white/5 border border-white/5">
                  <span className="text-neutral-500 font-bold uppercase">Go to Library</span>
                  <span className="text-white font-bold bg-white/10 px-2 py-1 rounded inline-block w-fit">Shift + L</span>
                </div>
                <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-white/5 border border-white/5">
                  <span className="text-neutral-500 font-bold uppercase">Go to Export</span>
                  <span className="text-white font-bold bg-white/10 px-2 py-1 rounded inline-block w-fit">Shift + E</span>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-white/10 bg-black flex justify-between items-center">
              <button 
                onClick={resetHints}
                className="px-4 py-2 text-neutral-500 hover:text-white font-mono text-xs transition-colors underline decoration-white/30"
              >
                RESET FEATURE HINTS
              </button>
              <button 
                onClick={() => { setShowGuideOverlay(false); localStorage.setItem('pulsemix_onboarded', 'true'); }}
                className="px-8 py-3 bg-white text-black font-bold font-mono text-sm hover:bg-neutral-300 transition-colors rounded shadow-lg"
              >
                GOT IT, LET'S MIX
              </button>
            </div>
          </div>
        </div>
      )}



        {/* Main Workspace Workspace */}
        <main className="flex-1 flex flex-col min-w-0 bg-[radial-gradient(ellipse_at_top,rgba(14,14,19,0.35)_0%,rgba(3,3,5,1)_100%)] overflow-y-auto">
          {/* Dynamic Inner Tab Router Content */}
          <div className="flex-1 flex flex-col p-6 overflow-hidden">
          
          {/* Tab 1: Mix Studio Panel */}
          {engine.activeTab === "studio" && (
            <div className="h-full flex flex-col gap-6 relative">
              
              {!engine.deckA.trackLoaded && !engine.deckB.trackLoaded && (
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 z-10 animate-fade-in text-center pointer-events-none">
                  <div className="bg-black/60 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-2xl">
                    <h3 className="text-xl font-bold font-mono text-white mb-2">Mix Studio is Empty</h3>
                    <p className="text-sm text-neutral-400">Apply a variation from the AI Assistant to arm the decks automatically,<br/>or load tracks manually via the Library.</p>
                  </div>
                </div>
              )}

              {engine.deckA.trackLoaded && !dismissedHints['studio_stem_extract'] && (
                <div className="absolute top-24 left-[10%] z-20 animate-fade-in pointer-events-auto">
                  <div className="bg-neon-purple/10 border border-neon-purple/30 p-4 rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.2)] flex items-start gap-4 max-w-sm backdrop-blur-md">
                    <Zap className="w-5 h-5 text-neon-purple shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-white font-mono mb-1">Stem Extraction</p>
                      <p className="text-xs text-neon-purple/70">Click the Zap icon on the deck to isolate vocals, drums, or bass in real-time.</p>
                    </div>
                    <button onClick={() => dismissHint('studio_stem_extract')} className="text-neutral-500 hover:text-white shrink-0"><X className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
              
              {/* Full-width FFT Spectrum Analyser Panel */}
              <div className="w-full h-20 flex-shrink-0">
                <Visualizer analyser={engine.analyserNodeRef.current} isPlaying={engine.deckA.playing || engine.deckB.playing} />
              </div>

              {/* Core studio grid: Side-by-Side Decks with Central Mixer */}
              <div className="flex-1 min-h-0 grid gap-6 grid-cols-1 xl:grid-cols-[1fr_420px_1fr] overflow-x-auto">
                
                {/* Left Side: Deck A */}
                <div className="min-w-0 flex flex-col h-full overflow-y-auto">
                  <DJDeck 
                    deckId="A" 
                    state={engine.deckA}
                    audioElem={engine.audioElemARef.current}
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
                    onEqChange={(band, val) => engine.updateEQ("A", band, val)}
                    onFilterChange={(val) => engine.updateFilter("A", val)}
                    onVolumeChange={(val) => engine.updateDeckVolume("A", val)}
                    onToggleCue={() => engine.toggleCue("A")}
                    onExtractStems={() => {
                      try {
                        addToast("Attempting to auto-recover missing media.", "info");
                        setRecoveringItem(null);
                      } catch(e) {}
                      addGlobalJob(`extract-deckA`, "Extracting Stems (Deck A)");
                      engine.extractStems("A");
                    }}
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
                    delayActive={engine.fxState.delay}
                    reverbActive={engine.fxState.reverb}
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
                    audioElem={engine.audioElemBRef.current}
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
                    onEqChange={(band, val) => engine.updateEQ("B", band, val)}
                    onFilterChange={(val) => engine.updateFilter("B", val)}
                    onVolumeChange={(val) => engine.updateDeckVolume("B", val)}
                    onToggleCue={() => engine.toggleCue("B")}
                    onExtractStems={() => {
                      engine.extractStems("B");
                      addToast("Isolating stems in the background.", "info");
                      addGlobalJob(`extract-deckB`, "Extracting Stems (Deck B)");
                    }}
                    onFileDrop={(file) => {
                      const url = URL.createObjectURL(file);
                      engine.loadTrack("B", url, file.name.replace(/\.[^/.]+$/, ""), 128, "8A", "", "Local File");
                    }}
                  />
                </div>

              </div>
            </div>
          )}

          {/* Tab: AI Assistant Panel */}
          {engine.activeTab === "assistant" && (
            <div className="space-y-6 max-w-3xl mx-auto w-full pt-4">
              
              <div className="text-center space-y-3 mb-8">
                <div className="inline-flex items-center justify-center p-4 bg-neon-cyan/10 rounded-full border border-neon-cyan/20 mb-2 shadow-[0_0_30px_rgba(34,211,238,0.15)]">
                  <Sparkles className="w-8 h-8 text-neon-cyan animate-pulse" />
                </div>
                <h2 className="text-3xl font-extrabold tracking-widest font-mono text-white">YOUTUBE TO AI DJ</h2>
                <p className="text-sm text-neutral-400 font-mono max-w-lg mx-auto">
                  Paste links, describe your desired mix style, and let PulseMix automatically extract stems, align tempos, and prepare a continuous club transition.
                </p>
              </div>

              {importQueue.length === 0 && !aiPrompt && (
                <div className="bg-neon-cyan/5 border border-neon-cyan/20 rounded-xl p-6 text-center animate-fade-in shadow-lg">
                  <h4 className="text-white font-bold font-mono text-lg mb-2 text-neon-cyan">Ready to Start</h4>
                  <p className="text-sm text-neutral-400">To begin, paste two YouTube URLs below to extract audio stems. Then describe your transition in the AI Mix Generation box.</p>
                </div>
              )}

              {aiSessionsList.length > 0 && !dismissedHints['ai_branching'] && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex gap-4 items-start animate-fade-in">
                  <div className="flex-1">
                    <p className="text-sm text-white font-mono mb-1">Tip: Session Branching</p>
                    <p className="text-xs text-neutral-400">Click DUPLICATE on any session in the Recent Runs list to create a branch, then select both to compare their variations side-by-side.</p>
                  </div>
                  <button onClick={() => dismissHint('ai_branching')} className="text-neutral-500 hover:text-white shrink-0"><X className="w-4 h-4" /></button>
                </div>
              )}

              {/* 1. Track Importer */}
              <div className="glass-panel rounded-3xl p-6 border border-white/5 space-y-4 shadow-xl shadow-black/40">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-neutral-800 text-xs font-bold text-white border border-white/10 font-mono">1</span>
                  <h3 className="text-sm font-bold tracking-wider font-mono text-neon-cyan">ADD SOURCE TRACKS</h3>
                </div>

                <form onSubmit={handleImport} className="flex gap-4">
                  <div className="relative flex-1">
                    <Link className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input 
                      type="text" 
                      placeholder="Paste YouTube Video URL here (e.g. https://youtube.com/watch?v=...)"
                      value={draftUrl}
                      onChange={(e) => setDraftUrl(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-sm outline-none focus:border-neon-cyan/50 text-white font-mono tracking-wide transition-all"
                    />
                  </div>
                  <button 
                    type="submit"
                    onClick={(e) => { e.preventDefault(); handleImport(e as any, draftUrl); setDraftUrl(""); }}
                    disabled={!draftUrl}
                    className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-bold px-6 py-3.5 rounded-xl transition-all text-xs tracking-wider font-mono flex items-center gap-2 cursor-pointer border border-white/5"
                  >
                    <Plus className="w-4 h-4" /> EXTRACT
                  </button>
                </form>

                {importError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-mono flex items-center gap-2">
                     <span className="font-bold">Error:</span> {importError}
                     <button onClick={() => setImportError(null)} className="ml-auto underline text-[10px]">Dismiss</button>
                  </div>
                )}
              </div>

              {/* Extraction Progress & Queue */}
              {importQueue.length > 0 && (
                <div className="glass-panel rounded-3xl p-6 border border-white/5 space-y-4 shadow-xl shadow-black/40">
                  <div className="flex items-center gap-2 mb-2">
                     <span className="flex items-center justify-center w-6 h-6 rounded-full bg-neutral-800 text-xs font-bold text-white border border-white/10 font-mono">2</span>
                     <h3 className="text-sm font-bold tracking-wider font-mono text-neutral-300">ANALYSIS & EXTRACTION</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {importQueue.map((item) => (
                      <div key={item.id} className="bg-black/40 rounded-2xl p-3 border border-white/5 flex flex-col gap-3 relative overflow-hidden group">
                        {(item.status === "downloading" || item.status === "analyzing" || item.status === "queued" || item.status === "fetching") && (
                           <div className="absolute top-0 left-0 h-0.5 bg-neutral-800 w-full z-0">
                              <div className="h-full bg-neon-cyan transition-all duration-300" style={{ width: `${Math.max(5, item.progress || 0)}%` }} />
                           </div>
                        )}
                        <div className="flex items-center gap-3 z-10">
                          <img src={item.thumbnail} alt="Thumbnail" className="w-12 h-12 object-cover rounded-lg bg-neutral-900 flex-shrink-0" />
                          <div className="flex-1 min-w-0 space-y-1 font-mono">
                            <p className="text-xs text-white truncate font-semibold leading-none">{item.title}</p>
                            <div className="flex gap-3 text-[10px] text-neutral-500">
                              <span>BPM: {item.bpm || "--"}</span>
                              <span>KEY: {item.key || "--"}</span>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            {item.status === "queued" || item.status === "fetching" ? (
                              <span className="text-[9px] font-bold text-neutral-400 bg-neutral-500/10 px-2 py-1 rounded">QUEUED</span>
                            ) : item.status === "downloading" ? (
                              <span className="text-[9px] font-bold text-sky-400 bg-sky-500/10 px-2 py-1 rounded animate-pulse">DL {Math.round(item.progress || 0)}%</span>
                            ) : item.status === "analyzing" ? (
                              <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded animate-pulse">ANALYZING</span>
                            ) : item.status === "completed" || item.status === "ready" || item.status === "from_cache" ? (
                              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded flex items-center gap-1"><Check className="w-3 h-3"/> DONE</span>
                            ) : (
                              <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-2 py-1 rounded flex items-center gap-1">FAILED</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Prompting & Generation */}
              <div className="glass-panel rounded-3xl p-6 border border-neon-cyan/20 bg-neon-cyan/[0.02] space-y-4 shadow-xl shadow-neon-cyan/5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-neon-cyan text-xs font-bold text-black font-mono">3</span>
                  <h3 className="text-sm font-bold tracking-wider font-mono text-neon-cyan">AI MIX GENERATION</h3>
                </div>

                <div className="space-y-4">
                  <textarea 
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Describe your mix (e.g., 'Start with track 1, build up, then hard cut to track 2 at the drop', 'Smooth vocal blend at 128 BPM')"
                    className="w-full bg-black/60 border border-white/10 focus:border-neon-cyan/50 rounded-xl p-4 text-sm outline-none text-white font-mono min-h-[100px] resize-none transition-all placeholder:text-neutral-600"
                  />
                  <button 
                    onClick={handleGenerateMix}
                    disabled={isGeneratingMix || !aiPrompt}
                    className={`w-full py-4 rounded-xl font-bold tracking-widest text-sm flex items-center justify-center gap-3 transition-all ${
                      isGeneratingMix || !aiPrompt 
                        ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-neon-purple to-neon-cyan text-white shadow-lg shadow-neon-cyan/20 hover:brightness-110'
                    }`}
                  >
                    {isGeneratingMix ? (
                       <> <Sparkles className="w-5 h-5 animate-spin" /> GENERATING AUTOMATIONS... </>
                    ) : (
                       <> <Flame className="w-5 h-5" /> GENERATE MIX </>
                    )}
                  </button>

                  {/* Skeleton Loader during Generation */}
                  {isGeneratingMix && (
                    <div className="pt-6 border-t border-neon-cyan/10 flex flex-col gap-6 animate-in fade-in zoom-in duration-500">
                      <h3 className="text-white font-bold tracking-widest font-mono text-sm uppercase flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-neon-cyan animate-spin" /> GENERATING VARIATIONS...
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="p-4 rounded-xl border border-white/5 bg-white/5 animate-pulse flex flex-col gap-4">
                            <div className="flex justify-between items-center mb-2">
                              <div className="h-5 w-20 bg-white/10 rounded"></div>
                              <div className="h-5 w-16 bg-white/10 rounded"></div>
                            </div>
                            <div className="h-4 w-3/4 bg-white/10 rounded"></div>
                            <div className="h-4 w-1/2 bg-white/10 rounded"></div>
                            <div className="mt-2 space-y-2 border-t border-white/5 pt-4">
                              <div className="h-10 w-full bg-white/10 rounded-lg"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Variations Panel & Handoff */}
                  {!isGeneratingMix && mixVariations.length > 0 && (
                    <div className="pt-6 border-t border-neon-cyan/10 animate-fade-in flex flex-col gap-6">
                      <h3 className="text-white font-bold tracking-widest font-mono text-sm uppercase">Select Mix Variation</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {mixVariations.map((variant, idx) => (
                          <div 
                            key={variant.variation_id}
                            onClick={() => setSelectedVariationIndex(idx)}
                            className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col gap-3 ${
                              selectedVariationIndex === idx 
                                ? 'bg-neon-cyan/10 border-neon-cyan/50 shadow-[0_0_15px_rgba(0,255,255,0.1)]' 
                                : 'bg-white/5 border-white/10 hover:border-white/30 hover:bg-white/10'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-xs font-bold font-mono tracking-wider px-2 py-1 rounded border ${
                                variant.confidence_tier === 'Strong' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                variant.confidence_tier === 'Good' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                                'bg-purple-500/20 text-purple-400 border-purple-500/30'
                              }`}>
                                {variant.confidence_tier.toUpperCase()} TIER
                              </span>
                              {selectedVariationIndex === idx && <Check className="w-4 h-4 text-neon-cyan" />}
                            </div>

                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-bold font-mono tracking-wider px-2 py-1 rounded ${
                                variant.variation_type === 'primary' ? 'bg-blue-500/20 text-blue-400' :
                                variant.variation_type === 'energy_alt' ? 'bg-orange-500/20 text-orange-400' :
                                'bg-purple-500/20 text-purple-400'
                              }`}>
                                {variant.strategy.toUpperCase()}
                              </span>
                            </div>
                            
                            <div className="text-white text-sm">
                              <div className="flex items-center justify-between py-1 border-b border-white/5">
                                <span className="text-neutral-400 text-xs">BPM</span>
                                <span className="font-mono">{variant.suggested_bpm}</span>
                              </div>
                              <div className="flex items-center justify-between py-1 border-b border-white/5">
                                <span className="text-neutral-400 text-xs">Key</span>
                                <span className="font-mono text-xs">{variant.key_relationship}</span>
                              </div>
                              <div className="flex items-center justify-between py-1 border-b border-white/5">
                                <span className="text-neutral-400 text-xs">Transition</span>
                                {selectedVariationIndex === idx ? (
                                  <select 
                                    className="bg-black/50 border border-white/10 text-white text-xs font-mono rounded px-1 py-0.5 outline-none"
                                    value={variant.transition_type}
                                    onChange={(e) => {
                                      const newVars = [...mixVariations];
                                      newVars[idx].transition_type = e.target.value;
                                      setMixVariations(newVars);
                                    }}
                                  >
                                    <option value={variant.transition_type}>{variant.transition_type}</option>
                                    {variant.transition_alternatives.map((alt: string) => (
                                      <option key={alt} value={alt}>{alt}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="font-mono text-xs text-neon-cyan">{variant.transition_type}</span>
                                )}
                              </div>
                            </div>
                            
                            <p className="text-xs text-neutral-400 leading-relaxed mt-1">
                              {variant.explanation}
                            </p>

                            <ul className="text-[10px] space-y-1 text-neutral-500 font-mono mt-1 mb-2">
                              {variant.attributes && variant.attributes.map((attr: string, i: number) => (
                                <li key={i} className="flex items-center gap-1"><div className="w-1 h-1 rounded-full bg-white/20"></div> {attr}</li>
                              ))}
                            </ul>

                            {selectedVariationIndex === idx && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAiPreviewTransition(variant);
                                }}
                                className={`w-full py-2 rounded-lg text-xs font-bold font-mono transition-colors flex justify-center items-center gap-2 ${
                                  playingPreviewId === variant.variation_id 
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                                    : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
                                }`}
                              >
                                {playingPreviewId === variant.variation_id ? (
                                  <>STOP PREVIEW <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></div></>
                                ) : (
                                  <>PREVIEW SIMULATION <Play className="w-3 h-3" /></>
                                )}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-center mt-4">
                        <button
                          onClick={async () => {
                            const selected = mixVariations[selectedVariationIndex];
                            const { deck_a, deck_b, suggested_bpm } = selected;
                            
                            // Populate the AudioEngine decks
                            engine.loadTrack("A", deck_a.url, deck_a.title, suggested_bpm, deck_a.key, deck_a.thumbnail, deck_a.genre || "Auto", deck_a.youtube_url || deck_a.url, deck_a.stem_status);
                            engine.loadTrack("B", deck_b.url, deck_b.title, suggested_bpm, deck_b.key, deck_b.thumbnail, deck_b.genre || "Auto", deck_b.youtube_url || deck_b.url, deck_b.stem_status);
                            
                            if (currentAiSessionId) {
                               try {
                                 await fetch(`http://127.0.0.1:8000/api/ai/sessions/${currentAiSessionId}/apply`, {
                                   method: "PUT",
                                   headers: { "Content-Type": "application/json" },
                                   body: JSON.stringify({
                                     project_id: cloudProject?.id || null,
                                     version_id: currentVersionId || null
                                   })
                                 });
                                 fetchAiSessions(); // refresh
                               } catch (err) {
                                 console.error("Failed to apply session", err);
                               }
                            }
                            
                            engine.setActiveTab("studio");
                          }}
                          className="px-8 py-3 rounded-full bg-white text-black hover:bg-neutral-200 font-bold text-sm tracking-wider font-mono transition-colors shadow-lg flex items-center gap-2"
                        >
                          APPLY VARIATION TO STUDIO <Sliders className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* AI Sessions Sidebar/Modal overlay */}
          {showSessionsPanel && (
            <div className="fixed inset-0 z-[100] flex">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSessionsPanel(false)} />
              <div className="relative ml-auto w-96 h-full bg-[#111] border-l border-white/10 shadow-2xl flex flex-col">
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                  <h2 className="text-lg font-bold font-mono tracking-widest text-white flex items-center gap-2">
                    <History className="w-5 h-5 text-neon-cyan" /> RECENT RUNS
                  </h2>
                  <button onClick={() => setShowSessionsPanel(false)} className="text-neutral-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {/* Content Panel */}
                <div className="flex-1 overflow-y-auto p-8 relative">
                  {isCompareMode && compareData ? (
                    // Phase 36: Compare View
                    <div className="h-full flex flex-col">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold font-mono tracking-widest text-white flex items-center gap-2">
                          <Activity className="w-6 h-6 text-neon-cyan" /> COMPARE BRANCHES
                        </h2>
                        <button 
                          onClick={() => setIsCompareMode(false)}
                          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-mono text-sm rounded transition-colors"
                        >
                          EXIT COMPARE
                        </button>
                      </div>
                      <div className="flex-1 grid grid-cols-2 gap-6">
                        {[compareData.session1, compareData.session2].map((session, index) => {
                          const isDiffPrompt = compareData.diff.prompt_changed;
                          const activeVariant = session.variations[session.selected_variation_index] || session.variations[0];
                          return (
                            <div key={session.id} className="bg-black/60 border border-white/10 rounded-xl p-6 flex flex-col relative overflow-hidden">
                              {/* Lineage Badge */}
                              <div className="absolute top-0 right-0 bg-white/10 px-3 py-1 rounded-bl-lg text-[10px] font-mono text-white/70">
                                {session.parent_session_id ? `Child of #${session.parent_session_id}` : `Root Draft`}
                              </div>
                              <div className="absolute top-8 right-2">
                                {session.rating === 'favorite' && <Star className="w-4 h-4 text-neon-cyan fill-neon-cyan" />}
                                {session.rating === 'rejected' && <XCircle className="w-4 h-4 text-red-500" />}
                              </div>
                              
                              <h3 className="text-lg font-bold text-white mb-2">{session.name} <span className="text-neutral-500 font-normal">#{session.id}</span></h3>
                              
                              <div className="mb-4">
                                <span className="text-xs text-neutral-400 font-mono mb-1 block">PROMPT</span>
                                <p className={`text-sm italic p-3 rounded bg-black/40 ${isDiffPrompt ? 'border border-neon-cyan/30 text-neon-cyan/90' : 'text-neutral-300'}`}>
                                  "{session.prompt}"
                                </p>
                                {isDiffPrompt && <div className="text-[10px] text-neon-cyan mt-1 font-mono">Changes detected</div>}
                              </div>
                              
                              <div className="mb-4 flex-1">
                                <span className="text-xs text-neutral-400 font-mono mb-2 block">SELECTED VARIATION</span>
                                {activeVariant ? (
                                  <div className="bg-white/5 border border-white/10 rounded p-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="font-bold text-white text-sm">Strategy: {activeVariant.transition_type}</span>
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                        activeVariant.confidence_tier === 'Strong' ? 'bg-green-500/20 text-green-400' :
                                        activeVariant.confidence_tier === 'Good' ? 'bg-blue-500/20 text-blue-400' :
                                        'bg-yellow-500/20 text-yellow-400'
                                      }`}>
                                        {activeVariant.confidence_tier?.toUpperCase() || 'EXPERIMENTAL'}
                                      </span>
                                    </div>
                                    <p className="text-xs text-neutral-400 mb-2 leading-relaxed">{activeVariant.explanation}</p>
                                    <ul className="text-[10px] font-mono text-neutral-500 space-y-1">
                                      {activeVariant.attributes?.map((attr: string, i: number) => (
                                        <li key={i}>• {attr}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : (
                                  <div className="text-xs text-neutral-500 italic">No variations available.</div>
                                )}
                              </div>
                              
                              <div className="mt-auto">
                                <button
                                  onClick={async () => {
                                    if (!activeVariant) return;
                                    const { deck_a, deck_b, suggested_bpm } = activeVariant;
                                    engine.loadTrack("A", deck_a.url, deck_a.title, suggested_bpm, deck_a.key, deck_a.thumbnail, deck_a.genre || "Auto", deck_a.youtube_url || deck_a.url, deck_a.stem_status);
                                    engine.loadTrack("B", deck_b.url, deck_b.title, suggested_bpm, deck_b.key, deck_b.thumbnail, deck_b.genre || "Auto", deck_b.youtube_url || deck_b.url, deck_b.stem_status);
                                    
                                    try {
                                       await fetch(`http://127.0.0.1:8000/api/ai/sessions/${session.id}/apply`, {
                                         method: "PUT",
                                         headers: { "Content-Type": "application/json" },
                                         body: JSON.stringify({ project_id: cloudProject?.id || null, version_id: currentVersionId || null })
                                       });
                                       fetchAiSessions();
                                    } catch (err) {
                                       console.error("Failed to apply session", err);
                                    }
                                    
                                    setIsCompareMode(false);
                                    engine.setActiveTab("studio");
                                  }}
                                  disabled={!activeVariant}
                                  className="w-full py-3 bg-white text-black hover:bg-neutral-200 font-bold font-mono text-sm tracking-widest rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  APPLY THIS VARIATION
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-2xl mx-auto flex flex-col h-full">
                      <div className="mb-8">
                        <h2 className="text-3xl font-black italic tracking-tighter text-white mb-2 flex items-center gap-3">
                          <Sparkles className="w-8 h-8 text-neon-cyan" />
                          AI MIX ASSISTANT
                        </h2>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <div className="flex gap-2 mb-4 border-b border-white/10 pb-2">
                    <button onClick={() => setSessionsFilter('all')} className={`text-xs font-mono px-3 py-1 rounded transition-colors ${sessionsFilter === 'all' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white'}`}>ALL</button>
                    <button onClick={() => setSessionsFilter('favorites')} className={`text-xs font-mono px-3 py-1 rounded transition-colors ${sessionsFilter === 'favorites' ? 'bg-neon-cyan/20 text-neon-cyan' : 'text-neutral-500 hover:text-white'}`}>FAVORITES</button>
                    <button onClick={() => setSessionsFilter('applied')} className={`text-xs font-mono px-3 py-1 rounded transition-colors ${sessionsFilter === 'applied' ? 'bg-green-500/20 text-green-400' : 'text-neutral-500 hover:text-white'}`}>APPLIED</button>
                  </div>
                  {aiSessionsList.filter(s => {
                    if (sessionsFilter === 'favorites') return s.rating === 'favorite';
                    if (sessionsFilter === 'applied') return s.status === 'applied';
                    return true;
                  }).map((session) => {
                    const isSelected = selectedForCompare.includes(session.id);
                    return (
                    <div 
                      key={session.id} 
                      onClick={() => handleLoadSession(session.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-colors group relative ${currentAiSessionId === session.id ? 'bg-white/10 border-white/20' : 'bg-black/50 border-white/5 hover:bg-white/5 hover:border-white/10'} ${isSelected ? 'border-neon-cyan shadow-[0_0_10px_rgba(0,255,255,0.2)]' : ''}`}
                    >
                      <div className="absolute top-2 right-2 flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={(e) => { e.stopPropagation(); toggleCompareSelection(e as any, session.id); }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded bg-black border border-white/20 accent-neon-cyan cursor-pointer"
                          title="Select for comparison"
                        />
                      </div>
                      <div className="flex items-center justify-between mb-2 pr-8">
                        <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded ${session.status === 'applied' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                          {session.status.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          {new Date(session.updated_at * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white mb-1 truncate">{session.name} {session.parent_session_id && <span className="text-neutral-500 font-normal text-xs">← #{session.parent_session_id}</span>}</h3>
                      <p className="text-xs text-neutral-400 line-clamp-2 italic mb-3">"{session.prompt}"</p>
                      <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => handleRateSession(session.id, session.rating === 'favorite' ? 'unrated' : 'favorite', e)}
                          className={`p-1 rounded hover:bg-white/10 ${session.rating === 'favorite' ? 'text-neon-cyan' : 'text-neutral-500'}`}
                        >
                          <Star className={`w-4 h-4 ${session.rating === 'favorite' ? 'fill-neon-cyan' : ''}`} />
                        </button>
                        <button 
                          onClick={(e) => handleRateSession(session.id, session.rating === 'rejected' ? 'unrated' : 'rejected', e)}
                          className={`p-1 rounded hover:bg-white/10 ${session.rating === 'rejected' ? 'text-red-500' : 'text-neutral-500'}`}
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => handleDuplicateSession(session.id, e)}
                          className="text-xs font-mono px-3 py-1 bg-white/10 rounded hover:bg-white/20 text-white flex items-center gap-1"
                        >
                          <History className="w-3 h-3" /> DUPLICATE
                        </button>
                      </div>
                    </div>
                  )})}
                  {aiSessionsList.length === 0 && (
                    <div className="text-center p-8 text-neutral-500 text-sm font-mono italic">
                      No recent AI runs found.
                    </div>
                  )}
                </div>
                {selectedForCompare.length === 2 && (
                  <div className="p-4 border-t border-white/10 bg-black/50">
                    <button 
                      onClick={handleCompareSessions}
                      className="w-full py-3 bg-neon-cyan text-black hover:brightness-110 font-bold font-mono tracking-widest text-sm rounded shadow-lg shadow-neon-cyan/20 transition-all"
                    >
                      COMPARE SELECTED
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}



          {/* Tab 4: Export Center Panel */}
          {(engine.activeTab === "export" || engine.activeTab === "playlists") && (
            <div className="h-full flex gap-6">
              {/* Left Column: Timeline Editor */}
              {engine.activeTab === "export" && (
                <div className="w-2/3 flex-shrink-0 flex flex-col gap-4 overflow-hidden">
                  {activePlaylistId ? (
                    <ExportTimeline 
                      playlistId={activePlaylistId}
                      items={activePlaylistItems}
                      onItemsUpdated={() => loadPlaylistItems(activePlaylistId)}
                      globalSettings={globalExportSettings}
                      onUpdateGlobalSettings={setGlobalExportSettings}
                      playback={playback}
                      positionedBlocks={positionedBlocks}
                    />
                  ) : (
                    <div className="flex-1 bg-black/40 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center p-4 opacity-50">
                      <ListMusic className="w-8 h-8 text-neutral-500 mb-3" />
                      <p className="text-sm font-mono text-neutral-400 mb-2">No Playlist Selected</p>
                      <p className="text-xs text-neutral-500">Go to the Library tab and load a playlist.</p>
                    </div>
                  )}
                </div>
              )}

              <div className="w-1/3 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
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

                  {!dismissedHints['export_offline'] && (
                    <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-xl flex items-start gap-4 mb-6">
                      <Download className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-white font-mono mb-1">Offline Rendering Engine</p>
                        <p className="text-xs text-green-400/70">Exporting processes all stem isolations, EQ sweeps, and custom crossfades locally before generating your high-quality MP3/WAV deliverable.</p>
                      </div>
                      <button onClick={() => dismissHint('export_offline')} className="text-neutral-500 hover:text-white shrink-0"><X className="w-4 h-4" /></button>
                    </div>
                  )}

                  <div className="flex flex-col gap-6">
                    {/* Playlist Export Source */}
                    <div className="bg-black/30 rounded-xl p-5 border border-white/5 space-y-4">
                      <h3 className="font-bold text-sm tracking-wider font-mono text-neon-cyan">EXPORT PLAYLIST</h3>
                      <p className="text-xs text-neutral-400">Renders the currently active playlist as a continuous mixed track.</p>
                      
                      {activePlaylistId ? (
                        <div className="p-4 bg-white/5 rounded-lg font-mono text-xs text-white border border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <span>Selected: <span className="font-bold text-neon-cyan">{playlists.find(p => p.id === activePlaylistId)?.name}</span></span>
                          <span className="text-neutral-400 bg-black/40 px-2 py-1 rounded">{activePlaylistItems.length} Tracks</span>
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
                            onClick={() => setShowExportModal(true)}
                            disabled={activePlaylistItems.some(i => !i.filepath) || (exportStatus !== null && exportStatus !== 'completed' && exportStatus !== 'failed')}
                            className={`w-full py-4 rounded-xl font-extrabold text-[12px] font-mono tracking-wider transition-colors shadow-lg ${activePlaylistItems.some(i => !i.filepath) ? 'bg-red-500/20 text-red-400 border border-red-500/50 shadow-red-500/10 cursor-not-allowed' : 'bg-neon-cyan hover:bg-neon-cyan/80 text-black disabled:opacity-50 shadow-neon-cyan/10'}`}
                          >
                            {activePlaylistItems.some(i => !i.filepath) ? 'MISSING MEDIA (EXPORT DISABLED)' : (exportStatus === 'queued' || exportStatus === 'rendering' ? 'EXPORT IN PROGRESS...' : 'PACKAGE & EXPORT SET')}
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Export Status & Progress */}
                    <div className="bg-black/30 rounded-xl p-5 border border-white/5 space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="font-bold text-sm tracking-wider font-mono text-neon-purple">COMPLETED RENDERS</h3>
                        <button className="text-xs text-neon-cyan hover:underline font-mono" onClick={fetchExportHistory}>REFRESH</button>
                      </div>
                      
                      {!exportStatus && exportHistory.length === 0 ? (
                        <div className="h-full min-h-[120px] flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-xl gap-2">
                          <Download className="w-5 h-5 text-neutral-600" />
                          <span className="text-neutral-500 font-mono text-xs">Ready to export mix.</span>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center font-mono text-xs">
                            <span className="text-white">STATUS: <span className={`uppercase font-bold inline-flex items-center gap-2 ${
                              exportStatus === 'completed' ? 'text-emerald-400' :
                              exportStatus === 'failed' ? 'text-red-400' :
                              exportStatus === 'rendering' ? 'text-blue-400' :
                              'text-neon-cyan'
                            }`}>
                              {exportStatus === 'rendering' && <Loader2 className="w-3 h-3 animate-spin" />}
                              {exportStatus === 'queued' && <Loader2 className="w-3 h-3 animate-pulse" />}
                              {exportStatus === 'completed' && <CheckCircle className="w-3 h-3" />}
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
                          
                          {exportStatus === 'completed' && exportDownloadUrl && (
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
                                <Download className="w-4 h-4" /> DOWNLOAD PACKAGE (.ZIP)
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
                            {exportHistory.map((job) => {
                              let metaName = job.id.split("-")[0];
                              try {
                                if (job.metadata) {
                                  const m = JSON.parse(job.metadata);
                                  if (m.export_name) metaName = m.export_name;
                                }
                              } catch(e) {}
                              return (
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
                                    <span className="text-white font-mono text-xs font-bold block truncate max-w-[200px]" title={metaName}>
                                      {metaName}
                                    </span>
                                    <span className="text-neutral-500 text-[10px] font-mono block">
                                      {new Date(job.created_at + "Z").toLocaleString()}
                                    </span>
                                  </div>
                                  <span className={`text-[10px] font-mono font-bold uppercase px-2 py-1 rounded ${
                                    job.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                                    job.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                    job.status === 'queued' ? 'bg-neutral-500/20 text-neutral-400' :
                                    'bg-neon-cyan/20 text-neon-cyan'
                                  }`}>
                                    {job.status}
                                  </span>
                                </div>
                              
                              {job.status === 'completed' && job.file_path && (
                                <a 
                                  href={job.file_path}
                                  download
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1.5 text-xs text-neon-cyan hover:text-white font-mono transition-colors mt-2"
                                >
                                  <Download className="w-3 h-3" /> Download .zip
                                </a>
                              )}
                            </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Playlists Panel */}
          {engine.activeTab === "playlists" && (
            <div className="h-full flex flex-col gap-6 max-w-6xl mx-auto w-full pt-4">
              
              {!dismissedHints['library_versions'] && (
                <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-start gap-4">
                  <History className="w-5 h-5 text-neutral-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-white font-mono mb-1">Cloud Versions</p>
                    <p className="text-xs text-neutral-400">Every time you apply an AI variation, PulseMix saves a Cloud Version. You can select older versions in the top-right header to restore previous states.</p>
                  </div>
                  <button onClick={() => dismissHint('library_versions')} className="text-neutral-500 hover:text-white shrink-0"><X className="w-4 h-4" /></button>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-0">
              
              {/* Left Sidebar: Playlists List */}
              <div className="w-full lg:col-span-1 flex flex-col gap-4">
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
                    
                    <input 
                      type="file" 
                      ref={importFileRef} 
                      onChange={handleImportPackage} 
                      accept=".zip,application/json" 
                      className="hidden" 
                    />
                    <button
                      onClick={() => importFileRef.current?.click()}
                      className="w-full bg-transparent border border-white/20 hover:border-white/50 text-white font-extrabold text-[11px] font-mono tracking-wider py-3 rounded-xl transition-all flex items-center justify-center gap-2 mt-2"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      IMPORT PACKAGE
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
                      <div className="flex-1 min-w-0 flex flex-col gap-4">
                        {/* Phase 12: Global Transport Bar */}
                        <div className="glass-panel rounded-2xl p-4 border border-white/5 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => playback.isPlayingGlobal ? playback.pausePlayback() : playback.startPlayback()}
                              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${playback.isPlayingGlobal ? 'bg-amber-500/20 text-amber-500' : 'bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30'}`}
                            >
                              {playback.isPlayingGlobal ? <span className="w-3 h-3 bg-current rounded-sm" /> : <Play className="w-4 h-4 ml-1" />}
                            </button>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-neutral-500 font-mono font-bold tracking-widest">GLOBAL TRANSPORT</span>
                              <span className="text-white font-mono text-sm font-bold">
                                {Math.floor(playback.globalTimeMs / 60000)}:
                                {Math.floor((playback.globalTimeMs % 60000) / 1000).toString().padStart(2, '0')}.
                                {Math.floor((playback.globalTimeMs % 1000) / 10).toString().padStart(2, '0')}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {playback.auditionMode !== "none" && (
                              <div className={`px-2 py-1 rounded text-[9px] font-mono font-bold border ${playback.auditionMode === 'approx' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20'}`}>
                                AUDITION MODE: {playback.auditionMode === 'approx' ? 'Browser Approx' : 'Render-Exact'}
                              </div>
                            )}
                            <div className="px-2 py-1 rounded bg-black/40 text-[9px] font-mono text-neutral-400 border border-white/5 flex items-center gap-1">
                              <span>[CF: {Math.round(engine.crossfader)}%]</span>
                              <span>[EQ: {playback.activeBoundaryItem ? 'AUTOMATED' : 'DEFAULT'}]</span>
                            </div>
                          </div>
                        </div>

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
                            positionedBlocks={positionedBlocks}
                            globalTimeMs={playback.globalTimeMs}
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
                                  {!item.filepath && <span className="ml-2 text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">MISSING MEDIA</span>}
                                  {item.relink_method === 'manual' && <span className="ml-2 text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 border border-amber-500/30" title="Relinked Manually">MANUAL RELINK</span>}
                                  {item.relink_warning && <span className="ml-2 text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 inline-flex items-center gap-1" title={item.relink_warning}><AlertTriangle className="w-2.5 h-2.5" /> MISMATCH</span>}
                                  <h5 className="text-xs font-bold text-white truncate leading-snug">{item.title}</h5>
                                      <div className="flex flex-col gap-0.5 text-[10px] text-neutral-500 pt-1">
                                        <span>⏱️ {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, "0")}</span>
                                        <span>BPM: <b className="text-white font-semibold">{item.bpm || 'None'}</b> {item.raw_bpm ? `(Raw: ${item.raw_bpm})` : ''} {item.bpm_confidence && item.bpm_confidence < 0.4 && <span className="ml-1 text-[8px] bg-white/10 px-1 py-0.5 rounded text-neutral-400" title="Low BPM confidence">Low Confidence</span>}</span>
                                        <span>KEY: <b className="text-white font-semibold">{item.key_camelot || item.key_signature || 'None'}</b> {item.key_signature && item.key_camelot && `(${item.key_signature})`} {item.key_confidence && item.key_confidence < 0.4 && <span className="ml-1 text-[8px] bg-white/10 px-1 py-0.5 rounded text-neutral-400" title="Low Key confidence">Low Confidence</span>}</span>
                                        <span>ANALYSIS: <b className="text-white font-semibold uppercase">{item.analysis_status || 'PENDING'}</b> {item.beatgrid && item.beatgrid !== '[]' && <span className="ml-1 text-[8px] bg-green-500/20 text-green-400 px-1 py-0.5 rounded border border-green-500/30" title="Beatgrid & Phrase markers available">TIMING READY</span>} {item.downbeat_confidence && item.downbeat_confidence < 0.4 && <span className="ml-1 text-[8px] bg-white/10 px-1 py-0.5 rounded text-neutral-400" title="Low Phrase confidence">Low Phrase Conf</span>}</span>
                                        <div className="pt-2">
                                          {!item.filepath ? (
                                            <div className="flex gap-2 items-center">
                                              <div className="inline-block px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-[9px] font-mono font-bold tracking-widest">
                                                SOURCE FILE MISSING
                                              </div>
                                              <button onClick={() => setRecoveringItem(item)} className="px-2 py-0.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded text-[9px] font-mono font-bold tracking-widest transition-colors">
                                                RECOVER
                                              </button>
                                            </div>
                                          ) : item.stem_status === "READY" ? (
                                            <div className="inline-block px-2 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-[9px] font-mono font-bold tracking-widest">
                                              STEMS READY
                                            </div>
                                          ) : item.stem_status === "EXTRACTING" ? (
                                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded text-[9px] font-mono font-bold tracking-widest">
                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                            EXTRACTING...
                                          </div>
                                        ) : (
                                          <button
                                            onClick={async () => {
                                              try {
                                                // Optimistic update
                                                const updatedItems = activePlaylistItems.map(i => i.item_id === item.item_id ? { ...i, stem_status: 'EXTRACTING' } : i);
                                                setActivePlaylistItems(updatedItems);
                                                addToast("Isolating stems in the background.", "info");
                                                addGlobalJob(`extract-${item.item_id}`, `Extracting Stems (${item.title})`);
                                                await fetch("/api/stems/extract", {
                                                  method: "POST",
                                                  headers: { "Content-Type": "application/json" },
                                                  body: JSON.stringify({ youtube_url: item.youtube_url })
                                                });
                                                
                                                // Start polling just for this item
                                                const poll = setInterval(async () => {
                                                  try {
                                                    const res = await fetch(`/api/stems/status?youtube_url=${encodeURIComponent(item.youtube_url)}`);
                                                    if (res.ok) {
                                                      const data = await res.json();
                                                      if (data.stem_status === "READY" || data.stem_status === "FAILED") {
                                                        clearInterval(poll);
                                                        setActivePlaylistItems(prev => prev.map(i => i.item_id === item.item_id ? { ...i, stem_status: data.stem_status } : i));
                                                        removeGlobalJob(`extract-${item.item_id}`);
                                                        if (data.stem_status === "READY") {
                                                          addToast(`Finished extracting stems for ${item.title}.`, "success");
                                                        }
                                                      }
                                                    }
                                                  } catch(e){}
                                                }, 3000);
                                              } catch (e) {
                                                setActivePlaylistItems(prev => prev.map(i => i.item_id === item.item_id ? { ...i, stem_status: 'FAILED' } : i));
                                              }
                                            }}
                                            className="px-2 py-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/30 rounded text-[9px] font-mono font-bold tracking-widest transition-colors flex items-center gap-1.5"
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neon-cyan"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                                            EXTRACT STEMS
                                          </button>
                                        )}
                                      </div>
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
                                <label className="flex flex-col gap-1 text-[10px] font-mono text-neutral-400 mt-3">
                                  PHRASE SNAP
                                  <select defaultValue={item.phrase_snap_override || ''}
                                    onChange={(e) => {
                                      fetch(`http://127.0.0.1:8000/api/playlist-items/${item.item_id}`, {
                                        method: "PUT",
                                        headers: {"Content-Type": "application/json"},
                                        body: JSON.stringify({ phrase_snap_override: e.target.value === '' ? null : e.target.value })
                                      }).then(() => loadPlaylistItems(activePlaylistId as number));
                                    }}
                                    className="bg-black/50 border border-white/10 rounded px-3 py-2 w-full text-white focus:outline-none focus:border-neon-cyan/50">
                                    <option value="">Global Default</option>
                                    <option value="Force Snap">Force Snap</option>
                                    <option value="Force Manual">Force Manual</option>
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
                                  <span className="text-white font-bold">{item.snapped_reason ? item.snapped_reason : (item.is_snapped ? 'snapped' : 'raw ms')}</span>
                                </div>
                              </div>

                              <div className="pt-3 border-t border-white/5 flex gap-2 flex-col">
                                <div className="relative w-full flex">
                                  <button 
                                    onClick={() => playback.liveAuditionBoundary(item.position_index)}
                                    disabled={item.position_index === 0}
                                    className={`flex-1 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-l-xl font-bold font-mono text-[10px] transition-colors flex items-center justify-center gap-2 ${item.position_index === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    <Volume2 className="w-4 h-4" /> LIVE AUDITION (APPROX)
                                  </button>
                                  <button
                                    onClick={() => setShowAuditionDropdown(!showAuditionDropdown)}
                                    disabled={item.position_index === 0}
                                    className={`px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-r-xl border-l border-emerald-500/20 flex items-center justify-center ${item.position_index === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                  </button>
                                  
                                  {showAuditionDropdown && item.position_index > 0 && (
                                    <div className="absolute top-full mt-1 right-0 w-48 bg-black/90 border border-white/10 rounded-lg overflow-hidden shadow-2xl z-50">
                                      <button
                                        onClick={() => {
                                          setShowAuditionDropdown(false);
                                          handlePreviewTransition(item.item_id, activePlaylistId as number);
                                        }}
                                        className="w-full text-left px-4 py-3 hover:bg-white/5 text-[10px] font-mono text-white flex items-center gap-2"
                                      >
                                        <Download className="w-3 h-3 text-neutral-400" />
                                        OFFLINE RENDER (EXACT)
                                      </button>
                                    </div>
                                  )}
                                </div>
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
                                              <span>KEY: {rec.track.key_camelot || rec.track.key_signature || '--'}</span>
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
                <p className="text-[10px] text-neutral-500">BPM: {trackToAdd.bpm} • KEY: {trackToAdd.key_camelot || trackToAdd.key || trackToAdd.key_signature}</p>
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

      {/* Phase 41: Global Activity Tray */}
      {globalJobs.length > 0 && (
        <div className="fixed bottom-14 right-6 z-[90] flex flex-col gap-2 pointer-events-none">
          <div className="flex flex-col gap-2 pointer-events-auto items-end group">
            <div className="bg-neutral-900/90 backdrop-blur border border-white/10 rounded-full px-4 py-2 shadow-2xl flex items-center gap-3 cursor-pointer hover:border-white/20 transition-all text-xs font-mono group-hover:px-5">
              <Loader2 className="w-4 h-4 text-neon-cyan animate-spin" />
              <span className="text-white font-bold">{globalJobs.filter(j => j.status === 'Processing' || j.status === 'Queued').length} Active Jobs</span>
            </div>
            <div className="flex flex-col gap-2 bg-neutral-900/90 backdrop-blur border border-white/10 rounded-xl p-3 shadow-2xl w-72 max-h-96 overflow-y-auto custom-scrollbar opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all origin-bottom-right">
              <div className="text-[10px] font-bold text-neutral-500 tracking-wider mb-1 uppercase">Background Tasks</div>
              {globalJobs.map(job => (
                <div key={job.id} className="bg-black/50 border border-white/5 rounded-lg p-3 flex flex-col gap-2 relative overflow-hidden">
                  <div className="flex items-center justify-between z-10">
                    <span className="text-white font-bold text-xs truncate mr-2" title={job.title}>{job.title}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      job.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' :
                      job.status === 'Failed' ? 'bg-red-500/20 text-red-400' :
                      job.status === 'Queued' ? 'bg-amber-500/20 text-amber-500' :
                      'bg-neon-cyan/20 text-neon-cyan'
                    }`}>{job.status}</span>
                  </div>
                  {(job.status === 'Processing' || job.status === 'Queued') && typeof job.progress === 'number' && (
                    <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden z-10">
                      <div className="bg-neon-cyan h-full transition-all duration-300" style={{ width: `${job.progress}%` }} />
                    </div>
                  )}
                  {job.status === 'Failed' && (
                    <div className="text-[10px] text-red-400 z-10 break-words">{job.error || 'An error occurred'}</div>
                  )}
                  {/* Subtle Background Progress effect */}
                  {(job.status === 'Processing' || job.status === 'Queued') && typeof job.progress === 'number' && (
                    <div className="absolute left-0 top-0 bottom-0 bg-white/5 z-0 transition-all duration-300" style={{ width: `${job.progress}%` }} />
                  )}
                  {(job.status === 'Completed' || job.status === 'Failed') && (
                     <button onClick={() => removeGlobalJob(job.id)} className="absolute top-2.5 right-2 opacity-0 hover:opacity-100 transition-opacity z-20">
                       <X className="w-3 h-3 text-neutral-400 hover:text-white" />
                     </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Phase 40: Command Palette */}
      {showCommandPalette && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[#0a0a0e] border border-white/20 w-full max-w-2xl rounded-2xl shadow-[0_0_50px_rgba(0,0,0,1)] overflow-hidden flex flex-col animate-fade-in">
            <div className="flex items-center p-4 border-b border-white/10 bg-black/40">
              <Search className="w-5 h-5 text-neutral-400 mr-3" />
              <input 
                autoFocus
                value={commandQuery}
                onChange={(e) => { setCommandQuery(e.target.value); setCommandSelectedIndex(0); }}
                placeholder="Type a command or search... (e.g., 'mix', 'help')"
                className="flex-1 bg-transparent border-none outline-none text-white font-mono text-sm placeholder:text-neutral-600"
              />
              <div className="text-[10px] font-mono font-bold px-2 py-1 bg-white/10 rounded text-neutral-400">ESC</div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {filteredCommands.length === 0 ? (
                <div className="p-8 text-center text-neutral-500 font-mono text-xs">No commands found.</div>
              ) : (
                filteredCommands.map((cmd, idx) => {
                  const isSelected = idx === commandSelectedIndex;
                  return (
                    <div 
                      key={cmd.id}
                      onClick={() => { cmd.action(); setShowCommandPalette(false); }}
                      onMouseEnter={() => setCommandSelectedIndex(idx)}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-neon-cyan/20 border border-neon-cyan/30' : 'hover:bg-white/5 border border-transparent'}`}
                    >
                      <div className="flex items-center gap-3">
                        <Command className={`w-4 h-4 ${isSelected ? 'text-neon-cyan' : 'text-neutral-400'}`} />
                        <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-neutral-300'}`}>{cmd.title}</span>
                      </div>
                      <span className={`text-[9px] font-mono font-bold uppercase px-2 py-1 rounded ${isSelected ? 'bg-neon-cyan/20 text-neon-cyan' : 'bg-white/10 text-neutral-500'}`}>{cmd.category}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
      {/* Missing Media Recovery Modal */}
      {recoveringItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-lg p-6 flex flex-col gap-6 shadow-2xl relative">
            <button className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors" onClick={() => setRecoveringItem(null)}>
              <X className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg font-bold tracking-wider font-mono text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                RECOVER MISSING MEDIA
              </h2>
              <p className="text-sm text-neutral-400 mt-2">
                The file for <span className="text-white font-bold">{recoveringItem.title}</span> is missing from disk.
                Choose a method to recover the asset and reconnect it to your timeline.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => handleRecoverAuto(recoveringItem)}
                className="bg-black/30 hover:bg-black/50 border border-white/5 hover:border-neon-cyan/50 rounded-xl p-5 text-left flex flex-col gap-2 transition-all group"
              >
                <Download className="w-6 h-6 text-neon-cyan group-hover:scale-110 transition-transform" />
                <span className="text-sm font-bold text-white font-mono uppercase">Auto-Recover</span>
                <span className="text-xs text-neutral-500">Re-download the original track from YouTube if it still exists.</span>
              </button>

              <button
                onClick={() => manualFileRef.current?.click()}
                className="bg-black/30 hover:bg-black/50 border border-white/5 hover:border-amber-500/50 rounded-xl p-5 text-left flex flex-col gap-2 transition-all group"
              >
                <Upload className="w-6 h-6 text-amber-500 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-bold text-white font-mono uppercase">Manual Relink</span>
                <span className="text-xs text-neutral-500">Upload a replacement local file. (Duration checks apply)</span>
              </button>
            </div>
            <input type="file" ref={manualFileRef} onChange={handleRecoverManual} accept="audio/*" className="hidden" />
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-white/10 p-6 rounded-2xl w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white font-mono tracking-wider">PACKAGE EXPORT</h3>
              <button onClick={() => setShowExportModal(false)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-neutral-400 mb-2">EXPORT NAME</label>
                <input 
                  type="text" 
                  value={exportNameInput}
                  onChange={(e) => setExportNameInput(e.target.value)}
                  placeholder={`Export_${new Date().toISOString().split('T')[0]}`}
                  className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white font-mono focus:border-neon-cyan focus:outline-none"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer mt-4">
                <input 
                  type="checkbox" 
                  checked={autoPhraseSnap} 
                  onChange={(e) => setAutoPhraseSnap(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-black text-neon-cyan focus:ring-neon-cyan focus:ring-offset-black"
                />
                <span className="text-sm font-mono text-white">Auto-Snap to Phrases (High Confidence)</span>
              </label>
              <div className="text-xs text-neutral-500 font-mono p-3 bg-white/5 rounded-lg border border-white/5">
                The export will be packaged as a .zip containing:
                <ul className="list-disc list-inside mt-2 text-neutral-400 space-y-1">
                  <li>mix.wav (Full Audio)</li>
                  <li>manifest.json (Session Data)</li>
                  <li>tracklist.txt (DJ Tracklist)</li>
                </ul>
              </div>
            </div>
            
            <div className="mt-8 flex justify-end gap-3">
              <button 
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded-lg text-sm font-bold text-white transition-colors"
              >
                CANCEL
              </button>
              <button 
                onClick={handleExportPlaylist}
                className="px-4 py-2 bg-neon-cyan hover:bg-neon-cyan/80 text-black rounded-lg text-sm font-bold tracking-wider transition-colors shadow-lg shadow-neon-cyan/20"
              >
                RENDER & PACKAGE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
