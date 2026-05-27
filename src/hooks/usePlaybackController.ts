import { useRef, useEffect } from "react";
import { DeckState } from "@/types/audio";

export function usePlaybackController(
  deckA: DeckState, setDeckA: React.Dispatch<React.SetStateAction<DeckState>>,
  deckB: DeckState, setDeckB: React.Dispatch<React.SetStateAction<DeckState>>,
  audioCtxRef: React.MutableRefObject<AudioContext | null>,
  nodes: any
) {
  // Store the decoded buffers
  const bufferARef = useRef<AudioBuffer | null>(null);
  const bufferBRef = useRef<AudioBuffer | null>(null);

  // Store the active source nodes
  const sourceARef = useRef<AudioBufferSourceNode | null>(null);
  const sourceBRef = useRef<AudioBufferSourceNode | null>(null);

  // Track absolute AudioContext time when playback started
  const startTimeARef = useRef<number>(0);
  const startTimeBRef = useRef<number>(0);

  // Track the playhead offset (in seconds within the track) when playback started/paused
  const offsetARef = useRef<number>(0);
  const offsetBRef = useRef<number>(0);

  const rafRefA = useRef<number | null>(null);
  const rafRefB = useRef<number | null>(null);

  const stateRef = useRef({ A: deckA, B: deckB });
  useEffect(() => {
    stateRef.current = { A: deckA, B: deckB };
  }, [deckA, deckB]);

  const snapToGrid = (time: number, gridStr?: string, maxSnapThreshold: number = 0.2): number => {
    if (!gridStr || gridStr === "[]") return time;
    try {
      const grid: number[] = JSON.parse(gridStr);
      if (!Array.isArray(grid) || grid.length === 0) return time;
      
      let closest = grid[0];
      let minDiff = Math.abs(time - closest);
      
      for (let i = 1; i < grid.length; i++) {
        const diff = Math.abs(time - grid[i]);
        if (diff < minDiff) {
           minDiff = diff;
           closest = grid[i];
        }
      }
      
      if (minDiff <= maxSnapThreshold) {
         return closest;
      }
    } catch(e) {}
    return time;
  };

  const loadBuffer = (deck: "A" | "B", buffer: AudioBuffer) => {
    const isA = deck === "A";
    const setDeck = isA ? setDeckA : setDeckB;
    
    // Stop existing playback if any
    pauseDeck(deck);
    
    if (isA) {
      bufferARef.current = buffer;
      offsetARef.current = 0;
    } else {
      bufferBRef.current = buffer;
      offsetBRef.current = 0;
    }

    setDeck(prev => ({
      ...prev,
      duration: buffer.duration,
      currentTime: 0,
      trackLoaded: true,
      loading: false,
      playing: false
    }));
  };

  const calculateCurrentTime = (deck: "A" | "B") => {
    const isA = deck === "A";
    const state = isA ? stateRef.current.A : stateRef.current.B;
    const startTime = isA ? startTimeARef.current : startTimeBRef.current;
    const offset = isA ? offsetARef.current : offsetBRef.current;
    const ctx = audioCtxRef.current;

    if (!ctx || !state.playing) return offset;

    // The amount of time that has passed in the real world since we called start()
    const elapsedRealTime = ctx.currentTime - startTime;
    
    // Apply the playback rate to find how much time in the track has passed
    const speedRatio = (state.bpm / state.originalBpm) * (1 + state.pitch);
    
    let currentTrackTime = offset + (elapsedRealTime * speedRatio);

    // If looping is active and we crossed the loop end, wrap around natively
    // Note: AudioBufferSourceNode handles the actual audio looping automatically if loop=true
    if (state.loopActive && state.loopStart !== null && state.loopEnd !== null) {
      const loopLen = state.loopEnd - state.loopStart;
      if (currentTrackTime > state.loopEnd && loopLen > 0) {
        // Calculate where we are inside the loop
        const overshot = currentTrackTime - state.loopStart;
        currentTrackTime = state.loopStart + (overshot % loopLen);
      }
    }

    // Cap at duration
    const buffer = isA ? bufferARef.current : bufferBRef.current;
    const dur = buffer ? buffer.duration : 0;
    if (currentTrackTime > dur) {
       currentTrackTime = dur;
       // We should ideally fire an ended event here or stop
    }

    return currentTrackTime;
  };

  const startLoop = (deck: "A" | "B") => {
    const isA = deck === "A";
    const setDeck = isA ? setDeckA : setDeckB;

    const tick = () => {
      const state = isA ? stateRef.current.A : stateRef.current.B;
      const buffer = isA ? bufferARef.current : bufferBRef.current;
      const dur = buffer ? buffer.duration : 0;
      
      let newTime = calculateCurrentTime(deck);

      if (newTime >= dur && state.playing) {
         // Reached end of track without looping
         pauseDeck(deck);
      }

      // DO NOT call setDeck(prev => ({ ...prev, currentTime: newTime })) here
      // This decoupling prevents 60fps React re-renders.

      if (isA) {
        rafRefA.current = requestAnimationFrame(tick);
      } else {
        rafRefB.current = requestAnimationFrame(tick);
      }
    };
    
    if (isA) {
      if (rafRefA.current) cancelAnimationFrame(rafRefA.current);
      rafRefA.current = requestAnimationFrame(tick);
    } else {
      if (rafRefB.current) cancelAnimationFrame(rafRefB.current);
      rafRefB.current = requestAnimationFrame(tick);
    }
  };

  const stopLoop = (deck: "A" | "B") => {
    if (deck === "A" && rafRefA.current) cancelAnimationFrame(rafRefA.current);
    if (deck === "B" && rafRefB.current) cancelAnimationFrame(rafRefB.current);
  };

  const playDeck = (deck: "A" | "B") => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const isA = deck === "A";
    const buffer = isA ? bufferARef.current : bufferBRef.current;
    const state = isA ? stateRef.current.A : stateRef.current.B;
    const setDeck = isA ? setDeckA : setDeckB;
    const eqNode = isA ? nodes.A.eqLow.current : nodes.B.eqLow.current;

    if (!buffer || !eqNode) return;

    // Stop existing source if it's playing
    const oldSource = isA ? sourceARef.current : sourceBRef.current;
    if (oldSource) {
      try { oldSource.stop(); oldSource.disconnect(); } catch (e) {}
    }

    // 1. Create a new source node
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    
    // 2. Configure rate/tempo
    const speedRatio = (state.bpm / state.originalBpm) * (1 + state.pitch);
    source.playbackRate.value = speedRatio;

    // 3. Configure Looping
    if (state.loopActive && state.loopStart !== null && state.loopEnd !== null) {
      source.loop = true;
      source.loopStart = state.loopStart;
      source.loopEnd = state.loopEnd;
    } else {
      source.loop = false;
    }

    // 4. Connect to channel strip
    source.connect(eqNode);

    // 5. Calculate offset and start
    const offset = isA ? offsetARef.current : offsetBRef.current;
    
    // WebAudio start(when, offset, duration)
    // We only need 'when' (now) and 'offset'
    source.start(0, offset);

    // Store refs
    if (isA) {
      sourceARef.current = source;
      startTimeARef.current = ctx.currentTime;
    } else {
      sourceBRef.current = source;
      startTimeBRef.current = ctx.currentTime;
    }

    setDeck(prev => ({ ...prev, playing: true }));
    startLoop(deck);
  };

  const pauseDeck = (deck: "A" | "B") => {
    const isA = deck === "A";
    const setDeck = isA ? setDeckA : setDeckB;
    const source = isA ? sourceARef.current : sourceBRef.current;

    if (source) {
      try { source.stop(); } catch(e) {}
      source.disconnect();
    }

    if (isA) {
      offsetARef.current = calculateCurrentTime(deck);
      sourceARef.current = null;
    } else {
      offsetBRef.current = calculateCurrentTime(deck);
      sourceBRef.current = null;
    }

    setDeck(prev => ({ ...prev, playing: false }));
    stopLoop(deck);
  };

  const seekDeck = (deck: "A" | "B", seconds: number, snap: boolean = false) => {
    const isA = deck === "A";
    const setDeck = isA ? setDeckA : setDeckB;
    const state = isA ? stateRef.current.A : stateRef.current.B;
    const buffer = isA ? bufferARef.current : bufferBRef.current;

    if (!buffer) return;

    let target = Math.max(0, Math.min(seconds, buffer.duration));
    if (snap) {
      target = snapToGrid(target, state.beatgrid);
    }

    // Update offset
    if (isA) {
      offsetARef.current = target;
    } else {
      offsetBRef.current = target;
    }

    setDeck(prev => ({ ...prev, currentTime: target }));

    // If we are currently playing, we must recreate the source node to jump instantly
    if (state.playing) {
      playDeck(deck);
    }
  };

  const updatePlaybackRate = (deck: "A" | "B", targetBpm: number, pitchOffset: number, originalBpm: number) => {
    const isA = deck === "A";
    const source = isA ? sourceARef.current : sourceBRef.current;
    const state = isA ? stateRef.current.A : stateRef.current.B;
    
    const speedRatio = (targetBpm / originalBpm) * (1 + pitchOffset);
    
    if (source && state.playing) {
       // Since rate change affects our timeline calculation, we must recalculate offset up to NOW,
       // update the startTime to NOW, and THEN change the rate, so the math stays correct.
       const nowTime = calculateCurrentTime(deck);
       if (isA) {
          offsetARef.current = nowTime;
          startTimeARef.current = audioCtxRef.current?.currentTime || 0;
       } else {
          offsetBRef.current = nowTime;
          startTimeBRef.current = audioCtxRef.current?.currentTime || 0;
       }
       source.playbackRate.setValueAtTime(speedRatio, audioCtxRef.current?.currentTime || 0);
    }
  };

  useEffect(() => {
    return () => {
      if (rafRefA.current) cancelAnimationFrame(rafRefA.current);
      if (rafRefB.current) cancelAnimationFrame(rafRefB.current);
      if (sourceARef.current) { try { sourceARef.current.stop(); } catch(e){} }
      if (sourceBRef.current) { try { sourceBRef.current.stop(); } catch(e){} }
    };
  }, []);

  // Update loop dynamically if we change loop boundaries while playing
  useEffect(() => {
    const handleLoopChange = (deck: "A" | "B") => {
      const isA = deck === "A";
      const source = isA ? sourceARef.current : sourceBRef.current;
      const state = isA ? stateRef.current.A : stateRef.current.B;
      if (source && state.playing) {
         if (state.loopActive && state.loopStart !== null && state.loopEnd !== null) {
            source.loop = true;
            source.loopStart = state.loopStart;
            source.loopEnd = state.loopEnd;
         } else {
            source.loop = false;
         }
      }
    };
    handleLoopChange("A");
    handleLoopChange("B");
  }, [deckA.loopActive, deckA.loopStart, deckA.loopEnd, deckB.loopActive, deckB.loopStart, deckB.loopEnd]);


  return {
    loadBuffer,
    playDeck,
    pauseDeck,
    seekDeck,
    updatePlaybackRate,
    getCurrentTime: calculateCurrentTime
  };
}
