import math
from typing import List, Dict, Any

def clean_key(key: str) -> str:
    if not key:
        return ""
    return key.replace(" (?)", "").strip().upper()

def are_keys_compatible(keyA: str, keyB: str) -> int:
    """
    Returns score level:
    3 = Perfect match
    2 = Harmonic match (relative or adjacent)
    1 = Compatible (diagonal/farther but safe)
    0 = Incompatible
    """
    kA = clean_key(keyA)
    kB = clean_key(keyB)
    
    if not kA or not kB:
        return 0
        
    if kA == kB:
        return 3
        
    try:
        numA = int(kA[:-1])
        numB = int(kB[:-1])
        letterA = kA[-1]
        letterB = kB[-1]
    except ValueError:
        return 0
        
    # Relative major/minor (e.g. 8A <-> 8B)
    if numA == numB and letterA != letterB:
        return 2
        
    # Adjacent numbers on the wheel (same letter)
    if letterA == letterB:
        diff = abs(numA - numB)
        if diff == 1 or diff == 11:
            return 2
            
    # Diagonal compatibility (e.g. 8A -> 9B or 8A -> 7B)
    if letterA != letterB:
        diff = abs(numA - numB)
        if diff == 1 or diff == 11:
            return 1
            
    return 0

def score_candidates(base_track: Dict[str, Any], library: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    candidates = []
    
    base_bpm = base_track.get("bpm")
    base_key = base_track.get("key_signature")
    base_status = base_track.get("analysis_status", "pending")
    
    for target in library:
        if target["youtube_url"] == base_track["youtube_url"]:
            continue # Skip self
            
        target_bpm = target.get("bpm")
        target_key = target.get("key_signature")
        target_status = target.get("analysis_status", "pending")
        
        score = 0
        reasons = []
        
        # 1. Key Scoring (Max 45)
        key_score_map = {3: 45, 2: 30, 1: 10, 0: 0}
        key_match = are_keys_compatible(base_key, target_key)
        score += key_score_map[key_match]
        
        if key_match == 3:
            reasons.append(f"Perfect Key Match ({clean_key(target_key)})")
        elif key_match == 2:
            reasons.append(f"Harmonic Match ({clean_key(base_key)} → {clean_key(target_key)})")
        elif key_match == 1:
            reasons.append(f"Compatible Key ({clean_key(base_key)} → {clean_key(target_key)})")
        else:
            reasons.append(f"Key Clash ({clean_key(base_key)} 💥 {clean_key(target_key)})")
            
        # 2. BPM Scoring (Max 35)
        diff_pct = 100.0
        if base_bpm and target_bpm and base_bpm > 0:
            diff_pct = abs(target_bpm - base_bpm) / base_bpm * 100.0
            if diff_pct <= 2.0:
                score += 35
                reasons.append(f"Seamless Tempo ({diff_pct:.1f}% drift)")
            elif diff_pct <= 5.0:
                score += 25
                reasons.append(f"Safe Tempo Stretch ({diff_pct:.1f}% drift)")
            elif diff_pct <= 8.0:
                score += 15
                reasons.append(f"Moderate Stretch ({diff_pct:.1f}% drift)")
            else:
                score += 0
                reasons.append(f"⚠️ High Stretch Risk ({diff_pct:.1f}% drift)")
        else:
            reasons.append("⚠️ Missing BPM")
            
        # 3. Confidence/Reliability (Max 20)
        if base_status == 'completed' and target_status == 'completed':
            score += 20
        elif target_status == 'low_confidence':
            score += 5
            reasons.append("⚠️ Low Confidence Data")
        else:
            score += 0
            
        # 4. Transition Suggestion & Feasibility Bonus (Max 10)
        suggestion = {
            "sync_mode": "auto",
            "fade_curve": "equal_power",
            "eq_mode": "none",
            "crossfade_duration_ms": 2000,
            "duck_amount_db": 0.0
        }
        
        if diff_pct <= 2.0:
            suggestion["sync_mode"] = "off"
            suggestion["crossfade_duration_ms"] = 4000
            suggestion["eq_mode"] = "smooth_blend"
            score += 10 # Ideal condition
            reasons.append("Ideal for Smooth Blend")
        elif diff_pct <= 8.0:
            suggestion["sync_mode"] = "auto"
            suggestion["crossfade_duration_ms"] = 2000
            suggestion["duck_amount_db"] = -3.0
            suggestion["eq_mode"] = "bass_swap"
            score += 5
            reasons.append("Ideal for Bass Swap")
        else:
            suggestion["sync_mode"] = "off" # Too much stretch, disable sync
            suggestion["fade_curve"] = "linear"
            suggestion["crossfade_duration_ms"] = 1000
            suggestion["eq_mode"] = "soft_exit"
            reasons.append("Requires Hard Cut / Soft Exit")
            
        candidates.append({
            "track": target,
            "score": score,
            "reasons": reasons,
            "suggestion": suggestion
        })
        
    # Sort by score descending
    candidates.sort(key=lambda x: x["score"], reverse=True)
    return candidates
