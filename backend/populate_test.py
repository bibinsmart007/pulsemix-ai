import sqlite3

conn = sqlite3.connect('backend/metadata.db')
c = conn.cursor()

# Ensure playlist 1 exists
c.execute("INSERT OR IGNORE INTO playlists (id, name) VALUES (1, 'Phase 5 Verification Playlist')")

# Insert Big Buck Bunny track
c.execute('''
    INSERT OR IGNORE INTO tracks 
    (youtube_url, title, bpm, bpm_confidence, key_signature, duration, genre, url, filepath, waveform_data) 
    VALUES ('https://www.youtube.com/watch?v=aqz-KE-bpKQ', 'Big Buck Bunny 60fps 4K - Official Blender Foundation Short Film', 128.0, 0.0, '8A', 635, 'YouTube Stream', '/downloads/aqz-KE-bpKQ.m4a', 'C:\\Users\\user\\ANTIGRAVITY1\\public\\downloads\\aqz-KE-bpKQ.m4a', '[0.1, 0.5, 0.8, 0.3, 0.9, 0.4, 0.7, 0.2, 0.6]')
''')

# Insert track with no BPM
c.execute('''
    INSERT OR IGNORE INTO tracks 
    (youtube_url, title, bpm, bpm_confidence, key_signature, duration, genre, url, filepath, waveform_data) 
    VALUES ('mock_no_bpm', 'Speech Track - No Beat', NULL, 0.0, NULL, 120, 'Spoken', '', '', '[0.2, 0.3, 0.2, 0.4, 0.3]')
''')

# Insert first item (Big Buck Bunny)
c.execute('''
    INSERT INTO playlist_items 
    (playlist_id, youtube_url, position_index, trim_start_ms, trim_end_ms, crossfade_duration_ms, gain_db, transition_preset, is_snapped) 
    VALUES (1, 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', 0, 0, 10000, 2000, 0, 'manual', 0)
''')

# Insert second item (Big Buck Bunny duplicate for overlap)
c.execute('''
    INSERT INTO playlist_items 
    (playlist_id, youtube_url, position_index, trim_start_ms, trim_end_ms, crossfade_duration_ms, gain_db, transition_preset, is_snapped) 
    VALUES (1, 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', 1, 0, 10000, 2000, 0, 'manual', 0)
''')

# Insert third item (No BPM track)
c.execute('''
    INSERT INTO playlist_items 
    (playlist_id, youtube_url, position_index, trim_start_ms, trim_end_ms, crossfade_duration_ms, gain_db, transition_preset, is_snapped) 
    VALUES (1, 'mock_no_bpm', 2, 0, 5000, 1000, 0, 'manual', 0)
''')

conn.commit()
conn.close()
print("Database repopulated with Phase 5 verification scenario")
