import os
import sys
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add current dir to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from extractor import resolve_youtube_audio
from analyzer import analyze_audio
from database import init_db, get_track_metadata, save_track_metadata, get_all_tracks, create_playlist, get_playlists, add_item_to_playlist, update_playlist_item, delete_playlist_item, get_playlist_items, create_export_job, get_export_job, get_all_exports
from exporter import process_export_job, apply_custom_crossfade, apply_time_stretch
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

@app.post("/api/playlists/{playlist_id}/items")
def api_add_item_to_playlist(playlist_id: int, req: PlaylistItemAdd):
    try:
        item_id = add_item_to_playlist(playlist_id, req.youtube_url, req.position_index)
        return {"success": True, "item_id": item_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/playlists/{playlist_id}/items")
def api_get_playlist_items(playlist_id: int):
    try:
        return {"success": True, "items": get_playlist_items(playlist_id)}
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

@app.post("/api/export")
def create_export(req: ExportRequest, bg_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    create_export_job(job_id, req.playlist_id, '{"source": "playlist"}')
    bg_tasks.add_task(process_export_job, job_id, req.playlist_id, "Playlist")
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
