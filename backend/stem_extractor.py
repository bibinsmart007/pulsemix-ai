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

        # Simulate heavy ML processing delay (e.g., 5-8 seconds for a mock)
        await asyncio.sleep(random.uniform(5.0, 8.0))

        # 90% chance of success, 10% chance of failure for realistic UX
        if random.random() < 0.1:
            raise Exception("Mock Demucs separation failed (simulated error)")

        # Mocked paths
        base_filename = youtube_url.replace("https://www.youtube.com/watch?v=", "")
        vocals_path = f"{base_filename}_stems/vocals.mp3"
        drums_path = f"{base_filename}_stems/drums.mp3"
        bass_path = f"{base_filename}_stems/bass.mp3"
        other_path = f"{base_filename}_stems/other.mp3"

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
        logger.error(f"Stem extraction failed for {youtube_url}: {e}")
        cursor.execute(
            "UPDATE tracks SET stem_status = 'FAILED' WHERE youtube_url = ? AND analysis_version = ?",
            (youtube_url, ANALYSIS_VERSION)
        )
        conn.commit()
    finally:
        conn.close()
