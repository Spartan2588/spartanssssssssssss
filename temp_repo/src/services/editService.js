/**
 * services/editService.js
 * ────────────────────────
 * Targeted episode editing via LLM.
 * Quick actions + custom prompt support.
 * Modifies only the selected episode, not the entire story.
 */

'use strict';

const config = require('../config/generationConfig');
const { SYSTEM_PROMPT } = require('../prompts/basePrompt');
const { buildEditPrompt } = require('../prompts/enginePrompts');
const { llmJsonCall, DEMO_MODE } = require('./llmClient');

/**
 * Apply an edit to a single episode.
 *
 * @param {Object} episode — the episode to edit
 * @param {Object} storyContext — full story context (characters, title, genre, mood)
 * @param {string} editInstruction — what to change
 * @param {Function} log — pipeline logger
 * @returns {Object} — edited episode
 */
async function editEpisode(episode, storyContext, editInstruction, log) {
    log(`--- Edit Service: Editing Episode ${episode.episode_number} ---`);
    log(`  Instruction: ${editInstruction.slice(0, 80)}...`);

    if (DEMO_MODE) {
        log('  ⚡ Demo mode → simulating edit');

        // In demo mode, simulate the edit by prepending a note
        return {
            episode_title: episode.episode_title,
            purpose: episode.purpose,
            script: `[EDITED] ${episode.script}`,
            cliffhanger: episode.cliffhanger,
        };
    }

    const prompt = buildEditPrompt(episode, storyContext, editInstruction);

    for (let attempt = 1; attempt <= config.LLM.MAX_RETRIES + 1; attempt++) {
        try {
            log(`  Attempt ${attempt}/${config.LLM.MAX_RETRIES + 1}...`);

            const result = await llmJsonCall(prompt, SYSTEM_PROMPT, {
                temperature: config.LLM.CALL_1_TEMPERATURE,
                maxTokens: 2048,
            });

            if (!result.script) {
                throw new Error('Edit returned empty script.');
            }

            log(`  ✓ Edit applied successfully`);
            return result;

        } catch (err) {
            log(`  ⚠ Attempt ${attempt} failed: ${err.message}`);
            if (attempt > config.LLM.MAX_RETRIES) {
                throw new Error(`Edit failed after ${config.LLM.MAX_RETRIES + 1} attempts: ${err.message}`);
            }
        }
    }
}

/**
 * Get edit instruction from action ID or custom prompt.
 */
function getEditInstruction(actionId, customPrompt) {
    if (customPrompt && customPrompt.trim()) {
        return customPrompt.trim();
    }

    const action = config.EDIT_ACTIONS.find(a => a.id === actionId);
    if (!action) {
        throw new Error(`Unknown edit action: ${actionId}`);
    }
    return action.instruction;
}


module.exports = { editEpisode, getEditInstruction };
