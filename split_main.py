import os
import re
import sys

def split_main():
    with open('backend/main.py', 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the imports section at the top, up to the first @app.on_event
    startup_idx = content.find('@app.on_event("startup")')
    if startup_idx == -1:
        print("Could not find startup event")
        return

    header_content = content[:startup_idx]

    # Add APIRouter to imports if not there
    if 'APIRouter' not in header_content:
        header_content = header_content.replace('from fastapi import FastAPI', 'from fastapi import FastAPI, APIRouter')

    # We will define our target files and the prefixes they should handle
    routers_config = {
        'cloud': { 'patterns': [r'^/api/cloud'], 'file': 'backend/routers/cloud.py' },
        'playlists': { 'patterns': [r'^/api/playlists', r'^/api/playlist-items'], 'file': 'backend/routers/playlists.py' },
        'export': { 'patterns': [r'^/api/export', r'^/api/projects/export'], 'file': 'backend/routers/export.py' },
        'admin': { 'patterns': [r'^/api/admin', r'^/api/inventory', r'^/api/status'], 'file': 'backend/routers/admin.py' },
        'ai': { 'patterns': [r'^/api/ai', r'^/api/recommend', r'^/api/recommendations'], 'file': 'backend/routers/ai.py' },
        'importing': { 'patterns': [r'^/api/import', r'^/api/projects/import', r'^/api/tracks'], 'file': 'backend/routers/importing.py' },
        'stems': { 'patterns': [r'^/api/stems'], 'file': 'backend/routers/stems.py' },
    }

    # Extract all endpoint functions.
    # An endpoint starts with @app.<method>("/...")
    # and ends right before the next @app.<method> or EOF.
    
    # We will use regex to find all @app. matches
    endpoint_matches = list(re.finditer(r'^@app\.(get|post|put|delete|on_event)\(.*?$', content, flags=re.MULTILINE))
    
    # Let's chunk the content
    chunks = []
    
    # The first chunk is everything before the first endpoint
    chunks.append({
        'type': 'header',
        'content': content[:endpoint_matches[0].start()]
    })
    
    for i in range(len(endpoint_matches)):
        start = endpoint_matches[i].start()
        end = endpoint_matches[i+1].start() if i + 1 < len(endpoint_matches) else len(content)
        chunk_content = content[start:end]
        
        match = re.search(r'^@app\.(?:get|post|put|delete)\("([^"]+)"', chunk_content)
        route_path = match.group(1) if match else None
        
        is_event = '@app.on_event' in chunk_content
        
        chunks.append({
            'type': 'endpoint',
            'path': route_path,
            'is_event': is_event,
            'content': chunk_content
        })

    # Prepare router files
    router_contents = { k: header_content + f"\nrouter = APIRouter()\n\n" for k in routers_config.keys() }
    
    # Distribute chunks
    main_endpoints = []
    
    for chunk in chunks:
        if chunk['type'] == 'header':
            continue
            
        if chunk['is_event'] or chunk['path'] == '/':
            # keep in main
            main_endpoints.append(chunk['content'])
            continue
            
        path = chunk['path']
        assigned = False
        if path:
            for r_key, r_info in routers_config.items():
                for pat in r_info['patterns']:
                    if re.match(pat, path):
                        # Replace @app. with @router.
                        new_content = re.sub(r'^@app\.', '@router.', chunk['content'], count=1)
                        router_contents[r_key] += new_content
                        assigned = True
                        break
                if assigned:
                    break
        
        if not assigned:
            # If not assigned, keep in main
            main_endpoints.append(chunk['content'])

    # Write router files
    os.makedirs('backend/routers', exist_ok=True)
    for r_key, r_info in routers_config.items():
        # Ensure we add the security dependency for certain routers
        file_content = router_contents[r_key]
        if r_key in ['cloud', 'admin', 'export']:
            # Add security dependency
            # Wait, adding security dynamically to every route might be tricky.
            # We can add a dependency to the router itself.
            # router = APIRouter(dependencies=[Depends(get_current_user)])
            file_content = file_content.replace(
                'router = APIRouter()',
                'from backend.routers.auth import get_current_user\nfrom fastapi import Depends\nrouter = APIRouter(dependencies=[Depends(get_current_user)])'
            )
        with open(r_info['file'], 'w', encoding='utf-8') as f:
            f.write(file_content)
            
    # Now write the new main.py
    new_main_content = header_content
    for chunk_content in main_endpoints:
        new_main_content += chunk_content
        
    # Append include_routers
    new_main_content += "\n\n# Include Routers\n"
    for r_key, r_info in routers_config.items():
        new_main_content += f"from backend.routers.{r_key} import router as {r_key}_router\n"
        new_main_content += f"app.include_router({r_key}_router)\n"
        
    # Also include auth router
    new_main_content += f"from backend.routers.auth import router as auth_router\n"
    new_main_content += f"app.include_router(auth_router)\n"
        
    with open('backend/main.py', 'w', encoding='utf-8') as f:
        f.write(new_main_content)
        
    print("Successfully refactored main.py into routers.")

if __name__ == '__main__':
    split_main()
