import os
import sys
import json
import sqlite3
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException, Header, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

# Add current dir to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from extractor import resolve_youtube_audio
from analyzer import analyze_audio
from database import init_db, get_db_connection, get_track_metadata, save_track_metadata, get_all_tracks, create_playlist, get_playlists, add_item_to_playlist, update_playlist_item, delete_playlist_item, get_playlist_items, create_export_job, get_export_job, get_all_exports, log_activity_event, get_activity_events, log_audit_event, get_audit_logs
from backend.stem_extractor import run_stem_extraction
import uuid
import time
import threading
from exporter import process_export_job, apply_custom_crossfade, apply_time_stretch
from recommender import score_candidates, build_set_plan
from pydub import AudioSegment
import re

app = FastAPI(
    title="PulseMix AI Backend",
    description="FastAPI Audio Extractor and Music Information Retrieval Server",
    version="1.0"
)

# Enable CORS for Next.js dev server securely
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Determine the Next.js static asset directories relative to workspace
WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOWNLOADS_DIR = os.path.join(WORKSPACE_DIR, "public", "downloads")
MUSIC_DIR = os.path.join(WORKSPACE_DIR, "public", "music")

# Ensure static directories exist
os.makedirs(DOWNLOADS_DIR, exist_ok=True)
os.makedirs(MUSIC_DIR, exist_ok=True)
PREVIEWS_DIR = os.path.join(WORKSPACE_DIR, "public", "previews")
os.makedirs(PREVIEWS_DIR, exist_ok=True)

# Generate synthetic high-fidelity preset loop files if not present
from synthesizer import generate_preset_library
try:
    if not os.path.exists(os.path.join(MUSIC_DIR, "lofi_raindrops.mp3")):
        generate_preset_library(MUSIC_DIR)
except Exception as e:
    print(f"[Backend] Failed to run preset loop synthesizer: {e}")

# Initialize SQLite metadata database
init_db()

# In-memory Job Queue for Background Processing
import uuid
import time
import threading
from fastapi import BackgroundTasks

jobs = {}

def cleanup_old_files():
    """Background thread to delete downloaded files older than 60 minutes."""
    while True:
        try:
            now = time.time()
            for filename in os.listdir(DOWNLOADS_DIR):
                filepath = os.path.join(DOWNLOADS_DIR, filename)
                if os.path.isfile(filepath):
                    file_age = now - os.path.getmtime(filepath)
                    if file_age > 3600: # 60 minutes
                        os.remove(filepath)
                        print(f"[Cleanup] Deleted old file: {filename}")
        except Exception as e:
            print(f"[Cleanup] Error during cleanup: {e}")
        time.sleep(1800) # Sleep for 30 minutes

cleanup_thread = threading.Thread(target=cleanup_old_files, daemon=True)
cleanup_thread.start()

class ImportRequest(BaseModel):
    url: str


@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "PulseMix AI Audio Processing Backend is running.",
        "directories": {
            "downloads": DOWNLOADS_DIR,
            "music": MUSIC_DIR
        }
    }

def process_audio_job(job_id: str, url: str):
    """Background worker to download and analyze audio asynchronously."""
    try:
        jobs[job_id]["status"] = "queued"
        
        def update_progress(pct: float):
            jobs[job_id]["progress"] = pct
            
        jobs[job_id]["status"] = "downloading"
        jobs[job_id]["progress"] = 0.0
        
        extraction = resolve_youtube_audio(url, DOWNLOADS_DIR, progress_callback=update_progress)
        
        jobs[job_id]["status"] = "analyzing"
        jobs[job_id]["progress"] = 100.0
        
        # Check SQLite cache first
        cached_metadata = get_track_metadata(url)
        
        # We only use cache if it was actually analyzed by the Real Audio Analysis Pipeline (Phase 10)
        # Mocked tracks will have analysis_status = 'pending' or missing
        is_real_cache = cached_metadata and cached_metadata.get('analysis_status') == 'completed'
        
        if is_real_cache:
            print(f"[Backend] Cache hit for {url}. Skipping librosa analysis.")
            extraction["bpm"] = cached_metadata["bpm"]
            extraction["bpm_confidence"] = cached_metadata.get("bpm_confidence", 0.0)
            extraction["key"] = cached_metadata["key_signature"]
            extraction["analysis_status"] = "completed"
            extraction["raw_bpm"] = cached_metadata.get("raw_bpm")
        elif not extraction["id"].startswith("mock_"):
            analysis = analyze_audio(extraction["filepath"])
            extraction["bpm"] = analysis["bpm"]
            extraction["raw_bpm"] = analysis.get("raw_bpm")
            extraction["bpm_confidence"] = analysis.get("bpm_confidence", 0.0)
            extraction["key"] = analysis["key"]
            
            # Determine analysis status
            status = "completed"
            if analysis["bpm_confidence"] < 0.3 or not analysis["key"]:
                status = "low_confidence"
                
            extraction["analysis_status"] = status
            
            # Save to SQLite
            save_track_metadata(
                youtube_url=url,
                title=extraction["title"],
                bpm=extraction["bpm"],
                bpm_confidence=extraction["bpm_confidence"],
                key_signature=extraction["key"],
                duration=extraction["duration"],
                genre=extraction.get("genre", "Imported"),
                url=extraction["url"],
                filepath=extraction["filepath"],
                waveform_data=analysis.get("waveform_data", "[]"),
                analysis_status=status,
                raw_bpm=extraction["raw_bpm"]
            )
            
        jobs[job_id]["status"] = "ready" if not is_real_cache else "from_cache"
        jobs[job_id]["track"] = {
            "id": extraction["id"],
            "title": extraction["title"],
            "duration": extraction["duration"],
            "thumbnail": extraction["thumbnail"],
            "url": extraction["url"],
            "youtube_url": url,
            "bpm": extraction["bpm"],
            "key": extraction["key"],
            "genre": extraction.get("genre", "Imported"),
            "analysis_status": extraction.get("analysis_status", "pending"),
            "raw_bpm": extraction.get("raw_bpm"),
            "from_cache": bool(cached_metadata)
        }
    except Exception as e:
        error_str = str(e).lower()
        if "timeout" in error_str or "timed out" in error_str:
            jobs[job_id]["status"] = "timed_out"
        else:
            jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)


@app.post("/api/import")
def import_track(req: ImportRequest, bg_tasks: BackgroundTasks):
    """
    Endpoint to trigger async download and analysis of a YouTube track.
    Returns a job_id instantly for the client to poll.
    """
    if not req.url or len(req.url.strip()) == 0:
        raise HTTPException(status_code=400, detail="YouTube URL cannot be empty")
        
    # Validation: basic YouTube URL regex check
    if req.url != "mock_test_url" and not re.match(r'^(https?://)?(www\.)?(youtube\.com|youtu\.?be)/.+$', req.url):
        raise HTTPException(status_code=400, detail="Invalid YouTube URL format")
        
    print(f"[Backend] Received async import request for URL: {req.url}")
    
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "queued", "progress": 0.0}
    
    bg_tasks.add_task(process_audio_job, job_id, req.url)
    
    return {
        "success": True,
        "job_id": job_id,
        "status": "queued"
    }

class StemExtractRequest(BaseModel):
    youtube_url: str

@app.post("/api/stems/extract")
def extract_stems(req: StemExtractRequest, bg_tasks: BackgroundTasks):
    if not req.youtube_url:
        raise HTTPException(status_code=400, detail="YouTube URL required")
    
    # We trigger the async extraction in background tasks so the request returns immediately
    bg_tasks.add_task(run_stem_extraction, req.youtube_url)
    
    return {"success": True, "status": "queued", "youtube_url": req.youtube_url}

@app.get("/api/library")
def get_library():
    """Endpoint to retrieve historically analyzed tracks from SQLite."""
    try:
        tracks = get_all_tracks()
        return {"success": True, "tracks": tracks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class PlaylistCreate(BaseModel):
    name: str

class PlaylistItemAdd(BaseModel):
    youtube_url: str
    position_index: int

class PlaylistItemUpdate(BaseModel):
    position_index: Optional[int] = None
    trim_start_ms: Optional[float] = None
    trim_end_ms: Optional[float] = None
    crossfade_duration_ms: Optional[float] = None
    gain_db: Optional[float] = None
    eq_mode: Optional[str] = None

class TakeEvent(BaseModel):
    timestamp_ms: float
    event_type: str
    item_id: Optional[int] = None
    previous_val: Optional[str] = None
    new_val: Optional[str] = None
    is_divergence: bool = False

class TakeCreate(BaseModel):
    events: List[TakeEvent]

# In-memory store for performance takes
takes_db: Dict[int, List[Dict[str, Any]]] = {}

@app.post("/api/playlists/{playlist_id}/takes")
def api_create_take(playlist_id: int, req: TakeCreate):
    try:
        take_id = str(uuid.uuid4())
        take_data = {
            "take_id": take_id,
            "created_at": time.time(),
            "events": [e.dict() for e in req.events]
        }
        if playlist_id not in takes_db:
            takes_db[playlist_id] = []
        takes_db[playlist_id].append(take_data)
        return {"success": True, "take_id": take_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/playlists/{playlist_id}/takes")
def api_get_takes(playlist_id: int):
    try:
        return {"success": True, "takes": takes_db.get(playlist_id, [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/playlists")
def api_create_playlist(req: PlaylistCreate):
    try:
        pid = create_playlist(req.name)
        return {"success": True, "id": pid, "name": req.name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/playlists")
def api_get_playlists():
    try:
        return {"success": True, "playlists": get_playlists()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/recommendations")
def api_get_recommendations(base_youtube_url: str):
    try:
        base_track = get_track_metadata(base_youtube_url)
        if not base_track:
            raise HTTPException(status_code=404, detail="Base track not found")
        
        all_tracks = get_all_tracks()
        candidates = score_candidates(base_track, all_tracks)
        
        # Return top 5
        return {"success": True, "recommendations": candidates[:5]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/playlists/{playlist_id}/items")
def api_add_item_to_playlist(playlist_id: int, req: PlaylistItemAdd):
    try:
        item_id = add_item_to_playlist(playlist_id, req.youtube_url, req.position_index)
        return {"success": True, "item_id": item_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class AutoBuildRequest(BaseModel):
    steps: int = 3

@app.post("/api/playlists/{playlist_id}/autobuild")
def api_autobuild_set(playlist_id: int, req: AutoBuildRequest):
    try:
        items = get_playlist_items(playlist_id)
        if not items:
            raise HTTPException(status_code=400, detail="Playlist is empty, cannot autobuild without a seed track.")
            
        last_item = items[-1]
        base_track = get_track_metadata(last_item["youtube_url"])
        if not base_track:
            raise HTTPException(status_code=404, detail="Seed track metadata not found.")
            
        library = get_all_tracks()
        plan = build_set_plan(base_track, library, steps=req.steps)
        
        return plan
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/playlists/{playlist_id}/items")
def api_get_playlist_items(playlist_id: int):
    try:
        return {"success": True, "items": get_playlist_items(playlist_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ProjectImportRequest(BaseModel):
    project_data: Dict[str, Any]

@app.get("/api/projects/export/{playlist_id}")
def api_export_project(playlist_id: int):
    try:
        # Fetch playlist name
        conn = get_db_connection()
        playlist = conn.execute("SELECT name FROM playlists WHERE id = ?", (playlist_id,)).fetchone()
        conn.close()
        if not playlist:
            raise HTTPException(status_code=404, detail="Playlist not found")
            
        items = get_playlist_items(playlist_id)
        takes = takes_db.get(playlist_id, [])
        
        manifest = {
            "schema_version": "1.0",
            "created_with_phase": "Phase 17",
            "playlist_name": playlist["name"],
            "track_count": len(items),
            "take_count": len(takes),
            "audio_assets_included": False,
            "stems_included": False,
            "required_actions": [
                "Ensure local or cloud access to original audio tracks via YouTube URL.",
                "Stems will need to be regenerated locally if 'STEM AUTOMATION' modes are used."
            ],
            "items": items,
            "takes": takes
        }
        
        return {"success": True, "project": manifest}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/projects/import")
def api_import_project(req: ProjectImportRequest):
    try:
        data = req.project_data
        if data.get("schema_version") != "1.0":
            # Just a warning or info, we can attempt to parse anyway
            pass
            
        # 1. Create new playlist
        new_name = f"{data.get('playlist_name', 'Imported Session')} (Imported)"
        new_pid = create_playlist(new_name)
        
        # 2. Add items
        items = data.get("items", [])
        for item in items:
            item_id = add_item_to_playlist(new_pid, item["youtube_url"], item["position_index"])
            # Update DSP metadata
            updates = {
                "trim_start_ms": item.get("trim_start_ms"),
                "trim_end_ms": item.get("trim_end_ms"),
                "crossfade_duration_ms": item.get("crossfade_duration_ms"),
                "gain_db": item.get("gain_db"),
                "eq_mode": item.get("eq_mode")
            }
            # Remove Nones
            updates = {k: v for k, v in updates.items() if v is not None}
            if updates:
                update_playlist_item(item_id, updates)
                
        # 3. Add takes
        takes = data.get("takes", [])
        if takes:
            takes_db[new_pid] = takes
            
        return {"success": True, "new_playlist_id": new_pid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CloudProjectCreate(BaseModel):
    playlist_id: int
    project_data: Dict[str, Any]

class CloudVersionCreate(BaseModel):
    project_data: Dict[str, Any]

@app.get("/api/cloud/projects")
def api_get_cloud_projects():
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        projects = conn.execute("SELECT * FROM cloud_projects ORDER BY created_at DESC").fetchall()
        
        result = []
        for p in projects:
            versions = conn.execute("SELECT COUNT(*) as count FROM cloud_project_versions WHERE project_id = ?", (p["id"],)).fetchone()
            last_edit = conn.execute("SELECT created_at, review_status FROM cloud_project_versions WHERE project_id = ? ORDER BY version_number DESC LIMIT 1", (p["id"],)).fetchone()
            result.append({
                "id": p["id"],
                "name": p["name"],
                "share_token": p["share_token"],
                "created_at": p["created_at"],
                "version_count": versions["count"],
                "last_edited": last_edit["created_at"] if last_edit else p["created_at"],
                "review_status": last_edit["review_status"] if last_edit else "needs_review"
            })
        conn.close()
        return {"success": True, "projects": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/cloud/projects")
def api_create_cloud_project(req: CloudProjectCreate):
    try:
        data = req.project_data
        share_token = str(uuid.uuid4())
        name = data.get("playlist_name", "Untitled Project")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        now = time.time()
        
        cursor.execute("INSERT INTO cloud_projects (name, share_token, created_at) VALUES (?, ?, ?)", (name, share_token, now))
        project_id = cursor.lastrowid
        
        # Insert v1
        cursor.execute("INSERT INTO cloud_project_versions (project_id, version_number, payload_json, created_at) VALUES (?, ?, ?, ?)", 
                       (project_id, 1, json.dumps(data), now))
        conn.commit()
        conn.close()
        return {"success": True, "project_id": project_id, "share_token": share_token}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/cloud/projects/{project_id}/versions")
def api_save_cloud_version(project_id: int, req: CloudVersionCreate):
    try:
        data = req.project_data
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        now = time.time()
        
        # Get latest version number and id before insert
        latest = cursor.execute("SELECT id, version_number as max_v FROM cloud_project_versions WHERE project_id = ? ORDER BY version_number DESC LIMIT 1", (project_id,)).fetchone()
        next_v = (latest["max_v"] if latest else 0) + 1
        
        cursor.execute("INSERT INTO cloud_project_versions (project_id, version_number, payload_json, created_at) VALUES (?, ?, ?, ?)", 
                       (project_id, next_v, json.dumps(data), now))
        new_version_id = cursor.lastrowid
        
        # Phase 19: Carry forward unresolved comments from previous version
        if latest:
            old_v_id = latest["id"]
            unresolved = cursor.execute("SELECT * FROM project_comments WHERE version_id = ? AND is_resolved = 0", (old_v_id,)).fetchall()
            for c in unresolved:
                cursor.execute("""
                    INSERT INTO project_comments (version_id, target_type, target_id, timestamp_ms, boundary_index, content, is_resolved, carried_forward_from, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
                """, (new_version_id, c["target_type"], c["target_id"], c["timestamp_ms"], c["boundary_index"], c["content"], c["id"], now))
        
        # Update project name just in case
        name = data.get("playlist_name", "Untitled Project")
        cursor.execute("UPDATE cloud_projects SET name = ? WHERE id = ?", (name, project_id))
        
        conn.commit()
        conn.close()
        return {"success": True, "version_number": next_v, "version_id": new_version_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Phase 19: Commenting and Review Endpoints

class CommentCreate(BaseModel):
    target_type: str
    target_id: Optional[str] = None
    timestamp_ms: Optional[float] = None
    boundary_index: Optional[int] = None
    content: str

class StatusUpdate(BaseModel):
    status: str

@app.get("/api/cloud/versions/{version_id}/comments")
def api_get_comments(version_id: int):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM project_comments WHERE version_id = ? ORDER BY created_at ASC", (version_id,)).fetchall()
        conn.close()
        return {"success": True, "comments": [dict(r) for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/cloud/versions/{version_id}/comments")
def api_post_comment(version_id: int, req: CommentCreate):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        now = time.time()
        cursor.execute("""
            INSERT INTO project_comments (version_id, target_type, target_id, timestamp_ms, boundary_index, content, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (version_id, req.target_type, req.target_id, req.timestamp_ms, req.boundary_index, req.content, now))
        comment_id = cursor.lastrowid
        
        # Get project_id
        res = cursor.execute("SELECT project_id FROM cloud_project_versions WHERE id = ?", (version_id,)).fetchone()
        project_id = res[0] if res else 0
        
        conn.commit()
        conn.close()
        
        if project_id:
            log_activity_event(
                project_id=project_id,
                version_id=version_id,
                event_type="comment_added",
                actor="Collaborator",
                target_id=comment_id,
                metadata={"content": req.content, "target_type": req.target_type},
                importance="high"
            )
            
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/cloud/comments/{comment_id}/resolve")
def api_resolve_comment(comment_id: int):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # Toggle resolved status
        curr = cursor.execute("SELECT is_resolved FROM project_comments WHERE id = ?", (comment_id,)).fetchone()
        if not curr:
            raise Exception("Comment not found")
        new_val = 0 if curr[0] == 1 else 1
        cursor.execute("UPDATE project_comments SET is_resolved = ? WHERE id = ?", (new_val, comment_id))
        
        # Get project info for activity log
        res = cursor.execute("SELECT version_id FROM project_comments WHERE id = ?", (comment_id,)).fetchone()
        version_id = res[0] if res else 0
        project_id = 0
        if version_id:
            pres = cursor.execute("SELECT project_id FROM cloud_project_versions WHERE id = ?", (version_id,)).fetchone()
            if pres:
                project_id = pres[0]
                
        conn.close()
        
        if project_id:
            event_type = "comment_resolved" if new_val == 1 else "comment_reopened"
            log_activity_event(
                project_id=project_id,
                version_id=version_id,
                event_type=event_type,
                actor="Collaborator",
                target_id=comment_id,
                importance="normal"
            )
            
        return {"success": True, "is_resolved": bool(new_val)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class TaskCreate(BaseModel):
    title: str
    comment_id: Optional[int] = None
    assignee_type: Optional[str] = None
    assignee_id: Optional[int] = None
    assignee_label: Optional[str] = None
    status: str = 'open'
    priority: str = 'normal'
    due_at: Optional[float] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    assignee_type: Optional[str] = None
    assignee_id: Optional[int] = None
    assignee_label: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_at: Optional[float] = None

# ==========================================
# Phase 25: Presence Manager
# ==========================================
import time
from typing import Dict, List, Optional
from pydantic import BaseModel

class PresencePing(BaseModel):
    user_label: str
    project_id: int
    version_id: Optional[int] = None
    action: str = "viewing" # viewing, reviewing, editing
    focus_target: Optional[str] = None # e.g. "comment_12", "task_5"

class ActiveSession(BaseModel):
    session_id: str
    user_label: str
    project_id: int
    version_id: Optional[int]
    action: str
    focus_target: Optional[str]
    last_seen_ms: int

# Phase 26 Models
class CloudExportCreate(BaseModel):
    version_id: int
    job_type: str # 'full_mix', 'preview', 'stems'
    format: str # 'mp3', 'wav', 'zip'

class CloudExportUpdate(BaseModel):
    status: str
    file_url: Optional[str] = None
    error_message: Optional[str] = None

class PresenceManager:
    def __init__(self):
        # Maps session_id to ActiveSession
        self.sessions: Dict[str, ActiveSession] = {}
        self.timeout_ms = 15000 # 15 seconds

    def ping(self, session_id: str, ping_data: PresencePing):
        self.sessions[session_id] = ActiveSession(
            session_id=session_id,
            user_label=ping_data.user_label,
            project_id=ping_data.project_id,
            version_id=ping_data.version_id,
            action=ping_data.action,
            focus_target=ping_data.focus_target,
            last_seen_ms=int(time.time() * 1000)
        )
        self._cleanup()

    def get_project_presence(self, project_id: int) -> List[ActiveSession]:
        self._cleanup()
        return [s for s in self.sessions.values() if s.project_id == project_id]

    def _cleanup(self):
        now = int(time.time() * 1000)
        stale_keys = [k for k, v in self.sessions.items() if now - v.last_seen_ms > self.timeout_ms]
        for k in stale_keys:
            del self.sessions[k]

presence_manager = PresenceManager()

@app.post("/api/cloud/presence")
def api_post_presence(ping_data: PresencePing, request: Request):
    # Use client IP + user_label as a mock session_id for now
    client_ip = request.client.host if request.client else "unknown"
    session_id = f"{client_ip}_{ping_data.user_label}"
    presence_manager.ping(session_id, ping_data)
    return {"success": True}

@app.get("/api/cloud/presence/{project_id}")
def api_get_presence(project_id: int):
    sessions = presence_manager.get_project_presence(project_id)
    return {"success": True, "sessions": [s.dict() for s in sessions]}

# ==========================================
# Tasks Endpoints
# ==========================================
@app.get("/api/cloud/projects/{project_id}/tasks")
def api_get_tasks(project_id: int):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM review_tasks WHERE project_id = ? ORDER BY created_at DESC", (project_id,)).fetchall()
        conn.close()
        return {"success": True, "tasks": [dict(r) for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/cloud/versions/{version_id}/tasks")
def api_get_version_tasks(version_id: int):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM review_tasks WHERE version_id = ? ORDER BY created_at DESC", (version_id,)).fetchall()
        conn.close()
        return {"success": True, "tasks": [dict(r) for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/cloud/versions/{version_id}/tasks")
def api_post_task(version_id: int, req: TaskCreate):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        now = time.time()
        
        # Get project_id
        res = cursor.execute("SELECT project_id FROM cloud_project_versions WHERE id = ?", (version_id,)).fetchone()
        if not res:
            raise Exception("Version not found")
        project_id = res[0]
        
        cursor.execute("""
            INSERT INTO review_tasks (comment_id, project_id, version_id, title, assignee_type, assignee_id, assignee_label, status, priority, due_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (req.comment_id, project_id, version_id, req.title, req.assignee_type, req.assignee_id, req.assignee_label, req.status, req.priority, req.due_at, now, now))
        
        task_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        log_activity_event(
            project_id=project_id,
            version_id=version_id,
            event_type="task_created",
            actor="Collaborator",
            target_id=task_id,
            metadata={"title": req.title, "assignee_label": req.assignee_label},
            importance="normal"
        )
            
        return {"success": True, "task_id": task_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/cloud/tasks/{task_id}")
def api_update_task(task_id: int, req: TaskUpdate):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        task = cursor.execute("SELECT * FROM review_tasks WHERE id = ?", (task_id,)).fetchone()
        if not task:
            raise Exception("Task not found")
            
        updates = []
        params = []
        if req.title is not None:
            updates.append("title = ?")
            params.append(req.title)
        if req.assignee_type is not None:
            updates.append("assignee_type = ?")
            params.append(req.assignee_type)
        if req.assignee_id is not None:
            updates.append("assignee_id = ?")
            params.append(req.assignee_id)
        if req.assignee_label is not None:
            updates.append("assignee_label = ?")
            params.append(req.assignee_label)
        if req.status is not None:
            updates.append("status = ?")
            params.append(req.status)
            if req.status == 'done' and task['status'] != 'done':
                updates.append("completed_at = ?")
                params.append(time.time())
            elif req.status != 'done' and task['status'] == 'done':
                updates.append("completed_at = NULL")
        if req.priority is not None:
            updates.append("priority = ?")
            params.append(req.priority)
        if req.due_at is not None:
            updates.append("due_at = ?")
            params.append(req.due_at)
            
        if not updates:
            return {"success": True}
            
        updates.append("updated_at = ?")
        params.append(time.time())
        params.append(task_id)
        
        cursor.execute(f"UPDATE review_tasks SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
        conn.close()
        
        event_type = "task_updated"
        if req.status == 'done' and task['status'] != 'done':
            event_type = "task_completed"
            
        log_activity_event(
            project_id=task['project_id'],
            version_id=task['version_id'],
            event_type=event_type,
            actor="Collaborator",
            target_id=task_id,
            metadata={"status": req.status, "assignee_label": req.assignee_label},
            importance="normal"
        )
            
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/cloud/versions/{version_id}/status")
def api_update_version_status(version_id: int, req: StatusUpdate):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        res = cursor.execute("SELECT project_id, review_status FROM cloud_project_versions WHERE id = ?", (version_id,)).fetchone()
        project_id = res[0] if res else 0
        old_status = res[1] if res else None
        
        cursor.execute("UPDATE cloud_project_versions SET review_status = ? WHERE id = ?", (req.status, version_id))
        
        conn.commit()
        conn.close()
        
        if project_id:
            log_activity_event(
                project_id=project_id,
                version_id=version_id,
                event_type="status_changed",
                actor="Collaborator",
                metadata={"new_status": req.status},
                importance="high"
            )
            
            log_audit_event(
                project_id=project_id,
                actor="Collaborator",
                entity_type="version",
                entity_id=version_id,
                action_type="update_status",
                severity="medium",
                before_json={"review_status": old_status},
                after_json={"review_status": req.status}
            )
            
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/cloud/share/{share_token}")
def api_get_shared_project(share_token: str):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        project = conn.execute("SELECT * FROM cloud_projects WHERE share_token = ?", (share_token,)).fetchone()
        
        if not project:
            conn.close()
            raise HTTPException(status_code=404, detail="Shared project not found")
            
        latest_version = conn.execute("SELECT * FROM cloud_project_versions WHERE project_id = ? ORDER BY version_number DESC LIMIT 1", (project["id"],)).fetchone()
        conn.close()
        
        if not latest_version:
            raise HTTPException(status_code=404, detail="Project data missing")
            
        data = json.loads(latest_version["payload_json"])
        return {
            "success": True, 
            "project_metadata": {
                "id": project["id"],
                "name": project["name"],
                "version": latest_version["version_number"],
                "version_id": latest_version["id"],
                "last_edited": latest_version["created_at"],
                "review_status": latest_version["review_status"]
            },
            "manifest": data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/playlist-items/{item_id}")
def api_update_playlist_item(item_id: int, req: PlaylistItemUpdate):
    try:
        updates = {k: v for k, v in req.dict().items() if v is not None}
        update_playlist_item(item_id, updates)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/playlist-items/{item_id}")
def api_delete_playlist_item(item_id: int):
    try:
        delete_playlist_item(item_id)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/status/{job_id}")
def get_job_status(job_id: str):
    """Polling endpoint for track import status."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]

class ExportRequest(BaseModel):
    playlist_id: int
    master_bus_mode: Optional[str] = "Balanced"

@app.post("/api/export")
def create_export(req: ExportRequest, bg_tasks: BackgroundTasks):
    job_id = f"{uuid.uuid4()}"
    settings = json.dumps({"source": "playlist", "master_bus_mode": req.master_bus_mode})
    create_export_job(job_id, req.playlist_id, settings)
    bg_tasks.add_task(process_export_job, job_id, req.playlist_id, "Playlist", req.master_bus_mode)
    
    return {"success": True, "job_id": job_id}
@app.get("/api/export")
def get_all_export_jobs():
    exports = get_all_exports()
    # Limit to max 10
    return {"success": True, "jobs": exports[:10]}

@app.get("/api/export/latest")
def get_latest_export():
    exports = get_all_exports()
    if not exports:
        return {"success": True, "job": None}
    return {"success": True, "job": exports[0]}

@app.get("/api/export/{job_id}")
def get_export_status(job_id: str):
    job = get_export_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Export job not found")
    return {"success": True, "job": job}

@app.get("/api/inventory")
def get_inventory():
    """
    List all pre-curated high-fidelity demonstration tracks.
    """
    tracks = get_all_tracks()
    return {
        "count": len(tracks),
        "tracks": tracks
    }

@app.get("/api/recommend")
def recommend_tracks(
    bpm: float = Query(128.0, description="Current BPM to match"),
    key: str = Query("8A", description="Current Camelot key to match")
):
    """
    Recommends compatible tracks from the inventory based on:
    1. Key compatibility (adjacent or relative Camelot numbers)
    2. BPM proximity (within +/- 15 BPM)
    """
    # Simple check for Camelot key compatibility
    def check_camelot_compat(k1, k2):
        if k1 == k2:
            return True
        try:
            num1 = int(k1[:-1])
            letter1 = k1[-1]
            num2 = int(k2[:-1])
            letter2 = k2[-1]
            
            # Relative major/minor
            if num1 == num2 and letter1 != letter2:
                return True
            # Adjacent numbers
            if letter1 == letter2:
                diff = abs(num1 - num2)
                if diff == 1 or diff == 11:
                    return True
        except:
            pass
        return False

    recommendations = []
    tracks = get_all_tracks()
    
    for track in tracks:
        k_compat = check_camelot_compat(key, track["key"])
        bpm_diff = abs(bpm - track["bpm"])
        
        # Scoring compatibility
        if k_compat and bpm_diff <= 15:
            score = 100 - int(bpm_diff * 3) # Higher is better
            recommendations.append({
                "track": track,
                "compatibility_score": score,
                "reason": f"Harmonic match ({track['key']}) + BPM syncable (+{int(bpm_diff)} BPM)" if bpm_diff > 0 else f"Perfect match ({track['key']})!"
            })
            
    # Sort recommendations by highest score
    recommendations.sort(key=lambda x: x["compatibility_score"], reverse=True)
    return recommendations

class PreviewRequest(BaseModel):
    playlist_id: int

@app.post("/api/preview-transition/{item_id}")
def preview_transition(item_id: int, req: PreviewRequest):
    try:
        items = get_playlist_items(req.playlist_id)
        curr_idx = -1
        for i, item in enumerate(items):
            if item["item_id"] == item_id:
                curr_idx = i
                break
                
        if curr_idx <= 0:
            raise HTTPException(status_code=400, detail="Item has no predecessor to transition from.")
            
        prev_item = items[curr_idx - 1]
        curr_item = items[curr_idx]
        
        xfade = int(curr_item.get("crossfade_duration_ms", 2000))
        fade_curve = curr_item.get("fade_curve", "linear")
        duck_amount_db = float(curr_item.get("duck_amount_db", 0.0))
        eq_mode = curr_item.get("eq_mode", "none")
        sync_mode = curr_item.get("sync_mode", "auto")
        incoming_bpm = curr_item.get("bpm", 0)
        outgoing_bpm = prev_item.get("bpm", 0)
        
        if not prev_item.get("filepath") or not os.path.exists(prev_item["filepath"]):
            raise Exception("Predecessor file missing")
        if not curr_item.get("filepath") or not os.path.exists(curr_item["filepath"]):
            raise Exception("Current file missing")
            
        prev_audio = AudioSegment.from_file(prev_item["filepath"])
        curr_audio = AudioSegment.from_file(curr_item["filepath"])
        
        for aud, it in [(prev_audio, prev_item), (curr_audio, curr_item)]:
            st = it.get("trim_start_ms", 0)
            en = it.get("trim_end_ms", 0)
            if en and en > st: aud = aud[st:en]
            elif st > 0: aud = aud[st:]
            if it == prev_item: prev_audio = aud
            else: curr_audio = aud
            
        prev_piece = prev_audio[-(xfade + 5000):] if len(prev_audio) > (xfade + 5000) else prev_audio
        curr_piece = curr_audio[:(xfade + 5000)]
        
        if sync_mode == 'auto' and outgoing_bpm and incoming_bpm:
            ratio = outgoing_bpm / incoming_bpm
            if 0.85 <= ratio <= 1.15:
                curr_piece = apply_time_stretch(curr_piece, ratio)
        
        mixed = apply_custom_crossfade(prev_piece, curr_piece, xfade, curve=fade_curve, duck_amount_db=duck_amount_db, eq_mode=eq_mode)
        
        filename = f"preview_{item_id}_{int(time.time())}.wav"
        filepath = os.path.join(PREVIEWS_DIR, filename)
        mixed.export(filepath, format="wav")
        
        return {"success": True, "url": f"/previews/{filename}"}
    except Exception as e:
        print(f"[Preview Error] {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Phase 20/21: Publishing Endpoints
import hashlib

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

class PublishCreate(BaseModel):
    package_type: str
    notes: Optional[str] = None
    allow_download: bool = False
    expires_in_hours: Optional[int] = None
    recipient_label: Optional[str] = None
    password: Optional[str] = None
    export_ids: Optional[List[int]] = None

@app.post("/api/cloud/versions/{version_id}/publish")
def api_publish_version(version_id: int, req: PublishCreate):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        now = time.time()
        publish_token = str(uuid.uuid4())
        
        expires_at = now + (req.expires_in_hours * 3600) if req.expires_in_hours else None
        pwd_hash = hash_password(req.password) if req.password else None
        
        cursor.execute("""
            INSERT INTO published_packages (version_id, publish_token, package_type, notes, allow_download, expires_at, password_hash, recipient_label, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (version_id, publish_token, req.package_type, req.notes, 1 if req.allow_download else 0, expires_at, pwd_hash, req.recipient_label, now))
        
        package_id = cursor.lastrowid
        
        if req.export_ids:
            for export_id in req.export_ids:
                cursor.execute("""
                    INSERT OR IGNORE INTO package_exports (package_id, export_job_id)
                    VALUES (?, ?)
                """, (package_id, export_id))
        
        # Get project_id
        res = cursor.execute("SELECT project_id FROM cloud_project_versions WHERE id = ?", (version_id,)).fetchone()
        project_id = res[0] if res else 0
        
        conn.commit()
        conn.close()
        
        if project_id:
            log_activity_event(
                project_id=project_id,
                version_id=version_id,
                event_type="package_published",
                actor="Creator",
                target_id=package_id,
                metadata={"package_type": req.package_type, "recipient_label": req.recipient_label},
                importance="high"
            )
            
            log_audit_event(
                project_id=project_id,
                actor="Creator",
                entity_type="package",
                entity_id=package_id,
                action_type="publish_package",
                severity="high",
                after_json={"package_type": req.package_type, "allow_download": req.allow_download, "exports": req.export_ids}
            )
            
        return {"success": True, "publish_token": publish_token}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/public/publish/{publish_token}")
def api_get_public_publish(publish_token: str, pwd: Optional[str] = None):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        
        package = conn.execute("SELECT * FROM published_packages WHERE publish_token = ?", (publish_token,)).fetchone()
        if not package:
            conn.close()
            raise HTTPException(status_code=404, detail="Publish token not found")
            
        now = time.time()
        if package["is_revoked"] == 1:
            conn.close()
            return {"success": False, "error": "revoked"}
            
        if package["expires_at"] and now > package["expires_at"]:
            conn.close()
            return {"success": False, "error": "expired"}
            
        if package["password_hash"]:
            if not pwd or hash_password(pwd) != package["password_hash"]:
                conn.close()
                return {"success": False, "needs_password": True}
                
        version = conn.execute("SELECT * FROM cloud_project_versions WHERE id = ?", (package["version_id"],)).fetchone()
        if version is None:
            print("VERSION IS NONE! package['version_id']=", package["version_id"])
        project = conn.execute("SELECT * FROM cloud_projects WHERE id = ?", (version["project_id"],)).fetchone()
        if project is None:
            print("PROJECT IS NONE! version['project_id']=", version["project_id"])
        
        # Log the access
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO published_package_access_logs (package_id, event_type, timestamp)
            VALUES (?, ?, ?)
        """, (package["id"], "opened", now))
        conn.commit()
        
        conn.close()
        
        # Log to activity feed
        if project and version:
            log_activity_event(
                project_id=project["id"],
                version_id=version["id"],
                event_type="package_opened",
                actor=package["recipient_label"] or "Anonymous Recipient",
                target_id=package["id"],
                metadata={"package_type": package["package_type"]},
                importance="high"
            )
        
        # Fetch linked exports
        exports = conn.execute("""
            SELECT e.*, a.byte_size, a.mime_type, a.retention_policy, a.retention_source, a.status as status_artifact, a.expires_at, a.id as stored_artifact_id
            FROM export_jobs e
            JOIN package_exports pe ON pe.export_job_id = e.id
            JOIN stored_artifacts a ON e.artifact_id = a.id
            WHERE pe.package_id = ?
        """, (package["id"],)).fetchall()
        
        # Load the raw manifest payload
        raw_manifest = json.loads(version["payload_json"])
        
        # Strip out internal metadata
        public_manifest = {
            "title": project["name"],
            "version": version["version_number"],
            "track_count": len(raw_manifest.get("items", [])),
            "duration_ms": sum([t.get("duration", 0) for t in raw_manifest.get("items", [])]),
            "tracks": [
                {
                    "title": t.get("title"),
                    "artist": t.get("artist", "Unknown"),
                    "genre": t.get("genre"),
                    "bpm": t.get("bpm")
                }
                for t in raw_manifest.get("items", [])
            ],
            "notes": package["notes"],
            "package_type": package["package_type"],
            "allow_download": bool(package["allow_download"]),
            "published_at": package["created_at"],
            "audio_url": f"/api/export/mock_audio_{publish_token}",
            "project_name": project["name"],
            "version_number": version["version_number"],
            "manifest": raw_manifest,
            "exports": [
                {
                    **dict(e),
                    "file_url": f"/api/public/publish/{publish_token}/download/{e['stored_artifact_id']}"
                } for e in exports
            ]
        }
        
        return {"success": True, "package": public_manifest}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class AuthRequest(BaseModel):
    password: str

@app.post("/api/public/publish/{publish_token}/auth")
def api_auth_public_publish(publish_token: str, req: AuthRequest):
    return api_get_public_publish(publish_token, pwd=req.password)

@app.post("/api/public/publish/{publish_token}/log_event")
def api_log_event(publish_token: str, event_type: str = "played"):
    try:
        conn = get_db_connection()
        package = conn.execute("SELECT id FROM published_packages WHERE publish_token = ?", (publish_token,)).fetchone()
        if package:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO published_package_access_logs (package_id, event_type, timestamp)
                VALUES (?, ?, ?)
            """, (package[0], event_type, time.time()))
            conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"success": False}

@app.get("/api/cloud/versions/{version_id}/links")
def api_get_version_links(version_id: int):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        links = conn.execute("SELECT * FROM published_packages WHERE version_id = ? ORDER BY created_at DESC", (version_id,)).fetchall()
        
        results = []
        for ln in links:
            logs = conn.execute("SELECT * FROM published_package_access_logs WHERE package_id = ? ORDER BY timestamp DESC", (ln["id"],)).fetchall()
            ln_dict = dict(ln)
            ln_dict["logs"] = [dict(lg) for lg in logs]
            results.append(ln_dict)
            
        conn.close()
        return {"success": True, "links": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/cloud/publish/{publish_token}/revoke")
def api_revoke_publish(publish_token: str):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE published_packages SET is_revoked = 1 WHERE publish_token = ?", (publish_token,))
        
        # Find project id
        package = cursor.execute("SELECT id, version_id, recipient_label FROM published_packages WHERE publish_token = ?", (publish_token,)).fetchone()
        project_id = 0
        if package:
            res = cursor.execute("SELECT project_id FROM cloud_project_versions WHERE id = ?", (package[1],)).fetchone()
            if res:
                project_id = res[0]
                
        conn.commit()
        conn.close()
        
        if project_id and package:
            log_activity_event(
                project_id=project_id,
                version_id=package[1],
                event_type="link_revoked",
                actor="Creator",
                target_id=package[0],
                metadata={"recipient_label": package[2]},
                importance="normal"
            )
            
            log_audit_event(
                project_id=project_id,
                actor="Creator",
                entity_type="package",
                entity_id=package[0],
                action_type="revoke_package",
                severity="high",
                before_json={"is_revoked": 0},
                after_json={"is_revoked": 1}
            )
            
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
@app.get("/api/cloud/projects/{project_id}/activity")
def api_get_cloud_project_activity(project_id: int):
    try:
        events = get_activity_events(project_id)
        return {"success": True, "events": events}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
@app.get("/api/cloud/projects/{project_id}/audit")
def api_get_cloud_project_audit(project_id: int):
    try:
        logs = get_audit_logs(project_id)
        return {"success": True, "logs": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Phase 26: Export / Render Pipeline

def simulate_export(job_id: int, project_id: int, version_id: int, job_type: str):
    time.sleep(2)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE export_jobs SET status = 'running' WHERE id = ?", (job_id,))
    conn.commit()
    conn.close()
    
    time.sleep(8)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Calculate expiration based on job type
    now = time.time()
    retention_days = 7 if job_type == 'stems' else 30
    expires_at = now + (retention_days * 86400)
    
    # Create the stored artifact
    cursor.execute("""
        INSERT INTO stored_artifacts 
        (project_id, version_id, storage_provider, object_key, mime_type, byte_size, checksum, expires_at, retention_policy, retention_source, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        project_id, 
        version_id, 
        "local_mock", 
        f"project_{project_id}/version_{version_id}/export_{job_id}.wav",
        "audio/wav",
        15_420_000 + job_id * 1024, # Fake byte size (~15MB)
        f"mock_sha256_{job_id}",
        expires_at,
        f"{retention_days}_days",
        "class_default",
        now
    ))
    artifact_id = cursor.lastrowid
    
    cursor.execute("UPDATE export_jobs SET status = 'completed', completed_at = ?, artifact_id = ? WHERE id = ?", 
                   (time.time(), artifact_id, job_id))
    conn.commit()
    conn.close()

@app.post("/api/cloud/projects/{project_id}/export")
def api_create_cloud_export(project_id: int, req: CloudExportCreate, bg_tasks: BackgroundTasks):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO export_jobs (project_id, version_id, job_type, format, artifact_label, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (project_id, req.version_id, req.job_type, req.format, f"{req.job_type.replace('_', ' ').title()} ({req.format.upper()})", time.time()))
        job_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        bg_tasks.add_task(simulate_export, job_id, project_id, req.version_id, req.job_type)
        
        log_audit_event(
            project_id=project_id,
            actor="Collaborator",
            entity_type="export_job",
            entity_id=job_id,
            action_type="create_export",
            severity="low",
            after_json={"job_type": req.job_type, "format": req.format}
        )
        
        return {"success": True, "job_id": job_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/cloud/projects/{project_id}/exports")
def api_get_cloud_exports(project_id: int):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        exports = conn.execute("""
            SELECT e.*, a.byte_size, a.mime_type, a.retention_policy, a.retention_source, a.status as status_artifact, a.expires_at 
            FROM export_jobs e
            LEFT JOIN stored_artifacts a ON e.artifact_id = a.id
            WHERE e.project_id = ? ORDER BY e.created_at DESC
        """, (project_id,)).fetchall()
        conn.close()
        
        result = []
        for row in exports:
            d = dict(row)
            if d.get("artifact_id"):
                d["file_url"] = f"/api/artifacts/{d['artifact_id']}/download"
            result.append(d)
            
        return {"success": True, "exports": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from fastapi.responses import PlainTextResponse

@app.get("/api/artifacts/{artifact_id}/download")
def api_download_artifact(artifact_id: int):
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    artifact = conn.execute("SELECT * FROM stored_artifacts WHERE id = ?", (artifact_id,)).fetchone()
    conn.close()
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")
    if artifact["status"] in ["archived", "purged"]:
        raise HTTPException(status_code=410, detail="Artifact is archived or purged and no longer available for download")
        
    return PlainTextResponse(content=f"MOCK AUDIO BINARY CONTENT FOR {artifact['object_key']}", media_type=artifact["mime_type"], headers={
        "Content-Disposition": f"attachment; filename=export_{artifact_id}.wav"
    })

@app.get("/api/public/publish/{token}/download/{artifact_id}")
def api_download_public_artifact(token: str, artifact_id: int):
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    
    package = conn.execute("SELECT * FROM published_packages WHERE publish_token = ? AND is_revoked = 0", (token,)).fetchone()
    if not package:
        conn.close()
        raise HTTPException(status_code=403, detail="Invalid or revoked package link")
        
    if not package["allow_download"]:
        conn.close()
        raise HTTPException(status_code=403, detail="Downloads are disabled for this package")
        
    link = conn.execute("""
        SELECT a.* FROM package_exports pe
        JOIN export_jobs e ON pe.export_job_id = e.id
        JOIN stored_artifacts a ON e.artifact_id = a.id
        WHERE pe.package_id = ? AND a.id = ?
    """, (package["id"], artifact_id)).fetchone()
    
    conn.close()
    
    if not link:
        raise HTTPException(status_code=404, detail="Artifact not found in this package")
    if link["status"] in ["archived", "purged"]:
        raise HTTPException(status_code=410, detail="Artifact is archived or purged and no longer available for download")
        
    return PlainTextResponse(content=f"MOCK AUDIO BINARY CONTENT FOR {link['object_key']}", media_type=link["mime_type"], headers={
        "Content-Disposition": f"attachment; filename=export_{artifact_id}.wav"
    })

@app.post("/api/admin/retention/sweep")
def api_trigger_retention_sweep():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        now = time.time()
        
        # Sweep stored artifacts
        cursor.execute("""
            UPDATE stored_artifacts 
            SET status = 'archived'
            WHERE expires_at IS NOT NULL 
              AND expires_at < ? 
              AND status = 'active'
        """, (now,))
        artifacts_archived = cursor.rowcount
        
        # We could also sweep published_packages and revoke them if expires_at < now
        cursor.execute("""
            UPDATE published_packages
            SET is_revoked = 1
            WHERE expires_at IS NOT NULL
              AND expires_at < ?
              AND is_revoked = 0
        """, (now,))
        packages_expired = cursor.rowcount
        
        conn.commit()
        conn.close()
        
        return {
            "success": True, 
            "swept": {
                "artifacts_archived": artifacts_archived,
                "packages_expired": packages_expired
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/cloud/projects/{project_id}/health")
def api_get_project_health(project_id: int):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        
        now = time.time()
        seven_days_ago = now - (7 * 86400)
        thirty_days_ago = now - (30 * 86400)
        
        # 1. Tasks
        tasks = conn.execute("SELECT status, is_blocked FROM tasks WHERE project_id = ?", (project_id,)).fetchall()
        open_tasks = sum(1 for t in tasks if t["status"] in ["todo", "in_progress", "in_review"])
        completed_tasks = sum(1 for t in tasks if t["status"] == "done")
        blocked_tasks = sum(1 for t in tasks if t["is_blocked"])
        
        # 2. Approvals
        latest_version = conn.execute("SELECT id, version_number, approval_status FROM cloud_project_versions WHERE project_id = ? ORDER BY version_number DESC LIMIT 1", (project_id,)).fetchone()
        approval_state = latest_version["approval_status"] if latest_version else "none"
        
        # 3. Deliveries
        packages = conn.execute("SELECT id, is_revoked, expires_at, created_at FROM published_packages WHERE version_id IN (SELECT id FROM cloud_project_versions WHERE project_id = ?)", (project_id,)).fetchall()
        total_packages = len(packages)
        revoked_packages = sum(1 for p in packages if p["is_revoked"])
        expired_packages = sum(1 for p in packages if p["expires_at"] and p["expires_at"] < now)
        
        # Delivery Opens
        package_ids = [p["id"] for p in packages]
        opened_packages = 0
        if package_ids:
            placeholders = ",".join("?" * len(package_ids))
            opens = conn.execute(f"SELECT package_id FROM published_package_access_logs WHERE package_id IN ({placeholders}) AND event_type = 'opened' GROUP BY package_id", package_ids).fetchall()
            opened_packages = len(opens)
            
        unopened_packages = total_packages - opened_packages
        
        # 4. Exports
        exports = conn.execute("SELECT status FROM export_jobs WHERE project_id = ?", (project_id,)).fetchall()
        total_exports = len(exports)
        failed_exports = sum(1 for e in exports if e["status"] == "failed")
        running_exports = sum(1 for e in exports if e["status"] in ["running", "queued"])
        
        expiring_exports = conn.execute("""
            SELECT count(*) as cnt FROM stored_artifacts 
            WHERE project_id = ? AND status = 'active' AND expires_at IS NOT NULL AND expires_at < ?
        """, (project_id, now + (7 * 86400))).fetchone()["cnt"]
        
        # 5. Activity Window
        recent_activity_count = conn.execute("SELECT count(*) as cnt FROM activity_events WHERE project_id = ? AND created_at > ?", (project_id, seven_days_ago)).fetchone()["cnt"]
        
        conn.close()
        
        # Alert Heuristics
        alerts = []
        if blocked_tasks > 0:
            alerts.append({"type": "blocked_tasks", "message": f"{blocked_tasks} tasks are currently blocked", "severity": "high"})
        if unopened_packages > 0:
            alerts.append({"type": "unopened_packages", "message": f"{unopened_packages} published packages have never been opened", "severity": "medium"})
        if expiring_exports > 0:
            alerts.append({"type": "expiring_exports", "message": f"{expiring_exports} exports will expire within 7 days", "severity": "low"})
        if latest_version and approval_state == "in_review":
            alerts.append({"type": "pending_approval", "message": f"Version {latest_version['version_number']} is waiting for approval", "severity": "medium"})

        return {
            "success": True,
            "health": {
                "tasks": {
                    "open": open_tasks,
                    "completed": completed_tasks,
                    "blocked": blocked_tasks,
                    "total": len(tasks)
                },
                "approvals": {
                    "current_state": approval_state,
                    "latest_version_id": latest_version["id"] if latest_version else None
                },
                "deliveries": {
                    "total": total_packages,
                    "revoked": revoked_packages,
                    "expired": expired_packages,
                    "opened": opened_packages,
                    "unopened": unopened_packages
                },
                "exports": {
                    "total": total_exports,
                    "failed": failed_exports,
                    "running": running_exports,
                    "expiring_soon": expiring_exports
                },
                "activity_window": {
                    "recent_events_7d": recent_activity_count
                },
                "alert_heuristics": alerts
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
