/**
 * controllers/storyController.js
 * ────────────────────────────────
 * Pipeline orchestrator v3.0.
 *
 * Pipeline:
 *   validate → episodeCalc →
 *     Call 1 (story + episodes) → decompose →
 *     Call 2 (emotions + cliffhangers + retention) →
 *       retention predictor → momentum scorer →
 *     Call 3 (Netflix twists + hashtags) →
 *     format → store with story_id → respond
 *
 * Also handles: story retrieval by ID, targeted episode editing.
 */

'use strict';

const crypto = require('crypto');
const config = require('../config/generationConfig');
const { SYSTEM_PROMPT } = require('../prompts/basePrompt');
const { buildCall2Prompt } = require('../prompts/enginePrompts');
const { GENRES, MOODS } = require('../prompts/genreTemplates');
const { validateInput } = require('../validators/inputValidator');
const { calculateEpisodeCount } = require('../utils/episodeCalculator');
const { formatStoryResponse } = require('../utils/responseFormatter');

// Services
const { generateStory } = require('../services/storyGenerator');
const { decomposeAndValidate } = require('../services/decomposerEngine');
const { processEmotionalArc } = require('../services/emotionalArcAnalyzer');
const { scoreCliffhangers } = require('../services/cliffhangerScorer');
const { processRetention } = require('../services/retentionPredictor');
const { processMomentum } = require('../services/momentumScorer');
const { generateTwistsAndHashtags } = require('../services/twistGenerator');
const { processHashtags } = require('../services/hashtagGenerator');
const { editEpisode, getEditInstruction } = require('../services/editService');
const { generateDecisionTree } = require('../services/decisionTreeService');
const { llmJsonCall, DEMO_MODE } = require('../services/llmClient');
const { generateDemoCall2 } = require('../utils/demoData');


// ─── In-Memory Story Store ───────────────────────────────────────────────
const storyStore = new Map();


/**
 * POST /api/story/generate
 */
async function handleGenerate(req, res) {
    const startTime = Date.now();
    const log = [];
    let llmCalls = 0;

    function _log(msg) {
        const ts = new Date().toISOString().slice(11, 19);
        const entry = `[${ts}] ${msg}`;
        log.push(entry);
        console.log(entry);
    }

    try {
        // ── Step 0: Validate Input ────────────────────────────────────
        _log('=== StoryForge AI Pipeline v3.0 — START ===');

        const { valid, errors, sanitizedInput } = validateInput(req.body);
        if (!valid) {
            return res.status(400).json({ success: false, error: 'Invalid input.', details: errors });
        }

        // ── Step 1: Calculate Episode Count ────────────────────────────
        sanitizedInput.numEpisodes = calculateEpisodeCount(sanitizedInput);
        _log(`Genre: ${sanitizedInput.genre} | Mood: ${sanitizedInput.emotionMood} | Episodes: ${sanitizedInput.numEpisodes}`);
        _log(`Characters: ${sanitizedInput.numCharacters} (${sanitizedInput.characterMode})`);
        _log(`Description: ${sanitizedInput.description.slice(0, 80)}...`);
        _log(`Mode: ${DEMO_MODE ? '⚡ DEMO' : '🤖 LIVE LLM'}`);

        // ── Call 1: Story + Episode Decomposition ──────────────────────
        let storyData = await generateStory(sanitizedInput, _log);
        llmCalls++;

        // ── Decomposer: Validate episode structure ─────────────────────
        storyData = decomposeAndValidate(storyData, _log);

        // ── Call 2: Emotional Analysis + Cliffhanger + Retention ──────
        _log('--- Call 2: Emotional Arc + Cliffhanger + Retention ---');
        let rawAnalysis;

        if (DEMO_MODE) {
            _log('  ⚡ Demo mode → returning mock analysis');
            rawAnalysis = generateDemoCall2(storyData);
        } else {
            const call2Prompt = buildCall2Prompt(storyData);
            let lastError = null;

            for (let attempt = 1; attempt <= config.LLM.MAX_RETRIES + 1; attempt++) {
                try {
                    _log(`  Attempt ${attempt}/${config.LLM.MAX_RETRIES + 1}...`);
                    rawAnalysis = await llmJsonCall(call2Prompt, SYSTEM_PROMPT, {
                        temperature: config.LLM.CALL_2_TEMPERATURE,
                        maxTokens: config.LLM.CALL_2_MAX_TOKENS,
                    });
                    _log('  ✓ Analysis received');
                    break;
                } catch (err) {
                    lastError = err;
                    _log(`  ⚠ Attempt ${attempt} failed: ${err.message}`);
                    if (attempt > config.LLM.MAX_RETRIES) {
                        _log('  ⚠ Using fallback analysis');
                        rawAnalysis = {
                            episode_analysis: storyData.episodes.map((ep, i) => ({
                                episode_number: ep.episode_number,
                                emotion_level: 5 + Math.ceil(i * 0.5),
                                dominant_emotion: 'neutral',
                                cliffhanger_score: 5,
                                score_reason: 'Fallback score',
                                sub_scores: { curiosity: 5, shock: 5, stakes: 5, urgency: 5 },
                                retention_blocks: [],
                                momentum_score: 5,
                            })),
                            emotional_arc_analysis: { engagement_graph: '', flat_engagement_episodes: [] },
                        };
                    }
                }
            }
        }
        llmCalls++;

        // ── Post-process: Emotional Arc ────────────────────────────────
        const arcResult = processEmotionalArc(rawAnalysis.episode_analysis, _log);

        // ── Post-process: Cliffhanger Scores ───────────────────────────
        let scoredEpisodes = scoreCliffhangers(arcResult.episode_analysis, _log);

        // ── Post-process: Retention Predictor ──────────────────────────
        scoredEpisodes = processRetention(scoredEpisodes, _log);

        // ── Post-process: Momentum Scorer ──────────────────────────────
        scoredEpisodes = processMomentum(scoredEpisodes, _log);

        const analysisData = {
            episode_analysis: scoredEpisodes,
            emotional_arc_analysis: arcResult.emotional_arc_analysis,
        };

        // ── Call 3: Netflix Twists + Hashtags ──────────────────────────
        const twistData = await generateTwistsAndHashtags(storyData, _log);
        llmCalls++;

        // ── Post-process: Hashtags ─────────────────────────────────────
        twistData.hashtags = processHashtags(twistData.hashtags, {
            genre: storyData.genre,
            mood: storyData.mood,
            story_title: storyData.story_title,
        }, _log);

        // ── Format Response ────────────────────────────────────────────
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        _log(`=== StoryForge AI Pipeline — COMPLETE (${elapsed}s, ${llmCalls} LLM calls) ===`);

        const response = formatStoryResponse(storyData, analysisData, twistData, {
            genre: sanitizedInput.genre,
            mood: sanitizedInput.emotionMood,
            log,
            elapsed: parseFloat(elapsed),
            mode: DEMO_MODE ? 'demo' : 'live',
            llmCalls,
        });

        // ── Store with story_id ────────────────────────────────────────
        const storyId = crypto.randomUUID();
        storyStore.set(storyId, {
            ...response,
            _storyContext: {
                characters: storyData.characters,
                story_title: storyData.story_title,
                genre: storyData.genre,
                mood: storyData.mood,
            },
            _createdAt: new Date().toISOString(),
        });

        // Cleanup: keep only last 50 stories
        if (storyStore.size > 50) {
            const oldest = storyStore.keys().next().value;
            storyStore.delete(oldest);
        }

        res.json({ success: true, story_id: storyId, data: response });

    } catch (err) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        _log(`⚠ Pipeline FAILED (${elapsed}s): ${err.message}`);
        console.error('[storyController]', err);

        res.status(500).json({
            success: false,
            error: 'Story generation failed. Please try again.',
            details: process.env.NODE_ENV !== 'production' ? err.message : undefined,
        });
    }
}


/**
 * GET /api/story/:id
 */
function handleGetStory(req, res) {
    const { id } = req.params;
    const story = storyStore.get(id);

    if (!story) {
        return res.status(404).json({ success: false, error: 'Story not found.' });
    }

    // Don't expose internal context
    const { _storyContext, ...publicStory } = story;
    res.json({ success: true, data: publicStory });
}


/**
 * POST /api/story/edit
 * Body: { story_id, episode_number, action_id?, custom_prompt? }
 */
async function handleEdit(req, res) {
    const { story_id, episode_number, action_id, custom_prompt } = req.body;

    if (!story_id || !episode_number) {
        return res.status(400).json({ success: false, error: 'story_id and episode_number are required.' });
    }

    const storyEntry = storyStore.get(story_id);
    if (!storyEntry) {
        return res.status(404).json({ success: false, error: 'Story not found.' });
    }

    const episode = storyEntry.episodes.find(ep => ep.episode_number === episode_number);
    if (!episode) {
        return res.status(404).json({ success: false, error: `Episode ${episode_number} not found.` });
    }

    const log = [];
    function _log(msg) {
        const ts = new Date().toISOString().slice(11, 19);
        const entry = `[${ts}] ${msg}`;
        log.push(entry);
        console.log(entry);
    }

    try {
        const instruction = getEditInstruction(action_id, custom_prompt);
        const edited = await editEpisode(episode, storyEntry._storyContext, instruction, _log);

        // Update the stored episode
        Object.assign(episode, {
            episode_title: edited.episode_title || episode.episode_title,
            purpose: edited.purpose || episode.purpose,
            script: edited.script || episode.script,
            cliffhanger: edited.cliffhanger || episode.cliffhanger,
        });

        res.json({
            success: true,
            episode_number,
            data: episode,
            edit_log: log,
        });

    } catch (err) {
        console.error('[editHandler]', err);
        res.status(500).json({
            success: false,
            error: `Edit failed: ${err.message}`,
        });
    }
}


/**
 * GET /api/story/genres
 */
function handleGetGenres(req, res) {
    res.json({ success: true, genres: GENRES });
}

/**
 * GET /api/story/moods
 */
function handleGetMoods(req, res) {
    res.json({ success: true, moods: MOODS });
}

/**
 * GET /api/story/edit-actions
 */
function handleGetEditActions(req, res) {
    res.json({ success: true, actions: config.EDIT_ACTIONS });
}


/**
 * POST /api/story/analytics
 * Body: { story_id }
 * On-demand: generates decision tree + aggregates existing analytics.
 */
async function handleAnalytics(req, res) {
    const { story_id } = req.body;

    if (!story_id) {
        return res.status(400).json({ success: false, error: 'story_id is required.' });
    }

    const storyEntry = storyStore.get(story_id);
    if (!storyEntry) {
        return res.status(404).json({ success: false, error: 'Story not found.' });
    }

    const log = [];
    function _log(msg) {
        const ts = new Date().toISOString().slice(11, 19);
        const entry = `[${ts}] ${msg}`;
        log.push(entry);
        console.log(entry);
    }

    try {
        _log('=== Story Intelligence Map — Analytics Generation ===');

        // Generate decision tree on-demand
        const treeData = await generateDecisionTree(storyEntry, _log);

        // Aggregate existing analytics from stored story
        const analytics = {
            story_title: storyEntry.story_title,
            genre: storyEntry.genre,
            mood: storyEntry.mood,
            characters: storyEntry.characters,
            episodes: storyEntry.episodes.map(ep => ({
                episode_number: ep.episode_number,
                episode_title: ep.episode_title,
                emotion_level: ep.emotion_level,
                dominant_emotion: ep.dominant_emotion,
                engagement_risk: ep.engagement_risk,
                cliffhanger_score: ep.cliffhanger_score,
                sub_scores: ep.sub_scores,
                retention_blocks: ep.retention_blocks,
                momentum_score: ep.momentum_score,
            })),
            emotional_arc_analysis: storyEntry.emotional_arc_analysis,
            // Branching decision tree (nested)
            decision_tree: treeData.tree,
            best_path: treeData.best_path,
            best_path_score: treeData.best_path_score,
            total_nodes: treeData.total_nodes,
            analytics_log: log,
        };

        _log('=== Analytics Generation — COMPLETE ===');
        res.json({ success: true, data: analytics });

    } catch (err) {
        console.error('[analyticsHandler]', err);
        res.status(500).json({
            success: false,
            error: `Analytics generation failed: ${err.message}`,
        });
    }
}


module.exports = { handleGenerate, handleGetStory, handleEdit, handleGetGenres, handleGetMoods, handleGetEditActions, handleAnalytics };
