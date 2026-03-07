"""
modules/emotional_analyser.py
──────────────────────────────
Module 3 — Emotional Arc Analyser

Responsibility:
  Score each episode on an emotional intensity axis (–1.0 … +1.0) and
  produce an arc-level emotional progression summary.

Research lineage:
  • STORYWRITER evaluation dimensions: Empathy (EM), Surprise (SU)
  • Plan-Write-Revise: discriminator scoring for Creativity, Relevance,
    Causal-Temporal Coherence — here adapted as emotional discriminators
  • STORYTELLER engagement metric: how strongly reader curiosity is sustained

Four discriminator dimensions are scored per episode:
  1. valence        – positive/negative tone          (-1 … +1)
  2. intensity      – dramatic weight                  (0 … 1)
  3. surprise       – unexpectedness of development    (0 … 1)
  4. empathy_pull   – audience emotional identification (0 … 1)

The composite emotional_score = 0.4*valence + 0.3*intensity
                                + 0.2*surprise + 0.1*empathy_pull
(normalised to –1 … +1)
"""

from __future__ import annotations
import json

from schemas import StoryArc, EpisodeNode
from utils import llm_json_call


_SYSTEM = """\
You are an expert narrative emotional analyst.
You score story episodes on multiple emotional dimensions with precision.
Always respond with valid JSON only.
"""

_PROMPT = """\
Analyse the emotional content of this story episode and score it on four
dimensions. Base your analysis on:
  • The SVO plot nodes (CBN, CPNs, CEN) — the structural events
  • The abstract — the narrative context
  • The narrative function — the storytelling goal

Episode data:
{episode_json}

Score each dimension:
  valence      : –1.0 (deeply negative) to +1.0 (deeply positive).
                 Pure tragedy = –1, pure triumph = +1.
  intensity    : 0.0 (flat / mundane) to 1.0 (maximum dramatic stakes).
  surprise     : 0.0 (fully predictable) to 1.0 (completely unexpected).
  empathy_pull : 0.0 (audience detached) to 1.0 (audience deeply invested).

Also write a one-sentence rationale for each score.

Respond with JSON:
{{
  "valence":      {{"score": float, "rationale": "..."}},
  "intensity":    {{"score": float, "rationale": "..."}},
  "surprise":     {{"score": float, "rationale": "..."}},
  "empathy_pull": {{"score": float, "rationale": "..."}}
}}
"""

_ARC_SUMMARY_SYSTEM = """\
You are a story editor specialising in emotional arc analysis.
Respond with JSON only.
"""

_ARC_SUMMARY_PROMPT = """\
Given the following per-episode emotional scores for a {n}-episode story,
write a concise arc-level summary (2-3 sentences) describing:
  1. The overall emotional journey shape (e.g., "roller-coaster", "slow burn").
  2. Whether the arc has sufficient variety and peaks.
  3. Any emotional dead zones or repetitive patterns.

Scores:
{scores_json}

Respond with JSON:
{{
  "emotional_arc_summary": "..."
}}
"""


def _composite_score(
    valence: float,
    intensity: float,
    surprise: float,
    empathy_pull: float,
) -> float:
    """Weighted composite emotional score in –1 … +1."""
    raw = (
        0.40 * valence
        + 0.30 * intensity
        + 0.20 * surprise
        + 0.10 * empathy_pull
    )
    # intensity, surprise, empathy_pull are 0-1 so blend contribution
    # normalise so range stays within –1…+1
    return max(-1.0, min(1.0, raw))


def _episode_to_json(ep: EpisodeNode) -> str:
    """Compact JSON representation of an episode for the prompt."""
    return json.dumps({
        "title": ep.title,
        "narrative_function": ep.narrative_function.name,
        "abstract": ep.abstract,
        "begin_node": f"<{ep.chapter_begin_node.subject}, {ep.chapter_begin_node.verb}, {ep.chapter_begin_node.obj}>",
        "end_node": f"<{ep.chapter_end_node.subject}, {ep.chapter_end_node.verb}, {ep.chapter_end_node.obj}>",
        "plot_nodes": [
            f"<{n.subject}, {n.verb}, {n.obj}>" for n in ep.chapter_plot_nodes
        ],
    }, indent=2)


def run(arc: StoryArc) -> StoryArc:
    """
    Score every episode emotionally, populate episode.emotional_score &
    discriminator_scores, then set arc.emotional_arc_summary.
    """
    scores_per_episode: list[dict] = []

    for i, ep in enumerate(arc.episodes):
        prompt = _PROMPT.format(episode_json=_episode_to_json(ep))
        result = llm_json_call(prompt, _SYSTEM, temperature=0.1)

        valence      = float(result.get("valence",      {}).get("score", 0.0))
        intensity    = float(result.get("intensity",    {}).get("score", 0.5))
        surprise     = float(result.get("surprise",     {}).get("score", 0.5))
        empathy_pull = float(result.get("empathy_pull", {}).get("score", 0.5))

        composite = _composite_score(valence, intensity, surprise, empathy_pull)

        arc.episodes[i].emotional_score = composite
        arc.episodes[i].discriminator_scores.update({
            "valence":      valence,
            "intensity":    intensity,
            "surprise":     surprise,
            "empathy_pull": empathy_pull,
        })

        scores_per_episode.append({
            "episode_index": ep.episode_index,
            "title":         ep.title,
            "composite":     round(composite, 3),
            "valence":       round(valence, 3),
            "intensity":     round(intensity, 3),
            "surprise":      round(surprise, 3),
            "empathy_pull":  round(empathy_pull, 3),
            "rationale": {
                "valence":      result.get("valence",      {}).get("rationale", ""),
                "intensity":    result.get("intensity",    {}).get("rationale", ""),
                "surprise":     result.get("surprise",     {}).get("rationale", ""),
                "empathy_pull": result.get("empathy_pull", {}).get("rationale", ""),
            },
        })

    # Arc-level summary
    arc_prompt = _ARC_SUMMARY_PROMPT.format(
        n=len(arc.episodes),
        scores_json=json.dumps(scores_per_episode, indent=2),
    )
    summary_result = llm_json_call(arc_prompt, _ARC_SUMMARY_SYSTEM, temperature=0.2)
    arc.emotional_arc_summary = summary_result.get("emotional_arc_summary", "")

    return arc
