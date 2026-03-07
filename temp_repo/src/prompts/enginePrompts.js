/**
 * prompts/enginePrompts.js
 * ─────────────────────────
 * Dynamic prompt builders for each LLM call.
 * v3.0 — Narrative mechanics enforcement, retention analysis, Netflix twists.
 *
 * Call 1: Story + Episode Decomposition (with Ep1 HOOK→MYSTERY→CONSEQUENCE)
 * Call 2: Emotional Arc + Cliffhanger Scoring + Retention Risk Predictor
 * Call 3: Netflix 3-Layer Twists + Hashtags
 * Edit:   Targeted episode editing
 */

'use strict';

const config = require('../config/generationConfig');
const { GENRE_TEMPLATES, MOOD_MODIFIERS } = require('./genreTemplates');

// ─── Helpers ─────────────────────────────────────────────────────────────

function buildCharacterBlock(input) {
  if (input.characterMode === 'USER_DEFINED' && input.characters.length > 0) {
    return input.characters.map((c, i) =>
      `  ${i + 1}. ${c.name}${c.traits ? ` — Traits: ${c.traits}` : ''}`
    ).join('\n');
  }
  return `  Generate ${input.numCharacters} unique characters. Each must have: clear motivation, hidden flaw, emotional pressure point.`;
}

function getGenreBlock(genre) {
  const t = GENRE_TEMPLATES[genre];
  if (!t) return `Genre: ${genre}`;
  return [
    `Genre: ${genre}`,
    `  Tone: ${t.tone}`,
    `  Narrative Style: ${t.style}`,
    `  Pacing: ${t.pacing}`,
    `  Key Themes: ${t.themes.join(', ')}`,
    `  Hook Style: ${t.hookStyle}`,
    `  Cliffhanger Style: ${t.cliffhangerStyle}`,
  ].join('\n');
}

function getMoodBlock(mood) {
  const m = MOOD_MODIFIERS[mood];
  if (!m) return `Mood: ${mood}`;
  return [
    `Mood: ${mood}`,
    `  Instruction: ${m.instruction}`,
    `  Emotion Focus: ${m.emotionFocus}`,
  ].join('\n');
}


// ─── Call 1: Story Generation + Episode Decomposition ────────────────────

function buildCall1Prompt(input) {
  const charBlock = buildCharacterBlock(input);
  const genreBlock = getGenreBlock(input.genre);
  const moodBlock = getMoodBlock(input.emotionMood);

  return `Generate a complete episodic story based on these inputs:

${genreBlock}

${moodBlock}

CHARACTERS (${input.characterMode}):
${charBlock}

STORY DESCRIPTION:
${input.description}

EPISODE CONSTRAINTS:
  Total Episodes: ${input.numEpisodes}
  Episode Duration: ~${config.EPISODE_DURATION_SECONDS} seconds narrated
  Target Words Per Episode: ${config.TARGET_WORDS_MIN}–${config.TARGET_WORDS_MAX} words

EPISODE STRUCTURE (every episode):
  1. Pattern Interrupt Hook (first 3 seconds)
  2. Situation Setup
  3. Conflict Escalation
  4. Emotional Turn
  5. Cliffhanger Ending — NEVER end with resolution

═══ EPISODE 1 RULE (CRITICAL) ═══
Episode 1 must follow: HOOK → MYSTERY → CONSEQUENCE
  • HOOK: A disruptive, strange, or alarming event. NOT calm scene-setting.
  • MYSTERY: The audience must immediately ask "How?" or "Why?"
  • CONSEQUENCE: Something bad will happen if action isn't taken.
  
BAD: "It was a quiet night in the city..."
GOOD: "Three minutes before the crash, his phone received a message from himself."

═══ PACING RULE ═══
Every episode must introduce at least ONE of:
  • New information that changes understanding
  • Increased stakes or danger
  • New suspicion about a character
  • Emotional reversal

═══ CHARACTER REQUIREMENTS ═══
Each character must have:
  • name
  • personality_traits
  • motivation (what they want)
  • hidden_flaw (what holds them back)
  • internal_conflict (what breaks them)

═══ REQUIREMENTS ═══
1. Create a compelling story title
2. Define ${input.numCharacters} characters with the schema above
3. Decompose the story into exactly ${input.numEpisodes} episodes
4. Each episode must include:
   - episode_number (1-indexed)
   - episode_title
   - purpose (this episode's role in the arc)
   - script (${config.TARGET_WORDS_MIN}-${config.TARGET_WORDS_MAX} words, narration-ready)
   - cliffhanger (hook that makes viewers watch next)
5. Emotional intensity must escalate across episodes
6. Characters must remain consistent and grow across episodes

OUTPUT FORMAT (strict JSON, no markdown):
{
  "story_title": "...",
  "genre": "${input.genre}",
  "mood": "${input.emotionMood}",
  "characters": [
    { "name": "...", "personality_traits": "...", "motivation": "...", "hidden_flaw": "...", "internal_conflict": "..." }
  ],
  "episodes": [
    {
      "episode_number": 1,
      "episode_title": "...",
      "purpose": "...",
      "script": "...",
      "cliffhanger": "..."
    }
  ]
}`;
}


// ─── Call 2: Emotional Arc + Cliffhanger + Retention ─────────────────────

function buildCall2Prompt(storyContext) {
  const episodesRef = storyContext.episodes.map(ep =>
    `  Episode ${ep.episode_number}: "${ep.episode_title}" — ${ep.purpose}\n    Script excerpt: ${(ep.script || '').slice(0, 100)}...\n    Cliffhanger: ${ep.cliffhanger}`
  ).join('\n');

  const w = config.CLIFFHANGER_WEIGHTS;
  const timeBlocks = config.RETENTION_TIME_BLOCKS.map(b => b.label).join(', ');

  return `Analyze the following story. You must perform THREE tasks:

STORY CONTEXT:
  Title: ${storyContext.story_title}
  Genre: ${storyContext.genre}
  Mood: ${storyContext.mood}
  Characters: ${storyContext.characters.map(c => c.name).join(', ')}

EPISODES:
${episodesRef}

═══ TASK 1: EMOTIONAL ARC ANALYSIS ═══
For each episode, assign:
  - emotion_level: 1-10 (engagement intensity based on tension + stakes + mystery + character_conflict)
  - dominant_emotion: primary emotion (e.g. tension, dread, hope, excitement)
  - engagement_risk: "LOW" / "MEDIUM" / "HIGH" (HIGH if < ${config.ENGAGEMENT_RISK.HIGH_THRESHOLD}, MEDIUM if < ${config.ENGAGEMENT_RISK.MEDIUM_THRESHOLD})

Also provide:
  - engagement_graph: text description of emotional progression
  - flat_engagement_episodes: episode numbers where engagement dips

═══ TASK 2: CLIFFHANGER SCORING ═══
Score each cliffhanger (1-10) with sub-scores:
  - curiosity, shock, stakes, urgency (each 1-10)
  - score = curiosity × ${w.curiosity} + shock × ${w.shock} + stakes × ${w.stakes} + urgency × ${w.urgency}
  - score_reason: brief explanation

═══ TASK 3: RETENTION RISK PREDICTOR ═══
Divide each episode into 4 time blocks: ${timeBlocks}
For each block, score (1-10):
  - curiosity: how much audience wants to know what happens next
  - conflict: level of tension or opposition in this segment
  - information_gain: how much new info is revealed
  - emotional_shift: how much the emotional tone changes
  - overall: average of above 4 scores
  - risk: "HIGH" (<${config.RETENTION_RISK.HIGH_THRESHOLD}), "MEDIUM" (<${config.RETENTION_RISK.MEDIUM_THRESHOLD}), "SAFE" (≥${config.RETENTION_RISK.MEDIUM_THRESHOLD})
  - reason: brief explanation

Also compute per-episode momentum_score:
  momentum = (curiosity + stakes + conflict + novelty) / 4    (scale 1-10)

OUTPUT FORMAT (strict JSON, no markdown):
{
  "episode_analysis": [
    {
      "episode_number": 1,
      "emotion_level": 7,
      "dominant_emotion": "...",
      "engagement_risk": "LOW",
      "cliffhanger_score": 8,
      "score_reason": "...",
      "sub_scores": { "curiosity": 9, "shock": 7, "stakes": 8, "urgency": 6 },
      "retention_blocks": [
        { "block": "0-10s", "curiosity": 8, "conflict": 6, "information_gain": 7, "emotional_shift": 5, "overall": 6.5, "risk": "SAFE", "reason": "..." },
        { "block": "10-30s", "curiosity": 5, "conflict": 4, "information_gain": 6, "emotional_shift": 3, "overall": 4.5, "risk": "MEDIUM", "reason": "..." },
        { "block": "30-60s", "curiosity": 7, "conflict": 7, "information_gain": 8, "emotional_shift": 6, "overall": 7.0, "risk": "SAFE", "reason": "..." },
        { "block": "60-90s", "curiosity": 9, "conflict": 8, "information_gain": 7, "emotional_shift": 9, "overall": 8.3, "risk": "SAFE", "reason": "..." }
      ],
      "momentum_score": 7.2
    }
  ],
  "emotional_arc_analysis": {
    "engagement_graph": "...",
    "flat_engagement_episodes": []
  }
}`;
}


// ─── Call 3: Netflix 3-Layer Twists + Hashtags ───────────────────────────

function buildCall3Prompt(storyContext) {
  const charNames = storyContext.characters.map(c => c.name).join(', ');
  const episodeSummary = storyContext.episodes.map(ep =>
    `  Ep ${ep.episode_number}: ${ep.episode_title} — ${ep.purpose}`
  ).join('\n');

  return `Generate plot twists and hashtags for this story.

STORY CONTEXT:
  Title: ${storyContext.story_title}
  Genre: ${storyContext.genre}
  Mood: ${storyContext.mood}
  Characters: ${charNames}

EPISODE ARC:
${episodeSummary}

═══ NETFLIX 3-LAYER TWIST SYSTEM ═══
Generate exactly 3 twists using the following layered system:

LAYER 1 — EXPECTATION TWIST
  The audience assumes something throughout the story.
  The twist reveals their assumption was wrong.
  Example: "The killer is the stranger" → actual: "The victim planned their own murder."

LAYER 2 — IDENTITY TWIST
  The twist changes WHO people really are.
  A character's true identity or role is revealed.
  Example: "The detective helping the case" → actual: "The detective is the real criminal."

LAYER 3 — MORAL TWIST
  The twist changes WHO the audience sympathizes with.
  What seemed evil was actually justified, or vice versa.
  Example: "The kidnapper is pure evil" → actual: "The kidnapper was protecting the child from abuse."

For each twist:
  - twist_type: "expectation" | "identity" | "moral"
  - twist: one-line summary
  - setup: how the twist is subtly seeded earlier
  - reveal: the moment and method of the reveal
  - impact: how this reshapes the audience's understanding

Quality requirements:
  - Must be surprising but feel inevitable in retrospect
  - Must use existing characters and plot points (no new elements)
  - Each layer must STACK — the moral twist should compound the impact of the identity twist

═══ HASHTAG GENERATION ═══
Generate ${config.HASHTAG_COUNT_MIN}-${config.HASHTAG_COUNT_MAX} viral hashtags optimized for:
  - Genre: ${storyContext.genre}
  - Mood: ${storyContext.mood}
  - Story keywords
  - Platform trends (Reels, Shorts, TikTok)
  - Mix of broad-reach and niche hashtags

OUTPUT FORMAT (strict JSON, no markdown):
{
  "plot_twists": [
    {
      "twist_type": "expectation",
      "twist": "...",
      "setup": "...",
      "reveal": "...",
      "impact": "..."
    }
  ],
  "hashtags": ["#StoryTime", "#ThrillerSeries", ...]
}`;
}


// ─── Edit Prompt Builder ─────────────────────────────────────────────────

function buildEditPrompt(episode, storyContext, editInstruction) {
  const charNames = storyContext.characters.map(c => `${c.name} (${c.personality_traits})`).join(', ');

  return `You are editing a single episode of an episodic story. Apply the edit instruction while maintaining story consistency.

STORY CONTEXT:
  Title: ${storyContext.story_title}
  Genre: ${storyContext.genre}
  Mood: ${storyContext.mood}
  Characters: ${charNames}

EPISODE TO EDIT:
  Number: ${episode.episode_number}
  Title: ${episode.episode_title}
  Purpose: ${episode.purpose}
  Current Script:
${episode.script}
  Current Cliffhanger: ${episode.cliffhanger}

EDIT INSTRUCTION:
${editInstruction}

RULES:
  - Modify ONLY this episode, not the overall story
  - Maintain character consistency
  - Keep script length between ${config.TARGET_WORDS_MIN}-${config.TARGET_WORDS_MAX} words
  - Maintain the episode structure: Hook → Setup → Escalation → Turn → Cliffhanger
  - The cliffhanger must remain strong (never end with resolution)

OUTPUT FORMAT (strict JSON, no markdown):
{
  "episode_title": "...",
  "purpose": "...",
  "script": "...",
  "cliffhanger": "..."
}`;
}


// ─── Decision Tree Prompt Builder ────────────────────────────────────────

function buildDecisionTreePrompt(storyContext) {
  const charNames = storyContext.characters.map(c => `${c.name} (${c.personality_traits})`).join(', ');
  const episodeSummary = storyContext.episodes.map(ep =>
    `  Ep ${ep.episode_number}: "${ep.episode_title}" — ${ep.purpose}\n    Cliffhanger: ${ep.cliffhanger}`
  ).join('\n');

  return `ROLE
You are Story Intelligence AI, a narrative analytics engine designed to analyze episodic stories and generate structured storytelling insights.

Your purpose is to evaluate narrative decisions, predict viewer retention, analyze emotional engagement, and measure cliffhanger effectiveness.

You must simulate the analytical tools used by professional writers' rooms and streaming platforms.

STORY CONTEXT:
  Title: ${storyContext.story_title}
  Genre: ${storyContext.genre}
  Mood: ${storyContext.mood}
  Characters: ${charNames}

EPISODE ARC:
${episodeSummary}

═══ DECISION TREE RECONSTRUCTION ═══
For each episode, generate THREE alternative narrative directions:
  - Branch A: The direction actually taken in the story (mark as selected)
  - Branch B: An alternative direction the story COULD have taken
  - Branch C: A radically different direction that would change the story fundamentally

For each branch, provide:
  - branch: "A", "B", or "C"
  - direction: one-sentence summary of this narrative path
  - retention_score: predicted viewer retention (1-10)
  - emotion_score: emotional intensity this branch would generate (1-10)
  - cliffhanger_strength: how strong the episode ending would be (1-10)
  - retention_curve: predicted viewer retention % at 4 time points [0-10s, 10-30s, 30-60s, 60-90s]
  - selected: true only for Branch A

ANALYTICS RULES:
  - Branches must represent SIGNIFICANTLY different narrative directions, not minor variations
  - Retention prediction must prioritize: curiosity gaps, narrative tension, emotional stakes, unexpected revelations
  - Episodes containing exposition without tension should have lower retention scores
  - Branch A (selected) should generally have the highest retention score since it was chosen
  - Branch C should be the most unexpected/radical alternative
  - Retention curves show WHY AI chose the branch — selected branches should maintain higher % across all 4 time points

OUTPUT FORMAT (strict JSON, no markdown):
{
  "decision_tree": [
    {
      "episode_number": 1,
      "episode_title": "...",
      "branches": [
        {
          "branch": "A",
          "direction": "...",
          "retention_score": 8,
          "emotion_score": 7,
          "cliffhanger_strength": 9,
          "retention_curve": [95, 88, 82, 91],
          "selected": true
        },
        {
          "branch": "B",
          "direction": "...",
          "retention_score": 6,
          "emotion_score": 5,
          "cliffhanger_strength": 6,
          "retention_curve": [90, 75, 60, 55],
          "selected": false
        },
        {
          "branch": "C",
          "direction": "...",
          "retention_score": 5,
          "emotion_score": 6,
          "cliffhanger_strength": 7,
          "retention_curve": [85, 70, 55, 50],
          "selected": false
        }
      ]
    }
  ]
}`;
}


module.exports = { buildCall1Prompt, buildCall2Prompt, buildCall3Prompt, buildEditPrompt, buildDecisionTreePrompt };
