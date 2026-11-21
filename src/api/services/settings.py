"""Runtime, storage, and model settings discovery."""
from __future__ import annotations

import os
import platform
import shutil
import sys

import torch

from ..config import settings
from .artifacts import directory_usage
from .registry import model_capabilities


def _memory_info() -> dict:
    if sys.platform == "win32":
        try:
            import ctypes

            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [
                    ("dwLength", ctypes.c_ulong),
                    ("dwMemoryLoad", ctypes.c_ulong),
                    ("ullTotalPhys", ctypes.c_ulonglong),
                    ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong),
                    ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong),
                    ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
                ]

            stat = MEMORYSTATUSEX()
            stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
            if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat)):
                return {"total_bytes": stat.ullTotalPhys, "available_bytes": stat.ullAvailPhys}
        except Exception:
            pass
    try:
        with open("/proc/meminfo") as f:
            values = {line.split(":")[0]: int(line.split()[1]) * 1024 for line in f if ":" in line}
        return {"total_bytes": values.get("MemTotal"), "available_bytes": values.get("MemAvailable")}
    except Exception:
        return {"total_bytes": None, "available_bytes": None}


def runtime_info() -> dict:
    try:
        import transformers

        transformers_version = transformers.__version__
    except Exception:
        transformers_version = None
    return {
        "app_version": settings.version,
        "python_version": platform.python_version(),
        "torch_version": torch.__version__,
        "transformers_version": transformers_version,
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "cuda_available": bool(torch.cuda.is_available()),
        "cpu_count": os.cpu_count(),
        "threads": torch.get_num_threads(),
        "platform": platform.platform(),
    }


def storage_info() -> dict:
    art_bytes, art_files = directory_usage(settings.artifact_root)
    data_bytes, data_files = directory_usage(settings.data_root)
    try:
        usage = shutil.disk_usage(settings.artifact_root)
        disk_total, disk_free = usage.total, usage.free
    except OSError:
        disk_total, disk_free = None, None
    return {
        "artifact_root": str(settings.artifact_root),
        "artifact_bytes": art_bytes,
        "artifact_files": art_files,
        "data_root": str(settings.data_root),
        "data_bytes": data_bytes,
        "data_files": data_files,
        "disk_total_bytes": disk_total,
        "disk_free_bytes": disk_free,
    }


def settings_payload() -> dict:
    return {
        "runtime": runtime_info(),
        "memory": _memory_info(),
        "storage": storage_info(),
        "models": model_capabilities(),
    }
