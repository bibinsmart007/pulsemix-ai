import sys
from backend.analyzer import analyze_audio

def run_test():
    filepath = sys.argv[1] if len(sys.argv) > 1 else "backend/tests/fixtures/test_audio.wav"
    result = analyze_audio(filepath)
    print("ANALYSIS RESULT:")
    for k, v in result.items():
        if k in ["waveform_data", "beatgrid", "phrase_markers", "hot_cues"]:
            print(f"{k}: <len {len(str(v))}>")
        else:
            print(f"{k}: {v}")

if __name__ == "__main__":
    run_test()
