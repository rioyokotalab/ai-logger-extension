@echo off
cd /d "%~dp0"

REM Create venv if missing
if not exist ".venv" (
    python -m venv .venv
)

call .venv\Scripts\activate.bat

pip install --quiet fastapi uvicorn "uvicorn[standard]"

echo Starting AI Logger server on http://127.0.0.1:8788 ...
uvicorn logger_server:app --host 127.0.0.1 --port 8788
pause
