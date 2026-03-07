/**
 * config/generationConfig.js
 * ───────────────────────────
 * All tunable constants for the StoryForge AI pipeline.
 * Zero magic numbers in code — everything is configured here.
 */

'use strict';

module.exports = {

    // ─── Episode Calculation ─────────────────────────────────────────────
    WORDS_PER_SECOND: 2.5,
    EPISODE_DURATION_SECONDS: 90,
    // target ≈ 225 words per episode (210–240 acceptable range)
    get TARGET_WORDS() { return Math.round(this.WORDS_PER_SECOND * this.EPISODE_DURATION_SECONDS); },
    TARGET_WORDS_MIN: 210,
    TARGET_WORDS_MAX: 240,

    MIN_EPISODES: 5,
    MAX_EPISODES: 15,
    DEFAULT_EPISODES: 6,

    // ─── Character Limits ────────────────────────────────────────────────
    MIN_CHARACTERS: 1,
    MAX_CHARACTERS: 10,
    DEFAULT_CHARACTERS: 3,

    // ─── Complexity Scoring (for dynamic episode count) ──────────────────
    COMPLEXITY_FACTORS: {
        characterWeight: 1.5,
        descriptionDivisor: 50,
        moodIntensityBonus: {
            fear: 1.0,
            dread: 1.0,
            anger: 0.8,
            tension: 0.8,
            suspense: 0.6,
            excitement: 0.5,
            dark: 0.7,
            hope: 0.3,
            joy: 0.2,
            wonder: 0.3,
            melancholy: 0.4,
            bittersweet: 0.4,
            eerie: 0.6,
            inspirational: 0.2,
            nostalgia: 0.3,
        },
        genreComplexityBonus: {
            thriller: 0.8,
            horror: 0.6,
            mystery: 0.9,
            'sci-fi': 1.0,
            fantasy: 0.8,
            psychological: 1.0,
            crime: 0.7,
            dystopian: 0.8,
            drama: 0.5,
            romance: 0.3,
            comedy: 0.3,
            action: 0.5,
            supernatural: 0.6,
            adventure: 0.5,
            historical: 0.6,
        },
    },

    // ─── Cliffhanger Scoring Weights ─────────────────────────────────────
    CLIFFHANGER_WEIGHTS: {
        curiosity: 0.35,
        shock: 0.25,
        stakes: 0.25,
        urgency: 0.15,
    },

    // ─── Engagement Risk Thresholds ──────────────────────────────────────
    ENGAGEMENT_RISK: {
        HIGH_THRESHOLD: 4,      // emotion_level < 4 → HIGH risk
        MEDIUM_THRESHOLD: 6,    // emotion_level < 6 → MEDIUM risk
    },

    // ─── Twist Types (Netflix 3-Layer System) ─────────────────────────────
    TWIST_TYPES: ['expectation', 'identity', 'moral'],

    // ─── LLM Configuration ──────────────────────────────────────────────
    LLM: {
        MAX_TOKENS: 4000,
        MAX_RETRIES: 2,
        TIMEOUT_MS: 120_000,
        CALL_1_TEMPERATURE: 0.8,    // story + episodes (creative)
        CALL_2_TEMPERATURE: 0.4,    // analysis + scoring (precise)
        CALL_3_TEMPERATURE: 0.9,    // twists + hashtags (very creative)
        CALL_1_MAX_TOKENS: 8192,
        CALL_2_MAX_TOKENS: 4096,
        CALL_3_MAX_TOKENS: 3072,
    },

    // ─── LLM Call Groups (optimization: 3 calls instead of 6) ───────────
    LLM_CALL_GROUPS: {
        CALL_1: ['storyGeneration', 'episodeDecomposition'],
        CALL_2: ['emotionalAnalysis', 'cliffhangerScoring', 'retentionAnalysis'],
        CALL_3: ['twistGeneration', 'hashtagGeneration'],
    },

    // ─── Hashtag Config ──────────────────────────────────────────────────
    HASHTAG_COUNT_MIN: 8,
    HASHTAG_COUNT_MAX: 12,

    // ─── Validation ──────────────────────────────────────────────────────
    DESCRIPTION_MIN_LENGTH: 10,
    DESCRIPTION_MAX_LENGTH: 2000,

    // ─── Character Modes ─────────────────────────────────────────────────
    CHARACTER_MODES: ['AI_GENERATED', 'USER_DEFINED'],

    // ─── Retention Risk Predictor ────────────────────────────────────────
    RETENTION_TIME_BLOCKS: [
        { label: '0-10s', startPercent: 0, endPercent: 0.11, name: 'Hook' },
        { label: '10-30s', startPercent: 0.11, endPercent: 0.33, name: 'Setup' },
        { label: '30-60s', startPercent: 0.33, endPercent: 0.67, name: 'Build' },
        { label: '60-90s', startPercent: 0.67, endPercent: 1.0, name: 'Climax' },
    ],
    RETENTION_RISK: {
        HIGH_THRESHOLD: 4,
        MEDIUM_THRESHOLD: 6,
    },
    RETENTION_FACTORS: ['curiosity', 'conflict', 'information_gain', 'emotional_shift'],

    // ─── Story Momentum Score ────────────────────────────────────────────
    MOMENTUM_FACTORS: ['curiosity', 'stakes', 'conflict', 'novelty'],
    MOMENTUM_RISK_THRESHOLD: 5.0,

    // ─── Edit Quick Actions ──────────────────────────────────────────────
    EDIT_ACTIONS: [
        { id: 'improve_hook', label: 'Improve Hook', icon: '🎯', instruction: 'Rewrite the opening 2–3 sentences to create a stronger pattern interrupt hook that immediately grabs attention.' },
        { id: 'strengthen_cliff', label: 'Strengthen Cliffhanger', icon: '⚡', instruction: 'Rewrite the final 2–3 sentences to create a stronger cliffhanger with higher curiosity gap and threat escalation.' },
        { id: 'increase_emotion', label: 'Increase Emotional Conflict', icon: '💔', instruction: 'Amplify the emotional tension and character conflict throughout this episode. Make stakes feel more personal.' },
        { id: 'add_twist', label: 'Add Plot Twist', icon: '🌀', instruction: 'Insert a surprising but plausible plot twist that reshapes understanding. It must be consistent with established story facts.' },
        { id: 'shorten_episode', label: 'Shorten Episode', icon: '✂️', instruction: 'Tighten the script to approximately 180 words. Remove filler, redundancy, and unnecessary exposition while keeping all key beats.' },
        { id: 'expand_scene', label: 'Expand Scene', icon: '📖', instruction: 'Expand the most impactful scene with richer sensory details, internal monologue, and visual storytelling. Target approximately 220 words.' },
    ],
};
