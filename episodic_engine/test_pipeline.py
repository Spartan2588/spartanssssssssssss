"""
test_pipeline.py
─────────────────
Offline unit/integration test that runs the full pipeline without an API server.

Usage:
  python test_pipeline.py

Requires:
  LLM_API_KEY environment variable set.
  LLM_MODEL (optional, defaults to gpt-4o-mini).
"""

from __future__ import annotations
import json
import os
import sys

# Add episodic_engine to path so this can be run from the workspace root
sys.path.insert(0, os.path.dirname(__file__))

from schemas import EngineRequest
from pipeline_orchestrator import run_pipeline


DEMO_IDEAS = [
    {
        "story_idea": (
            "A delivery driver discovers that the packages she's been delivering "
            "contain stolen memories extracted from people without their consent."
        ),
        "desired_episodes": 6,
        "genre": "sci-fi thriller",
    },
    {
        "story_idea": (
            "Two rival chefs competing in a high-stakes cooking show realise "
            "they are siblings separated at birth."
        ),
        "desired_episodes": 5,
        "genre": "drama",
    },
]


def pretty_print_response(resp) -> None:
    print("\n" + "=" * 60)
    print(f"STORY ID  : {resp.story_id}")
    print(f"STATUS    : {resp.status}")
    print(f"EPISODES  : {resp.arc.total_episodes}")
    print(f"AVG CLIFF : {resp.arc.avg_cliffhanger_score}/10")
    print(f"AVG RISK  : {resp.arc.avg_retention_risk}")
    print(f"EMO SUMMARY: {resp.arc.emotional_arc_summary}")
    print()

    for ep in resp.arc.episodes:
        print(f"  Ep{ep.episode_index}: [{ep.narrative_function.name}] {ep.title}")
        print(f"    Emotion  : {ep.emotional_score:+.3f}")
        print(f"    Cliff    : {ep.cliffhanger_score}/10")
        print(f"    Risk     : {ep.retention_risk}")
        print(f"    CPNs     : {len(ep.chapter_plot_nodes)}")
        if ep.chapter_plot_nodes:
            last = ep.chapter_plot_nodes[-1]
            print(f"    Last CPN : <{last.subject}, {last.verb}, {last.obj}>")
        print()

    print("IMPROVEMENT SUGGESTIONS:")
    for i, s in enumerate(resp.arc.improvement_suggestions[:10], 1):
        print(f"  {i}. {s}")

    print("\nPIPELINE LOG (last 5):")
    for entry in resp.pipeline_log[-5:]:
        print(f"  {entry}")


if __name__ == "__main__":
    if not os.environ.get("LLM_API_KEY"):
        print("ERROR: LLM_API_KEY environment variable not set.")
        print("Set it with:  $env:LLM_API_KEY='sk-...'  (PowerShell)")
        sys.exit(1)

    idea = DEMO_IDEAS[0]
    print(f"Running pipeline for: {idea['story_idea'][:60]}...")

    request = EngineRequest(**idea)
    response = run_pipeline(request)

    pretty_print_response(response)

    # Save full output to JSON
    out_path = os.path.join(os.path.dirname(__file__), "pipeline_output.json")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(response.model_dump_json(indent=2))
    print(f"\nFull output saved to: {out_path}")
