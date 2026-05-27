import { useState, useRef, useEffect } from "react";

const MAX_RECORDING_MS = 30 * 60 * 1000; // 30 minutes

export function useRecording(
  audioCtxRef: React.MutableRefObject<AudioContext | null>,
  masterGainRef: React.MutableRefObject<GainNode | null>
) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTimeMs, setRecordingTimeMs] = useState(0);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const startRecording = () => {
    const ctx = audioCtxRef.current;
    const master = masterGainRef.current;

    if (!ctx || !master) return;

    // Reset previous
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
      setRecordingUrl(null);
    }
    chunksRef.current = [];
    setRecordingTimeMs(0);

    // Create stream destination
    const dest = ctx.createMediaStreamDestination();
    streamDestRef.current = dest;
    master.connect(dest);

    // Initialize recorder
    // Safari might not support audio/webm, fallback gracefully
    let mimeType = 'audio/webm';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else {
        mimeType = ''; // Let browser default
      }
    }

    const recorder = new MediaRecorder(dest.stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
      const url = URL.createObjectURL(blob);
      setRecordingUrl(url);
      
      // Cleanup node
      if (streamDestRef.current && masterGainRef.current) {
        try { masterGainRef.current.disconnect(streamDestRef.current); } catch(e) {}
        streamDestRef.current = null;
      }
    };

    recorder.start(1000); // chunk every 1s
    setIsRecording(true);
    startTimeRef.current = Date.now();

    // Start timer loop
    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      setRecordingTimeMs(elapsed);
      
      if (elapsed >= MAX_RECORDING_MS) {
         stopRecording();
      } else {
         timerRef.current = requestAnimationFrame(tick);
      }
    };
    timerRef.current = requestAnimationFrame(tick);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) cancelAnimationFrame(timerRef.current);
  };

  const clearRecording = () => {
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
      setRecordingUrl(null);
    }
    setRecordingTimeMs(0);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return {
    isRecording,
    recordingTimeMs,
    recordingUrl,
    startRecording,
    stopRecording,
    clearRecording
  };
}
