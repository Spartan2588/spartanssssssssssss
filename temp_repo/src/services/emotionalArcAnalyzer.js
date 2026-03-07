/**
 * services/emotionalArcAnalyzer.js
 * ──────────────────────────────────
 * Part of LLM Call 2: Scores emotional intensity for each episode.
 * Detects engagement dips and flags risk levels.
 *
 * In live mode, this is handled by the Call 2 LLM response.
 * This module processes the raw analysis data.
 */

'use strict';

const config = require('../config/generationConfig');

/**
 * Post-process emotional analysis from Call 2 LLM response.
 * Applies engagement risk thresholds and validates escalation.
 *
 * @param {Array} episodeAnalysis — raw episode_analysis from Call 2
 * @param {Function} log — pipeline logger
 * @returns {Object} — { episode_analysis, emotional_arc_analysis }
 */
function processEmotionalArc(episodeAnalysis, log) {
    log('--- Emotional Arc Analyzer: Processing ---');

    const flatEpisodes = [];
    let prevLevel = 0;
    let escalationBreaks = 0;

    const processed = (episodeAnalysis || []).map(ep => {
        // Apply risk thresholds from config
        let risk = 'LOW';
        if (ep.emotion_level < config.ENGAGEMENT_RISK.HIGH_THRESHOLD) {
            risk = 'HIGH';
            flatEpisodes.push(ep.episode_number);
        } else if (ep.emotion_level < config.ENGAGEMENT_RISK.MEDIUM_THRESHOLD) {
            risk = 'MEDIUM';
        }

        // Track escalation
        if (ep.emotion_level < prevLevel) {
            escalationBreaks++;
        }
        prevLevel = ep.emotion_level;

        return {
            ...ep,
            engagement_risk: risk,
        };
    });

    if (flatEpisodes.length > 0) {
        log(`  ⚠ Flat engagement risk in episodes: ${flatEpisodes.join(', ')}`);
    }
    if (escalationBreaks > 1) {
        log(`  ⚠ ${escalationBreaks} escalation breaks detected (emotion dipped)`);
    }

    const levels = processed.map(e => e.emotion_level);
    const graph = levels.length > 0
        ? `Emotional intensity: ${levels[0]}/10 → ${levels[levels.length - 1]}/10 across ${levels.length} episodes. ${escalationBreaks === 0 ? 'Smooth escalation ✓' : `${escalationBreaks} dip(s) detected ⚠`}`
        : '';

    log(`  ✓ Emotional arc processed (${processed.length} episodes)`);

    return {
        episode_analysis: processed,
        emotional_arc_analysis: {
            engagement_graph: graph,
            flat_engagement_episodes: flatEpisodes,
        },
    };
}


module.exports = { processEmotionalArc };
