import sqlite3

conn = sqlite3.connect('backend/metadata.db')
c = conn.cursor()

c.execute("SELECT COUNT(*) FROM exports WHERE id = 'mock_export_phase7'")
count = c.fetchone()[0]
print(f'Count before: {count}')

mock_meta = '{"completed_at": 1700000000, "render_mode": "pydub", "file_size": 5000000, "transitions_applied": [{"boundary": 1, "curve": "equal_power", "duck_db": -3.0, "duration_ms": 2000, "source": "snapped", "eq_mode": "bass_swap", "sync_ratio": 1.05, "sync_target_bpm": 124.0, "sync_source_bpm": 118.0, "sync_status": "FULL_TRACK_STRETCH"}, {"boundary": 2, "curve": "linear", "duck_db": 0.0, "duration_ms": 1000, "source": "manual", "eq_mode": "none", "sync_status": "BYPASSED_NO_BPM"}]}'
c.execute("INSERT OR REPLACE INTO exports (id, playlist_id, status, progress, metadata) VALUES ('mock_export_phase7', 1, 'completed', 100, ?)", (mock_meta,))
conn.commit()

c.execute("SELECT * FROM exports WHERE id = 'mock_export_phase7'")
print('Export job seeded:', c.fetchone())

# Also verify the equal_power on item 1 overlap
c.execute("UPDATE playlist_items SET fade_curve='equal_power', duck_amount_db=-3.0, eq_mode='bass_swap', sync_mode='auto' WHERE playlist_id=1 AND position_index=1")
c.execute("UPDATE playlist_items SET fade_curve='linear', duck_amount_db=0.0, eq_mode='none', sync_mode='manual' WHERE playlist_id=1 AND position_index=2")
conn.commit()

print("Playlist items updated")
conn.close()
