from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import json, asyncio

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # dev: allow all
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
LOG_PATH = BASE_DIR / "conversations.ndjson"
lock = asyncio.Lock()

@app.post("/log")
async def log_message(req: Request):
    data = await req.json()
    async with lock:
        with LOG_PATH.open("a", encoding="utf-8") as f:
            f.write(json.dumps(data, ensure_ascii=False) + "\n")
    return {"status": "ok"}
