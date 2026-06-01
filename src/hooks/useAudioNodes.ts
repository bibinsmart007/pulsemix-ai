import { useRef } from "react";

export function useAudioNodes() {
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Deck A Nodes
  const eqLowARef = useRef<BiquadFilterNode | null>(null);
  const eqMidARef = useRef<BiquadFilterNode | null>(null);
  const eqHighARef = useRef<BiquadFilterNode | null>(null);
  const biquadFilterARef = useRef<BiquadFilterNode | null>(null);
  const volumeGainARef = useRef<GainNode | null>(null);
  const crossGainARef = useRef<GainNode | null>(null);
  const sourceNodeARef = useRef<MediaElementAudioSourceNode | null>(null);

  // Deck A "Stems" (EQ Isolator)
  const stemLowARef = useRef<BiquadFilterNode | null>(null);
  const stemMidARef = useRef<BiquadFilterNode | null>(null);
  const stemHighARef = useRef<BiquadFilterNode | null>(null);

  // Deck B Nodes
  const eqLowBRef = useRef<BiquadFilterNode | null>(null);
  const eqMidBRef = useRef<BiquadFilterNode | null>(null);
  const eqHighBRef = useRef<BiquadFilterNode | null>(null);
  const biquadFilterBRef = useRef<BiquadFilterNode | null>(null);
  const volumeGainBRef = useRef<GainNode | null>(null);
  const crossGainBRef = useRef<GainNode | null>(null);
  const sourceNodeBRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Deck B "Stems" (EQ Isolator)
  const stemLowBRef = useRef<BiquadFilterNode | null>(null);
  const stemMidBRef = useRef<BiquadFilterNode | null>(null);
  const stemHighBRef = useRef<BiquadFilterNode | null>(null);

  // FX & Master
  const masterGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const delayWetRef = useRef<GainNode | null>(null);
  const reverbWetRef = useRef<GainNode | null>(null);

  const initAudio = () => {
    if (audioCtxRef.current) return audioCtxRef.current;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioCtxRef.current = ctx;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.8;
    masterGainRef.current = masterGain;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    // FX
    const delayNode = ctx.createDelay(2.0);
    delayNode.delayTime.value = 0.375;
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = 0.4;
    const delayWet = ctx.createGain();
    delayWet.gain.value = 0.0;
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayWetRef.current = delayWet;

    const reverbWet = ctx.createGain();
    reverbWet.gain.value = 0.0;
    reverbWetRef.current = reverbWet;

    masterGain.connect(analyser);
    analyser.connect(ctx.destination);

    const setupDeck = (deck: "A" | "B") => {
      const eqLow = ctx.createBiquadFilter(); eqLow.type = "lowshelf"; eqLow.frequency.value = 250;
      const eqMid = ctx.createBiquadFilter(); eqMid.type = "peaking"; eqMid.frequency.value = 1500; eqMid.Q.value = 1.0;
      const eqHigh = ctx.createBiquadFilter(); eqHigh.type = "highshelf"; eqHigh.frequency.value = 4000;
      const filter = ctx.createBiquadFilter(); filter.type = "peaking"; filter.frequency.value = 1000;
      
      const stemLow = ctx.createBiquadFilter(); stemLow.type = "lowshelf"; stemLow.frequency.value = 250;
      const stemMid = ctx.createBiquadFilter(); stemMid.type = "peaking"; stemMid.frequency.value = 1500; stemMid.Q.value = 0.5;
      const stemHigh = ctx.createBiquadFilter(); stemHigh.type = "highshelf"; stemHigh.frequency.value = 3500;

      const volumeGain = ctx.createGain();
      const crossGain = ctx.createGain();

      eqLow.connect(eqMid);
      eqMid.connect(eqHigh);
      eqHigh.connect(filter);

      filter.connect(stemLow);
      stemLow.connect(stemMid);
      stemMid.connect(stemHigh);
      stemHigh.connect(volumeGain);

      volumeGain.connect(crossGain);

      crossGain.connect(masterGain);
      crossGain.connect(delayWet);
      crossGain.connect(reverbWet);

      if (deck === "A") {
        eqLowARef.current = eqLow; eqMidARef.current = eqMid; eqHighARef.current = eqHigh; biquadFilterARef.current = filter;
        stemLowARef.current = stemLow; stemMidARef.current = stemMid; stemHighARef.current = stemHigh;
        volumeGainARef.current = volumeGain; crossGainARef.current = crossGain;
      } else {
        eqLowBRef.current = eqLow; eqMidBRef.current = eqMid; eqHighBRef.current = eqHigh; biquadFilterBRef.current = filter;
        stemLowBRef.current = stemLow; stemMidBRef.current = stemMid; stemHighBRef.current = stemHigh;
        volumeGainBRef.current = volumeGain; crossGainBRef.current = crossGain;
      }
    };

    setupDeck("A");
    setupDeck("B");

    delayWet.connect(delayNode);
    delayNode.connect(masterGain);

    const revDelay = ctx.createDelay(); revDelay.delayTime.value = 0.08;
    const revFb = ctx.createGain(); revFb.gain.value = 0.6;
    reverbWet.connect(revDelay); revDelay.connect(revFb); revFb.connect(revDelay); revDelay.connect(masterGain);

    return ctx;
  };

  const connectAudioElement = (deck: "A" | "B", audioElement: HTMLAudioElement) => {
    const ctx = initAudio();
    const sourceNodeRef = deck === "A" ? sourceNodeARef : sourceNodeBRef;
    const eqLowRef = deck === "A" ? eqLowARef : eqLowBRef;

    // Disconnect old source if exists
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
    }

    const source = ctx.createMediaElementSource(audioElement);
    if (eqLowRef.current) {
      source.connect(eqLowRef.current);
    }
    sourceNodeRef.current = source;
  };

  return {
    audioCtxRef,
    initAudio,
    connectAudioElement,
    nodes: {
      A: {
        eqLow: eqLowARef, eqMid: eqMidARef, eqHigh: eqHighARef, filter: biquadFilterARef,
        stemLow: stemLowARef, stemMid: stemMidARef, stemHigh: stemHighARef,
        volume: volumeGainARef, cross: crossGainARef,
      },
      B: {
        eqLow: eqLowBRef, eqMid: eqMidBRef, eqHigh: eqHighBRef, filter: biquadFilterBRef,
        stemLow: stemLowBRef, stemMid: stemMidBRef, stemHigh: stemHighBRef,
        volume: volumeGainBRef, cross: crossGainBRef,
      },
      master: masterGainRef,
      analyser: analyserRef,
      fx: { delayWet: delayWetRef, reverbWet: reverbWetRef }
    }
  };
}
