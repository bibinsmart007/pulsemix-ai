import numpy as np
from scipy import signal

def apply_eq(samples, sr, mode, channels, is_outgoing=True, frames=None):
    if mode == 'none' or mode == 'smooth_blend':
        return samples
        
    # Reshape if stereo
    if channels == 2:
        s = samples.reshape(-1, 2)
    else:
        s = samples.reshape(-1, 1)
        
    processed = np.zeros_like(s)
    
    if mode == 'bass_swap':
        # Outgoing gets bass cut (high-pass filter)
        if is_outgoing:
            # 250Hz High-pass
            b, a = signal.butter(2, 250 / (sr / 2), btype='high')
            for c in range(channels):
                processed[:, c] = signal.lfilter(b, a, s[:, c])
            return processed.flatten()
        else:
            return samples
            
    elif mode == 'soft_exit':
        # Outgoing gets muffled (low-pass filter sweep down)
        # We achieve the sweep by crossfading from dry to fully LPF'd
        if is_outgoing:
            # 300Hz Low-pass
            b, a = signal.butter(2, 300 / (sr / 2), btype='low')
            for c in range(channels):
                processed[:, c] = signal.lfilter(b, a, s[:, c])
            
            # Crossfade dry -> wet
            t = np.linspace(0, 1, len(s))
            for c in range(channels):
                processed[:, c] = s[:, c] * (1 - t) + processed[:, c] * t
            return processed.flatten()
        else:
            return samples
            
    elif mode == 'vocal_protect':
        # Cut mid frequencies on the incoming track so outgoing vocals stay clear
        if not is_outgoing:
            # Band-stop 300Hz - 3000Hz
            b, a = signal.butter(2, [300 / (sr / 2), 3000 / (sr / 2)], btype='bandstop')
            for c in range(channels):
                processed[:, c] = signal.lfilter(b, a, s[:, c])
            return processed.flatten()
        else:
            return samples

    return samples

print("EQ processing logic written.")
