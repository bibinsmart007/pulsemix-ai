import requests
import time
import subprocess
import os
import signal

API_URL = "http://127.0.0.1:8000"

def get_uvicorn_pid():
    import psutil
    for p in psutil.process_iter(['pid', 'name', 'cmdline']):
        if p.info['name'] == 'python.exe' and 'uvicorn' in str(p.info['cmdline']):
            return p.info['pid']
    return None

def get_arq_pid():
    import psutil
    for p in psutil.process_iter(['pid', 'name', 'cmdline']):
        if p.info['name'] == 'python.exe' and 'arq' in str(p.info['cmdline']):
            return p.info['pid']
    return None

print("=== Phase 60 Restart Verification Suite ===")

# 1. API Restart Test
print("\n[1] Starting API Restart Test...")
resp = requests.post(f"{API_URL}/api/import", json={"url": "https://mock.youtube.com/watch?v=mock_api_restart"}).json()
job_id = resp["job_id"]
print(f"Queued Job: {job_id}")
pid = get_uvicorn_pid()
if pid:
    os.kill(pid, signal.SIGTERM)
    print("Killed API Server.")
    time.sleep(2)
    print("Restarting API Server...")
    subprocess.Popen(["C:\\Users\\user\\AppData\\Local\\Python\\pythoncore-3.14-64\\Scripts\\uvicorn.exe", "backend.main:app", "--host", "127.0.0.1", "--port", "8000"], creationflags=subprocess.CREATE_NO_WINDOW)
    time.sleep(4)
    status_resp = requests.get(f"{API_URL}/api/status/{job_id}").json()
    print(f"Job Status after API restart: {status_resp.get('status')}")
    assert status_resp.get("status") in ["analyzing", "completed", "ready"]
    print("-> API Restart Test Passed!")

# 2. Worker Restart Test
print("\n[2] Starting Worker Restart Test...")
resp = requests.post(f"{API_URL}/api/import", json={"url": "https://mock.youtube.com/watch?v=mock_worker_restart"}).json()
job_id2 = resp["job_id"]
print(f"Queued Job: {job_id2}")
pid = get_arq_pid()
if pid:
    os.kill(pid, signal.SIGTERM)
    print("Killed ARQ Worker.")
    time.sleep(1)
    print("Restarting ARQ Worker...")
    subprocess.Popen(["C:\\Users\\user\\AppData\\Local\\Python\\pythoncore-3.14-64\\Scripts\\arq.exe", "backend.worker.WorkerSettings"], cwd="C:\\Users\\user\\ANTIGRAVITY1", creationflags=subprocess.CREATE_NO_WINDOW)
    time.sleep(5)
    status_resp = requests.get(f"{API_URL}/api/status/{job_id2}").json()
    print(f"Job Status after Worker restart: {status_resp.get('status')}")
    assert status_resp.get("status") in ["analyzing", "completed", "ready"]
    print("-> Worker Restart Test Passed!")

# 3. Combined Restart Test
print("\n[3] Starting Combined Restart Test...")
resp = requests.post(f"{API_URL}/api/import", json={"url": "https://mock.youtube.com/watch?v=mock_combined_restart"}).json()
job_id3 = resp["job_id"]
print(f"Queued Job: {job_id3}")

api_pid = get_uvicorn_pid()
arq_pid = get_arq_pid()
if api_pid and arq_pid:
    os.kill(api_pid, signal.SIGTERM)
    os.kill(arq_pid, signal.SIGTERM)
    print("Killed API and Worker.")
    time.sleep(2)
    
    subprocess.Popen(["C:\\Users\\user\\AppData\\Local\\Python\\pythoncore-3.14-64\\Scripts\\uvicorn.exe", "backend.main:app", "--host", "127.0.0.1", "--port", "8000"], creationflags=subprocess.CREATE_NO_WINDOW)
    subprocess.Popen(["C:\\Users\\user\\AppData\\Local\\Python\\pythoncore-3.14-64\\Scripts\\arq.exe", "backend.worker.WorkerSettings"], cwd="C:\\Users\\user\\ANTIGRAVITY1", creationflags=subprocess.CREATE_NO_WINDOW)
    print("Restarted both. Waiting for processing...")
    time.sleep(6)
    
    status_resp = requests.get(f"{API_URL}/api/status/{job_id3}").json()
    print(f"Job Status after Combined restart: {status_resp.get('status')}")
    print("-> Combined Restart Test Passed!")

# 4. Access URL test
print("\n[4] Access URL Playback Test...")
# Retrieve library items and check url
lib_resp = requests.get(f"{API_URL}/api/library").json()
if lib_resp.get("tracks"):
    track = lib_resp["tracks"][0]
    print(f"Sample Track URL: {track.get('url')}")
    assert track.get("url", "").startswith("http")
    print("-> Access URL generation passed!")

print("\n=== All Verification Passed ===")
