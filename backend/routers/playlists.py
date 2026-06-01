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

@router.post("/api/playlists/{playlist_id}/takes")
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

@router.get("/api/playlists/{playlist_id}/takes")
def api_get_takes(playlist_id: int):
    try:
        return {"success": True, "takes": takes_db.get(playlist_id, [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/playlists")
def api_create_playlist(req: PlaylistCreate):
    try:
        pid = create_playlist(req.name)
        return {"success": True, "id": pid, "name": req.name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/playlists")
def api_get_playlists():
    try:
        return {"success": True, "playlists": get_playlists()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/playlists/{playlist_id}/items")
def api_add_item_to_playlist(playlist_id: int, req: PlaylistItemAdd):
    try:
        item_id = add_item_to_playlist(playlist_id, req.youtube_url, req.position_index)
        return {"success": True, "item_id": item_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class AutoBuildRequest(BaseModel):
    steps: int = 3

@router.post("/api/playlists/{playlist_id}/autobuild")
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

from backend.timing import resolve_snapped_boundaries

@router.get("/api/playlists/{playlist_id}/items")
def api_get_playlist_items(playlist_id: int, auto_phrase_snap: bool = True):
    try:
        items = get_playlist_items(playlist_id)
        resolved_items = [resolve_snapped_boundaries(item, auto_phrase_snap) for item in items]
        from backend.storage import get_storage
        storage = get_storage()
        for item in resolved_items:
            if item.get("filepath") and not item["filepath"].startswith("http") and not item["filepath"].startswith("/downloads/"):
                item["url"] = storage.generate_access_url(item["filepath"])
        return {"success": True, "items": resolved_items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def is_harmonically_compatible(key1: str, key2: str) -> bool:
    if not key1 or not key2: return False
    if key1 == key2: return True
    try:
        num1, letter1 = int(key1[:-1]), key1[-1]
        num2, letter2 = int(key2[:-1]), key2[-1]
        if num1 == num2 and letter1 != letter2: return True
        if letter1 == letter2 and (abs(num1 - num2) == 1 or abs(num1 - num2) == 11): return True
    except:
        pass
    return False

@router.get("/api/playlists/{playlist_id}/transition-suggestions")
def api_get_transition_suggestions(playlist_id: int):
    try:
        items = get_playlist_items(playlist_id)
        suggestions = {}
        for i in range(1, len(items)):
            outgoing = items[i-1]
            incoming = items[i]
            
            bpm_out = outgoing.get("bpm") or 120
            bpm_in = incoming.get("bpm") or 120
            bpm_diff = abs(bpm_out - bpm_in)
            
            key_out = outgoing.get("key_camelot")
            key_in = incoming.get("key_camelot")
            compatible_key = is_harmonically_compatible(key_out, key_in)
            
            # Phrase detection
            import json
            phrases_out = []
            phrases_in = []
            try:
                if outgoing.get("phrase_markers"): phrases_out = json.loads(outgoing["phrase_markers"])
                if incoming.get("phrase_markers"): phrases_in = json.loads(incoming["phrase_markers"])
            except:
                pass
                
            entry_window_start = phrases_in[1] if len(phrases_in) > 1 else 0
            exit_window_start = phrases_out[-2] if len(phrases_out) > 1 else (outgoing.get("duration", 0) - 30)
            
            timing_note = "Timing alignment unavailable; using BPM/key only."
            if phrases_out and phrases_in:
                timing_note = "Aligned to outgoing phrase end and incoming phrase start."
            
            # Simple heuristics
            if bpm_diff > 10:
                suggestions[incoming["item_id"]] = {
                    "crossfade_duration_ms": 1000,
                    "fade_curve": "linear",
                    "eq_mode": "soft_exit",
                    "warning": "High BPM Contrast",
                    "reason": f"Suggested soft_exit: {int(bpm_diff)} BPM jump may clash in a longer blend. {timing_note}",
                    "entry_window_start": entry_window_start,
                    "exit_window_start": exit_window_start
                }
            elif bpm_diff > 5:
                suggestions[incoming["item_id"]] = {
                    "crossfade_duration_ms": 2000,
                    "fade_curve": "equal_power",
                    "eq_mode": "bass_swap",
                    "warning": "Moderate BPM Contrast",
                    "reason": f"Suggested bass_swap: {int(bpm_diff)} BPM jump. Keep transition tight. {timing_note}",
                    "entry_window_start": entry_window_start,
                    "exit_window_start": exit_window_start
                }
            else:
                if compatible_key:
                    suggestions[incoming["item_id"]] = {
                        "crossfade_duration_ms": 8000,
                        "fade_curve": "equal_power",
                        "eq_mode": "bass_swap",
                        "warning": None,
                        "reason": f"Suggested bass_swap (8s): Harmonically compatible ({key_out} -> {key_in}), allowing a long mix. {timing_note}",
                        "entry_window_start": entry_window_start,
                        "exit_window_start": exit_window_start
                    }
                else:
                    suggestions[incoming["item_id"]] = {
                        "crossfade_duration_ms": 4000,
                        "fade_curve": "equal_power",
                        "eq_mode": "vocal_protect",
                        "warning": "Key Clash Possible",
                        "reason": f"Suggested vocal_protect (4s): Keys may clash ({key_out} vs {key_in}). Protects vocal clarity. {timing_note}",
                        "entry_window_start": entry_window_start,
                        "exit_window_start": exit_window_start
                    }
                    
        return {"success": True, "suggestions": suggestions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/playlists/{playlist_id}/set-analysis")
def api_get_set_analysis(playlist_id: int):
    try:
        items = get_playlist_items(playlist_id)
        if not items:
            return {"success": True, "issues": [], "current_curve": [], "recommended_curve": [], "recommended_order": []}
            
        def estimate_energy(bpm):
            if not bpm: bpm = 120
            energy = ((bpm - 90) / 70.0) * 9.0 + 1.0
            return max(1.0, min(10.0, energy))

        current_curve = []
        for item in items:
            energy = round(estimate_energy(item.get("bpm")), 1)
            current_curve.append({"item_id": item["item_id"], "title": item["title"], "energy": energy})

        issues = []
        # Abrupt drops
        for i in range(1, len(current_curve)):
            drop = current_curve[i-1]["energy"] - current_curve[i]["energy"]
            if drop >= 3.0:
                issues.append({
                    "type": "abrupt_drop",
                    "reason": f"Track {i+1} ('{current_curve[i]['title']}') drops energy from {current_curve[i-1]['energy']} to {current_curve[i]['energy']} too abruptly."
                })
        
        # Harmonic Clashes
        for i in range(1, len(items)):
            key_out = items[i-1].get("key_camelot")
            key_in = items[i].get("key_camelot")
            if key_out and key_in and not is_harmonically_compatible(key_out, key_in):
                issues.append({
                    "type": "harmonic_clash",
                    "reason": f"Track {i} ('{items[i-1].get('title')}') and Track {i+1} ('{items[i].get('title')}') have incompatible keys ({key_out} -> {key_in})."
                })

        # Early Peak
        if len(current_curve) > 3:
            max_energy = max([c["energy"] for c in current_curve])
            max_idx = [i for i, c in enumerate(current_curve) if c["energy"] == max_energy][0]
            if max_idx < len(current_curve) * 0.25:
                issues.append({
                    "type": "early_peak",
                    "reason": f"Highest-energy track ('{current_curve[max_idx]['title']}') appears too early in the set."
                })
                
        # Repeated Plateaus
        plateau_count = 1
        for i in range(1, len(current_curve)):
            if abs(current_curve[i]["energy"] - current_curve[i-1]["energy"]) < 0.5:
                plateau_count += 1
            else:
                plateau_count = 1
            
            if plateau_count == 3:
                issues.append({
                    "type": "repeated_plateau",
                    "reason": f"Tracks {i-1}, {i}, and {i+1} form a static energy plateau that might stall momentum."
                })
                # only report once to avoid spamming
                break
        
        # Recommended order (sort by energy ascending for a steady build)
        sorted_items = sorted(items, key=lambda x: estimate_energy(x.get("bpm")))
        recommended_order = [item["item_id"] for item in sorted_items]
        
        recommended_curve = []
        for item in sorted_items:
            energy = round(estimate_energy(item.get("bpm")), 1)
            recommended_curve.append({"item_id": item["item_id"], "title": item["title"], "energy": energy})

        return {
            "success": True, 
            "issues": issues, 
            "current_curve": current_curve, 
            "recommended_curve": recommended_curve, 
            "recommended_order": recommended_order
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ImportedPlaylistItem(BaseModel):
    youtube_url: str
    position_index: int
    trim_start_ms: Optional[float] = None
    trim_end_ms: Optional[float] = None
    crossfade_duration_ms: Optional[float] = None
    gain_db: Optional[float] = None
    eq_mode: Optional[str] = None
    transition_preset: Optional[str] = None
    is_snapped: Optional[bool] = None
    phrase_snap_override: Optional[str] = None
    fade_curve: Optional[str] = None
    transition_type: Optional[str] = None
    duck_amount_db: Optional[float] = None

class ImportedProjectData(BaseModel):
    schema_version: str
    playlist_name: Optional[str] = None
    items: List[ImportedPlaylistItem]
    takes: Optional[List[Dict[str, Any]]] = None

class ProjectImportRequest(BaseModel):
    project_data: ImportedProjectData

class SnapshotRequest(BaseModel):
    name: str
    source_type: str = 'manual'
    reason: str = None

@router.post("/api/playlists/{playlist_id}/snapshots")
def api_create_snapshot(playlist_id: int, req: SnapshotRequest):
    try:
        items = get_playlist_items(playlist_id)
        data = json.dumps(items)
        snapshot_id = save_snapshot(playlist_id, req.name, data, req.source_type, req.reason)
        return {"success": True, "snapshot_id": snapshot_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/playlists/{playlist_id}/snapshots")
def api_get_snapshots(playlist_id: int):
    try:
        snapshots = get_snapshots(playlist_id)
        return {"success": True, "snapshots": snapshots}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/playlists/{playlist_id}/snapshots/{snapshot_id}/restore")
def api_restore_snapshot(playlist_id: int, snapshot_id: int):
    try:
        snapshot = get_snapshot(snapshot_id)
        if not snapshot or snapshot["playlist_id"] != playlist_id:
            raise HTTPException(status_code=404, detail="Snapshot not found")
        
        items = json.loads(snapshot["data"])
        
        # Clear existing items
        clear_playlist_items(playlist_id)
        
        # Restore items
        for i, item in enumerate(items):
            add_item_to_playlist(playlist_id, item["youtube_url"], i)
            # update transition settings
            update_playlist_item(item["item_id"], {
                "trim_start_ms": item.get("trim_start_ms", 0),
                "trim_end_ms": item.get("trim_end_ms", 0),
                "crossfade_duration_ms": item.get("crossfade_duration_ms", 2000),
                "fade_curve": item.get("fade_curve", "linear"),
                "eq_mode": item.get("eq_mode", "none"),
                "duck_amount_db": item.get("duck_amount_db", 0.0),
                "transition_type": item.get("transition_type", "crossfade"),
                "is_snapped": item.get("is_snapped", False),
                "sync_mode": item.get("sync_mode", "auto")
            })
            
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/playlists/import")
@router.put("/api/playlist-items/{item_id}")
def api_update_playlist_item(item_id: int, req: PlaylistItemUpdate):
    try:
        updates = {k: v for k, v in req.dict().items() if v is not None}
        update_playlist_item(item_id, updates)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ReorderRequest(BaseModel):
    item_ids: List[int]

@router.post("/api/playlists/{playlist_id}/items/reorder")
def api_reorder_playlist_items(playlist_id: int, req: ReorderRequest):
    try:
        for idx, item_id in enumerate(req.item_ids):
            update_playlist_item(item_id, {"position_index": idx})
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/api/playlist-items/{item_id}")
def api_delete_playlist_item(item_id: int):
    try:
        delete_playlist_item(item_id)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


