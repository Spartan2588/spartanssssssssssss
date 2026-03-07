/**
 * services/cliffhangerScorer.js
 * ───────────────────────────────
 * Part of LLM Call 2: Scores cliffhanger strength using weighted formula.
 *
 * Formula (from config):
 *   score = curiosity × 0.35 + shock × 0.25 + stakes × 0.25 + urgency × 0.15
 *
 * This module validates and re-calculates scores from raw LLM sub-scores.
 */

'use strict';

const config = require('../config/generationConfig');

/**
 * Recalculate cliffhanger scores using the config-driven weighted formula.
 * This ensures consistency between what the LLM returns and our scoring system.
 *
 * @param {Array} episodeAnalysis — episode_analysis from Call 2
 * @param {Function} log — pipeline logger
 * @returns {Array} — updated episode_analysis with verified scores
 */
function scoreCliffhangers(episodeAnalysis, log) {
    log('--- Cliffhanger Scorer: Verifying scores ---');

    const w = config.CLIFFHANGER_WEIGHTS;

    const scored = (episodeAnalysis || []).map(ep => {
        if (ep.sub_scores) {
            const { curiosity = 5, shock = 5, stakes = 5, urgency = 5 } = ep.sub_scores;

            // Recalculate using our weighted formula
            const calculatedScore = Math.round(
                curiosity * w.curiosity +
                shock * w.shock +
                stakes * w.stakes +
                urgency * w.urgency
            );

            // Use our calculation, not the LLM's
            const verifiedScore = Math.min(Math.max(calculatedScore, 1), 10);

            if (verifiedScore !== ep.cliffhanger_score) {
                log(`  📊 Ep ${ep.episode_number}: LLM score=${ep.cliffhanger_score}, recalculated=${verifiedScore}`);
            }

            return {
                ...ep,
                cliffhanger_score: verifiedScore,
            };
        }

        // No sub-scores — keep original
        return ep;
    });

    const avgScore = scored.length > 0
        ? (scored.reduce((s, e) => s + e.cliffhanger_score, 0) / scored.length).toFixed(1)
        : 0;

    log(`  ✓ Cliffhanger scores verified (avg: ${avgScore}/10)`);
    return scored;
}


module.exports = { scoreCliffhangers };
