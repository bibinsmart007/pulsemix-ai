import os
import sys
import time
import requests
import pandas as pd

API_BASE = "http://127.0.0.1:8765"
EXCEL_PATH = r"C:\Users\user\Downloads\song list.xlsx"

print("Reading Excel file...")
df = pd.read_excel(EXCEL_PATH)

# If the first row is parsed as a column header, extract it too.
urls = list(df.columns) + df.iloc[:, 0].dropna().tolist()

# Clean up URLs (remove start_radio/list arguments if present so they are clean, though the backend regex can usually handle it)
clean_urls = []
for url in urls:
    if isinstance(url, str) and "youtube.com" in url or "youtu.be" in url:
        clean_urls.append(url)

print(f"Found {len(clean_urls)} URLs. Creating Playlist...")
res = requests.post(f"{API_BASE}/api/playlists", json={"name": "Spreadsheet Mix"})
if res.status_code != 200:
    print("Failed to create playlist:", res.text)
    sys.exit(1)
    
playlist_id = res.json()["id"]
print(f"Created Playlist ID: {playlist_id}")

imported_count = 0
for i, url in enumerate(clean_urls):
    print(f"[{i+1}/{len(clean_urls)}] Importing {url}...")
    try:
        # Trigger import
        res = requests.post(f"{API_BASE}/api/import", json={"url": url})
        if res.status_code != 200:
            print(f"  -> Error triggering import: {res.text}")
            continue
            
        job_id = res.json()["job_id"]
        
        # Poll for completion
        while True:
            status_res = requests.get(f"{API_BASE}/api/import/{job_id}")
            if status_res.status_code == 200:
                data = status_res.json()
                status = data.get("status")
                if status == "finished":
                    track_metadata = data.get("metadata", {})
                    # Add to playlist
                    yt_url = track_metadata.get("youtube_url") or url
                    add_res = requests.post(f"{API_BASE}/api/playlists/{playlist_id}/items", json={
                        "youtube_url": yt_url,
                        "position_index": imported_count
                    })
                    if add_res.status_code == 200:
                        print(f"  -> Successfully imported and added to playlist!")
                        imported_count += 1
                    else:
                        print(f"  -> Failed to add to playlist: {add_res.text}")
                    break
                elif status == "failed":
                    print(f"  -> Import failed.")
                    break
            time.sleep(3)
    except Exception as e:
        print(f"  -> Exception: {e}")

print(f"\nImport complete! Added {imported_count} tracks to playlist.")

# Fetch playlist items and sort by BPM ascending
print("Fetching items to sort by energy (BPM)...")
items_res = requests.get(f"{API_BASE}/api/playlists/{playlist_id}/items")
if items_res.status_code == 200:
    items = items_res.json().get("items", [])
    
    # Sort by BPM ascending. Items without BPM go to the end.
    sorted_items = sorted(items, key=lambda i: i.get("track_metadata", {}).get("bpm") or 999)
    item_ids = [i["item_id"] for i in sorted_items]
    
    # Reorder
    print("Reordering playlist by energy...")
    reorder_res = requests.post(
        f"{API_BASE}/api/playlists/{playlist_id}/items/reorder",
        json={"item_ids": item_ids}
    )
    if reorder_res.status_code == 200:
        print("Playlist sorted successfully!")
    else:
        print("Failed to sort playlist:", reorder_res.text)

# Finally, trigger an export
print("Triggering Export Job...")
exp_res = requests.post(f"{API_BASE}/api/export", json={
    "playlist_id": playlist_id,
    "master_bus_mode": "master",
    "export_name": "Spreadsheet DJ Mix",
    "auto_phrase_snap": True
})
if exp_res.status_code == 200:
    print(f"Export Job ID: {exp_res.json()['job_id']}")
    print("Export started in background. Check Export Center in the UI!")
else:
    print("Failed to start export:", exp_res.text)
