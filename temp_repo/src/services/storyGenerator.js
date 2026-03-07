/**
 * services/storyGenerator.js
 * ───────────────────────────
 * LLM Call 1: Generates the base story + decomposes into episodes.
 * In demo mode, returns mock data from demoData.js.
 */

'use strict';

const config = require('../config/generationConfig');
const { SYSTEM_PROMPT } = require('../prompts/basePrompt');
const { buildCall1Prompt } = require('../prompts/enginePrompts');
const { llmJsonCall, DEMO_MODE } = require('./llmClient');
const { generateDemoCall1 } = require('../utils/demoData');

/**
 * Generate story foundation + episodes (Call 1).
 *
 * @param {Object} input — sanitized input from validator
 * @param {Function} log — pipeline logger
 * @returns {Object} { story_title, genre, mood, characters, episodes }
 */
async function generateStory(input, log) {
    log('--- Call 1: Story Generation + Episode Decomposition ---');

    if (DEMO_MODE) {
        log('  ⚡ Demo mode → returning mock story');
        return generateDemoCall1(input);
    }

    const prompt = buildCall1Prompt(input);
    let lastError = null;

    for (let attempt = 1; attempt <= config.LLM.MAX_RETRIES + 1; attempt++) {
        try {
            log(`  Attempt ${attempt}/${config.LLM.MAX_RETRIES + 1}...`);

            const result = await llmJsonCall(prompt, SYSTEM_PROMPT, {
                temperature: config.LLM.CALL_1_TEMPERATURE,
                maxTokens: config.LLM.CALL_1_MAX_TOKENS,
            });

            // Validate required structure
            if (!result.story_title || !result.episodes || !Array.isArray(result.episodes)) {
                throw new Error('LLM returned invalid story structure (missing story_title or episodes).');
            }
            if (result.episodes.length === 0) {
                throw new Error('LLM returned zero episodes.');
            }

            log(`  ✓ Story generated: "${result.story_title}" (${result.episodes.length} episodes)`);
            return result;

        } catch (err) {
            lastError = err;
            log(`  ⚠ Attempt ${attempt} failed: ${err.message}`);
            if (attempt <= config.LLM.MAX_RETRIES) {
                log(`  ↻ Retrying...`);
            }
        }
    }

    throw new Error(`Story generation failed after ${config.LLM.MAX_RETRIES + 1} attempts: ${lastError.message}`);
}


module.exports = { generateStory };
