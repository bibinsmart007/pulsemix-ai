import asyncio
import os
import json
from arq.connections import RedisSettings
from backend.jobs import update_job
from backend.extractor import resolve_youtube_audio
from backend.database import get_track_metadata, save_track_metadata
from backend.stem_extractor import run_stem_extraction

REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))
DOWNLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "music")

async def task_import_track(ctx, job_id: str, url: str, force_reanalyze: bool = False):
    worker_id = "arq_worker"
    lease_token = ctx.get('job_id', job_id)
    update_job(job_id, status='processing', worker_id=worker_id, lease_token=lease_token)
    
    try:
        def update_progress(pct: float):
            update_job(job_id, progress=int(pct))
            
        update_job(job_id, status="downloading", progress=0)
        
        # We run the synchronous extraction in a separate thread
        extraction = await asyncio.to_thread(
            resolve_youtube_audio, url, DOWNLOADS_DIR, progress_callback=update_progress
        )
        
        update_job(job_id, status="analyzing", progress=100)
        
        # Cache logic
        cached_metadata = await asyncio.to_thread(get_track_metadata, url)
        is_real_cache = (
            not force_reanalyze 
            and cached_metadata 
            and cached_metadata.get('analysis_status') == 'completed'
            and cached_metadata.get('key_camelot') is not None
        )
        
        from backend.storage import get_storage
        storage = get_storage()
        object_key = f"music/{os.path.basename(extraction['filepath'])}"
        
        # Upload to StorageBackend
        await asyncio.to_thread(storage.upload_file, extraction["filepath"], object_key)
        
        if is_real_cache:
            print(f"[Worker] Cache hit for {url}. Skipping librosa analysis.")
            extraction["bpm"] = cached_metadata["bpm"]
            extraction["bpm_confidence"] = cached_metadata.get("bpm_confidence", 0.0)
            extraction["key"] = cached_metadata["key_signature"]
            extraction["key_camelot"] = cached_metadata.get("key_camelot")
            extraction["key_confidence"] = cached_metadata.get("key_confidence", 0.0)
            extraction["analysis_status"] = "completed"
            extraction["raw_bpm"] = cached_metadata.get("raw_bpm")
        elif extraction["id"].startswith("mock_"):
            import random
            duration = extraction["duration"]
            key = random.choice(["8A", "9A", "10A", "11A", "12A", "1A", "2A", "3A", "4A", "5A", "6A", "7A"])
            beatgrid = [0.5 + i*0.5 for i in range(60)]
            phrase_markers = [0.5, 16.5]
            downbeat_confidence = 0.85
            status = "completed"
            
            extraction["bpm_confidence"] = 0.9
            extraction["key_camelot"] = extraction["key"]
            extraction["key_confidence"] = 0.9
            extraction["analysis_status"] = status
            
            await asyncio.to_thread(
                save_track_metadata,
                youtube_url=url,
                title=extraction["title"],
                bpm=extraction["bpm"],
                bpm_confidence=extraction["bpm_confidence"],
                key_signature=extraction["key"],
                key_camelot=extraction["key_camelot"],
                key_confidence=extraction["key_confidence"],
                duration=extraction["duration"],
                genre=extraction["genre"] or "Unknown",
                url=extraction["url"],
                filepath=object_key,
                waveform_data="[]",
                analysis_status=extraction["analysis_status"],
                raw_bpm=extraction["bpm"],
                beatgrid=json.dumps(beatgrid),
                phrase_markers=json.dumps(phrase_markers),
                downbeat_confidence=downbeat_confidence
            )
        else:
            from backend.analyzer import analyze_audio
            analysis = await asyncio.to_thread(analyze_audio, extraction["filepath"])
            
            extraction["bpm"] = analysis["bpm"]
            extraction["raw_bpm"] = analysis["raw_bpm"]
            extraction["bpm_confidence"] = analysis["bpm_confidence"]
            extraction["key"] = analysis["key"]
            extraction["key_camelot"] = analysis["key_camelot"]
            extraction["key_confidence"] = analysis["key_confidence"]
            extraction["analysis_status"] = "completed"
            
            await asyncio.to_thread(
                save_track_metadata,
                youtube_url=url,
                title=extraction["title"],
                bpm=extraction["bpm"],
                bpm_confidence=extraction["bpm_confidence"],
                key_signature=extraction["key"],
                key_camelot=extraction["key_camelot"],
                key_confidence=extraction["key_confidence"],
                duration=extraction["duration"],
                genre=extraction["genre"] or "Unknown",
                url=extraction["url"],
                filepath=object_key,
                waveform_data=json.dumps(analysis["waveform_data"]),
                analysis_status=extraction["analysis_status"],
                raw_bpm=extraction["raw_bpm"],
                beatgrid=json.dumps(analysis["beatgrid"]),
                phrase_markers=json.dumps(analysis["phrase_markers"]),
                downbeat_confidence=analysis["downbeat_confidence"]
            )
            
        update_job(job_id, status="completed", progress=100, result_key=object_key)
        return {"success": True, "filepath": object_key}
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        update_job(job_id, status="failed", error=str(e))
        raise

async def task_extract_stems(ctx, job_id: str, youtube_url: str):
    worker_id = "arq_worker"
    lease_token = ctx.get('job_id', job_id)
    update_job(job_id, status='processing', worker_id=worker_id, lease_token=lease_token)
    try:
        def update_progress(pct: float):
            update_job(job_id, progress=int(pct))
            
        update_job(job_id, status="extracting", progress=0)
        
        result = await asyncio.to_thread(
            run_stem_extraction, youtube_url, progress_callback=update_progress
        )
        
        from backend.storage import get_storage
        storage = get_storage()
        
        base_filename = youtube_url.replace("https://www.youtube.com/watch?v=", "")
        stems_dir_key = f"music/{base_filename}_stems"
        
        # Upload stems to storage
        for stem_name in ["vocals", "drums", "bass", "other"]:
            key = f"{stem_name}_path"
            if key in result and os.path.exists(result[key]):
                storage.upload_file(result[key], f"{stems_dir_key}/{stem_name}.wav")
        
        object_key = f"{stems_dir_key}/vocals.wav"
        update_job(job_id, status="completed", progress=100, result_key=object_key)
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        update_job(job_id, status="failed", error=str(e))
        raise

async def task_create_export(ctx, job_id: str, playlist_id: int, export_name: str, master_bus_mode: str, auto_phrase_snap: bool):
    worker_id = "arq_worker"
    lease_token = ctx.get('job_id', job_id)
    update_job(job_id, status='processing', worker_id=worker_id, lease_token=lease_token)
    try:
        def update_progress(pct: float):
            update_job(job_id, progress=int(pct))
            
        update_job(job_id, status="exporting", progress=0)
        
        from backend.exporter import process_export_job
        
        # process_export_job runs synchronously
        await asyncio.to_thread(
            process_export_job, job_id, playlist_id, export_name, master_bus_mode, export_name, auto_phrase_snap
        )
        
        from backend.storage import get_storage
        storage = get_storage()
        
        # Exporter creates a zip file in EXPORT_DIR
        EXPORT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "exports")
        zip_path = os.path.join(EXPORT_DIR, f"{job_id}.zip")
        
        if os.path.exists(zip_path):
            object_key = f"exports/{job_id}.zip"
            storage.upload_file(zip_path, object_key)
        else:
            raise Exception("Export artifact not found")
        
        update_job(job_id, status="completed", progress=100, result_key=object_key)
        return {"file_path": object_key}
    except Exception as e:
        import traceback
        traceback.print_exc()
        update_job(job_id, status="failed", error=str(e))
        raise

async def startup(ctx):
    print("ARQ Worker starting...")

async def shutdown(ctx):
    print("ARQ Worker shutting down...")

class WorkerSettings:
    functions = [
        task_import_track,
        task_extract_stems,
        task_create_export
    ]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings(host=REDIS_HOST, port=REDIS_PORT)
