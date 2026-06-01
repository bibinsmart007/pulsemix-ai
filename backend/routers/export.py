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

@router.get("/api/projects/export/{playlist_id}")
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

@router.post("/api/export")
async def create_export(req: ExportRequest):
    items = get_playlist_items(req.playlist_id)
    if not items:
        raise HTTPException(status_code=400, detail="Cannot export an empty playlist")
    
    has_valid_url = any(item.get('youtube_url') for item in items)
    if not has_valid_url:
        raise HTTPException(status_code=400, detail="Playlist contains no valid or resolvable tracks to export")
        
    job_id = f"{uuid.uuid4()}"
    settings = {"source": "playlist", "master_bus_mode": req.master_bus_mode, "export_name": req.export_name, "auto_phrase_snap": req.auto_phrase_snap}
    create_job(job_id, "create_export", settings)
    create_export_job(job_id, req.playlist_id, json.dumps(settings))
    
    await app.state.arq_pool.enqueue_job('task_create_export', job_id, req.playlist_id, req.export_name, req.master_bus_mode, req.auto_phrase_snap)
    
    return {"success": True, "job_id": job_id}
@router.get("/api/export")
def get_all_export_jobs():
    exports = get_all_exports()
    from backend.storage import get_storage
    storage = get_storage()
    for e in exports:
        if e.get("file_path") and not str(e["file_path"]).startswith("http") and not str(e["file_path"]).startswith("/exports/"):
            e["file_path"] = storage.generate_access_url(e["file_path"])
    # Limit to max 10
    return {"success": True, "jobs": exports[:10]}

@router.get("/api/export/latest")
def get_latest_export():
    exports = get_all_exports()
    if not exports:
        return {"success": True, "job": None}
    
    from backend.storage import get_storage
    storage = get_storage()
    job = exports[0]
    if job.get("file_path") and not str(job["file_path"]).startswith("http") and not str(job["file_path"]).startswith("/exports/"):
        job["file_path"] = storage.generate_access_url(job["file_path"])
        
    return {"success": True, "job": job}

@router.get("/api/export/{job_id}")
def get_export_status(job_id: str):
    job = get_export_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Export job not found")
        
    from backend.storage import get_storage
    storage = get_storage()
    if job.get("file_path") and not str(job["file_path"]).startswith("http") and not str(job["file_path"]).startswith("/exports/"):
        job["file_path"] = storage.generate_access_url(job["file_path"])
        
    return {"success": True, "job": job}

