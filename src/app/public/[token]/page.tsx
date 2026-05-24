"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Lock, AlertTriangle, Key, Download, Play, Pause, Disc, Volume2, ShieldAlert, Music } from "lucide-react";

export default function PublicPlaybackView() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [packageData, setPackageData] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchPackage = async (pwd?: string) => {
    try {
      setLoading(true);
      setError(null);
      let url = `/api/public/publish/${token}`;
      if (pwd) {
        url += `?pwd=${encodeURIComponent(pwd)}`;
      }
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (!data.success) {
        if (data.needs_password) {
          setNeedsPassword(true);
        } else if (data.error === "revoked") {
          setError("This link has been revoked by the creator.");
        } else if (data.error === "expired") {
          setError("This link has expired.");
        } else {
          setError(data.error || "Failed to load package.");
        }
      } else {
        setNeedsPassword(false);
        setPackageData(data);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchPackage();
    }
  }, [token]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password) {
      fetchPackage(password);
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-obsidian text-white">
        <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-obsidian text-white p-6 text-center">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-6" />
        <h1 className="text-3xl font-bold mb-2">Access Denied</h1>
        <p className="text-white/60 max-w-md">{error}</p>
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-obsidian text-white p-6">
        <div className="w-full max-w-md bg-surface border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center justify-center w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full mx-auto mb-6">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">Protected Package</h1>
          <p className="text-white/50 text-center mb-8 text-sm">
            This project requires a password to access.
          </p>
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <div className="relative">
              <Key className="w-5 h-5 absolute left-4 top-3 text-white/40" />
              <input 
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-brand"
              />
            </div>
            <button 
              type="submit" 
              className="w-full py-3 bg-brand hover:bg-brand-light text-white font-bold rounded-xl transition-colors"
            >
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!packageData) return null;

  return (
    <div className="flex flex-col h-screen bg-obsidian text-white">
      {/* Header */}
      <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-neon-purple to-neon-cyan shadow-lg shadow-neon-cyan/20">
            <Volume2 className="w-5 h-5 text-black" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-wider bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
              PULSEMIX
            </h1>
            <p className="text-xs text-white/40 font-mono uppercase tracking-widest">{packageData.package_type.replace('_', ' ')}</p>
          </div>
        </div>

        {packageData.allow_download === 1 && (
          <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-bold transition-colors">
            <Download className="w-4 h-4" />
            Download Audio
          </button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8 flex justify-center">
        <div className="w-full max-w-4xl flex flex-col gap-8">
          
          <div className="bg-surface border border-white/10 rounded-2xl p-8 flex gap-8 items-center shadow-xl">
            <div className="w-48 h-48 bg-black/40 rounded-2xl border border-white/5 flex items-center justify-center relative overflow-hidden group shrink-0 shadow-inner">
              <Disc className={`w-24 h-24 text-white/10 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
              <button 
                onClick={togglePlayback}
                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <div className="w-16 h-16 bg-brand rounded-full flex items-center justify-center text-white shadow-lg shadow-brand/50 scale-90 group-hover:scale-100 transition-transform">
                  {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
                </div>
              </button>
            </div>

            <div className="flex flex-col justify-center">
              <span className="text-brand font-bold text-sm uppercase tracking-widest mb-2">Project Delivery</span>
              <h2 className="text-4xl font-black mb-2">{packageData.project_name}</h2>
              <p className="text-white/50 mb-6 max-w-lg">
                {packageData.notes || "No release notes provided."}
              </p>
              
              <div className="flex gap-6">
                <div className="flex flex-col">
                  <span className="text-xs text-white/40 uppercase font-bold tracking-wider mb-1">Version</span>
                  <span className="font-mono">{packageData.version_number}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-white/40 uppercase font-bold tracking-wider mb-1">Tracks</span>
                  <span className="font-mono">{packageData.manifest?.tracks?.length || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tracklist Preview */}
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-bold">Tracklist</h3>
            <div className="bg-surface border border-white/5 rounded-xl overflow-hidden">
              {packageData.manifest?.tracks?.map((track: any, idx: number) => (
                <div key={idx} className="flex items-center gap-4 p-4 border-b border-white/5 last:border-0 bg-black/20 hover:bg-black/40 transition-colors">
                  <span className="w-8 text-center text-white/30 font-mono text-sm">{idx + 1}</span>
                  {track.thumbnail ? (
                    <img src={track.thumbnail} alt={track.title} className="w-12 h-12 rounded object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded bg-white/5 flex items-center justify-center">
                      <Music className="w-5 h-5 text-white/20" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold truncate text-sm">{track.title}</h4>
                    <p className="text-xs text-white/50 truncate">{track.artist || "Unknown Artist"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
      
      {/* Hidden audio element for preview */}
      <audio ref={audioRef} src="/placeholder.mp3" onEnded={() => setIsPlaying(false)} />
    </div>
  );
}
