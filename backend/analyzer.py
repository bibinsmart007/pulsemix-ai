import os
import random
import numpy as np

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
            
    return best_key

def analyze_audio(filepath: str) -> dict:
    """
    Analyzes an audio file using Librosa to compute its BPM and Camelot Key.
    Falls back gracefully if librosa is not installed or has compilation bugs.
    """
    filename = os.path.basename(filepath)
    
    # Try using Librosa if imported successfully
    try:
        import librosa
        print(f"[Analyzer] Loading {filepath} for librosa analysis...")
        
        # Load 45 seconds of the song's middle/chorus portion for more accurate key/tempo detection
        y, sr = librosa.load(filepath, sr=22050, duration=45, offset=15)
        
        # 1. BPM / Beat Tracking
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        # Extract scalar float
        bpm = float(tempo[0]) if isinstance(tempo, (np.ndarray, list)) else float(tempo)
        bpm = round(bpm, 1)
        
        # Guard against half/double tempo octave errors (e.g. 60bpm or 240bpm)
        if bpm < 75:
            bpm = bpm * 2
        elif bpm > 150:
            bpm = bpm / 2
            
        # 2. Key Detection
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr, warning=False)
        chroma_mean = np.mean(chroma, axis=1)
        estimated = estimate_key(chroma_mean)
        
        camelot = KEY_TO_CAMELOT.get(estimated, "8A") # default Am
        
        print(f"[Analyzer] librosa result: {bpm} BPM, Key: {estimated} ({camelot})")
        return {
            "bpm": bpm,
            "key": camelot,
            "key_name": KEY_TO_CAMELOT.get(estimated, "8A"),
            "success": True
        }
        
    except Exception as e:
        print(f"[Analyzer] Librosa analysis failed or not installed ({str(e)}).")
        
        return {
            "success": False,
            "error": str(e)
        }
