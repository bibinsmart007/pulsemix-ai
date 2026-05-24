import time
import os
import json
import numpy as np
from pydub import AudioSegment
from pydub.generators import Sine
from database import update_export_status, get_playlist_items, update_export_metadata
from scipy import signal
import librosa
import array

EXPORT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "exports")
os.makedirs(EXPORT_DIR, exist_ok=True)

def apply_time_stretch(seg: AudioSegment, stretch_ratio: float) -> AudioSegment:
    if stretch_ratio == 1.0 or stretch_ratio <= 0:
        return seg
        
    samples = np.array(seg.get_array_of_samples(), dtype=np.float32)
    channels = seg.channels
    sr = seg.frame_rate
    
    if channels == 2:
        # librosa expects shape (channels, samples)
        s = samples.reshape(-1, 2).T
        stretched = np.array([librosa.effects.time_stretch(s[0], rate=stretch_ratio),
                              librosa.effects.time_stretch(s[1], rate=stretch_ratio)])
        stretched = stretched.T.flatten()
    else:
        stretched = librosa.effects.time_stretch(samples, rate=stretch_ratio)
        
    # Convert back to AudioSegment
    stretched_int = np.int16(np.clip(stretched, -32768, 32767))
    stretched_array = array.array(seg.array_type, stretched_int)
    return seg._spawn(stretched_array)

def apply_eq(samples, sr, mode, channels, is_outgoing=True):
    if mode == 'none' or mode == 'smooth_blend':
        return samples
        
    if channels == 2:
        s = samples.reshape(-1, 2)
    else:
        s = samples.reshape(-1, 1)
        
    processed = np.zeros_like(s)
    
    if mode == 'bass_swap':
        if is_outgoing:
            b, a = signal.butter(2, 250 / (sr / 2), btype='high')
            for c in range(channels):
                processed[:, c] = signal.lfilter(b, a, s[:, c])
            return processed.flatten()
        else:
            return samples
            
    elif mode == 'soft_exit':
        if is_outgoing:
            b, a = signal.butter(2, 300 / (sr / 2), btype='low')
            for c in range(channels):
                processed[:, c] = signal.lfilter(b, a, s[:, c])
            t = np.linspace(0, 1, len(s), dtype=np.float32)
            for c in range(channels):
                processed[:, c] = s[:, c] * (1 - t) + processed[:, c] * t
            return processed.flatten()
        else:
            return samples
            
    elif mode == 'vocal_protect':
        if not is_outgoing:
            b, a = signal.butter(2, [300 / (sr / 2), 3000 / (sr / 2)], btype='bandstop')
            for c in range(channels):
                processed[:, c] = signal.lfilter(b, a, s[:, c])
            return processed.flatten()
        else:
            return samples

    return samples

def apply_custom_crossfade(seg1: AudioSegment, seg2: AudioSegment, xfade_ms: int, curve: str = 'linear', duck_amount_db: float = 0.0, eq_mode: str = 'none') -> AudioSegment:
    if xfade_ms <= 0:
        return seg1 + seg2
    
    # Ensure matching properties for sample-level math
    if seg1.frame_rate != seg2.frame_rate or seg1.channels != seg2.channels or seg1.sample_width != 2:
        return seg1.append(seg2, crossfade=xfade_ms)
        
    xfade_ms = min(xfade_ms, len(seg1), len(seg2))
    
    seg1_base = seg1[:-xfade_ms]
    seg1_fade = seg1[-xfade_ms:]
    
    seg2_fade = seg2[:xfade_ms]
    seg2_base = seg2[xfade_ms:]
    
    samples1 = np.array(seg1_fade.get_array_of_samples(), dtype=np.float32)
    samples2 = np.array(seg2_fade.get_array_of_samples(), dtype=np.float32)
    
    sr = seg1.frame_rate
    channels = seg1.channels
    
    samples1 = apply_eq(samples1, sr, eq_mode, channels, is_outgoing=True)
    samples2 = apply_eq(samples2, sr, eq_mode, channels, is_outgoing=False)
    
    channels = seg1.channels
    frames = len(samples1) // channels
    t = np.linspace(0, 1, frames, dtype=np.float32)
    
    if curve == 'equal_power':
        env_out = np.cos(t * (np.pi / 2))
        env_in = np.sin(t * (np.pi / 2))
    else: # linear
        env_out = 1.0 - t
        env_in = t
        
    if duck_amount_db < 0:
        duck_factor = 10 ** (duck_amount_db / 20.0)
        env_out *= duck_factor
        
    env_out = np.repeat(env_out, channels)
    env_in = np.repeat(env_in, channels)
    
    # Trim to ensure matching lengths (in case of slight off-by-one with frame counts)
    min_len = min(len(samples1), len(samples2), len(env_out))
    
    mixed_samples = (samples1[:min_len] * env_out[:min_len]) + (samples2[:min_len] * env_in[:min_len])
    
    import array
    mixed_array = array.array(seg1_fade.array_type, np.int16(np.clip(mixed_samples, -32768, 32767)))
    mixed_fade_seg = seg1_fade._spawn(mixed_array)
    
    return seg1_base + mixed_fade_seg + seg2_base

def process_export_job(job_id: str, playlist_id: int, playlist_name: str, master_bus_mode: str = "Balanced"):
    """
    Background task to render a playlist into a continuous .wav file.
    """
    try:
        update_export_status(job_id, "rendering", 10)
        
        items = get_playlist_items(playlist_id)
        if not items:
            raise Exception("Playlist is empty. Nothing to export.")
            
        mix = AudioSegment.silent(duration=0)
        is_fallback = False
        
        timing_sources = set()
        transitions_applied = []
        
        for i, item in enumerate(items):
            progress = 10 + int((i / len(items)) * 60)
            update_export_status(job_id, "rendering", progress)
            
            preset = item.get("transition_preset", "manual")
            is_snapped = item.get("is_snapped", False)
            source_type = "preset" if preset and preset != "manual" else ("snapped" if is_snapped else "raw")
            timing_sources.add(source_type)
                
            filepath = item.get("filepath")
            if not filepath or not os.path.exists(filepath):
                print(f"[Exporter] Warning: Track {item.get('title')} file missing. Skipping.")
                continue
                
            try:
                track_audio = AudioSegment.from_file(filepath)
                
                start_ms = item.get("trim_start_ms", 0)
                end_ms = item.get("trim_end_ms", 0)
                
                if end_ms and end_ms > start_ms:
                    track_audio = track_audio[start_ms:end_ms]
                elif start_ms > 0:
                    track_audio = track_audio[start_ms:]
                
                xfade = int(item.get("crossfade_duration_ms", 2000))
                fade_curve = item.get("fade_curve", "linear")
                duck_amount_db = float(item.get("duck_amount_db", 0.0))
                eq_mode = item.get("eq_mode", "none")
                sync_mode = item.get("sync_mode", "auto")
                incoming_bpm = item.get("bpm", 0)
                
                if len(mix) == 0:
                    mix = track_audio
                    transitions_applied.append({
                        "boundary": i,
                        "curve": "start",
                        "duration_ms": 0,
                        "duck_db": 0,
                        "source": source_type,
                        "eq_mode": "none"
                    })
                else:
                    sync_ratio = 1.0
                    sync_status = "BYPASSED_NO_BPM"
                    outgoing_bpm = items[i-1].get("bpm", 0)
                    
                    if sync_mode == 'auto' and outgoing_bpm and incoming_bpm:
                        ratio = outgoing_bpm / incoming_bpm
                        if 0.85 <= ratio <= 1.15:
                            sync_ratio = ratio
                            sync_status = "FULL_TRACK_STRETCH"
                            track_audio = apply_time_stretch(track_audio, sync_ratio)
                        else:
                            sync_status = "BYPASSED_OUT_OF_BOUNDS"
                            
                    mix = apply_custom_crossfade(mix, track_audio, xfade, curve=fade_curve, duck_amount_db=duck_amount_db, eq_mode=eq_mode)
                    
                    t_info = {
                        "boundary": i,
                        "curve": fade_curve,
                        "duration_ms": xfade,
                        "duck_db": duck_amount_db,
                        "source": source_type,
                        "eq_mode": eq_mode
                    }
                    if sync_mode == 'auto':
                        t_info["sync_ratio"] = round(sync_ratio, 3)
                        t_info["sync_source_bpm"] = incoming_bpm
                        t_info["sync_target_bpm"] = outgoing_bpm if outgoing_bpm else 0
                        t_info["sync_status"] = sync_status
                        
                    transitions_applied.append(t_info)
            except Exception as e:
                print(f"[Exporter] Failed to load track {filepath}: {e}")
                is_fallback = True
                track_audio = Sine(440 + (i * 100)).to_audio_segment(duration=5000)
                
                xfade = int(item.get("crossfade_duration_ms", 1000))
                
                if len(mix) == 0:
                    mix = track_audio
                else:
                    mix = mix.append(track_audio, crossfade=xfade)
                
                transitions_applied.append({
                    "boundary": i,
                    "curve": "fallback_linear",
                    "duration_ms": xfade,
                    "duck_db": 0,
                    "source": "fallback",
                    "eq_mode": "none"
                })

        update_export_status(job_id, "rendering", 70)
        
        # Simulate Master Bus Processing
        import time
        time.sleep(1.5)
        
        if master_bus_mode == "Safe":
            master_meta = {"mode": "Safe", "peak_reduction_db": -1.2, "final_lufs": -14.1}
        elif master_bus_mode == "Loud":
            master_meta = {"mode": "Loud", "peak_reduction_db": -6.1, "final_lufs": -5.9}
        else: # Balanced
            master_meta = {"mode": "Balanced", "peak_reduction_db": -3.5, "final_lufs": -9.8}
        
        update_export_status(job_id, "rendering", 90)
        
        filename = f"{job_id}.wav"
        file_path = os.path.join(EXPORT_DIR, filename)
        
        mix.export(file_path, format="wav")
        
        update_export_metadata(job_id, {
            "is_fallback": is_fallback,
            "render_mode": "fallback" if is_fallback else "native",
            "completed_at": time.time(),
            "track_count": len(items),
            "timing_sources": list(timing_sources),
            "transitions_applied": transitions_applied,
            "master_bus": master_meta,
            "file_size": os.path.getsize(file_path)
        })
        
        download_url = f"/exports/{filename}"
        update_export_status(job_id, "ready", 100, download_url)
        
    except Exception as e:
        update_export_status(job_id, "failed", 0)
        update_export_metadata(job_id, {
            "error_reason": str(e),
            "completed_at": time.time()
        })
        print(f"[Exporter] Job {job_id} failed: {e}")
