import os
import sys
import json
import sqlite3
from fastapi import FastAPI, APIRouter, UploadFile, File, BackgroundTasks, HTTPException, Header, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

# Add current dir to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.extractor import resolve_youtube_audio
from backend.analyzer import analyze_audio
from backend.ai_engine import generate_mix_timeline
from backend.database import (
    init_db, 
    get_db_connection, 
    get_track_metadata, 
    save_track_metadata, 
    get_all_tracks, 
    create_playlist, 
    get_playlists, 
    add_item_to_playlist, 
    update_playlist_item, 
    delete_playlist_item, 
    get_playlist_items, 
    save_snapshot,
    get_snapshots,
    get_snapshot,
    clear_playlist_items,
    create_export_job, 
    get_export_job, 
    get_all_exports, 
    log_activity_event, 
    get_activity_events, 
    log_audit_event, 
    get_audit_logs, 
    get_ai_sessions, 
    get_ai_session, 
    create_or_update_ai_session, 
    apply_ai_session, 
    duplicate_ai_session, 
    rate_ai_session
)
from backend.stem_extractor import run_stem_extraction
import uuid
import time
import threading
from backend.exporter import process_export_job, apply_custom_crossfade, apply_time_stretch
from backend.recommender import score_candidates, build_set_plan
from pydub import AudioSegment
import re

from arq import create_pool
from arq.connections import RedisSettings
from backend.jobs import create_job, get_job, update_job

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
from backend.synthesizer import generate_preset_library
try:
    if not os.path.exists(os.path.join(MUSIC_DIR, "lofi_raindrops.mp3")):
        generate_preset_library(MUSIC_DIR)
except Exception as e:
    print(f"[Backend] Failed to run preset loop synthesizer: {e}")

# Initialize SQLite metadata database
@app.on_event("startup")
async def startup_event():
    init_db()
    REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
    REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))
    app.state.arq_pool = await create_pool(RedisSettings(host=REDIS_HOST, port=REDIS_PORT))

@app.on_event("shutdown")
async def shutdown_event():
    if hasattr(app.state, 'arq_pool'):
        await app.state.arq_pool.close()

# In-memory Job Queue for Background Processing (Deprecated, keeping for legacy compatibility if any)
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

def process_audio_job(job_id: str, url: str, force_reanalyze: bool = False):
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
        # Phase 53: Also require key_camelot to be present
        is_real_cache = (
            not force_reanalyze 
            and cached_metadata 
            and cached_metadata.get('analysis_status') == 'completed'
            and cached_metadata.get('key_camelot') is not None
        )
        
        if is_real_cache:
            print(f"[Backend] Cache hit for {url}. Skipping librosa analysis.")
            extraction["bpm"] = cached_metadata["bpm"]
            extraction["bpm_confidence"] = cached_metadata.get("bpm_confidence", 0.0)
            extraction["key"] = cached_metadata["key_signature"]
            extraction["key_camelot"] = cached_metadata.get("key_camelot")
            extraction["key_confidence"] = cached_metadata.get("key_confidence", 0.0)
            extraction["analysis_status"] = "completed"
            extraction["raw_bpm"] = cached_metadata.get("raw_bpm")
        elif extraction["id"].startswith("mock_"):
            import json
            import random
            duration = extraction["duration"]
            key = random.choice(["8A", "9A", "10A", "11A", "12A", "1A", "2A", "3A", "4A", "5A", "6A", "7A"])
            
            if "low_conf" in extraction["id"]:
                beatgrid = [0.5, 1.0, 1.5, 2.0]
                phrase_markers = []
                downbeat_confidence = 0.1
                status = "low_confidence"
            else:
                beatgrid = [0.5 + i*0.5 for i in range(60)]
                phrase_markers = [0.5, 16.5]
                downbeat_confidence = 0.85
                status = "completed"
            
            analysis = {
                "bpm": extraction["bpm"],
                "raw_bpm": extraction["bpm"],
                "key": extraction["key"],
                "key_camelot": extraction["key"],
                "key_confidence": 0.9,
                "waveform_data": "[]",
                "beatgrid": json.dumps(beatgrid),
                "phrase_markers": json.dumps(phrase_markers),
                "downbeat_confidence": downbeat_confidence
            }
            extraction["bpm_confidence"] = 0.9
            extraction["key_camelot"] = extraction["key"]
            extraction["key_confidence"] = 0.9
            extraction["analysis_status"] = status
            
            save_track_metadata(
                youtube_url=url,
                title=extraction["title"],
                bpm=extraction["bpm"],
                bpm_confidence=extraction["bpm_confidence"],
                key_signature=extraction["key"],
                key_camelot=extraction["key_camelot"],
                key_confidence=extraction["key_confidence"],
                duration=extraction["duration"],
                genre=extraction.get("genre", "Imported"),
                url=extraction["url"],
                filepath=extraction["filepath"],
                waveform_data=analysis.get("waveform_data", "[]"),
                analysis_status=status,
                raw_bpm=extraction.get("raw_bpm"),
                beatgrid=analysis.get("beatgrid", "[]"),
                phrase_markers=analysis.get("phrase_markers", "[]"),
                downbeat_confidence=analysis.get("downbeat_confidence", 0.0)
            )
        else:
            analysis = analyze_audio(extraction["filepath"])
            extraction["bpm"] = analysis["bpm"]
            extraction["raw_bpm"] = analysis.get("raw_bpm")
            extraction["bpm_confidence"] = analysis.get("bpm_confidence", 0.0)
            extraction["key"] = analysis["key"]
            extraction["key_camelot"] = analysis.get("key_camelot")
            extraction["key_confidence"] = analysis.get("key_confidence", 0.0)
            
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
                key_camelot=extraction["key_camelot"],
                key_confidence=extraction["key_confidence"],
                duration=extraction["duration"],
                genre=extraction.get("genre", "Imported"),
                url=extraction["url"],
                filepath=extraction["filepath"],
                waveform_data=analysis.get("waveform_data", "[]"),
                analysis_status=status,
                raw_bpm=extraction["raw_bpm"],
                beatgrid=analysis.get("beatgrid", "[]"),
                phrase_markers=analysis.get("phrase_markers", "[]"),
                downbeat_confidence=analysis.get("downbeat_confidence", 0.0)
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
        import traceback
        traceback.print_exc()
        error_str = str(e).lower()
        if "timeout" in error_str or "timed out" in error_str:
            jobs[job_id]["status"] = "timed_out"
        else:
            jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)


@app.get("/api/library")
def get_library():
    """Endpoint to retrieve historically analyzed tracks from SQLite."""
    try:
        tracks = get_all_tracks()
        from backend.storage import get_storage
        storage = get_storage()
        for t in tracks:
            if t.get("filepath") and not t["filepath"].startswith("http") and not t["filepath"].startswith("/downloads/"):
                t["url"] = storage.generate_access_url(t["filepath"])
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
    fade_curve: Optional[str] = None
    gain_db: Optional[float] = None
    eq_mode: Optional[str] = None
    phrase_snap_override: Optional[str] = None

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



# Include Routers
from backend.routers.cloud import router as cloud_router
app.include_router(cloud_router)
from backend.routers.playlists import router as playlists_router
app.include_router(playlists_router)
from backend.routers.export import router as export_router
app.include_router(export_router)
from backend.routers.admin import router as admin_router
app.include_router(admin_router)
from backend.routers.ai import router as ai_router
app.include_router(ai_router)
from backend.routers.importing import router as importing_router
app.include_router(importing_router)
from backend.routers.stems import router as stems_router
app.include_router(stems_router)
from backend.routers.auth import router as auth_router
app.include_router(auth_router)
