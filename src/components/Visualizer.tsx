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

      // 3. Draw Mirrored Spectrometer Bars (Neon Cyan and Neon Purple)
      const barWidth = (width / (bufferLength * 0.75)) * 1.4;
      let barHeight;
      let x = 0;

      // Draw center-outward mirror bars
      const numBars = Math.floor(bufferLength * 0.62); // limit to audible spectrum
      
      for (let i = 0; i < numBars; i++) {
        // Apply log-like scaling for higher frequencies to look visually exciting
        const val = dataArray[i];
        barHeight = (val / 255) * (height * 0.75);
        barHeight = Math.max(2, barHeight); // minimum height

        // Dual gradients
        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
        gradient.addColorStop(0, "rgba(189, 0, 255, 0.1)");
        gradient.addColorStop(0.5, "rgba(0, 243, 255, 0.8)");
        gradient.addColorStop(1, "rgba(0, 243, 255, 1)");

        ctx.shadowBlur = isPlaying ? Math.min(20, 5 + bassEnergy * 25) : 5;
        ctx.shadowColor = "#00f3ff";

        // Draw Right Side Bar
        ctx.fillStyle = gradient;
        ctx.fillRect(width / 2 + x, height - barHeight - 10, barWidth - 2, barHeight);

        // Draw Left Side Bar (Mirror)
        ctx.fillStyle = gradient;
        ctx.fillRect(width / 2 - x - barWidth, height - barHeight - 10, barWidth - 2, barHeight);

        x += barWidth;
        ctx.shadowBlur = 0; // Reset shadow for efficiency
      }

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
      
      {/* Real-time Overlay HUD */}
      <div className="absolute top-4 left-6 pointer-events-none font-mono text-[9px] text-neutral-500 space-y-1 z-10 select-none">
        <p className="text-neon-cyan text-glow-cyan text-[10px] font-bold">FFT SPECTRUM ANALYSER</p>
        <p>CHANNELS: STEREO (L/R)</p>
        <p>BINS: {analyser ? analyser.frequencyBinCount : 128} POINT FFT</p>
      </div>

      <div className="absolute top-4 right-6 pointer-events-none font-mono text-[9px] text-neutral-400 flex gap-4 z-10 select-none">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? "bg-neon-pink animate-ping" : "bg-neutral-600"}`} />
          <span>{isPlaying ? "ENGINE BROADCASTING" : "ENGINE SUSPENDED"}</span>
        </div>
      </div>
    </div>
  );
}
