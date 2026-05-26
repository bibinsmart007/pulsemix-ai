import random
import copy

def calculate_tempo_alignment(bpm_a, bpm_b, target_bpm):
    diff_a = abs(bpm_a - target_bpm)
    diff_b = abs(bpm_b - target_bpm)
    max_diff = max(diff_a, diff_b)
    
    if max_diff == 0: return 100
    if max_diff <= 2: return 90
    if max_diff <= 5: return 70
    if max_diff <= 10: return 50
    return 30

def calculate_harmonic_fit(key_a, key_b):
    if key_a == "Unknown" or key_b == "Unknown":
        return 50 # Neutral
    if key_a == key_b:
        return 100
    # Simple camelot-like proxy: if letters match or one is relative minor
    if key_a[:-1] == key_b[:-1]: # e.g. 8A and 8B
        return 80
    return 40

def generate_mix_timeline(prompt: str, tracks: list) -> dict:
    """
    Deterministically generates 3 mix timeline variations with confidence scoring.
    """
    if len(tracks) < 2:
        return {"error": "At least 2 tracks are required to generate a mix."}

    valid_tracks = [t for t in tracks if t.get("status") in ["completed", "ready", "from_cache"]]
    if len(valid_tracks) < 2:
        return {"error": "Not enough analyzed tracks to mix."}

    p = prompt.lower()
    
    try:
        sorted_tracks = sorted(valid_tracks, key=lambda x: float(x.get("bpm", 128) or 128))
    except Exception:
        sorted_tracks = valid_tracks

    track_a = sorted_tracks[0]
    track_b = sorted_tracks[1]
    
    bpm_a = float(track_a.get("bpm", 128) or 128)
    bpm_b = float(track_b.get("bpm", 128) or 128)
    
    key_a = track_a.get("key", "Unknown")
    key_b = track_b.get("key", "Unknown")

    all_transitions = ["echo-out", "bass-swap", "reverb-blend", "edm-rise", "fade"]

    def create_variation(vid, vtype, strategy, trans_type, t_bpm, is_energy=False, is_harmonic=False):
        # 1. Calculate subscores
        tempo_score = calculate_tempo_alignment(bpm_a, bpm_b, t_bpm)
        harmonic_score = calculate_harmonic_fit(key_a, key_b)
        
        energy_score = 70
        if is_energy:
            energy_score = 90 if t_bpm > min(bpm_a, bpm_b) else 60
        elif is_harmonic:
            harmonic_score = min(100, harmonic_score + 20) # Boosted artificially for the 'harmonic' attempt
            energy_score = 50
        
        overall_score = round((tempo_score * 0.4) + (harmonic_score * 0.4) + (energy_score * 0.2))
        
        # 2. Determine Tier
        tier = "Experimental"
        if overall_score >= 80: tier = "Strong"
        elif overall_score >= 60: tier = "Good"

        # 3. Generate Attributes
        attrs = []
        if harmonic_score >= 90:
            attrs.append("Perfect harmonic match")
        elif harmonic_score >= 70:
            attrs.append("Compatible key relationship")
        else:
            attrs.append("Key clash possible")
            
        if tempo_score >= 90:
            attrs.append("Natural tempo alignment")
        elif tempo_score < 60:
            attrs.append("Tempo stretch required")
            
        if is_energy and energy_score >= 80:
            attrs.append("High-energy handoff")
        elif is_harmonic:
            attrs.append("Smooth tonal focus")

        # 4. Generate Rationale
        exp = f"Selected {strategy} strategy. "
        exp += f"Synchronized to {t_bpm} BPM. Applying '{trans_type}' transition."

        alts = [t for t in all_transitions if t != trans_type][:3]
        
        return {
            "variation_id": vid,
            "variation_type": vtype,
            "deck_a": track_a,
            "deck_b": track_b,
            "transition_type": trans_type,
            "transition_alternatives": alts,
            "suggested_bpm": t_bpm,
            "strategy": strategy,
            "explanation": exp,
            "overall_score": overall_score,
            "confidence_tier": tier,
            "attributes": attrs,
            "key_relationship": "perfect" if harmonic_score == 100 else "compatible"
        }

    # Primary Variation
    primary_strategy = "smooth blend"
    primary_trans = "echo-out"
    if "club" in p or "hard" in p or "drop" in p:
        primary_strategy = "club transition"
        primary_trans = "bass-swap"
    elif "mashup" in p:
        primary_strategy = "mashup-leaning"
        primary_trans = "reverb-blend"
    elif "energy" in p or "ramp" in p or "build" in p:
        primary_strategy = "energy ramp"
        primary_trans = "edm-rise"

    primary_bpm = max(bpm_a, bpm_b) if primary_strategy == "energy ramp" else round((bpm_a + bpm_b) / 2)
    var_primary = create_variation("primary", "primary", primary_strategy, primary_trans, primary_bpm)

    # Energy Alt
    energy_trans = "edm-rise" if primary_trans != "edm-rise" else "bass-swap"
    energy_bpm = max(bpm_a, bpm_b) + 2
    var_energy = create_variation("energy_alt", "energy_alt", "high energy alternative", energy_trans, energy_bpm, is_energy=True)

    # Harmonic Alt
    harmonic_trans = "fade" if primary_trans != "fade" else "echo-out"
    harmonic_bpm = round((bpm_a + bpm_b) / 2)
    var_harmonic = create_variation("harmonic_alt", "harmonic_alt", "harmonic alternative", harmonic_trans, harmonic_bpm, is_harmonic=True)

    return {
        "success": True,
        "variations": [var_primary, var_energy, var_harmonic]
    }
