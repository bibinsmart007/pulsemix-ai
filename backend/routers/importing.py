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

@router.post("/api/import")
async def import_track(req: ImportRequest):
    """
    Endpoint to trigger async download and analysis of a YouTube track.
    Returns a job_id instantly for the client to poll.
    """
    if not req.url or len(req.url.strip()) == 0:
        raise HTTPException(status_code=400, detail="YouTube URL cannot be empty")
        
    # Validation: basic YouTube URL regex check
    if req.url != "mock_test_url" and not re.match(r'^(https?://)?(www\.)?(youtube\.com|youtu\.?be|mock\.youtube\.com)/.+$', req.url):
        raise HTTPException(status_code=400, detail="Invalid YouTube URL format")
        
    print(f"[Backend] Received async import request for URL: {req.url}")
    
    job_id = str(uuid.uuid4())
    create_job(job_id, "import_track", {"url": req.url})
    
    await app.state.arq_pool.enqueue_job('task_import_track', job_id, req.url)
    
    return {
        "success": True,
        "job_id": job_id,
        "status": "queued"
    }

class StemExtractRequest(BaseModel):
    youtube_url: str

@router.post("/api/projects/import")
def api_import_project(req: ProjectImportRequest):
    try:
        data = req.project_data
        if data.schema_version != "1.0":
            raise HTTPException(status_code=400, detail="Unsupported schema_version")
            
        # Semantic validation pass
        seen_positions = set()
        for item in data.items:
            if item.position_index in seen_positions:
                raise HTTPException(status_code=400, detail=f"Duplicate position_index: {item.position_index}")
            seen_positions.add(item.position_index)
            
            if item.trim_start_ms is not None and item.trim_start_ms < 0:
                raise HTTPException(status_code=400, detail="trim_start_ms cannot be negative")
            if item.trim_end_ms is not None and item.trim_end_ms < 0:
                raise HTTPException(status_code=400, detail="trim_end_ms cannot be negative")
            if item.trim_start_ms is not None and item.trim_end_ms is not None:
                if item.trim_end_ms < item.trim_start_ms:
                    raise HTTPException(status_code=400, detail="trim_end_ms cannot be less than trim_start_ms")

        # Database Transaction
        conn = get_db_connection()
        try:
            # 1. Create new playlist
            new_name = f"{data.playlist_name or 'Imported Session'} (Imported)"
            new_pid = create_playlist(new_name, conn=conn)
            
            # 2. Add items
            for item in data.items:
                item_id = add_item_to_playlist(new_pid, item.youtube_url, item.position_index, conn=conn)
                # Update DSP metadata
                updates = {
                    "trim_start_ms": item.trim_start_ms,
                    "trim_end_ms": item.trim_end_ms,
                    "crossfade_duration_ms": item.crossfade_duration_ms,
                    "gain_db": item.gain_db,
                    "eq_mode": item.eq_mode,
                    "transition_preset": item.transition_preset,
                    "is_snapped": item.is_snapped,
                    "phrase_snap_override": item.phrase_snap_override,
                    "fade_curve": item.fade_curve,
                    "transition_type": item.transition_type,
                    "duck_amount_db": item.duck_amount_db
                }
                # Remove Nones
                updates = {k: v for k, v in updates.items() if v is not None}
                if updates:
                    update_playlist_item(item_id, updates, conn=conn)
                    
            # 3. Add takes
            if data.takes:
                takes_db[new_pid] = data.takes

            conn.commit()
            return {"success": True, "new_playlist_id": new_pid}
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=400, detail=str(e))
        finally:
            conn.close()

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/tracks/recover/auto")
def api_recover_track_auto(req: ImportRequest, bg_tasks: BackgroundTasks):
    """Auto-recover a ghost track by redownloading it from YouTube."""
    if not req.url:
        raise HTTPException(status_code=400, detail="YouTube URL required")
        
    print(f"[Backend] Auto-recovering track: {req.url}")
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "queued", "progress": 0.0, "title": f"Recovering {req.url}"}
    
    # Mark as auto recovered in DB
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("UPDATE tracks SET relink_method = 'auto', relink_warning = NULL WHERE youtube_url = ?", (req.url,))
    conn.commit()
    conn.close()
    
    bg_tasks.add_task(process_audio_job, job_id, req.url, True)
    
    return {
        "success": True,
        "job_id": job_id,
        "status": "queued"
    }

@router.post("/api/tracks/recover/manual")
async def api_recover_track_manual(request: Request, bg_tasks: BackgroundTasks):
    """Manual recover a ghost track via file upload (binary body + headers)."""
    youtube_url = request.headers.get("x-youtube-url")
    filename = request.headers.get("x-filename", "recovered_audio.wav")
    if not youtube_url:
        raise HTTPException(status_code=400, detail="x-youtube-url header required")
        
    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="Empty request body")
        
    print(f"[Backend] Manual-recovering track: {youtube_url} with file {filename}")
    
    # Save the file to downloads
    safe_filename = "".join(c for c in filename if c.isalnum() or c in " ._-")
    file_id = str(uuid.uuid4())[:8]
    filepath = os.path.join(DOWNLOADS_DIR, f"manual_{file_id}_{safe_filename}")
    
    with open(filepath, "wb") as f:
        f.write(body)
        
    # We will process it synchronously or asynchronously? Async is better so it doesn't block.
    # We can write a quick custom job for manual file analysis.
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "queued", "progress": 0.0, "title": f"Analyzing {filename}"}
    
    def process_manual_file(j_id: str, y_url: str, f_path: str, orig_filename: str):
        try:
            jobs[j_id]["status"] = "analyzing"
            jobs[j_id]["progress"] = 50.0
            
            # Fetch original duration
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT duration FROM tracks WHERE youtube_url = ?", (y_url,))
            row = cursor.fetchone()
            orig_duration = row["duration"] if row else 0.0
            
            # Run librosa analysis
            analysis = analyze_audio(f_path)
            new_duration = analysis.get("duration", 0.0)
            
            warning = None
            if orig_duration > 0 and abs(new_duration - orig_duration) > 5.0:
                warning = f"Duration mismatch: Expected {orig_duration:.1f}s, got {new_duration:.1f}s"
                
            status = "completed"
            if analysis.get("bpm_confidence", 0.0) < 0.3 or not analysis.get("key"):
                status = "low_confidence"
                
            cursor.execute("""
                UPDATE tracks SET 
                    filepath = ?, 
                    waveform_data = ?, 
                    bpm = ?, 
                    bpm_confidence = ?, 
                    key_signature = ?, 
                    key_camelot = ?,
                    key_confidence = ?,
                    duration = ?, 
                    analysis_status = ?, 
                    raw_bpm = ?,
                    relink_method = 'manual',
                    relink_warning = ?
                WHERE youtube_url = ?
            """, (
                f_path,
                analysis.get("waveform_data", "[]"),
                analysis.get("bpm"),
                analysis.get("bpm_confidence", 0.0),
                analysis.get("key"),
                analysis.get("key_camelot"),
                analysis.get("key_confidence", 0.0),
                new_duration if new_duration > 0 else orig_duration,
                status,
                analysis.get("raw_bpm"),
                warning,
                y_url
            ))
            conn.commit()
            conn.close()
            
            jobs[j_id]["status"] = "ready"
            jobs[j_id]["progress"] = 100.0
            jobs[j_id]["track"] = {
                "id": y_url,
                "relink_warning": warning
            }
        except Exception as e:
            print(f"[Backend Error] Manual file processing failed: {e}")
            jobs[j_id]["status"] = "failed"
            jobs[j_id]["error"] = str(e)
            
    bg_tasks.add_task(process_manual_file, job_id, youtube_url, filepath, filename)
    
    return {
        "success": True,
        "job_id": job_id,
        "status": "queued"
    }

async def api_import_playlist(request: Request, bg_tasks: BackgroundTasks):
    try:
        content_type = request.headers.get("content-type", "")
        body = await request.body()
        
        manifest_data = None
        if "application/zip" in content_type:
            import zipfile
            import io
            with zipfile.ZipFile(io.BytesIO(body), "r") as z:
                if "manifest.json" in z.namelist():
                    manifest_data = json.loads(z.read("manifest.json").decode("utf-8"))
        elif "application/json" in content_type:
            manifest_data = json.loads(body.decode("utf-8"))
            
        if not manifest_data:
            raise HTTPException(status_code=400, detail="Invalid package format. No manifest.json found.")
            
        items = manifest_data.get("items", [])
        transitions_applied = manifest_data.get("transitions_applied", [])
        original_name = manifest_data.get("playlist_name") or manifest_data.get("export_name") or "Imported Project"
        
        # Create new playlist
        new_pid = create_playlist(f"{original_name} (Imported)")
        
        warnings = []
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        for idx, item in enumerate(items):
            url = item.get("youtube_url")
            
            # Check if track exists
            cursor.execute("SELECT * FROM tracks WHERE youtube_url = ?", (url,))
            row = cursor.fetchone()
            
            is_missing = False
            if not row or not row["filepath"] or not os.path.exists(row["filepath"]):
                is_missing = True
                warnings.append({
                    "type": "media_missing", 
                    "title": item.get("title", url),
                    "youtube_url": url
                })
                # Create ghost track if not in DB at all
                if not row:
                    cursor.execute("""
                        INSERT OR IGNORE INTO tracks (youtube_url, title, bpm, key_signature, duration, genre, url, filepath, analysis_version, waveform_data, analysis_status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        url, 
                        item.get("title", "Unknown Track"),
                        item.get("bpm", 120.0),
                        item.get("key_signature", ""),
                        item.get("duration", 0.0),
                        item.get("genre", ""),
                        url,
                        "", # missing filepath
                        ANALYSIS_VERSION,
                        "[]",
                        "completed"
                    ))
            elif row and not row["key_camelot"]:
                # Phase 53: Automatically trigger background analysis for imported tracks missing Camelot key
                job_id = str(uuid.uuid4())
                jobs[job_id] = {"status": "queued", "progress": 0.0, "title": f"Upgrading metadata for {url}"}
                bg_tasks.add_task(process_audio_job, job_id, url, False)
            
            # Insert playlist item
            cursor.execute("""
                INSERT INTO playlist_items (playlist_id, youtube_url, position_index)
                VALUES (?, ?, ?)
            """, (new_pid, url, idx))
            new_item_id = cursor.lastrowid
            
            # Update item with restored trim & basic metadata
            updates = {
                "trim_start_ms": item.get("trim_start_ms", 0),
                "trim_end_ms": item.get("trim_end_ms", 0),
                "is_snapped": item.get("is_snapped", False),
                "transition_preset": item.get("transition_preset", "manual")
            }
            
            # Map transition data if available
            if idx < len(transitions_applied):
                t = transitions_applied[idx]
                updates["crossfade_duration_ms"] = t.get("duration_ms", 0)
                updates["fade_curve"] = t.get("curve", "linear")
                updates["eq_mode"] = t.get("eq_mode", "none")
                updates["duck_amount_db"] = t.get("duck_db", 0)
                if "sync_status" in t:
                    updates["sync_mode"] = "auto"
                else:
                    updates["sync_mode"] = "none"
                    
            update_playlist_item(new_item_id, updates)
            
        conn.commit()
        conn.close()
        
        return {
            "success": True, 
            "playlist_id": new_pid, 
            "warnings": warnings,
            "message": f"Imported successfully with {len(warnings)} missing assets." if warnings else "Imported successfully."
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class CloudProjectCreate(BaseModel):
    playlist_id: int
    project_data: Dict[str, Any]

class CloudVersionCreate(BaseModel):
    project_data: Dict[str, Any]

