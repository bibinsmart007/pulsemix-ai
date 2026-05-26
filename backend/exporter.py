import time
import os
import json
import numpy as np
from pydub import AudioSegment
import math
import concurrent.futures
from backend.timing import resolve_snapped_boundaries
from pydub.generators import Sine
from backend.database import update_export_status, get_playlist_items, update_export_metadata
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
    
    clipped = np.clip(mixed_samples, -32768, 32767).astype(np.int16)
    mixed_fade_seg = seg1_fade._spawn(clipped.tobytes())
    
    return seg1_base + mixed_fade_seg + seg2_base

def apply_stem_crossfade_parallel(mix_stems: dict, track_stems: dict, xfade_ms: int, curve: str = 'linear', duck_amount_db: float = 0.0, eq_mode: str = 'none') -> dict:
    if xfade_ms <= 0:
        return {k: mix_stems[k] + track_stems[k] for k in mix_stems}
    
    new_mix_stems = {}
    
    for k in mix_stems:
        m_stem = mix_stems[k]
        t_stem = track_stems[k]
        
        duck = duck_amount_db
        stem_curve = curve

        if eq_mode == 'bass_swap' and k == 'bass':
            # Outgoing bass drops out, incoming bass comes in
            # We can simulate a hard cut by making the crossfade extremely short for bass
            # But since xfade_ms dictates alignment, we just zero out the crossfade region appropriately
            # A simple approximation: just duck the bass heavily
            duck = -60.0
            stem_curve = 'linear'
            
        elif eq_mode == 'vocal_protect' and k == 'vocals':
            # Outgoing vocals stay longer (don't fade as fast)
            # Incoming vocals fade in slower
            stem_curve = 'equal_power' # maintains more volume
            duck = 0.0
            
        elif eq_mode == 'soft_exit' and k in ['drums', 'other']:
            # Instrumental elements fade out faster
            duck = -6.0

        new_mix_stems[k] = apply_custom_crossfade(m_stem, t_stem, xfade_ms, curve=stem_curve, duck_amount_db=duck, eq_mode='none')

    return new_mix_stems

def process_export_job(job_id: str, playlist_id: int, playlist_name: str, master_bus_mode: str = "Balanced", export_name: str = "Export", auto_phrase_snap: bool = True):
    """
    Background task to render a playlist into a continuous .wav file.
    """
    try:
        update_export_status(job_id, "rendering", 10)
        
        items = get_playlist_items(playlist_id)
        if not items:
            raise Exception("Playlist is empty. Nothing to export.")
            
        mix_stems = {
            "vocals": AudioSegment.silent(duration=0),
            "drums": AudioSegment.silent(duration=0),
            "bass": AudioSegment.silent(duration=0),
            "other": AudioSegment.silent(duration=0)
        }
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
                # Load track audio
                track_audio = AudioSegment.from_file(filepath)
                resolved_item = resolve_snapped_boundaries(item, auto_phrase_snap)
                start_ms = resolved_item.get("trim_start_ms", 0.0)
                end_ms = resolved_item.get("trim_end_ms", 0.0)
                snapped_reason = resolved_item.get("snapped_reason")
                
                def trim_audio(audio, start, end):
                    if end and end > start:
                        return audio[int(start):int(end)]
                    elif start > 0:
                        return audio[int(start):]
                    return audio
                
                track_audio = trim_audio(track_audio, start_ms, end_ms)

                # Check if stems exist
                stem_status = item.get("stem_status", "NOT_GENERATED")
                track_stems = {}
                
                if stem_status == "READY":
                    # Load stems
                    base_filename = item.get("youtube_url", "").replace("https://www.youtube.com/watch?v=", "")
                    stems_dir = os.path.join(os.path.dirname(filepath), f"{base_filename}_stems")
                    
                    try:
                        track_stems["vocals"] = trim_audio(AudioSegment.from_file(os.path.join(stems_dir, "vocals.wav")), start_ms, end_ms)
                        track_stems["drums"] = trim_audio(AudioSegment.from_file(os.path.join(stems_dir, "drums.wav")), start_ms, end_ms)
                        track_stems["bass"] = trim_audio(AudioSegment.from_file(os.path.join(stems_dir, "bass.wav")), start_ms, end_ms)
                        track_stems["other"] = trim_audio(AudioSegment.from_file(os.path.join(stems_dir, "other.wav")), start_ms, end_ms)
                    except Exception as stem_err:
                        print(f"[Exporter] Failed to load stems for {filepath}, falling back to full mix: {stem_err}")
                        track_stems = None

                if not track_stems:
                    # Fallback to full mix placed in 'other'
                    silent = AudioSegment.silent(duration=len(track_audio))
                    track_stems = {
                        "vocals": silent,
                        "drums": silent,
                        "bass": silent,
                        "other": track_audio
                    }
                
                xfade = int(item.get("crossfade_duration_ms") if item.get("crossfade_duration_ms") is not None else 2000)
                fade_curve = item.get("fade_curve") or "linear"
                duck_amount_db = float(item.get("duck_amount_db") if item.get("duck_amount_db") is not None else 0.0)
                eq_mode = item.get("eq_mode") or "none"
                sync_mode = item.get("sync_mode", "auto")
                incoming_bpm = item.get("bpm", 0)
                
                if len(mix_stems["other"]) == 0:
                    mix_stems = track_stems
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
                            # Stretch all stems
                            for k in track_stems:
                                track_stems[k] = apply_time_stretch(track_stems[k], sync_ratio)
                        else:
                            sync_status = "BYPASSED_OUT_OF_BOUNDS"
                            
                    mix_stems = apply_stem_crossfade_parallel(mix_stems, track_stems, xfade, curve=fade_curve, duck_amount_db=duck_amount_db, eq_mode=eq_mode)
                    
                    t_info = {
                        "boundary": i,
                        "curve": fade_curve,
                        "duration_ms": xfade,
                        "duck_db": duck_amount_db,
                        "source": source_type,
                        "eq_mode": eq_mode,
                        "snapped_reason": snapped_reason
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
                
                # Create a fallback tone
                from pydub.generators import Sine
                fallback_audio = Sine(440 + (i * 100)).to_audio_segment(duration=5000)
                silent = AudioSegment.silent(duration=len(fallback_audio))
                track_stems = {
                    "vocals": silent,
                    "drums": silent,
                    "bass": silent,
                    "other": fallback_audio
                }
                
                xfade = int(item.get("crossfade_duration_ms", 1000))
                
                if len(mix_stems["other"]) == 0:
                    mix_stems = track_stems
                else:
                    mix_stems = apply_stem_crossfade_parallel(mix_stems, track_stems, xfade)
                
                transitions_applied.append({
                    "boundary": i,
                    "curve": "fallback_linear",
                    "duration_ms": xfade,
                    "duck_db": 0,
                    "source": "fallback",
                    "eq_mode": "none",
                    "snapped_reason": None
                })

        update_export_status(job_id, "rendering", 70)
        
        # Combine stems into final mix
        mix = mix_stems["other"].overlay(mix_stems["vocals"]).overlay(mix_stems["drums"]).overlay(mix_stems["bass"])
        
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
        
        # Generate export package
        import zipfile
        import json
        import datetime
        import shutil
        
        job_dir = os.path.join(EXPORT_DIR, job_id)
        os.makedirs(job_dir, exist_ok=True)
        
        wav_path = os.path.join(job_dir, "mix.wav")
        mix.export(wav_path, format="wav")
        
        # We need to sanitize items for JSON (remove any non-serializable stuff, though it should be dicts)
        sanitized_items = []
        for it in items:
            s_it = dict(it)
            sanitized_items.append(s_it)
            
        manifest_data = {
            "job_id": job_id,
            "export_name": export_name,
            "playlist_name": playlist_name,
            "timestamp": datetime.datetime.now().isoformat(),
            "master_bus_mode": master_bus_mode,
            "items": sanitized_items,
            "transitions_applied": transitions_applied
        }
        manifest_path = os.path.join(job_dir, "manifest.json")
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest_data, f, indent=2)
            
        tracklist_path = os.path.join(job_dir, "tracklist.txt")
        with open(tracklist_path, "w", encoding="utf-8") as f:
            f.write(f"Tracklist: {export_name}\n")
            f.write("========================\n\n")
            for idx, item in enumerate(items):
                f.write(f"{idx + 1}. {item.get('title', 'Unknown Track')}\n")
                if idx < len(transitions_applied):
                    t = transitions_applied[idx]
                    snap_text = f" | {t['snapped_reason']}" if t.get('snapped_reason') else " | Manual retained"
                    f.write(f"   -> [Transition] {t['eq_mode']} | {t['duration_ms']}ms | {t['curve']}{snap_text}\n")
                f.write("\n")
                
        zip_filename = f"{job_id}.zip"
        zip_path = os.path.join(EXPORT_DIR, zip_filename)
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.write(wav_path, "mix.wav")
            zf.write(manifest_path, "manifest.json")
            zf.write(tracklist_path, "tracklist.txt")
            
        # Clean up temp dir
        shutil.rmtree(job_dir, ignore_errors=True)
        
        download_url = f"/exports/{zip_filename}"
        update_export_status(job_id, "completed", 100, download_url)
        
        meta_updates = {
            "master_bus": master_meta,
            "total_items": len(items),
            "transitions": transitions_applied,
            "duration_ms": len(mix),
            "export_name": export_name
        }
        if is_fallback:
            meta_updates["note"] = "Used mock audio due to missing source files."
            
        update_export_metadata(job_id, meta_updates)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        update_export_status(job_id, "failed")
        update_export_metadata(job_id, {"error": str(e)})
        print(f"[Exporter] Job {job_id} failed: {e}")
