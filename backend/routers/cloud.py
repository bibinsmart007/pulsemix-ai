import os
import sys
import json
import sqlite3
from fastapi import FastAPI, APIRouter, UploadFile, File, BackgroundTasks, HTTPException, Header, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

# Add current dir to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.extractor import resolve_youtube_audio
from backend.analyzer import analyze_audio
from backend.ai_engine import generate_mix_timeline
from backend.database import (
    init_db, 
    get_db_connection, 
    get_track_metadata, 
    save_track_metadata, 
    get_all_tracks, 
    create_playlist, 
    get_playlists, 
    add_item_to_playlist, 
    update_playlist_item, 
    delete_playlist_item, 
    get_playlist_items, 
    save_snapshot,
    get_snapshots,
    get_snapshot,
    clear_playlist_items,
    create_export_job, 
    get_export_job, 
    get_all_exports, 
    log_activity_event, 
    get_activity_events, 
    log_audit_event, 
    get_audit_logs, 
    get_ai_sessions, 
    get_ai_session, 
    create_or_update_ai_session, 
    apply_ai_session, 
    duplicate_ai_session, 
    rate_ai_session
)
from backend.stem_extractor import run_stem_extraction
import uuid
import time
import threading
from backend.exporter import process_export_job, apply_custom_crossfade, apply_time_stretch
from backend.recommender import score_candidates, build_set_plan
from pydub import AudioSegment
import re

from arq import create_pool
from arq.connections import RedisSettings
from backend.jobs import create_job, get_job, update_job

app = FastAPI(
    title="PulseMix AI Backend",
    description="FastAPI Audio Extractor and Music Information Retrieval Server",
    version="1.0"
)

# Enable CORS for Next.js dev server securely
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Determine the Next.js static asset directories relative to workspace
WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOWNLOADS_DIR = os.path.join(WORKSPACE_DIR, "public", "downloads")
MUSIC_DIR = os.path.join(WORKSPACE_DIR, "public", "music")

# Ensure static directories exist
os.makedirs(DOWNLOADS_DIR, exist_ok=True)
os.makedirs(MUSIC_DIR, exist_ok=True)
PREVIEWS_DIR = os.path.join(WORKSPACE_DIR, "public", "previews")
os.makedirs(PREVIEWS_DIR, exist_ok=True)

# Generate synthetic high-fidelity preset loop files if not present
from backend.synthesizer import generate_preset_library
try:
    if not os.path.exists(os.path.join(MUSIC_DIR, "lofi_raindrops.mp3")):
        generate_preset_library(MUSIC_DIR)
except Exception as e:
    print(f"[Backend] Failed to run preset loop synthesizer: {e}")

# Initialize SQLite metadata database

from backend.routers.auth import get_current_user
from fastapi import Depends
router = APIRouter(dependencies=[Depends(get_current_user)])

@router.get("/api/cloud/projects")
def api_get_cloud_projects():
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        projects = conn.execute("SELECT * FROM cloud_projects ORDER BY created_at DESC").fetchall()
        
        result = []
        for p in projects:
            versions = conn.execute("SELECT COUNT(*) as count FROM cloud_project_versions WHERE project_id = ?", (p["id"],)).fetchone()
            last_edit = conn.execute("SELECT created_at, review_status FROM cloud_project_versions WHERE project_id = ? ORDER BY version_number DESC LIMIT 1", (p["id"],)).fetchone()
            result.append({
                "id": p["id"],
                "name": p["name"],
                "share_token": p["share_token"],
                "created_at": p["created_at"],
                "version_count": versions["count"],
                "last_edited": last_edit["created_at"] if last_edit else p["created_at"],
                "review_status": last_edit["review_status"] if last_edit else "needs_review"
            })
        conn.close()
        return {"success": True, "projects": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/cloud/projects")
def api_create_cloud_project(req: CloudProjectCreate):
    try:
        data = req.project_data
        share_token = str(uuid.uuid4())
        name = data.get("playlist_name", "Untitled Project")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        now = time.time()
        
        cursor.execute("INSERT INTO cloud_projects (name, share_token, created_at) VALUES (?, ?, ?)", (name, share_token, now))
        project_id = cursor.lastrowid
        
        # Insert v1
        cursor.execute("INSERT INTO cloud_project_versions (project_id, version_number, payload_json, created_at) VALUES (?, ?, ?, ?)", 
                       (project_id, 1, json.dumps(data), now))
        conn.commit()
        conn.close()
        return {"success": True, "project_id": project_id, "share_token": share_token}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/cloud/projects/{project_id}/versions")
def api_save_cloud_version(project_id: int, req: CloudVersionCreate):
    try:
        data = req.project_data
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        now = time.time()
        
        # Get latest version number and id before insert
        latest = cursor.execute("SELECT id, version_number as max_v FROM cloud_project_versions WHERE project_id = ? ORDER BY version_number DESC LIMIT 1", (project_id,)).fetchone()
        next_v = (latest["max_v"] if latest else 0) + 1
        
        cursor.execute("INSERT INTO cloud_project_versions (project_id, version_number, payload_json, created_at) VALUES (?, ?, ?, ?)", 
                       (project_id, next_v, json.dumps(data), now))
        new_version_id = cursor.lastrowid
        
        # Phase 19: Carry forward unresolved comments from previous version
        if latest:
            old_v_id = latest["id"]
            unresolved = cursor.execute("SELECT * FROM project_comments WHERE version_id = ? AND is_resolved = 0", (old_v_id,)).fetchall()
            for c in unresolved:
                cursor.execute("""
                    INSERT INTO project_comments (version_id, target_type, target_id, timestamp_ms, boundary_index, content, is_resolved, carried_forward_from, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
                """, (new_version_id, c["target_type"], c["target_id"], c["timestamp_ms"], c["boundary_index"], c["content"], c["id"], now))
        
        # Update project name just in case
        name = data.get("playlist_name", "Untitled Project")
        cursor.execute("UPDATE cloud_projects SET name = ? WHERE id = ?", (name, project_id))
        
        conn.commit()
        conn.close()
        return {"success": True, "version_number": next_v, "version_id": new_version_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Phase 19: Commenting and Review Endpoints

class CommentCreate(BaseModel):
    target_type: str
    target_id: Optional[str] = None
    timestamp_ms: Optional[float] = None
    boundary_index: Optional[int] = None
    content: str

class StatusUpdate(BaseModel):
    status: str

@router.get("/api/cloud/versions/{version_id}/comments")
def api_get_comments(version_id: int):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM project_comments WHERE version_id = ? ORDER BY created_at ASC", (version_id,)).fetchall()
        conn.close()
        return {"success": True, "comments": [dict(r) for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/cloud/versions/{version_id}/comments")
def api_post_comment(version_id: int, req: CommentCreate):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        now = time.time()
        cursor.execute("""
            INSERT INTO project_comments (version_id, target_type, target_id, timestamp_ms, boundary_index, content, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (version_id, req.target_type, req.target_id, req.timestamp_ms, req.boundary_index, req.content, now))
        comment_id = cursor.lastrowid
        
        # Get project_id
        res = cursor.execute("SELECT project_id FROM cloud_project_versions WHERE id = ?", (version_id,)).fetchone()
        project_id = res[0] if res else 0
        
        conn.commit()
        conn.close()
        
        if project_id:
            log_activity_event(
                project_id=project_id,
                version_id=version_id,
                event_type="comment_added",
                actor="Collaborator",
                target_id=comment_id,
                metadata={"content": req.content, "target_type": req.target_type},
                importance="high"
            )
            
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/api/cloud/comments/{comment_id}/resolve")
def api_resolve_comment(comment_id: int):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # Toggle resolved status
        curr = cursor.execute("SELECT is_resolved FROM project_comments WHERE id = ?", (comment_id,)).fetchone()
        if not curr:
            raise Exception("Comment not found")
        new_val = 0 if curr[0] == 1 else 1
        cursor.execute("UPDATE project_comments SET is_resolved = ? WHERE id = ?", (new_val, comment_id))
        
        # Get project info for activity log
        res = cursor.execute("SELECT version_id FROM project_comments WHERE id = ?", (comment_id,)).fetchone()
        version_id = res[0] if res else 0
        project_id = 0
        if version_id:
            pres = cursor.execute("SELECT project_id FROM cloud_project_versions WHERE id = ?", (version_id,)).fetchone()
            if pres:
                project_id = pres[0]
                
        conn.close()
        
        if project_id:
            event_type = "comment_resolved" if new_val == 1 else "comment_reopened"
            log_activity_event(
                project_id=project_id,
                version_id=version_id,
                event_type=event_type,
                actor="Collaborator",
                target_id=comment_id,
                importance="normal"
            )
            
        return {"success": True, "is_resolved": bool(new_val)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class TaskCreate(BaseModel):
    title: str
    comment_id: Optional[int] = None
    assignee_type: Optional[str] = None
    assignee_id: Optional[int] = None
    assignee_label: Optional[str] = None
    status: str = 'open'
    priority: str = 'normal'
    due_at: Optional[float] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    assignee_type: Optional[str] = None
    assignee_id: Optional[int] = None
    assignee_label: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_at: Optional[float] = None

# ==========================================
# Phase 25: Presence Manager
# ==========================================
import time
from typing import Dict, List, Optional
from pydantic import BaseModel

class PresencePing(BaseModel):
    user_label: str
    project_id: int
    version_id: Optional[int] = None
    action: str = "viewing" # viewing, reviewing, editing
    focus_target: Optional[str] = None # e.g. "comment_12", "task_5"

class ActiveSession(BaseModel):
    session_id: str
    user_label: str
    project_id: int
    version_id: Optional[int]
    action: str
    focus_target: Optional[str]
    last_seen_ms: int

# Phase 26 Models
class CloudExportCreate(BaseModel):
    version_id: int
    job_type: str # 'full_mix', 'preview', 'stems'
    format: str # 'mp3', 'wav', 'zip'

class CloudExportUpdate(BaseModel):
    status: str
    file_url: Optional[str] = None
    error_message: Optional[str] = None

class PresenceManager:
    def __init__(self):
        # Maps session_id to ActiveSession
        self.sessions: Dict[str, ActiveSession] = {}
        self.timeout_ms = 15000 # 15 seconds

    def ping(self, session_id: str, ping_data: PresencePing):
        self.sessions[session_id] = ActiveSession(
            session_id=session_id,
            user_label=ping_data.user_label,
            project_id=ping_data.project_id,
            version_id=ping_data.version_id,
            action=ping_data.action,
            focus_target=ping_data.focus_target,
            last_seen_ms=int(time.time() * 1000)
        )
        self._cleanup()

    def get_project_presence(self, project_id: int) -> List[ActiveSession]:
        self._cleanup()
        return [s for s in self.sessions.values() if s.project_id == project_id]

    def _cleanup(self):
        now = int(time.time() * 1000)
        stale_keys = [k for k, v in self.sessions.items() if now - v.last_seen_ms > self.timeout_ms]
        for k in stale_keys:
            del self.sessions[k]

presence_manager = PresenceManager()

@router.post("/api/cloud/presence")
def api_post_presence(ping_data: PresencePing, request: Request):
    # Use client IP + user_label as a mock session_id for now
    client_ip = request.client.host if request.client else "unknown"
    session_id = f"{client_ip}_{ping_data.user_label}"
    presence_manager.ping(session_id, ping_data)
    return {"success": True}

@router.get("/api/cloud/presence/{project_id}")
def api_get_presence(project_id: int):
    sessions = presence_manager.get_project_presence(project_id)
    return {"success": True, "sessions": [s.dict() for s in sessions]}

# ==========================================
# Tasks Endpoints
# ==========================================
@router.get("/api/cloud/projects/{project_id}/tasks")
def api_get_tasks(project_id: int):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM review_tasks WHERE project_id = ? ORDER BY created_at DESC", (project_id,)).fetchall()
        conn.close()
        return {"success": True, "tasks": [dict(r) for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/cloud/versions/{version_id}/tasks")
def api_get_version_tasks(version_id: int):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM review_tasks WHERE version_id = ? ORDER BY created_at DESC", (version_id,)).fetchall()
        conn.close()
        return {"success": True, "tasks": [dict(r) for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/cloud/versions/{version_id}/tasks")
def api_post_task(version_id: int, req: TaskCreate):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        now = time.time()
        
        # Get project_id
        res = cursor.execute("SELECT project_id FROM cloud_project_versions WHERE id = ?", (version_id,)).fetchone()
        if not res:
            raise Exception("Version not found")
        project_id = res[0]
        
        cursor.execute("""
            INSERT INTO review_tasks (comment_id, project_id, version_id, title, assignee_type, assignee_id, assignee_label, status, priority, due_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (req.comment_id, project_id, version_id, req.title, req.assignee_type, req.assignee_id, req.assignee_label, req.status, req.priority, req.due_at, now, now))
        
        task_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        log_activity_event(
            project_id=project_id,
            version_id=version_id,
            event_type="task_created",
            actor="Collaborator",
            target_id=task_id,
            metadata={"title": req.title, "assignee_label": req.assignee_label},
            importance="normal"
        )
            
        return {"success": True, "task_id": task_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/api/cloud/tasks/{task_id}")
def api_update_task(task_id: int, req: TaskUpdate):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        task = cursor.execute("SELECT * FROM review_tasks WHERE id = ?", (task_id,)).fetchone()
        if not task:
            raise Exception("Task not found")
            
        updates = []
        params = []
        if req.title is not None:
            updates.append("title = ?")
            params.append(req.title)
        if req.assignee_type is not None:
            updates.append("assignee_type = ?")
            params.append(req.assignee_type)
        if req.assignee_id is not None:
            updates.append("assignee_id = ?")
            params.append(req.assignee_id)
        if req.assignee_label is not None:
            updates.append("assignee_label = ?")
            params.append(req.assignee_label)
        if req.status is not None:
            updates.append("status = ?")
            params.append(req.status)
            if req.status == 'done' and task['status'] != 'done':
                updates.append("completed_at = ?")
                params.append(time.time())
            elif req.status != 'done' and task['status'] == 'done':
                updates.append("completed_at = NULL")
        if req.priority is not None:
            updates.append("priority = ?")
            params.append(req.priority)
        if req.due_at is not None:
            updates.append("due_at = ?")
            params.append(req.due_at)
            
        if not updates:
            return {"success": True}
            
        updates.append("updated_at = ?")
        params.append(time.time())
        params.append(task_id)
        
        cursor.execute(f"UPDATE review_tasks SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
        conn.close()
        
        event_type = "task_updated"
        if req.status == 'done' and task['status'] != 'done':
            event_type = "task_completed"
            
        log_activity_event(
            project_id=task['project_id'],
            version_id=task['version_id'],
            event_type=event_type,
            actor="Collaborator",
            target_id=task_id,
            metadata={"status": req.status, "assignee_label": req.assignee_label},
            importance="normal"
        )
            
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/api/cloud/versions/{version_id}/status")
def api_update_version_status(version_id: int, req: StatusUpdate):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        res = cursor.execute("SELECT project_id, review_status FROM cloud_project_versions WHERE id = ?", (version_id,)).fetchone()
        project_id = res[0] if res else 0
        old_status = res[1] if res else None
        
        cursor.execute("UPDATE cloud_project_versions SET review_status = ? WHERE id = ?", (req.status, version_id))
        
        conn.commit()
        conn.close()
        
        if project_id:
            log_activity_event(
                project_id=project_id,
                version_id=version_id,
                event_type="status_changed",
                actor="Collaborator",
                metadata={"new_status": req.status},
                importance="high"
            )
            
            log_audit_event(
                project_id=project_id,
                actor="Collaborator",
                entity_type="version",
                entity_id=version_id,
                action_type="update_status",
                severity="medium",
                before_json={"review_status": old_status},
                after_json={"review_status": req.status}
            )
            
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/cloud/share/{share_token}")
def api_get_shared_project(share_token: str):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        project = conn.execute("SELECT * FROM cloud_projects WHERE share_token = ?", (share_token,)).fetchone()
        
        if not project:
            conn.close()
            raise HTTPException(status_code=404, detail="Shared project not found")
            
        latest_version = conn.execute("SELECT * FROM cloud_project_versions WHERE project_id = ? ORDER BY version_number DESC LIMIT 1", (project["id"],)).fetchone()
        conn.close()
        
        if not latest_version:
            raise HTTPException(status_code=404, detail="Project data missing")
            
        data = json.loads(latest_version["payload_json"])
        return {
            "success": True, 
            "project_metadata": {
                "id": project["id"],
                "name": project["name"],
                "version": latest_version["version_number"],
                "version_id": latest_version["id"],
                "last_edited": latest_version["created_at"],
                "review_status": latest_version["review_status"]
            },
            "manifest": data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/cloud/versions/{version_id}/publish")
def api_publish_version(version_id: int, req: PublishCreate):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        now = time.time()
        publish_token = str(uuid.uuid4())
        
        expires_at = now + (req.expires_in_hours * 3600) if req.expires_in_hours else None
        pwd_hash = hash_password(req.password) if req.password else None
        
        cursor.execute("""
            INSERT INTO published_packages (version_id, publish_token, package_type, notes, allow_download, expires_at, password_hash, recipient_label, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (version_id, publish_token, req.package_type, req.notes, 1 if req.allow_download else 0, expires_at, pwd_hash, req.recipient_label, now))
        
        package_id = cursor.lastrowid
        
        if req.export_ids:
            for export_id in req.export_ids:
                cursor.execute("""
                    INSERT OR IGNORE INTO package_exports (package_id, export_job_id)
                    VALUES (?, ?)
                """, (package_id, export_id))
        
        # Get project_id
        res = cursor.execute("SELECT project_id FROM cloud_project_versions WHERE id = ?", (version_id,)).fetchone()
        project_id = res[0] if res else 0
        
        conn.commit()
        conn.close()
        
        if project_id:
            log_activity_event(
                project_id=project_id,
                version_id=version_id,
                event_type="package_published",
                actor="Creator",
                target_id=package_id,
                metadata={"package_type": req.package_type, "recipient_label": req.recipient_label},
                importance="high"
            )
            
            log_audit_event(
                project_id=project_id,
                actor="Creator",
                entity_type="package",
                entity_id=package_id,
                action_type="publish_package",
                severity="high",
                after_json={"package_type": req.package_type, "allow_download": req.allow_download, "exports": req.export_ids}
            )
            
        return {"success": True, "publish_token": publish_token}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/cloud/versions/{version_id}/links")
def api_get_version_links(version_id: int):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        links = conn.execute("SELECT * FROM published_packages WHERE version_id = ? ORDER BY created_at DESC", (version_id,)).fetchall()
        
        results = []
        for ln in links:
            logs = conn.execute("SELECT * FROM published_package_access_logs WHERE package_id = ? ORDER BY timestamp DESC", (ln["id"],)).fetchall()
            ln_dict = dict(ln)
            ln_dict["logs"] = [dict(lg) for lg in logs]
            results.append(ln_dict)
            
        conn.close()
        return {"success": True, "links": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/cloud/publish/{publish_token}/revoke")
def api_revoke_publish(publish_token: str):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE published_packages SET is_revoked = 1 WHERE publish_token = ?", (publish_token,))
        
        # Find project id
        package = cursor.execute("SELECT id, version_id, recipient_label FROM published_packages WHERE publish_token = ?", (publish_token,)).fetchone()
        project_id = 0
        if package:
            res = cursor.execute("SELECT project_id FROM cloud_project_versions WHERE id = ?", (package[1],)).fetchone()
            if res:
                project_id = res[0]
                
        conn.commit()
        conn.close()
        
        if project_id and package:
            log_activity_event(
                project_id=project_id,
                version_id=package[1],
                event_type="link_revoked",
                actor="Creator",
                target_id=package[0],
                metadata={"recipient_label": package[2]},
                importance="normal"
            )
            
            log_audit_event(
                project_id=project_id,
                actor="Creator",
                entity_type="package",
                entity_id=package[0],
                action_type="revoke_package",
                severity="high",
                before_json={"is_revoked": 0},
                after_json={"is_revoked": 1}
            )
            
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
@router.get("/api/cloud/projects/{project_id}/activity")
def api_get_cloud_project_activity(project_id: int):
    try:
        events = get_activity_events(project_id)
        return {"success": True, "events": events}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
@router.get("/api/cloud/projects/{project_id}/audit")
def api_get_cloud_project_audit(project_id: int):
    try:
        logs = get_audit_logs(project_id)
        return {"success": True, "logs": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Phase 26: Export / Render Pipeline

def simulate_export(job_id: int, project_id: int, version_id: int, job_type: str):
    time.sleep(2)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE export_jobs SET status = 'running' WHERE id = ?", (job_id,))
    conn.commit()
    conn.close()
    
    time.sleep(8)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Calculate expiration based on job type
    now = time.time()
    retention_days = 7 if job_type == 'stems' else 30
    expires_at = now + (retention_days * 86400)
    
    # Create the stored artifact
    cursor.execute("""
        INSERT INTO stored_artifacts 
        (project_id, version_id, storage_provider, object_key, mime_type, byte_size, checksum, expires_at, retention_policy, retention_source, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        project_id, 
        version_id, 
        "local_mock", 
        f"project_{project_id}/version_{version_id}/export_{job_id}.wav",
        "audio/wav",
        15_420_000 + job_id * 1024, # Fake byte size (~15MB)
        f"mock_sha256_{job_id}",
        expires_at,
        f"{retention_days}_days",
        "class_default",
        now
    ))
    artifact_id = cursor.lastrowid
    
    cursor.execute("UPDATE export_jobs SET status = 'completed', completed_at = ?, artifact_id = ? WHERE id = ?", 
                   (time.time(), artifact_id, job_id))
    conn.commit()
    conn.close()

@router.post("/api/cloud/projects/{project_id}/export")
def api_create_cloud_export(project_id: int, req: CloudExportCreate, bg_tasks: BackgroundTasks):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO export_jobs (project_id, version_id, job_type, format, artifact_label, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (project_id, req.version_id, req.job_type, req.format, f"{req.job_type.replace('_', ' ').title()} ({req.format.upper()})", time.time()))
        job_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        bg_tasks.add_task(simulate_export, job_id, project_id, req.version_id, req.job_type)
        
        log_audit_event(
            project_id=project_id,
            actor="Collaborator",
            entity_type="export_job",
            entity_id=job_id,
            action_type="create_export",
            severity="low",
            after_json={"job_type": req.job_type, "format": req.format}
        )
        
        return {"success": True, "job_id": job_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/cloud/projects/{project_id}/exports")
def api_get_cloud_exports(project_id: int):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        exports = conn.execute("""
            SELECT e.*, a.byte_size, a.mime_type, a.retention_policy, a.retention_source, a.status as status_artifact, a.expires_at 
            FROM export_jobs e
            LEFT JOIN stored_artifacts a ON e.artifact_id = a.id
            WHERE e.project_id = ? ORDER BY e.created_at DESC
        """, (project_id,)).fetchall()
        conn.close()
        
        result = []
        for row in exports:
            d = dict(row)
            if d.get("artifact_id"):
                d["file_url"] = f"/api/artifacts/{d['artifact_id']}/download"
            result.append(d)
            
        return {"success": True, "exports": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from fastapi.responses import PlainTextResponse

@router.get("/api/cloud/projects/{project_id}/health")
def api_get_project_health(project_id: int):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        
        now = time.time()
        seven_days_ago = now - (7 * 86400)
        thirty_days_ago = now - (30 * 86400)
        
        # 1. Tasks
        tasks = conn.execute("SELECT status, is_blocked FROM tasks WHERE project_id = ?", (project_id,)).fetchall()
        open_tasks = sum(1 for t in tasks if t["status"] in ["todo", "in_progress", "in_review"])
        completed_tasks = sum(1 for t in tasks if t["status"] == "done")
        blocked_tasks = sum(1 for t in tasks if t["is_blocked"])
        
        # 2. Approvals
        latest_version = conn.execute("SELECT id, version_number, approval_status FROM cloud_project_versions WHERE project_id = ? ORDER BY version_number DESC LIMIT 1", (project_id,)).fetchone()
        approval_state = latest_version["approval_status"] if latest_version else "none"
        
        # 3. Deliveries
        packages = conn.execute("SELECT id, is_revoked, expires_at, created_at FROM published_packages WHERE version_id IN (SELECT id FROM cloud_project_versions WHERE project_id = ?)", (project_id,)).fetchall()
        total_packages = len(packages)
        revoked_packages = sum(1 for p in packages if p["is_revoked"])
        expired_packages = sum(1 for p in packages if p["expires_at"] and p["expires_at"] < now)
        
        # Delivery Opens
        package_ids = [p["id"] for p in packages]
        opened_packages = 0
        if package_ids:
            placeholders = ",".join("?" * len(package_ids))
            opens = conn.execute(f"SELECT package_id FROM published_package_access_logs WHERE package_id IN ({placeholders}) AND event_type = 'opened' GROUP BY package_id", package_ids).fetchall()
            opened_packages = len(opens)
            
        unopened_packages = total_packages - opened_packages
        
        # 4. Exports
        exports = conn.execute("SELECT status FROM export_jobs WHERE project_id = ?", (project_id,)).fetchall()
        total_exports = len(exports)
        failed_exports = sum(1 for e in exports if e["status"] == "failed")
        running_exports = sum(1 for e in exports if e["status"] in ["running", "queued"])
        
        expiring_exports = conn.execute("""
            SELECT count(*) as cnt FROM stored_artifacts 
            WHERE project_id = ? AND status = 'active' AND expires_at IS NOT NULL AND expires_at < ?
        """, (project_id, now + (7 * 86400))).fetchone()["cnt"]
        
        # 5. Activity Window
        recent_activity_count = conn.execute("SELECT count(*) as cnt FROM activity_events WHERE project_id = ? AND created_at > ?", (project_id, seven_days_ago)).fetchone()["cnt"]
        
        conn.close()
        
        # Alert Heuristics
        alerts = []
        if blocked_tasks > 0:
            alerts.append({"type": "blocked_tasks", "message": f"{blocked_tasks} tasks are currently blocked", "severity": "high"})
        if unopened_packages > 0:
            alerts.append({"type": "unopened_packages", "message": f"{unopened_packages} published packages have never been opened", "severity": "medium"})
        if expiring_exports > 0:
            alerts.append({"type": "expiring_exports", "message": f"{expiring_exports} exports will expire within 7 days", "severity": "low"})
        if latest_version and approval_state == "in_review":
            alerts.append({"type": "pending_approval", "message": f"Version {latest_version['version_number']} is waiting for approval", "severity": "medium"})

        return {
            "success": True,
            "health": {
                "tasks": {
                    "open": open_tasks,
                    "completed": completed_tasks,
                    "blocked": blocked_tasks,
                    "total": len(tasks)
                },
                "approvals": {
                    "current_state": approval_state,
                    "latest_version_id": latest_version["id"] if latest_version else None
                },
                "deliveries": {
                    "total": total_packages,
                    "revoked": revoked_packages,
                    "expired": expired_packages,
                    "opened": opened_packages,
                    "unopened": unopened_packages
                },
                "exports": {
                    "total": total_exports,
                    "failed": failed_exports,
                    "running": running_exports,
                    "expiring_soon": expiring_exports
                },
                "activity_window": {
                    "recent_events_7d": recent_activity_count
                },
                "alert_heuristics": alerts
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class AIGenerateRequest(BaseModel):
    prompt: str
    tracks: List[Dict[str, Any]]

