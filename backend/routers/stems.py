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

router = APIRouter()

@router.post("/api/stems/extract")
async def extract_stems(req: StemExtractRequest):
    if not req.youtube_url:
        raise HTTPException(status_code=400, detail="YouTube URL required")
    
    job_id = str(uuid.uuid4())
    create_job(job_id, "extract_stems", {"youtube_url": req.youtube_url})
    await app.state.arq_pool.enqueue_job('task_extract_stems', job_id, req.youtube_url)
    
    return {"success": True, "status": "queued", "job_id": job_id, "youtube_url": req.youtube_url}

@router.get("/api/stems/status")
def get_stem_status(youtube_url: str):
    if not youtube_url:
        raise HTTPException(status_code=400, detail="youtube_url parameter required")
        
    track = get_track_metadata(youtube_url)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
        
    return {
        "success": True, 
        "stem_status": track.get("stem_status", "NOT_GENERATED"),
        "vocals_path": track.get("vocals_path"),
        "drums_path": track.get("drums_path"),
        "bass_path": track.get("bass_path"),
        "other_path": track.get("other_path")
    }

