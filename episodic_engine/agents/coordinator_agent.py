"""
agents/coordinator_agent.py
─────────────────────────────
The Coordinator Agent — inspired by STORYWRITER's Coordinator role.

Responsibilities:
  1. Compress the accumulated arc context before each module call
     (ReIO-Input mechanism: avoid context bloat beyond ~10 000 chars).
  2. Validate module outputs for structural compliance before passing
     them downstream (ReIO-Output mechanism).
  3. Maintain and expose the rolling pipeline log.

This agent is stateless between calls; it receives context JSON and
returns a compressed/validated version.  It is called by the
PipelineOrchestrator between pipeline stages.
"""

from __future__ import annotations
import json

from schemas import StoryArc
from utils import llm_json_call


_compress_system = """\
You are a narrative context compressor.  Your job is to create a compact
summary of the story arc processed so far, retaining only information
that is critical for the NEXT pipeline stage.
Always respond with valid JSON only.
"""

_compress_prompt = """\
The next pipeline stage is: {next_stage}

Below is the full arc JSON (possibly long). Compress it into a concise
context object that contains ONLY the fields the next stage needs.
Do not discard episode_index, title, narrative_function, chapter_begin_node,
chapter_end_node, or any scoring fields already populated.

Full arc (may be truncated to stay within your context window):
{arc_json}

Return the same JSON structure but with abstract text trimmed to ≤ 50 words
and events trimmed to ≤ 2 per episode.

Respond with JSON matching the StoryArc schema.
"""

# Maximum characters of arc JSON to send to compressor
_MAX_CTX_CHARS = 8000


def compress_context(arc: StoryArc, next_stage: str) -> str:
    """
    Compress arc JSON for the next stage.
    Returns a short JSON string summary (not a full StoryArc).

    Used to implement the ReIO-Input mechanism from STORYWRITER.
    """
    arc_json = arc.model_dump_json(indent=2)
    if len(arc_json) <= _MAX_CTX_CHARS:
        return arc_json  # No compression needed

    # Truncate and ask LLM to summarise
    truncated = arc_json[:_MAX_CTX_CHARS] + "\n... [truncated] ..."
    prompt = _compress_prompt.format(
        next_stage=next_stage,
        arc_json=truncated,
    )
    try:
        result = llm_json_call(prompt, _compress_system, temperature=0.1, max_tokens=3000)
        return json.dumps(result, indent=2)
    except Exception:
        # Fall back to raw truncation if LLM fails
        return truncated


_validate_system = """\
You are a strict narrative output quality gatekeeper.
You check that a module's output JSON has all required fields populated.
Respond with valid JSON only.
"""

_validate_prompt = """\
Check this module output from the '{module}' stage for completeness.

Required populated fields per episode:
{required_fields}

Module output (excerpt):
{output_json}

For each episode in the output, check whether all required fields are
non-null and non-empty.  If an episode is incomplete, list it.

Respond with JSON:
{{
  "valid": true | false,
  "incomplete_episodes": [<episode_index>, ...],
  "issues_found": ["..."]
}}
"""

_REQUIRED_BY_STAGE: dict[str, list[str]] = {
    "arc_breaker":        ["title", "abstract", "narrative_function", "chapter_begin_node", "chapter_end_node"],
    "plot_node_expander": ["chapter_plot_nodes"],
    "emotional_analyser": ["emotional_score", "discriminator_scores"],
    "cliffhanger_scorer": ["cliffhanger_score"],
    "retention_predictor":["retention_risk"],
    "improvement_suggestor": [],
}


def validate_output(arc: StoryArc, stage: str) -> dict:
    """
    Validate that the arc has all fields populated that the given stage 
    was supposed to fill.  Returns {"valid": bool, "issues": [...]}
    
    Implements the ReIO-Output validation from STORYWRITER.
    """
    required = _REQUIRED_BY_STAGE.get(stage, [])
    if not required:
        return {"valid": True, "issues": []}

    # Fast rule-based pre-check (no LLM cost)
    incomplete_eps = []
    for ep in arc.episodes:
        ep_dict = ep.model_dump()
        for field in required:
            val = ep_dict.get(field)
            if val is None or val == [] or val == {}:
                incomplete_eps.append(ep.episode_index)
                break

    if not incomplete_eps:
        return {"valid": True, "issues": []}

    # LLM validation for the failing episodes
    excerpt_eps = [
        ep.model_dump() for ep in arc.episodes
        if ep.episode_index in incomplete_eps
    ]
    prompt = _validate_prompt.format(
        module=stage,
        required_fields=json.dumps(required),
        output_json=json.dumps(excerpt_eps, indent=2)[:4000],
    )
    result = llm_json_call(prompt, _validate_system, temperature=0.0)
    issues = result.get("issues_found", [f"Incomplete episodes: {incomplete_eps}"])
    return {
        "valid": result.get("valid", False),
        "issues": issues,
    }
