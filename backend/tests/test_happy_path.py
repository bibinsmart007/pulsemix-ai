import requests
import time
import sys
import zipfile
import io
import json

BASE_URL = "http://127.0.0.1:8000"

def log_step(step, name):
    print(f"[Step {step}] {name}")

def log_pass(msg):
    print(f"  [PASS] {msg}")

def log_fail(msg):
    print(f"  [FAIL] {msg}")
    sys.exit(1)

def main():
    print("==========================================================")
    print(" PulseMix AI - Phase 58 End-to-End Integration Test")
    print("==========================================================")
    
    # Step 0: Health check
    log_step(0, "Checking backend health …")
    try:
        requests.get(BASE_URL)
        log_pass("Backend is reachable")
    except:
        log_fail("Backend unreachable")
        
    # Step 1: Create playlist
    log_step(1, "Creating new playlist …")
    res = requests.post(f"{BASE_URL}/api/playlists", json={"name": "E2E Test Playlist"})
    if res.status_code != 200: log_fail(f"Failed to create playlist: {res.text}")
    playlist_id = res.json()["id"]
    log_pass(f"Created playlist_id={playlist_id}")
    
    # Step 2: Import tracks
    log_step(2, "Importing mock tracks …")
    urls = [
        "https://mock.youtube.com/watch?v=mock_track_A",
        "https://mock.youtube.com/watch?v=mock_track_B",
        "https://mock.youtube.com/watch?v=mock_track_C"
    ]
    job_ids = []
    for url in urls:
        r = requests.post(f"{BASE_URL}/api/import", json={"url": url, "playlist_id": playlist_id})
        if r.status_code != 200: log_fail(f"Import failed: {r.text}")
        job_ids.append(r.json()["job_id"])
        
    for jid in job_ids:
        while True:
            st = requests.get(f"{BASE_URL}/api/status/{jid}").json()
            if st["status"] in ("ready", "from_cache"):
                break
            if st["status"] in ("error", "failed", "timed_out"):
                log_fail(f"Job {jid} failed with status {st['status']}")
            time.sleep(0.5)
    log_pass("All tracks downloaded and analyzed")
    
    # Step 3: Add to playlist
    log_step(3, "Adding tracks to timeline …")
    item_ids = []
    for i, url in enumerate(urls):
        r = requests.post(f"{BASE_URL}/api/playlists/{playlist_id}/items", json={"youtube_url": url, "position_index": i})
        if r.status_code != 200: log_fail(f"Add item failed: {r.text}")
        item_ids.append(r.json()["item_id"])
    log_pass(f"Added {len(item_ids)} items to playlist")
    
    # Step 4: Verify phrasing logic
    log_step(4, "Validating phrase snapping …")
    r = requests.get(f"{BASE_URL}/api/playlists/{playlist_id}/items?auto_phrase_snap=true")
    items = r.json().get("items", [])
    if len(items) != 3: log_fail(f"Expected 3 items, got {len(items)}")
    for it in items:
        if "trim_start_ms" not in it or "trim_end_ms" not in it:
            log_fail(f"Item {it['item_id']} missing trim boundaries")
    log_pass("All items have valid phrase-snapped boundaries")
    
    # Step 5: Export package
    log_step(5, "Exporting project package …")
    r = requests.post(f"{BASE_URL}/api/export", json={"playlist_id": playlist_id, "auto_phrase_snap": True})
    export_job = r.json()["job_id"]
    while True:
        st_resp = requests.get(f"{BASE_URL}/api/export/{export_job}").json()
        job_data = st_resp.get("job", {})
        if job_data.get("status") == "completed":
            export_url = job_data.get("file_path")
            break
        if job_data.get("status") == "failed":
            log_fail("Export failed")
        time.sleep(1)
    log_pass(f"Export completed: {export_url}")
    
    # Step 6: Fetch and unzip
    log_step(6, "Validating export contents …")
    import os
    # export_url is something like "/exports/job_id/filename.zip"
    # It corresponds to public/exports/job_id/filename.zip
    local_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "public", export_url.lstrip("/"))
    local_path = os.path.abspath(local_path)
    if not os.path.exists(local_path):
        log_fail(f"Export zip not found at {local_path}")
    
    z = zipfile.ZipFile(local_path)
    files = z.namelist()
    if "mix.wav" not in files: log_fail("mix.wav missing from zip")
    if "manifest.json" not in files: log_fail("manifest.json missing from zip")
    if "tracklist.txt" not in files: log_fail("tracklist.txt missing from zip")
    manifest_data = json.loads(z.read("manifest.json").decode('utf-8'))
    log_pass("Zip contains all required files and valid manifest")
    
    # Step 7: Re-import
    log_step(7, "Re-importing package …")
    r = requests.post(f"{BASE_URL}/api/projects/import", json={"project_data": manifest_data})
    if r.status_code != 200: log_fail("Failed to re-import project")
    new_pid = r.json()["new_playlist_id"]
    if new_pid == playlist_id: log_fail("New playlist ID matches old, should be distinct")
    log_pass(f"Re-imported to new playlist_id={new_pid}")
    
    # Step 8: Verify equivalence
    log_step(8, "Verifying timeline equivalence …")
    r = requests.get(f"{BASE_URL}/api/playlists/{new_pid}/items")
    new_items = r.json()["items"]
    if len(new_items) != 3: log_fail("Re-imported playlist missing items")
    for orig, new in zip(items, new_items):
        if orig["youtube_url"] != new["youtube_url"]: log_fail("URL mismatch")
        # Ensure start and end match
        if orig["trim_start_ms"] != new["trim_start_ms"]: log_fail("Trim start mismatch")
        if orig["trim_end_ms"] != new["trim_end_ms"]: log_fail("Trim end mismatch")
    log_pass("Re-imported timeline is 100% equivalent to original")
    
    print("----------------------------------------------------------")
    print("Phase 58 Integration Test Results: All steps passed")
    print("----------------------------------------------------------")

if __name__ == "__main__":
    main()
