/**
 * validators/inputValidator.js
 * ─────────────────────────────
 * Input validation and sanitization for story generation requests.
 * All limits are pulled from generationConfig — zero magic numbers.
 */

'use strict';

const config = require('../config/generationConfig');
const { GENRES, MOODS } = require('../prompts/genreTemplates');

/**
 * Validate and sanitize story generation input.
 * @param {Object} raw — request body
 * @returns {{ valid: boolean, errors: string[], sanitizedInput: Object }}
 */
function validateInput(raw) {
    const errors = [];

    // ─── Genre ───────────────────────────────────────────────────────
    if (!raw.genre || typeof raw.genre !== 'string') {
        errors.push('genre is required and must be a string.');
    } else if (!GENRES.includes(raw.genre.toLowerCase().trim())) {
        errors.push(`genre must be one of: ${GENRES.join(', ')}.`);
    }

    // ─── Description ─────────────────────────────────────────────────
    if (!raw.description || typeof raw.description !== 'string') {
        errors.push('description is required and must be a string.');
    } else if (raw.description.trim().length < config.DESCRIPTION_MIN_LENGTH) {
        errors.push(`description must be at least ${config.DESCRIPTION_MIN_LENGTH} characters.`);
    } else if (raw.description.trim().length > config.DESCRIPTION_MAX_LENGTH) {
        errors.push(`description must be at most ${config.DESCRIPTION_MAX_LENGTH} characters.`);
    }

    // ─── Mood ────────────────────────────────────────────────────────
    if (!raw.emotionMood || typeof raw.emotionMood !== 'string') {
        errors.push('emotionMood is required and must be a string.');
    } else if (!MOODS.includes(raw.emotionMood.toLowerCase().trim())) {
        errors.push(`emotionMood must be one of: ${MOODS.join(', ')}.`);
    }

    // ─── Character Count ─────────────────────────────────────────────
    if (raw.numCharacters !== undefined) {
        const n = Number(raw.numCharacters);
        if (isNaN(n) || n < config.MIN_CHARACTERS || n > config.MAX_CHARACTERS) {
            errors.push(`numCharacters must be between ${config.MIN_CHARACTERS} and ${config.MAX_CHARACTERS}.`);
        }
    }

    // ─── Episode Count (optional — auto-calculated if not provided) ──
    if (raw.numEpisodes !== undefined) {
        const n = Number(raw.numEpisodes);
        if (isNaN(n) || n < config.MIN_EPISODES || n > config.MAX_EPISODES) {
            errors.push(`numEpisodes must be between ${config.MIN_EPISODES} and ${config.MAX_EPISODES}.`);
        }
    }

    // ─── Character Mode ──────────────────────────────────────────────
    if (raw.characterMode && !config.CHARACTER_MODES.includes(raw.characterMode)) {
        errors.push(`characterMode must be one of: ${config.CHARACTER_MODES.join(', ')}.`);
    }

    // ─── User-Defined Characters ─────────────────────────────────────
    if (raw.characterMode === 'USER_DEFINED') {
        if (!raw.characters || !Array.isArray(raw.characters) || raw.characters.length === 0) {
            errors.push('characters array is required when characterMode is "USER_DEFINED".');
        } else {
            raw.characters.forEach((c, i) => {
                if (!c.name || typeof c.name !== 'string' || !c.name.trim()) {
                    errors.push(`Character ${i + 1} must have a name.`);
                }
            });
        }
    }

    // ─── Build sanitized input ───────────────────────────────────────
    const sanitizedInput = {
        genre: (raw.genre || 'thriller').toLowerCase().trim(),
        numCharacters: Math.min(
            Math.max(Number(raw.numCharacters) || config.DEFAULT_CHARACTERS, config.MIN_CHARACTERS),
            config.MAX_CHARACTERS
        ),
        emotionMood: (raw.emotionMood || 'suspense').toLowerCase().trim(),
        characterMode: raw.characterMode || 'AI_GENERATED',
        description: (raw.description || '').trim(),
        characters: (raw.characters || []).map(c => ({
            name: (c.name || '').trim(),
            traits: (c.traits || c.personality_traits || '').trim(),
        })),
        numEpisodes: raw.numEpisodes
            ? Math.min(Math.max(Number(raw.numEpisodes), config.MIN_EPISODES), config.MAX_EPISODES)
            : null, // null = auto-calculate
    };

    return {
        valid: errors.length === 0,
        errors,
        sanitizedInput,
    };
}


module.exports = { validateInput };
