"use client";

import React from "react";
import { 
  Music, 
  Sliders, 
  Video, 
  Download, 
  History, 
  Volume2 
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isTransitioning: boolean;
}

export default function Sidebar({ activeTab, setActiveTab, isTransitioning }: SidebarProps) {
  const menuItems = [
    { id: "studio", label: "Mix Studio", icon: Sliders },
    { id: "remix-lab", label: "AI Remix Lab", icon: Music },
    { id: "portal", label: "YouTube Portal", icon: Video },
    { id: "export", label: "Export Center", icon: Download },
    { id: "history", label: "History & Presets", icon: History },
  ];

  return (
    <aside className="w-64 bg-surface border-r border-white/5 flex flex-col h-full z-20">
      {/* Brand Header */}
      <div className="p-6 border-b border-white/5 flex items-center gap-3">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-neon-purple to-neon-cyan shadow-neon-cyan/20 shadow-md">
          <Volume2 className="w-5 h-5 text-black animate-pulse" />
          <div className="absolute inset-0 rounded-xl bg-white/20 animate-ping opacity-25 pointer-events-none" style={{ animationDuration: '3s' }} />
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-wider bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
            PULSEMIX <span className="text-neon-cyan text-xs font-mono px-1 border border-neon-cyan/20 rounded">AI</span>
          </h1>
          <p className="text-[10px] text-neutral-500 tracking-widest font-mono">NEXT-GEN DJ MIXER</p>
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium tracking-wide transition-all duration-300 relative overflow-hidden group ${
                isActive
                  ? "text-neon-cyan bg-white/[0.03] border border-neon-cyan/15 shadow-neon-cyan/5 shadow-inner"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.01] border border-transparent"
              }`}
            >
              {/* Active neon left border line */}
              {isActive && (
                <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-neon-cyan rounded-r shadow-neon-cyan shadow-[0_0_8px_#00f3ff]" />
              )}
              
              <Icon className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${
                isActive ? "text-neon-cyan" : "text-neutral-500 group-hover:text-neutral-300"
              }`} />
              
              <span className="relative z-10">{item.label}</span>
              
              {/* Mini beat status blinkers */}
              {item.id === "studio" && isTransitioning && (
                <span className="ml-auto w-2 h-2 rounded-full bg-neon-pink animate-ping" />
              )}
            </button>
          );
        })}
      </nav>

      {/* System Status Footer */}
      <div className="p-6 border-t border-white/5 bg-black/40 font-mono text-[10px] text-neutral-500 space-y-2">
        <div className="flex items-center justify-between">
          <span>WEB AUDIO API</span>
          <span className="text-emerald-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            ONLINE
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>FASTAPI BACKEND</span>
          <span className="text-neon-cyan flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" />
            READY
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>LATENCY SPEED</span>
          <span className="text-neutral-400">~2.4 ms</span>
        </div>
      </div>
    </aside>
  );
}
