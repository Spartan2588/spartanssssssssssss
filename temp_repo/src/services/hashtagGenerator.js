/**
 * services/hashtagGenerator.js
 * ──────────────────────────────
 * Hashtag post-processing and validation.
 * The raw hashtags come from Call 3 (combined with twists).
 * This module normalizes and validates them.
 */

'use strict';

const config = require('../config/generationConfig');

/**
 * Normalize and validate hashtags from Call 3.
 *
 * @param {Array<string>} rawHashtags — hashtags from LLM
 * @param {Object} storyMeta — { genre, mood, story_title }
 * @param {Function} log — pipeline logger
 * @returns {Array<string>} — cleaned hashtags
 */
function processHashtags(rawHashtags, storyMeta, log) {
    log('--- Hashtag Generator: Processing ---');

    let hashtags = (rawHashtags || [])
        .map(tag => {
            // Ensure # prefix
            let clean = tag.trim();
            if (!clean.startsWith('#')) clean = `#${clean}`;
            // Remove spaces inside hashtags
            clean = clean.replace(/\s+/g, '');
            return clean;
        })
        .filter(tag => tag.length > 1); // Filter empty tags

    // Deduplicate (case-insensitive)
    const seen = new Set();
    hashtags = hashtags.filter(tag => {
        const lower = tag.toLowerCase();
        if (seen.has(lower)) return false;
        seen.add(lower);
        return true;
    });

    // Ensure minimum count with fallback tags
    if (hashtags.length < config.HASHTAG_COUNT_MIN) {
        const fallbacks = [
            '#StoryTime', '#ShortStory', '#Storytelling', '#EpisodeSeries',
            '#Cliffhanger', '#PlotTwist', '#BingeWorthy', '#AIStory',
            `#${capitalize(storyMeta.genre)}Story`,
            '#ContentCreator', '#ViralStory', '#SocialMediaStory',
        ];
        for (const fb of fallbacks) {
            if (hashtags.length >= config.HASHTAG_COUNT_MIN) break;
            if (!seen.has(fb.toLowerCase())) {
                hashtags.push(fb);
                seen.add(fb.toLowerCase());
            }
        }
    }

    // Truncate to max
    hashtags = hashtags.slice(0, config.HASHTAG_COUNT_MAX);

    log(`  ✓ ${hashtags.length} hashtags finalized`);
    return hashtags;
}

function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}


module.exports = { processHashtags };
