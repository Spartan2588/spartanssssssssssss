/**
 * services/retentionPredictor.js
 * ───────────────────────────────
 * Processes retention block analysis from Call 2.
 * Validates time-block scores and flags drop-off risks.
 */

'use strict';

const config = require('../config/generationConfig');

/**
 * Process retention analysis from Call 2 LLM response.
 *
 * @param {Array} episodeAnalysis — episode_analysis from Call 2 (with retention_blocks)
 * @param {Function} log — pipeline logger
 * @returns {Array} — processed episode analysis with validated retention blocks
 */
function processRetention(episodeAnalysis, log) {
    log('--- Retention Predictor: Processing time-block analysis ---');

    let totalDropRisks = 0;

    const processed = (episodeAnalysis || []).map(ep => {
        const blocks = (ep.retention_blocks || []).map(block => {
            // Recalculate overall from sub-scores
            const factors = [block.curiosity || 5, block.conflict || 5, block.information_gain || 5, block.emotional_shift || 5];
            const overall = +(factors.reduce((s, v) => s + v, 0) / factors.length).toFixed(1);

            // Apply risk thresholds from config
            let risk = 'SAFE';
            if (overall < config.RETENTION_RISK.HIGH_THRESHOLD) {
                risk = 'HIGH';
                totalDropRisks++;
            } else if (overall < config.RETENTION_RISK.MEDIUM_THRESHOLD) {
                risk = 'MEDIUM';
            }

            return {
                ...block,
                overall,
                risk,
            };
        });

        return {
            ...ep,
            retention_blocks: blocks,
        };
    });

    if (totalDropRisks > 0) {
        log(`  ⚠ ${totalDropRisks} HIGH drop-risk time blocks detected across all episodes`);
    } else {
        log(`  ✓ No high drop-risk blocks detected`);
    }

    log(`  ✓ Retention analysis processed (${processed.length} episodes × ${config.RETENTION_TIME_BLOCKS.length} blocks)`);
    return processed;
}


module.exports = { processRetention };
