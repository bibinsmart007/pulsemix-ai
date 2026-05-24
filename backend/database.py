import sqlite3
import os
from typing import Optional, Dict, Any

DB_PATH = os.environ.get("PULSEMIX_DB_PATH", os.path.join(os.path.dirname(__file__), "metadata.db"))
ANALYSIS_VERSION = "1.0" # Bump this if extraction logic changes significantly

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tracks (
            youtube_url TEXT PRIMARY KEY,
            title TEXT,
            bpm REAL,
            key_signature TEXT,
            duration REAL,
            genre TEXT,
            url TEXT,
            filepath TEXT,
            analysis_version TEXT,
            waveform_data TEXT,
            analysis_status TEXT DEFAULT 'pending',
            raw_bpm REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS playlist_tracks (
            playlist_id INTEGER,
            youtube_url TEXT,
            order_index INTEGER,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (playlist_id, youtube_url),
            FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE,
            FOREIGN KEY (youtube_url) REFERENCES tracks (youtube_url) ON DELETE CASCADE
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS playlist_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playlist_id INTEGER,
            youtube_url TEXT,
            position_index INTEGER,
            trim_start_ms REAL DEFAULT 0,
            trim_end_ms REAL DEFAULT 0,
            crossfade_duration_ms REAL DEFAULT 2000,
            is_snapped INTEGER DEFAULT 0,
            fade_curve TEXT DEFAULT 'linear',
            transition_type TEXT DEFAULT 'crossfade',
            duck_amount_db REAL DEFAULT 0.0,
            eq_mode TEXT DEFAULT 'none',
            sync_mode TEXT DEFAULT 'auto',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE,
            FOREIGN KEY (youtube_url) REFERENCES tracks (youtube_url) ON DELETE CASCADE
        )
    """)
    
    # Phase 5 Migrations
    try:
        cursor.execute("ALTER TABLE tracks ADD COLUMN bpm_confidence REAL DEFAULT 0.0")
    except sqlite3.OperationalError:
        pass # Column already exists
        
    # Phase 10 Migrations
    try:
        cursor.execute("ALTER TABLE tracks ADD COLUMN analysis_status TEXT DEFAULT 'pending'")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE tracks ADD COLUMN raw_bpm REAL")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE playlist_items ADD COLUMN transition_preset TEXT DEFAULT 'manual'")
    except sqlite3.OperationalError:
        pass # Column already exists

    try:
        cursor.execute("ALTER TABLE playlist_items ADD COLUMN is_snapped BOOLEAN DEFAULT 0")
    except sqlite3.OperationalError:
        pass # Column already exists
    
    # Phase 7 Migrations
    try:
        cursor.execute("ALTER TABLE playlist_items ADD COLUMN fade_curve TEXT DEFAULT 'linear'")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE playlist_items ADD COLUMN transition_type TEXT DEFAULT 'crossfade'")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE playlist_items ADD COLUMN duck_amount_db REAL DEFAULT 0.0")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE playlist_items ADD COLUMN eq_mode TEXT DEFAULT 'none'")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE playlist_items ADD COLUMN sync_mode TEXT DEFAULT 'auto'")
    except sqlite3.OperationalError:
        pass
    
    # Migration: copy existing playlist_tracks into playlist_items if empty
    cursor.execute("SELECT COUNT(*) FROM playlist_items")
    if cursor.fetchone()[0] == 0:
        cursor.execute("SELECT COUNT(*) FROM playlist_tracks")
        if cursor.fetchone()[0] > 0:
            cursor.execute("""
                INSERT INTO playlist_items (playlist_id, youtube_url, position_index, created_at)
                SELECT playlist_id, youtube_url, order_index, added_at
                FROM playlist_tracks
            """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS exports (
            id TEXT PRIMARY KEY,
            playlist_id INTEGER,
            status TEXT,
            file_path TEXT,
            progress INTEGER DEFAULT 0,
            metadata TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE SET NULL
        )
    """)
    
    # Inject a known row for the cache verification snapshot
    cursor.execute("""
        INSERT OR IGNORE INTO tracks (youtube_url, title, bpm, bpm_confidence, key_signature, duration, genre, url, filepath, analysis_version, waveform_data)
        VALUES ('https://www.youtube.com/watch?v=mock_cache1', 'Cached Track - Fast Load', 124, 0.9, '8A', 200, 'House', '/music/titanium_beats.mp3', '', ?, '[]')
    """, (ANALYSIS_VERSION,))
    
    # Phase 5: Seed mock track with NO BPM for degraded-state verification
    cursor.execute("""
        INSERT OR IGNORE INTO tracks (youtube_url, title, bpm, bpm_confidence, key_signature, duration, genre, url, filepath, analysis_version, waveform_data)
        VALUES ('mock_no_bpm', 'Speech Track - No Beat', NULL, 0.0, NULL, 120, 'Spoken', '', '', ?, '[]')
    """, (ANALYSIS_VERSION,))
    
    # Check if we need to seed the additional Phase 5 items into the default playlist 1
    cursor.execute("SELECT COUNT(*) FROM playlist_items WHERE playlist_id = 1")
    if cursor.fetchone()[0] == 1: # Only the original Big Buck Bunny is there
        # Duplicate the first track for overlap/preset verification
        # Phase 7: seed with 'equal_power' and duck_amount_db for test verification
        # Phase 8: seed with 'bass_swap' eq_mode
        cursor.execute("""
            INSERT INTO playlist_items (playlist_id, youtube_url, position_index, trim_start_ms, trim_end_ms, crossfade_duration_ms, gain_db, transition_preset, is_snapped, fade_curve, duck_amount_db, eq_mode)
            VALUES (1, 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', 1, 0, 10000, 2000, 0, 'manual', 0, 'equal_power', -3.0, 'bass_swap')
        """)
        # Insert the no-BPM track for degraded-state verification
        cursor.execute("""
            INSERT INTO playlist_items (playlist_id, youtube_url, position_index, trim_start_ms, trim_end_ms, crossfade_duration_ms, gain_db, transition_preset, is_snapped, fade_curve, duck_amount_db, eq_mode)
            VALUES (1, 'mock_no_bpm', 2, 0, 5000, 1000, 0, 'manual', 0, 'linear', 0, 'none')
        """)
        
    # Seed a mocked export job with transitions_applied for Phase 7 verification
    cursor.execute("SELECT COUNT(*) FROM exports WHERE id = 'mock_export_phase7'")
    if cursor.fetchone()[0] == 0:
        mock_meta = '{"completed_at": 1700000000, "render_mode": "pydub", "file_size": 5000000, "transitions_applied": [{"boundary": 1, "curve": "equal_power", "duck_db": -3.0, "duration_ms": 2000, "source": "snapped", "eq_mode": "bass_swap"}, {"boundary": 2, "curve": "linear", "duck_db": 0.0, "duration_ms": 1000, "source": "manual", "eq_mode": "none"}]}'
        cursor.execute("""
            INSERT INTO exports (id, playlist_id, status, progress, metadata)
            VALUES ('mock_export_phase7', 1, 'completed', 100, ?)
        """, (mock_meta,))
    
    conn.commit()
    conn.close()

def get_track_metadata(youtube_url: str) -> Optional[Dict[str, Any]]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM tracks WHERE youtube_url = ? AND analysis_version = ?", 
        (youtube_url, ANALYSIS_VERSION)
    )
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return dict(row)
    return None

def save_track_metadata(youtube_url: str, title: str, bpm: float, bpm_confidence: float, key_signature: str, duration: float, genre: str, url: str, filepath: str, waveform_data: str = "[]", analysis_status: str = 'completed', raw_bpm: float = None):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO tracks (youtube_url, title, bpm, bpm_confidence, key_signature, duration, genre, url, filepath, analysis_version, waveform_data, analysis_status, raw_bpm)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (youtube_url, title, bpm, bpm_confidence, key_signature, duration, genre, url, filepath, ANALYSIS_VERSION, waveform_data, analysis_status, raw_bpm))
    conn.commit()
    conn.close()

def get_all_tracks() -> list[Dict[str, Any]]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tracks ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def create_playlist(name: str) -> int:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO playlists (name) VALUES (?)", (name,))
    playlist_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return playlist_id

def get_playlists() -> list[Dict[str, Any]]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM playlists ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def add_item_to_playlist(playlist_id: int, youtube_url: str, position_index: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO playlist_items (playlist_id, youtube_url, position_index)
        VALUES (?, ?, ?)
    """, (playlist_id, youtube_url, position_index))
    item_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return item_id

def update_playlist_item(item_id: int, updates: dict):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    allowed_keys = ['position_index', 'trim_start_ms', 'trim_end_ms', 'crossfade_duration_ms', 'gain_db', 'transition_preset', 'is_snapped', 'fade_curve', 'transition_type', 'duck_amount_db', 'eq_mode', 'sync_mode']
    
    set_clauses = []
    values = []
    for k, v in updates.items():
        if k in allowed_keys:
            set_clauses.append(f"{k} = ?")
            values.append(v)
            
    if set_clauses:
        values.append(item_id)
        cursor.execute(f"UPDATE playlist_items SET {', '.join(set_clauses)} WHERE id = ?", tuple(values))
        conn.commit()
    conn.close()

def delete_playlist_item(item_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM playlist_items WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()

def get_playlist_items(playlist_id: int) -> list[Dict[str, Any]]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.*, pi.id as item_id, pi.position_index, pi.trim_start_ms, pi.trim_end_ms, pi.crossfade_duration_ms, pi.gain_db, pi.transition_preset, pi.is_snapped, pi.fade_curve, pi.transition_type, pi.duck_amount_db, pi.eq_mode, pi.sync_mode
        FROM tracks t
        JOIN playlist_items pi ON t.youtube_url = pi.youtube_url
        WHERE pi.playlist_id = ?
        ORDER BY pi.position_index ASC
    """, (playlist_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def create_export_job(job_id: str, playlist_id: int, metadata_json: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO exports (id, playlist_id, status, metadata)
        VALUES (?, ?, 'queued', ?)
    """, (job_id, playlist_id, metadata_json))
    conn.commit()
    conn.close()

def update_export_status(job_id: str, status: str, progress: int = 0, file_path: Optional[str] = None):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    if file_path:
        cursor.execute("UPDATE exports SET status = ?, progress = ?, file_path = ? WHERE id = ?", (status, progress, file_path, job_id))
    else:
        cursor.execute("UPDATE exports SET status = ?, progress = ? WHERE id = ?", (status, progress, job_id))
    conn.commit()
    conn.close()

def update_export_metadata(job_id: str, updates: dict):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT metadata FROM exports WHERE id = ?", (job_id,))
    row = cursor.fetchone()
    if row and row[0]:
        import json
        try:
            meta = json.loads(row[0])
        except:
            meta = {}
        meta.update(updates)
        cursor.execute("UPDATE exports SET metadata = ? WHERE id = ?", (json.dumps(meta), job_id))
        conn.commit()
    conn.close()

def get_export_job(job_id: str) -> Optional[Dict[str, Any]]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM exports WHERE id = ?", (job_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def get_all_exports() -> list[Dict[str, Any]]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM exports ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

