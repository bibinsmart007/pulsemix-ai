import { useState, useEffect, useRef } from "react";

export function useTimelinePlayback(audioEngine: any, positionedBlocks: any[]) {
  const [globalTimeMs, setGlobalTimeMs] = useState(0);
  const [isPlayingGlobal, setIsPlayingGlobal] = useState(false);
  const [auditionMode, setAuditionMode] = useState<"approx" | "render" | "none">("none");
  const [activeBoundaryItem, setActiveBoundaryItem] = useState<number | null>(null);
  
  const lastTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  const startPlayback = () => {
    setIsPlayingGlobal(true);
    lastTimeRef.current = performance.now();
  };

  const pausePlayback = () => {
    setIsPlayingGlobal(false);
    audioEngine.pauseDeck("A");
    audioEngine.pauseDeck("B");
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  useEffect(() => {
    if (!isPlayingGlobal) return;

    const loop = (time: number) => {
      const deltaMs = time - lastTimeRef.current;
      lastTimeRef.current = time;
      
      setGlobalTimeMs(prev => {
        const nextTime = prev + deltaMs;
        
        // Find active blocks
        let activeBlockA = null;
        let activeBlockB = null;
        
        for (let i = 0; i < positionedBlocks.length; i++) {
          const block = positionedBlocks[i];
          const endPos = block.startPos + block.actualDuration;
          
          if (nextTime >= block.startPos && nextTime < endPos) {
            if (i % 2 === 0) activeBlockA = block;
            else activeBlockB = block;
          }
        }

        // Handle Deck A
        if (activeBlockA) {
          const trackTimeA = (nextTime - activeBlockA.startPos + activeBlockA.trimStart) / 1000;
          if (!audioEngine.deckA.playing && audioEngine.deckA.trackLoaded) {
             // Only play if it's the correct track
             audioEngine.playDeck("A");
          }
        } else {
          if (audioEngine.deckA.playing) audioEngine.pauseDeck("A");
        }

        // Handle Deck B
        if (activeBlockB) {
          const trackTimeB = (nextTime - activeBlockB.startPos + activeBlockB.trimStart) / 1000;
          if (!audioEngine.deckB.playing && audioEngine.deckB.trackLoaded) {
             audioEngine.playDeck("B");
          }
        } else {
          if (audioEngine.deckB.playing) audioEngine.pauseDeck("B");
        }

        // Calculate transition automation
        if (activeBlockA && activeBlockB) {
          // We are in an overlap!
          // Find which block is the incoming one (the one with xfade)
          const incomingBlock = activeBlockA.startPos > activeBlockB.startPos ? activeBlockA : activeBlockB;
          const outgoingBlock = incomingBlock === activeBlockA ? activeBlockB : activeBlockA;
          
          const overlapStart = incomingBlock.startPos;
          const overlapEnd = overlapStart + incomingBlock.xfade;
          const progress = Math.max(0, Math.min(1, (nextTime - overlapStart) / incomingBlock.xfade));
          
          // Crossfade
          let cfValue = -100; // -100 is A, 100 is B
          const targetDeckIsA = incomingBlock === activeBlockA;
          
          if (incomingBlock.fade_curve === "equal_power") {
            cfValue = targetDeckIsA ? (progress * 200) - 100 : 100 - (progress * 200);
          } else {
            // linear approx
            cfValue = targetDeckIsA ? (progress * 200) - 100 : 100 - (progress * 200);
          }
          audioEngine.setCrossfader(cfValue);

          // EQ Automation (Bass Swap)
          if (incomingBlock.eq_mode === "bass_swap") {
             if (progress > 0.5) {
                audioEngine.updateEQ(targetDeckIsA ? "B" : "A", "low", -12); // outgoing cuts bass
                audioEngine.updateEQ(targetDeckIsA ? "A" : "B", "low", 0);   // incoming brings bass in
             } else {
                audioEngine.updateEQ(targetDeckIsA ? "B" : "A", "low", 0);
                audioEngine.updateEQ(targetDeckIsA ? "A" : "B", "low", -12);
             }
          }
          
        } else if (activeBlockA) {
          audioEngine.setCrossfader(-100);
        } else if (activeBlockB) {
          audioEngine.setCrossfader(100);
        }

        return nextTime;
      });
      
      rafRef.current = requestAnimationFrame(loop);
    };
    
    rafRef.current = requestAnimationFrame(loop);
    
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlayingGlobal, positionedBlocks, audioEngine]);

  const liveAuditionBoundary = async (incomingItemIndex: number) => {
    if (incomingItemIndex === 0) return;
    
    pausePlayback();
    setAuditionMode("approx");
    
    const incomingBlock = positionedBlocks[incomingItemIndex];
    const outgoingBlock = positionedBlocks[incomingItemIndex - 1];
    
    setActiveBoundaryItem(incomingBlock.item_id);
    
    // Determine decks
    const deckIncoming = incomingItemIndex % 2 === 0 ? "A" : "B";
    const deckOutgoing = incomingItemIndex % 2 === 0 ? "B" : "A";
    
    // Jump time to 2 seconds before overlap
    const preRollMs = 2000;
    const startTimeMs = Math.max(0, incomingBlock.startPos - preRollMs);
    setGlobalTimeMs(startTimeMs);
    
    // Load tracks
    await audioEngine.loadTrack(deckOutgoing, `http://127.0.0.1:8000/media/${outgoingBlock.youtube_url.replace('https://www.youtube.com/watch?v=', '')}.mp3`, outgoingBlock.title, outgoingBlock.bpm, outgoingBlock.key_signature);
    await audioEngine.loadTrack(deckIncoming, `http://127.0.0.1:8000/media/${incomingBlock.youtube_url.replace('https://www.youtube.com/watch?v=', '')}.mp3`, incomingBlock.title, incomingBlock.bpm, incomingBlock.key_signature);
    
    // Apply sync if enabled
    if (incomingBlock.sync_mode === "auto" && outgoingBlock.bpm && incomingBlock.bpm) {
      audioEngine.updateBpm(deckIncoming, outgoingBlock.bpm);
    }
    
    // Seek
    setTimeout(() => {
      audioEngine.seekDeck(deckOutgoing, (startTimeMs - outgoingBlock.startPos + outgoingBlock.trimStart) / 1000);
      audioEngine.seekDeck(deckIncoming, (startTimeMs - incomingBlock.startPos + incomingBlock.trimStart) / 1000); // This will seek to negative if before start, so we only play it when nextTime reaches it
      
      startPlayback();
    }, 500);
  };

  return {
    globalTimeMs,
    setGlobalTimeMs,
    isPlayingGlobal,
    startPlayback,
    pausePlayback,
    liveAuditionBoundary,
    auditionMode,
    setAuditionMode,
    activeBoundaryItem
  };
}
