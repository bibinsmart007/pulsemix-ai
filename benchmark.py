import os
import glob
from backend.analyzer import analyze_audio

def run_benchmark():
    files = glob.glob("public/music/*.mp3")
    
    print("| Track | BPM | BPM Conf | Key (Camelot) | Key Conf | Downbeat Conf | Hot Cues | Analysis Mode |")
    print("|---|---|---|---|---|---|---|---|")
    
    for f in files:
        basename = os.path.basename(f)
        try:
            res = analyze_audio(f)
            
            # Count valid hot cues
            import json
            cues = json.loads(res.get("hot_cues", "[]"))
            valid_cues = sum(1 for c in cues if c is not None)
            
            print(f"| {basename} | {res.get('bpm')} | {res.get('bpm_confidence'):.2f} | {res.get('key')} ({res.get('key_camelot')}) | {res.get('key_confidence'):.2f} | {res.get('downbeat_confidence'):.2f} | {valid_cues} | {res.get('analysis_mode')} |")
            
        except Exception as e:
            print(f"| {basename} | ERROR | - | - | - | - | - | FAILED |")

if __name__ == "__main__":
    run_benchmark()
