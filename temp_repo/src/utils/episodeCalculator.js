/**
 * utils/episodeCalculator.js
 * ───────────────────────────
 * Dynamic episode count and word target calculation.
 * Uses story complexity scoring instead of hardcoded counts.
 */

'use strict';

const config = require('../config/generationConfig');

/**
 * Calculate story complexity score from input factors.
 *
 * complexity = characterCount × characterWeight
 *            + descriptionLength / descriptionDivisor
 *            + moodIntensityBonus
 *            + genreComplexityBonus
 */
function calculateComplexity(input) {
    const { characterWeight, descriptionDivisor, moodIntensityBonus, genreComplexityBonus }
        = config.COMPLEXITY_FACTORS;

    const charScore = input.numCharacters * characterWeight;
    const descScore = input.description.length / descriptionDivisor;
    const moodScore = moodIntensityBonus[input.emotionMood] || 0.3;
    const genreScore = genreComplexityBonus[input.genre] || 0.5;

    return charScore + descScore + moodScore + genreScore;
}

/**
 * Determine episode count for a story.
 * If user explicitly provided numEpisodes, use that (clamped).
 * Otherwise, auto-calculate from story complexity.
 *
 * @param {Object} input — sanitized input
 * @returns {number} episode count (5–15)
 */
function calculateEpisodeCount(input) {
    // User explicitly set episode count
    if (input.numEpisodes !== null && input.numEpisodes !== undefined) {
        return Math.min(Math.max(Number(input.numEpisodes), config.MIN_EPISODES), config.MAX_EPISODES);
    }

    // Auto-calculate from complexity
    const complexity = calculateComplexity(input);
    return Math.min(Math.max(Math.ceil(complexity), config.MIN_EPISODES), config.MAX_EPISODES);
}

/**
 * Get word target for episode scripts.
 * @returns {{ target: number, min: number, max: number }}
 */
function getWordTargets() {
    return {
        target: Math.round(config.WORDS_PER_SECOND * config.EPISODE_DURATION_SECONDS),
        min: config.TARGET_WORDS_MIN,
        max: config.TARGET_WORDS_MAX,
    };
}


module.exports = { calculateComplexity, calculateEpisodeCount, getWordTargets };
