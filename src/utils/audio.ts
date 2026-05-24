/**
 * Camelot Wheel Utility
 * Tracks are harmonically compatible if they are:
 * 1. The same key (e.g., 8A and 8A)
 * 2. Adjacent keys (e.g., 8A and 7A or 9A)
 * 3. Relative keys - Major to Minor or vice-versa (e.g., 8A and 8B)
 */

export interface KeyInfo {
  camelot: string;
  name: string;
  relative: string;
}

export const CAMELOT_WHEEL: Record<string, KeyInfo> = {
  // Minor Keys (A)
  "1A": { camelot: "1A", name: "A-flat Minor (Abm)", relative: "1B" },
  "2A": { camelot: "2A", name: "E-flat Minor (Ebm)", relative: "2B" },
  "3A": { camelot: "3A", name: "B-flat Minor (Bbm)", relative: "3B" },
  "4A": { camelot: "4A", name: "F Minor (Fm)", relative: "4B" },
  "5A": { camelot: "5A", name: "C Minor (Cm)", relative: "5B" },
  "6A": { camelot: "6A", name: "G Minor (Gm)", relative: "6B" },
  "7A": { camelot: "7A", name: "D Minor (Dm)", relative: "7B" },
  "8A": { camelot: "8A", name: "A Minor (Am)", relative: "8B" },
  "9A": { camelot: "9A", name: "E Minor (Em)", relative: "9B" },
  "10A": { camelot: "10A", name: "B Minor (Bm)", relative: "10B" },
  "11A": { camelot: "11A", name: "F-sharp Minor (F#m)", relative: "11B" },
  "12A": { camelot: "12A", name: "D-sharp Minor (D#m)", relative: "12B" },

  // Major Keys (B)
  "1B": { camelot: "1B", name: "B Major (B)", relative: "1A" },
  "2B": { camelot: "2B", name: "F-sharp Major (F#)", relative: "2A" },
  "3B": { camelot: "3B", name: "D-flat Major (Db)", relative: "3A" },
  "4B": { camelot: "4B", name: "A-flat Major (Ab)", relative: "4A" },
  "5B": { camelot: "5B", name: "E-flat Major (Eb)", relative: "5A" },
  "6B": { camelot: "6B", name: "B-flat Major (Bb)", relative: "6A" },
  "7B": { camelot: "7B", name: "F Major (F)", relative: "7A" },
  "8B": { camelot: "8B", name: "C Major (C)", relative: "8A" },
  "9B": { camelot: "9B", name: "G Major (G)", relative: "9A" },
  "10B": { camelot: "10B", name: "D Major (D)", relative: "10A" },
  "11B": { camelot: "11B", name: "A Major (A)", relative: "11A" },
  "12B": { camelot: "12B", name: "E Major (E)", relative: "12A" },
};

/**
 * Checks if two Camelot keys are harmonically compatible.
 */
export function areKeysCompatible(keyA: string, keyB: string): boolean {
  if (!keyA || !keyB) return false;
  
  // Clean keys (e.g., "8A" or "10B") and handle (?) suffix
  const kA = keyA.replace(" (?)", "").trim().toUpperCase();
  const kB = keyB.replace(" (?)", "").trim().toUpperCase();
  
  if (kA === kB) return true;
  
  const numA = parseInt(kA.slice(0, -1), 10);
  const numB = parseInt(kB.slice(0, -1), 10);
  const letterA = kA.slice(-1);
  const letterB = kB.slice(-1);
  
  if (isNaN(numA) || isNaN(numB)) return false;
  
  // Rule 1: Same wheel number, different letters (e.g., 8A <-> 8B relative major/minor)
  if (numA === numB && letterA !== letterB) {
    return true;
  }
  
  // Rule 2: Same letter, adjacent numbers (e.g., 8A <-> 7A or 9A)
  // Account for wrap-around of Camelot wheel (12 <-> 1)
  if (letterA === letterB) {
    const diff = Math.abs(numA - numB);
    if (diff === 1 || diff === 11) {
      return true;
    }
  }
  
  return false;
}

/**
 * Gets a list of compatible Camelot keys for a given key.
 */
export function getCompatibleKeys(key: string): string[] {
  if (!key) return [];
  const cleanKey = key.replace(" (?)", "").trim().toUpperCase();
  const num = parseInt(cleanKey.slice(0, -1), 10);
  const letter = cleanKey.slice(-1);
  
  if (isNaN(num)) return [];
  
  const relativeLetter = letter === "A" ? "B" : "A";
  
  const prevNum = num === 1 ? 12 : num - 1;
  const nextNum = num === 12 ? 1 : num + 1;
  
  return [
    cleanKey, // Same Key
    `${num}${relativeLetter}`, // Relative key (8A -> 8B)
    `${prevNum}${letter}`, // Adjacents
    `${nextNum}${letter}`,
  ];
}

/**
 * Calculates playbackRate needed to match BPMs.
 */
export function calculatePlaybackRate(sourceBpm: number, targetBpm: number): number {
  if (!sourceBpm || !targetBpm || sourceBpm <= 0) return 1.0;
  return targetBpm / sourceBpm;
}

/**
 * Encodes an AudioBuffer into a WAV Blob (16-bit PCM Stereo).
 */
export function bufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArr = new ArrayBuffer(length);
  const view = new DataView(bufferArr);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // Write WAV Header
  
  // "RIFF"
  setUint32(0x46464952);
  // file length - 8
  setUint32(length - 8);
  // "WAVE"
  setUint32(0x45564157);
  // "fmt " chunk
  setUint32(0x20746d66);
  // chunk length
  setUint32(16);
  // sample format (raw PCM)
  setUint16(1);
  // channel count
  setUint16(numOfChan);
  // sample rate
  setUint32(buffer.sampleRate);
  // byte rate = sampleRate * channelCount * bytesPerSample
  setUint32(buffer.sampleRate * numOfChan * 2);
  // block align = channelCount * bytesPerSample
  setUint16(numOfChan * 2);
  // bits per sample
  setUint16(16);
  // "data" chunk
  setUint32(0x61746164);
  // chunk length
  setUint32(length - pos - 4);

  // Write PCM Audio Data
  for (i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {
      // Interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
      // convert to 16-bit signed integer
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(pos, sample, true); // true = little endian
      pos += 2;
    }
    offset++;
  }

  return new Blob([bufferArr], { type: "audio/wav" });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}
