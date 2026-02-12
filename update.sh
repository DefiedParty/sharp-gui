#!/usr/bin/env bash
# Sharp GUI Auto-Update Script
# Usage:
#   ./update.sh            Update to latest stable release
#   ./update.sh --pre      Include pre-releases
#   ./update.sh --check    Check only, don't download

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Try venv Python first, then system Python
if [ -f "$SCRIPT_DIR/venv/bin/python" ]; then
    "$SCRIPT_DIR/venv/bin/python" "$SCRIPT_DIR/tools/update.py" "$@"
elif command -v python3 &>/dev/null; then
    python3 "$SCRIPT_DIR/tools/update.py" "$@"
elif command -v python &>/dev/null; then
    python "$SCRIPT_DIR/tools/update.py" "$@"
else
    echo "[错误] 未找到 Python，请先运行 ./install.sh 安装"
    exit 1
fi
