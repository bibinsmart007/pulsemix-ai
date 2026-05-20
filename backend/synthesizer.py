import os
import wave
import struct
import math

def generate_loop(filepath: str, bpm: int, duration_sec: float, base_notes: list, style: str):
    """
    Synthesizes a high-fidelity stereo audio loop of a specific BPM and chord progression.
    Uses pure wave and struct modules (zero external dependencies).
    """
    sample_rate = 44100
    num_samples = int(sample_rate * duration_sec)
    
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    # Open stereo, 16-bit PCM WAV file
    wav_file = wave.open(filepath, 'w')
    wav_file.setnchannels(2)
    wav_file.setsampwidth(2)
    wav_file.setframerate(sample_rate)
    
    beat_duration = 60.0 / bpm
    
    # Pre-calculate audio samples to minimize latency
    for i in range(num_samples):
        t = i / sample_rate
        beat_index = int(t / beat_duration)
        beat_t = t % beat_duration
        
        # 1. Synthesize Kick Drum (4-on-the-floor for House/EDM, syncopated for others)
        kick = 0.0
        if style in ["house", "kerala", "bollywood"]:
            # Standard four-on-the-floor
            if beat_t < 0.25:
                # Exponential pitch sweep from 150Hz -> 45Hz
                freq = 150.0 * math.exp(-22.0 * beat_t) + 45.0
                kick = math.sin(2.0 * math.pi * freq * beat_t) * math.exp(-8.0 * beat_t)
        elif style == "afro":
            # Syncopated Afrobeat kick (beat 0 and 2.5)
            is_kick_subbeat = (beat_t < 0.25 and beat_index % 4 in [0, 2]) or (beat_index % 4 == 1 and abs(beat_t - beat_duration*0.5) < 0.12)
            if is_kick_subbeat:
                kt = beat_t if beat_t < 0.25 else (beat_t - beat_duration*0.5)
                freq = 120.0 * math.exp(-25.0 * kt) + 40.0
                kick = math.sin(2.0 * math.pi * freq * kt) * math.exp(-10.0 * kt)
        else: # lofi
            # Hip hop boom-bap pattern (beat 0, and beat 2.5)
            is_kick_beat = (beat_index % 4 == 0 and beat_t < 0.3) or (beat_index % 4 == 2 and beat_t > 0.4 and beat_t < 0.7)
            if is_kick_beat:
                kt = beat_t if beat_t < 0.3 else (beat_t - 0.5)
                freq = 110.0 * math.exp(-30.0 * kt) + 38.0
                kick = math.sin(2.0 * math.pi * freq * kt) * math.exp(-12.0 * kt)

        # 2. Synthesize Snare / Percussion (Beats 2 and 4)
        snare = 0.0
        is_snare_beat = (beat_index % 4 in [1, 3])
        if is_snare_beat and beat_t < 0.18:
            # Deterministic noise burst
            noise = (math.sin(i * 0.05) * math.cos(i * 0.08) * 1234.56 % 2.0) - 1.0
            snare = noise * math.exp(-16.0 * beat_t) * 0.3
            
        # 3. Synthesize Bassline (Tuned to base notes representing Camelot chord progression)
        # Select chord based on 4-beat bar
        chord_idx = (beat_index // 4) % len(base_notes)
        root_freq = base_notes[chord_idx]
        
        bass = 0.0
        if style in ["house", "kerala", "bollywood"]:
            # Bouncing eighth note bassline
            eighth_t = t % (beat_duration / 2)
            # Sawtooth-like wave for rich harmonic mix
            bass_saw = 0.0
            for harmonic in range(1, 4):
                bass_saw += (1.0 / harmonic) * math.sin(2.0 * math.pi * (root_freq * harmonic) * t)
            bass = bass_saw * 0.22 * math.exp(-4.0 * eighth_t)
        else:
            # Warm sub-bass/sine bass
            bass = math.sin(2.0 * math.pi * root_freq * t) * 0.26
            
        # 4. Synthesize Melodic Arpeggio
        melody = 0.0
        # 16th note arpeggiator index
        arp_step = int(beat_t / (beat_duration / 4)) % 4
        # Chord voicings (root, minor/major third, fifth, octave)
        is_minor = "m" in style or style == "lofi" or style == "house"
        third_mult = 1.1892 if is_minor else 1.2599 # Eb vs E in C
        voicing = [1.0, third_mult, 1.4983, 2.0]
        
        mel_freq = root_freq * 2.0 * voicing[arp_step]
        
        # Generate clean synth pluck
        arp_t = beat_t % (beat_duration / 4)
        if beat_index % 8 < 6: # Rest every 6th/7th bar for melodic space
            melody = math.sin(2.0 * math.pi * mel_freq * t) * math.exp(-12.0 * arp_t) * 0.14
            
        # 5. Dynamic Hi-Hats (Eighth notes)
        hat = 0.0
        hat_t = t % (beat_duration / 2)
        if hat_t < 0.04:
            noise = (math.sin(i * 1.5) % 2.0) - 1.0
            hat = noise * math.exp(-80.0 * hat_t) * 0.08

        # Combine channels with proper headrooms
        mix_left = (kick * 0.45) + (snare * 0.28) + (bass * 0.3) + (melody * 0.18) + (hat * 0.08)
        mix_right = (kick * 0.45) + (snare * 0.24) + (bass * 0.3) + (melody * 0.22) + (hat * 0.12)
        
        # Soft limiter
        mix_left = max(-1.0, min(1.0, mix_left))
        mix_right = max(-1.0, min(1.0, mix_right))
        
        # Convert to 16-bit PCM bytes
        val_l = int(mix_left * 32767)
        val_r = int(mix_right * 32767)
        
        packed_val = struct.pack('hh', val_l, val_r)
        wav_file.writeframes(packed_val)
        
    wav_file.close()
    print(f"[Synthesizer] Generated synthetic track: {filepath}")

def generate_preset_library(music_dir: str):
    """
    Generates the five preset loop files in the music directory.
    Uses standard key base frequencies (A=440Hz).
    """
    print(f"[Synthesizer] Building preset libraries in {music_dir}...")
    
    # 1. Titanium Beats (128 BPM, 8A - A Minor, Am -> C -> G -> F)
    # A2=110Hz, C3=130.81Hz, G2=98Hz, F2=87.31Hz
    generate_loop(
        filepath=os.path.join(music_dir, "titanium_beats.mp3"), # Named .mp3, is standard high quality WAV
        bpm=128,
        duration_sec=20.0,
        base_notes=[110.0, 130.81, 98.0, 87.31],
        style="house"
    )
    
    # 2. Afrobeats Sunset (105 BPM, 6B - Bb Major, Bb2=116.54Hz, Gm2=98Hz, Dm2=73.42Hz, F2=87.31Hz)
    generate_loop(
        filepath=os.path.join(music_dir, "afrobeats_sunset.mp3"),
        bpm=105,
        duration_sec=24.0,
        base_notes=[116.54, 98.0, 73.42, 87.31],
        style="afro"
    )
    
    # 3. Kerala Boat Club (126 BPM, 8B - C Major, C3=130.81Hz, Am2=110Hz, F2=87.31Hz, G2=98Hz)
    generate_loop(
        filepath=os.path.join(music_dir, "kerala_boat_club.mp3"),
        bpm=126,
        duration_sec=20.0,
        base_notes=[130.81, 110.0, 87.31, 98.0],
        style="kerala"
    )
    
    # 4. Bollywood Bounce (120 BPM, 11A - F# Minor, F#2=92.5Hz, D2=73.42Hz, A2=110Hz, E2=82.41Hz)
    generate_loop(
        filepath=os.path.join(music_dir, "bollywood_bounce.mp3"),
        bpm=120,
        duration_sec=22.0,
        base_notes=[92.5, 73.42, 110.0, 82.41],
        style="bollywood"
    )
    
    # 5. Lo-Fi Raindrops (85 BPM, 5A - C Minor, C2=65.41Hz, Ab2=87.31Hz, Eb2=77.78Hz, Bb2=116.54Hz)
    generate_loop(
        filepath=os.path.join(music_dir, "lofi_raindrops.mp3"),
        bpm=85,
        duration_sec=28.0,
        base_notes=[65.41, 87.31, 77.78, 116.54],
        style="lofi"
    )

if __name__ == "__main__":
    # Test script run
    target = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "music")
    generate_preset_library(target)
