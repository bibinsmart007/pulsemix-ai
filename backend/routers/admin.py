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

from backend.routers.auth import get_current_user
from fastapi import Depends
router = APIRouter(dependencies=[Depends(get_current_user)])

@router.get("/api/status/{job_id}")
def get_job_status(job_id: str):
    """Polling endpoint for track import status."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    # For backwards compatibility with frontend expecting track inside job directly
    if job.get("result_key") and job.get("status") in ("completed", "ready", "from_cache"):
        from backend.storage import get_storage
        url = get_storage().generate_access_url(job["result_key"])
        job["track"] = {"filepath": url}
    return job

class ExportRequest(BaseModel):
    playlist_id: int
    master_bus_mode: Optional[str] = "Balanced"
    export_name: Optional[str] = "Export"
    auto_phrase_snap: Optional[bool] = True

@router.get("/api/admin/jobs")
def api_admin_jobs():
    """Admin endpoint to inspect all ARQ-backed jobs in SQLite."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs ORDER BY updated_at DESC LIMIT 100")
    jobs_list = [dict(row) for row in cursor.fetchall()]
    conn.close()
    for j in jobs_list:
        if j.get("payload_json"):
            import json
            try:
                j["payload"] = json.loads(j["payload_json"])
            except:
                pass
    return {"success": True, "jobs": jobs_list}

@router.get("/api/inventory")
def get_inventory():
    """
    List all pre-curated high-fidelity demonstration tracks.
    """
    tracks = get_all_tracks()
    from backend.storage import get_storage
    storage = get_storage()
    for t in tracks:
        if t.get("filepath") and not str(t["filepath"]).startswith("http") and not str(t["filepath"]).startswith("/downloads/"):
            t["url"] = storage.generate_access_url(t["filepath"])
            
    return {
        "count": len(tracks),
        "tracks": tracks
    }

@router.post("/api/admin/retention/sweep")
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

