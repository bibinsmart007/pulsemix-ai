export function computeTimelineBlocks(items: any[]) {
  const blocks = items.map((item, index) => {
    const durationMs = (item.duration || 0) * 1000; 
    const trimStart = item.trim_start_ms || 0;
    const trimEnd = item.trim_end_ms || durationMs;
    const actualDuration = trimEnd - trimStart;
    const xfade = index > 0 ? (item.crossfade_duration_ms || 0) : 0;
    
    return { ...item, durationMs, actualDuration, xfade, trimStart, trimEnd };
  });

  let currentPos = 0;
  const positionedBlocks = blocks.map((block, index) => {
    if (index > 0) currentPos -= block.xfade;
    const startPos = currentPos;
    currentPos += block.actualDuration;
    return { ...block, startPos };
  });

  return positionedBlocks;
}
