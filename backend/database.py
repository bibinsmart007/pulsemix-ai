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
            relink_method TEXT,
            relink_warning TEXT,
            bpm_confidence REAL,
            key_confidence REAL,
            key_camelot TEXT,
            beatgrid TEXT,
            phrase_markers TEXT,
            downbeat_confidence REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Try to add relink columns to existing table
    try:
        cursor.execute("ALTER TABLE tracks ADD COLUMN relink_method TEXT")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE tracks ADD COLUMN relink_warning TEXT")
    except sqlite3.OperationalError:
        pass

    # Try to add phase 53 analysis columns
    try:
        cursor.execute("ALTER TABLE tracks ADD COLUMN bpm_confidence REAL")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE tracks ADD COLUMN key_confidence REAL")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE tracks ADD COLUMN key_camelot TEXT")
    except sqlite3.OperationalError:
        pass
        
    # Try to add phase 54 analysis columns
    try:
        cursor.execute("ALTER TABLE tracks ADD COLUMN beatgrid TEXT")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE tracks ADD COLUMN phrase_markers TEXT")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE tracks ADD COLUMN downbeat_confidence REAL")
    except sqlite3.OperationalError:
        pass

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
            phrase_snap_override TEXT,
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
    
    # Phase 55 migration
    try:
        cursor.execute("ALTER TABLE playlist_items ADD COLUMN phrase_snap_override TEXT")
    except sqlite3.OperationalError:
        pass
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS playlist_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playlist_id INTEGER,
            name TEXT NOT NULL,
            data TEXT NOT NULL,
            source_type TEXT DEFAULT 'manual',
            reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE
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
    
    # Phase 26 Migrations
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS export_jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            version_id INTEGER NOT NULL,
            job_type TEXT NOT NULL,
            format TEXT NOT NULL,
            status TEXT DEFAULT 'queued',
            file_url TEXT,
            artifact_label TEXT,
            error_message TEXT,
            created_at REAL NOT NULL,
            completed_at REAL,
            artifact_id INTEGER,
            FOREIGN KEY(project_id) REFERENCES cloud_projects(id) ON DELETE CASCADE,
            FOREIGN KEY(version_id) REFERENCES cloud_project_versions(id) ON DELETE CASCADE
        )
    """)
    # Try adding artifact_id if missing (for existing Phase 26 db)
    try:
        cursor.execute("ALTER TABLE export_jobs ADD COLUMN artifact_id INTEGER")
    except sqlite3.OperationalError:
        pass

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS package_exports (
            package_id INTEGER NOT NULL,
            export_job_id INTEGER NOT NULL,
            PRIMARY KEY(package_id, export_job_id),
            FOREIGN KEY(package_id) REFERENCES published_packages(id) ON DELETE CASCADE,
            FOREIGN KEY(export_job_id) REFERENCES export_jobs(id) ON DELETE CASCADE
        )
    """)
    
    # Phase 27 Migrations
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS stored_artifacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            version_id INTEGER,
            storage_provider TEXT NOT NULL,
            object_key TEXT NOT NULL,
            mime_type TEXT,
            byte_size INTEGER,
            checksum TEXT,
            storage_class TEXT DEFAULT 'internal',
            retention_policy TEXT DEFAULT 'permanent',
            retention_source TEXT DEFAULT 'class_default',
            access_policy TEXT DEFAULT 'private',
            status TEXT DEFAULT 'active',
            last_verified_at REAL,
            expires_at REAL,
            created_at REAL NOT NULL,
            FOREIGN KEY(project_id) REFERENCES cloud_projects(id) ON DELETE CASCADE,
            FOREIGN KEY(version_id) REFERENCES cloud_project_versions(id) ON DELETE CASCADE
        )
    """)
    try:
        cursor.execute("ALTER TABLE stored_artifacts ADD COLUMN status TEXT DEFAULT 'active'")
        cursor.execute("ALTER TABLE stored_artifacts ADD COLUMN retention_source TEXT DEFAULT 'class_default'")
    except sqlite3.OperationalError:
        pass

    # Phase 28 Migrations
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            actor TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            action_type TEXT NOT NULL,
            severity TEXT DEFAULT 'low',
            before_json TEXT,
            after_json TEXT,
            source_context TEXT,
            timestamp REAL NOT NULL,
            FOREIGN KEY(project_id) REFERENCES cloud_projects(id) ON DELETE CASCADE
        )
    """)

    # Phase 35 Migrations
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ai_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER,
            parent_session_id INTEGER,
            name TEXT,
            summary TEXT,
            prompt TEXT,
            input_tracks_json TEXT,
            variations_json TEXT,
            selected_variation_index INTEGER DEFAULT 0,
            status TEXT DEFAULT 'draft',
            rating TEXT DEFAULT 'unrated',
            applied_at REAL,
            applied_version_id INTEGER,
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL,
            FOREIGN KEY(project_id) REFERENCES cloud_projects(id) ON DELETE SET NULL,
            FOREIGN KEY(applied_version_id) REFERENCES cloud_project_versions(id) ON DELETE SET NULL,
            FOREIGN KEY(parent_session_id) REFERENCES ai_sessions(id) ON DELETE SET NULL
        )
    """)
    try:
        cursor.execute("ALTER TABLE ai_sessions ADD COLUMN parent_session_id INTEGER")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE ai_sessions ADD COLUMN rating TEXT DEFAULT 'unrated'")
    except sqlite3.OperationalError:
        pass


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

def save_track_metadata(youtube_url: str, title: str, bpm: float, bpm_confidence: float, key_signature: str, key_camelot: str, key_confidence: float, duration: float, genre: str, url: str, filepath: str, waveform_data: str = "[]", analysis_status: str = 'completed', raw_bpm: float = None, beatgrid: str = "[]", phrase_markers: str = "[]", downbeat_confidence: float = 0.0):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO tracks (youtube_url, title, bpm, bpm_confidence, key_signature, key_camelot, key_confidence, duration, genre, url, filepath, analysis_version, waveform_data, analysis_status, raw_bpm, beatgrid, phrase_markers, downbeat_confidence)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (youtube_url, title, bpm, bpm_confidence, key_signature, key_camelot, key_confidence, duration, genre, url, filepath, ANALYSIS_VERSION, waveform_data, analysis_status, raw_bpm, beatgrid, phrase_markers, downbeat_confidence))
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

def create_playlist(name: str, conn: Optional[sqlite3.Connection] = None) -> int:
    close_conn = False
    if conn is None:
        conn = sqlite3.connect(DB_PATH)
        close_conn = True
    cursor = conn.cursor()
    cursor.execute("INSERT INTO playlists (name) VALUES (?)", (name,))
    playlist_id = cursor.lastrowid
    if close_conn:
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

def save_snapshot(playlist_id: int, name: str, data: str, source_type: str = 'manual', reason: str = None) -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO playlist_snapshots (playlist_id, name, data, source_type, reason) VALUES (?, ?, ?, ?, ?)",
        (playlist_id, name, data, source_type, reason)
    )
    conn.commit()
    return cursor.lastrowid

def get_snapshots(playlist_id: int):
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT id, playlist_id, name, data, source_type, reason, created_at FROM playlist_snapshots WHERE playlist_id = ? ORDER BY created_at DESC",
        (playlist_id,)
    ).fetchall()
    snapshots = []
    for row in rows:
        snapshots.append({
            "id": row[0],
            "playlist_id": row[1],
            "name": row[2],
            "data": row[3],
            "source_type": row[4],
            "reason": row[5],
            "created_at": row[6]
        })
    return snapshots

def get_snapshot(snapshot_id: int):
    conn = get_db_connection()
    row = conn.execute(
        "SELECT id, playlist_id, name, data, source_type, reason, created_at FROM playlist_snapshots WHERE id = ?",
        (snapshot_id,)
    ).fetchone()
    if not row: return None
    return {
        "id": row[0],
        "playlist_id": row[1],
        "name": row[2],
        "data": row[3],
        "source_type": row[4],
        "reason": row[5],
        "created_at": row[6]
    }

def clear_playlist_items(playlist_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM playlist_items WHERE playlist_id = ?", (playlist_id,))
    conn.commit()
    conn.close()

def add_item_to_playlist(playlist_id: int, youtube_url: str, position_index: int, conn: Optional[sqlite3.Connection] = None):
    close_conn = False
    if conn is None:
        conn = sqlite3.connect(DB_PATH)
        close_conn = True
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO playlist_items (playlist_id, youtube_url, position_index)
        VALUES (?, ?, ?)
    """, (playlist_id, youtube_url, position_index))
    item_id = cursor.lastrowid
    if close_conn:
        conn.commit()
        conn.close()
    return item_id

def log_activity_event(project_id: int, event_type: str, actor: str = "System", version_id: Optional[int] = None, target_id: Optional[int] = None, metadata: Optional[Dict[str, Any]] = None, importance: str = "normal"):
    import time
    import json
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
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
    except Exception as e:
        print(f"Error logging activity: {e}")
    conn.close()

def get_activity_events(project_id, limit=50):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        events = conn.execute("""
            SELECT * FROM activity_events
            WHERE project_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        """, (project_id, limit)).fetchall()
        conn.close()
        
        results = []
        for row in events:
            event = dict(row)
            import json
            if event.get("metadata_json"):
                try:
                    event["metadata"] = json.loads(event["metadata_json"])
                except json.JSONDecodeError:
                    event["metadata"] = {}
            else:
                event["metadata"] = {}
            results.append(event)
        return results
    except Exception as e:
        print(f"Error fetching activity events: {e}")
        return []

def update_playlist_item(item_id: int, updates: dict, conn: Optional[sqlite3.Connection] = None):
    close_conn = False
    if conn is None:
        conn = sqlite3.connect(DB_PATH)
        close_conn = True
    cursor = conn.cursor()
    allowed_keys = ['position_index', 'trim_start_ms', 'trim_end_ms', 'crossfade_duration_ms', 'gain_db', 'transition_preset', 'is_snapped', 'fade_curve', 'transition_type', 'duck_amount_db', 'eq_mode', 'sync_mode', 'phrase_snap_override']
    
    set_clauses = []
    values = []
    for k, v in updates.items():
        if k in allowed_keys:
            set_clauses.append(f"{k} = ?")
            values.append(v)
            
    if set_clauses:
        values.append(item_id)
        cursor.execute(f"UPDATE playlist_items SET {', '.join(set_clauses)} WHERE id = ?", tuple(values))
        if close_conn:
            conn.commit()
    if close_conn:
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
        SELECT t.*, pi.id as item_id, pi.position_index, pi.trim_start_ms, pi.trim_end_ms, pi.crossfade_duration_ms, pi.gain_db, pi.transition_preset, pi.is_snapped, pi.phrase_snap_override, pi.fade_curve, pi.transition_type, pi.duck_amount_db, pi.eq_mode, pi.sync_mode
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

def log_audit_event(project_id, actor, entity_type, entity_id, action_type, severity='low', before_json=None, after_json=None, source_context=None):
    try:
        import json, time
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO audit_logs (project_id, actor, entity_type, entity_id, action_type, severity, before_json, after_json, source_context, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (project_id, actor, entity_type, str(entity_id), action_type, severity, 
              json.dumps(before_json) if before_json else None, 
              json.dumps(after_json) if after_json else None, 
              source_context, time.time()))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error logging audit: {e}")

def get_audit_logs(project_id, limit=100):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        logs = conn.execute("""
            SELECT * FROM audit_logs
            WHERE project_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
        """, (project_id, limit)).fetchall()
        conn.close()
        return [dict(l) for l in logs]
    except Exception as e:
        print(f"Error fetching audit logs: {e}")
        return []

# Phase 35: AI Session Helpers
import time
import json

def get_ai_sessions(limit=50):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        sessions = conn.execute("""
            SELECT id, name, summary, prompt, status, rating, applied_at, created_at, updated_at, parent_session_id 
            FROM ai_sessions 
            ORDER BY updated_at DESC 
            LIMIT ?
        """, (limit,)).fetchall()
        conn.close()
        return [dict(s) for s in sessions]
    except Exception as e:
        print(f"Error fetching AI sessions: {e}")
        return []

def get_ai_session(session_id: int) -> Optional[Dict[str, Any]]:
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        session = conn.execute("SELECT * FROM ai_sessions WHERE id = ?", (session_id,)).fetchone()
        conn.close()
        if session:
            s = dict(session)
            # Parse JSON fields
            s["input_tracks"] = json.loads(s.get("input_tracks_json", "[]"))
            s["variations"] = json.loads(s.get("variations_json", "[]"))
            return s
        return None
    except Exception as e:
        print(f"Error fetching AI session {session_id}: {e}")
        return None

def create_or_update_ai_session(session_id: Optional[int], prompt: str, input_tracks: list, variations: list, selected_index: int = 0):
    try:
        now = time.time()
        conn = get_db_connection()
        cursor = conn.cursor()
        
        name = "Draft Mix"
        summary = prompt[:30] + "..." if len(prompt) > 30 else prompt
        
        if session_id:
            cursor.execute("""
                UPDATE ai_sessions 
                SET prompt = ?, input_tracks_json = ?, variations_json = ?, selected_variation_index = ?, updated_at = ?, name = ?, summary = ?
                WHERE id = ? AND status = 'draft'
            """, (prompt, json.dumps(input_tracks), json.dumps(variations), selected_index, now, name, summary, session_id))
            
            # If no rows updated (e.g. status was not draft or wrong ID), create a new one
            if cursor.rowcount == 0:
                cursor.execute("""
                    INSERT INTO ai_sessions (name, summary, prompt, input_tracks_json, variations_json, selected_variation_index, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (name, summary, prompt, json.dumps(input_tracks), json.dumps(variations), selected_index, now, now))
                session_id = cursor.lastrowid
        else:
            cursor.execute("""
                INSERT INTO ai_sessions (name, summary, prompt, input_tracks_json, variations_json, selected_variation_index, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (name, summary, prompt, json.dumps(input_tracks), json.dumps(variations), selected_index, now, now))
            session_id = cursor.lastrowid
            
        conn.commit()
        conn.close()
        return session_id
    except Exception as e:
        print(f"Error saving AI session: {e}")
        return None

def apply_ai_session(session_id: int, project_id: Optional[int] = None, version_id: Optional[int] = None):
    try:
        now = time.time()
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE ai_sessions 
            SET status = 'applied', applied_at = ?, project_id = ?, applied_version_id = ?, updated_at = ?
            WHERE id = ?
        """, (now, project_id, version_id, now, session_id))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error applying AI session {session_id}: {e}")
        return False

def duplicate_ai_session(session_id: int):
    try:
        now = time.time()
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get existing
        conn.row_factory = sqlite3.Row
        old = conn.execute("SELECT * FROM ai_sessions WHERE id = ?", (session_id,)).fetchone()
        if not old:
            conn.close()
            return None
            
        name = old["name"] + " (Branch)"
        
        cursor.execute("""
            INSERT INTO ai_sessions (parent_session_id, name, summary, prompt, input_tracks_json, variations_json, selected_variation_index, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (session_id, name, old["summary"], old["prompt"], old["input_tracks_json"], old["variations_json"], old["selected_variation_index"], now, now))
        
        new_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return new_id
    except Exception as e:
        print(f"Error duplicating AI session {session_id}: {e}")
        return None

def rate_ai_session(session_id: int, rating: str):
    try:
        now = time.time()
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE ai_sessions 
            SET rating = ?, updated_at = ?
            WHERE id = ?
        """, (rating, now, session_id))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error rating AI session {session_id}: {e}")
        return False
