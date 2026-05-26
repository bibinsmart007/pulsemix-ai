import asyncio
import sqlite3
import random
import logging
from backend.database import DB_PATH, ANALYSIS_VERSION

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def run_stem_extraction(youtube_url: str):
    """
    Mocked slow/high-quality async pipeline simulating Demucs separation.
    Updates the database with stem status and paths upon completion.
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Mark as extracting
        cursor.execute(
            "UPDATE tracks SET stem_status = 'EXTRACTING' WHERE youtube_url = ? AND analysis_version = ?",
            (youtube_url, ANALYSIS_VERSION)
        )
        conn.commit()

        import os
        from pydub import AudioSegment
        from scipy import signal
        import numpy as np
        import array

        # Lookup file path
        cursor.execute("SELECT filepath FROM tracks WHERE youtube_url = ? AND analysis_version = ?", (youtube_url, ANALYSIS_VERSION))
        row = cursor.fetchone()
        if not row or not row[0]:
            raise Exception("Source audio file not found for extraction.")
        
        source_filepath = row[0]
        if not os.path.exists(source_filepath):
            raise Exception(f"Source file missing on disk: {source_filepath}")

        # Simulate heavy ML processing delay
        await asyncio.sleep(random.uniform(2.0, 4.0))

        if random.random() < 0.05:
            raise Exception("Mock Demucs separation failed (simulated error)")

        # Generate actual mock stems using SciPy filters
        seg = AudioSegment.from_file(source_filepath)
        samples = np.array(seg.get_array_of_samples(), dtype=np.float32)
        sr = seg.frame_rate
        channels = seg.channels
        
        if channels == 2:
            s = samples.reshape(-1, 2)
        else:
            s = samples.reshape(-1, 1)

        def apply_scipy_filter(data, btype, freqs):
            processed = np.zeros_like(data)
            wn = np.array(freqs) / (sr / 2)
            if len(freqs) == 1:
                wn = wn[0]
            b, a = signal.butter(4, wn, btype=btype)
            for c in range(data.shape[1]):
                processed[:, c] = signal.lfilter(b, a, data[:, c])
            return processed

        # Bass: Lowpass 250Hz
        bass_data = apply_scipy_filter(s, 'low', [250])
        # Vocals: Bandpass 300Hz - 3000Hz (approximation)
        vocals_data = apply_scipy_filter(s, 'bandpass', [300, 3000])
        # Drums: Highpass 250Hz, then subtract vocals? Let's just highpass 6000Hz + transients? Or just a simple highpass
        drums_data = apply_scipy_filter(s, 'high', [5000]) # just sizzle/cymbals for mock
        # Other: Bandstop 300-3000Hz, Highpass 250Hz
        other_data = apply_scipy_filter(s, 'high', [250])
        other_data = apply_scipy_filter(other_data, 'bandstop', [300, 3000])

        def to_audio_segment(data, original_seg):
            clipped = np.clip(data.flatten(), -32768, 32767).astype(np.int16)
            return original_seg._spawn(clipped.tobytes())

        bass_seg = to_audio_segment(bass_data, seg)
        vocals_seg = to_audio_segment(vocals_data, seg)
        drums_seg = to_audio_segment(drums_data, seg)
        other_seg = to_audio_segment(other_data, seg)

        base_filename = youtube_url.replace("https://www.youtube.com/watch?v=", "")
        stems_dir = os.path.join(os.path.dirname(source_filepath), f"{base_filename}_stems")
        os.makedirs(stems_dir, exist_ok=True)

        vocals_path = os.path.join(stems_dir, "vocals.wav").replace("\\", "/")
        drums_path = os.path.join(stems_dir, "drums.wav").replace("\\", "/")
        bass_path = os.path.join(stems_dir, "bass.wav").replace("\\", "/")
        other_path = os.path.join(stems_dir, "other.wav").replace("\\", "/")

        vocals_seg.export(vocals_path, format="wav")
        drums_seg.export(drums_path, format="wav")
        bass_seg.export(bass_path, format="wav")
        other_seg.export(other_path, format="wav")

        # Mark as ready
        cursor.execute(
            """
            UPDATE tracks 
            SET stem_status = 'READY',
                vocals_path = ?,
                drums_path = ?,
                bass_path = ?,
                other_path = ?
            WHERE youtube_url = ? AND analysis_version = ?
            """,
            (vocals_path, drums_path, bass_path, other_path, youtube_url, ANALYSIS_VERSION)
        )
        conn.commit()
        logger.info(f"Successfully generated mock stems for {youtube_url}")

    except Exception as e:
        logger.exception(f"Stem extraction failed for {youtube_url}: {e}")
        cursor.execute(
            "UPDATE tracks SET stem_status = 'FAILED' WHERE youtube_url = ? AND analysis_version = ?",
            (youtube_url, ANALYSIS_VERSION)
        )
        conn.commit()
    finally:
        conn.close()
