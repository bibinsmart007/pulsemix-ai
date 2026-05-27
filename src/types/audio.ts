export type StemStatus = "NOT_GENERATED" | "EXTRACTING" | "READY" | "FAILED";

export interface TrackMetadata {
  id: string;
  youtube_url: string;
  title: string;
  duration: number;
  bpm: number;
  key: string;
  genre: string;
  thumbnail: string;
  stem_status?: StemStatus;
  vocals_path?: string;
  drums_path?: string;
  bass_path?: string;
  other_path?: string;
  bpm_confidence?: number;
  key_confidence?: number;
  downbeat_confidence?: number;
  hot_cues?: string;
}

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
  cueEnabled: boolean; // Visual-only CUE state for V1
  stems: {
    vocals: number;   // 0 to 1
    melody: number;   // 0 to 1
    drums: number;    // 0 to 1 (low band)
  };
  title: string;
  youtube_url?: string;
  audioUrl?: string;
  stem_status?: StemStatus;
  thumbnail: string;
  trackLoaded: boolean;
  loading: boolean;
  genre: string;
  hotCues: (number | null)[]; // 4 hot cue points in seconds
  loopStart: number | null;
  loopEnd: number | null;
  loopActive: boolean;
  beatgrid?: string;
}

export const initialDeckState = (title: string): DeckState => ({
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
  cueEnabled: false,
  stems: {
    vocals: 1.0,
    melody: 1.0,
    drums: 1.0,
  },
  title,
  youtube_url: undefined,
  audioUrl: undefined,
  stem_status: "NOT_GENERATED",
  thumbnail: "",
  trackLoaded: false,
  loading: false,
  genre: "Electronic / Beats",
  hotCues: [null, null, null, null],
  loopStart: null,
  loopEnd: null,
  loopActive: false,
});
