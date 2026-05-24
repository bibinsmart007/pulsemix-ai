import os
import random
import numpy as np
import json

# Krumhansl-Schmuckler key profiles for music information retrieval
MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Camelot Wheel conversions
KEY_TO_CAMELOT = {
    # Minor Keys
    "Abm": "1A", "Ab Minor": "1A", "G#m": "1A",
    "Ebm": "2A", "Eb Minor": "2A", "D#m": "2A",
    "Bbm": "3A", "Bb Minor": "3A", "A#m": "3A",
    "Fm":  "4A", "F Minor": "4A",
    "Cm":  "5A", "C Minor": "5A",
    "Gm":  "6A", "G Minor": "6A",
    "Dm":  "7A", "D Minor": "7A",
    "Am":  "8A", "A Minor": "8A",
    "Em":  "9A", "E Minor": "9A",
    "Bm":  "10A", "B Minor": "10A",
    "F#m": "11A", "F# Minor": "11A",
    "C#m": "12A", "C# Minor": "12A",

    # Major Keys
    "B":   "1B", "B Major":   "1B",
    "F#":  "2B", "F# Major":  "2B", "Gb": "2B",
    "Db":  "3B", "Db Major":  "3B", "C#": "3B",
    "Ab":  "4B", "Ab Major":  "4B",
    "Eb":  "5B", "Eb Major":  "5B",
    "Bb":  "6B", "Bb Major":  "6B",
    "F":   "7B", "F Major":   "7B",
    "C":   "8B", "C Major":   "8B",
    "G":   "9B", "G Major":   "9B",
    "D":   "10B", "D Major":  "10B",
    "A":   "11B", "A Major":  "11B",
    "E":   "12B", "E Major":  "12B",
}

def estimate_key(chroma_vector):
    """
    Finds the key by correlating a 12-dimensional chromagram vector 
    against Krumhansl-Schmuckler major/minor templates.
    """
    best_corr = -1
    best_key = "Am" # default fallback
    
    for i in range(12):
        # Shift profiles to match root pitch class
        shifted_major = np.roll(MAJOR_PROFILE, i)
        shifted_minor = np.roll(MINOR_PROFILE, i)
        
        # Pearson correlation coefficient
        corr_maj = np.corrcoef(chroma_vector, shifted_major)[0, 1]
        corr_min = np.corrcoef(chroma_vector, shifted_minor)[0, 1]
        
        if corr_maj > best_corr:
            best_corr = corr_maj
            best_key = f"{PITCH_CLASSES[i]}"
            
        if corr_min > best_corr:
            best_corr = corr_min
            best_key = f"{PITCH_CLASSES[i]}m"
            
    return best_key, best_corr

class AudioAnalyzer:
    """
    Abstraction layer for Music Information Retrieval (MIR).
    Currently delegates to librosa, but provides a forward-compatible interface
    for Essentia (e.g. rhythm_extractor, key_extractor).
    """
    def __init__(self, filepath: str):
        self.filepath = filepath
        self._y = None
        self._sr = None
        import librosa
        self.librosa = librosa

    def _load_audio(self):
        if self._y is None:
            # Load 45 seconds of the song's middle/chorus portion for more accurate key/tempo detection
            self._y, self._sr = self.librosa.load(self.filepath, sr=22050, duration=45, offset=15)

    def extract_bpm(self) -> tuple[float, float]:
        """Essentia-like rhythm extractor returning (bpm, confidence)"""
        self._load_audio()
        tempo, beats = self.librosa.beat.beat_track(y=self._y, sr=self._sr)
        bpm = float(tempo[0]) if isinstance(tempo, (np.ndarray, list)) else float(tempo)
        
        # Guard against half/double tempo octave errors (e.g. 60bpm or 240bpm)
        if bpm < 75:
            bpm = bpm * 2
        elif bpm > 150:
            bpm = bpm / 2
            
        confidence = 0.9 if len(beats) > 10 else 0.4
        return round(bpm, 1), confidence

    def extract_key(self) -> str:
        """Essentia-like key extractor mapped to Camelot"""
        self._load_audio()
        chroma = self.librosa.feature.chroma_cqt(y=self._y, sr=self._sr)
        chroma_mean = np.mean(chroma, axis=1)
        estimated, corr = estimate_key(chroma_mean)
        camelot = KEY_TO_CAMELOT.get(estimated, "8A")
        if corr < 0.4:
            return f"{camelot} (?)"
        return camelot

    def extract_waveform(self) -> str:
        """Extracts a low-resolution amplitude envelope (200 points) for UI rendering"""
        try:
            # Load full audio at very low sample rate for fast envelope extraction
            y, sr = self.librosa.load(self.filepath, sr=1000)
            points = 200
            hop_length = max(1, len(y) // points)
            envelope = []
            for i in range(0, len(y), hop_length):
                chunk = y[i:i+hop_length]
                envelope.append(float(np.max(np.abs(chunk))) if len(chunk) > 0 else 0.0)
            
            # Normalize to 0.0 - 1.0
            max_val = max(envelope) if envelope else 1.0
            if max_val > 0:
                envelope = [round(v / max_val, 3) for v in envelope]
            
            return json.dumps(envelope)
        except Exception as e:
            print(f"[Analyzer] Failed to extract waveform: {e}")
            return "[]"


def analyze_audio(filepath: str) -> dict:
    """Main entrypoint for backend audio analysis."""
    print(f"[Analyzer] Starting deep audio analysis on {filepath}")
    
    try:
        analyzer = AudioAnalyzer(filepath)
        raw_bpm, bpm_confidence = analyzer.extract_bpm()
        
        bpm = 0.0 if bpm_confidence < 0.3 else raw_bpm
        key = analyzer.extract_key()
        waveform = analyzer.extract_waveform()
        
        
        
        print(f"[Analyzer] Completed: {bpm} BPM (raw {raw_bpm}), Key {key}")
        return {
            "bpm": bpm,
            "raw_bpm": raw_bpm,
            "bpm_confidence": bpm_confidence,
            "key": key,
            "waveform_data": waveform
        }
    except Exception as e:
        print(f"[Analyzer] Failed to analyze {filepath}: {e}")
        # Fallback to explicit unknowns instead of faking 128.0 BPM
        return {
            "bpm": None,
            "bpm_confidence": 0.0,
            "key": None,
            "waveform_data": "[]"
        }
