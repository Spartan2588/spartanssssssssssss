"""
modules/retention_predictor.py
────────────────────────────────
Module 5 — Retention Risk Predictor

Responsibility:
  Predict the probability (0–1) that an audience member will DROP OUT
  before the 90-second episode ends.  Higher score = higher risk.

Research lineage:
  • STORYWRITER: Coherence (CH) + Complexity (CX) as quality signals
    — incoherence and over-complexity both drive drop-off
  • Plan-Write-Revise: Causal-Temporal Coherence discriminator
    — poor causality confuses audience → drop-off
  • ASP paper: importance of long-term story structure
    — episodes that feel disconnected signal poor overall structure
  • STORYTELLER: Novelty / Diversity analysis using DistinctL-n metric

Seven retention risk factors (each 0–1, higher = more risk):
  1. coherence_risk    – how hard is it to follow what's happening?
  2. pacing_risk       – is the episode too slow or too frantic?
  3. complexity_risk   – too many new characters/concepts introduced?
  4. engagement_risk   – insufficient emotional hook early in episode?
  5. length_risk       – estimated word count vs. 90-second capacity
  6. exposition_risk   – too much explaining, too little doing?
  7. hook_strength_inv – inverse of the cliffhanger score already calculated

Final retention_risk = weighted average of all 7.
"""

from __future__ import annotations
import json

from schemas import StoryArc, EpisodeNode
from utils import llm_json_call


# 90-second episode @ ~130 WPM spoken = ~195 words max comfortable
_WORDS_PER_90S = 195

_SYSTEM = """\
You are a data-driven audience retention analyst for vertical short-form content.
You predict drop-off probability based on narrative structure signals.
Always respond with valid JSON only.
"""

_RISK_PROMPT = """\
Predict the RETENTION RISK (probability of audience drop-off before the episode 
ends) for this 90-second vertical story episode.

Score each risk factor from 0.0 (no risk) to 1.0 (maximum risk):

  coherence_risk   : How hard is it to follow the cause-effect flow?
                     (multiple simultaneous plotlines, unclear motivations = high risk)
  pacing_risk      : Is the pacing off? (too slow → boredom; too frantic → confusion)
  complexity_risk  : Too many new entities / concepts introduced in this episode?
                     (audience can absorb ≤ 2 new elements per 90-second episode)
  engagement_risk  : Does the episode fail to hook emotionally in the first 15 seconds?
  exposition_risk  : Is >30% of the episode spent on explanatory narration vs. action?
  
Episode data:
  Title             : {title}
  Narrative function: {func}
  Abstract          : {abstract}
  Emotional score   : {emotional_score}  (–1 to +1, lower = darker/more tension)
  Plot nodes        : {plot_nodes}
  Estimated word count (guessed from abstract length × 4): {estimated_words}
  Max recommended for 90s: {max_words}
  Number of new entities introduced: {new_entities}

Provide a one-sentence rationale and one specific mitigation tip for any 
factor scoring above 0.6.

Respond with JSON:
{{
  "coherence_risk":  {{"score": float, "rationale": "...", "tip": "..."}},
  "pacing_risk":     {{"score": float, "rationale": "...", "tip": "..."}},
  "complexity_risk": {{"score": float, "rationale": "...", "tip": "..."}},
  "engagement_risk": {{"score": float, "rationale": "...", "tip": "..."}},
  "exposition_risk": {{"score": float, "rationale": "...", "tip": "..."}}
}}
"""

# Weights for the 7 factors
_WEIGHTS = {
    "coherence_risk":   0.25,
    "pacing_risk":      0.15,
    "complexity_risk":  0.15,
    "engagement_risk":  0.20,
    "exposition_risk":  0.10,
    "length_risk":      0.10,
    "hook_strength_inv":0.05,
}


def _estimate_words(abstract: str) -> int:
    """Rough word-count estimate: abstract × 4 expansion factor."""
    return len(abstract.split()) * 4


def _length_risk(episode: EpisodeNode) -> float:
    """0-1 risk based on estimated word count vs. 90-second limit."""
    est = _estimate_words(episode.abstract)
    if est <= _WORDS_PER_90S:
        return 0.0
    overflow = (est - _WORDS_PER_90S) / _WORDS_PER_90S
    return min(1.0, overflow)


def _hook_inv(episode: EpisodeNode) -> float:
    """Inverse of normalised cliffhanger score → risk proxy."""
    ch = episode.cliffhanger_score or 5.0  # default to mid if not scored yet
    return max(0.0, 1.0 - (ch / 10.0))


def _score_episode(episode: EpisodeNode, entity_registry: dict) -> float:
    """Return retention_risk ∈ [0,1] for one episode."""
    # Count new entities mentioned in this episode
    new_ents = len([
        e for e in episode.events
        if any(name.lower() in e.lower() for name in entity_registry)
    ])

    plot_nodes_str = " → ".join(
        f"<{n.subject},{n.verb},{n.obj}>"
        for n in ([episode.chapter_begin_node]
                  + episode.chapter_plot_nodes
                  + [episode.chapter_end_node])
    )

    prompt = _RISK_PROMPT.format(
        title=episode.title,
        func=episode.narrative_function.name,
        abstract=episode.abstract,
        emotional_score=round(episode.emotional_score or 0.0, 3),
        plot_nodes=plot_nodes_str,
        estimated_words=_estimate_words(episode.abstract),
        max_words=_WORDS_PER_90S,
        new_entities=new_ents,
    )
    result = llm_json_call(prompt, _SYSTEM, temperature=0.1)

    llm_factors = {
        k: float(result.get(k, {}).get("score", 0.5))
        for k in ["coherence_risk", "pacing_risk", "complexity_risk",
                  "engagement_risk", "exposition_risk"]
    }

    # Combine LLM + rule-based factors
    all_factors = {
        **llm_factors,
        "length_risk":      _length_risk(episode),
        "hook_strength_inv": _hook_inv(episode),
    }

    weighted = sum(
        all_factors[k] * _WEIGHTS[k]
        for k in _WEIGHTS
    )

    # Return tips for high-risk factors
    tips = []
    for factor, score in llm_factors.items():
        if score > 0.6:
            tip = result.get(factor, {}).get("tip", "")
            if tip:
                tips.append(f"[Ep {episode.episode_index} – {factor}] {tip}")

    return round(weighted, 3), tips


def run(arc: StoryArc) -> StoryArc:
    """
    Predict retention risk for every episode.
    Populates episode.retention_risk and appends high-risk tips to
    arc.improvement_suggestions.
    """
    all_risks: list[float] = []

    for i, ep in enumerate(arc.episodes):
        risk, tips = _score_episode(ep, arc.entity_registry)
        arc.episodes[i].retention_risk = risk
        arc.episodes[i].discriminator_scores["retention_risk"] = risk
        all_risks.append(risk)
        arc.improvement_suggestions.extend(tips)

    arc.avg_retention_risk = round(
        sum(all_risks) / len(all_risks), 3
    ) if all_risks else 0.0

    return arc
