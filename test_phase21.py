import urllib.request, json, time

# 1. Create a dummy version to publish
pub_data = json.dumps({"project_data": {}}).encode("utf-8")
req = urllib.request.Request('http://127.0.0.1:8000/api/cloud/projects/1/versions', data=pub_data, headers={'Content-Type': 'application/json'})
try:
    res = urllib.request.urlopen(req)
    version_id = json.loads(res.read())['version_id']
    print('Created version:', version_id)
except Exception as e:
    print('Failed to create version:', e.read() if hasattr(e, 'read') else e)
    version_id = 1 # fallback

# Debug the db manually
import sqlite3
c = sqlite3.connect('backend/metadata.db')
c.execute("INSERT OR IGNORE INTO cloud_projects (id, name, share_token, created_at) VALUES (1, 'Dummy Project', 'testtoken123', 0)")
c.commit()
print("All projects:", c.execute("SELECT * FROM cloud_projects").fetchall())
print("Is version in db?", c.execute("SELECT * FROM cloud_project_versions WHERE id=?", (version_id,)).fetchone())
print("Is version in db?", c.execute("SELECT * FROM cloud_project_versions WHERE id=?", (version_id,)).fetchone())

# 2. Publish with password
pub_data = json.dumps({
    'package_type': 'shared_release',
    'notes': 'Test package',
    'password': 'testpassword',
    'allow_download': True,
    'expires_in_hours': 1
}).encode('utf-8')
req = urllib.request.Request(f'http://127.0.0.1:8000/api/cloud/versions/{version_id}/publish', data=pub_data, headers={'Content-Type': 'application/json'})
try:
    res = urllib.request.urlopen(req)
    pub_res = json.loads(res.read())
    token = pub_res['publish_token']
    print('Published Token:', token)
except Exception as e:
    print('Publish failed', e.read() if hasattr(e, 'read') else e)
    token = None

if token:
    # 3. Access link without password
    try:
        req = urllib.request.Request(f'http://127.0.0.1:8000/api/public/publish/{token}')
        res = urllib.request.urlopen(req)
        print(json.loads(res.read()))
    except Exception as e:
        print('Failed access without password', e.read() if hasattr(e, 'read') else e)

    # 4. Access link with password
    try:
        req = urllib.request.Request(f'http://127.0.0.1:8000/api/public/publish/{token}?pwd=testpassword')
        res = urllib.request.urlopen(req)
        print('Success with password:', json.loads(res.read())['success'])
    except Exception as e:
        print('Failed access with password', e.read() if hasattr(e, 'read') else e)

    # 5. Revoke link
    try:
        req = urllib.request.Request(f'http://127.0.0.1:8000/api/cloud/publish/{token}/revoke', data=b'{}', headers={'Content-Type': 'application/json'})
        res = urllib.request.urlopen(req)
        print('Revoked:', json.loads(res.read())['success'])
    except Exception as e:
        print('Failed revoke', e.read() if hasattr(e, 'read') else e)

    # 6. Access link after revoke
    try:
        req = urllib.request.Request(f'http://127.0.0.1:8000/api/public/publish/{token}?pwd=testpassword')
        res = urllib.request.urlopen(req)
        print(json.loads(res.read()))
    except Exception as e:
        print('Failed access after revoke', e.read() if hasattr(e, 'read') else e)
