"""
api.py
───────
FastAPI REST server for the Episodic Intelligence Engine.

Endpoints:
  POST /analyse        – run full pipeline for a story idea
  GET  /health         – health check
  GET  /functions      – list available narrative functions
  GET  /schema         – return the JSON schema for EngineRequest

All request/response bodies are validated via Pydantic (the same schemas
used by all internal modules), ensuring end-to-end type safety.
"""

from __future__ import annotations
import json
import time
import os

# ── Load .env FIRST, before importing any project modules ──────────────────
# This ensures LLM_API_KEY reaches llm_client.py before it reads os.environ
try:
    from dotenv import load_dotenv as _load_dotenv
    import pathlib as _pathlib
    _load_dotenv(dotenv_path=_pathlib.Path(__file__).parent / ".env", override=False)
except ImportError:
    pass  # python-dotenv not installed — rely on system env vars
# ───────────────────────────────────────────────────────────────────────
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware

from schemas import EngineRequest, EngineResponse
from pipeline_orchestrator import run_pipeline
from utils.narrative_functions import NARRATIVE_FUNCTION_CATALOGUE


# ─────────────────────────── App Setup ────────────────────────────────────

app = FastAPI(
    title="Episodic Intelligence Engine",
    description=(
        "AI-powered backend that breaks a story idea into a structured "
        "5-8 episode arc, analyses emotional progression, scores cliffhanger "
        "strength, predicts retention risk, and suggests improvements."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────── Routes ───────────────────────────────────────

_FRONTEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend.html")

@app.get("/", include_in_schema=False)
def serve_frontend():
    """Serve the test frontend."""
    return FileResponse(_FRONTEND, media_type="text/html")


@app.get("/health", tags=["System"])
def health():
    """Quick liveness check."""
    from utils.llm_client import DEMO_MODE
    return {
        "status": "ok",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "mode": "demo" if DEMO_MODE else "live-llm",
    }


@app.get("/functions", tags=["System"])
def list_narrative_functions():
    """Return the catalogue of available narrative functions."""
    return {"narrative_functions": NARRATIVE_FUNCTION_CATALOGUE}


@app.get("/schema", tags=["System"])
def get_schema():
    """Return the JSON schema for the request body."""
    return JSONResponse(content=EngineRequest.model_json_schema())


@app.post("/analyse", response_model=EngineResponse, tags=["Engine"])
def analyse(request: EngineRequest):
    """
    Run the full Episodic Intelligence Pipeline on a story idea.

    ### What this does
    1. **Arc Breaker** – Structures the idea into 5-8 episodes with narrative functions
    2. **Plot Node Expander** – Adds SVO-triplet micro-events per episode
    3. **Emotional Analyser** – Scores valence, intensity, surprise, empathy
    4. **Cliffhanger Scorer** – Rates hook strength per episode ending
    5. **Retention Predictor** – Predicts drop-off risk within 90-second episodes
    6. **Improvement Suggestor** – Generates structured recommendations

    ### Example request
    ```json
    {
      "story_idea": "A delivery driver discovers that the packages she's been 
                     delivering contain memories stolen from people.",
      "desired_episodes": 6,
      "genre": "sci-fi thriller"
    }
    ```
    """
    try:
        response = run_pipeline(request)
        return response
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ─────────────────────────── Entry point ──────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
