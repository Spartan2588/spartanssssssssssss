/**
 * services/twistGenerator.js
 * ────────────────────────────
 * Part of LLM Call 3: Generates 3 types of plot twists.
 *
 * Twist Types (from config):
 *   1. Perception Twist
 *   2. Character Betrayal
 *   3. Hidden Truth Reveal
 *
 * Receives full story context to ensure consistency.
 */

'use strict';

const config = require('../config/generationConfig');
const { SYSTEM_PROMPT } = require('../prompts/basePrompt');
const { buildCall3Prompt } = require('../prompts/enginePrompts');
const { llmJsonCall, DEMO_MODE } = require('./llmClient');
const { generateDemoCall3 } = require('../utils/demoData');

/**
 * Generate plot twists and hashtags (Call 3).
 *
 * @param {Object} storyContext — full story data from Call 1 (with context memory)
 * @param {Function} log — pipeline logger
 * @returns {Object} { plot_twists, hashtags }
 */
async function generateTwistsAndHashtags(storyContext, log) {
    log('--- Call 3: Twists + Hashtags ---');

    if (DEMO_MODE) {
        log('  ⚡ Demo mode → returning mock twists & hashtags');
        return generateDemoCall3(storyContext);
    }

    const prompt = buildCall3Prompt(storyContext);
    let lastError = null;

    for (let attempt = 1; attempt <= config.LLM.MAX_RETRIES + 1; attempt++) {
        try {
            log(`  Attempt ${attempt}/${config.LLM.MAX_RETRIES + 1}...`);

            const result = await llmJsonCall(prompt, SYSTEM_PROMPT, {
                temperature: config.LLM.CALL_3_TEMPERATURE,
                maxTokens: config.LLM.CALL_3_MAX_TOKENS,
            });

            // Validate twist types
            const twists = result.plot_twists || [];
            const expectedTypes = config.TWIST_TYPES;
            const receivedTypes = twists.map(t => t.twist_type).filter(Boolean);

            if (twists.length < expectedTypes.length) {
                log(`  ⚠ Expected ${expectedTypes.length} twists, got ${twists.length}`);
            }

            log(`  ✓ ${twists.length} twists generated [${receivedTypes.join(', ')}]`);
            log(`  ✓ ${(result.hashtags || []).length} hashtags generated`);
            return result;

        } catch (err) {
            lastError = err;
            log(`  ⚠ Attempt ${attempt} failed: ${err.message}`);
            if (attempt <= config.LLM.MAX_RETRIES) {
                log(`  ↻ Retrying...`);
            }
        }
    }

    // Non-fatal — return empty on failure
    log(`  ⚠ Twist generation failed after retries (non-fatal): ${lastError.message}`);
    return { plot_twists: [], hashtags: [] };
}


module.exports = { generateTwistsAndHashtags };
