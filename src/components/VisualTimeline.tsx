import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, ZoomIn, ZoomOut } from 'lucide-react';

interface VisualTimelineProps {
  items: any[];
  onUpdateItem: (itemId: number, updates: any) => void;
  selectedItemId: number | null;
  onSelectItem: (itemId: number) => void;
  positionedBlocks: any[];
  globalTimeMs: number;
}

const Waveform = ({ dataStr, durationMs, trimStart, trimEnd }: { dataStr: string, durationMs: number, trimStart: number, trimEnd: number }) => {
  if (!dataStr || dataStr === "[]") return null;
  let points: number[] = [];
  try { points = JSON.parse(dataStr); } catch { return null; }
  if (!points.length || !durationMs) return null;

  const startRatio = Math.max(0, trimStart / durationMs);
  const endRatio = Math.min(1, trimEnd / durationMs);
  const startIndex = Math.floor(startRatio * points.length);
  const endIndex = Math.ceil(endRatio * points.length);
  const visiblePoints = points.slice(startIndex, endIndex);
  if (!visiblePoints.length) return null;

  const width = 1000;
  const height = 100;
  const stepX = width / visiblePoints.length;
  const path = visiblePoints.map((val, i) => {
    const x = i * stepX;
    const y = (1 - val) * height;
    return `${x},${y}`;
  }).join(' ') + ` ${width},${height} 0,${height}`;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40 mix-blend-screen pointer-events-none" style={{ top: '24px', bottom: '24px' }}>
      <svg width="100%" height="100%" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
        <polygon points={path} fill="currentColor" className="text-neon-cyan" />
      </svg>
    </div>
  );
};

export default function VisualTimeline({ items, onUpdateItem, selectedItemId, onSelectItem, positionedBlocks, globalTimeMs }: VisualTimelineProps) {
  const [snapToBeat, setSnapToBeat] = useState(false);
  const [msPerPixel, setMsPerPixel] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Dragging state
  const [draggingBlock, setDraggingBlock] = useState<{id: number, type: 'start'|'end', startX: number, initialVal: number, bpm: number | null} | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingBlock) return;
      const dx = e.clientX - draggingBlock.startX;
      const deltaMs = dx * msPerPixel;
      
      let newMs = draggingBlock.initialVal + deltaMs;
      
      if (snapToBeat && draggingBlock.bpm) {
        const msPerBeat = 60000 / draggingBlock.bpm;
        newMs = Math.round(newMs / msPerBeat) * msPerBeat;
      }
      newMs = Math.max(0, newMs);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!draggingBlock) return;
      const dx = e.clientX - draggingBlock.startX;
      const deltaMs = dx * msPerPixel;
      let newMs = draggingBlock.initialVal + deltaMs;
      
      if (snapToBeat && draggingBlock.bpm) {
        const msPerBeat = 60000 / draggingBlock.bpm;
        newMs = Math.round(newMs / msPerBeat) * msPerBeat;
      }
      
      newMs = Math.max(0, newMs);
      
      if (draggingBlock.type === 'start') {
        onUpdateItem(draggingBlock.id, { trim_start_ms: newMs, is_snapped: snapToBeat });
      } else {
        onUpdateItem(draggingBlock.id, { trim_end_ms: newMs, is_snapped: snapToBeat });
      }
      
      setDraggingBlock(null);
    };

    if (draggingBlock) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingBlock, snapToBeat, msPerPixel, onUpdateItem]);

  const totalWidth = positionedBlocks.length > 0 
    ? (positionedBlocks[positionedBlocks.length - 1].startPos + positionedBlocks[positionedBlocks.length - 1].actualDuration) / msPerPixel
    : 0;

  const handleApplyPreset = (e: React.MouseEvent, item: any, preset: string, outgoingBpm: number) => {
    e.stopPropagation();
    if (!outgoingBpm) return;
    const msPerBeat = 60000 / outgoingBpm;
    let newXfade = 0;
    if (preset === '1_bar') newXfade = msPerBeat * 4;
    else if (preset === '4_bar') newXfade = msPerBeat * 16;
    else if (preset === 'quick_cut') newXfade = msPerBeat * 1;
    
    onUpdateItem(item.item_id, {
      crossfade_duration_ms: Math.round(newXfade),
      transition_preset: preset,
      is_snapped: snapToBeat
    });
  };

  return (
    <div className="glass-panel rounded-2xl p-6 border border-white/5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-sm font-bold tracking-wider font-mono text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-neon-cyan" />
          VISUAL TIMELINE
        </h3>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-black/40 rounded-full px-3 py-1 border border-white/5">
            <ZoomIn className="w-3 h-3 text-white/50" />
            <input 
              type="range" 
              min="10" 
              max="200" 
              step="10" 
              value={msPerPixel} 
              onChange={(e) => setMsPerPixel(Number(e.target.value))}
              className="w-24 accent-neon-cyan cursor-ew-resize"
              style={{ direction: 'rtl' }} // Reverse direction so right is "zoomed out"
            />
            <ZoomOut className="w-3 h-3 text-white/50" />
          </div>

          <label className="flex items-center gap-2 cursor-pointer font-mono text-xs text-neutral-400">
            <input 
              type="checkbox" 
              checked={snapToBeat} 
              onChange={(e) => setSnapToBeat(e.target.checked)}
              className="accent-neon-cyan"
            />
            <span className={snapToBeat ? 'text-neon-cyan font-bold' : ''}>Snap to Beat</span>
          </label>
        </div>
      </div>

      <div className="w-full overflow-x-auto bg-black/40 rounded-xl border border-white/5 relative custom-scrollbar h-56" ref={containerRef}>
        <div 
          className="relative h-full min-w-full"
          style={{ width: `${Math.max(totalWidth + 100, 800)}px` }}
        >
          {/* Timeline Grid Background */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage: `linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: `${1000 / msPerPixel}px 100%`
            }}
          />

          {/* Phase 12: Global Playhead */}
          <div 
            className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-50 pointer-events-none shadow-[0_0_10px_rgba(239,68,68,0.8)]"
            style={{ left: `${globalTimeMs / msPerPixel}px` }}
          />

          {positionedBlocks.map((block, i) => {
            const outgoingBpm = i > 0 ? positionedBlocks[i-1].bpm : null;
            const isSelected = selectedItemId === block.item_id;
            
            return (
              <div 
                key={block.item_id}
                onClick={() => onSelectItem(block.item_id)}
                className={`absolute top-4 bottom-4 rounded-lg flex flex-col shadow-2xl transition-all duration-300 group cursor-pointer ${isSelected ? 'ring-2 ring-neon-cyan z-30' : ''}`}
                style={{
                  left: `${block.startPos / msPerPixel}px`,
                  width: `${block.actualDuration / msPerPixel}px`,
                  backgroundColor: `hsl(${(i * 50) % 360}, 40%, 15%)`,
                  border: isSelected ? '1px solid rgba(0, 255, 255, 0.8)' : '1px solid rgba(255,255,255,0.2)',
                  zIndex: isSelected ? 30 : i
                }}
              >
                {/* Waveform Visualization Layer */}
                <Waveform dataStr={block.waveform_data} durationMs={block.durationMs} trimStart={block.trimStart} trimEnd={block.trimEnd} />

                {/* Drag Handle Start */}
                <div 
                  className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize bg-white/10 hover:bg-white/30 z-40 border-r border-white/20 flex items-center justify-center"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDraggingBlock({ id: block.item_id, type: 'start', startX: e.clientX, initialVal: block.trimStart, bpm: block.bpm });
                  }}
                >
                  <div className="w-1 h-4 bg-white/50 rounded-full pointer-events-none" />
                </div>

                <div className="flex-1 p-2 pl-6 pr-6 font-mono truncate border-b border-black/30 overflow-hidden relative z-20">
                  <div className="text-[10px] text-white/50">{block.genre}</div>
                  <div className="text-xs font-bold text-white truncate drop-shadow-md">{block.title}</div>
                  <div className="text-[10px] text-white/70 mt-1 drop-shadow-md">
                    BPM: {block.bpm ? block.bpm : 'Unknown'} 
                    {typeof block.bpm_confidence === 'number' ? ` (${(block.bpm_confidence * 100).toFixed(0)}% Conf)` : ' (0% Conf)'}
                    {!block.bpm && <span className="text-red-400 ml-2 font-bold bg-red-400/10 px-1 rounded">No BPM - Snap Disabled</span>}
                    {block.analysis_status === 'low_confidence' && block.raw_bpm && <span className="text-amber-400 ml-2 font-bold bg-amber-400/10 px-1 rounded">LOW_CONFIDENCE (Raw: {block.raw_bpm})</span>}
                  </div>
                </div>

                {/* Crossfade visual overlay (only rendered on the block it overlaps with) */}
                {i > 0 && block.xfade > 0 && (
                  <div 
                    className="absolute left-0 top-0 bottom-0 pointer-events-none z-30"
                    style={{ 
                      width: `${block.xfade / msPerPixel}px`,
                      background: block.fade_curve === 'equal_power' 
                        ? 'linear-gradient(90deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 50%, transparent 100%)'
                        : 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.1) 4px, rgba(255,255,255,0.1) 8px)',
                      borderRight: '1px dashed rgba(255,255,255,0.4)',
                    }}
                  >
                    <div className="absolute -top-5 left-1 text-[8px] text-neon-cyan font-mono whitespace-nowrap bg-black/60 px-1 rounded flex gap-1">
                      <span>OVERLAP {block.xfade}ms</span>
                      {block.fade_curve === 'equal_power' && <span className="text-neon-pink">(EQ PWR)</span>}
                      {block.eq_mode && block.eq_mode !== 'none' && <span className="text-neon-purple uppercase">[{block.eq_mode}]</span>}
                      {block.sync_mode === 'auto' && block.bpm && outgoingBpm && (
                        <span className="text-emerald-500 uppercase">
                          [SYNC: {Math.round(block.bpm)} → {Math.round(outgoingBpm)}]
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                {i > 0 && (
                  <div className="bg-black/60 p-1.5 flex gap-1 z-40 border-t border-white/10 relative mt-auto">
                    <span className="text-[8px] text-white/70 my-auto ml-1 font-mono font-bold">PRESET:</span>
                    <button 
                      onClick={(e) => handleApplyPreset(e, block, 'quick_cut', outgoingBpm)}
                      className="text-[8px] font-mono px-2 py-0.5 rounded bg-white/20 hover:bg-neon-cyan hover:text-black text-white font-bold border border-white/10 transition-colors"
                    >
                      1 BEAT
                    </button>
                    <button 
                      onClick={(e) => handleApplyPreset(e, block, '1_bar', outgoingBpm)}
                      className="text-[8px] font-mono px-2 py-0.5 rounded bg-white/20 hover:bg-neon-cyan hover:text-black text-white font-bold border border-white/10 transition-colors"
                    >
                      1 BAR
                    </button>
                    <button 
                      onClick={(e) => handleApplyPreset(e, block, '4_bar', outgoingBpm)}
                      className="text-[8px] font-mono px-2 py-0.5 rounded bg-white/20 hover:bg-neon-cyan hover:text-black text-white font-bold border border-white/10 transition-colors"
                    >
                      4 BARS
                    </button>
                  </div>
                )}

                {/* Drag Handle End */}
                <div 
                  className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize bg-white/10 hover:bg-white/30 z-40 border-l border-white/20 flex items-center justify-center"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDraggingBlock({ id: block.item_id, type: 'end', startX: e.clientX, initialVal: block.trimEnd, bpm: block.bpm });
                  }}
                >
                  <div className="w-1 h-4 bg-white/50 rounded-full pointer-events-none" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
