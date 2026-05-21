import os
import sys
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add current dir to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from extractor import resolve_youtube_audio, MOCK_TRACKS
from analyzer import analyze_audio

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

# Generate synthetic high-fidelity preset loop files if not present
from synthesizer import generate_preset_library
try:
    if not os.path.exists(os.path.join(MUSIC_DIR, "lofi_raindrops.mp3")):
        generate_preset_library(MUSIC_DIR)
except Exception as e:
    print(f"[Backend] Failed to run preset loop synthesizer: {e}")

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
        jobs[job_id]["status"] = "downloading"
        extraction = resolve_youtube_audio(url, DOWNLOADS_DIR)
        
        jobs[job_id]["status"] = "analyzing"
        if not extraction["id"].startswith("mock_"):
            analysis = analyze_audio(extraction["filepath"])
            extraction["bpm"] = analysis["bpm"]
            extraction["key"] = analysis["key"]
            
        jobs[job_id]["status"] = "completed"
        jobs[job_id]["track"] = {
            "id": extraction["id"],
            "title": extraction["title"],
            "duration": extraction["duration"],
            "thumbnail": extraction["thumbnail"],
            "url": extraction["url"],
            "bpm": extraction["bpm"],
            "key": extraction["key"],
            "genre": extraction.get("genre", "Imported")
        }
    except Exception as e:
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
        
    print(f"[Backend] Received async import request for URL: {req.url}")
    
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "pending"}
    
    bg_tasks.add_task(process_audio_job, job_id, req.url)
    
    return {
        "success": True,
        "job_id": job_id,
        "status": "pending"
    }

@app.get("/api/status/{job_id}")
def get_job_status(job_id: str):
    """Polling endpoint for track import status."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]

@app.get("/api/inventory")
def get_inventory():
    """
    List all pre-curated high-fidelity demonstration tracks.
    """
    # Verify if static files are created or just return inventory metadata
    return {
        "count": len(MOCK_TRACKS),
        "tracks": MOCK_TRACKS
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
    
    for track in MOCK_TRACKS:
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
