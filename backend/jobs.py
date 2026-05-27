import sqlite3
import json
import time
from typing import Optional, Dict, Any
from backend.database import get_db_connection

def create_job(job_id: str, job_type: str, payload: dict) -> None:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO jobs (job_id, job_type, payload_json, status, progress, created_at, updated_at)
        VALUES (?, ?, ?, 'queued', 0, ?, ?)
    """, (job_id, job_type, json.dumps(payload), time.time(), time.time()))
    conn.commit()
    conn.close()

def update_job(job_id: str, status: str = None, progress: int = None, error: str = None, result_key: str = None, worker_id: str = None, lease_token: str = None) -> None:
    conn = get_db_connection()
    cursor = conn.cursor()
    
    updates = {"updated_at": time.time()}
    if status is not None: updates["status"] = status
    if progress is not None: updates["progress"] = progress
    if error is not None: updates["error"] = error
    if result_key is not None: updates["result_key"] = result_key
    if worker_id is not None: updates["worker_id"] = worker_id
    if lease_token is not None: updates["lease_token"] = lease_token
    
    if status == 'processing':
        updates["started_at"] = time.time()
        
    set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
    values = list(updates.values()) + [job_id]
    
    cursor.execute(f"UPDATE jobs SET {set_clause} WHERE job_id = ?", values)
    conn.commit()
    conn.close()

def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        job = dict(row)
        if job.get("payload_json"):
            job["payload"] = json.loads(job["payload_json"])
        return job
    return None

def get_all_jobs() -> list[Dict[str, Any]]:
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    jobs = []
    for row in rows:
        job = dict(row)
        if job.get("payload_json"):
            job["payload"] = json.loads(job["payload_json"])
        jobs.append(job)
    return jobs
