/**
 * utils/responseFormatter.js
 * ───────────────────────────
 * Shapes LLM output into clean, consistent JSON for the frontend.
 * v3.0 — Adds retention_analysis, momentum_scores, hidden_flaw.
 */

'use strict';

const config = require('../config/generationConfig');

/**
 * Format the final story response for the frontend.
 */
function formatStoryResponse(storyData, analysisData, twistData, meta) {
    // Merge analysis into episodes
    const episodes = (storyData.episodes || []).map((ep, i) => {
        const analysis = (analysisData.episode_analysis || [])
            .find(a => a.episode_number === ep.episode_number) || {};

        return {
            episode_number: ep.episode_number || i + 1,
            episode_title: ep.episode_title || `Episode ${i + 1}`,
            purpose: ep.purpose || '',
            emotion_level: analysis.emotion_level || 5,
            dominant_emotion: analysis.dominant_emotion || 'neutral',
            engagement_risk: analysis.engagement_risk || 'LOW',
            script: ep.script || '',
            cliffhanger: ep.cliffhanger || '',
            cliffhanger_score: analysis.cliffhanger_score || 5,
            score_reason: analysis.score_reason || '',
            sub_scores: analysis.sub_scores || null,
            retention_blocks: analysis.retention_blocks || [],
            momentum_score: analysis.momentum_score || 5,
        };
    });

    // Build final response
    return {
        story_title: storyData.story_title || 'Untitled Story',
        genre: storyData.genre || meta.genre || 'unknown',
        mood: storyData.mood || meta.mood || 'unknown',
        characters: (storyData.characters || []).map(c => ({
            name: c.name || 'Unknown',
            personality_traits: c.personality_traits || '',
            motivation: c.motivation || '',
            hidden_flaw: c.hidden_flaw || '',
            internal_conflict: c.internal_conflict || '',
        })),
        episodes,
        emotional_arc_analysis: analysisData.emotional_arc_analysis || {
            engagement_graph: '',
            flat_engagement_episodes: [],
        },
        plot_twists: (twistData.plot_twists || []).map(tw => ({
            twist_type: tw.twist_type || 'unknown',
            twist: tw.twist || '',
            setup: tw.setup || '',
            reveal: tw.reveal || '',
            impact: tw.impact || '',
        })),
        hashtags: twistData.hashtags || [],
        _meta: {
            pipeline_log: meta.log || [],
            generation_time_seconds: meta.elapsed || 0,
            mode: meta.mode || 'unknown',
            engine_version: '3.0.0',
            llm_calls: meta.llmCalls || 0,
        },
    };
}


module.exports = { formatStoryResponse };
