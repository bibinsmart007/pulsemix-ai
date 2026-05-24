import sqlite3
import os
from typing import Optional, Dict, Any

DB_PATH = os.environ.get("PULSEMIX_DB_PATH", os.path.join(os.path.dirname(__file__), "metadata.db"))

def get_db_connection():
    return sqlite3.connect(DB_PATH)

ANALYSIS_VERSION = "1.0" # Bump this if extraction logic changes significantly

def init_db():
    conn = get_db_connection()
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
            stem_status TEXT DEFAULT 'NOT_GENERATED',
            vocals_path TEXT,
            drums_path TEXT,
            bass_path TEXT,
            other_path TEXT,
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
        
    # Phase 13 Migrations
    try:
        cursor.execute("ALTER TABLE tracks ADD COLUMN stem_status TEXT DEFAULT 'NOT_GENERATED'")
        cursor.execute("ALTER TABLE tracks ADD COLUMN vocals_path TEXT")
        cursor.execute("ALTER TABLE tracks ADD COLUMN drums_path TEXT")
        cursor.execute("ALTER TABLE tracks ADD COLUMN bass_path TEXT")
        cursor.execute("ALTER TABLE tracks ADD COLUMN other_path TEXT")
    except sqlite3.OperationalError:
        pass

    # Seed initial data
    
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
    
    # Phase 18 Migrations
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cloud_projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            share_token TEXT UNIQUE NOT NULL,
            created_at REAL NOT NULL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cloud_project_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            version_number INTEGER NOT NULL,
            payload_json TEXT NOT NULL,
            created_at REAL NOT NULL,
            FOREIGN KEY(project_id) REFERENCES cloud_projects(id)
        )
    """)
    
    # Phase 19 Migrations
    try:
        cursor.execute("ALTER TABLE cloud_project_versions ADD COLUMN review_status TEXT DEFAULT 'needs_review'")
    except sqlite3.OperationalError:
        pass
        
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS project_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version_id INTEGER NOT NULL,
            target_type TEXT NOT NULL,
            target_id TEXT,
            timestamp_ms REAL,
            boundary_index INTEGER,
            content TEXT NOT NULL,
            is_resolved INTEGER DEFAULT 0,
            carried_forward_from INTEGER,
            created_at REAL NOT NULL,
            FOREIGN KEY(version_id) REFERENCES cloud_project_versions(id)
        )
    """)
    # Phase 20/21 Migrations
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS published_packages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version_id INTEGER NOT NULL,
            publish_token TEXT NOT NULL UNIQUE,
            package_type TEXT NOT NULL,
            notes TEXT,
            allow_download INTEGER DEFAULT 0,
            expires_at REAL,
            is_revoked INTEGER DEFAULT 0,
            password_hash TEXT,
            recipient_label TEXT,
            created_at REAL NOT NULL,
            FOREIGN KEY(version_id) REFERENCES cloud_project_versions(id)
        )
    """)
    
    # Check if Phase 21 columns exist (since the table was created in Phase 20)
    cursor.execute("PRAGMA table_info(published_packages)")
    columns = [col[1] for col in cursor.fetchall()]
    if "allow_download" not in columns:
        cursor.execute("ALTER TABLE published_packages ADD COLUMN allow_download INTEGER DEFAULT 0")
        cursor.execute("ALTER TABLE published_packages ADD COLUMN expires_at REAL")
        cursor.execute("ALTER TABLE published_packages ADD COLUMN is_revoked INTEGER DEFAULT 0")
        cursor.execute("ALTER TABLE published_packages ADD COLUMN password_hash TEXT")
        cursor.execute("ALTER TABLE published_packages ADD COLUMN recipient_label TEXT")
        
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS published_package_access_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            package_id INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            timestamp REAL NOT NULL,
            FOREIGN KEY(package_id) REFERENCES published_packages(id)
        )
    """)
    
    # Phase 23 Migrations
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS activity_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            version_id INTEGER,
            event_type TEXT NOT NULL,
            actor TEXT,
            target_id INTEGER,
            metadata_json TEXT,
            importance TEXT DEFAULT 'normal',
            created_at REAL NOT NULL,
            FOREIGN KEY(project_id) REFERENCES cloud_projects(id) ON DELETE CASCADE,
            FOREIGN KEY(version_id) REFERENCES cloud_project_versions(id) ON DELETE CASCADE
        )
    """)
    
    # Phase 24 Migrations
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS review_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            comment_id INTEGER,
            project_id INTEGER NOT NULL,
            version_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            assignee_type TEXT,
            assignee_id INTEGER,
            assignee_label TEXT,
            status TEXT DEFAULT 'open',
            priority TEXT DEFAULT 'normal',
            due_at REAL,
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL,
            completed_at REAL,
            FOREIGN KEY(comment_id) REFERENCES project_comments(id) ON DELETE SET NULL,
            FOREIGN KEY(project_id) REFERENCES cloud_projects(id) ON DELETE CASCADE,
            FOREIGN KEY(version_id) REFERENCES cloud_project_versions(id) ON DELETE CASCADE
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
            VALUES (1, 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', 1, 0, 10000, 2000, 0, 'manual', 0, 'equal_power', -3.0, 'vocal_hold')
        """)
        # Insert the no-BPM track for degraded-state verification
        cursor.execute("""
            INSERT INTO playlist_items (playlist_id, youtube_url, position_index, trim_start_ms, trim_end_ms, crossfade_duration_ms, gain_db, transition_preset, is_snapped, fade_curve, duck_amount_db, eq_mode)
            VALUES (1, 'mock_no_bpm', 2, 0, 5000, 1000, 0, 'manual', 0, 'linear', 0, 'none')
        """)
        
    # Seed a mocked export job with transitions_applied for Phase 7 verification
    cursor.execute("SELECT COUNT(*) FROM exports WHERE id = 'mock_export_phase7'")
    if cursor.fetchone()[0] == 0:
        mock_meta = '{"completed_at": 1700000000, "render_mode": "pydub", "file_size": 5000000, "transitions_applied": [{"boundary": 1, "curve": "equal_power", "duck_db": -3.0, "duration_ms": 2000, "source": "snapped", "eq_mode": "vocal_hold"}, {"boundary": 2, "curve": "linear", "duck_db": 0.0, "duration_ms": 1000, "source": "manual", "eq_mode": "none"}]}'
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
    conn.commit()
    return item_id

def log_activity_event(project_id: int, event_type: str, actor: str = "System", version_id: Optional[int] = None, target_id: Optional[int] = None, metadata: Optional[Dict[str, Any]] = None, importance: str = "normal"):
    import time
    import json
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO activity_events (project_id, version_id, event_type, actor, target_id, metadata_json, importance, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        project_id, 
        version_id, 
        event_type, 
        actor, 
        target_id, 
        json.dumps(metadata) if metadata else None,
        importance,
        time.time()
    ))
    conn.commit()
    conn.close()

def get_activity_events(project_id: int) -> list[Dict[str, Any]]:
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM activity_events 
        WHERE project_id = ? 
        ORDER BY created_at DESC
    """, (project_id,))
    rows = cursor.fetchall()
    conn.close()
    
    events = []
    for row in rows:
        event = dict(row)
        import json
        if event.get("metadata_json"):
            try:
                event["metadata"] = json.loads(event["metadata_json"])
            except json.JSONDecodeError:
                event["metadata"] = {}
        else:
            event["metadata"] = {}
        events.append(event)
    return events

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

