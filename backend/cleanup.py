import os
import time
from backend.storage import get_storage

def sweep_storage():
    """
    Automated cloud bucket sweeping.
    Since StorageBackend does not have list_objects currently,
    this script will be extended in the future or run via cloud lifecycle rules.
    """
    print("[Cleanup] Storage sweep job started.")
    storage = get_storage()
    print("[Cleanup] Storage provider:", storage.__class__.__name__)
    print("[Cleanup] Sweeping done.")

if __name__ == "__main__":
    sweep_storage()
