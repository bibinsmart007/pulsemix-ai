import os
import sys
import glob
import re
import uuid
import json

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from database import get_db_connection, create_playlist, add_item_to_playlist

exports_dir = os.path.join(os.path.dirname(__file__), "..", "public", "exports")
db_conn = get_db_connection()
cursor = db_conn.cursor()

def get_or_create_track(youtube_id):
    youtube_url = f"https://www.youtube.com/watch?v={youtube_id}"
    cursor.execute("SELECT youtube_url FROM tracks WHERE youtube_url = ?", (youtube_url,))
    row = cursor.fetchone()
    if not row:
        title = f"Imported Track {youtube_id}"
        thumbnail_url = f"https://i.ytimg.com/vi/{youtube_id}/hqdefault.jpg"
        cursor.execute(
            "INSERT INTO tracks (youtube_url, title, duration) VALUES (?, ?, ?)",
            (youtube_url, title, 0)
        )
        db_conn.commit()
    return youtube_url

for tracklist_file in glob.glob(os.path.join(exports_dir, "*.tracklist.txt")):
    base_name = os.path.basename(tracklist_file).replace(".tracklist.txt", "")
    print(f"Importing {base_name}...")
    
    # Check if playlist already exists
    cursor.execute("SELECT id FROM playlists WHERE name = ?", (base_name,))
    row = cursor.fetchone()
    if row:
        playlist_id = row[0]
        # clear existing items just in case
        cursor.execute("DELETE FROM playlist_items WHERE playlist_id = ?", (playlist_id,))
    else:
        playlist_id = create_playlist(base_name, db_conn)
        
    with open(tracklist_file, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    pos = 0
    for line in lines:
        line = line.strip()
        m = re.search(r'\d+_\w+_(.*?)\.webm', line)
        if m:
            youtube_id = m.group(1)
        else:
            m = re.search(r'\d+\.\s+\d+_(.*?)\.webm', line)
            if m:
                youtube_id = m.group(1)
            else:
                continue
                
        if youtube_id:
            youtube_url = get_or_create_track(youtube_id)
            add_item_to_playlist(playlist_id, youtube_url, pos, db_conn)
            pos += 1
            
    # Add an export record for .mp3 / .wav / .mka if it exists
    for ext in [".mp3", ".wav", ".mka"]:
        file_path = os.path.join(exports_dir, f"{base_name}{ext}")
        if os.path.exists(file_path):
            export_id = f"imported_{base_name}_{ext.replace('.', '')}"
            web_path = f"/exports/{base_name}{ext}"
            
            cursor.execute("SELECT id FROM exports WHERE id = ?", (export_id,))
            if not cursor.fetchone():
                settings = json.dumps({"source": "imported", "format": ext})
                cursor.execute(
                    "INSERT INTO exports (id, playlist_id, status, file_path, progress, metadata) VALUES (?, ?, ?, ?, ?, ?)",
                    (export_id, playlist_id, "finished", web_path, 100, settings)
                )

db_conn.commit()
db_conn.close()
print("Import complete!")
