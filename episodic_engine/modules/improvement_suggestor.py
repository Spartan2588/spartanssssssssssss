"""
modules/improvement_suggestor.py
──────────────────────────────────
Module 6 — Improvement Suggestor

Responsibility:
  Synthesise all per-episode signals and produce structured, actionable
  improvement suggestions at both episode level and arc level.

Research lineage:
  • Plan-Write-Revise §3 (Targeted Improvements)
    – Human collaborators instructed to fix Creativity / Relevance /
      Causal-Temporal Coherence → here an LLM plays that role
  • STORYWRITER: ReIO-Output mechanism
    – Coordinator rewrites generated text that deviates from outline
    – We adapt this as a "suggestion engine" that proposes rewrites
  • ASP approach: constraints that *disallow* certain combinations →
    transformed here into explicit flags when a combination is detected
  • STORYTELLER: comprehensive evaluation checklist per dimension

The suggestor works in two passes:
  Pass 1 – Per-episode: identify which of the three canonical weaknesses
            are present (based on discriminator scores already computed):
            a. Creativity weakness (surprise < 0.4, valence monotone)
            b. Coherence weakness  (retention_risk > 0.6, coherence flag)
            c. Hook weakness       (cliffhanger < 5, engagement_risk > 0.6)
  Pass 2 – Arc level: LLM synthesises everything into 5 structured
            improvement recommendations with priority tags.
"""

from __future__ import annotations
import json

from schemas import StoryArc
from utils import llm_json_call


_EPISODE_SYSTEM = """\
You are an expert story editor. You diagnose weaknesses in individual 
episodes and suggest precise, actor-ready rewrites.
Always respond with valid JSON only.
"""

_EPISODE_PROMPT = """\
Diagnose and suggest improvements for this story episode based on its scores.

Episode scores:
  Episode index    : {episode_index}
  Title            : {title}
  Narrative func   : {func}
  Abstract         : {abstract}
  emotional_score  : {emotional_score}   (ideal range varies by position)
  cliffhanger_score: {cliffhanger_score} / 10  (target ≥ 6)
  retention_risk   : {retention_risk}    (target < 0.4)
  discriminator_scores: {disc_scores}

Detected weaknesses:
{weaknesses}

For each detected weakness, provide:
  1. A precise description of WHY it is a weakness.
  2. A concrete, sentence-level suggestion for fixing it.
  3. Which element to change: title / abstract / begin_node / end_node / plot_node.
  4. Priority: HIGH / MEDIUM / LOW.

Respond with JSON:
{{
  "episode_suggestions": [
    {{
      "weakness": "...",
      "why": "...",
      "fix": "...",
      "element": "...",
      "priority": "HIGH|MEDIUM|LOW"
    }},
    ...
  ]
}}
"""

_ARC_SYSTEM = """\
You are a senior story architect. You review complete multi-episode arcs
and provide structured improvement plans.
Always respond with valid JSON only.
"""

_ARC_PROMPT = """\
Review this complete {n}-episode story arc and provide 5 structured 
improvement recommendations.

Arc overview:
  Premise                : {premise}
  Emotional arc summary  : {emotional_summary}
  Avg cliffhanger score  : {avg_cliff} / 10
  Avg retention risk     : {avg_retention}
  
Per-episode summary:
{episode_summary}

Existing micro-suggestions (from earlier modules):
{existing_suggestions}

Provide exactly 5 arc-level recommendations, addressing:
  1. Emotional arc shape (is it dynamic enough?)
  2. Cliffhanger consistency (which episodes need stronger hooks?)
  3. Entity/character development across episodes
  4. Narrative function balance (are functions well distributed?)
  5. Overall pacing and flow

Respond with JSON:
{{
  "arc_suggestions": [
    {{
      "category": "emotional_arc | cliffhanger | character | narrative_function | pacing",
      "recommendation": "...",
      "affected_episodes": [1, 2, ...],
      "priority": "HIGH|MEDIUM|LOW"
    }},
    ...
  ]
}}
"""


def _detect_episode_weaknesses(ep) -> list[str]:
    """Rule-based weakness detection using discriminator scores."""
    scores = ep.discriminator_scores
    weaknesses = []

    # Creativity weakness: flat surprise or monotone valence
    surprise   = scores.get("surprise", 1.0)
    valence    = scores.get("valence",  0.0)
    if surprise < 0.35:
        weaknesses.append(
            f"CREATIVITY: Surprise score is {surprise:.2f} (< 0.35). "
            "The episode's developments are too predictable."
        )
    if abs(valence) < 0.15:
        weaknesses.append(
            f"CREATIVITY: Valence is near-neutral ({valence:.2f}). "
            "The episode lacks emotional colour."
        )

    # Coherence weakness: high retention risk
    retention = ep.retention_risk or 0.0
    if retention > 0.55:
        weaknesses.append(
            f"COHERENCE: Retention risk is {retention:.2f} (> 0.55). "
            "Audience confusion is likely; the causal chain may be unclear."
        )

    # Hook weakness: weak cliffhanger
    cliff = ep.cliffhanger_score or 10.0
    if cliff < 5.0:
        weaknesses.append(
            f"HOOK: Cliffhanger score is {cliff:.1f}/10 (< 5.0). "
            "The episode ending will not compel viewers to continue."
        )

    return weaknesses


def run(arc: StoryArc) -> StoryArc:
    """
    Generate per-episode and arc-level improvement suggestions.
    Appends to arc.improvement_suggestions.
    """
    all_episode_suggestions: list[str] = []

    for ep in arc.episodes:
        weaknesses = _detect_episode_weaknesses(ep)
        if not weaknesses:
            continue

        prompt = _EPISODE_PROMPT.format(
            episode_index=ep.episode_index,
            title=ep.title,
            func=ep.narrative_function.name,
            abstract=ep.abstract,
            emotional_score=round(ep.emotional_score or 0, 3),
            cliffhanger_score=round(ep.cliffhanger_score or 0, 2),
            retention_risk=round(ep.retention_risk or 0, 3),
            disc_scores=json.dumps(
                {k: round(v, 3) for k, v in ep.discriminator_scores.items()},
                indent=2,
            ),
            weaknesses="\n".join(f"  • {w}" for w in weaknesses),
        )
        result = llm_json_call(prompt, _EPISODE_SYSTEM, temperature=0.3)

        for sug in result.get("episode_suggestions", []):
            tag = f"[Ep{ep.episode_index}|{sug.get('priority','?')}] {sug.get('fix','')}"
            all_episode_suggestions.append(tag)

    # Arc-level pass
    episode_summary = "\n".join(
        f"  Ep{ep.episode_index} '{ep.title}': "
        f"emotion={round(ep.emotional_score or 0, 2)}, "
        f"cliff={round(ep.cliffhanger_score or 0, 1)}/10, "
        f"risk={round(ep.retention_risk or 0, 3)}"
        for ep in arc.episodes
    )

    arc_prompt = _ARC_PROMPT.format(
        n=arc.total_episodes,
        premise=arc.premise,
        emotional_summary=arc.emotional_arc_summary or "Not yet assessed.",
        avg_cliff=arc.avg_cliffhanger_score or 0,
        avg_retention=arc.avg_retention_risk or 0,
        episode_summary=episode_summary,
        existing_suggestions="\n".join(arc.improvement_suggestions[-10:]),
    )
    arc_result = llm_json_call(arc_prompt, _ARC_SYSTEM, temperature=0.3)

    arc_suggestions_formatted = [
        f"[ARC|{s.get('priority','?')}|{s.get('category','')}] "
        f"Eps {s.get('affected_episodes', [])}: {s.get('recommendation', '')}"
        for s in arc_result.get("arc_suggestions", [])
    ]

    # Merge all suggestions, deduplicate while preserving order
    all_suggestions = (
        arc.improvement_suggestions
        + all_episode_suggestions
        + arc_suggestions_formatted
    )
    seen = set()
    deduped = []
    for s in all_suggestions:
        if s not in seen:
            seen.add(s)
            deduped.append(s)

    arc.improvement_suggestions = deduped
    return arc
