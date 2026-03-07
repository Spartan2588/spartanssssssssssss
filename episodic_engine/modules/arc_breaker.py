"""
modules/arc_breaker.py
───────────────────────
Module 1 — Arc Breaker

Responsibility:
  Given a short story idea (premise), produce a structured 5–8 episode arc
  with one narrative-function assignment per episode, plus a Chapter Begin
  Node (CBN) and Chapter End Node (CEN) in SVO-triplet format for each.

Research lineage:
  • ASP-guided paper §2.1  – narrative functions assigned to each scene
  • STORYTELLER §3.2       – CBN / CEN SVO triplet generation
  • STORYWRITER §2.2       – EventSeed + EventValidator agent pair

The module calls the LLM twice:
  1. EventSeed call  → generate raw episode list (STORYWRITER pattern)
  2. EventValidator  → validate / correct logical coherence of episode flow

Output: StoryArc (populated with EpisodeNodes, no generated_text yet)
"""

from __future__ import annotations
import json
import uuid
from typing import Any

from schemas import StoryArc, EpisodeNode, NarrativeFunction, SVOTriplet
from utils import llm_json_call, assign_functions_to_episodes, get_function_by_name


# ─────────────────────────── Prompts ────────────────────────────────────────

_EVENTSEED_SYSTEM = """\
You are an expert story architect specialising in short-form vertical content.
You create tight, emotionally compelling episode arcs for 90-second episodes.
Always respond with valid JSON only.
"""

_EVENTSEED_PROMPT = """\
I need to break the following story idea into exactly {n} episodes for a \
vertical storytelling format (each episode ≈ 90 seconds of content).

Story idea: "{premise}"
Genre (if specified): {genre}

Assign each episode ONE of these narrative functions:
{functions_json}

For each episode return:
- episode_index   (1-based integer)
- title           (5-8 words, evocative)
- abstract        (2–3 sentences describing what happens)
- narrative_function_name  (must be from the list above)
- cbm_subject, cbm_verb, cbm_object  (SVO triplet for how this episode BEGINS)
- cen_subject, cen_verb, cen_object  (SVO triplet for how this episode ENDS)
- events          (list of 2-4 short event strings that occur in this episode)
- key_entities    (list of character/object/location names introduced or featured)

Respond with JSON:
{{
  "episodes": [ {{ ... }}, ... ],
  "entity_registry": {{ "EntityName": ["relationship description", ...], ... }}
}}
"""

_VALIDATOR_SYSTEM = """\
You are an expert story coherence validator.
You check that episode arcs are logically consistent and emotionally progressive.
Always respond with valid JSON only.
"""

_VALIDATOR_PROMPT = """\
Review the following episode arc for logical coherence, causal integrity, and
narrative function correctness.  Apply these rules (from story-structure research):
  1. Each episode's CEN (end-node) should causally lead to the next episode's CBN (begin-node).
  2. No two consecutive episodes should share the same narrative function.
  3. Emotional intensity must show clear progression (not flat).
  4. Every key entity introduced must reappear in at least one later episode.

If any episode violates these rules, rewrite ONLY that episode's fields.
Return the corrected full arc in the SAME JSON structure as the input.

Arc to validate:
{arc_json}
"""


# ─────────────────────────── Main function ──────────────────────────────────

def run(
    premise: str,
    desired_episodes: int = 6,
    genre: str | None = None,
) -> StoryArc:
    """
    Break a premise into a structured episode arc.

    Parameters
    ----------
    premise          : Short story idea.
    desired_episodes : Number of episodes (5–8).
    genre            : Optional genre hint.

    Returns
    -------
    StoryArc with EpisodeNodes fully populated (no generated_text yet).
    """
    story_id = str(uuid.uuid4())[:8]

    # Step 1 – assign narrative functions (ASP-like constraint solver in Python)
    func_names = assign_functions_to_episodes(desired_episodes)
    func_catalogue = [
        {"name": n, "description": (get_function_by_name(n) or {}).get("description", "")}
        for n in set(func_names)
    ]

    # Step 2 – EventSeed: generate initial episode list
    seed_prompt = _EVENTSEED_PROMPT.format(
        n=desired_episodes,
        premise=premise,
        genre=genre or "not specified",
        functions_json=json.dumps(func_catalogue, indent=2),
    )
    seed_data: dict[str, Any] = llm_json_call(seed_prompt, _EVENTSEED_SYSTEM, temperature=0.7)

    raw_episodes: list[dict] = seed_data.get("episodes", [])
    entity_registry: dict[str, list[str]] = seed_data.get("entity_registry", {})

    # Step 3 – EventValidator: coherence check + correction
    validator_prompt = _VALIDATOR_PROMPT.format(
        arc_json=json.dumps(seed_data, indent=2)
    )
    validated_data: dict[str, Any] = llm_json_call(validator_prompt, _VALIDATOR_SYSTEM, temperature=0.2)

    final_episodes: list[dict] = validated_data.get("episodes", raw_episodes)
    entity_registry = validated_data.get("entity_registry", entity_registry)

    # Step 4 – Convert raw dicts → Pydantic EpisodeNode objects
    episode_nodes: list[EpisodeNode] = []
    for i, ep in enumerate(final_episodes[:desired_episodes]):
        func_name = ep.get("narrative_function_name", func_names[i])
        func_info = get_function_by_name(func_name) or {
            "name": func_name,
            "description": "Custom narrative function.",
        }

        node = EpisodeNode(
            episode_index=ep.get("episode_index", i + 1),
            title=ep.get("title", f"Episode {i+1}"),
            abstract=ep.get("abstract", ""),
            narrative_function=NarrativeFunction(
                name=func_info["name"],
                description=func_info["description"],
                constraint_weight=func_info.get("weight", 1.0),
            ),
            chapter_begin_node=SVOTriplet(
                subject=ep.get("cbm_subject", "protagonist"),
                verb=ep.get("cbm_verb", "enters"),
                obj=ep.get("cbm_object", "scene"),
                time_stamp=0,
                chapter_index=i + 1,
            ),
            chapter_end_node=SVOTriplet(
                subject=ep.get("cen_subject", "protagonist"),
                verb=ep.get("cen_verb", "faces"),
                obj=ep.get("cen_object", "challenge"),
                time_stamp=10,
                chapter_index=i + 1,
            ),
            events=ep.get("events", []),
        )
        episode_nodes.append(node)

    arc = StoryArc(
        story_id=story_id,
        premise=premise,
        genre=genre,
        total_episodes=len(episode_nodes),
        entity_registry=entity_registry,
        episodes=episode_nodes,
    )
    return arc
