import os
import re
import random
import yt_dlp
import urllib.parse

# Canned mock tracks matching requested genres for fast offline fallback testing
MOCK_TRACKS = [
    {
        "id": "mock_titanium",
        "title": "Titanium Beats - Synthwave Dream",
        "duration": 180,
        "thumbnail": "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300",
        "filename": "titanium_beats.mp3",
        "bpm": 128,
        "key": "8A",
        "genre": "Synthwave / EDM",
        "url": "/music/titanium_beats.mp3"
    },
    {
        "id": "mock_sunset",
        "title": "Afrobeats Sunset - Chill Groove",
        "duration": 165,
        "thumbnail": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300",
        "filename": "afrobeats_sunset.mp3",
        "bpm": 105,
        "key": "6B",
        "genre": "Afrobeat",
        "url": "/music/afrobeats_sunset.mp3"
    },
    {
        "id": "mock_kerala",
        "title": "Kerala Boat Club - Malayalam EDM Fusion",
        "duration": 195,
        "thumbnail": "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=300",
        "filename": "kerala_boat_club.mp3",
        "bpm": 126,
        "key": "8B",
        "genre": "Malayalam Fusion",
        "url": "/music/kerala_boat_club.mp3"
    },
    {
        "id": "mock_bollywood",
        "title": "Bollywood Bounce - Desi Electro Mashup",
        "duration": 210,
        "thumbnail": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300",
        "filename": "bollywood_bounce.mp3",
        "bpm": 120,
        "key": "11A",
        "genre": "Bollywood",
        "url": "/music/bollywood_bounce.mp3"
    },
    {
        "id": "mock_lofi",
        "title": "Lo-Fi Raindrops - Chill Study Session",
        "duration": 150,
        "thumbnail": "https://images.unsplash.com/photo-1518173946687-a4c8a383392f?w=300",
        "filename": "lofi_raindrops.mp3",
        "bpm": 85,
        "key": "5A",
        "genre": "Lo-Fi",
        "url": "/music/lofi_raindrops.mp3"
    }
]

def get_fallback_track(url_or_query: str) -> dict:
    """Returns a random or matching fallback track if yt-dlp fails."""
    query = url_or_query.lower()
    
    # Try to match genre keywords in query
    for track in MOCK_TRACKS:
        if track["genre"].lower() in query or track["id"] in query:
            return track
            
    # Return random track
    track = random.choice(MOCK_TRACKS).copy()
    # Scramble the id slightly if needed
    track["id"] = f"{track['id']}_{random.randint(100, 999)}"
    return track

def clean_youtube_url(url: str) -> str:
    """Extract clean video ID to prevent command injection or formatting errors."""
    try:
        parsed = urllib.parse.urlparse(url)
        # Check hostname
        if parsed.hostname in ('www.youtube.com', 'youtube.com'):
            query = urllib.parse.parse_qs(parsed.query)
            video_id = query.get('v', [None])[0]
        elif parsed.hostname == 'youtu.be':
            video_id = parsed.path.lstrip('/')
        else:
            video_id = None
            
        if video_id and re.match(r'^[0-9A-Za-z_-]{11}$', video_id):
            return f"https://www.youtube.com/watch?v={video_id}"
            
    except Exception:
        pass
    return url

def resolve_youtube_audio(youtube_url: str, output_dir: str) -> dict:
    """
    Extracts audio stream link and download track to the Next.js static asset folder.
    Falls back gracefully to premium mock tracks if offline or yt-dlp fails.
    """
    os.makedirs(output_dir, exist_ok=True)
    
    cleaned_url = clean_youtube_url(youtube_url)
    
    # Force mock fallback if it contains a mock prefix
    if "mock" in cleaned_url.lower() or not (cleaned_url.startswith("http://") or cleaned_url.startswith("https://")):
        print(f"[Extractor] Forcing mock fallback for query: {youtube_url}")
        return get_fallback_track(youtube_url)

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': os.path.join(output_dir, '%(id)s.%(ext)s'),
        'noplaylist': True,
        'quiet': True,
        'no_warnings': True,
        'ignoreerrors': False,
    }

    try:
        print(f"[Extractor] Extracting audio stream from YouTube: {cleaned_url}")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(cleaned_url, download=True)
            video_id = info.get('id')
            title = info.get('title')
            duration = info.get('duration', 180)
            thumbnail = info.get('thumbnail', 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300')
            ext = info.get('ext', 'mp3')
            
            filename = f"{video_id}.{ext}"
            filepath = os.path.join(output_dir, filename)
            
            # Simple BPM and Key generation based on title/id hashes for quick extraction
            # This will be refined by librosa in the analyzer.py if it is active
            random.seed(video_id)
            bpm = random.choice([120, 122, 124, 126, 128, 130])
            key = random.choice(["8A", "9A", "7A", "8B", "9B", "5A", "6A", "10A", "11A"])

            return {
                "id": video_id,
                "title": title,
                "duration": duration,
                "thumbnail": thumbnail,
                "filename": filename,
                "filepath": filepath,
                "bpm": bpm,
                "key": key,
                "url": f"/downloads/{filename}",
                "genre": "YouTube Stream"
            }
    except Exception as e:
        print(f"[Extractor] yt-dlp failed or was offline ({str(e)}). Serving robust fallback track.")
        return get_fallback_track(youtube_url)
