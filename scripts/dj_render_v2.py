"""
dj_render_v2.py - Higher-quality "DJ mix" renderer.

Improvements over the original emergency_mix.py:
  1. Per-track loudness normalization to -10 LUFS BEFORE concatenation.
     Eliminates the volume-jump effect that made the original sound like
     "two songs clubbed together."
  2. Longer crossfades (16 sec default, vs 8 sec) on triangular curve.
     Gives a smoother, more DJ-like transition.
  3. Phase 1 = per-track loudnorm pass (fast, parallel-able)
     Phase 2 = chained acrossfade concat (single ffmpeg call)
  4. Progress logging at each phase.

Doesn't depend on the PulseMix backend or DB. Works directly on .webm files.

Usage (PowerShell):
  cd C:\\Users\\user\\ANTIGRAVITY1
  python scripts\\dj_render_v2.py
  python scripts\\dj_render_v2.py --xfade 20 --lufs -8 --output public\\exports\\party_29may_v4

Time budget on a modern laptop: ~10-15 min for 57 tracks.
"""
from __future__ import annotations
import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

DEFAULT_INPUT = "public/music/party_29may"
DEFAULT_OUTPUT = "public/exports/party_29may_v4"
DEFAULT_XFADE = 16  # seconds — longer than v2/v3 (8) for smoother DJ feel
DEFAULT_LUFS = -10.0


def section(t):
    print()
    print("=" * 60)
    print(t)
    print("=" * 60)


def require_ffmpeg():
    if shutil.which("ffmpeg") is None:
        sys.exit("ERROR: ffmpeg not found on PATH. Run: winget install Gyan.FFmpeg")


def probe_duration(path):
    try:
        out = subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "csv=p=0", str(path)],
            stderr=subprocess.STDOUT,
        )
        return float(out.decode("utf-8", "ignore").strip())
    except Exception:
        return None


def phase1_normalize(input_dir, work_dir, target_lufs):
    """Normalize every source track to target LUFS as 192kbps MP3."""
    section(f"PHASE 1: Per-track loudness normalization -> {target_lufs} LUFS")
    work_dir.mkdir(parents=True, exist_ok=True)
    files = sorted(p for p in input_dir.iterdir()
                   if p.suffix.lower() in {".webm", ".mp3", ".wav", ".m4a",
                                           ".flac", ".ogg", ".opus", ".aac"})
    print(f"  Tracks to normalize: {len(files)}")
    print(f"  Working directory  : {work_dir}")
    print()

    normalized = []
    start = time.time()
    for i, src in enumerate(files, 1):
        out_path = work_dir / f"{src.stem}.mp3"
        if out_path.exists() and out_path.stat().st_size > 1000:
            print(f"  [{i:2d}/{len(files)}] {src.name[:50]:50s}  CACHED")
            normalized.append(out_path)
            continue

        t0 = time.time()
        cmd = [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-i", str(src),
            "-af", f"loudnorm=I={target_lufs}:TP=-1:LRA=11",
            "-c:a", "libmp3lame", "-b:a", "192k", "-ar", "48000", "-ac", "2",
            str(out_path),
        ]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        dt = time.time() - t0
        if r.returncode != 0:
            print(f"  [{i:2d}/{len(files)}] {src.name[:50]:50s}  FAIL ({dt:.1f}s)")
            print(f"           stderr: {r.stderr[-200:]}")
            continue
        sz_mb = out_path.stat().st_size / (1024 * 1024)
        print(f"  [{i:2d}/{len(files)}] {src.name[:50]:50s}  {dt:5.1f}s  {sz_mb:5.1f}MB")
        normalized.append(out_path)

    elapsed = time.time() - start
    print(f"\n  Phase 1 elapsed: {elapsed/60:.1f} min  ({len(normalized)} tracks normalized)")
    return normalized


def phase2_concat(normalized, output_base, xfade_sec):
    """Concat all normalized tracks with long crossfades."""
    section(f"PHASE 2: Concat with {xfade_sec}s crossfades")

    if not normalized:
        sys.exit("ERROR: no normalized tracks to concat")

    # Build ffmpeg filter graph
    inputs = []
    for p in normalized:
        inputs += ["-i", str(p)]

    parts = []
    # Each input needs resampling + reformatting so acrossfade gets matching streams
    for i in range(len(normalized)):
        parts.append(
            f"[{i}:a]aresample=48000,"
            f"aformat=sample_fmts=fltp:channel_layouts=stereo[a{i}]"
        )

    # Chain acrossfades. Each step takes [prev][next] -> [outN]
    prev = "a0"
    for i in range(1, len(normalized)):
        label = f"m{i}" if i < len(normalized) - 1 else "out"
        parts.append(
            f"[{prev}][a{i}]acrossfade=d={xfade_sec}:c1=tri:c2=tri[{label}]"
        )
        prev = label

    filter_graph = ";".join(parts)

    mp3_out = output_base.with_suffix(".mp3")
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "info"]
    cmd += inputs
    cmd += [
        "-filter_complex", filter_graph,
        "-map", "[out]",
        "-c:a", "libmp3lame", "-b:a", "320k", "-ar", "48000",
        str(mp3_out),
    ]

    print(f"  Inputs        : {len(normalized)}")
    print(f"  Filter graph  : {len(parts)} filter nodes")
    print(f"  Output (MP3)  : {mp3_out}")
    print(f"  Crossfade     : {xfade_sec}s triangular")
    print()
    print(f"  ffmpeg is running... (will take 5-15 min)")
    print()

    start = time.time()
    proc = subprocess.Popen(cmd, stderr=subprocess.PIPE, stdout=subprocess.DEVNULL,
                            text=True, encoding="utf-8", errors="replace")
    last_print = 0
    for line in proc.stderr:
        # Show progress lines (size= time= ...)
        if "time=" in line:
            now = time.time()
            if now - last_print > 5:
                # Extract just the relevant bit
                relevant = " ".join(p for p in line.split()
                                    if p.startswith(("time=", "speed=", "bitrate="))).strip()
                if relevant:
                    print(f"  {relevant}")
                last_print = now
        elif "Error" in line or "error" in line or "Invalid" in line:
            print(f"  ! {line.rstrip()}")
    proc.wait()

    elapsed = time.time() - start
    if proc.returncode == 0:
        sz_mb = mp3_out.stat().st_size / (1024 * 1024)
        dur = probe_duration(mp3_out)
        print()
        print(f"  Phase 2 elapsed: {elapsed/60:.1f} min")
        print(f"  Output: {sz_mb:.1f} MB, {int(dur//3600)}h {int((dur%3600)//60):02d}m {int(dur%60):02d}s")
        return mp3_out
    else:
        sys.exit(f"\nFAIL: ffmpeg exit {proc.returncode}")


def main():
    parser = argparse.ArgumentParser(description="DJ-quality mix renderer (per-track loudnorm + long crossfades)")
    parser.add_argument("--input", default=DEFAULT_INPUT, help="Folder of source tracks")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help="Output base path (no extension)")
    parser.add_argument("--xfade", type=int, default=DEFAULT_XFADE, help="Crossfade seconds")
    parser.add_argument("--lufs", type=float, default=DEFAULT_LUFS, help="Target LUFS per track")
    parser.add_argument("--keep-normalized", action="store_true",
                        help="Don't delete the intermediate normalized files after render")
    args = parser.parse_args()

    require_ffmpeg()

    input_dir = Path(args.input).resolve()
    if not input_dir.is_dir():
        sys.exit(f"ERROR: input dir not found: {input_dir}")

    output_base = Path(args.output).resolve()
    output_base.parent.mkdir(parents=True, exist_ok=True)

    work_dir = Path("scratch") / "normalized_v2"

    print()
    print("=" * 60)
    print("DJ MIX RENDERER v2 - Per-track LUFS + long crossfades")
    print("=" * 60)
    print(f"  Source dir : {input_dir}")
    print(f"  Output base: {output_base}")
    print(f"  Target LUFS: {args.lufs}")
    print(f"  Crossfade  : {args.xfade}s")
    print()

    overall_start = time.time()
    normalized = phase1_normalize(input_dir, work_dir, args.lufs)
    if not normalized:
        sys.exit("ERROR: no tracks normalized in Phase 1")
    output_path = phase2_concat(normalized, output_base, args.xfade)

    section("DONE")
    elapsed = time.time() - overall_start
    print(f"  Total time : {elapsed/60:.1f} min")
    print(f"  Output     : {output_path}")
    print()
    print(f"  Tracklist  : {output_base}.tracklist.txt")

    # Write tracklist with cumulative timestamps
    tl_path = output_base.with_suffix(".tracklist.txt")
    cumulative = 0
    with open(tl_path, "w", encoding="utf-8") as f:
        f.write(f"# DJ Mix v2 Tracklist\n")
        f.write(f"# {len(normalized)} tracks, {args.xfade}s crossfades, target {args.lufs} LUFS per track\n\n")
        for i, p in enumerate(normalized, 1):
            dur = probe_duration(p) or 180
            mm, ss = divmod(int(cumulative), 60)
            hh, mm = divmod(mm, 60)
            f.write(f"{i:2d}.  [{hh}:{mm:02d}:{ss:02d}]  {p.stem}  ({int(dur//60)}m {int(dur%60):02d}s)\n")
            cumulative += dur - (args.xfade if i < len(normalized) else 0)

    if not args.keep_normalized:
        print(f"  Cleaning up intermediate files in {work_dir}...")
        try:
            shutil.rmtree(work_dir, ignore_errors=True)
        except Exception:
            pass
    else:
        print(f"  Intermediate files kept in: {work_dir}")

    print()
    print(f"Play it: open {output_path} in VLC or any player.")
    print(f"Or update dj_mode.html's audio src to '/exports/{output_path.name}' and reload.")


if __name__ == "__main__":
    main()
