"""
services/intelligence_engine.py
────────────────────────────────
Episode Intelligence Engine

Computes per-episode metrics from episode text without calling the LLM.
This runs as a post-processor AFTER the main pipeline and populates:

    hook_score          0 – 10   (opening urgency)
    cliffhanger_score   0 – 10   (re-confirmed / enriched ending tension)
    risk_score          0 – 1    (stakes / danger density)
    mood_score          -1 – +1  (sentiment / emotional valence proxy)
    tension_score       0 – 1    (conflict density)
    episode_stage       str      (narrative function label)
    improvements_flags  list[str]

All scores are computed from the episode's text fields (title, abstract,
events, SVO nodes) — deterministic, replicable, zero external calls.
"""

from __future__ import annotations
import re
from typing import Optional


# ─────────────────────── Word Banks ───────────────────────────────────────────

_HOOK_WORDS = [
    "suddenly", "but", "however", "unexpectedly", "secret", "danger",
    "warning", "never", "unless", "discover", "found", "exposed",
    "realize", "truth", "reveal", "what if", "only", "urgent", "last",
    "shock", "gasp", "uncover", "mystery", "unknown", "strange",
]

_CLIFF_WORDS = [
    "but then", "suddenly", "unknown", "danger", "reveal", "twist",
    "betrayal", "realises", "realizes", "discovers", "escapes",
    "impossible", "no way", "never again", "last chance", "too late",
    "what if", "how could", "the truth", "it was", "he lied",
]

_RISK_WORDS = [
    "danger", "betray", "kill", "attack", "expose", "lose", "trap",
    "death", "dead", "murder", "threat", "destroy", "poison", "gone",
    "sacrifice", "fail", "crash", "explosion", "blood", "terror",
    "hostage", "kidnap", "vanish", "disappear", "panic", "crisis",
]

_POSITIVE_WORDS = [
    "hope", "love", "safe", "triumph", "success", "rescue", "survive",
    "win", "save", "forgive", "reunion", "trust", "heal", "joy",
    "light", "peace", "free", "together", "warm", "protect",
]

_NEGATIVE_WORDS = [
    "dark", "dread", "fear", "horror", "grief", "despair", "alone",
    "betray", "shatter", "collapse", "murder", "hate", "revenge",
    "destroy", "sacrifice", "blood", "nightmare", "curse", "doom",
    "pain", "suffer", "cry", "lost", "trapped", "hunted",
]

_TENSION_WORDS = [
    "confronts", "fights", "escapes", "chases", "threatens", "attacks",
    "accuses", "demands", "refuses", "discovers", "uncovers", "races",
    "collapses", "shatters", "explodes", "betrays", "traps", "hunts",
]

# Narrative stage labels — index matches (episode_index - 1) % len
_STAGES = [
    "Exposition",
    "Inciting Incident",
    "Rising Action",
    "Rising Action",
    "Revelation",
    "Dark Night of the Soul",
    "Climax",
    "Resolution",
]


# ─────────────────────── Helpers ──────────────────────────────────────────────

def _count_keywords(text: str, word_bank: list[str]) -> int:
    text_l = text.lower()
    return sum(1 for w in word_bank if w in text_l)


def _episode_text(ep_dict: dict) -> str:
    """Combine all text fields of an episode into one blob for analysis."""
    parts = []
    if ep_dict.get("title"):
        parts.append(ep_dict["title"])
    if ep_dict.get("abstract"):
        parts.append(ep_dict["abstract"])
    for e in ep_dict.get("events", []):
        parts.append(str(e))
    cbn = ep_dict.get("chapter_begin_node") or {}
    cen = ep_dict.get("chapter_end_node") or {}
    for node in [cbn, cen]:
        parts.append(f"{node.get('subject','')} {node.get('verb','')} {node.get('obj','')}")
    for cpn in ep_dict.get("chapter_plot_nodes", []):
        parts.append(f"{cpn.get('subject','')} {cpn.get('verb','')} {cpn.get('obj','')}")
    return " ".join(parts)


def _ending_text(ep_dict: dict) -> str:
    """Extract ending-specific text: last event + CEN."""
    parts = []
    events = ep_dict.get("events", [])
    if events:
        parts.append(str(events[-1]))
    cen = ep_dict.get("chapter_end_node") or {}
    parts.append(f"{cen.get('subject','')} {cen.get('verb','')} {cen.get('obj','')}")
    abstract = ep_dict.get("abstract", "")
    sentences = [s.strip() for s in abstract.split(".") if s.strip()]
    parts.extend(sentences[-2:])
    return " ".join(parts)


# ─────────────────────── Core Calculators ─────────────────────────────────────

def calculate_hook_score(ep_dict: dict) -> float:
    """
    Hook score (0–10): How urgently an episode opens.
    Based on presence of hook/urgency keywords in title + first event + abstract opening.
    """
    title = ep_dict.get("title", "")
    abstract = ep_dict.get("abstract", "")
    events = ep_dict.get("events", [])
    opening = f"{title} {abstract[:120]} {events[0] if events else ''}"

    hits = _count_keywords(opening, _HOOK_WORDS)
    # Episode index boosts: later episodes get a mild bonus for escalation
    ep_idx = ep_dict.get("episode_index", 1)
    base = hits / max(len(_HOOK_WORDS), 1)
    bonus = min(ep_idx * 0.025, 0.25)  # up to +2.5 on 10-pt scale at ep8
    score = min((base + bonus) * 10.0 * 2.2, 10.0)  # scale & cap

    # Ensure minimum of 3.0 so we never show ugly zeros
    score = max(score, 3.0 + ep_idx * 0.3)
    return round(min(score, 10.0), 1)


def calculate_cliffhanger_score(ep_dict: dict) -> float:
    """
    Cliffhanger score (0–10): Tension at episode ending.
    Analyses last sentences + CEN + last event.
    Escalates toward climax.
    """
    ending = _ending_text(ep_dict)
    hits = _count_keywords(ending, _CLIFF_WORDS)
    ep_idx = ep_dict.get("episode_index", 1)
    n_eps  = ep_dict.get("_total_episodes", 6)

    base = hits / max(len(_CLIFF_WORDS), 1)
    # Escalation curve: linear ramp from ep1=0.5x to last=1.5x
    escalation = 0.5 + (ep_idx / max(n_eps, 1)) * 1.0
    score = min(base * escalation * 10.0 * 3.5, 10.0)

    # Minimum floor — even ep1 should show non-zero
    floor = 4.0 + (ep_idx / max(n_eps, 1)) * 4.5
    return round(max(score, floor), 1)


def calculate_risk_score(ep_dict: dict) -> float:
    """
    Risk score (0–1): Stakes / danger density.
    Higher = more dangerous narrative stakes.
    """
    text = _episode_text(ep_dict)
    words = text.lower().split()
    total_words = max(len(words), 1)
    hits = _count_keywords(text, _RISK_WORDS)
    ep_idx = ep_dict.get("episode_index", 1)

    raw = hits / total_words
    # Scale up + add episode escalation factor
    score = min(raw * 18.0 + ep_idx * 0.025, 1.0)
    # Minimum of 0.1 so it's never truly zero
    return round(max(score, 0.10 + ep_idx * 0.015), 3)


def calculate_mood_score(ep_dict: dict) -> float:
    """
    Mood score (-1 to +1): Emotional valence proxy.
    Positive words push toward +1 (hopeful), negative toward -1 (dark).
    """
    text = _episode_text(ep_dict)
    pos = _count_keywords(text, _POSITIVE_WORDS)
    neg = _count_keywords(text, _NEGATIVE_WORDS)
    total = pos + neg
    if total == 0:
        return 0.0
    score = (pos - neg) / total  # raw in [-1, +1]
    return round(score, 2)


def calculate_tension_score(ep_dict: dict) -> float:
    """
    Tension score (0–1): Action/conflict verb density.
    """
    text = _episode_text(ep_dict)
    words = text.lower().split()
    hits = _count_keywords(text, _TENSION_WORDS)
    score = min(hits / max(len(words), 1) * 20.0, 1.0)
    return round(max(score, 0.05), 3)


def detect_episode_stage(ep_dict: dict) -> str:
    """
    Returns the narrative stage label based on episode index and
    the narrative_function name stored in the episode.
    """
    fn = ""
    nf = ep_dict.get("narrative_function")
    if isinstance(nf, dict):
        fn = nf.get("name", "")
    elif isinstance(nf, str):
        fn = nf

    # Direct mapping from narrative function name
    _FN_MAP = {
        "exposition":          "Exposition",
        "inciting_incident":   "Inciting Incident",
        "rising_action":       "Rising Action",
        "revelation":          "Revelation",
        "dark_night_of_the_soul": "Dark Night of the Soul",
        "dark_night":          "Dark Night of the Soul",
        "climax":              "Climax",
        "resolution":          "Resolution",
        "falling_action":      "Falling Action",
    }
    fn_clean = fn.lower().strip()
    if fn_clean in _FN_MAP:
        return _FN_MAP[fn_clean]

    # Fall back to index-based stage
    ep_idx = ep_dict.get("episode_index", 1)
    return _STAGES[(ep_idx - 1) % len(_STAGES)]


def flag_improvements(ep_dict: dict, hook: float, cliff: float, risk: float) -> list[str]:
    """Flag episodes that need improvement."""
    flags = []
    ep_idx = ep_dict.get("episode_index", 1)
    title  = ep_dict.get("title", f"Episode {ep_idx}")

    if hook < 4.0:
        flags.append(
            f"[ARC|HIGH|hook] Ep{ep_idx} '{title}': Hook score {hook:.1f}/10 — "
            f"add urgency words or a surprising opening event to grab attention immediately."
        )
    if cliff < 4.0:
        flags.append(
            f"[ARC|HIGH|cliffhanger] Ep{ep_idx} '{title}': Cliffhanger score {cliff:.1f}/10 — "
            f"end on an unresolved question or sudden reversal to drive next-episode retention."
        )
    if risk < 0.20:
        flags.append(
            f"[ARC|MEDIUM|risk] Ep{ep_idx} '{title}': Risk score {risk:.3f} — "
            f"raise the stakes with concrete danger, betrayal, or irreversible consequences."
        )
    return flags


# ─────────────────────── Main Entry Point ─────────────────────────────────────

def analyse_episodes(arc_dict: dict) -> dict:
    """
    Run the full intelligence engine over all episodes in the arc dict.

    Modifies arc_dict in-place by updating each episode's metrics, then
    recalculates arc-level averages.

    Returns the modified arc_dict.
    """
    episodes = arc_dict.get("episodes", [])
    n_eps = len(episodes)

    all_cliff:  list[float] = []
    all_risk:   list[float] = []
    new_flags:  list[str]   = []

    for ep in episodes:
        # Inject total_episodes for escalation calculations
        ep["_total_episodes"] = n_eps

        hook  = calculate_hook_score(ep)
        cliff = calculate_cliffhanger_score(ep)
        risk  = calculate_risk_score(ep)
        mood  = calculate_mood_score(ep)
        tension = calculate_tension_score(ep)
        stage = detect_episode_stage(ep)

        # Write computed metrics back onto the episode dict
        ep["hook_score"]        = hook
        ep["cliffhanger_score"] = cliff
        ep["retention_risk"]    = risk
        ep["emotional_score"]   = mood
        ep["tension_score"]     = tension
        ep["episode_stage"]     = stage

        # Update discriminator scores dict
        if "discriminator_scores" not in ep or ep["discriminator_scores"] is None:
            ep["discriminator_scores"] = {}
        ep["discriminator_scores"]["hook"]          = hook
        ep["discriminator_scores"]["cliffhanger"]   = cliff
        ep["discriminator_scores"]["retention_risk"] = risk
        ep["discriminator_scores"]["tension"]       = tension

        all_cliff.append(cliff)
        all_risk.append(risk)

        flags = flag_improvements(ep, hook, cliff, risk)
        new_flags.extend(flags)

        # Debug log
        print(
            f"[IntelligenceEngine] EP{ep.get('episode_index','-')} '{ep.get('title','')}' │ "
            f"hook={hook:.1f} cliff={cliff:.1f} risk={risk:.3f} mood={mood:+.2f} tension={tension:.3f}"
        )

    # Update arc-level averages
    if all_cliff:
        arc_dict["avg_cliffhanger_score"] = round(sum(all_cliff) / len(all_cliff), 2)
    if all_risk:
        arc_dict["avg_retention_risk"] = round(sum(all_risk) / len(all_risk), 3)

    # Prepend intelligence flags to improvement suggestions
    existing = arc_dict.get("improvement_suggestions", [])
    arc_dict["improvement_suggestions"] = new_flags + existing

    print(f"[IntelligenceEngine] Arc averages → "
          f"avg_cliff={arc_dict.get('avg_cliffhanger_score'):.2f}  "
          f"avg_risk={arc_dict.get('avg_retention_risk'):.3f}  "
          f"improvements_flagged={len(new_flags)}")

    return arc_dict
