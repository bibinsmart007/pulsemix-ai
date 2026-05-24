import urllib.request
import json
import time

def test_export():
    print("Creating playlist...")
    req = urllib.request.Request(
        'http://127.0.0.1:8000/api/playlists',
        method='POST',
        data=json.dumps({"name": "Test Mix"}).encode(),
        headers={'Content-Type': 'application/json'}
    )
    res = urllib.request.urlopen(req)
    pid = json.loads(res.read())['id']
    print(f"Playlist created with ID: {pid}")

    print("Starting export...")
    req2 = urllib.request.Request(
        'http://127.0.0.1:8000/api/export',
        method='POST',
        data=json.dumps({"playlist_id": pid}).encode(),
        headers={'Content-Type': 'application/json'}
    )
    res2 = urllib.request.urlopen(req2)
    job_id = json.loads(res2.read())['job_id']
    print(f"Export started with Job ID: {job_id}")

    print("Polling status...")
    for _ in range(15):
        req3 = urllib.request.Request(f'http://127.0.0.1:8000/api/export/{job_id}')
        res3 = urllib.request.urlopen(req3)
        data = json.loads(res3.read())
        status = data['job']['status']
        progress = data['job']['progress']
        print(f"Status: {status}, Progress: {progress}%")
        if status in ['ready', 'failed']:
            print(f"Final Data: {data}")
            break
        time.sleep(1)

test_export()
