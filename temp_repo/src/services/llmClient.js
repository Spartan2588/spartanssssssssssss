/**
 * services/llmClient.js
 * ──────────────────────
 * Thin, provider-agnostic LLM wrapper.
 * Reads LLM_BASE_URL, LLM_API_KEY, LLM_MODEL from env vars.
 * Falls back to DEMO MODE when no valid key is set.
 *
 * Clean module — demo mock data lives in utils/demoData.js.
 */

'use strict';

require('dotenv').config();

const BASE_URL = (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
const API_KEY = process.env.LLM_API_KEY || '';
const MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';

const DEMO_MODE = !API_KEY
    || API_KEY === 'sk-YOUR_KEY_HERE'
    || API_KEY.toLowerCase() === 'your_key_here'
    || API_KEY.length < 10;

if (DEMO_MODE) {
    console.log('⚡ LLM Client: DEMO MODE (no valid API key configured)');
} else {
    console.log(`🤖 LLM Client: LIVE MODE → ${BASE_URL} (model: ${MODEL})`);
}


// ─── Core LLM Call ───────────────────────────────────────────────────────

/**
 * Make a chat completion call to an OpenAI-compatible endpoint.
 *
 * @param {string} prompt — user message
 * @param {string} systemPrompt — system message
 * @param {Object} opts — { temperature, maxTokens, jsonMode }
 * @returns {string} — raw completion text
 */
async function llmCall(prompt, systemPrompt = 'You are StoryForge AI.', {
    temperature = 0.7,
    maxTokens = 4096,
    jsonMode = false,
} = {}) {
    if (DEMO_MODE) {
        throw new Error('llmCall should not be invoked in demo mode. Use demo data utils.');
    }

    const body = {
        model: MODEL,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
        ],
        temperature,
        max_tokens: maxTokens,
    };

    if (jsonMode) {
        body.response_format = { type: 'json_object' };
    }

    const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unknown error');
        throw new Error(`LLM API error (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
        throw new Error('LLM returned empty response.');
    }

    return content.trim();
}


/**
 * Make an LLM call and parse the response as JSON.
 * Strips markdown code fences if present.
 *
 * @param {string} prompt — user message
 * @param {string} systemPrompt — system message
 * @param {Object} opts — { temperature, maxTokens }
 * @returns {Object} — parsed JSON
 */
async function llmJsonCall(prompt, systemPrompt, opts = {}) {
    const raw = await llmCall(prompt, systemPrompt, { ...opts, jsonMode: true });

    // Strip markdown code fences (```json ... ```)
    let cleaned = raw;
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
        cleaned = fenceMatch[1].trim();
    }

    try {
        return JSON.parse(cleaned);
    } catch (err) {
        throw new Error(`Failed to parse LLM JSON response: ${err.message}\nRaw: ${raw.slice(0, 200)}...`);
    }
}


module.exports = { llmCall, llmJsonCall, DEMO_MODE };
