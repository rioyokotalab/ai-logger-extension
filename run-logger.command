#!/usr/bin/env bash
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

source .venv/bin/activate

pip install -q fastapi uvicorn "uvicorn[standard]"

echo "Starting AI Logger server on http://127.0.0.1:8788 ..."
uvicorn logger_server:app --host 127.0.0.1 --port 8788
