import { useRef, useEffect } from "react";
import { DeckState } from "@/types/audio";

export function usePlaybackController(
  deckA: DeckState, setDeckA: React.Dispatch<React.SetStateAction<DeckState>>,
  deckB: DeckState, setDeckB: React.Dispatch<React.SetStateAction<DeckState>>
) {
  const audioElemARef = useRef<HTMLAudioElement | null>(null);
  const audioElemBRef = useRef<HTMLAudioElement | null>(null);
  const rafRefA = useRef<number | null>(null);
  const rafRefB = useRef<number | null>(null);

  // Keep a stable ref to latest states for the RAF loop
  const stateRef = useRef({ A: deckA, B: deckB });
  useEffect(() => {
    stateRef.current = { A: deckA, B: deckB };
  }, [deckA, deckB]);

  const startLoop = (deck: "A" | "B") => {
    const isA = deck === "A";
    const audioEl = isA ? audioElemARef.current : audioElemBRef.current;
    const setDeck = isA ? setDeckA : setDeckB;

    if (!audioEl) return;

    const tick = () => {
      const state = isA ? stateRef.current.A : stateRef.current.B;
      
      // Handle Looping
      if (state.loopActive && state.loopStart !== null && state.loopEnd !== null) {
        if (audioEl.currentTime >= state.loopEnd) {
          audioEl.currentTime = state.loopStart;
        }
      }

      setDeck(prev => {
        // Only trigger react re-render if time moved significantly or to keep UI smooth?
        // Updating state 60fps might be heavy, but let's stick to the old 100ms interval for react state updates
        // actually let's just update it
        return { ...prev, currentTime: audioEl.currentTime };
      });

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

  const playDeck = (deck: "A" | "B", audioCtx?: AudioContext | null) => {
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();

    const audioEl = deck === "A" ? audioElemARef.current : audioElemBRef.current;
    const setDeck = deck === "A" ? setDeckA : setDeckB;
    if (audioEl) {
      audioEl.play().then(() => {
        setDeck(prev => ({ ...prev, playing: true }));
        startLoop(deck);
      }).catch(err => console.error(err));
    }
  };

  const pauseDeck = (deck: "A" | "B") => {
    const audioEl = deck === "A" ? audioElemARef.current : audioElemBRef.current;
    const setDeck = deck === "A" ? setDeckA : setDeckB;
    if (audioEl) {
      audioEl.pause();
      setDeck(prev => ({ ...prev, playing: false }));
      stopLoop(deck);
    }
  };

  const seekDeck = (deck: "A" | "B", seconds: number) => {
    const audioEl = deck === "A" ? audioElemARef.current : audioElemBRef.current;
    const setDeck = deck === "A" ? setDeckA : setDeckB;
    if (audioEl) {
      audioEl.currentTime = seconds;
      setDeck(prev => ({ ...prev, currentTime: seconds }));
    }
  };

  const updatePlaybackRate = (deck: "A" | "B", targetBpm: number, pitchOffset: number, originalBpm: number) => {
    const audioEl = deck === "A" ? audioElemARef.current : audioElemBRef.current;
    if (audioEl) {
      const speedRatio = (targetBpm / originalBpm) * (1 + pitchOffset);
      audioEl.playbackRate = speedRatio;
    }
  };

  useEffect(() => {
    return () => {
      if (rafRefA.current) cancelAnimationFrame(rafRefA.current);
      if (rafRefB.current) cancelAnimationFrame(rafRefB.current);
    };
  }, []);

  return {
    audioElemARef,
    audioElemBRef,
    playDeck,
    pauseDeck,
    seekDeck,
    updatePlaybackRate
  };
}
