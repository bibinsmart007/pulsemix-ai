import sqlite3
import os
import shutil

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "metadata.db")
PUBLIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "public")

def reset_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    tables = ["playlists", "playlist_items", "tracks", "export_jobs"]
    counts = {}
    
    for table in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        counts[table] = count
        
        cursor.execute(f"DELETE FROM {table}")
        
    conn.commit()
    conn.close()
    
    print("Database rows wiped:")
    for table, count in counts.items():
        print(f"  {table}: {count} rows deleted")

def reset_files():
    dirs_to_clear = ["exports", "downloads"]
    total_files = 0
    
    for d in dirs_to_clear:
        path = os.path.join(PUBLIC_DIR, d)
        if os.path.exists(path):
            for filename in os.listdir(path):
                file_path = os.path.join(path, filename)
                try:
                    if os.path.isfile(file_path) or os.path.islink(file_path):
                        os.unlink(file_path)
                        total_files += 1
                    elif os.path.isdir(file_path):
                        shutil.rmtree(file_path)
                        total_files += 1
                except Exception as e:
                    print(f"Failed to delete {file_path}. Reason: {e}")
                    
    print(f"Files wiped:\n  Total files/dirs deleted: {total_files}")

if __name__ == "__main__":
    print("Running Reset Helper...")
    reset_db()
    reset_files()
    print("Reset complete.")
