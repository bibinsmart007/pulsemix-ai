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
  trackLoaded: boolean;
  loading: boolean;
  genre: string;
  hotCues: (number | null)[]; // 4 hot cue points in seconds
  loopStart: number | null;
  loopEnd: number | null;
  loopActive: boolean;
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
  stems: {
    vocals: 1.0,
    melody: 1.0,
    drums: 1.0,
  },
  title,
  thumbnail: "",
  trackLoaded: false,
  loading: false,
  genre: "Electronic / Beats",
  hotCues: [null, null, null, null],
  loopStart: null,
  loopEnd: null,
  loopActive: false,
});
