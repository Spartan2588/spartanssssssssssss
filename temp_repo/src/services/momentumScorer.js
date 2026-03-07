/**
 * services/momentumScorer.js
 * ───────────────────────────
 * Story Momentum Score per episode.
 *
 * Formula: momentum = (curiosity + stakes + conflict + novelty) / 4
 * Scale: 1–10
 */

'use strict';

const config = require('../config/generationConfig');

/**
 * Process and validate momentum scores from Call 2.
 * If LLM didn't provide them, calculate from retention sub-scores.
 *
 * @param {Array} episodeAnalysis — episode_analysis with retention_blocks
 * @param {Function} log — pipeline logger
 * @returns {Array} — episodes with verified momentum_score
 */
function processMomentum(episodeAnalysis, log) {
    log('--- Momentum Scorer: Computing episode momentum ---');

    let riskyEpisodes = 0;

    const processed = (episodeAnalysis || []).map(ep => {
        let momentum;

        if (ep.momentum_score && typeof ep.momentum_score === 'number') {
            // Use LLM-provided score
            momentum = ep.momentum_score;
        } else if (ep.retention_blocks && ep.retention_blocks.length > 0) {
            // Calculate from retention sub-scores (average of block overalls)
            const blockAvg = ep.retention_blocks.reduce((s, b) => s + (b.overall || 5), 0) / ep.retention_blocks.length;
            momentum = +blockAvg.toFixed(1);
        } else {
            // Fallback: derive from emotion_level and cliffhanger_score
            momentum = +((ep.emotion_level + ep.cliffhanger_score) / 2).toFixed(1);
        }

        momentum = Math.min(Math.max(momentum, 1), 10);

        if (momentum < config.MOMENTUM_RISK_THRESHOLD) {
            riskyEpisodes++;
            log(`  ⚠ Episode ${ep.episode_number} momentum: ${momentum}/10 — RISK (below ${config.MOMENTUM_RISK_THRESHOLD})`);
        }

        return {
            ...ep,
            momentum_score: momentum,
        };
    });

    const avgMomentum = processed.length > 0
        ? (processed.reduce((s, e) => s + e.momentum_score, 0) / processed.length).toFixed(1)
        : 0;

    log(`  ✓ Momentum scores processed (avg: ${avgMomentum}/10, ${riskyEpisodes} risky episodes)`);
    return processed;
}


module.exports = { processMomentum };
