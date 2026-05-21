"use client";

import { useEffect, useState } from "react";
import { DeckState, initialDeckState } from "@/types/audio";
import { useAudioNodes } from "./useAudioNodes";
import { usePlaybackController } from "./usePlaybackController";

export type { DeckState } from "@/types/audio";

export function useAudioEngine() {
  const [deckA, setDeckA] = useState<DeckState>(initialDeckState("Track A"));
  const [deckB, setDeckB] = useState<DeckState>(initialDeckState("Track B"));
  const [crossfader, setCrossfader] = useState<number>(0); // -100 (A) to +100 (B)
  const [masterVolume, setMasterVolume] = useState<number>(0.8);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [transitionProgress, setTransitionProgress] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>("studio");

  const { audioCtxRef, initAudio, connectAudioElement, nodes } = useAudioNodes();
  
  const { 
    audioElemARef, audioElemBRef, 
    playDeck: basePlayDeck, pauseDeck: basePauseDeck, 
    seekDeck: baseSeekDeck, updatePlaybackRate 
  } = usePlaybackController(deckA, setDeckA, deckB, setDeckB);

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

  const loadTrack = async (deck: "A" | "B", url: string, title: string, originalBpm: number, originalKey: string, thumbnail?: string, genre?: string) => {
    initAudio();
    const trackGenre = genre || "Electronic / Beats";
    
    const setDeck = deck === "A" ? setDeckA : setDeckB;
    const audioRef = deck === "A" ? audioElemARef : audioElemBRef;

    setDeck(prev => ({ 
      ...prev, loading: true, title, originalBpm, bpm: originalBpm, 
      originalKey, key: originalKey, thumbnail: thumbnail || "", genre: trackGenre, playing: false 
    }));

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }

    const audioEl = new Audio();
    audioEl.crossOrigin = "anonymous";
    audioEl.preservesPitch = false;
    audioEl.src = url;
    
    audioEl.addEventListener("loadedmetadata", () => {
      setDeck(prev => ({
        ...prev,
        loading: false,
        trackLoaded: true,
        duration: audioEl.duration,
        currentTime: 0,
      }));
    });

    audioEl.addEventListener("ended", () => {
      setDeck(prev => ({ ...prev, playing: false, currentTime: 0 }));
    });

    audioRef.current = audioEl;
    connectAudioElement(deck, audioEl);
    
    updatePlaybackRate(deck, originalBpm, 0, originalBpm);
  };

  const playDeck = (deck: "A" | "B") => basePlayDeck(deck, audioCtxRef.current);
  const pauseDeck = (deck: "A" | "B") => basePauseDeck(deck);
  const seekDeck = (deck: "A" | "B", seconds: number) => baseSeekDeck(deck, seconds);

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

  const syncDecks = (source: "A" | "B") => {
    if (source === "A") updateBpm("B", deckA.bpm);
    else updateBpm("A", deckB.bpm);
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

      if (stem === "drums" && dNodes.stemLow.current) dNodes.stemLow.current.gain.value = volume;
      if (stem === "melody" && dNodes.stemMid.current) dNodes.stemMid.current.gain.value = volume;
      if (stem === "vocals" && dNodes.stemHigh.current) dNodes.stemHigh.current.gain.value = volume;

      return updated;
    });
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
    
    if (fx === "delay" && nodes.fx.delayWet.current) {
      nodes.fx.delayWet.current.gain.setValueAtTime(active ? 0.5 : 0.0, ctx.currentTime);
    } else if (fx === "reverb" && nodes.fx.reverbWet.current) {
      nodes.fx.reverbWet.current.gain.setValueAtTime(active ? 0.6 : 0.0, ctx.currentTime);
    }
  };

  const triggerVinylStop = (deck: "A" | "B", stopDurationSeconds: number = 1.5) => {
    const audioEl = deck === "A" ? audioElemARef.current : audioElemBRef.current;
    if (!audioEl) return;
    
    const initialRate = audioEl.playbackRate;
    const start = performance.now();
    
    const animate = () => {
      const elapsed = (performance.now() - start) / 1000;
      if (elapsed < stopDurationSeconds) {
        const progress = elapsed / stopDurationSeconds;
        // decelerate
        audioEl.playbackRate = Math.max(0.01, initialRate * (1 - Math.pow(progress, 2)));
        requestAnimationFrame(animate);
      } else {
        pauseDeck(deck);
        audioEl.playbackRate = initialRate;
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
        if (progress > 0.3) {
          updateFX("delay", true);
          updateFilter(currentDeck, progress * 80);
        }
        if (progress > 0.8) updateDeckVolume(currentDeck, 0.8 * (1 - progress));
      } 
      else if (preset === "reverb-blend") {
        setCrossfader(nextCf);
        updateFX("reverb", true);
        if (progress > 0.9) {
          updateFX("reverb", false);
          updateEQ(currentDeck, "low", 0);
          updateFilter(currentDeck, 0);
          pauseDeck(currentDeck);
          updateDeckVolume(currentDeck, 0.8);
        }
      }
      else if (preset === "edm-rise") {
        setCrossfader(nextCf);
        updatePitch(currentDeck, progress * 0.12);
        updateFilter(currentDeck, progress * 70);
        if (step === 90) {
          pauseDeck(currentDeck);
          updatePitch(currentDeck, 0);
          updateFilter(currentDeck, 0);
          updateDeckVolume(currentDeck, 0.8);
        }
      }

      if (step >= steps) {
        clearInterval(automationInterval);
        setIsTransitioning(false);
        setTransitionProgress(100);
        setCrossfader(targetCrossfader);
      }
    }, intervalMs);
  };

  return {
    deckA, deckB, crossfader, masterVolume, isTransitioning, transitionProgress, activeTab,
    analyserNode: nodes.analyser.current, audioContext: audioCtxRef.current,
    audioElemA: audioElemARef.current, audioElemB: audioElemBRef.current,
    setActiveTab, setCrossfader, setMasterVolume, loadTrack, playDeck, pauseDeck, seekDeck,
    updateBpm, updatePitch, syncDecks, updateEQ, updateFilter, updateStemVolume, updateDeckVolume,
    updateFX, triggerVinylStop, setHotCue, triggerHotCue, toggleLoop, triggerAutomatedTransition,
  };
}
