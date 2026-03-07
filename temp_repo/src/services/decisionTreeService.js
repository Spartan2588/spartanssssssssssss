/**
 * services/decisionTreeService.js
 * ─────────────────────────────────
 * On-demand branching decision tree generator for Story Intelligence Map.
 * Generates a true k-ary branching tree (5-6 levels, 2-3 children/node).
 * Called separately from main pipeline — does NOT slow generation.
 */

'use strict';

const config = require('../config/generationConfig');
const { SYSTEM_PROMPT } = require('../prompts/basePrompt');
const { buildDecisionTreePrompt } = require('../prompts/enginePrompts');
const { llmJsonCall, DEMO_MODE } = require('./llmClient');
const { generateDemoBranchingTree } = require('../utils/demoData');

/**
 * Generate branching decision tree analysis for a story.
 *
 * @param {Object} storyEntry — stored story data (including _storyContext)
 * @param {Function} log — pipeline logger
 * @returns {Object} — { tree: {...}, best_path: [...], best_path_score, total_nodes }
 */
async function generateDecisionTree(storyEntry, log) {
    log('--- Decision Tree Service: Generating branching narrative tree ---');

    // Build context from stored story
    const storyContext = {
        story_title: storyEntry._storyContext?.story_title || storyEntry.story_title,
        genre: storyEntry._storyContext?.genre || storyEntry.genre,
        mood: storyEntry._storyContext?.mood || storyEntry.mood,
        characters: storyEntry._storyContext?.characters || storyEntry.characters || [],
        episodes: (storyEntry.episodes || []).map(ep => ({
            episode_number: ep.episode_number,
            episode_title: ep.episode_title,
            purpose: ep.purpose,
            cliffhanger: ep.cliffhanger,
        })),
    };

    if (DEMO_MODE) {
        log('  ⚡ Demo mode → returning mock branching tree');
        const result = generateDemoBranchingTree(storyContext);
        log(`  ✓ Branching tree generated (${result.total_nodes} nodes, best path score: ${result.best_path_score})`);
        return result;
    }

    const prompt = buildDecisionTreePrompt(storyContext);

    for (let attempt = 1; attempt <= config.LLM.MAX_RETRIES + 1; attempt++) {
        try {
            log(`  Attempt ${attempt}/${config.LLM.MAX_RETRIES + 1}...`);

            const result = await llmJsonCall(prompt, SYSTEM_PROMPT, {
                temperature: config.LLM.CALL_3_TEMPERATURE,
                maxTokens: config.LLM.CALL_3_MAX_TOKENS,
            });

            if (!result.tree || !result.tree.node_id) {
                throw new Error('LLM returned invalid branching tree format');
            }

            // Compute best path server-side if not provided
            if (!result.best_path || result.best_path.length === 0) {
                const pathResult = computeBestPath(result.tree);
                result.best_path = pathResult.best_path;
                result.best_path_score = pathResult.best_path_score;
            }

            // Count nodes
            result.total_nodes = countNodes(result.tree);

            log(`  ✓ Branching tree generated (${result.total_nodes} nodes)`);
            return result;

        } catch (err) {
            log(`  ⚠ Attempt ${attempt} failed: ${err.message}`);
            if (attempt > config.LLM.MAX_RETRIES) {
                log('  ⚠ Using fallback demo branching tree');
                return generateDemoBranchingTree(storyContext);
            }
        }
    }
}

/**
 * Compute the best root-to-leaf path by average retention.
 */
function computeBestPath(tree) {
    let bestPath = [];
    let bestScore = -1;

    function dfs(node, path, totalRetention) {
        const currentPath = [...path, node.node_id];
        const currentTotal = totalRetention + (node.retention_score || 0);

        if (!node.children || node.children.length === 0) {
            const avg = currentTotal / currentPath.length;
            if (avg > bestScore) {
                bestScore = avg;
                bestPath = currentPath;
            }
            return;
        }

        for (const child of node.children) {
            dfs(child, currentPath, currentTotal);
        }
    }

    dfs(tree, [], 0);
    return { best_path: bestPath, best_path_score: +bestScore.toFixed(2) };
}

/**
 * Count total nodes in tree.
 */
function countNodes(node) {
    if (!node) return 0;
    let count = 1;
    for (const child of (node.children || [])) {
        count += countNodes(child);
    }
    return count;
}


module.exports = { generateDecisionTree };
