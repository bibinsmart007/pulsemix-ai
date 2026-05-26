import requests
import json
import sqlite3
import os
import time

BASE_URL = "http://127.0.0.1:8000"
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "metadata.db")

def print_header(title):
    print(f"\n{'='*50}\n {title}\n{'='*50}")

def log_pass(msg):
    print(f"  [PASS] {msg}")

def log_fail(msg):
    print(f"  [FAIL] {msg}")
    exit(1)

def run_db_query(query, params=()):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(query, params)
    result = cursor.fetchall()
    conn.close()
    return result

def test_payload_validation():
    print_header("Test Block 1: Payload Validation")
    
    # Missing schema_version
    payload_missing_schema = {
        "project_data": {
            "items": []
        }
    }
    r = requests.post(f"{BASE_URL}/api/projects/import", json=payload_missing_schema)
    if r.status_code in [400, 422]:
        log_pass(f"Rejected missing schema_version with HTTP {r.status_code}")
    else:
        log_fail(f"Failed to reject missing schema_version. Status: {r.status_code}")

    # Corrupted items (string instead of int for index, missing url)
    payload_bad_types = {
        "project_data": {
            "schema_version": "1.0",
            "items": [
                {
                    "youtube_url": "https://youtube.com/watch?v=123",
                    "position_index": "not_an_int"
                }
            ]
        }
    }
    r = requests.post(f"{BASE_URL}/api/projects/import", json=payload_bad_types)
    if r.status_code in [400, 422]:
        log_pass(f"Rejected invalid data types with HTTP {r.status_code}")
    else:
        log_fail(f"Failed to reject invalid types. Status: {r.status_code}")

def test_idempotency_and_rollback():
    print_header("Test Block 2: Idempotency & Rollback")
    
    initial_playlists = run_db_query("SELECT count(*) FROM playlists")[0][0]
    initial_items = run_db_query("SELECT count(*) FROM playlist_items")[0][0]

    payload_mixed_validity = {
        "project_data": {
            "schema_version": "1.0",
            "playlist_name": "Rollback Test",
            "items": [
                {
                    "youtube_url": "https://youtube.com/watch?v=valid1",
                    "position_index": 0
                },
                {
                    "youtube_url": "https://youtube.com/watch?v=valid2",
                    "position_index": 1,
                    "trim_start_ms": 5000.0,
                    "trim_end_ms": 1000.0  # Invalid: end < start
                }
            ]
        }
    }

    r = requests.post(f"{BASE_URL}/api/projects/import", json=payload_mixed_validity)
    if r.status_code in [400, 422]:
        log_pass(f"Rejected mixed-validity import with HTTP {r.status_code}")
    else:
        log_fail(f"Failed to reject mixed-validity import. Status: {r.status_code}")

    final_playlists = run_db_query("SELECT count(*) FROM playlists")[0][0]
    final_items = run_db_query("SELECT count(*) FROM playlist_items")[0][0]

    if final_playlists == initial_playlists and final_items == initial_items:
        log_pass("Database transaction rolled back successfully (no orphaned rows)")
    else:
        log_fail(f"Database leak! Playlists: {initial_playlists}->{final_playlists}, Items: {initial_items}->{final_items}")

def test_low_confidence_timing():
    print_header("Test Block 3: Low-Confidence Timing Fallback")
    
    # 1. Start import for mock low conf track
    url = "https://mock.youtube.com/watch?v=mock_track_low_conf"
    r = requests.post(f"{BASE_URL}/api/import", json={"url": url})
    if r.status_code != 200:
        print("Import failed:", r.json())
        log_fail("Could not import mock low conf track")
    job_id = r.json()["job_id"]
    
    # Wait for completion
    timeout = 30
    start_t = time.time()
    while True:
        st = requests.get(f"{BASE_URL}/api/status/{job_id}").json()
        print(f"Status is: {st['status']}")
        if st["status"] in ["ready", "from_cache", "low_confidence"]:
            break
        if time.time() - start_t > timeout:
            log_fail("Timed out waiting for job")
        time.sleep(0.5)
        
    log_pass("Imported mock low_confidence track")
    
    # 2. Add to a new playlist
    r = requests.post(f"{BASE_URL}/api/playlists", json={"name": "Fallback Test"})
    playlist_id = r.json()["id"]
    
    r = requests.post(f"{BASE_URL}/api/playlists/{playlist_id}/items", json={
        "youtube_url": url,
        "position_index": 0
    })
    
    # 3. Retrieve playlist items and verify timing fallback
    r = requests.get(f"{BASE_URL}/api/playlists/{playlist_id}/items")
    items = r.json().get("items", [])
    if len(items) != 1: 
        print(f"Items were: {r.json()}")
        log_fail("Failed to get items")
    item = items[0]
    
    if item.get("used_confidence_fallback") == True and item.get("snapped_reason") == "Manual (Low Confidence Fallback)":
        log_pass("Timing engine properly applied low-confidence fallback metadata")
    else:
        log_fail(f"Timing engine missed fallback. Got: {item.get('snapped_reason')}, used_fallback: {item.get('used_confidence_fallback')}")

def test_export_rejection():
    print_header("Test Block 4: Export Rejection")
    
    # 1. Try to export empty playlist
    r = requests.post(f"{BASE_URL}/api/playlists", json={"name": "Empty Test"})
    empty_pid = r.json()["id"]
    
    r = requests.post(f"{BASE_URL}/api/export", json={"playlist_id": empty_pid})
    if r.status_code == 400:
        log_pass("Rejected empty playlist export")
    else:
        log_fail(f"Failed to reject empty export. Status: {r.status_code}")

def main():
    try:
        requests.get(f"{BASE_URL}/api/health")
    except:
        print("Backend not running at http://127.0.0.1:8000. Start it first.")
        exit(1)
        
    test_payload_validation()
    test_idempotency_and_rollback()
    test_low_confidence_timing()
    test_export_rejection()
    
    print_header("All Failure-Path Tests Passed!")

if __name__ == "__main__":
    main()
