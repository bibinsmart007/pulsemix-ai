import React from 'react';

export interface WaveformProps {
  dataStr: string;
  durationMs: number;
  trimStart: number;
  trimEnd: number;
  color?: string;
  opacity?: string;
  topOffset?: string;
  bottomOffset?: string;
}

export default function Waveform({ 
  dataStr, 
  durationMs, 
  trimStart, 
  trimEnd,
  color = "text-neon-cyan",
  opacity = "opacity-40",
  topOffset = "24px",
  bottomOffset = "24px"
}: WaveformProps) {
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
    <div className={`absolute inset-0 overflow-hidden pointer-events-none mix-blend-screen ${opacity}`} style={{ top: topOffset, bottom: bottomOffset }}>
      <svg width="100%" height="100%" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
        <polygon points={path} fill="currentColor" className={color} />
      </svg>
    </div>
  );
}
