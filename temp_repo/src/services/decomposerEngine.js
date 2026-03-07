/**
 * services/decomposerEngine.js
 * ──────────────────────────────
 * Post-processes Call 1 output.
 * Validates episode structure, normalizes data, and reports word counts.
 */

'use strict';

const config = require('../config/generationConfig');

/**
 * Validate and normalize episode structure from Call 1.
 *
 * @param {Object} storyData — raw Call 1 result
 * @param {Function} log — pipeline logger
 * @returns {Object} — storyData with normalized episodes
 */
function decomposeAndValidate(storyData, log) {
    log('--- Decomposer Engine: Validating episode structure ---');

    const wordTarget = Math.round(config.WORDS_PER_SECOND * config.EPISODE_DURATION_SECONDS);

    storyData.episodes = (storyData.episodes || []).map((ep, i) => {
        // Ensure required fields
        const normalized = {
            episode_number: ep.episode_number || i + 1,
            episode_title: ep.episode_title || `Episode ${i + 1}`,
            purpose: ep.purpose || '',
            script: ep.script || '',
            cliffhanger: ep.cliffhanger || '',
        };

        // Word count check
        const wordCount = normalized.script.trim().split(/\s+/).filter(Boolean).length;
        const deviation = Math.abs(wordCount - wordTarget);
        if (deviation > 40) {
            log(`  ⚠ Episode ${normalized.episode_number}: ${wordCount} words (target: ${config.TARGET_WORDS_MIN}-${config.TARGET_WORDS_MAX})`);
        }

        // Cliffhanger check
        if (!normalized.cliffhanger || normalized.cliffhanger.length < 10) {
            log(`  ⚠ Episode ${normalized.episode_number}: weak or missing cliffhanger`);
        }

        return normalized;
    });

    log(`  ✓ ${storyData.episodes.length} episodes validated`);
    return storyData;
}


module.exports = { decomposeAndValidate };
