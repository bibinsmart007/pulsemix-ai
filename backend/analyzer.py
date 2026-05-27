import os
import random
import numpy as np
import json
import traceback

# Krumhansl-Schmuckler key profiles for music information retrieval
MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Camelot Wheel conversions
KEY_TO_CAMELOT = {
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
    best_corr = -1
    best_key = "Am"
    
    for i in range(12):
        shifted_major = np.roll(MAJOR_PROFILE, i)
        shifted_minor = np.roll(MINOR_PROFILE, i)
        
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
    def __init__(self, filepath: str, full_analysis: bool = True):
        self.filepath = filepath
        self.full_analysis = full_analysis
        self._y = None
        self._sr = None
        import librosa
        self.librosa = librosa

    def _load_audio(self):
        if self._y is None:
            if self.full_analysis:
                # Load full track
                self._y, self._sr = self.librosa.load(self.filepath, sr=22050)
            else:
                # Fallback lightweight 45s analysis
                self._y, self._sr = self.librosa.load(self.filepath, sr=22050, duration=45, offset=15)

    def extract_bpm_and_beats(self) -> tuple[float, float, list[float], list[float], list[float], float]:
        self._load_audio()
        
        # 1. Beat Tracking
        tempo, beats = self.librosa.beat.beat_track(y=self._y, sr=self._sr)
        bpm = float(tempo[0]) if isinstance(tempo, (np.ndarray, list)) else float(tempo)
        
        if bpm < 75: bpm = bpm * 2
        elif bpm > 150: bpm = bpm / 2
            
        bpm_confidence = 0.95 if len(beats) > (20 if self.full_analysis else 10) else 0.4
        beat_times = self.librosa.frames_to_time(beats, sr=self._sr).tolist()
        
        if len(beats) < 4:
            return round(bpm, 1), bpm_confidence, beat_times, [], [], 0.0

        # 2. Downbeat Heuristic via Bass Energy
        # Extract low-frequency onset strength (e.g. kick drums)
        bass_onset = self.librosa.onset.onset_strength(y=self._y, sr=self._sr, fmax=150)
        
        # We assume 4/4 time. We calculate the average bass energy for each of the 4 phases.
        phase_energies = np.zeros(4)
        phase_counts = np.zeros(4)
        
        for i, beat_frame in enumerate(beats):
            phase = i % 4
            # safely get onset strength at this frame
            if beat_frame < len(bass_onset):
                phase_energies[phase] += bass_onset[beat_frame]
                phase_counts[phase] += 1
                
        # Average energy per phase
        avg_phase_energies = np.divide(phase_energies, phase_counts, out=np.zeros_like(phase_energies), where=phase_counts!=0)
        
        # The phase with the highest average bass energy is the downbeat (Beat 1)
        downbeat_phase = int(np.argmax(avg_phase_energies))
        
        # Calculate confidence
        sorted_energies = np.sort(avg_phase_energies)[::-1]
        downbeat_confidence = 0.0
        if sorted_energies[0] > 0:
            downbeat_confidence = float((sorted_energies[0] - sorted_energies[1]) / sorted_energies[0])
            
        downbeat_confidence = min(1.0, max(0.0, downbeat_confidence * 1.5)) # Scale up slightly
        
        # 3. Extract Downbeats (Phrase Markers)
        phrase_markers = []
        downbeat_indices = []
        for i in range(len(beat_times)):
            if i % 4 == downbeat_phase:
                phrase_markers.append(beat_times[i])
                downbeat_indices.append(i)
                
        # 4. Extract Structural Cue Points (Hot Cues)
        # Compute global novelty/onset across full spectrum
        global_onset = self.librosa.onset.onset_strength(y=self._y, sr=self._sr)
        
        hot_cues = []
        if self.full_analysis and len(downbeat_indices) > 0:
            # We want to find downbeats that correspond to large structural changes (high global novelty)
            downbeat_frames = [beats[i] for i in downbeat_indices if beats[i] < len(global_onset)]
            if downbeat_frames:
                downbeat_novelty = [global_onset[f] for f in downbeat_frames]
                
                # Pick the top 4 highest novelty downbeats, ensuring they are spaced apart (e.g. at least 15 seconds)
                min_spacing_frames = int(15.0 * self._sr / 512) # hop length is 512
                
                sorted_downbeat_idx = np.argsort(downbeat_novelty)[::-1]
                selected_frames = []
                
                for idx in sorted_downbeat_idx:
                    frame = downbeat_frames[idx]
                    # Check spacing
                    if all(abs(frame - sf) > min_spacing_frames for sf in selected_frames):
                        selected_frames.append(frame)
                        if len(selected_frames) == 4:
                            break
                            
                selected_frames.sort()
                hot_cues = self.librosa.frames_to_time(selected_frames, sr=self._sr).tolist()
        
        return round(bpm, 1), bpm_confidence, beat_times, phrase_markers, hot_cues, downbeat_confidence

    def extract_key(self) -> tuple[str, str, float]:
        self._load_audio()
        # Upgrade to chroma_cens for better harmonic extraction robust to dynamics
        chroma = self.librosa.feature.chroma_cens(y=self._y, sr=self._sr)
        chroma_mean = np.mean(chroma, axis=1)
        estimated, corr = estimate_key(chroma_mean)
        camelot = KEY_TO_CAMELOT.get(estimated, "8A")
        return estimated, camelot, float(corr)

    def extract_waveform(self) -> str:
        try:
            y, sr = self.librosa.load(self.filepath, sr=1000)
            points = 200
            hop_length = max(1, len(y) // points)
            envelope = []
            for i in range(0, len(y), hop_length):
                chunk = y[i:i+hop_length]
                envelope.append(float(np.max(np.abs(chunk))) if len(chunk) > 0 else 0.0)
            
            max_val = max(envelope) if envelope else 1.0
            if max_val > 0:
                envelope = [round(v / max_val, 3) for v in envelope]
            
            return json.dumps(envelope)
        except Exception as e:
            print(f"[Analyzer] Failed to extract waveform: {e}")
            return "[]"

def _run_analysis(filepath: str, full_analysis: bool) -> dict:
    analyzer = AudioAnalyzer(filepath, full_analysis=full_analysis)
    raw_bpm, bpm_confidence, beatgrid, phrase_markers, hot_cues, downbeat_confidence = analyzer.extract_bpm_and_beats()
    
    bpm = 0.0 if bpm_confidence < 0.3 else raw_bpm
    raw_key, camelot_key, key_corr = analyzer.extract_key()
    waveform = analyzer.extract_waveform()
    
    print(f"[Analyzer] Completed ({'FULL' if full_analysis else 'FALLBACK'}): {bpm} BPM, Key {raw_key} ({camelot_key})")
    
    # Ensure exactly 4 hot cues
    hot_cues_padded = (hot_cues + [None, None, None, None])[:4]
    
    return {
        "bpm": bpm,
        "raw_bpm": raw_bpm,
        "bpm_confidence": bpm_confidence,
        "key": raw_key,
        "key_camelot": camelot_key,
        "key_confidence": key_corr,
        "waveform_data": waveform,
        "beatgrid": json.dumps(beatgrid),
        "phrase_markers": json.dumps(phrase_markers),
        "hot_cues": json.dumps(hot_cues_padded),
        "downbeat_confidence": downbeat_confidence,
        "analysis_mode": "FULL" if full_analysis else "FALLBACK"
    }

def analyze_audio(filepath: str) -> dict:
    """Main entrypoint for backend audio analysis."""
    print(f"[Analyzer] Starting deep audio analysis on {filepath}")
    
    try:
        # Attempt full-track analysis
        return _run_analysis(filepath, full_analysis=True)
    except Exception as e:
        print(f"[Analyzer] Full analysis failed for {filepath}: {e}")
        traceback.print_exc()
        try:
            # Fallback to lightweight analysis
            print(f"[Analyzer] Attempting fallback lightweight analysis on {filepath}")
            return _run_analysis(filepath, full_analysis=False)
        except Exception as fallback_e:
            print(f"[Analyzer] Fallback analysis also failed: {fallback_e}")
            return {
                "bpm": None, "bpm_confidence": 0.0,
                "key": None, "key_camelot": None, "key_confidence": 0.0,
                "waveform_data": "[]", "beatgrid": "[]", 
                "phrase_markers": "[]", "hot_cues": json.dumps([None, None, None, None]),
                "downbeat_confidence": 0.0, "analysis_mode": "FAILED"
            }
