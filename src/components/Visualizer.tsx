"use client";

import React, { useEffect, useRef } from "react";

interface VisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
}

export default function Visualizer({ analyser, isPlaying }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const particlesRef = useRef<Array<{ x: number; y: number; size: number; speedY: number; alpha: number; angle: number }>>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set dimensions with high pixel ratio
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * (window.devicePixelRatio || 1);
      canvas.height = rect.height * (window.devicePixelRatio || 1);
      ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Initialize decorative particles
    if (particlesRef.current.length === 0) {
      const particles = [];
      for (let i = 0; i < 30; i++) {
        particles.push({
          x: Math.random() * canvas.clientWidth,
          y: Math.random() * canvas.clientHeight,
          size: Math.random() * 2 + 1,
          speedY: -(Math.random() * 0.4 + 0.1),
          alpha: Math.random() * 0.5 + 0.1,
          angle: Math.random() * Math.PI * 2,
        });
      }
      particlesRef.current = particles;
    }

    const bufferLength = analyser ? analyser.frequencyBinCount : 128;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      
      // Clear canvas with slight transparency for motion trail effect
      ctx.fillStyle = "rgba(3, 3, 5, 0.22)";
      ctx.fillRect(0, 0, width, height);

      let bassEnergy = 0;

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate bass energy (first 8 frequency bins)
        let sum = 0;
        for (let i = 0; i < 8; i++) {
          sum += dataArray[i];
        }
        bassEnergy = sum / 8 / 255; // Normalized 0 to 1
      } else {
        // Flatline idle wave simulation
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = 10 + Math.sin(i * 0.15 + Date.now() * 0.005) * 8;
        }
        bassEnergy = 0.05 + Math.sin(Date.now() * 0.001) * 0.02;
      }

      // 1. Draw glowing background grid overlay reacting to bass
      ctx.save();
      const radialGrad = ctx.createRadialGradient(
        width / 2, height / 2, 10,
        width / 2, height / 2, Math.max(100, width * 0.6)
      );
      radialGrad.addColorStop(0, `rgba(189, 0, 255, ${0.08 + bassEnergy * 0.12})`);
      radialGrad.addColorStop(0.5, `rgba(0, 243, 255, ${0.02 + bassEnergy * 0.04})`);
      radialGrad.addColorStop(1, "rgba(3, 3, 5, 0)");
      ctx.fillStyle = radialGrad;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      // 2. Draw reactive background floating particles
      particlesRef.current.forEach((p) => {
        // Accelerate particles upwards during bass kicks
        const multiplier = 1 + bassEnergy * 5;
        p.y += p.speedY * multiplier;
        p.x += Math.sin(p.angle + Date.now() * 0.001) * 0.15;
        
        if (p.y < 0) {
          p.y = height;
          p.x = Math.random() * width;
        }

        // Bass expands particles
        const size = p.size * (1 + bassEnergy * 1.5);
        const alpha = Math.min(1.0, p.alpha * (1 + bassEnergy * 2));

        ctx.fillStyle = `rgba(0, 243, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      });

      // 3. Draw 3D Circular Visualizer
      ctx.save();
      ctx.translate(width / 2, height / 2); // Center the canvas
      
      const radius = Math.min(width, height) * 0.25;
      const numBars = Math.floor(bufferLength * 0.7); // limit to audible spectrum
      const angleStep = (Math.PI * 2) / numBars;
      
      // Rotate the entire circular visualizer based on time
      ctx.rotate(Date.now() * 0.0005);
      
      for (let i = 0; i < numBars; i++) {
        const val = dataArray[i];
        
        // Scale frequency data
        const barHeight = (val / 255) * (height * 0.3) + 5;
        
        // 3D Depth calculation (fake Z-axis by scaling size and opacity based on angle)
        const currentAngle = angleStep * i;
        const zDepth = Math.sin(currentAngle + Date.now() * 0.002); // -1 to 1
        
        const scaledRadius = radius + (zDepth * 10 * bassEnergy);
        const thickness = Math.max(1, 4 * ((zDepth + 1.5) / 2));
        
        const startX = Math.cos(currentAngle) * scaledRadius;
        const startY = Math.sin(currentAngle) * scaledRadius;
        const endX = Math.cos(currentAngle) * (scaledRadius + barHeight);
        const endY = Math.sin(currentAngle) * (scaledRadius + barHeight);
        
        // Dynamic colors based on frequency and depth
        const hue = (i / numBars) * 360 + (Date.now() * 0.05);
        const alpha = Math.max(0.1, (zDepth + 1) / 2);
        
        ctx.strokeStyle = `hsla(${hue}, 100%, 60%, ${alpha})`;
        ctx.lineWidth = thickness;
        ctx.lineCap = "round";
        
        ctx.shadowBlur = isPlaying ? Math.min(20, 10 + bassEnergy * 30) : 5;
        ctx.shadowColor = `hsla(${hue}, 100%, 60%, 1)`;
        
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
      
      // Inner bass pulse circle
      ctx.beginPath();
      ctx.arc(0, 0, radius - 5 + (bassEnergy * 30), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 243, 255, ${0.3 + bassEnergy * 0.5})`;
      ctx.lineWidth = 2 + bassEnergy * 5;
      ctx.stroke();
      
      ctx.restore();

      // 4. Draw a futuristic horizontal glowing beatline
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#bd00ff";
      ctx.strokeStyle = "rgba(189, 0, 255, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, height - 10);
      ctx.lineTo(width, height - 10);
      ctx.stroke();
      ctx.shadowBlur = 0;

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [analyser, isPlaying]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/5 bg-black/80 flex items-center justify-center">
      {/* Glow highlight */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-neon-cyan/40 to-transparent z-10" />
      <canvas ref={canvasRef} className="w-full h-full block" />
      
      {/* Removed debug info for cleaner UI */}

      <div className="absolute top-4 right-6 pointer-events-none font-mono text-[9px] text-neutral-400 flex gap-4 z-10 select-none">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? "bg-neon-pink animate-ping" : "bg-emerald-500"}`} />
          <span>{isPlaying ? "ENGINE BROADCASTING" : "READY — LOAD TRACK"}</span>
        </div>
      </div>
    </div>
  );
}
