import asyncio
import sqlite3
from backend.stem_extractor import run_stem_extraction
from backend.database import DB_PATH, ANALYSIS_VERSION

async def test():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Insert a dummy track pointing to test.wav
    url = "test_local_url"
    cursor.execute("INSERT OR REPLACE INTO tracks (youtube_url, filepath, analysis_version) VALUES (?, ?, ?)", (url, "C:/Users/user/ANTIGRAVITY1/test.wav", ANALYSIS_VERSION))
    conn.commit()
    
    print(f"Extracting stems for {url}...")
    await run_stem_extraction(url)
    
    # Check if stems exist
    cursor.execute("SELECT stem_status, vocals_path, bass_path FROM tracks WHERE youtube_url = ?", (url,))
    res = cursor.fetchone()
    print(f"Result: {res}")

if __name__ == "__main__":
    asyncio.run(test())
