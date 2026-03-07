"""
schemas/episode_schema.py
─────────────────────────
Canonical JSON-compatible Pydantic models used as the shared data-bus
between every module.  All inter-module communication passes one of
these structures so the system is fully modular and schema-validated.

Inspired by:
 • STORYTELLER's SVO triplet plot-node structure  (plot_nodes field)
 • STORYWRITER's event-tuple outline format        (events / sub_events)
 • ASP-guided approach's narrative-function slots  (narrative_function)
 • Plan-Write-Revise discriminator scoring          (discriminator_scores)
"""

from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field


# ─────────────────────────────── Atom-level ────────────────────────────────

class SVOTriplet(BaseModel):
    """
    Subject-Verb-Object triplet (STORYTELLER §3.1).
    Used as the finest-grained plot atom.
    """
    subject: str
    verb: str
    obj: str
    time_stamp: Optional[int] = None        # chapter-relative ordinal
    chapter_index: Optional[int] = None


class NarrativeFunction(BaseModel):
    """
    High-level storytelling goal that one scene/episode must fulfil.
    (ASP-guided paper §2.1 – 'assign exactly one narrative function per scene')
    """
    name: str                               # e.g. "inciting_incident", "dark_night"
    description: str
    constraint_weight: float = 1.0          # how strongly to enforce this goal


# ─────────────────────────────── Episode ──────────────────────────────────

class EpisodeNode(BaseModel):
    """
    One vertical episode (≈ 90 s of content).
    Mirrors STORYWRITER's chapter construction + STORYTELLER's CBN/CEN + CPNs.
    """
    episode_index: int                      # 1-based
    title: str
    abstract: str
    narrative_function: NarrativeFunction

    # STORYTELLER-style plot nodes
    chapter_begin_node: SVOTriplet          # CBN
    chapter_end_node: SVOTriplet            # CEN
    chapter_plot_nodes: list[SVOTriplet] = Field(default_factory=list)  # CPNs

    # STORYWRITER-style event info
    events: list[str] = Field(default_factory=list)
    sub_events: list[str] = Field(default_factory=list)

    # scores (filled in by analyser modules)
    emotional_score: Optional[float] = None     # –1.0 … +1.0
    cliffhanger_score: Optional[float] = None   # 0 … 10
    retention_risk: Optional[float] = None      # 0 … 1  (higher = riskier)
    hook_score: Optional[float] = None          # 0 … 10  (opening urgency)
    tension_score: Optional[float] = None       # 0 … 1   (conflict density)
    episode_stage: Optional[str] = None         # Narrative stage label
    discriminator_scores: dict[str, float] = Field(default_factory=dict)
    # keys: "creativity", "coherence", "relevance", "surprise", "engagement"

    # content generated in Stage 3
    generated_text: Optional[str] = None


# ─────────────────────────────── Arc ──────────────────────────────────────

class StoryArc(BaseModel):
    """
    Full 5-8 episode arc returned by the Arc-Breaker module.
    This is the central shared payload that flows through the pipeline.
    """
    story_id: str
    premise: str                            # user-supplied short idea
    genre: Optional[str] = None
    total_episodes: int

    # NEKG-style entity registry (STORYTELLER §3.1)
    entity_registry: dict[str, list[str]] = Field(default_factory=dict)
    # {entity_name: [relationship_strings]}

    episodes: list[EpisodeNode] = Field(default_factory=list)

    # Arc-level analytics (filled by Analysis Orchestrator)
    emotional_arc_summary: Optional[str] = None
    avg_cliffhanger_score: Optional[float] = None
    avg_retention_risk: Optional[float] = None
    improvement_suggestions: list[str] = Field(default_factory=list)


# ─────────────────────────────── Pipeline I/O ─────────────────────────────

class EngineRequest(BaseModel):
    """What the API caller sends in."""
    story_idea: str = Field(..., min_length=10, max_length=2000,
                            description="A short story idea (1-3 sentences).")
    desired_episodes: int = Field(default=6, ge=5, le=8)
    genre: Optional[str] = None


class EngineResponse(BaseModel):
    """What the API returns."""
    story_id: str
    arc: StoryArc
    pipeline_log: list[str] = Field(default_factory=list)
    status: str = "success"
