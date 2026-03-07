"""
modules/plot_node_expander.py
──────────────────────────────
Module 2 — Plot Node Expander

Responsibility:
  For each EpisodeNode, generate the intermediate Chapter Plot Nodes (CPNs)
  as SVO triplets.  CPNs connect CBN → CEN with logically consistent micro-
  events, reviewed for coherence before acceptance.

Research lineage:
  • STORYTELLER §3.3 (Stage 2: Mid-Level Plot Structuring)
    – Pseudo CPN Generation and Review
    – Uses NEKG to retrieve related entity nodes for validation
  • STORYWRITER ReIO mechanism
    – Coordinator dynamically compresses context for each sub-event

Algorithm per episode:
  1. Generate a Pseudo-CPN (fast, unchecked).
  2. Review it against CBN, CEN, existing CPNs, and entity relationships.
  3. Accept or request a modified CPN.
  4. Repeat until the last CPN's obj converges close to CEN.
"""

from __future__ import annotations
import json
from typing import Any

from schemas import StoryArc, EpisodeNode, SVOTriplet
from utils import llm_json_call


_MAX_CPNS_PER_EPISODE = 4   # keep episodes tight for 90-second format

_PSEUDO_CPN_SYSTEM = """\
You are a granular plot planner for short-form vertical video stories.
Generate precise SVO (subject-verb-object) triplet plot nodes.
Always respond with valid JSON only.
"""

_PSEUDO_CPN_PROMPT = """\
Episode context:
  Title      : {title}
  Abstract   : {abstract}
  Begin Node (CBN): {cbn}
  End Node   (CEN): {cen}
  Already generated CPNs so far: {cpns_so_far}
  
Entity registry (characters/objects/locations): {entity_registry}

Generate the NEXT logical Chapter Plot Node (CPN) as an SVO triplet that
moves the story from the last CPN (or CBN if none) closer to the CEN.

Rules:
  • Subject must be an established entity.
  • The verb must show clear causal action (not a state verb like "is").
  • Object must directly follow from the previous node.
  • If the CPNs list already contains {max_cpns} items, set "converged": true
    and just confirm the CEN as node.

Respond with JSON:
{{
  "subject": "...",
  "verb": "...",
  "object": "...",
  "converged": false
}}
"""

_REVIEW_SYSTEM = """\
You are a narrative coherence reviewer.
You validate SVO plot nodes for logical consistency.
Always respond with valid JSON only.
"""

_REVIEW_PROMPT = """\
Review this Pseudo-CPN for the episode described below.

Episode CBN: {cbn}
Episode CEN: {cen}
Previous CPNs: {cpns}
Pseudo-CPN to review: {pseudo_cpn}
Related entities from the story: {entity_registry}

Is the Pseudo-CPN:
  1. Causally consistent with the previous CPN / CBN?
  2. Introducing the correct characters/objects (no hallucinated entities)?
  3. Moving the narrative meaningfully toward the CEN?

Respond with JSON:
{{
  "accepted": true | false,
  "reason": "...",
  "modified_subject": "..." | null,
  "modified_verb": "..."    | null,
  "modified_object": "..."  | null
}}
"""


def _format_triplet(t: SVOTriplet) -> str:
    return f"<{t.subject}, {t.verb}, {t.obj}>"


def _expand_episode(
    episode: EpisodeNode,
    entity_registry: dict[str, list[str]],
) -> EpisodeNode:
    """Fill episode.chapter_plot_nodes with reviewed CPNs."""
    cpns: list[SVOTriplet] = []
    cbn = episode.chapter_begin_node
    cen = episode.chapter_end_node

    for step in range(_MAX_CPNS_PER_EPISODE):
        cpns_str = json.dumps([
            {"subject": c.subject, "verb": c.verb, "object": c.obj} for c in cpns
        ])

        # --- Generate Pseudo-CPN ---
        pseudo_prompt = _PSEUDO_CPN_PROMPT.format(
            title=episode.title,
            abstract=episode.abstract,
            cbn=_format_triplet(cbn),
            cen=_format_triplet(cen),
            cpns_so_far=cpns_str,
            entity_registry=json.dumps(entity_registry),
            max_cpns=_MAX_CPNS_PER_EPISODE,
        )
        pseudo: dict[str, Any] = llm_json_call(pseudo_prompt, _PSEUDO_CPN_SYSTEM, temperature=0.5)

        if pseudo.get("converged"):
            break

        # --- Review Pseudo-CPN ---
        review_prompt = _REVIEW_PROMPT.format(
            cbn=_format_triplet(cbn),
            cen=_format_triplet(cen),
            cpns=cpns_str,
            pseudo_cpn=json.dumps(pseudo),
            entity_registry=json.dumps(entity_registry),
        )
        review: dict[str, Any] = llm_json_call(review_prompt, _REVIEW_SYSTEM, temperature=0.1)

        if review.get("accepted"):
            final_subject = pseudo["subject"]
            final_verb    = pseudo["verb"]
            final_obj     = pseudo["object"]
        else:
            # Use modified version if provided
            final_subject = review.get("modified_subject") or pseudo["subject"]
            final_verb    = review.get("modified_verb")    or pseudo["verb"]
            final_obj     = review.get("modified_object")  or pseudo["object"]

        cpns.append(SVOTriplet(
            subject=final_subject,
            verb=final_verb,
            obj=final_obj,
            time_stamp=step + 1,
            chapter_index=episode.episode_index,
        ))

    episode.chapter_plot_nodes = cpns
    return episode


def run(arc: StoryArc) -> StoryArc:
    """
    Expand all EpisodeNodes in the arc with CPN sequences.
    Mutates arc in place and returns it.
    """
    for i, episode in enumerate(arc.episodes):
        arc.episodes[i] = _expand_episode(episode, arc.entity_registry)
    return arc
