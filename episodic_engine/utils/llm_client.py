"""
utils/llm_client.py
────────────────────
Thin, provider-agnostic LLM wrapper.

All modules call `llm_call(prompt, system_prompt, response_format)`.
The actual provider (OpenAI-compatible endpoint) is configured via
environment variables, so swapping models requires zero code change.

If LLM_API_KEY is not set, the client runs in DEMO MODE and returns
realistic mock responses so the full pipeline works without any key.
"""

from __future__ import annotations
import json
import os
import re
import time
import hashlib
import random
from typing import Any

import httpx

# Load .env file automatically so LLM_API_KEY is available even if not set
# in the system environment (safe no-op if python-dotenv is not installed)
try:
    from dotenv import load_dotenv
    _env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
    load_dotenv(dotenv_path=_env_path, override=False)
except ImportError:
    pass  # dotenv not installed — rely on system environment variables


# ──────────────────────────── Config ──────────────────────────────────────
BASE_URL    = os.environ.get("LLM_BASE_URL",  "https://api.openai.com/v1")
API_KEY     = os.environ.get("LLM_API_KEY",   "").strip()
MODEL       = os.environ.get("LLM_MODEL",     "gpt-4o-mini")
MAX_RETRIES = 3
TIMEOUT     = 120.0

# Demo mode is active when no real API key is configured or the placeholder is still set
DEMO_MODE = (
    not API_KEY
    or API_KEY.lower().startswith("sk-your")
    or API_KEY.lower() == "your_key_here"
    or len(API_KEY) < 10  # sanity-check: real keys are always long
)


# ──────────────────────────── Demo / Mock Layer ───────────────────────────

def _seed(prompt: str) -> random.Random:
    """Deterministic RNG seeded from prompt so same input → same output."""
    h = int(hashlib.md5(prompt.encode()).hexdigest(), 16)
    return random.Random(h)


_NARRATIVE_FUNCTIONS = [
    "exposition", "inciting_incident", "rising_action",
    "revelation", "dark_night_of_the_soul", "climax",
]

_VERBS   = ["discovers", "confronts", "escapes", "reveals", "destroys", "unlocks"]
_OBJECTS = ["the truth", "the enemy", "a secret", "their past", "the only exit", "hidden evidence"]


def _demo_json_call(prompt: str) -> dict:
    """
    Return realistic mock JSON based on which pipeline stage is calling.
    Detection is done by looking for keywords in the prompt.
    """
    rng = _seed(prompt)

    # ── Arc Breaker (EventSeed + EventValidator) ──────────────────────────
    if "episode_index" in prompt or "narrative_function_name" in prompt or "cbm_subject" in prompt:
        n = 6
        # Try to extract n from prompt
        m = re.search(r"into exactly (\d+) episodes", prompt)
        if m:
            n = int(m.group(1))

        # Extract premise
        premise_match = re.search(r'Story idea:\s*"([^"]+)"', prompt)
        premise = premise_match.group(1) if premise_match else "A story"
        protagonist = premise.split()[1] if len(premise.split()) > 1 else "Hero"

        episode_titles = [
            "The World Changes Forever",
            "No Way Back",
            "The Truth Surfaces",
            "Betrayal in the Dark",
            "The Last Gamble",
            "Everything Breaks",
            "Into the Fire",
            "The Final Reckoning",
        ]
        fns = _NARRATIVE_FUNCTIONS[:n]
        episodes = []
        for i in range(n):
            fn = fns[i % len(fns)]
            episodes.append({
                "episode_index": i + 1,
                "title": episode_titles[i % len(episode_titles)],
                "abstract": (
                    f"{protagonist} faces a turning point as {rng.choice(_OBJECTS)} is exposed. "
                    f"The stakes rise and there is no easy way forward. "
                    f"By the end, nothing will be the same."
                ),
                "narrative_function_name": fn,
                "cbm_subject": protagonist,
                "cbm_verb": "enters",
                "cbm_object": f"episode {i+1} conflict",
                "cen_subject": protagonist,
                "cen_verb": rng.choice(_VERBS),
                "cen_object": rng.choice(_OBJECTS),
                "events": [
                    f"{protagonist} makes a decision",
                    "Tension escalates",
                    f"A revelation about {rng.choice(_OBJECTS)}",
                ],
                "key_entities": [protagonist, "Antagonist", "Key Object"],
            })
        return {
            "episodes": episodes,
            "entity_registry": {
                protagonist: ["protagonist", "main character"],
                "Antagonist": ["villain", "opposing force"],
                "Key Object": ["catalyst", "central MacGuffin"],
            },
        }

    # ── Plot Node Expander (Pseudo-CPN) ───────────────────────────────────
    if "Chapter Plot Node" in prompt or "CPN" in prompt or "subject" in prompt and "converged" in prompt:
        subj = rng.choice(["protagonist", "antagonist", "the ally", "the object"])
        verb = rng.choice(["moves toward", "grabs", "confronts", "discovers", "escapes with"])
        obj  = rng.choice(["the key evidence", "the hidden door", "the antagonist", "the truth", "safety"])
        return {"subject": subj, "verb": verb, "object": obj, "converged": False}

    # ── Plot Node Review ──────────────────────────────────────────────────
    if "accepted" in prompt and "modified_subject" in prompt:
        return {"accepted": True, "reason": "Causal chain is consistent.", "modified_subject": None, "modified_verb": None, "modified_object": None}

    # ── Emotional Analyser ────────────────────────────────────────────────
    if "valence" in prompt and "intensity" in prompt and "empathy_pull" in prompt and "score" in prompt:
        v = round(rng.uniform(-0.9, 0.3), 2)
        return {
            "valence":      {"score": v,                          "rationale": "The episode carries strong negative tension."},
            "intensity":    {"score": round(rng.uniform(0.6, 1.0), 2), "rationale": "High dramatic stakes throughout."},
            "surprise":     {"score": round(rng.uniform(0.5, 0.95), 2), "rationale": "Unexpected developments keep the audience guessing."},
            "empathy_pull": {"score": round(rng.uniform(0.6, 0.95), 2), "rationale": "Audience is deeply invested in the outcome."},
        }

    # ── Emotional Arc Summary ─────────────────────────────────────────────
    if "emotional_arc_summary" in prompt or ("arc-level summary" in prompt and "Scores" in prompt):
        return {"emotional_arc_summary": "A tightly wound escalating arc that begins with isolated dread and plunges to crisis before a cathartic but unsettling climax. Strong emotional variety with clear peaks and no dead zones — ideal for 90-second vertical retention."}

    # ── Cliffhanger Scorer ──────────────────────────────────────
    # Keys MUST match what cliffhanger_scorer.py reads: result.get(signal_name, {}).get('score')
    if "cliffhanger" in prompt.lower() or "open_loop_score" in prompt or "stakes_score" in prompt:
        ep_match = re.search(r"(?:episode|ep)[^\d]*(\d+)", prompt.lower())
        ep_idx = int(ep_match.group(1)) if ep_match else 1
        ep_rng = random.Random(rng.random() * 1000 + ep_idx * 137)
        # Scores escalate toward climax (ep1 ≈ 6, ep6 ≈ 9)
        base = min(0.8 + ep_idx * 0.15, 1.85)
        return {
            "open_loop_score":    {"score": round(ep_rng.uniform(base - 0.2, min(base + 0.2, 2.0)), 2), "rationale": "Unresolved question hooks next-ep curiosity.", "tip": ""},
            "stakes_score":       {"score": round(ep_rng.uniform(base - 0.3, min(base + 0.1, 2.0)), 2), "rationale": "High consequences at the cut point.", "tip": ""},
            "reversal_score":     {"score": round(ep_rng.uniform(base - 0.5, min(base + 0.1, 2.0)), 2), "rationale": "Reversal subverts audience prediction.", "tip": ""},
            "character_jeopardy": {"score": round(ep_rng.uniform(base - 0.2, min(base + 0.2, 2.0)), 2), "rationale": "Protagonist faces immediate threat.", "tip": ""},
            "pacing_score":       {"score": round(ep_rng.uniform(base - 0.4, min(base + 0.2, 2.0)), 2), "rationale": "CEN ends on kinetic action verb.", "tip": ""},
        }

    # ── Retention Predictor ──────────────────────────────────────
    # Keys MUST match what retention_predictor.py reads: result.get(factor, {}).get('score')
    if "coherence_risk" in prompt or "retention" in prompt.lower() or "drop-off" in prompt.lower():
        ep_match = re.search(r"(?:episode|ep)[^\d]*(\d+)", prompt.lower())
        ep_idx = int(ep_match.group(1)) if ep_match else 1
        ep_rng = random.Random(rng.random() * 1000 + ep_idx * 97)
        return {
            "coherence_risk":  {"score": round(ep_rng.uniform(0.10, 0.45), 3), "rationale": "Cause-effect chain is followable.", "tip": ""},
            "pacing_risk":     {"score": round(ep_rng.uniform(0.10, 0.40 + ep_idx * 0.02), 3), "rationale": "Pacing calibrated for 90s format.", "tip": ""},
            "complexity_risk": {"score": round(ep_rng.uniform(max(0.05, 0.30 - ep_idx * 0.03), 0.45), 3), "rationale": "Entity density manageable.", "tip": ""},
            "engagement_risk": {"score": round(ep_rng.uniform(0.10, 0.40), 3), "rationale": "Emotional hook present in opening beat.", "tip": ""},
            "exposition_risk": {"score": round(ep_rng.uniform(0.05, 0.35), 3), "rationale": "Narration-to-action ratio is healthy.", "tip": ""},
        }

    # ── Improvement Suggestor ─────────────────────────────────────────────
    if "improvement" in prompt.lower() or "recommendation" in prompt.lower() or "weakness" in prompt.lower():
        return {
            "suggestions": [
                "[ARC|HIGH|character] Eps [1, 3]: Ensure your protagonist has a clear internal want vs external need — this gap drives the most compelling emotional arcs.",
                "[ARC|HIGH|pacing] Eps [4, 5]: The two highest-intensity episodes run consecutively. Insert a brief 'breath' moment at the top of episode 5 to maximise cathartic payoff.",
                "[ARC|MEDIUM|emotional_arc] Eps [2, 3]: Consider adding a moment of unexpected warmth or dark humour to break the sustained negative valence and prevent emotional fatigue.",
                "[ARC|MEDIUM|narrative_function] Eps [2]: Add a micro world-building beat — audiences need context on the rules of your story world before fully investing in its escalation.",
                "[ARC|LOW|cliffhanger] Eps [1, 2]: Sharpen the final verb of each Chapter End Node to be more viscerally active — use physical action verbs over abstract ones.",
            ]
        }

    # ── Fallback ──────────────────────────────────────────────────────────
    return {"result": "ok", "message": "Demo mode response."}


# ──────────────────────────── Core Call ───────────────────────────────────

def llm_call(
    prompt: str,
    system_prompt: str = "You are a professional story intelligence analyst.",
    temperature: float = 0.7,
    max_tokens: int = 2048,
    json_mode: bool = False,
) -> str:
    """Call an OpenAI-compatible LLM endpoint. Falls back to demo mode if no key."""
    # Re-check at call time in case module was imported before env was set
    _key = API_KEY or os.environ.get("LLM_API_KEY", "").strip()
    _demo = DEMO_MODE or not _key or _key.lower().startswith("sk-your") or len(_key) < 10

    if _demo:
        print("[LLM] Demo mode active (no valid API key) — returning mock response.")
        return json.dumps(_demo_json_call(prompt))

    # Use the freshest key available
    _key = _key  # already resolved above

    headers = {
        "Authorization": f"Bearer {_key}",
        "Content-Type":  "application/json",
    }
    payload: dict[str, Any] = {
        "model":       MODEL,
        "temperature": temperature,
        "max_tokens":  max_tokens,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": prompt},
        ],
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    last_exc: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with httpx.Client(timeout=TIMEOUT) as client:
                resp = client.post(
                    f"{BASE_URL}/chat/completions",
                    headers=headers,
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"].strip()
        except Exception as exc:
            last_exc = exc
            wait = 2 ** attempt
            print(f"[LLM] Attempt {attempt} failed: {exc}. Retrying in {wait}s …")
            time.sleep(wait)

    raise RuntimeError(f"LLM call failed after {MAX_RETRIES} retries: {last_exc}")


def llm_json_call(
    prompt: str,
    system_prompt: str = "You are a professional story intelligence analyst.",
    temperature: float = 0.3,
    max_tokens: int = 2048,
) -> dict | list:
    """Wrapper that always returns parsed JSON."""
    raw = llm_call(prompt, system_prompt, temperature, max_tokens, json_mode=True)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", raw)
        if match:
            return json.loads(match.group(1))
        cleaned = re.sub(r"^```(?:json)?|```$", "", raw.strip())
        return json.loads(cleaned)
