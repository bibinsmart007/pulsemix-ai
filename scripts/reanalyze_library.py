import os
import sys
import sqlite3

# Add backend directory to sys.path so we can import analyzer
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
from analyzer import analyze_audio
from database import DB_PATH, ANALYSIS_VERSION

def main():
    print(f"Connecting to database at {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get all tracks
    cursor.execute("SELECT * FROM tracks")
    tracks = cursor.fetchall()
    
    print(f"Found {len(tracks)} tracks. Starting re-analysis...")
    
    for row in tracks:
        url = row["youtube_url"]
        title = row["title"]
        filepath = row["filepath"]
        
        # Skip if no filepath exists (e.g. the mock_no_bpm track which isn't a real file)
        if not filepath or not os.path.exists(filepath):
            print(f"Skipping {title} ({url}): File not found at {filepath}")
            # Just mark them as completed if they are the special mock track, or delete them?
            # Actually mock_no_bpm is seeded specially. Let's just update its analysis_status to 'low_confidence'
            if url == 'mock_no_bpm':
                cursor.execute("UPDATE tracks SET analysis_status = 'low_confidence' WHERE youtube_url = ?", (url,))
                conn.commit()
            continue
            
        print(f"\nAnalyzing: {title} ({url})")
        
        try:
            analysis = analyze_audio(filepath)
            bpm = analysis["bpm"]
            raw_bpm = analysis.get("raw_bpm")
            bpm_confidence = analysis.get("bpm_confidence", 0.0)
            key = analysis["key"]
            waveform_data = analysis.get("waveform_data", "[]")
            
            status = "completed"
            if bpm_confidence < 0.3 or not key:
                status = "low_confidence"
                
            cursor.execute("""
                UPDATE tracks 
                SET bpm = ?, raw_bpm = ?, bpm_confidence = ?, key_signature = ?, 
                    waveform_data = ?, analysis_status = ?, analysis_version = ?
                WHERE youtube_url = ?
            """, (bpm, raw_bpm, bpm_confidence, key, waveform_data, status, ANALYSIS_VERSION, url))
            
            conn.commit()
            print(f"✓ Updated {title} -> BPM: {bpm} (raw {raw_bpm}), Key: {key}, Status: {status}")
            
        except Exception as e:
            print(f"✗ Failed to analyze {title}: {e}")
            cursor.execute("UPDATE tracks SET analysis_status = 'failed' WHERE youtube_url = ?", (url,))
            conn.commit()
            
    conn.close()
    print("\nRe-analysis complete.")

if __name__ == "__main__":
    main()
