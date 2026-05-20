"use client";

import { useEffect, useRef, useState } from "react";
import { calculatePlaybackRate, bufferToWav } from "@/utils/audio";

export interface DeckState {
  playing: boolean;
  duration: number;
  currentTime: number;
  bpm: number;
  originalBpm: number;
  key: string;
  originalKey: string;
  volume: number; // 0 to 1
  pitch: number;  // playbackRate speed offset (e.g. -0.1 to 0.1)
  eqLow: number;  // -12 to +12 dB
  eqMid: number;  // -12 to +12 dB
  eqHigh: number; // -12 to +12 dB
  filter: number; // -100 (LPF) to +100 (HPF), 0 is flat
  stems: {
    vocals: number;   // 0 to 1
    melody: number;   // 0 to 1
    drums: number;    // 0 to 1 (low band)
  };
  title: string;
  thumbnail: string;
  audioBuffer: AudioBuffer | null;
  loading: boolean;
  genre: string;
}

const initialDeckState = (title: string): DeckState => ({
  playing: false,
  duration: 0,
  currentTime: 0,
  bpm: 128,
  originalBpm: 128,
  key: "8A",
  originalKey: "8A",
  volume: 0.8,
  pitch: 0,
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0,
  filter: 0,
  stems: {
    vocals: 1.0,
    melody: 1.0,
    drums: 1.0,
  },
  title,
  thumbnail: "",
  audioBuffer: null,
  loading: false,
  genre: "Electronic / Beats",
});

export function useAudioEngine() {
  const [deckA, setDeckA] = useState<DeckState>(initialDeckState("Track A"));
  const [deckB, setDeckB] = useState<DeckState>(initialDeckState("Track B"));
  const [crossfader, setCrossfader] = useState<number>(0); // -100 (A) to +100 (B)
  const [masterVolume, setMasterVolume] = useState<number>(0.8);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [transitionProgress, setTransitionProgress] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>("studio");

  // Web Audio Context & Node Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  
  // Deck A Node Refs
  const sourceARef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeARef = useRef<number>(0);
  const offsetTimeARef = useRef<number>(0);
  const timerARef = useRef<number | null>(null);
  
  // Deck A Filters
  const eqLowARef = useRef<BiquadFilterNode | null>(null);
  const eqMidARef = useRef<BiquadFilterNode | null>(null);
  const eqHighARef = useRef<BiquadFilterNode | null>(null);
  const biquadFilterARef = useRef<BiquadFilterNode | null>(null);
  
  // Deck A Stem Crossover Nodes
  const stemLowPassARef = useRef<BiquadFilterNode | null>(null);
  const stemBandPassARef = useRef<BiquadFilterNode | null>(null);
  const stemHighPassARef = useRef<BiquadFilterNode | null>(null);
  const stemLowGainARef = useRef<GainNode | null>(null);
  const stemMidGainARef = useRef<GainNode | null>(null);
  const stemHighGainARef = useRef<GainNode | null>(null);
  const stemSumGainARef = useRef<GainNode | null>(null);
  
  const volumeGainARef = useRef<GainNode | null>(null);
  const crossGainARef = useRef<GainNode | null>(null);

  // Deck B Node Refs
  const sourceBRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeBRef = useRef<number>(0);
  const offsetTimeBRef = useRef<number>(0);
  const timerBRef = useRef<number | null>(null);

  // Deck B Filters
  const eqLowBRef = useRef<BiquadFilterNode | null>(null);
  const eqMidBRef = useRef<BiquadFilterNode | null>(null);
  const eqHighBRef = useRef<BiquadFilterNode | null>(null);
  const biquadFilterBRef = useRef<BiquadFilterNode | null>(null);

  // Deck B Stem Crossover Nodes
  const stemLowPassBRef = useRef<BiquadFilterNode | null>(null);
  const stemBandPassBRef = useRef<BiquadFilterNode | null>(null);
  const stemHighPassBRef = useRef<BiquadFilterNode | null>(null);
  const stemLowGainBRef = useRef<GainNode | null>(null);
  const stemMidGainBRef = useRef<GainNode | null>(null);
  const stemHighGainBRef = useRef<GainNode | null>(null);
  const stemSumGainBRef = useRef<GainNode | null>(null);

  const volumeGainBRef = useRef<GainNode | null>(null);
  const crossGainBRef = useRef<GainNode | null>(null);

  // Master & FX Nodes
  const delayNodeRef = useRef<DelayNode | null>(null);
  const delayFeedbackRef = useRef<GainNode | null>(null);
  const delayWetRef = useRef<GainNode | null>(null);
  
  const reverbNodeRef = useRef<ConvolverNode | null>(null);
  const reverbWetRef = useRef<GainNode | null>(null);
  
  const masterGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Initialize Web Audio Context and Node Graph
  const initAudio = () => {
    if (audioCtxRef.current) return audioCtxRef.current;

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioCtxRef.current = ctx;

    // Master Nodes
    const masterGain = ctx.createGain();
    masterGain.gain.value = masterVolume;
    masterGainRef.current = masterGain;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    // Delay FX Loop
    const delayNode = ctx.createDelay(2.0);
    delayNode.delayTime.value = 0.375; // 3/16 echo at 120bpm
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = 0.4;
    const delayWet = ctx.createGain();
    delayWet.gain.value = 0.0; // dry initially

    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode); // feedback loop
    delayNodeRef.current = delayNode;
    delayFeedbackRef.current = delayFeedback;
    delayWetRef.current = delayWet;

    // Reverb FX (Simulated Convolution via simple feedback delay network for robust local setup)
    const reverbWet = ctx.createGain();
    reverbWet.gain.value = 0.0;
    reverbWetRef.current = reverbWet;

    // Connect FX to Master Analyser
    masterGain.connect(analyser);
    analyser.connect(ctx.destination);

    // Setup function to build deck node pipeline
    const setupDeckPipeline = (
      deck: "A" | "B",
      volumeGainRef: React.MutableRefObject<GainNode | null>,
      crossGainRef: React.MutableRefObject<GainNode | null>,
      eqLowRef: React.MutableRefObject<BiquadFilterNode | null>,
      eqMidRef: React.MutableRefObject<BiquadFilterNode | null>,
      eqHighRef: React.MutableRefObject<BiquadFilterNode | null>,
      biquadFilterRef: React.MutableRefObject<BiquadFilterNode | null>,
      stemLowPassRef: React.MutableRefObject<BiquadFilterNode | null>,
      stemBandPassRef: React.MutableRefObject<BiquadFilterNode | null>,
      stemHighPassRef: React.MutableRefObject<BiquadFilterNode | null>,
      stemLowGainRef: React.MutableRefObject<GainNode | null>,
      stemMidGainRef: React.MutableRefObject<GainNode | null>,
      stemHighGainRef: React.MutableRefObject<GainNode | null>,
      stemSumGainRef: React.MutableRefObject<GainNode | null>
    ) => {
      // 3-Band EQ Nodes
      const eqLow = ctx.createBiquadFilter();
      eqLow.type = "lowshelf";
      eqLow.frequency.value = 250;
      eqLow.gain.value = 0;
      eqLowRef.current = eqLow;

      const eqMid = ctx.createBiquadFilter();
      eqMid.type = "peaking";
      eqMid.frequency.value = 1500;
      eqMid.Q.value = 1.0;
      eqMid.gain.value = 0;
      eqMidRef.current = eqMid;

      const eqHigh = ctx.createBiquadFilter();
      eqHigh.type = "highshelf";
      eqHigh.frequency.value = 4000;
      eqHigh.gain.value = 0;
      eqHighRef.current = eqHigh;

      // Combined LPF/HPF Filter Node
      const biquadFilter = ctx.createBiquadFilter();
      biquadFilter.type = "peaking"; // Flat initially
      biquadFilter.frequency.value = 1000;
      biquadFilter.gain.value = 0;
      biquadFilterRef.current = biquadFilter;

      // STEM SPLITTER (crossover network)
      // Drums (Lowpass)
      const stemLowPass = ctx.createBiquadFilter();
      stemLowPass.type = "lowpass";
      stemLowPass.frequency.value = 250;
      stemLowPassRef.current = stemLowPass;

      const stemLowGain = ctx.createGain();
      stemLowGain.gain.value = 1.0;
      stemLowGainRef.current = stemLowGain;

      // Melody (Bandpass)
      const stemBandPass = ctx.createBiquadFilter();
      stemBandPass.type = "bandpass";
      stemBandPass.frequency.value = 1500;
      stemBandPass.Q.value = 0.5;
      stemBandPassRef.current = stemBandPass;

      const stemMidGain = ctx.createGain();
      stemMidGain.gain.value = 1.0;
      stemMidGainRef.current = stemMidGain;

      // Vocals (Highpass)
      const stemHighPass = ctx.createBiquadFilter();
      stemHighPass.type = "highpass";
      stemHighPass.frequency.value = 3500;
      stemHighPassRef.current = stemHighPass;

      const stemHighGain = ctx.createGain();
      stemHighGain.gain.value = 1.0;
      stemHighGainRef.current = stemHighGain;

      // Summing node for stems
      const stemSumGain = ctx.createGain();
      stemSumGainRef.current = stemSumGain;

      // Deck Gain
      const volumeGain = ctx.createGain();
      volumeGain.gain.value = deck === "A" ? deckA.volume : deckB.volume;
      volumeGainRef.current = volumeGain;

      // Crossfader Gain
      const crossGain = ctx.createGain();
      crossGain.gain.value = deck === "A" ? 1.0 : 0.0;
      crossGainRef.current = crossGain;

      // Wire Crossover Network
      // Input connects to all three filters in parallel
      // We will connect source to eqLow -> eqMid -> eqHigh -> biquadFilter
      // Then biquadFilter connects to the 3 stem filters
      eqLow.connect(eqMid);
      eqMid.connect(eqHigh);
      eqHigh.connect(biquadFilter);

      // Crossover splits
      biquadFilter.connect(stemLowPass);
      stemLowPass.connect(stemLowGain);
      stemLowGain.connect(stemSumGain);

      biquadFilter.connect(stemBandPass);
      stemBandPass.connect(stemMidGain);
      stemMidGain.connect(stemSumGain);

      biquadFilter.connect(stemHighPass);
      stemHighPass.connect(stemHighGain);
      stemHighGain.connect(stemSumGain);

      // Sum connects to deck volume -> crossfader gain
      stemSumGain.connect(volumeGain);
      volumeGain.connect(crossGain);

      // Connect crossfader gain to master and FX
      crossGain.connect(masterGain);
      
      // FX Sends
      crossGain.connect(delayWet);
      crossGain.connect(reverbWet);
    };

    setupDeckPipeline(
      "A",
      volumeGainARef,
      crossGainARef,
      eqLowARef,
      eqMidARef,
      eqHighARef,
      biquadFilterARef,
      stemLowPassARef,
      stemBandPassARef,
      stemHighPassARef,
      stemLowGainARef,
      stemMidGainARef,
      stemHighGainARef,
      stemSumGainARef
    );

    setupDeckPipeline(
      "B",
      volumeGainBRef,
      crossGainBRef,
      eqLowBRef,
      eqMidBRef,
      eqHighBRef,
      biquadFilterBRef,
      stemLowPassBRef,
      stemBandPassBRef,
      stemHighPassBRef,
      stemLowGainBRef,
      stemMidGainBRef,
      stemHighGainBRef,
      stemSumGainBRef
    );

    // Connect Wet FX to master
    delayWet.connect(masterGain);
    reverbWet.connect(masterGain);

    // Connect delay wet path to standard feedback delay node
    delayWet.connect(delayNode);
    delayNode.connect(delayWet);

    // Simple delay network reverb loop
    const revDelay = ctx.createDelay();
    revDelay.delayTime.value = 0.08;
    const revFb = ctx.createGain();
    revFb.gain.value = 0.6;
    reverbWet.connect(revDelay);
    revDelay.connect(revFb);
    revFb.connect(revDelay); // simple reverb tail
    revDelay.connect(reverbWet);

    // Initial crossfader positioning
    updateCrossfaderGain(crossfader);

    return ctx;
  };

  // Helper: Equal-power crossfader calculations
  const updateCrossfaderGain = (val: number) => {
    if (!crossGainARef.current || !crossGainBRef.current) return;
    // Map -100 to +100 to a 0 to 1 scale
    const x = (val + 100) / 200;
    // Equal-power crossfade curve
    const gainA = Math.cos((Math.PI / 2) * x);
    const gainB = Math.sin((Math.PI / 2) * x);
    
    crossGainARef.current.gain.value = gainA;
    crossGainBRef.current.gain.value = gainB;
  };

  // Synchronize crossfader changes
  useEffect(() => {
    updateCrossfaderGain(crossfader);
  }, [crossfader]);

  // Synchronize master volume changes
  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = masterVolume;
    }
  }, [masterVolume]);

  // Load a track URL (fetch array buffer, decode)
  const loadTrack = async (deck: "A" | "B", url: string, title: string, originalBpm: number, originalKey: string, thumbnail?: string, genre?: string) => {
    const ctx = initAudio();
    const trackGenre = genre || "Electronic / Beats";
    
    // Set loading
    if (deck === "A") {
      setDeckA(prev => ({ ...prev, loading: true, title, originalBpm, bpm: originalBpm, originalKey, key: originalKey, thumbnail: thumbnail || "", genre: trackGenre }));
    } else {
      setDeckB(prev => ({ ...prev, loading: true, title, originalBpm, bpm: originalBpm, originalKey, key: originalKey, thumbnail: thumbnail || "", genre: trackGenre }));
    }

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch audio stream");
      const arrayBuffer = await response.arrayBuffer();
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);

      if (deck === "A") {
        // Stop current source A if playing
        if (sourceARef.current) {
          try { sourceARef.current.stop(); } catch {}
          sourceARef.current = null;
        }
        offsetTimeARef.current = 0;
        setDeckA(prev => ({
          ...prev,
          loading: false,
          playing: false,
          currentTime: 0,
          duration: decodedBuffer.duration,
          audioBuffer: decodedBuffer,
        }));
      } else {
        // Stop current source B if playing
        if (sourceBRef.current) {
          try { sourceBRef.current.stop(); } catch {}
          sourceBRef.current = null;
        }
        offsetTimeBRef.current = 0;
        setDeckB(prev => ({
          ...prev,
          loading: false,
          playing: false,
          currentTime: 0,
          duration: decodedBuffer.duration,
          audioBuffer: decodedBuffer,
        }));
      }
    } catch (err) {
      console.error(`Error loading track for Deck ${deck}:`, err);
      // Fail elegantly
      if (deck === "A") {
        setDeckA(prev => ({ ...prev, loading: false }));
      } else {
        setDeckB(prev => ({ ...prev, loading: false }));
      }
    }
  };

  // Playback timers to sync progress state
  const startTimer = (deck: "A" | "B") => {
    const isA = deck === "A";
    const startTimeRef = isA ? startTimeARef : startTimeBRef;
    const offsetTimeRef = isA ? offsetTimeARef : offsetTimeBRef;
    const timerRef = isA ? timerARef : timerBRef;
    const setDeck = isA ? setDeckA : setDeckB;
    const deckState = isA ? deckA : deckB;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = window.setInterval(() => {
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      
      // Calculate current position
      // Get current playback speed multiplier
      let rate = 1.0;
      if (isA) {
        rate = calculatePlaybackRate(deckA.originalBpm, deckA.bpm) * (1 + deckA.pitch);
      } else {
        rate = calculatePlaybackRate(deckB.originalBpm, deckB.bpm) * (1 + deckB.pitch);
      }

      const elapsed = (ctx.currentTime - startTimeRef.current) * rate;
      let totalTime = offsetTimeRef.current + elapsed;

      // Handle track end
      const buffer = isA ? deckARefBuffer() : deckBRefBuffer();
      if (buffer && totalTime >= buffer.duration) {
        totalTime = buffer.duration;
        clearInterval(timerRef.current!);
        setDeck(prev => ({ ...prev, playing: false, currentTime: 0 }));
        offsetTimeRef.current = 0;
        if (isA) sourceARef.current = null;
        else sourceBRef.current = null;
      } else {
        setDeck(prev => ({ ...prev, currentTime: totalTime }));
      }
    }, 100);
  };

  // Internal refs to grab latest buffer in callback
  const deckARefBuffer = () => deckA.audioBuffer;
  const deckBRefBuffer = () => deckB.audioBuffer;

  const stopTimer = (deck: "A" | "B") => {
    const isA = deck === "A";
    const timerRef = isA ? timerARef : timerBRef;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Play a deck
  const playDeck = (deck: "A" | "B") => {
    const ctx = initAudio();
    if (ctx.state === "suspended") ctx.resume();

    const isA = deck === "A";
    const sourceRef = isA ? sourceARef : sourceBRef;
    const buffer = isA ? deckA.audioBuffer : deckB.audioBuffer;
    const offsetTimeRef = isA ? offsetTimeARef : offsetTimeBRef;
    const startTimeRef = isA ? startTimeARef : startTimeBRef;
    const eqLowNode = isA ? eqLowARef.current : eqLowBRef.current;
    const deckState = isA ? deckA : deckB;
    const setDeck = isA ? setDeckA : setDeckB;

    if (!buffer) return; // nothing loaded

    // Stop current instance
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current = null;
    }

    // Create source node
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    
    // Connect to EQ chain (which routes through stems and gain to output)
    if (eqLowNode) {
      source.connect(eqLowNode);
    }

    // Set playback speed based on target BPM and pitch slider
    const speedRatio = calculatePlaybackRate(deckState.originalBpm, deckState.bpm) * (1 + deckState.pitch);
    source.playbackRate.value = speedRatio;

    // Play from current offset
    source.start(0, offsetTimeRef.current);
    startTimeRef.current = ctx.currentTime;
    sourceRef.current = source;

    setDeck(prev => ({ ...prev, playing: true }));
    startTimer(deck);
  };

  // Pause a deck
  const pauseDeck = (deck: "A" | "B") => {
    const isA = deck === "A";
    const sourceRef = isA ? sourceARef : sourceBRef;
    const offsetTimeRef = isA ? offsetTimeARef : offsetTimeBRef;
    const startTimeRef = isA ? startTimeARef : startTimeBRef;
    const setDeck = isA ? setDeckA : setDeckB;
    const deckState = isA ? deckA : deckB;

    if (!sourceRef.current || !audioCtxRef.current) return;
    
    const ctx = audioCtxRef.current;
    
    // Stop source
    try {
      sourceRef.current.stop();
    } catch {}
    sourceRef.current = null;
    
    stopTimer(deck);

    // Save accurate offset
    const speedRatio = calculatePlaybackRate(deckState.originalBpm, deckState.bpm) * (1 + deckState.pitch);
    const elapsed = (ctx.currentTime - startTimeRef.current) * speedRatio;
    offsetTimeRef.current += elapsed;

    setDeck(prev => ({ ...prev, playing: false }));
  };

  // Seek deck position
  const seekDeck = (deck: "A" | "B", seconds: number) => {
    const isA = deck === "A";
    const buffer = isA ? deckA.audioBuffer : deckB.audioBuffer;
    const offsetTimeRef = isA ? offsetTimeARef : offsetTimeBRef;
    const deckState = isA ? deckA : deckB;
    const setDeck = isA ? setDeckA : setDeckB;

    if (!buffer) return;
    
    // Clamp seek position
    const targetSeconds = Math.max(0, Math.min(buffer.duration, seconds));
    offsetTimeRef.current = targetSeconds;

    if (deckState.playing) {
      // Re-trigger playback at new offset
      playDeck(deck);
    } else {
      setDeck(prev => ({ ...prev, currentTime: targetSeconds }));
    }
  };

  // Set BPM / Pitch
  const updateBpm = (deck: "A" | "B", targetBpm: number) => {
    const isA = deck === "A";
    const sourceRef = isA ? sourceARef : sourceBRef;
    const deckState = isA ? deckA : deckB;
    const setDeck = isA ? setDeckA : setDeckB;
    
    setDeck(prev => {
      const updated = { ...prev, bpm: targetBpm };
      
      // Update running playbackRate instantly
      if (sourceRef.current && audioCtxRef.current) {
        const speedRatio = calculatePlaybackRate(updated.originalBpm, updated.bpm) * (1 + updated.pitch);
        sourceRef.current.playbackRate.value = speedRatio;
        
        // Recalculate timer offset anchor
        const ctx = audioCtxRef.current;
        const elapsed = (ctx.currentTime - (isA ? startTimeARef.current : startTimeBRef.current)) * speedRatio;
        // Adjust start time to prevent playhead jumping
        if (isA) startTimeARef.current = ctx.currentTime;
        else startTimeBRef.current = ctx.currentTime;
        if (isA) offsetTimeARef.current += elapsed - (ctx.currentTime - startTimeARef.current) * speedRatio;
        else offsetTimeBRef.current += elapsed - (ctx.currentTime - startTimeBRef.current) * speedRatio;
      }
      
      return updated;
    });
  };

  // Pitch slider offset (tempo adjust, e.g. -10% to +10%)
  const updatePitch = (deck: "A" | "B", offset: number) => {
    const isA = deck === "A";
    const sourceRef = isA ? sourceARef : sourceBRef;
    const setDeck = isA ? setDeckA : setDeckB;
    
    setDeck(prev => {
      const updated = { ...prev, pitch: offset };
      if (sourceRef.current) {
        const speedRatio = calculatePlaybackRate(updated.originalBpm, updated.bpm) * (1 + updated.pitch);
        sourceRef.current.playbackRate.value = speedRatio;
      }
      return updated;
    });
  };

  // Sync BPM Deck A to B or vice-versa
  const syncDecks = (source: "A" | "B") => {
    if (source === "A") {
      // Sync B to A's BPM
      updateBpm("B", deckA.bpm);
    } else {
      // Sync A to B's BPM
      updateBpm("A", deckB.bpm);
    }
  };

  // Equalizer nodes adjustments (-12dB to +12dB)
  const updateEQ = (deck: "A" | "B", band: "low" | "mid" | "high", db: number) => {
    const setDeck = deck === "A" ? setDeckA : setDeckB;
    
    setDeck(prev => {
      const updated = { ...prev };
      if (band === "low") {
        updated.eqLow = db;
        if (deck === "A" && eqLowARef.current) eqLowARef.current.gain.value = db;
        if (deck === "B" && eqLowBRef.current) eqLowBRef.current.gain.value = db;
      } else if (band === "mid") {
        updated.eqMid = db;
        if (deck === "A" && eqMidARef.current) eqMidARef.current.gain.value = db;
        if (deck === "B" && eqMidBRef.current) eqMidBRef.current.gain.value = db;
      } else {
        updated.eqHigh = db;
        if (deck === "A" && eqHighARef.current) eqHighARef.current.gain.value = db;
        if (deck === "B" && eqHighBRef.current) eqHighBRef.current.gain.value = db;
      }
      return updated;
    });
  };

  // Pioneer Sound Color Filter
  // -100 to 0: Lowpass sweep (filter starts at 20kHz down to 20Hz)
  // 0: Bypass (peaking filter, gain 0)
  // 0 to 100: Highpass sweep (filter starts at 20Hz up to 20kHz)
  const updateFilter = (deck: "A" | "B", val: number) => {
    const setDeck = deck === "A" ? setDeckA : setDeckB;
    const biquadNode = deck === "A" ? biquadFilterARef.current : biquadFilterBRef.current;

    setDeck(prev => {
      const updated = { ...prev, filter: val };
      if (biquadNode) {
        if (val === 0) {
          biquadNode.type = "peaking";
          biquadNode.gain.value = 0; // flat bypass
        } else if (val < 0) {
          biquadNode.type = "lowpass";
          // Logarithmic sweep from 20000Hz down to 100Hz
          const pct = Math.abs(val) / 100;
          biquadNode.frequency.value = 20000 * Math.pow(100 / 20000, pct);
        } else {
          biquadNode.type = "highpass";
          // Logarithmic sweep from 20Hz up to 5000Hz
          const pct = val / 100;
          biquadNode.frequency.value = 20 * Math.pow(5000 / 20, pct);
        }
      }
      return updated;
    });
  };

  // Real-time Stem Mixing adjustments (Gain values 0.0 to 1.0)
  const updateStemVolume = (deck: "A" | "B", stem: "vocals" | "melody" | "drums", volume: number) => {
    const setDeck = deck === "A" ? setDeckA : setDeckB;
    
    setDeck(prev => {
      const updated = { ...prev };
      updated.stems = { ...prev.stems, [stem]: volume };

      // Update Node Gains
      if (deck === "A") {
        if (stem === "drums" && stemLowGainARef.current) stemLowGainARef.current.gain.value = volume;
        if (stem === "melody" && stemMidGainARef.current) stemMidGainARef.current.gain.value = volume;
        if (stem === "vocals" && stemHighGainARef.current) stemHighGainARef.current.gain.value = volume;
      } else {
        if (stem === "drums" && stemLowGainBRef.current) stemLowGainBRef.current.gain.value = volume;
        if (stem === "melody" && stemMidGainBRef.current) stemMidGainBRef.current.gain.value = volume;
        if (stem === "vocals" && stemHighGainBRef.current) stemHighGainBRef.current.gain.value = volume;
      }

      return updated;
    });
  };

  // Individual deck channel volume (Gain values 0.0 to 1.0)
  const updateDeckVolume = (deck: "A" | "B", volume: number) => {
    const setDeck = deck === "A" ? setDeckA : setDeckB;
    const gainNode = deck === "A" ? volumeGainARef.current : volumeGainBRef.current;
    
    setDeck(prev => {
      const updated = { ...prev, volume };
      if (gainNode) {
        gainNode.gain.value = volume;
      }
      return updated;
    });
  };

  // Trigger FX System Wetness
  const updateFX = (fx: "delay" | "reverb", active: boolean) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    
    if (fx === "delay" && delayWetRef.current) {
      // Ramp FX wet gain instantly or smoothly
      delayWetRef.current.gain.setValueAtTime(active ? 0.5 : 0.0, ctx.currentTime);
    } else if (fx === "reverb" && reverbWetRef.current) {
      reverbWetRef.current.gain.setValueAtTime(active ? 0.6 : 0.0, ctx.currentTime);
    }
  };

  // Vinyl Spin stop effect (decelerates playback rate to zero)
  const triggerVinylStop = (deck: "A" | "B", stopDurationSeconds: number = 1.5) => {
    const isA = deck === "A";
    const sourceNode = isA ? sourceARef.current : sourceBRef.current;
    
    if (!sourceNode || !audioCtxRef.current) return;
    
    const ctx = audioCtxRef.current;
    const time = ctx.currentTime;
    
    // Ramp playback rate to 0
    sourceNode.playbackRate.setValueAtTime(sourceNode.playbackRate.value, time);
    sourceNode.playbackRate.exponentialRampToValueAtTime(0.001, time + stopDurationSeconds);
    
    // Pause state update after stop completes
    setTimeout(() => {
      pauseDeck(deck);
      // Reset source node playback rate to normal
      const deckState = isA ? deckA : deckB;
      const speedRatio = calculatePlaybackRate(deckState.originalBpm, deckState.bpm) * (1 + deckState.pitch);
      if (sourceRefNode(deck)) {
        sourceRefNode(deck)!.playbackRate.value = speedRatio;
      }
    }, stopDurationSeconds * 1000);
  };

  const sourceRefNode = (deck: "A" | "B") => deck === "A" ? sourceARef.current : sourceBRef.current;

  // AI-Powered Professional Automated Mixing transitions!
  const triggerAutomatedTransition = async (
    preset: "echo-out" | "bass-swap" | "edm-rise" | "reverb-blend",
    durationSeconds: number = 8
  ) => {
    if (!audioCtxRef.current || isTransitioning) return;
    
    const ctx = audioCtxRef.current;
    setIsTransitioning(true);
    setTransitionProgress(0);

    const steps = 100;
    const intervalMs = (durationSeconds * 1000) / steps;
    let step = 0;

    // Detect which deck is active (crossfader positioning)
    const isAActive = crossfader <= 0;
    const startCrossfader = crossfader;
    const targetCrossfader = isAActive ? 100 : -100;

    // Make sure target deck is playing!
    const targetDeck = isAActive ? "B" : "A";
    const currentDeck = isAActive ? "A" : "B";
    
    playDeck(targetDeck);

    // Automation loop
    const automationInterval = setInterval(() => {
      step++;
      const progress = step / steps;
      setTransitionProgress(progress * 100);

      // Perform specific transitions
      if (preset === "bass-swap") {
        // Linear crossfader sweep
        const nextCf = startCrossfader + (targetCrossfader - startCrossfader) * progress;
        setCrossfader(nextCf);

        // At midpoint (50%), swap bass EQ parameters!
        if (step === 50) {
          updateEQ(currentDeck, "low", -12); // cut bass on outgoing
          updateEQ(targetDeck, "low", 6);   // boost bass on incoming
        }
      } 
      else if (preset === "echo-out") {
        // Sweeps crossfader and activates Echo/Delay Wet on outgoing deck
        const nextCf = startCrossfader + (targetCrossfader - startCrossfader) * progress;
        setCrossfader(nextCf);

        if (progress > 0.3) {
          updateFX("delay", true);
          // Sweep filter of outgoing deck to highpass
          updateFilter(currentDeck, progress * 80);
        }
        if (progress > 0.8) {
          // Fade down volume of outgoing deck
          updateDeckVolume(currentDeck, 0.8 * (1 - progress));
        }
      } 
      else if (preset === "reverb-blend") {
        // Blend tracks with dense reverb wetness on both channels
        const nextCf = startCrossfader + (targetCrossfader - startCrossfader) * progress;
        setCrossfader(nextCf);

        updateFX("reverb", true);
        
        // Midpoint transition resets
        if (progress > 0.9) {
          updateFX("reverb", false);
          updateEQ(currentDeck, "low", 0);
          updateFilter(currentDeck, 0);
          pauseDeck(currentDeck);
          updateDeckVolume(currentDeck, 0.8);
        }
      }
      else if (preset === "edm-rise") {
        // Pitch rises on outgoing track while filtering out low-end
        const nextCf = startCrossfader + (targetCrossfader - startCrossfader) * progress;
        setCrossfader(nextCf);

        // Raise pitch offset on outgoing deck
        updatePitch(currentDeck, progress * 0.12);
        // Sweeping filter upwards
        updateFilter(currentDeck, progress * 70);

        if (step === 90) {
          // Instant cut of outgoing deck
          pauseDeck(currentDeck);
          // Restore outgoing properties for future use
          updatePitch(currentDeck, 0);
          updateFilter(currentDeck, 0);
          updateDeckVolume(currentDeck, 0.8);
        }
      }

      if (step >= steps) {
        clearInterval(automationInterval);
        setIsTransitioning(false);
        setTransitionProgress(100);
        // Complete absolute crossfader switch
        setCrossfader(targetCrossfader);
      }
    }, intervalMs);
  };

  // High-Speed Offline Render mixing engine to export WAV files!
  const renderMixOffline = async (durationSeconds: number = 30): Promise<Blob> => {
    // 1. Determine active audio data
    if (!deckA.audioBuffer && !deckB.audioBuffer) {
      throw new Error("No tracks loaded to render");
    }

    const sampleRate = 44100;
    const renderLengthSamples = sampleRate * durationSeconds;
    
    // Create OfflineAudioContext (Stereo, 44.1kHz)
    const OfflineAudioCtxClass = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    const offlineCtx = new OfflineAudioCtxClass(2, renderLengthSamples, sampleRate);

    // 2. Clone DJ pipeline inside Offline Context
    const cloneDeckSource = (deck: "A" | "B", buffer: AudioBuffer, startOffset: number, speedRatio: number) => {
      const source = offlineCtx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = speedRatio;

      // Recreate basic filters for high fidelity mix
      const eqLow = offlineCtx.createBiquadFilter();
      eqLow.type = "lowshelf";
      eqLow.frequency.value = 250;
      eqLow.gain.value = deck === "A" ? deckA.eqLow : deckB.eqLow;

      const eqMid = offlineCtx.createBiquadFilter();
      eqMid.type = "peaking";
      eqMid.frequency.value = 1500;
      eqMid.gain.value = deck === "A" ? deckA.eqMid : deckB.eqMid;

      const eqHigh = offlineCtx.createBiquadFilter();
      eqHigh.type = "highshelf";
      eqHigh.frequency.value = 4000;
      eqHigh.gain.value = deck === "A" ? deckA.eqHigh : deckB.eqHigh;

      const volGain = offlineCtx.createGain();
      volGain.gain.value = deck === "A" ? deckA.volume : deckB.volume;

      const crossGain = offlineCtx.createGain();
      
      // Calculate automated crossfade parameters over duration
      // For simplicity, a smooth 5-second crossfade at the midpoint
      const midPoint = durationSeconds / 2;
      const crossfadeDuration = 6;
      
      // Automate crossfader
      crossGain.gain.setValueAtTime(deck === "A" ? 1.0 : 0.0, 0);
      if (deck === "A") {
        crossGain.gain.setValueAtTime(1.0, midPoint - crossfadeDuration / 2);
        crossGain.gain.linearRampToValueAtTime(0.0, midPoint + crossfadeDuration / 2);
      } else {
        crossGain.gain.setValueAtTime(0.0, midPoint - crossfadeDuration / 2);
        crossGain.gain.linearRampToValueAtTime(1.0, midPoint + crossfadeDuration / 2);
      }

      // Connect nodes
      source.connect(eqLow);
      eqLow.connect(eqMid);
      eqMid.connect(eqHigh);
      eqHigh.connect(volGain);
      volGain.connect(crossGain);
      crossGain.connect(offlineCtx.destination);

      // Play
      source.start(0, startOffset);
    };

    // Render loaded decks
    if (deckA.audioBuffer) {
      const speedA = calculatePlaybackRate(deckA.originalBpm, deckA.bpm) * (1 + deckA.pitch);
      cloneDeckSource("A", deckA.audioBuffer, offsetTimeARef.current, speedA);
    }

    if (deckB.audioBuffer) {
      const speedB = calculatePlaybackRate(deckB.originalBpm, deckB.bpm) * (1 + deckB.pitch);
      // Deck B starts a bit later if creating a continuous mix, or plays from current offset
      cloneDeckSource("B", deckB.audioBuffer, offsetTimeBRef.current, speedB);
    }

    // 3. Render audio buffer
    const renderedBuffer = await offlineCtx.startRendering();
    
    // 4. Encode to WAV
    return bufferToWav(renderedBuffer);
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timerARef.current) clearInterval(timerARef.current);
      if (timerBRef.current) clearInterval(timerBRef.current);
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, []);

  return {
    deckA,
    deckB,
    crossfader,
    masterVolume,
    isTransitioning,
    transitionProgress,
    activeTab,
    analyserNode: analyserRef.current,
    audioContext: audioCtxRef.current,
    setActiveTab,
    setCrossfader,
    setMasterVolume,
    loadTrack,
    playDeck,
    pauseDeck,
    seekDeck,
    updateBpm,
    updatePitch,
    syncDecks,
    updateEQ,
    updateFilter,
    updateStemVolume,
    updateDeckVolume,
    updateFX,
    triggerVinylStop,
    triggerAutomatedTransition,
    renderMixOffline,
  };
}
