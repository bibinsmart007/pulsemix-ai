import librosa
import numpy as np

def analyze(filepath):
    print(f"Loading {filepath}...")
    try:
        y, sr = librosa.load(filepath, sr=22050, duration=30)
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        beat_times = librosa.frames_to_time(beat_frames, sr=sr)
        if len(beat_times) > 0:
            print(f"First beat at: {beat_times[0]:.3f} seconds")
        else:
            print("No beats found in first 30 seconds.")
    except Exception as e:
        print(f"Error: {e}")

analyze("public/media/01_v84ZYg0mDyg.webm")
