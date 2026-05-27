# PARTY NIGHT RUNBOOK — Friday 29 May 2026

**Keep this file open on your laptop the whole evening.**

---

## 1. Before leaving the house (30 min before)

```powershell
cd C:\Users\user\ANTIGRAVITY1
PowerShell -ExecutionPolicy Bypass -File scripts\party_lockdown.ps1
```

This disables sleep, mutes notifications, shows battery, lists audio devices.

### Manual checks Windows can't do
- Click the **bell icon** in the Windows tray (bottom-right) → **Focus Assist** → **Alarms only**
- Right-click the **speaker icon** in the tray → **Sound settings** → check the default output device matches your AUX/HDMI port

### Pack list (laminate this section)
- [ ] Laptop (battery ≥80%)
- [ ] Laptop charger
- [ ] Phone (battery ≥80%) with backup MP3 in WhatsApp self-chat
- [ ] Phone charger
- [ ] USB stick with `party_29may_v2.mp3` on it
- [ ] AUX cable (3.5mm to 3.5mm)
- [ ] 3.5mm-to-RCA adapter
- [ ] 3.5mm-to-XLR adapter
- [ ] This runbook (printed or on phone)

---

## 2. At the venue — first 5 minutes

1. Plug laptop into the venue's PA via AUX (or RCA/XLR adapter as needed)
2. Volume on laptop: **30%** to start
3. Open File Explorer → `C:\Users\user\ANTIGRAVITY1\public\exports`
4. Confirm `party_29may_v2.mp3` is there (557 MB, 4 hours)
5. **Test playback at low volume** — does sound come out? If yes, keep going. If no, troubleshoot below.

---

## 3. To play (4 options — pick what works)

### Option A — REAL DJ MODE (recommended — true DJ feel)
1. Make sure Next.js dev server is running (section 5)
2. In Chrome: **http://localhost:3000/dj_live.html**
3. Click anywhere → Deck A loads track 1, plays from 0:02 (skips silence)
4. Press **F** for fullscreen
5. **Auto-mix is ON by default** — when each track has 14 sec left, it automatically:
   - Sweeps lowpass filter open on incoming track (lifts the veil)
   - Kills bass on outgoing track (-40 dB shelf)
   - Sweeps highpass up on outgoing (thins it out)
   - Crossfades gain over 12 seconds
   - That's a real filter-swap DJ transition, executed live in your browser
6. Press **M** to MIX NOW (early transition if a track is dragging)
7. Press **T** to jump to any track from audience requests
8. Use the 8 FX pads, tempo nudge, and EQ knobs to add live performance

**This is the DJ mode you want.** Pre-rendered mp3 files can never sound like this because the filter sweeps are computed in real-time per transition.

### Option B — VLC (simplest, no server needed)
1. Double-click `party_29may_v2.mp3` → opens in default media player
2. Hit play, skip first 50 sec
3. Done — pre-rendered 4 hours, no live controls

### Option C — DJ mode with rendered file (mid-tier)
1. In Chrome: **http://localhost:3000/dj_mode.html** (uses v4.mp3)
2. FX pads + tempo nudge + tracklist work, but transitions are pre-baked
3. Falls back to this if dj_live.html has loading issues with the webm files

### Option D — DJ performance mode original (original interface)
1. In Chrome, open: **http://localhost:3000/dj_mode.html**
   (Backend + frontend must be running — see section 5 if not)
2. Click **▶ PLAY** — it auto-skips the ad and starts at 0:50
3. Press **F** for fullscreen
4. **Live controls during the night:**

| Key | Effect |
|---|---|
| **Space** | Play/Pause |
| **← / →** | Skip back/forward 15 sec |
| **↑ / ↓** | Tempo ±0.5% (push tempo up for peak energy) |
| **R** | Reset tempo |
| **T** | Tracklist overlay — search + click to jump to any track (audience requests) |
| **1** | Kick drum |
| **2** | Snare |
| **3** | Hi-hat |
| **4** | Clap |
| **5** | **Air horn** (use at hype moments) |
| **6** | **Riser** (2-sec build, press right before a drop) |
| **7** | **Drop** (sub-bass impact, press at the bass drop) |
| **8** | Scratch |

**Pro combo for peak energy moments**: press **6** for 2 seconds, then **7** when the next track's bass hits, then **5** for celebration.

### Option C — Backup (if everything fails)
1. Open `party_29may_v2.mp3` from your USB stick
2. Or open it from your phone over WhatsApp self-chat / Drive
3. Same file, same audio. Just no live controls.

---

## 4. If audience requests a song

Open DJ Mode (Option B above) → press **T** → type the track number (1-57) or part of the YouTube ID → click the row → it jumps to that timestamp in the mix.

Tracklist with timestamps: see `tracklist_phone.md` (next file).

---

## 5. If backend/frontend isn't running (only needed for Option B)

You only need this if you want the DJ Mode interface. Option A (VLC) doesn't need any server.

**Window 1** — backend:
```powershell
cd C:\Users\user\ANTIGRAVITY1\backend
python -m uvicorn main:app --reload --port 8765 --host 0.0.0.0
```

**Window 2** — frontend (only if you also want the main PulseMix app, not strictly needed for dj_mode.html):
```powershell
cd C:\Users\user\ANTIGRAVITY1
npm run dev
```

dj_mode.html will also work if you just drag it into Chrome from File Explorer, but the tracklist overlay won't load tracks unless the frontend is running.

---

## 6. Troubleshooting on the night

| Problem | Fix |
|---|---|
| **No sound from laptop** | Right-click speaker icon → Sound settings → switch output device |
| **Sound too quiet on PA** | Raise venue's PA volume first, then laptop. Don't max laptop volume — it adds noise. |
| **Music skips / stutters** | Close Chrome tabs / other apps. Plug into AC. Disable Bluetooth. |
| **DJ Mode page won't load** | Run section 5 commands. Or fall back to VLC (Option A). |
| **Track sounds bad** | Press T → pick a different track → click. |
| **Laptop freezes** | Press USB → open MP3 from USB on someone else's laptop. Or play from phone via Bluetooth speaker. That's why we made backups. |

---

## 7. After the party (Sunday morning)

Restore normal sleep settings:
```powershell
cd C:\Users\user\ANTIGRAVITY1
PowerShell -ExecutionPolicy Bypass -File scripts\party_lockdown.ps1 -Restore
```

---

## What's where

| File | Path | What |
|---|---|---|
| Main mix | `public\exports\party_29may_v2.mp3` | 557 MB, 4h 3min, -10 LUFS |
| Backup mix | `public\exports\party_29may_v1.mka` | 231 MB, hard cuts |
| Source tracks | `public\music\party_29may\*.webm` | All 57 originals |
| DJ interface | `public\dj_mode.html` | Open in Chrome |
| Tracklist | `tracklist_phone.md` | Save to phone |

---

## Repo

https://github.com/bibinsmart007/pulsemix-ai (latest push includes everything)

---

**You're ready. Walk in confident. The hard work is done.**
