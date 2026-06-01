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

@router.get("/api/recommendations")
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

@router.get("/api/recommend")
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

@router.post("/api/ai/generate")
def api_ai_generate(req: AIGenerateRequest):
    try:
        result = generate_mix_timeline(req.prompt, req.tracks)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8765)
# ==========================================
# Phase 35: AI Sessions
# ==========================================
class AISessionCreate(BaseModel):
    session_id: Optional[int] = None
    prompt: str
    input_tracks: list
    variations: list
    selected_variation_index: int = 0

class AIApplyRequest(BaseModel):
    project_id: Optional[int] = None
    version_id: Optional[int] = None

@router.get("/api/ai/sessions")
def api_get_ai_sessions(limit: int = 50):
    try:
        sessions = get_ai_sessions(limit)
        return {"success": True, "sessions": sessions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/ai/sessions/compare")
def api_compare_ai_sessions(id1: int, id2: int):
    try:
        session1 = get_ai_session(id1)
        session2 = get_ai_session(id2)
        if not session1 or not session2:
            raise HTTPException(status_code=404, detail="One or both sessions not found")
            
        # Basic diff computed on backend
        diff = {
            "prompt_changed": session1["prompt"] != session2["prompt"],
            "selected_variation_changed": session1["selected_variation_index"] != session2["selected_variation_index"]
        }
        
        return {"success": True, "session1": session1, "session2": session2, "diff": diff}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/ai/sessions/{session_id}")
def api_get_ai_session(session_id: int):
    try:
        session = get_ai_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return {"success": True, "session": session}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/ai/sessions")
def api_save_ai_session(req: AISessionCreate):
    try:
        new_id = create_or_update_ai_session(req.session_id, req.prompt, req.input_tracks, req.variations, req.selected_variation_index)
        if not new_id:
            raise Exception("Failed to save AI session")
        return {"success": True, "session_id": new_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/ai/sessions/{session_id}/duplicate")
def api_duplicate_ai_session(session_id: int):
    try:
        new_id = duplicate_ai_session(session_id)
        if not new_id:
            raise Exception("Failed to duplicate AI session")
        return {"success": True, "session_id": new_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/api/ai/sessions/{session_id}/apply")
def api_apply_ai_session(session_id: int, req: AIApplyRequest):
    try:
        success = apply_ai_session(session_id, req.project_id, req.version_id)
        return {"success": success}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class AIRateRequest(BaseModel):
    rating: str

@router.put("/api/ai/sessions/{session_id}/rate")
def api_rate_ai_session(session_id: int, req: AIRateRequest):
    try:
        success = rate_ai_session(session_id, req.rating)
        return {"success": success}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
