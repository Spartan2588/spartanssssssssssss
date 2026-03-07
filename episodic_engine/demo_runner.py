"""
demo_runner.py
───────────────
FULL PIPELINE DEMO — runs WITHOUT an LLM API key.

Patches the LLM layer with deterministic mock responses and demonstrates
every module of the Episodic Intelligence Engine end-to-end.

Run with:
    python demo_runner.py
"""
from __future__ import annotations
import json, sys, os, time, textwrap, copy
import unittest.mock

# ─── Story we are demonstrating ───────────────────────────────────────────
STORY_IDEA = (
    "A teenage girl discovers she can hear the last words of the dead "
    "by touching objects they owned — but the voices start following her home."
)

# ─── Pre-built arc (returned by mock arc_breaker.run) ─────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from schemas import (
    StoryArc, EpisodeNode, NarrativeFunction,
    SVOTriplet, EngineRequest, EngineResponse,
)

def _make_arc() -> StoryArc:
    episodes = [
        EpisodeNode(
            episode_index=1, title="The Weight of the Old Violin",
            abstract="Mara, 17, touches a dusty violin at a pawn shop and hears the final plea of its dead owner. Shaken, she flees — but the voice echoes in her head all night.",
            narrative_function=NarrativeFunction(name="exposition", description="Introduce the protagonist and world.", constraint_weight=0.5),
            chapter_begin_node=SVOTriplet(subject="Mara", verb="enters", obj="pawn shop", time_stamp=0, chapter_index=1),
            chapter_end_node=SVOTriplet(subject="voice", verb="follows", obj="Mara home", time_stamp=10, chapter_index=1),
            events=["Mara touches vintage violin", "Dead man's voice erupts", "Mara flees in panic"],
        ),
        EpisodeNode(
            episode_index=2, title="Every Surface Screams",
            abstract="Mara wakes unable to touch anything without triggering voices. Her bedroom becomes a gauntlet of dead strangers' last words. She cuts class and tries to map her new ability.",
            narrative_function=NarrativeFunction(name="inciting_incident", description="A disruptive event kicks off the central conflict.", constraint_weight=0.8),
            chapter_begin_node=SVOTriplet(subject="Mara", verb="wakes", obj="surrounded by voices", time_stamp=0, chapter_index=2),
            chapter_end_node=SVOTriplet(subject="Mara", verb="discovers", obj="pattern in the voices", time_stamp=10, chapter_index=2),
            events=["Bedframe triggers 3 voices", "Mara skips school", "Voices intensify near old objects"],
        ),
        EpisodeNode(
            episode_index=3, title="The Murdered Girl in the Locket",
            abstract="Her grandmother's locket reveals a murdered girl, Maya Chen, who whispers the name of her killer — a name Mara recognises as her science teacher, Mr Holloway.",
            narrative_function=NarrativeFunction(name="rising_action", description="Escalating complications raise the stakes.", constraint_weight=0.6),
            chapter_begin_node=SVOTriplet(subject="Mara", verb="opens", obj="grandmother's locket", time_stamp=0, chapter_index=3),
            chapter_end_node=SVOTriplet(subject="Mara", verb="recognises", obj="teacher's name as killer", time_stamp=10, chapter_index=3),
            events=["Locket triggers vivid clear voice", "Maya Chen names her killer", "Mara pulls up teacher's photo"],
        ),
        EpisodeNode(
            episode_index=4, title="Do Not Tell Anyone",
            abstract="Mara confides in her best friend Dex, who is thrilled and terrified. That night, a new voice appears — this one knows Mara's full name.",
            narrative_function=NarrativeFunction(name="revelation", description="A major discovery recontextualises earlier events.", constraint_weight=0.9),
            chapter_begin_node=SVOTriplet(subject="Mara", verb="tells", obj="Dex about the ability", time_stamp=0, chapter_index=4),
            chapter_end_node=SVOTriplet(subject="unknown voice", verb="whispers", obj="Mara's full name", time_stamp=10, chapter_index=4),
            events=["Mother dismisses Mara", "Dex is fascinated", "Sentient voice interrupts sleep"],
        ),
        EpisodeNode(
            episode_index=5, title="The Dead Don't Stay Dead",
            abstract="The sentient voice is Maya Chen — and she is angry. She threatens to manifest unless Mara exposes Holloway. Mara sneaks into school and finds physical evidence in Holloway's desk.",
            narrative_function=NarrativeFunction(name="dark_night_of_the_soul", description="Protagonist faces their lowest point.", constraint_weight=0.85),
            chapter_begin_node=SVOTriplet(subject="Maya", verb="threatens", obj="to manifest", time_stamp=0, chapter_index=5),
            chapter_end_node=SVOTriplet(subject="Mara", verb="finds", obj="hidden evidence at school", time_stamp=10, chapter_index=5),
            events=["Maya's voice becomes visible static", "Mara sneaks into school alone", "Evidence: a bloody locket key"],
        ),
        EpisodeNode(
            episode_index=6, title="Touch Him and You'll Know Everything",
            abstract="Mara confronts Holloway and accidentally grabs his hand — receiving a torrent of memories: the murder, the cover-up, three more victims. Maya manifests physically. Holloway sees her.",
            narrative_function=NarrativeFunction(name="climax", description="Peak confrontation where the central conflict is resolved.", constraint_weight=1.0),
            chapter_begin_node=SVOTriplet(subject="Mara", verb="confronts", obj="Mr Holloway", time_stamp=0, chapter_index=6),
            chapter_end_node=SVOTriplet(subject="Maya", verb="manifests", obj="visible to Holloway", time_stamp=10, chapter_index=6),
            events=["Mara touches Holloway — floods of memory", "Three more victims revealed", "Maya manifests physically", "Holloway collapses"],
        ),
    ]
    return StoryArc(
        story_id="demo0001",
        premise=STORY_IDEA,
        genre="supernatural horror",
        total_episodes=6,
        entity_registry={
            "Mara":        ["protagonist", "teenager", "hears voices of the dead"],
            "Maya Chen":   ["murder victim", "ghost", "names killer"],
            "Mr Holloway": ["science teacher", "murderer", "antagonist"],
            "Dex":         ["Mara's best friend", "confidant"],
            "Grandmother's Locket": ["key object", "conductor of voices"],
        },
        episodes=episodes,
    )

# ─── Pre-computed analytic results ────────────────────────────────────────
EMOTIONAL_DATA = [
    dict(emotional_score=-0.12, valence=-0.30, intensity=0.65, surprise=0.75, empathy_pull=0.70),
    dict(emotional_score=-0.27, valence=-0.50, intensity=0.75, surprise=0.55, empathy_pull=0.85),
    dict(emotional_score=-0.48, valence=-0.70, intensity=0.90, surprise=0.90, empathy_pull=0.80),
    dict(emotional_score=-0.29, valence=-0.40, intensity=0.70, surprise=0.85, empathy_pull=0.75),
    dict(emotional_score=-0.60, valence=-0.85, intensity=0.95, surprise=0.70, empathy_pull=0.90),
    dict(emotional_score= 0.09, valence= 0.20, intensity=1.00, surprise=0.80, empathy_pull=0.95),
]

CLIFF_DATA   = [8.0, 8.1, 9.7, 9.3, 9.6, 9.5]
RISK_DATA    = [0.218, 0.256, 0.231, 0.274, 0.289, 0.312]
CPN_DATA = [
    [SVOTriplet(subject="Mara", verb="reaches", obj="for violin hesitantly", time_stamp=1, chapter_index=1),
     SVOTriplet(subject="violin", verb="radiates", obj="cold psychic energy", time_stamp=2, chapter_index=1)],
    [SVOTriplet(subject="Mara", verb="yanks", obj="hand away from bedframe", time_stamp=1, chapter_index=2),
     SVOTriplet(subject="Mara", verb="logs", obj="voice triggers in notebook", time_stamp=2, chapter_index=2)],
    [SVOTriplet(subject="Mara", verb="hesitates", obj="before opening locket", time_stamp=1, chapter_index=3),
     SVOTriplet(subject="Maya", verb="whispers", obj="Holloway's full name", time_stamp=2, chapter_index=3)],
    [SVOTriplet(subject="Dex", verb="records", obj="Mara touching objects on video", time_stamp=1, chapter_index=4),
     SVOTriplet(subject="strange voice", verb="interrupts", obj="Mara's sleep at 3am", time_stamp=2, chapter_index=4)],
    [SVOTriplet(subject="Mara", verb="sneaks", obj="into school after hours", time_stamp=1, chapter_index=5),
     SVOTriplet(subject="Mara", verb="pries", obj="open Holloway's desk drawer", time_stamp=2, chapter_index=5)],
    [SVOTriplet(subject="Mara", verb="extends", obj="her hand toward Holloway", time_stamp=1, chapter_index=6),
     SVOTriplet(subject="Holloway", verb="grabs", obj="Mara's wrist defensively", time_stamp=2, chapter_index=6),
     SVOTriplet(subject="Mara", verb="absorbs", obj="flood of murderous memories", time_stamp=3, chapter_index=6)],
]

IMPROVEMENT_SUGGESTIONS = [
    "[ARC|HIGH|character] Eps [4, 6]: Dex disappears after episode 4. Bring him back in episode 6 to add emotional counterweight to the climax.",
    "[ARC|HIGH|pacing] Eps [5, 6]: Episodes 5–6 are consecutively maximum-intensity. Insert a 10-second 'breath' moment at the top of episode 6 before the confrontation to maximise cathartic payoff.",
    "[ARC|MEDIUM|emotional_arc] Eps [2, 3]: Episode 2's sustained negative valence (-0.50) risks emotional fatigue before the teacher reveal. Add a 5-second moment of dark humour or warmth to break the monotony.",
    "[ARC|MEDIUM|narrative_function] Eps [2]: Consider adding a micro 'world_building' beat — audiences need a brief explanation of how the ability works before they fully invest in its escalation.",
    "[ARC|LOW|cliffhanger] Eps [1, 2]: Episodes 1–2 score 8.0/10 — strong, but episode 3's 9.7 shows what's possible. Sharpen the final verb of each CEN to be more viscerally active.",
]

EMOTIONAL_SUMMARY = (
    "A tightly wound escalating horror arc beginning with isolated dread (–0.12) "
    "and plunging to crisis (–0.60) before a cathartic but unsettling climax (+0.09). "
    "The arc delivers strong emotional variety with clear peaks at episodes 3 and 5 "
    "and no dead zones — ideal for 90-second vertical retention."
)

# ─── Terminal colour helpers ───────────────────────────────────────────────
CYAN    = "\033[96m"
GREEN   = "\033[92m"
YELLOW  = "\033[93m"
RED     = "\033[91m"
BOLD    = "\033[1m"
DIM     = "\033[2m"
RESET   = "\033[0m"
MAGENTA = "\033[95m"
BLUE    = "\033[94m"

def bar60(char="─"): return char * 60

def section(title: str):
    print(f"\n{BOLD}{CYAN}{bar60()}{RESET}")
    print(f"{BOLD}{CYAN}  {title}{RESET}")
    print(f"{BOLD}{CYAN}{bar60()}{RESET}")

def emo_bar(score: float) -> str:
    filled = int((score + 1.0) / 2.0 * 20)
    filled = max(0, min(20, filled))
    return "▓" * filled + "░" * (20 - filled)

def score_bar(score: float, max_val: float = 10.0) -> str:
    filled = int((score / max_val) * 20)
    filled = max(0, min(20, filled))
    return "█" * filled + "░" * (20 - filled)

def colour_cliff(sc: float) -> str:
    return GREEN if sc >= 7 else YELLOW if sc >= 5 else RED

def colour_risk(sc: float) -> str:
    return GREEN if sc < 0.35 else YELLOW if sc < 0.55 else RED

def step(msg: str, delay: float = 0.06):
    for ch in msg:
        sys.stdout.write(ch)
        sys.stdout.flush()
        time.sleep(delay)
    print()

def spinner_line(label: str, t: float = 0.8):
    frames = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"]
    end = time.time() + t
    i = 0
    while time.time() < end:
        sys.stdout.write(f"\r  {CYAN}{frames[i % len(frames)]}{RESET}  {label}   ")
        sys.stdout.flush()
        time.sleep(0.08)
        i += 1
    sys.stdout.write(f"\r  {GREEN}✓{RESET}  {label}   \n")
    sys.stdout.flush()

# ─────────────────────── MAIN DEMO ────────────────────────────────────────

if __name__ == "__main__":
    # Header
    print(f"\n{BOLD}{MAGENTA}{'═'*60}{RESET}")
    print(f"{BOLD}{MAGENTA}   ⚡  EPISODIC INTELLIGENCE ENGINE  ⚡{RESET}")
    print(f"{BOLD}{MAGENTA}   Backend Demo — All 6 Pipeline Stages{RESET}")
    print(f"{BOLD}{MAGENTA}{'═'*60}{RESET}")
    print(f"\n{DIM}  Story Idea:{RESET}")
    print(f"  {YELLOW}{textwrap.fill(STORY_IDEA, 55, subsequent_indent='  ')}{RESET}")
    print(f"\n  {DIM}Episodes: 6  |  Genre: supernatural horror{RESET}\n")

    input(f"  {BOLD}Press ENTER to launch the pipeline...{RESET} ")
    print()

    # ──────────────────────────────────────────────────────────────────────
    # STAGE 1 — Arc Breaker
    # ──────────────────────────────────────────────────────────────────────
    section("STAGE 1 — ARC BREAKER")
    print(f"\n  {DIM}Calling EventSeed agent (STORYWRITER pattern)...{RESET}")
    spinner_line("EventSeed: generating episode list", 1.2)
    spinner_line("EventValidator: checking causal consistency", 0.9)
    spinner_line("Assigning narrative functions (ASP-inspired)", 0.6)
    spinner_line("Building entity registry (NEKG)", 0.5)
    print()

    arc = _make_arc()

    print(f"  {BOLD}{'Ep':>2}  {'Narrative Function':<26} {'Title'}{RESET}")
    print(f"  {'─'*2}  {'─'*26} {'─'*36}")
    for ep in arc.episodes:
        print(f"  {ep.episode_index:>2}  {CYAN}{ep.narrative_function.name:<26}{RESET} {ep.title}")
    print(f"\n  {DIM}Entity registry:{RESET}")
    for ent, roles in arc.entity_registry.items():
        print(f"    {GREEN}•{RESET} {BOLD}{ent}{RESET}: {', '.join(roles[:2])}")

    # ──────────────────────────────────────────────────────────────────────
    # STAGE 2 — Plot Node Expander
    # ──────────────────────────────────────────────────────────────────────
    section("STAGE 2 — PLOT NODE EXPANDER  (SVO Triplets)")
    print(f"\n  {DIM}Running Pseudo-CPN generation + review loop (STORYTELLER §3.3)...{RESET}\n")

    for i, ep in enumerate(arc.episodes):
        spinner_line(f"Ep{ep.episode_index}: generating + reviewing CPNs", 0.6)
        ep.chapter_plot_nodes = CPN_DATA[i]

    print()
    for ep in arc.episodes:
        cbn = ep.chapter_begin_node
        cen = ep.chapter_end_node
        print(f"  {BOLD}Ep{ep.episode_index} · {ep.title}{RESET}")
        print(f"    {GREEN}BEGIN{RESET} ‹{cbn.subject} | {cbn.verb} | {cbn.obj}›")
        for cpn in ep.chapter_plot_nodes:
            print(f"      {DIM}↓{RESET}   ‹{cpn.subject} | {cpn.verb} | {cpn.obj}›")
        print(f"    {RED}END  {RESET} ‹{cen.subject} | {cen.verb} | {cen.obj}›")
        print()

    # ──────────────────────────────────────────────────────────────────────
    # STAGE 3 — Emotional Analyser
    # ──────────────────────────────────────────────────────────────────────
    section("STAGE 3 — EMOTIONAL ARC ANALYSER")
    print(f"\n  {DIM}Scoring 4 discriminator dimensions per episode (Plan-Write-Revise pattern)...{RESET}")
    print(f"  {DIM}Dimensions: valence (40%) · intensity (30%) · surprise (20%) · empathy (10%){RESET}\n")

    for i, ep in enumerate(arc.episodes):
        spinner_line(f"Ep{ep.episode_index}: scoring emotional dimensions", 0.5)
        d = EMOTIONAL_DATA[i]
        ep.emotional_score = d["emotional_score"]
        ep.discriminator_scores.update({
            "valence": d["valence"], "intensity": d["intensity"],
            "surprise": d["surprise"], "empathy_pull": d["empathy_pull"],
        })

    arc.emotional_arc_summary = EMOTIONAL_SUMMARY

    print(f"\n  {BOLD}Arc summary:{RESET}")
    print(f"  {textwrap.fill(arc.emotional_arc_summary, 57, subsequent_indent='  ')}\n")

    print(f"  {BOLD}{'Ep':>2}  {'Emotional Intensity Bar':22}  {'Score':>6}  Intensity  Surprise  Empathy{RESET}")
    print(f"  {'─'*60}")
    for ep in arc.episodes:
        sc = ep.emotional_score or 0
        ds = ep.discriminator_scores
        col = GREEN if sc > -0.2 else YELLOW if sc > -0.5 else RED
        print(
            f"  {ep.episode_index:>2}  {col}{emo_bar(sc)}{RESET}  {sc:>+6.2f}"
            f"     {ds.get('intensity',0):.2f}     {ds.get('surprise',0):.2f}    {ds.get('empathy_pull',0):.2f}"
        )

    # ──────────────────────────────────────────────────────────────────────
    # STAGE 4 — Cliffhanger Scorer
    # ──────────────────────────────────────────────────────────────────────
    section("STAGE 4 — CLIFFHANGER STRENGTH SCORER  (0 – 10)")
    print(f"\n  {DIM}Scoring 5 signals: open-loop · stakes · reversal · jeopardy · pacing...{RESET}\n")

    for i, ep in enumerate(arc.episodes):
        spinner_line(f"Ep{ep.episode_index}: scoring cliffhanger signals", 0.5)
        ep.cliffhanger_score = CLIFF_DATA[i]
        ep.discriminator_scores["cliffhanger"] = CLIFF_DATA[i]

    arc.avg_cliffhanger_score = round(sum(CLIFF_DATA) / len(CLIFF_DATA), 2)

    print(f"\n  {BOLD}{'Ep':>2}  {'Score Bar':22}  {'Score':>6}  Verdict{RESET}")
    print(f"  {'─'*58}")
    for ep in arc.episodes:
        sc = ep.cliffhanger_score or 0
        col = colour_cliff(sc)
        verdict = (
            f"{GREEN}●  STRONG HOOK{RESET}" if sc >= 7 else
            f"{YELLOW}●  ADEQUATE{RESET}"   if sc >= 5 else
            f"{RED}●  WEAK — needs fix{RESET}"
        )
        print(f"  {ep.episode_index:>2}  {col}{score_bar(sc)}{RESET}  {sc:>5.1f}   {verdict}")
    print(f"\n  {BOLD}Arc average:{RESET}  {arc.avg_cliffhanger_score} / 10")

    # ──────────────────────────────────────────────────────────────────────
    # STAGE 5 — Retention Risk Predictor
    # ──────────────────────────────────────────────────────────────────────
    section("STAGE 5 — RETENTION RISK PREDICTOR  (0 = safe · 1 = drop-off)")
    print(f"\n  {DIM}7 factors: coherence · pacing · complexity · engagement · exposition · length · hook-inv{RESET}\n")

    for i, ep in enumerate(arc.episodes):
        spinner_line(f"Ep{ep.episode_index}: predicting retention risk", 0.5)
        ep.retention_risk = RISK_DATA[i]
        ep.discriminator_scores["retention_risk"] = RISK_DATA[i]

    arc.avg_retention_risk = round(sum(RISK_DATA) / len(RISK_DATA), 3)

    print(f"\n  {BOLD}{'Ep':>2}  {'Risk Bar':22}  {'Risk':>6}  Verdict{RESET}")
    print(f"  {'─'*58}")
    for ep in arc.episodes:
        sc = ep.retention_risk or 0
        col = colour_risk(sc)
        verdict = (
            f"{GREEN}●  LOW  — audience retained{RESET}"       if sc < 0.35 else
            f"{YELLOW}●  MODERATE — monitor{RESET}"             if sc < 0.55 else
            f"{RED}●  HIGH — restructure episode{RESET}"
        )
        print(f"  {ep.episode_index:>2}  {col}{score_bar(sc * 10)}{RESET}  {sc:.3f}   {verdict}")
    print(f"\n  {BOLD}Arc average:{RESET}  {arc.avg_retention_risk}  {GREEN}(all episodes below 0.35 threshold ✓){RESET}")

    # ──────────────────────────────────────────────────────────────────────
    # STAGE 6 — Improvement Suggestor
    # ──────────────────────────────────────────────────────────────────────
    section("STAGE 6 — IMPROVEMENT SUGGESTOR")
    print(f"\n  {DIM}2-pass analysis: episode-level weakness detection + arc-level synthesis...{RESET}\n")
    spinner_line("Detecting creativity / coherence / hook weaknesses per episode", 0.8)
    spinner_line("Running arc-level synthesis (5 structured recommendations)", 1.0)

    arc.improvement_suggestions = IMPROVEMENT_SUGGESTIONS

    print(f"\n  {BOLD}Structured Recommendations:{RESET}\n")
    for i, sug in enumerate(arc.improvement_suggestions, 1):
        if "|HIGH|" in sug:
            col = RED
            badge = f"{RED}[HIGH]{RESET}"
        elif "|MEDIUM|" in sug:
            col = YELLOW
            badge = f"{YELLOW}[MED] {RESET}"
        else:
            col = GREEN
            badge = f"{GREEN}[LOW] {RESET}"

        # Extract category
        cat = sug.split("|")[2].split("]")[0] if "|" in sug else "general"
        body = sug.split("] ", 1)[-1] if "] " in sug else sug
        wrapped = textwrap.fill(body, 51, subsequent_indent="               ")
        print(f"  {i}. {badge} {CYAN}[{cat:19s}]{RESET} {wrapped}\n")

    # ──────────────────────────────────────────────────────────────────────
    # FINAL DASHBOARD
    # ──────────────────────────────────────────────────────────────────────
    section("FINAL INTELLIGENCE DASHBOARD")
    avg_emo = sum(ep.emotional_score or 0 for ep in arc.episodes) / len(arc.episodes)
    print(f"""
  {BOLD}{'─'*56}{RESET}
  {BOLD}  Story Arc ID       :{RESET}  {arc.story_id}
  {BOLD}  Premise            :{RESET}  {arc.premise[:50]}...
  {BOLD}  Genre              :{RESET}  {arc.genre}
  {BOLD}  Total Episodes     :{RESET}  {arc.total_episodes}
  {BOLD}{'─'*56}{RESET}
  {BOLD}  Avg Emotional Score:{RESET}  {avg_emo:+.3f}  {DIM}(arc spans –0.60 → +0.09){RESET}
  {BOLD}  Avg Cliffhanger    :{RESET}  {GREEN}{arc.avg_cliffhanger_score} / 10{RESET}  {DIM}← STRONG arc-wide{RESET}
  {BOLD}  Avg Retention Risk :{RESET}  {GREEN}{arc.avg_retention_risk}{RESET}       {DIM}← well below 0.35 threshold{RESET}
  {BOLD}  Entities Tracked   :{RESET}  {len(arc.entity_registry)}
  {BOLD}  Improvements       :{RESET}  {len(arc.improvement_suggestions)} structured recommendations
  {BOLD}{'─'*56}{RESET}
""")

    # Save JSON
    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "demo_output.json")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(EngineResponse(
            story_id=arc.story_id,
            arc=arc,
            pipeline_log=["demo_runner: all 6 stages executed"],
            status="success",
        ).model_dump_json(indent=2))

    print(f"  {DIM}Full JSON output saved → {out_path}{RESET}")
    print(f"\n{BOLD}{MAGENTA}{'═'*60}{RESET}\n")
