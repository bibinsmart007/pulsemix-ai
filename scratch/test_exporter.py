import os
import sqlite3
import json
from backend.exporter import process_export_job
from backend.database import DB_PATH, ANALYSIS_VERSION

def test_export():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Create a dummy playlist and add test_local_url twice to crossfade it!
    cursor.execute("INSERT INTO playlists (name) VALUES ('Test Playlist Stem')")
    playlist_id = cursor.lastrowid
    
    url = "test_local_url"
    
    cursor.execute("""
        INSERT INTO playlist_items 
        (playlist_id, youtube_url, position_index, crossfade_duration_ms, fade_curve, eq_mode, is_snapped)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (playlist_id, url, 0, 0, "linear", "none", True))
    
    cursor.execute("""
        INSERT INTO playlist_items 
        (playlist_id, youtube_url, position_index, crossfade_duration_ms, fade_curve, eq_mode, is_snapped, trim_start_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (playlist_id, url, 1, 2000, "linear", "bass_swap", True, 2000))
    
    conn.commit()
    conn.close()
    
    print("Running export job...")
    job_id = "test_job_1"
    
    try:
        process_export_job(job_id, playlist_id, "Test Playlist Stem")
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_export()
