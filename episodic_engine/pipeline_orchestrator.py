"""
pipeline_orchestrator.py
──────────────────────────
Central pipeline orchestrator.

Implements the deterministic multi-agent orchestration pattern from 
STORYWRITER §2 ("deterministic orchestrator that sequentially calls 
agents in a predefined order").

Pipeline stages (in order):
  Stage 1 – Arc Breaker           → produces episode arc with narrative functions
  Stage 2 – Plot Node Expander    → adds SVO-triplet CPNs per episode
  Stage 3 – Emotional Analyser    → scores emotional dimensions
  Stage 4 – Cliffhanger Scorer    → scores hook strength
  Stage 5 – Retention Predictor   → predicts drop-off risk
  Stage 6 – Improvement Suggestor → synthesises structured suggestions

Between stages the Coordinator Agent:
  • Compresses context (ReIO-Input)
  • Validates outputs (ReIO-Output)
  • Appends to the pipeline log

All communication between stages uses the StoryArc JSON schema.
"""

from __future__ import annotations
import time
from typing import Callable

from schemas import StoryArc, EngineRequest, EngineResponse
from agents.coordinator_agent import compress_context, validate_output
from services.intelligence_engine import analyse_episodes
from modules import (
    arc_breaker,
    plot_node_expander,
    emotional_analyser,
    cliffhanger_scorer,
    retention_predictor,
    improvement_suggestor,
)


# ─────────────────── Pipeline Stage Definition ────────────────────────────

class PipelineStage:
    """Wraps a module's `run()` function with metadata for the orchestrator."""

    def __init__(self, name: str, run_fn: Callable, description: str):
        self.name        = name
        self.run_fn      = run_fn
        self.description = description


PIPELINE: list[PipelineStage] = [
    PipelineStage(
        name="arc_breaker",
        run_fn=arc_breaker.run,
        description="Breaking premise into structured episode arc",
    ),
    PipelineStage(
        name="plot_node_expander",
        run_fn=plot_node_expander.run,
        description="Expanding plot nodes (SVO triplets) per episode",
    ),
    PipelineStage(
        name="emotional_analyser",
        run_fn=emotional_analyser.run,
        description="Scoring emotional progression across episodes",
    ),
    PipelineStage(
        name="cliffhanger_scorer",
        run_fn=cliffhanger_scorer.run,
        description="Scoring cliffhanger strength per episode",
    ),
    PipelineStage(
        name="retention_predictor",
        run_fn=retention_predictor.run,
        description="Predicting retention risk within 90-second episodes",
    ),
    PipelineStage(
        name="improvement_suggestor",
        run_fn=improvement_suggestor.run,
        description="Generating structured improvement suggestions",
    ),
]


# ─────────────────── Orchestrator ─────────────────────────────────────────

def run_pipeline(request: EngineRequest) -> EngineResponse:
    """
    Execute the full episodic intelligence pipeline for a given story request.

    Parameters
    ----------
    request : EngineRequest with story_idea, desired_episodes, genre.

    Returns
    -------
    EngineResponse containing the fully analysed StoryArc and pipeline log.
    """
    log: list[str] = []
    arc: StoryArc | None = None

    def _log(msg: str) -> None:
        ts = time.strftime("%H:%M:%S")
        entry = f"[{ts}] {msg}"
        log.append(entry)
        print(entry)

    _log(f"=== Episodic Intelligence Engine — START ===")
    _log(f"Premise : {request.story_idea[:80]}...")
    _log(f"Episodes: {request.desired_episodes}  |  Genre: {request.genre or 'auto'}")

    for i, stage in enumerate(PIPELINE):
        stage_num = i + 1
        _log(f"--- Stage {stage_num}/{len(PIPELINE)}: {stage.description} ---")
        t0 = time.time()

        try:
            if stage.name == "arc_breaker":
                # First stage: creates the arc from scratch
                arc = stage.run_fn(
                    premise=request.story_idea,
                    desired_episodes=request.desired_episodes,
                    genre=request.genre,
                )
            else:
                # All other stages receive and mutate the arc
                arc = stage.run_fn(arc)

        except Exception as exc:
            _log(f"  ⚠ Stage {stage.name} FAILED: {exc}")
            raise RuntimeError(f"Pipeline failed at stage '{stage.name}': {exc}") from exc

        elapsed = round(time.time() - t0, 1)
        _log(f"  ✓ Completed in {elapsed}s")

        # Coordinator validation (ReIO-Output pattern)
        if arc is not None:
            validation = validate_output(arc, stage.name)
            if not validation["valid"]:
                for issue in validation.get("issues", []):
                    _log(f"  ⚠ Validation issue: {issue}")
            else:
                _log(f"  ✓ Output validated")

    _log(f"=== Pipeline COMPLETE — {arc.total_episodes} episodes analysed ===")

    # ── Stage 7: Episode Intelligence Engine (text-based, no LLM) ───────────
    _log("--- Stage 7/7: Episode Intelligence Engine (keyword analytics) ---")
    t0 = time.time()
    try:
        # Convert arc to dict, enrich, rebuild
        arc_dict = arc.model_dump()
        arc_dict = analyse_episodes(arc_dict)
        arc = StoryArc(**arc_dict)
        elapsed = round(time.time() - t0, 1)
        _log(f"  ✓ Intelligence Engine completed in {elapsed}s")
        _log(f"  avg_cliffhanger={arc.avg_cliffhanger_score}  "
             f"avg_risk={arc.avg_retention_risk}  "
             f"improvements={len(arc.improvement_suggestions)}")
    except Exception as exc:
        _log(f"  ⚠ Intelligence Engine failed (non-fatal): {exc}")
        # Non-fatal: pipeline still returns LLM-computed values

    return EngineResponse(
        story_id=arc.story_id,
        arc=arc,
        pipeline_log=log,
        status="success",
    )
