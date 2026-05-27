import os
import sys
import uuid
import subprocess
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="DJ Live Requests Microservice")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REQUESTS_DIR = os.path.join(WORKSPACE_DIR, "public", "music", "party_29may", "requests")
os.makedirs(REQUESTS_DIR, exist_ok=True)

class RequestURL(BaseModel):
    url: str

@app.post("/api/request")
def handle_request(req: RequestURL):
    if not req.url or "youtube.com" not in req.url and "youtu.be" not in req.url:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")
        
    print(f"[DJ Requests] Received request for {req.url}")
    
    video_id = str(uuid.uuid4())[:8]
    filename = f"req_{video_id}.webm"
    filepath = os.path.join(REQUESTS_DIR, filename)
    
    print(f"[DJ Requests] Resolving stream for: {req.url}")
    info_cmd = [
        "python", "-m", "yt_dlp",
        "-f", "bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio",
        "--print", "%(title)s\n%(url)s",
        "--no-playlist",
        req.url
    ]
    
    try:
        res = subprocess.run(info_cmd, check=True, capture_output=True, text=True)
        lines = res.stdout.strip().split("\n")
        title = lines[0]
        stream_url = lines[-1]
    except subprocess.CalledProcessError as e:
        print(f"[DJ Requests] Error resolving: {e.stderr}")
        raise HTTPException(status_code=500, detail=f"Failed to resolve: {e.stderr}")
        
    print(f"[DJ Requests] Downloading first 5MB of: {title}")
    
    import urllib.request
    http_req = urllib.request.Request(stream_url)
    http_req.add_header('Range', 'bytes=0-5000000') # 5MB is about 5 mins of audio
    try:
        with urllib.request.urlopen(http_req) as response, open(filepath, 'wb') as out_file:
            out_file.write(response.read())
    except Exception as e:
        print(f"[DJ Requests] Error downloading partial: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to download partial: {str(e)}")
        
    print(f"[DJ Requests] Download complete: {filename}")
        
    return {
        "success": True,
        "id": f"req_{video_id}",
        "title": title,
        "filename": f"/music/party_29may/requests/{filename}"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8766)
