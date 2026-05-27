"""
check_setup.py - PulseMix-AI pre-flight verifier.

Run BEFORE Wednesday's library-loading session to catch broken plumbing early.
Exits 0 if all critical checks pass, 1 if any FAIL.

Usage (PowerShell, from repo root):
  python scripts\\check_setup.py
  python scripts\\check_setup.py --verbose      # show command output for each probe
  python scripts\\check_setup.py --fix-nulls    # auto-strip trailing null bytes from .py files

Checks:
  1.  Python version (>=3.10 recommended)
  2.  ffmpeg + ffprobe on PATH
  3.  Node + npm
  4.  Critical Python packages: fastapi, uvicorn, pydub, numpy, scipy,
        librosa, soundfile, pyloudnorm, yt_dlp
  5.  All backend/*.py compile (catches null-byte corruption + truncations)
  6.  No trailing null bytes in any .py / .ts / .tsx
  7.  metadata.db exists + has expected tables
  8.  public/{music,downloads,exports,previews} exist
  9.  Functional smoke: import normalize_loudness, run on 1s synthetic audio
  10. Disk space in repo (need >2GB free for renders)
"""
from __future__ import annotations
import argparse
import importlib
import os
import shutil
import sqlite3
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
PUBLIC_DIR = REPO_ROOT / "public"
DB_PATH = BACKEND_DIR / "metadata.db"

# ANSI colors (Windows 10+ PowerShell supports these)
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

# Enable ANSI on Windows
if os.name == "nt":
    try:
        import ctypes
        kernel32 = ctypes.windll.kernel32
        kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
    except Exception:
        GREEN = RED = YELLOW = CYAN = BOLD = RESET = ""

REQUIRED_PACKAGES = [
    ("fastapi", "fastapi"),
    ("uvicorn", "uvicorn"),
    ("pydub", "pydub"),
    ("numpy", "numpy"),
    ("scipy", "scipy"),
    ("librosa", "librosa"),
    ("soundfile", "soundfile"),
    ("pyloudnorm", "pyloudnorm"),
    ("yt-dlp", "yt_dlp"),
]

EXPECTED_TABLES = {"tracks", "playlists", "playlist_items"}

# Tracking
results = []  # list of (status, label, message, fix)


def record(status: str, label: str, message: str = "", fix: str = ""):
    results.append((status, label, message, fix))
    color = {"PASS": GREEN, "WARN": YELLOW, "FAIL": RED}[status]
    icon = {"PASS": "✓", "WARN": "!", "FAIL": "✗"}[status]
    line = f"  {color}[{icon} {status}]{RESET} {label}"
    if message:
        line += f": {message}"
    print(line)
    if fix and status != "PASS":
        for fix_line in fix.split("\n"):
            print(f"        {CYAN}-> {fix_line}{RESET}")


def section(title: str):
    print(f"\n{BOLD}{CYAN}== {title} =={RESET}")


# ----------------------------------------------------------------------
# Checks
# ----------------------------------------------------------------------

def check_python_version():
    v = sys.version_info
    label = f"Python {v.major}.{v.minor}.{v.micro}"
    if v >= (3, 10):
        record("PASS", label)
    elif v >= (3, 8):
        record("WARN", label, "older than recommended 3.10",
               "Upgrade to Python 3.10+ when convenient (not party-blocking).")
    else:
        record("FAIL", label, "too old",
               "Install Python 3.10+ from python.org")


def check_binary(name: str):
    path = shutil.which(name)
    if path:
        # On Windows, .CMD / .BAT files need shell=True to be executed by subprocess.
        # ffmpeg uses -version; node/npm use --version.
        use_shell = path.lower().endswith((".cmd", ".bat"))
        last_err = None
        for flag in ("--version", "-version"):
            try:
                if use_shell:
                    out = subprocess.check_output(f'"{path}" {flag}', stderr=subprocess.STDOUT,
                                                  text=True, timeout=5, shell=True)
                else:
                    out = subprocess.check_output([path, flag], stderr=subprocess.STDOUT,
                                                  text=True, timeout=5)
                first = out.splitlines()[0] if out.splitlines() else "(no output)"
                record("PASS", name, f"{path} | {first}")
                return
            except Exception as e:
                last_err = e
        record("WARN", name, f"on PATH at {path} but version probe failed: {last_err}")
    else:
        fixes = {
            "ffmpeg": "winget install Gyan.FFmpeg   OR   choco install ffmpeg\nThen restart PowerShell.",
            "ffprobe": "Same as ffmpeg (ffprobe ships with it).",
            "node": "winget install OpenJS.NodeJS.LTS",
            "npm": "Comes with node. Install Node.js LTS.",
        }
        record("FAIL", name, "not found on PATH", fixes.get(name, "Install it and add to PATH"))


def check_package(pkg_name: str, import_name: str):
    try:
        mod = importlib.import_module(import_name)
        ver = getattr(mod, "__version__", "?")
        record("PASS", pkg_name, f"v{ver}")
    except ImportError as e:
        record("FAIL", pkg_name, "not installed",
               f"cd backend && pip install -r requirements.txt\n"
               f"(or: pip install {pkg_name})")
    except Exception as e:
        record("WARN", pkg_name, f"imported but error: {e}")


def check_python_compiles():
    """Catch null-byte corruption + truncations across all backend Python."""
    import py_compile
    files = []
    for root, dirs, fnames in os.walk(BACKEND_DIR):
        if "__pycache__" in root or "tests" in root:
            continue
        for fn in fnames:
            if fn.endswith(".py"):
                files.append(Path(root) / fn)

    failed = []
    for f in files:
        try:
            py_compile.compile(str(f), doraise=True)
        except py_compile.PyCompileError as e:
            failed.append((f, str(e).splitlines()[0]))

    if not failed:
        record("PASS", f"backend Python compiles ({len(files)} files)")
    else:
        for f, err in failed:
            record("FAIL", f"compile: {f.relative_to(REPO_ROOT)}", err,
                   "If 'null bytes' — run: python scripts\\check_setup.py --fix-nulls\n"
                   "If 'invalid syntax at EOF' — file is truncated; check git history.")


def check_no_null_bytes(fix_nulls: bool):
    """Scan source for trailing null bytes. The Cowork file-edit tool padding bug."""
    bad = []
    fixed = []
    for root, dirs, fnames in os.walk(REPO_ROOT):
        # skip noise
        skip_parts = {"node_modules", ".next", "__pycache__", ".git", "scratch"}
        if any(part in root.split(os.sep) for part in skip_parts):
            continue
        for fn in fnames:
            if not fn.endswith((".py", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json")):
                continue
            p = Path(root) / fn
            try:
                data = p.read_bytes()
            except Exception:
                continue
            if not data.endswith(b"\x00"):
                continue
            trailing = len(data) - len(data.rstrip(b"\x00"))
            if fix_nulls:
                stripped = data.rstrip(b"\x00")
                if stripped and not stripped.endswith(b"\n"):
                    stripped += b"\n"
                p.write_bytes(stripped)
                fixed.append((p, trailing))
            else:
                bad.append((p, trailing))

    if fix_nulls:
        if fixed:
            for p, n in fixed:
                print(f"  {GREEN}[fixed]{RESET} stripped {n} null bytes from {p.relative_to(REPO_ROOT)}")
            record("PASS", "null byte sweep", f"auto-fixed {len(fixed)} files")
        else:
            record("PASS", "null byte sweep", "no files needed fixing")
    else:
        if not bad:
            record("PASS", "no trailing null bytes")
        else:
            for p, n in bad:
                rel = p.relative_to(REPO_ROOT)
                record("FAIL", f"null bytes: {rel}", f"{n} trailing",
                       f"python scripts\\check_setup.py --fix-nulls")


def check_database():
    if not DB_PATH.exists():
        record("FAIL", "metadata.db", f"missing at {DB_PATH}",
               "From backend/, run: python -c \"from database import init_db; init_db()\"")
        return
    try:
        conn = sqlite3.connect(str(DB_PATH))
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {row[0] for row in cur.fetchall()}
        cur.execute("SELECT COUNT(*) FROM tracks")
        track_count = cur.fetchone()[0]
        conn.close()

        missing = EXPECTED_TABLES - tables
        if missing:
            record("FAIL", "metadata.db schema", f"missing tables: {sorted(missing)}",
                   "Re-run init_db() to create missing tables.")
        else:
            note = f"{track_count} tracks, {len(tables)} tables"
            record("PASS", "metadata.db", note)
    except Exception as e:
        record("FAIL", "metadata.db", f"can't open: {e}",
               "Check file isn't locked by another process.")


def check_public_dirs():
    needed = ["downloads", "music", "exports", "previews"]
    missing = []
    for d in needed:
        p = PUBLIC_DIR / d
        if not p.exists():
            missing.append(d)
    if not missing:
        record("PASS", "public/ subdirs", "all 4 present")
    else:
        # Auto-create — these are harmless and the backend would create them anyway.
        for d in missing:
            (PUBLIC_DIR / d).mkdir(parents=True, exist_ok=True)
        record("WARN", "public/ subdirs", f"created missing: {missing}")


def check_loudness_smoke():
    """Functional test: can we measure & normalize loudness end-to-end?"""
    try:
        sys.path.insert(0, str(BACKEND_DIR))
        from exporter import normalize_loudness, MASTER_BUS_TARGETS  # type: ignore
        from pydub.generators import Sine
        from pydub import AudioSegment
    except Exception as e:
        record("FAIL", "loudness pipeline import", str(e),
               "Fix backend/exporter.py import errors first.")
        return

    try:
        # 1s of -18 dB sine -> normalize to Balanced (-10 LUFS)
        sample = (Sine(440).to_audio_segment(duration=1500) - 12)
        sample = sample + AudioSegment.silent(duration=200)
        _, meta = normalize_loudness(sample, "Balanced")
        if meta.get("final_lufs") is None:
            record("WARN", "loudness smoke test", "ran but didn't normalize (clip too short?)",
                   "Real party tracks won't trigger this; not a blocker.")
        else:
            delta = abs(meta["final_lufs"] - (-10.0))
            if delta < 1.5:
                record("PASS", "loudness pipeline",
                       f"normalized -> {meta['final_lufs']:+.2f} LUFS (target -10.0)")
            else:
                record("WARN", "loudness pipeline",
                       f"normalized to {meta['final_lufs']:+.2f} but expected near -10",
                       "Investigate before relying on it for the party render.")
    except Exception as e:
        record("FAIL", "loudness smoke test", repr(e),
               "Run the verbose: python -c \"import sys; sys.path.insert(0,'backend'); "
               "from exporter import normalize_loudness\"")


def check_disk_space():
    try:
        total, used, free = shutil.disk_usage(REPO_ROOT)
        free_gb = free / (1024 ** 3)
        if free_gb >= 5:
            record("PASS", "disk space", f"{free_gb:.1f} GB free on {REPO_ROOT.drive or '/'}")
        elif free_gb >= 2:
            record("WARN", "disk space", f"only {free_gb:.1f} GB free",
                   "Clean up before rendering — WAV exports can hit 1GB each.")
        else:
            record("FAIL", "disk space", f"only {free_gb:.1f} GB free",
                   "Free up at least 5GB. Empty C:\\Users\\<you>\\Downloads or clear node_modules.")
    except Exception as e:
        record("WARN", "disk space", f"couldn't measure: {e}")


# ----------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="PulseMix-AI pre-flight check")
    parser.add_argument("--fix-nulls", action="store_true",
                        help="Auto-strip trailing null bytes from .py/.ts files")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    print(f"{BOLD}{CYAN}=========================================={RESET}")
    print(f"{BOLD}{CYAN}  PulseMix-AI Pre-Flight Check{RESET}")
    print(f"{BOLD}{CYAN}=========================================={RESET}")
    print(f"  Repo: {REPO_ROOT}")

    section("1. Runtime")
    check_python_version()
    check_binary("ffmpeg")
    check_binary("ffprobe")
    check_binary("node")
    check_binary("npm")

    section("2. Python packages")
    for pkg, mod in REQUIRED_PACKAGES:
        check_package(pkg, mod)

    section("3. Source code integrity")
    check_no_null_bytes(fix_nulls=args.fix_nulls)
    check_python_compiles()

    section("4. Data + filesystem")
    check_database()
    check_public_dirs()
    check_disk_space()

    section("5. Loudness pipeline (functional)")
    check_loudness_smoke()

    # ---- summary
    print()
    print(f"{BOLD}{CYAN}=========================================={RESET}")
    counts = {"PASS": 0, "WARN": 0, "FAIL": 0}
    for s, *_ in results:
        counts[s] += 1
    print(f"  {GREEN}PASS: {counts['PASS']}{RESET}    "
          f"{YELLOW}WARN: {counts['WARN']}{RESET}    "
          f"{RED}FAIL: {counts['FAIL']}{RESET}")
    print(f"{BOLD}{CYAN}=========================================={RESET}")

    if counts["FAIL"]:
        print(f"\n{RED}{BOLD}NOT READY.{RESET} Fix the FAILs above, then re-run.\n")
        return 1
    elif counts["WARN"]:
        print(f"\n{YELLOW}{BOLD}READY with warnings.{RESET} Review WARNs above; "
              f"safe to start loading the library.\n")
        return 0
    else:
        print(f"\n{GREEN}{BOLD}ALL GREEN.{RESET} Setup is solid. Go load your library.\n")
        return 0


if __name__ == "__main__":
    sys.exit(main())
