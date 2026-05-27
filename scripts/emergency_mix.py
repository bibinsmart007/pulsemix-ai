"""
emergency_mix.py - Disaster-proof party mix renderer.

Zero dependency on PulseMix backend or DB. Uses ffmpeg directly to:
  1. Chain a folder of audio files with crossfades
  2. Loudness-normalize the result to a target LUFS
  3. Output MP3 320kbps (portable) + WAV (master)

If PulseMix UI/backend is broken on party night, run this script with
a folder of MP3s and you'll have a playable mix in minutes.

Requires:
  - Python 3.8+
  - ffmpeg on PATH (Windows: choco install ffmpeg, or download from ffmpeg.org)

Usage (PowerShell):
  python scripts\\emergency_mix.py --input C:\\Music\\Party --output party_mix
  python scripts\\emergency_mix.py --tracklist tracklist.txt --output party_mix
  python scripts\\emergency_mix.py --input C:\\Music\\Party --lufs -7 --xfade 6 --output loud_mix

Author: PulseMix-AI emergency tooling. 2026-05.
"""
from __future__ import annotations
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import List, Optional

AUDIO_EXTS = {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".opus", ".aac", ".webm", ".mka", ".mkv"}

# Loudness presets. Balanced is the safe party default.
PRESETS = {
    "safe":     {"I": -14.0, "TP": -1.0, "LRA": 11.0},  # streaming / headphones
    "balanced": {"I": -10.0, "TP": -1.0, "LRA": 11.0},  # party PA  <-- default
    "loud":     {"I":  -7.0, "TP": -1.0, "LRA":  9.0},  # max party loud
}


def require_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None:
        sys.exit(
            "ERROR: ffmpeg not found on PATH.\n"
            "  Windows install: winget install ffmpeg   OR   choco install ffmpeg\n"
            "  Then restart PowerShell and try again."
        )


def collect_tracks(input_dir: Optional[str], tracklist: Optional[str]) -> List[Path]:
    """Return ordered list of track paths. tracklist takes precedence over input_dir."""
    if tracklist:
        with open(tracklist, "r", encoding="utf-8") as f:
            lines = [l.strip() for l in f if l.strip() and not l.startswith("#")]
        tracks = [Path(l) for l in lines]
    elif input_dir:
        folder = Path(input_dir)
        if not folder.is_dir():
            sys.exit(f"ERROR: input folder not found: {input_dir}")
        # Sort by filename — for explicit order, use --tracklist or prefix files with 01_, 02_ etc.
        tracks = sorted(
            (p for p in folder.iterdir() if p.suffix.lower() in AUDIO_EXTS),
            key=lambda p: p.name.lower(),
        )
    else:
        sys.exit("ERROR: provide --input <folder> or --tracklist <file>")

    missing = [str(t) for t in tracks if not t.exists()]
    if missing:
        sys.exit("ERROR: these tracks do not exist:\n  " + "\n  ".join(missing))
    if not tracks:
        sys.exit("ERROR: no audio files found.")
    return tracks


def probe_duration_ms(path: Path) -> Optional[int]:
    """Use ffprobe to get track duration in ms. Returns None on failure."""
    try:
        out = subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "json", str(path)],
            stderr=subprocess.STDOUT,
        )
        data = json.loads(out.decode("utf-8", "ignore"))
        sec = float(data["format"]["duration"])
        return int(sec * 1000)
    except Exception as e:
        print(f"  WARN: ffprobe failed on {path.name}: {e}")
        return None


def build_filter_graph(num_tracks: int, xfade_sec: float,
                       preset: dict, sample_rate: int) -> str:
    """
    Build ffmpeg -filter_complex string.
    Chains all inputs with acrossfade, then loudnorm at the end.
    Curve 'tri' (triangular) is the most natural for music.
    """
    if num_tracks == 1:
        return (
            f"[0:a]aresample={sample_rate},"
            f"loudnorm=I={preset['I']}:TP={preset['TP']}:LRA={preset['LRA']}:print_format=summary"
            f"[out]"
        )

    parts = []
    # Resample every input first so acrossfade gets matching streams.
    for i in range(num_tracks):
        parts.append(f"[{i}:a]aresample={sample_rate},aformat=sample_fmts=fltp:channel_layouts=stereo[a{i}]")

    # Chain acrossfade: [a0][a1] -> [m1]; [m1][a2] -> [m2]; etc.
    prev = "a0"
    for i in range(1, num_tracks):
        out_label = f"m{i}" if i < num_tracks - 1 else "premix"
        parts.append(
            f"[{prev}][a{i}]acrossfade=d={xfade_sec}:c1=tri:c2=tri[{out_label}]"
        )
        prev = out_label

    # Final loudness pass on the joined stream.
    parts.append(
        f"[{prev}]loudnorm=I={preset['I']}:TP={preset['TP']}:LRA={preset['LRA']}:print_format=summary[out]"
    )
    return ";".join(parts)


def run_ffmpeg(cmd: list, log_path: Path) -> int:
    """Stream ffmpeg output to console AND log file. Returns exit code."""
    print(f"\n>>> ffmpeg command (logged to {log_path.name}):")
    print("    " + " ".join(repr(c) if " " in c else c for c in cmd[:6]) + " ... [filter_complex] ...")
    with open(log_path, "w", encoding="utf-8") as logf:
        proc = subprocess.Popen(cmd, stderr=subprocess.PIPE, stdout=subprocess.DEVNULL,
                                text=True, encoding="utf-8", errors="replace")
        for line in proc.stderr:
            logf.write(line)
            # Show progress / errors but suppress noisy AVCodec init lines.
            if any(k in line for k in ("Error", "error", "Invalid", "time=", "loudnorm")):
                print("    " + line.rstrip())
        proc.wait()
        return proc.returncode


def main():
    parser = argparse.ArgumentParser(
        description="Emergency party mix renderer (PulseMix-AI fallback).",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    src = parser.add_mutually_exclusive_group(required=True)
    src.add_argument("--input", help="Folder containing audio files (sorted by filename).")
    src.add_argument("--tracklist", help="Text file with one absolute audio path per line.")
    parser.add_argument("--output", default="emergency_mix",
                        help="Output file basename (no extension). Will produce <basename>.mp3 + <basename>.wav.")
    parser.add_argument("--xfade", type=float, default=8.0,
                        help="Crossfade duration in seconds between tracks.")
    parser.add_argument("--preset", choices=list(PRESETS.keys()), default="balanced",
                        help="Loudness preset: safe=-14LUFS / balanced=-10LUFS / loud=-7LUFS.")
    parser.add_argument("--lufs", type=float, default=None,
                        help="Override target integrated LUFS (e.g. -8). Overrides --preset I value.")
    parser.add_argument("--sample-rate", type=int, default=48000,
                        help="Output sample rate (48000 = pro standard, 44100 = CD).")
    parser.add_argument("--mp3-only", action="store_true",
                        help="Skip the WAV master, only produce MP3 320 (faster, smaller).")
    parser.add_argument("--keep-log", action="store_true",
                        help="Keep ffmpeg log file even on success.")
    args = parser.parse_args()

    require_ffmpeg()

    tracks = collect_tracks(args.input, args.tracklist)
    preset = dict(PRESETS[args.preset])
    if args.lufs is not None:
        preset["I"] = float(args.lufs)

    print("=" * 70)
    print(f"PulseMix Emergency Mix Renderer")
    print("=" * 70)
    print(f"Tracks       : {len(tracks)}")
    print(f"Crossfade    : {args.xfade}s")
    print(f"Loudness     : {preset['I']} LUFS / TP {preset['TP']} / LRA {preset['LRA']}")
    print(f"Sample rate  : {args.sample_rate} Hz")
    print(f"Preset       : {args.preset}{' (overridden by --lufs)' if args.lufs is not None else ''}")
    print("=" * 70)

    total_ms = 0
    for i, t in enumerate(tracks, 1):
        d = probe_duration_ms(t)
        if d:
            total_ms += d
        print(f"  {i:2d}. {t.name:60s} {'?' if d is None else str(d // 1000) + 's':>6s}")
    # Subtract crossfade overlaps
    est_ms = max(0, total_ms - int(args.xfade * 1000 * (len(tracks) - 1)))
    print(f"\nEstimated mix length: {est_ms // 60000}m {(est_ms // 1000) % 60}s")

    out_base = Path(args.output).resolve()
    out_base.parent.mkdir(parents=True, exist_ok=True)
    mp3_path = out_base.with_suffix(".mp3")
    wav_path = out_base.with_suffix(".wav")
    log_path = out_base.with_suffix(".ffmpeg.log")

    filter_graph = build_filter_graph(len(tracks), args.xfade, preset, args.sample_rate)

    # --- Render to MP3 (primary deliverable) ---
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "info"]
    for t in tracks:
        cmd += ["-i", str(t)]
    cmd += [
        "-filter_complex", filter_graph,
        "-map", "[out]",
        "-c:a", "libmp3lame", "-b:a", "320k",
        str(mp3_path),
    ]

    print(f"\n--- Rendering MP3 320kbps -> {mp3_path.name} ---")
    rc = run_ffmpeg(cmd, log_path)
    if rc != 0:
        sys.exit(f"\nFAILED: ffmpeg exited with code {rc}. See {log_path} for details.")
    mp3_size_mb = mp3_path.stat().st_size / (1024 * 1024)
    print(f"  OK: {mp3_path.name} ({mp3_size_mb:.1f} MB)")

    # --- Render to WAV master (optional) ---
    if not args.mp3_only:
        cmd_wav = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "info"]
        for t in tracks:
            cmd_wav += ["-i", str(t)]
        cmd_wav += [
            "-filter_complex", filter_graph,
            "-map", "[out]",
            "-c:a", "pcm_s16le",
            str(wav_path),
        ]
        print(f"\n--- Rendering WAV master -> {wav_path.name} ---")
        rc = run_ffmpeg(cmd_wav, log_path)
        if rc != 0:
            print(f"  WARN: WAV render failed (rc={rc}). MP3 still good. Check {log_path}.")
        else:
            wav_size_mb = wav_path.stat().st_size / (1024 * 1024)
            print(f"  OK: {wav_path.name} ({wav_size_mb:.1f} MB)")

    # Tracklist file for reference at the party.
    tl_path = out_base.with_suffix(".tracklist.txt")
    with open(tl_path, "w", encoding="utf-8") as f:
        f.write(f"# Emergency Mix Tracklist\n")
        f.write(f"# Loudness target: {preset['I']} LUFS, crossfade {args.xfade}s\n\n")
        for i, t in enumerate(tracks, 1):
            f.write(f"{i:2d}. {t.name}\n")

    print(f"\n--- Done ---")
    print(f"  MP3       : {mp3_path}")
    if not args.mp3_only:
        print(f"  WAV       : {wav_path}")
    print(f"  Tracklist : {tl_path}")
    if not args.keep_log:
        try:
            log_path.unlink()
        except FileNotFoundError:
            pass
    else:
        print(f"  Log       : {log_path}")


if __name__ == "__main__":
    main()
