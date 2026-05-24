import sqlite3

conn = sqlite3.connect('backend/metadata.db')
conn.execute("UPDATE playlist_items SET eq_mode='vocal_hold' WHERE eq_mode='bass_swap'")

mock_meta = '{"completed_at": 1700000000, "render_mode": "pydub", "file_size": 5000000, "transitions_applied": [{"boundary": 1, "curve": "equal_power", "duck_db": -3.0, "duration_ms": 2000, "source": "snapped", "eq_mode": "vocal_hold"}, {"boundary": 2, "curve": "linear", "duck_db": 0.0, "duration_ms": 1000, "source": "manual", "eq_mode": "none"}]}'
conn.execute("UPDATE exports SET metadata=? WHERE id='mock_export_phase7'", (mock_meta,))

conn.commit()
conn.close()
