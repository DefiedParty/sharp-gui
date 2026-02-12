"""Detect CUDA version supported by the NVIDIA driver.

Parses nvidia-smi output to find the CUDA version.
Prints the version (e.g. '12.4') to stdout, or nothing if not found.

Used by install.bat/install.sh to avoid batch escaping issues.
"""
import subprocess
import re
import sys

try:
    output = subprocess.check_output(
        ["nvidia-smi"], text=True, stderr=subprocess.DEVNULL
    )
    match = re.search(r"CUDA Version:\s*([\d.]+)", output)
    if match:
        print(match.group(1))
except Exception:
    pass
