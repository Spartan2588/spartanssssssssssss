"""
modules/cliffhanger_scorer.py
──────────────────────────────
Module 4 — Cliffhanger Strength Scorer

Responsibility:
  Score the cliffhanger strength of each episode ending on a 0–10 scale,
  then flag episodes whose endings are too weak for the 90-second format.

Research lineage:
  • STORYWRITER: Surprise (SU) metric in human/auto evaluation
  • STORYTELLER: Engagement metric — reader's curiosity sustained
  • Plan-Write-Revise: discriminator re-ranking model that reorders
    candidates based on trained scoring functions  (here adapted to
    score the CEN's hook potential)
  • ASP paper: cliffhanger as a narrative-function with weight 1.0
    (forced to appear in every episode for vertical format retention)

Cliffhanger scoring formula (weighted sum of 5 signals, each 0–2):
  1. open_loop_score      – does the CEN leave a question unanswered?
  2. stakes_score         – are the consequences high?
  3. reversal_score       – does it subvert an expectation?
  4. character_jeopardy   – is a key entity in immediate danger?
  5. pacing_score         – does the CEN land on an action verb (not a state)?

Raw score ∈ [0, 10]; threshold < 5 triggers improvement suggestion.
"""

from __future__ import annotations
import json

from schemas import StoryArc, EpisodeNode
from utils import llm_json_call


_THRESHOLD = 5.0    # episodes below this score get flagged


_SYSTEM = """\
You are a vertical storytelling hook specialist who scores episode cliffhangers.
Your job is to evaluate how compellingly each episode ending will drive viewers 
to continue to the next episode.
Always respond with valid JSON only.
"""

_SCORE_PROMPT = """\
Score the cliffhanger strength of this episode's ending for a 90-second vertical
story format.  Viewers must be compelled to watch the next episode immediately.

Episode:
  Title            : {title}
  Narrative function: {func}
  Chapter End Node (CEN) — what happens at the end: <{cen}>
  Final plot node before CEN: {last_cpn}
  Abstract         : {abstract}
  
Next episode hint (if available): {next_hint}

Score each of the 5 signals on a scale of 0.0 – 2.0:
  open_loop_score    : Does the CEN leave an urgent, unanswered question?
  stakes_score       : Are the immediate consequences of the CEN high?
  reversal_score     : Does the CEN subvert audience expectations?
  character_jeopardy : Is a key character in immediate danger or crisis?
  pacing_score       : Does the CEN end on a high-energy action verb (not "is", "was", "had")?

Also provide a one-sentence rationale for each signal and one actionable
improvement tip if score < 1.5.

Respond with JSON:
{{
  "open_loop_score":    {{"score": float, "rationale": "...", "tip": "..." }},
  "stakes_score":       {{"score": float, "rationale": "...", "tip": "..." }},
  "reversal_score":     {{"score": float, "rationale": "...", "tip": "..." }},
  "character_jeopardy": {{"score": float, "rationale": "...", "tip": "..." }},
  "pacing_score":       {{"score": float, "rationale": "...", "tip": "..." }}
}}
"""


def _score_episode(
    episode: EpisodeNode,
    next_episode: EpisodeNode | None,
) -> tuple[float, dict]:
    """Score one episode's cliffhanger. Returns (total_score, raw_result)."""
    cen = episode.chapter_end_node
    last_cpn = episode.chapter_plot_nodes[-1] if episode.chapter_plot_nodes else cen
    next_hint = (
        f"Next episode title: '{next_episode.title}' — {next_episode.abstract[:80]}"
        if next_episode else "This is the final episode."
    )

    prompt = _SCORE_PROMPT.format(
        title=episode.title,
        func=episode.narrative_function.name,
        cen=f"{cen.subject}, {cen.verb}, {cen.obj}",
        last_cpn=f"<{last_cpn.subject}, {last_cpn.verb}, {last_cpn.obj}>",
        abstract=episode.abstract,
        next_hint=next_hint,
    )
    result = llm_json_call(prompt, _SYSTEM, temperature=0.1)

    signals = [
        "open_loop_score",
        "stakes_score",
        "reversal_score",
        "character_jeopardy",
        "pacing_score",
    ]
    total = sum(float(result.get(s, {}).get("score", 0)) for s in signals)
    return total, result


def run(arc: StoryArc) -> StoryArc:
    """
    Score all episodes' cliffhanger strength.
    Populates episode.cliffhanger_score and adds improvement suggestions
    to arc.improvement_suggestions for weak endings.
    """
    total_scores: list[float] = []

    for i, ep in enumerate(arc.episodes):
        next_ep = arc.episodes[i + 1] if i + 1 < len(arc.episodes) else None
        score, raw = _score_episode(ep, next_ep)

        arc.episodes[i].cliffhanger_score = round(score, 2)
        arc.episodes[i].discriminator_scores["cliffhanger"] = round(score, 2)
        total_scores.append(score)

        # Collect tips for weak episodes
        if score < _THRESHOLD:
            tips = []
            for signal_name, signal_data in raw.items():
                if isinstance(signal_data, dict):
                    sig_score = float(signal_data.get("score", 2.0))
                    if sig_score < 1.5:
                        tip = signal_data.get("tip", "")
                        if tip:
                            tips.append(f"[Ep{ep.episode_index} – {signal_name}] {tip}")
            arc.improvement_suggestions.extend(tips)

    arc.avg_cliffhanger_score = round(
        sum(total_scores) / len(total_scores), 2
    ) if total_scores else 0.0

    return arc
