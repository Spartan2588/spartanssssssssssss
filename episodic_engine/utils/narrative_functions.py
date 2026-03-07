"""
utils/narrative_functions.py
─────────────────────────────
Hard-coded catalogue of narrative functions (storytelling goals).

Inspired by the ASP-guided paper (§2.1) which defines a minimal set of
15 constraints/narrative-function labels.  Here we translate that set
into Python dicts — this is the ONLY place any story-structure logic
lives; all other modules reference these IDs dynamically.

Each function has:
  name        – machine-readable key
  description – prompt-ready human description
  phase       – which part of a 0–1 normalised arc timeline it fits
  weight      – how critical it is (affects cliffhanger scoring)
"""

NARRATIVE_FUNCTION_CATALOGUE: list[dict] = [
    {
        "name": "exposition",
        "description": "Introduce the protagonist, world, and central situation. "
                       "Establish the ordinary world before disruption.",
        "phase_min": 0.0,
        "phase_max": 0.20,
        "weight": 0.5,
    },
    {
        "name": "inciting_incident",
        "description": "A disruptive event pulls the protagonist out of their comfort zone "
                       "and kicks off the central conflict.",
        "phase_min": 0.10,
        "phase_max": 0.30,
        "weight": 0.8,
    },
    {
        "name": "rising_action",
        "description": "Escalating complications and challenges that raise the stakes "
                       "and deepen the conflict.",
        "phase_min": 0.25,
        "phase_max": 0.55,
        "weight": 0.6,
    },
    {
        "name": "revelation",
        "description": "A major discovery or twist that recontextualises earlier events "
                       "and raises a new question for the protagonist.",
        "phase_min": 0.35,
        "phase_max": 0.65,
        "weight": 0.9,
    },
    {
        "name": "dark_night_of_the_soul",
        "description": "The protagonist faces their lowest moment, forced to confront "
                       "inner fears before a final push forward.",
        "phase_min": 0.55,
        "phase_max": 0.75,
        "weight": 0.85,
    },
    {
        "name": "climax",
        "description": "The peak confrontation or decision where the central conflict "
                       "is directly addressed.",
        "phase_min": 0.65,
        "phase_max": 0.90,
        "weight": 1.0,
    },
    {
        "name": "resolution",
        "description": "The aftermath of the climax. Loose ends are tied, the new normal "
                       "is established, and a final hook teases what comes next.",
        "phase_min": 0.80,
        "phase_max": 1.0,
        "weight": 0.7,
    },
    {
        "name": "character_bonding",
        "description": "An intimate scene that deepens the relationship between two characters, "
                       "building emotional investment.",
        "phase_min": 0.0,
        "phase_max": 0.60,
        "weight": 0.5,
    },
    {
        "name": "world_building",
        "description": "Expand the physical or social landscape of the story world, "
                       "adding texture and believability.",
        "phase_min": 0.0,
        "phase_max": 0.40,
        "weight": 0.4,
    },
    {
        "name": "cliffhanger",
        "description": "End on an unresolved high-stakes moment designed to compel "
                       "the audience to continue immediately.",
        "phase_min": 0.10,
        "phase_max": 1.0,
        "weight": 1.0,
    },
]


def get_function_by_name(name: str) -> dict | None:
    """Return the catalogue entry for a given narrative function name."""
    for func in NARRATIVE_FUNCTION_CATALOGUE:
        if func["name"] == name:
            return func
    return None


def get_functions_for_phase(phase: float) -> list[dict]:
    """Return all narrative functions valid at the given normalised phase (0–1)."""
    return [
        f for f in NARRATIVE_FUNCTION_CATALOGUE
        if f["phase_min"] <= phase <= f["phase_max"]
    ]


def assign_functions_to_episodes(n_episodes: int) -> list[str]:
    """
    Deterministically assign a narrative function to each episode
    using a phase-based greedy allocation — mimics the ASP constraint
    that 'each scene performs exactly one narrative function'.
    
    Returns list of function names of length n_episodes.
    """
    # Must-have functions for a complete vertical arc
    required_sequence = [
        "exposition",
        "inciting_incident",
        "rising_action",
        "revelation" if n_episodes >= 6 else "rising_action",
        "dark_night_of_the_soul" if n_episodes >= 6 else "climax",
        "climax",
        "resolution",
        "cliffhanger" if n_episodes >= 8 else None,
    ]
    # Trim to exact count
    result = [f for f in required_sequence[:n_episodes] if f is not None]
    # Pad if needed by inserting rising_action
    while len(result) < n_episodes:
        result.insert(-1, "rising_action")
    return result[:n_episodes]
