import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Settings2, Check, Music, ChevronDown, ChevronUp, PlayCircle, Play, Pause, Square, Sparkles, AlertTriangle, Activity, History, Camera, X } from 'lucide-react';
import Waveform from './Waveform';

interface ExportTimelineProps {
  playlistId: number;
  items: any[];
  onItemsUpdated: () => void;
  globalSettings: {
    crossfade_duration_ms: number;
    fade_curve: string;
    eq_mode: string;
  };
  onUpdateGlobalSettings: (settings: any) => void;
  playback: any;
  positionedBlocks: any[];
}

export default function ExportTimeline({
  playlistId,
  items,
  onItemsUpdated,
  globalSettings,
  onUpdateGlobalSettings,
  playback,
  positionedBlocks
}: ExportTimelineProps) {
  const [expandedCardIdx, setExpandedCardIdx] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Record<number, any>>({});
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [setAnalysis, setSetAnalysis] = useState<any>(null);
  const [isAnalyzingSet, setIsAnalyzingSet] = useState(false);
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [compareSnapshot, setCompareSnapshot] = useState<any>(null);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [showSnapshotsList, setShowSnapshotsList] = useState(false);

  const fetchSnapshots = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/playlists/${playlistId}/snapshots`);
      const data = await res.json();
      if (data.success) {
        setSnapshots(data.snapshots || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (playlistId) {
      fetchSnapshots();
    }
  }, [playlistId]);

  const createSnapshot = async (name: string, sourceType: string = 'manual', reason: string = '') => {
    setIsSavingSnapshot(true);
    try {
      await fetch(`http://localhost:8000/api/playlists/${playlistId}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, source_type: sourceType, reason })
      });
      await fetchSnapshots();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingSnapshot(false);
    }
  };

  const fetchSetAnalysis = async () => {
    setIsAnalyzingSet(true);
    setShowAnalysisPanel(true);
    try {
      const res = await fetch(`http://localhost:8000/api/playlists/${playlistId}/set-analysis`);
      const data = await res.json();
      if (data.success) {
        setSetAnalysis(data);
      }
    } catch (e) {
      console.error("Failed to load set analysis", e);
    } finally {
      setIsAnalyzingSet(false);
    }
  };

  const applyRecommendedSequence = async () => {
    if (!setAnalysis?.recommended_order) return;
    try {
      await createSnapshot("Auto: Before Optimization", "auto", "Optimization");
      await fetch(`http://localhost:8000/api/playlists/${playlistId}/items/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: setAnalysis.recommended_order })
      });
      onItemsUpdated();
      setShowAnalysisPanel(false);
      setSetAnalysis(null);
    } catch (e) {
      console.error("Failed to apply recommended sequence", e);
    }
  };

  const restoreSnapshot = async (snapshotId: number) => {
    try {
      await fetch(`http://localhost:8000/api/playlists/${playlistId}/snapshots/${snapshotId}/restore`, {
        method: 'POST'
      });
      onItemsUpdated();
      setCompareSnapshot(null);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (playlistId) {
      fetch(`http://localhost:8000/api/playlists/${playlistId}/transition-suggestions`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setSuggestions(data.suggestions || {});
          }
        })
        .catch(err => console.error("Failed to load suggestions", err));
    }
  }, [playlistId, items]);

  const applySuggestion = async (itemId: number, suggestion: any) => {
    try {
      await fetch(`http://localhost:8000/api/playlist-items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crossfade_duration_ms: suggestion.crossfade_duration_ms,
          fade_curve: suggestion.fade_curve,
          eq_mode: suggestion.eq_mode
        })
      });
      onItemsUpdated();
    } catch (e) {
      console.error("Failed to apply suggestion", e);
    }
  };

  const optimizeEntireSet = async () => {
    setIsOptimizing(true);
    try {
      // Find all untouched transitions (where settings are null)
      const updates = [];
      for (const item of items) {
        if (item.crossfade_duration_ms == null && item.fade_curve == null && item.eq_mode == null) {
          const suggestion = suggestions[item.item_id];
          if (suggestion) {
            updates.push(applySuggestion(item.item_id, suggestion));
          }
        }
      }
      await Promise.all(updates);
    } finally {
      setIsOptimizing(false);
    }
  };

  const moveItem = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === items.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const itemIds = items.map(i => i.item_id);
    // Swap
    const temp = itemIds[index];
    itemIds[index] = itemIds[newIndex];
    itemIds[newIndex] = temp;

    try {
      await fetch(`http://localhost:8000/api/playlists/${playlistId}/items/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: itemIds })
      });
      onItemsUpdated();
    } catch (e) {
      console.error("Failed to reorder", e);
    }
  };

  const updateItemTransition = async (itemId: number, updates: any) => {
    try {
      await fetch(`http://localhost:8000/api/playlist-items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      onItemsUpdated();
    } catch (e) {
      console.error("Failed to update transition", e);
    }
  };

  const renderInspector = (mode: string) => {
    if (!mode || mode === 'none') {
      return (
        <div className="mt-4 p-3 bg-black/40 border border-white/5 rounded-lg">
          <p className="text-xs text-neutral-400 font-mono">Standard volume crossfade. All stems fade out and in equally.</p>
        </div>
      );
    }

    return (
      <div className="mt-4 p-4 bg-black/40 border border-white/5 rounded-lg space-y-3">
        <h4 className="text-[10px] font-bold text-white/50 uppercase tracking-widest font-mono">Visual Inspector</h4>
        
        {mode === 'bass_swap' && (
          <div className="space-y-2">
            <p className="text-xs text-neutral-300 font-mono">Outgoing Bass ducks instantly (-60dB), Incoming Bass punches in without muddiness.</p>
            <div className="flex flex-col gap-1">
              <div className="flex gap-2 items-center text-[10px] font-mono text-neutral-500">
                <span className="w-12">OUT BASS</span>
                <div className="flex-1 h-2 bg-gradient-to-r from-neon-purple to-transparent rounded-full" />
              </div>
              <div className="flex gap-2 items-center text-[10px] font-mono text-neutral-500">
                <span className="w-12">IN BASS</span>
                <div className="flex-1 h-2 bg-gradient-to-r from-transparent to-neon-cyan rounded-full" />
              </div>
            </div>
          </div>
        )}

        {mode === 'vocal_protect' && (
          <div className="space-y-2">
            <p className="text-xs text-neutral-300 font-mono">Vocals use Equal Power curve to prevent volume dips during the transition.</p>
            <div className="flex gap-2 items-center text-[10px] font-mono text-neutral-500">
              <span className="w-12">VOCALS</span>
              <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-r from-neon-purple via-white/80 to-neon-cyan opacity-80" />
              </div>
            </div>
          </div>
        )}

        {mode === 'soft_exit' && (
          <div className="space-y-2">
            <p className="text-xs text-neutral-300 font-mono">Instrumental and drum stems fade out faster (-6dB ducking) to clear room.</p>
            <div className="flex gap-2 items-center text-[10px] font-mono text-neutral-500">
              <span className="w-12">DRUMS</span>
              <div className="flex-1 h-2 bg-gradient-to-r from-neon-purple to-black rounded-full" />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-black/20 rounded-xl border border-white/5">
      {/* Global Settings Header */}
      <div className="p-4 border-b border-white/5 bg-black/40 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-white tracking-widest font-mono flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-neon-cyan" /> GLOBAL DEFAULTS
          </h3>
          
          {playback && (
            <div className="flex items-center gap-2 bg-black/60 rounded border border-white/10 p-1">
              {playback.isPlayingGlobal ? (
                <button onClick={() => playback.pausePlayback()} className="p-1 hover:bg-white/10 rounded text-neon-cyan"><Pause className="w-4 h-4" /></button>
              ) : (
                <button onClick={() => playback.startPlayback()} className="p-1 hover:bg-white/10 rounded text-white"><Play className="w-4 h-4" /></button>
              )}
              <button 
                onClick={() => {
                  playback.pausePlayback();
                  playback.setAuditionMode("none");
                }} 
                className="p-1 hover:bg-white/10 rounded text-white/50 hover:text-red-400"
              >
                <Square className="w-4 h-4" />
              </button>
            </div>
          )}
          
          <div className="flex gap-2 ml-auto">
            <button 
              onClick={() => setShowSnapshotsList(!showSnapshotsList)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-xs font-bold font-mono transition-colors"
            >
              <History className="w-3 h-3" />
              VERSIONS
            </button>
            <button 
              onClick={fetchSetAnalysis}
              disabled={isAnalyzingSet}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold font-mono transition-colors ${showAnalysisPanel ? 'bg-neon-cyan text-black' : 'bg-white/10 hover:bg-white/20 text-white'}`}
            >
              <Activity className="w-3 h-3" />
              {isAnalyzingSet ? 'ANALYZING...' : 'ANALYZE SET'}
            </button>
            {Object.keys(suggestions).length > 0 && (
              <button 
                onClick={optimizeEntireSet}
                disabled={isOptimizing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-xs font-bold font-mono transition-colors"
              >
                <Sparkles className="w-3 h-3 text-neon-purple" />
                {isOptimizing ? 'OPTIMIZING...' : 'OPTIMIZE ENTIRE SET'}
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-[10px] text-neutral-500 font-mono block mb-1">DURATION</label>
            <select 
              value={globalSettings.crossfade_duration_ms}
              onChange={(e) => onUpdateGlobalSettings({ ...globalSettings, crossfade_duration_ms: parseInt(e.target.value) })}
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white font-mono"
            >
              <option value="0">0ms (Cut)</option>
              <option value="1000">1000ms</option>
              <option value="2000">2000ms</option>
              <option value="4000">4000ms</option>
              <option value="8000">8000ms</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-neutral-500 font-mono block mb-1">CURVE</label>
            <select 
              value={globalSettings.fade_curve}
              onChange={(e) => onUpdateGlobalSettings({ ...globalSettings, fade_curve: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white font-mono"
            >
              <option value="linear">Linear</option>
              <option value="equal_power">Equal Power</option>
            </select>
          </div>
        </div>
      </div>

      {/* Snapshots Dropdown */}
      {showSnapshotsList && (
        <div className="absolute top-16 right-4 w-64 bg-black border border-white/10 rounded shadow-xl z-50 flex flex-col">
          <div className="p-3 border-b border-white/10 flex justify-between items-center bg-white/5">
            <span className="text-xs font-bold text-white font-mono">SNAPSHOTS</span>
            <button 
              onClick={() => {
                const name = prompt("Enter snapshot name:");
                if (name) createSnapshot(name);
              }}
              className="text-[10px] bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan hover:text-black px-2 py-1 rounded font-bold transition-colors flex items-center gap-1"
            >
              <Camera className="w-3 h-3" /> NEW
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto p-2 space-y-1">
            {snapshots.length === 0 ? (
              <div className="p-2 text-xs text-neutral-500 font-mono text-center">No snapshots saved.</div>
            ) : (
              snapshots.map((s, i) => (
                <div key={i} className="p-2 hover:bg-white/5 rounded flex justify-between items-center group cursor-pointer" onClick={() => {
                  setCompareSnapshot(s);
                  setShowSnapshotsList(false);
                }}>
                  <div>
                    <div className="text-xs text-white font-mono flex items-center gap-1">
                      {s.source_type === 'auto' && <Sparkles className="w-3 h-3 text-neon-purple" />}
                      {s.name}
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      {new Date(s.created_at).toLocaleString()}
                    </div>
                  </div>
                  <button className="opacity-0 group-hover:opacity-100 text-[10px] text-neon-cyan border border-neon-cyan/30 px-2 py-0.5 rounded hover:bg-neon-cyan hover:text-black transition-colors">
                    COMPARE
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Compare Mode Panel */}
      {compareSnapshot && (
        <div className="bg-neon-purple/20 border-b border-neon-purple p-4 shrink-0 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white tracking-widest font-mono flex items-center gap-2">
              <History className="w-4 h-4 text-neon-purple" /> COMPARE MODE: {compareSnapshot.name}
            </h4>
            <button onClick={() => setCompareSnapshot(null)} className="text-neutral-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <p className="text-xs text-neutral-300 font-mono mb-2">You are viewing a past snapshot. Restoring will overwrite the current live playlist arrangement.</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setCompareSnapshot(null)}
                className="px-4 py-2 border border-white/20 hover:bg-white/10 text-white rounded text-xs font-bold font-mono transition-colors"
              >
                CANCEL
              </button>
              <button 
                onClick={() => restoreSnapshot(compareSnapshot.id)}
                className="px-4 py-2 bg-neon-purple hover:bg-neon-purple/80 text-white rounded text-xs font-bold font-mono transition-colors"
              >
                RESTORE SNAPSHOT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Arc Analysis Panel */}
      {showAnalysisPanel && setAnalysis && (
        <div className="bg-black/60 border-b border-neon-cyan/30 p-4 shrink-0 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white tracking-widest font-mono flex items-center gap-2">
              <Activity className="w-4 h-4 text-neon-cyan" /> SET ARC ANALYSIS
            </h4>
            <button onClick={() => setShowAnalysisPanel(false)} className="text-neutral-500 hover:text-white">
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-4">
            {/* Charts */}
            <div className="flex-1 space-y-4">
              <div>
                <p className="text-[10px] text-neutral-500 font-mono mb-2">CURRENT ENERGY CURVE</p>
                <div className="h-16 flex items-end gap-1">
                  {setAnalysis.current_curve.map((c: any, i: number) => (
                    <div key={i} className="flex-1 bg-white/20 hover:bg-white/40 transition-colors rounded-t group relative" style={{ height: `${c.energy * 10}%` }}>
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-black text-[10px] text-white px-2 py-1 rounded whitespace-nowrap pointer-events-none z-50 border border-white/10">
                        {c.title} (E: {c.energy})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {setAnalysis.recommended_curve?.length > 0 && setAnalysis.issues?.length > 0 && (
                <div>
                  <p className="text-[10px] text-neon-cyan font-mono mb-2">RECOMMENDED CURVE</p>
                  <div className="h-16 flex items-end gap-1">
                    {setAnalysis.recommended_curve.map((c: any, i: number) => (
                      <div key={i} className="flex-1 bg-neon-cyan/50 hover:bg-neon-cyan transition-colors rounded-t group relative" style={{ height: `${c.energy * 10}%` }}>
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-black text-[10px] text-white px-2 py-1 rounded whitespace-nowrap pointer-events-none z-50 border border-neon-cyan/50">
                          {c.title} (E: {c.energy})
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Issues & Actions */}
            <div className="w-1/3 flex flex-col gap-3 border-l border-white/10 pl-4">
              <div>
                <p className="text-[10px] text-neutral-500 font-mono mb-2">DETECTED ISSUES</p>
                {setAnalysis.issues?.length > 0 ? (
                  <div className="space-y-2">
                    {setAnalysis.issues.map((issue: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-yellow-500 text-xs font-mono">
                        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                        <span className="leading-tight">{issue.reason}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-green-400 font-mono flex items-center gap-1"><Check className="w-3 h-3" /> Set arc flows well.</p>
                )}
              </div>
              
              {setAnalysis.issues?.length > 0 && (
                <div className="mt-auto">
                  <button 
                    onClick={applyRecommendedSequence}
                    className="w-full py-2 bg-neon-cyan/20 hover:bg-neon-cyan text-neon-cyan hover:text-black rounded text-xs font-bold font-mono transition-colors"
                  >
                    APPLY BETTER FLOW
                  </button>
                  <p className="text-[10px] text-neutral-500 mt-2 text-center">Changes order only. Transitions preserved.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2 relative">
        {items.some(i => !i.filepath) && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <div>
                <h4 className="text-red-400 font-bold font-mono text-sm">MISSING MEDIA DETECTED</h4>
                <p className="text-xs text-red-400/70">Some tracks are missing their source files. Export is disabled.</p>
              </div>
            </div>
            <button 
              onClick={async () => {
                const missing = items.filter(i => !i.filepath);
                for (const item of missing) {
                  try {
                    await fetch("http://localhost:8000/api/tracks/recover/auto", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ url: item.youtube_url })
                    });
                  } catch(e) {}
                }
              }}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-black rounded text-xs font-bold font-mono transition-colors border border-red-500/30 hover:border-transparent"
            >
              AUTO-RECOVER ALL
            </button>
          </div>
        )}
        {items.map((item, idx) => {
          const nextItem = items[idx + 1];
          // We use nextItem's transition properties for the boundary between item and nextItem.
          // Wait, in standard DJ timelines, transition *into* a track is stored on the incoming track.
          // Let's use `nextItem` properties for the transition card.

          const duration = nextItem?.crossfade_duration_ms ?? globalSettings.crossfade_duration_ms;
          const curve = nextItem?.fade_curve ?? globalSettings.fade_curve;
          const eqMode = nextItem?.eq_mode ?? globalSettings.eq_mode;
          
          const isInherited = nextItem?.crossfade_duration_ms == null && nextItem?.fade_curve == null && nextItem?.eq_mode == null;
          const block = positionedBlocks.find(b => b.item_id === item.item_id);
          const isAuditioning = playback?.activeBoundaryItem === nextItem?.item_id && playback?.auditionMode === "approx";
          const suggestion = nextItem ? suggestions[nextItem.item_id] : null;
          
          return (
            <React.Fragment key={item.item_id}>
              {/* Track Card */}
              <div className={`border rounded-lg p-3 flex items-center justify-between group relative overflow-hidden ${!item.filepath ? 'bg-red-500/5 border-red-500/20 opacity-70' : 'bg-white/5 border-white/10'}`}>
                {/* Waveform Background */}
                {block && item.filepath && (
                  <Waveform 
                    dataStr={block.waveform_data} 
                    durationMs={block.durationMs} 
                    trimStart={block.trimStart} 
                    trimEnd={block.trimEnd}
                    color="text-white"
                    opacity="opacity-[0.03]"
                    topOffset="0"
                    bottomOffset="0"
                  />
                )}
                
                <div className="flex items-center gap-3 overflow-hidden relative z-10 pointer-events-none">
                  <div className="w-8 h-8 rounded bg-black/50 flex items-center justify-center shrink-0">
                    <span className="text-xs font-mono font-bold text-white/50">{idx + 1}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{item.title}</p>
                    <p className="text-xs text-neutral-500 truncate flex items-center gap-2">
                      <span>{item.artist || "Unknown"} • {item.bpm || "--"} BPM</span>
                      {!item.filepath && <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-[8px] font-bold tracking-widest uppercase">MISSING MEDIA</span>}
                      {item.relink_method === 'manual' && <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded text-[8px] font-bold tracking-widest uppercase" title="Relinked Manually">MANUAL RELINK</span>}
                      {item.relink_warning && <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-[8px] font-bold tracking-widest uppercase flex items-center gap-1" title={item.relink_warning}><AlertTriangle className="w-2.5 h-2.5" /> MISMATCH</span>}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => moveItem(idx, 'up')} disabled={idx === 0} className="p-1.5 hover:bg-white/10 rounded disabled:opacity-30"><ArrowUp className="w-4 h-4 text-white" /></button>
                  <button onClick={() => moveItem(idx, 'down')} disabled={idx === items.length - 1} className="p-1.5 hover:bg-white/10 rounded disabled:opacity-30"><ArrowDown className="w-4 h-4 text-white" /></button>
                </div>
              </div>

              {/* Transition Card */}
              {nextItem && (
                <div className="px-6 py-1">
                  <div className={`border rounded-lg overflow-hidden transition-all duration-300 ${isAuditioning ? 'bg-neon-cyan/10 border-neon-cyan/50 shadow-[0_0_15px_rgba(0,255,255,0.1)]' : 'bg-black/40 border-white/10'}`}>
                    <div 
                      className={`p-2.5 flex items-center justify-between cursor-pointer ${isAuditioning ? 'hover:bg-neon-cyan/5' : 'hover:bg-white/5'}`}
                      onClick={() => setExpandedCardIdx(expandedCardIdx === idx ? null : idx)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-1 h-4 rounded-full bg-neon-cyan" />
                        <span className="text-xs font-mono text-neutral-400">
                          {isInherited ? <span className="text-neutral-500 italic">Inherited</span> : <span className="text-neon-purple font-bold">Custom</span>}
                          <span className="mx-2">•</span>
                          {duration}ms
                          <span className="mx-2">•</span>
                          {curve === 'equal_power' ? 'Equal Power' : 'Linear'}
                          <span className="mx-2">•</span>
                          {eqMode === 'none' ? 'Standard' : eqMode === 'bass_swap' ? 'Bass Swap' : eqMode === 'vocal_protect' ? 'Vocal Protect' : 'Soft Exit'}
                        </span>
                        
                        {suggestion?.warning && (
                          <div className="flex items-center gap-1 text-[10px] text-yellow-500 font-mono" title={suggestion.warning}>
                            <AlertTriangle className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            playback.liveAuditionBoundary(idx + 1);
                          }}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold font-mono transition-colors ${
                            isAuditioning ? 'bg-neon-cyan text-black hover:bg-white' : 'bg-white/10 text-white hover:bg-neon-cyan hover:text-black'
                          }`}
                        >
                          <PlayCircle className="w-3 h-3" />
                          PREVIEW
                        </button>
                        {expandedCardIdx === idx ? <ChevronUp className="w-4 h-4 text-neutral-500" /> : <ChevronDown className="w-4 h-4 text-neutral-500" />}
                      </div>
                    </div>

                    {expandedCardIdx === idx && (
                      <div className="p-4 border-t border-white/5 bg-black/60">
                        {suggestion && (
                          <div className="mb-4 p-3 bg-neon-purple/10 border border-neon-purple/20 rounded-lg flex items-start justify-between">
                            <div className="flex-1 pr-4">
                              <p className="text-xs text-neutral-300 font-mono mb-1">{suggestion.reason}</p>
                              {suggestion.warning && <p className="text-[10px] text-yellow-500 font-mono mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> {suggestion.warning}</p>}
                            </div>
                            <button 
                              onClick={() => applySuggestion(nextItem.item_id, suggestion)}
                              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-neon-purple/20 hover:bg-neon-purple/40 text-white rounded text-xs font-bold font-mono transition-colors"
                            >
                              <Sparkles className="w-3 h-3 text-neon-cyan" />
                              SUGGEST
                            </button>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-[10px] text-neutral-500 font-mono block mb-1">DURATION</label>
                            <select 
                              value={nextItem.crossfade_duration_ms ?? ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? null : parseInt(e.target.value);
                                updateItemTransition(nextItem.item_id, { crossfade_duration_ms: val });
                              }}
                              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white font-mono"
                            >
                              <option value="">Inherit ({globalSettings.crossfade_duration_ms}ms)</option>
                              <option value="0">0ms (Cut)</option>
                              <option value="1000">1000ms</option>
                              <option value="2000">2000ms</option>
                              <option value="4000">4000ms</option>
                              <option value="8000">8000ms</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-neutral-500 font-mono block mb-1">CURVE</label>
                            <select 
                              value={nextItem.fade_curve ?? ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? null : e.target.value;
                                updateItemTransition(nextItem.item_id, { fade_curve: val });
                              }}
                              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white font-mono"
                            >
                              <option value="">Inherit ({globalSettings.fade_curve})</option>
                              <option value="linear">Linear</option>
                              <option value="equal_power">Equal Power</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-neutral-500 font-mono block mb-1">EQ MODE (STEMS)</label>
                            <select 
                              value={nextItem.eq_mode ?? ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? null : e.target.value;
                                updateItemTransition(nextItem.item_id, { eq_mode: val });
                              }}
                              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white font-mono"
                            >
                              <option value="">Inherit ({globalSettings.eq_mode})</option>
                              <option value="none">Standard</option>
                              <option value="bass_swap">Bass Swap</option>
                              <option value="vocal_protect">Vocal Protect</option>
                              <option value="soft_exit">Soft Exit</option>
                            </select>
                          </div>
                        </div>

                        {renderInspector(eqMode)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
