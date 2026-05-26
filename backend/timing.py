import json

def resolve_snapped_boundaries(item: dict, auto_phrase_snap: bool = True) -> dict:
    """
    Takes a playlist item dictionary and calculates the mathematically correct 
    trim_start_ms and trim_end_ms based on phrase marker snapping logic.
    Returns a new dictionary with the resolved boundaries.
    """
    resolved_item = item.copy()
    
    start_ms = resolved_item.get("trim_start_ms") or 0.0
    duration_sec = resolved_item.get("duration") or 0.0
    track_duration_ms = duration_sec * 1000.0
    end_ms = resolved_item.get("trim_end_ms") or track_duration_ms
    
    phrase_snap_override = resolved_item.get("phrase_snap_override")
    should_snap = auto_phrase_snap
    if phrase_snap_override == 'Force Snap':
        should_snap = True
    elif phrase_snap_override == 'Force Manual':
        should_snap = False
        
    downbeat_conf = resolved_item.get("downbeat_confidence") or 0.0
    snapped_reason = None
    used_confidence_fallback = False

    if should_snap:
        if downbeat_conf > 0.4:
            try:
                phrase_data = resolved_item.get("phrase_markers", "[]")
                if isinstance(phrase_data, str):
                    phrases = json.loads(phrase_data)
                else:
                    phrases = phrase_data
                    
                if phrases and len(phrases) > 1:
                    phrase_ms = [p * 1000 for p in phrases]
                    
                    # Snap start
                    if resolved_item.get("trim_start_ms", 0) > 0:
                        start_ms = min(phrase_ms, key=lambda x: abs(x - start_ms))
                    else:
                        # Find first musically safe phrase (e.g. > 15s in)
                        safe_entries = [p for p in phrase_ms if p > 15000]
                        if safe_entries:
                            start_ms = safe_entries[0]
                            
                    # Snap end
                    if resolved_item.get("trim_end_ms", 0) > 0:
                        end_ms = min(phrase_ms, key=lambda x: abs(x - end_ms))
                    else:
                        # Find last safe exit phrase before outro
                        safe_exits = [p for p in phrase_ms if p < track_duration_ms - 15000]
                        if safe_exits:
                            end_ms = safe_exits[-1]
                            
                    if start_ms != (resolved_item.get("trim_start_ms") or 0.0) or end_ms != (resolved_item.get("trim_end_ms") or track_duration_ms):
                        snapped_reason = f"Phrase Snapped (Conf {round(downbeat_conf, 2)})"
                else:
                    # Empty phrases
                    used_confidence_fallback = True
                    snapped_reason = "Manual (Low Confidence Fallback)"
            except Exception as e:
                print(f"[Timing Engine] Phrase snapping error: {e}")
                used_confidence_fallback = True
                snapped_reason = "Manual (Low Confidence Fallback)"
        else:
            # Low confidence
            used_confidence_fallback = True
            snapped_reason = "Manual (Low Confidence Fallback)"

    resolved_item["trim_start_ms"] = start_ms
    resolved_item["trim_end_ms"] = end_ms
    resolved_item["snapped_reason"] = snapped_reason
    resolved_item["used_confidence_fallback"] = used_confidence_fallback
    return resolved_item
