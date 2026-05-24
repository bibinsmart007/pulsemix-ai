import requests
import time
import sys

BASE_URL = "http://127.0.0.1:8000/api"

def test_e2e():
    print("1. Starting Import...")
    # This is a short, open-source/Creative Commons track on YouTube
    res = requests.post(f"{BASE_URL}/import", json={"url": "https://www.youtube.com/watch?v=aqz-KE-bpKQ"})
    if not res.ok:
        print("Import failed:", res.text)
        return
        
    job_id = res.json()["job_id"]
    print(f"Import job started: {job_id}")
    
    # Poll import status
    track = None
    for _ in range(60):
        time.sleep(2)
        s_res = requests.get(f"{BASE_URL}/status/{job_id}")
        if s_res.ok:
            data = s_res.json()
            print("Import status:", data["status"], data.get("progress", 0))
            if data["status"] in ["ready", "from_cache", "completed"]:
                track = data.get("track")
                break
            elif data["status"] == "failed":
                print("Import failed backend error!")
                return
    
    if not track:
        print("Import timed out.")
        return
        
    print(f"Imported Track: {track['title']} ({track.get('youtube_url')})")
    
    print("\n2. Creating Playlist...")
    p_res = requests.post(f"{BASE_URL}/playlists", json={"name": "End-to-End Test Playlist"})
    playlist_id = p_res.json()["id"]
    print(f"Created Playlist ID: {playlist_id}")
    
    print("\n3. Adding Track to Playlist...")
    a_res = requests.post(f"{BASE_URL}/playlists/{playlist_id}/tracks", json={
        "youtube_url": track.get('youtube_url', track['url']), 
        "order_index": 0
    })
    print("Add Track response:", a_res.json())
    
    print("\n4. Starting Export...")
    e_res = requests.post(f"{BASE_URL}/export", json={"playlist_id": playlist_id})
    e_job_id = e_res.json()["job_id"]
    print(f"Export Job ID: {e_job_id}")
    
    # Poll export
    for _ in range(60):
        time.sleep(2)
        ex_res = requests.get(f"{BASE_URL}/export/{e_job_id}")
        if ex_res.ok:
            data = ex_res.json()
            job = data.get("job", {})
            print("Export status:", job.get("status"), job.get("progress", 0))
            if job.get("status") == "ready":
                print(f"SUCCESS! Download URL: {job.get('file_path')}")
                return
            elif job.get("status") == "failed":
                print("Export failed!")
                return
                
    print("Export timed out.")

if __name__ == "__main__":
    test_e2e()
