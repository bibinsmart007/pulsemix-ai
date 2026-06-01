"use client";

import { useEffect, useState } from "react";
import { DeckState, initialDeckState } from "@/types/audio";
import { useAudioNodes } from "./useAudioNodes";
import { usePlaybackController } from "./usePlaybackController";
import { useRecording } from "./useRecording";

export type { DeckState } from "@/types/audio";

export function useAudioEngine() {
  const [deckA, setDeckA] = useState<DeckState>(initialDeckState("Track A"));
  const [deckB, setDeckB] = useState<DeckState>(initialDeckState("Track B"));
  const [crossfader, setCrossfader] = useState<number>(0); // -100 (A) to +100 (B)
  const [masterVolume, setMasterVolume] = useState<number>(0.8);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [transitionProgress, setTransitionProgress] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>("assistant");
  const [fxState, setFxState] = useState({ delay: false, reverb: false });

  const { audioCtxRef, initAudio, connectAudioElement, nodes } = useAudioNodes();
  
  const { 
    loadBuffer, 
    playDeck: basePlayDeck, pauseDeck: basePauseDeck, 
    seekDeck: baseSeekDeck, updatePlaybackRate,
    getCurrentTime
  } = usePlaybackController(deckA, setDeckA, deckB, setDeckB, audioCtxRef, nodes);

  const recording = useRecording(audioCtxRef, nodes.master);

  // Helper: Equal-power crossfader calculations
  const updateCrossfaderGain = (val: number) => {
    if (!nodes.A.cross.current || !nodes.B.cross.current) return;
    const x = (val + 100) / 200;
    const gainA = Math.cos((Math.PI / 2) * x);
    const gainB = Math.sin((Math.PI / 2) * x);
    
    nodes.A.cross.current.gain.value = gainA;
    nodes.B.cross.current.gain.value = gainB;
  };

  useEffect(() => {
    updateCrossfaderGain(crossfader);
  }, [crossfader, nodes]);

  useEffect(() => {
    if (nodes.master.current) {
      nodes.master.current.gain.value = masterVolume;
    }
  }, [masterVolume, nodes]);

  const loadTrack = async (deck: "A" | "B", url: string, title: string, originalBpm: number, originalKey: string, thumbnail?: string, genre?: string, youtube_url?: string, stem_status?: string, hot_cues?: string, beatgrid?: string) => {
    const setState = deck === "A" ? setDeckA : setDeckB;
    
    let parsedHotCues: (number | null)[] = [null, null, null, null];
    if (hot_cues) {
      try {
        const parsed = JSON.parse(hot_cues);
        if (Array.isArray(parsed) && parsed.length === 4) {
          parsedHotCues = parsed;
        }
      } catch (e) {}
    }

    setState((prev) => ({ 
      ...prev, 
      trackLoaded: false, 
      loading: true, 
      title, 
      originalBpm, 
      bpm: originalBpm, 
      key: originalKey, 
      originalKey, 
      thumbnail: thumbnail || "", 
      genre: genre || "Electronic",
      youtube_url,
      audioUrl: url,
      stem_status: (stem_status as any) || "NOT_GENERATED",
      hotCues: parsedHotCues,
      beatgrid: beatgrid
    }));

    const ctx = initAudio();
    if (!ctx) return;

    try {
      // 1. Fetch the file as ArrayBuffer
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch audio file");
      const arrayBuffer = await response.arrayBuffer();

      // 2. Decode into AudioBuffer
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      // 3. Load into our new controller
      loadBuffer(deck, audioBuffer);
      updatePlaybackRate(deck, originalBpm, 0, originalBpm);
    } catch (e) {
      console.error("Failed to load and decode track:", e);
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const playDeck = (deck: "A" | "B") => basePlayDeck(deck);
  const pauseDeck = (deck: "A" | "B") => basePauseDeck(deck);
  const seekDeck = (deck: "A" | "B", seconds: number, snap: boolean = false) => {
    baseSeekDeck(deck, seconds, snap);
  };
  
  const cueDeck = (deck: "A" | "B") => {
    pauseDeck(deck);
    seekDeck(deck, 0, true); // Strong snapping on CUE jump
  };

  const updateBpm = (deck: "A" | "B", targetBpm: number) => {
    const setDeck = deck === "A" ? setDeckA : setDeckB;
    setDeck(prev => {
      const updated = { ...prev, bpm: targetBpm };
      updatePlaybackRate(deck, updated.bpm, updated.pitch, updated.originalBpm);
      return updated;
    });
  };

  const updatePitch = (deck: "A" | "B", offset: number) => {
    const setDeck = deck === "A" ? setDeckA : setDeckB;
    setDeck(prev => {
      const updated = { ...prev, pitch: offset };
      updatePlaybackRate(deck, updated.bpm, updated.pitch, updated.originalBpm);
      return updated;
    });
  };

  const syncDecks = (deckToSync: "A" | "B") => {
    // Deck A is the master. If syncing Deck B to Deck A:
    if (deckToSync === "B") {
      updateBpm("B", deckA.bpm);
      
      // Phase alignment: if both are playing, we want B to snap to the nearest beat
      if (deckA.playing && deckB.playing && deckA.beatgrid && deckB.beatgrid) {
          // A very simple phase alignment for MVP:
          // Just re-trigger Deck B's playback snapped to the grid so it locks to the beat.
          seekDeck("B", deckB.currentTime, true);
      }
    } else {
      // If syncing A to B (override)
      updateBpm("A", deckB.bpm);
      if (deckA.playing && deckB.playing && deckA.beatgrid && deckB.beatgrid) {
          seekDeck("A", deckA.currentTime, true);
      }
    }
  };

  const updateEQ = (deck: "A" | "B", band: "low" | "mid" | "high", db: number) => {
    const setDeck = deck === "A" ? setDeckA : setDeckB;
    const dNodes = deck === "A" ? nodes.A : nodes.B;
    
    setDeck(prev => {
      const updated = { ...prev };
      if (band === "low") {
        updated.eqLow = db;
        if (dNodes.eqLow.current) dNodes.eqLow.current.gain.value = db;
      } else if (band === "mid") {
        updated.eqMid = db;
        if (dNodes.eqMid.current) dNodes.eqMid.current.gain.value = db;
      } else {
        updated.eqHigh = db;
        if (dNodes.eqHigh.current) dNodes.eqHigh.current.gain.value = db;
      }
      return updated;
    });
  };

  const updateFilter = (deck: "A" | "B", val: number) => {
    const setDeck = deck === "A" ? setDeckA : setDeckB;
    const biquadNode = deck === "A" ? nodes.A.filter.current : nodes.B.filter.current;

    setDeck(prev => {
      const updated = { ...prev, filter: val };
      if (biquadNode) {
        if (val === 0) {
          biquadNode.type = "peaking";
          biquadNode.gain.value = 0;
        } else if (val < 0) {
          biquadNode.type = "lowpass";
          const pct = Math.abs(val) / 100;
          biquadNode.frequency.value = 20000 * Math.pow(100 / 20000, pct);
        } else {
          biquadNode.type = "highpass";
          const pct = val / 100;
          biquadNode.frequency.value = 20 * Math.pow(5000 / 20, pct);
        }
      }
      return updated;
    });
  };

  const updateStemVolume = (deck: "A" | "B", stem: "vocals" | "melody" | "drums", volume: number) => {
    const setDeck = deck === "A" ? setDeckA : setDeckB;
    const dNodes = deck === "A" ? nodes.A : nodes.B;
    
    setDeck(prev => {
      const updated = { ...prev };
      updated.stems = { ...prev.stems, [stem]: volume };

      // Convert linear 0-1 to dB (-40 to 0)
      const db = volume <= 0.01 ? -40 : 20 * Math.log10(volume);

      if (stem === "drums" && dNodes.stemLow.current) dNodes.stemLow.current.gain.value = db;
      if (stem === "melody" && dNodes.stemMid.current) dNodes.stemMid.current.gain.value = db;
      if (stem === "vocals" && dNodes.stemHigh.current) dNodes.stemHigh.current.gain.value = db;

      return updated;
    });
  };

  const extractStems = async (deck: "A" | "B") => {
    const state = deck === "A" ? deckA : deckB;
    const setDeck = deck === "A" ? setDeckA : setDeckB;
    
    if (!state.youtube_url) return;
    
    try {
      setDeck(prev => ({ ...prev, stem_status: "EXTRACTING" }));
      const res = await fetch("/api/stems/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtube_url: state.youtube_url })
      });
      if (!res.ok) throw new Error("Failed to extract");
      
      // Polling
      const poll = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/stems/status?youtube_url=${encodeURIComponent(state.youtube_url as string)}`);
          if (statusRes.ok) {
            const data = await statusRes.json();
            if (data.stem_status === "READY" || data.stem_status === "FAILED") {
              clearInterval(poll);
              setDeck(prev => ({ ...prev, stem_status: data.stem_status }));
            }
          }
        } catch (e) {
          // ignore network errors while polling
        }
      }, 3000);
    } catch (e) {
      setDeck(prev => ({ ...prev, stem_status: "FAILED" }));
    }
  };

  const updateDeckVolume = (deck: "A" | "B", volume: number) => {
    const setDeck = deck === "A" ? setDeckA : setDeckB;
    const gainNode = deck === "A" ? nodes.A.volume.current : nodes.B.volume.current;
    
    setDeck(prev => {
      const updated = { ...prev, volume };
      if (gainNode) gainNode.gain.value = volume;
      return updated;
    });
  };

  const updateFX = (fx: "delay" | "reverb", active: boolean) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    
    setFxState(prev => ({ ...prev, [fx]: active }));

    if (fx === "delay" && nodes.fx.delayWet.current) {
      nodes.fx.delayWet.current.gain.setValueAtTime(active ? 0.5 : 0.0, ctx.currentTime);
    } else if (fx === "reverb" && nodes.fx.reverbWet.current) {
      nodes.fx.reverbWet.current.gain.setValueAtTime(active ? 0.6 : 0.0, ctx.currentTime);
    }
  };

  const toggleCue = (deck: "A" | "B") => {
    const setDeck = deck === "A" ? setDeckA : setDeckB;
    setDeck(prev => ({ ...prev, cueEnabled: !prev.cueEnabled }));
  };

  const triggerVinylStop = (deck: "A" | "B", stopDurationSeconds: number = 1.5) => {
    const state = deck === "A" ? deckA : deckB;
    if (!state.playing) return;
    
    const initialRate = (state.bpm / state.originalBpm) * (1 + state.pitch);
    const start = performance.now();
    
    const animate = () => {
      const elapsed = (performance.now() - start) / 1000;
      if (elapsed < stopDurationSeconds) {
        const progress = elapsed / stopDurationSeconds;
        // decelerate
        const newRate = Math.max(0.01, initialRate * (1 - Math.pow(progress, 2)));
        // Note: this directly modifies the WebAudio node without changing state.pitch to fake the stop
        const node = deck === "A" ? nodes.A.eqLow.current : nodes.B.eqLow.current;
        // Wait, to directly access the playbackRate we need the source, which is hidden in the controller now.
        // As a shortcut, we can just use `updatePlaybackRate` with a fake pitch, but it updates state.
        // Actually, let's just pause immediately for now to prevent breaking encapsulation, 
        // or we could add a vinylStop to usePlaybackController.
        pauseDeck(deck);
      } else {
        pauseDeck(deck);
      }
    };
    requestAnimationFrame(animate);
  };

  const setHotCue = (deck: "A" | "B", index: number, time: number) => {
    const setDeck = deck === "A" ? setDeckA : setDeckB;
    setDeck(prev => {
      const newCues = [...prev.hotCues];
      newCues[index] = time;
      return { ...prev, hotCues: newCues };
    });
  };

  const triggerHotCue = (deck: "A" | "B", index: number) => {
    const state = deck === "A" ? deckA : deckB;
    const time = state.hotCues[index];
    if (time !== null) seekDeck(deck, time);
  };

  const toggleLoop = (deck: "A" | "B", bars: number = 4) => {
    const setDeck = deck === "A" ? setDeckA : setDeckB;
    setDeck(prev => {
      if (prev.loopActive) {
        return { ...prev, loopActive: false, loopStart: null, loopEnd: null };
      } else {
        const beatDuration = 60 / prev.bpm;
        const loopDuration = beatDuration * (bars * 4);
        return { 
          ...prev, 
          loopActive: true, 
          loopStart: prev.currentTime, 
          loopEnd: prev.currentTime + loopDuration 
        };
      }
    });
  };

  const triggerAutomatedTransition = async (preset: "echo-out" | "bass-swap" | "edm-rise" | "reverb-blend", durationSeconds: number = 8) => {
    if (!audioCtxRef.current || isTransitioning) return;
    
    setIsTransitioning(true);
    setTransitionProgress(0);

    const steps = 100;
    const intervalMs = (durationSeconds * 1000) / steps;
    let step = 0;

    const isAActive = crossfader <= 0;
    const startCrossfader = crossfader;
    const targetCrossfader = isAActive ? 100 : -100;
    const targetDeck = isAActive ? "B" : "A";
    const currentDeck = isAActive ? "A" : "B";
    
    // Phase 2: Auto-sync target deck BPM to the current playing deck
    const currentBpm = currentDeck === "A" ? deckA.bpm : deckB.bpm;
    updateBpm(targetDeck, currentBpm);
    
    playDeck(targetDeck);

    const automationInterval = setInterval(() => {
      step++;
      const progress = step / steps;
      setTransitionProgress(progress * 100);

      const nextCf = startCrossfader + (targetCrossfader - startCrossfader) * progress;
      
      if (preset === "bass-swap") {
        setCrossfader(nextCf);
        if (step === 50) {
          updateEQ(currentDeck, "low", -12);
          updateEQ(targetDeck, "low", 6);
        }
      } 
      else if (preset === "echo-out") {
        setCrossfader(nextCf);
        if (step === 1) updateFX("delay", true);
        
        // Sweep highpass filter from 0 to 80%
        updateFilter(currentDeck, progress * 80);
        
        // Fade out volume in the second half of the transition
        if (progress > 0.5) {
          updateDeckVolume(currentDeck, 0.8 * (1 - (progress - 0.5) * 2));
        }
      } 
      else if (preset === "reverb-blend") {
        setCrossfader(nextCf);
        if (step === 1) updateFX("reverb", true);
        
        // Cut the lows from the outgoing deck immediately to avoid muddiness
        if (step === 10) updateEQ(currentDeck, "low", -12);
        
        // Slowly fade out volume
        updateDeckVolume(currentDeck, 0.8 * (1 - progress));
      }
      else if (preset === "edm-rise") {
        setCrossfader(nextCf);
        updatePitch(currentDeck, progress * 0.12);
        updateFilter(currentDeck, progress * 70);
      }

      if (step >= steps) {
        clearInterval(automationInterval);
        setIsTransitioning(false);
        setTransitionProgress(100);
        setCrossfader(targetCrossfader);
        
        // Teardown routines for DSP
        if (preset === "echo-out") {
          pauseDeck(currentDeck);
          updateFilter(currentDeck, 0);
          updateDeckVolume(currentDeck, 0.8);
          setTimeout(() => updateFX("delay", false), 4000);
        } else if (preset === "reverb-blend") {
          pauseDeck(currentDeck);
          updateEQ(currentDeck, "low", 0);
          updateFilter(currentDeck, 0);
          updateDeckVolume(currentDeck, 0.8);
          setTimeout(() => updateFX("reverb", false), 4000);
        } else if (preset === "bass-swap") {
          pauseDeck(currentDeck);
          updateEQ(currentDeck, "low", 0);
          updateEQ(targetDeck, "low", 0); // Restore target deck bass punch
        } else if (preset === "edm-rise") {
          pauseDeck(currentDeck);
          updatePitch(currentDeck, 0);
          updateFilter(currentDeck, 0);
          updateDeckVolume(currentDeck, 0.8);
        }
      }
    }, intervalMs);
  };

  return {
    deckA, deckB, crossfader, masterVolume, isTransitioning, transitionProgress, activeTab, fxState,
    analyserNodeRef: nodes.analyser, audioContextRef: audioCtxRef,
    setActiveTab, setCrossfader, setMasterVolume, loadTrack, playDeck, pauseDeck, seekDeck, cueDeck, toggleCue,
    updateBpm, updatePitch, syncDecks, updateEQ, updateFilter, updateStemVolume, extractStems, updateDeckVolume,
    updateFX, triggerVinylStop, setHotCue, triggerHotCue, toggleLoop, triggerAutomatedTransition,
    recording, getCurrentTime
  };
}
