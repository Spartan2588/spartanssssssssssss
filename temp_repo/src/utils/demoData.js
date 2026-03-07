/**
 * utils/demoData.js
 * ──────────────────
 * Demo mode mock data generator.
 * Returns realistic story data without LLM calls for development/testing.
 */

'use strict';

const config = require('../config/generationConfig');

// ─── Demo Script Templates ──────────────────────────────────────────────

const DEMO_SCRIPTS = {
    thriller: [
        'The streets of downtown were empty at 3 AM when {protagonist} noticed the package sitting at her doorstep. No label. No return address. Just a thin cardboard box wrapped in brown paper with a single word written in red marker: REMEMBER. She hadn\'t ordered anything. She hadn\'t told anyone her new address. Her hands trembled as she lifted the lid. Inside, a polaroid photo — her own face, sleeping, taken from inside her bedroom. Last night.',
        '{protagonist} tracked the delivery route through traffic cameras, pulling favors from every contact she had left. The footage showed a figure in a grey hoodie, face never visible, dropping packages at twelve addresses in one night. But here\'s what made her blood run cold — every delivery address belonged to someone who had reported memory loss to the police in the past six months. Twelve people. Twelve stolen memories. And now she was number thirteen.',
        'The lab results confirmed what {protagonist} feared. The substance coating the inside of the package wasn\'t just any chemical — it was a synthetic compound designed to trigger vivid neural reconstruction. When she\'d touched the polaroid, she hadn\'t just seen a photo. She\'d experienced a memory. But it wasn\'t hers. It belonged to a woman named Sara Chen, who had been missing for forty-seven days. And in that memory, Sara was screaming.',
        'Detective Morrison refused to believe her. "Memory theft isn\'t real," he said, sliding the case file back across his desk. But {protagonist} had proof now. She\'d tracked down three other recipients. They\'d all experienced the same thing — touching the packages triggered someone else\'s most traumatic moment. A car crash. A betrayal. A loss. And afterwards, their own memories started to fade. First the small ones. Then the ones that mattered most.',
        'The warehouse on Fifth Street reeked of formaldehyde and copper. {protagonist} found rows of glass containers, each labeled with a name and date. Inside each one, a shimmering liquid that seemed to pulse with light. This was where they stored them — the stolen memories, extracted and preserved like specimens. But when she found the container with her own name on it, the date read tomorrow. They hadn\'t stolen her memories yet. They were planning to.',
        'Standing in the cold glow of the warehouse lights, {protagonist} made her choice. She uncapped her own container and drank. The liquid burned like fire and tasted like every birthday, every first kiss, every scraped knee of her childhood compressed into a single swallow. Her memories flooded back — not just hers, but fragments of all twelve victims. She saw their faces, felt their pain, and understood the pattern. The thief wasn\'t stealing memories at random. They were building something. A composite memory of the perfect life. And the final piece was {protagonist}\'s happiest moment.',
    ],
    horror: [
        'The house at 44 Elm Street had been empty for eleven years when {protagonist} moved in. The realtor said the previous owner left in a hurry — something about "the walls." {protagonist} laughed it off. But on the first night, lying in bed, she heard it. Not through the walls. From inside them. A rhythmic tapping, like fingers drumming on drywall. And then a whisper, barely audible: "You\'re in my room."',
        '{protagonist} tore open the wall the next morning, convinced she\'d find a rodent nest or faulty pipes. Instead, she found a hollow chamber six feet long and three feet wide, the exact dimensions of a coffin. The walls were scratched from the inside, deep grooves cut by human fingernails. In the corner, written in something dark and flaking: "DAY 47 — SHE STILL WON\'T LET ME OUT." The handwriting was her grandmother\'s.',
        'The historical society confirmed {protagonist}\'s worst suspicion. Her grandmother, Elena, had lived in this house decades ago. But according to records, Elena had never left. The woman {protagonist} called "Grandma" for twenty-three years — the woman who braided her hair, baked her cookies, attended her wedding — was someone else entirely. Someone who had sealed the real Elena inside the walls and taken her place. And they were still alive.',
        'Sleep became impossible. Every night, the tapping grew louder. Now {protagonist} could make out full sentences through the drywall. "She took my face. She took my name. She took my granddaughter." {protagonist} installed cameras. At 3:17 AM, they captured a shadow moving through the hallway. It was shaped like her grandmother, but wrong — too tall, joints bending the wrong way, moving in jerky stop-motion frames toward {protagonist}\'s bedroom door.',
        '{protagonist} confronted the woman she\'d called grandmother at Sunday dinner. "Who are you really?" she asked. The old woman set her fork down slowly. Her face didn\'t change expression — it couldn\'t. {protagonist} realized what she\'d always dismissed as "Grandma\'s poker face" was something else entirely. The skin wasn\'t moving because it wasn\'t skin. It was a mask. And beneath it, something was smiling.',
        'She ran. But the thing wearing her grandmother\'s face was faster than any elderly woman should be. It caught her at the front door, its grip cold as marble. "I\'ve been your grandmother for twenty-three years," it said in a voice that was almost right but had too many harmonics. "I learned to love you, in my way. But now you know, and knowing ruins everything." Behind them, from deep within the walls, the real Elena screamed one final time — then went silent. {protagonist} realized with horror that the creature wasn\'t keeping Elena alive in there. Elena was keeping the creature alive out here.',
    ],
};

// Fallback script for genres without specific templates
function _generateGenericScript(protagonist, epNum, total, genre) {
    const hooks = [
        `${protagonist} discovered something that would change everything.`,
        `The truth was worse than ${protagonist} could have imagined.`,
        `${protagonist} realized they had been lied to all along.`,
        `When ${protagonist} opened the door, nothing could have prepared them.`,
        `The message arrived at midnight, and ${protagonist} knew there was no going back.`,
        `In the final confrontation, ${protagonist} faced an impossible choice.`,
    ];
    const hook = hooks[Math.min(epNum - 1, hooks.length - 1)];
    const words = [];
    words.push(hook);
    // Pad to ~200 words with genre-appropriate filler
    const filler = `The ${genre} story continued to unfold in unexpected ways. Every moment brought new revelations and deepened the emotional stakes. Characters faced their darkest fears and found strength they never knew they had. The tension mounted with each passing scene, building toward a climax that would leave audiences breathless.`;
    while (words.join(' ').split(/\s+/).length < 190) {
        words.push(filler);
    }
    return words.join(' ').split(/\s+/).slice(0, 200).join(' ') + '.';
}

// ─── Demo Cliffhangers ──────────────────────────────────────────────────

function _generateCliffhanger(protagonist, epNum, total) {
    const cliffs = [
        `${protagonist} found a photo of themselves — taken from inside their own bedroom last night.`,
        `The lab results came back: the substance was designed to erase memories permanently.`,
        `Three other victims had already lost everything. ${protagonist} was next.`,
        `The detective working the case turned out to be connected to the disappearances.`,
        `${protagonist} found a jar labeled with their own name. The date read: tomorrow.`,
        `The truth behind the memory thefts was far more terrifying than anyone imagined.`,
    ];
    return cliffs[Math.min(epNum - 1, cliffs.length - 1)];
}


// ─── Main Demo Response Generator ───────────────────────────────────────

/**
 * Generate call-1 style demo data (story + episodes).
 */
function generateDemoCall1(input) {
    const protagonist = input.characterMode === 'USER_DEFINED' && input.characters[0]
        ? input.characters[0].name
        : 'Maya Chen';

    const scripts = DEMO_SCRIPTS[input.genre];
    const numEps = input.numEpisodes;

    const characters = [
        { name: protagonist, personality_traits: 'determined, resourceful, haunted by the past', motivation: 'Uncover the truth and protect the innocent', hidden_flaw: 'Cannot bring herself to trust anyone fully', internal_conflict: 'Trust issues stemming from a childhood betrayal' },
        { name: 'Detective Morrison', personality_traits: 'skeptical, methodical, secretly conflicted', motivation: 'Maintain order and close the case', hidden_flaw: 'Prioritizes career advancement over justice', internal_conflict: 'Knows more than he lets on about the conspiracy' },
        { name: 'Dr. Elena Voss', personality_traits: 'brilliant, enigmatic, morally ambiguous', motivation: 'Advance her research at any cost', hidden_flaw: 'Sees people as test subjects, not individuals', internal_conflict: 'Her methods conflict with her oath to do no harm' },
    ];

    // Use only the number of characters requested
    const chars = characters.slice(0, input.numCharacters);
    if (input.characterMode === 'USER_DEFINED') {
        input.characters.forEach((c, i) => {
            if (chars[i]) {
                chars[i].name = c.name;
                chars[i].personality_traits = c.traits || chars[i].personality_traits;
            }
        });
    }

    const episodes = [];
    for (let i = 0; i < numEps; i++) {
        episodes.push({
            episode_number: i + 1,
            episode_title: `Episode ${i + 1}: ${['The Discovery', 'The Pattern', 'The Connection', 'The Resistance', 'The Warehouse', 'The Choice'][i % 6]}`,
            purpose: [
                'Introduce the protagonist and the inciting incident',
                'Expand the mystery and raise the stakes',
                'Deepen character relationships and reveal hidden connections',
                'Confront major obstacles and test character resolve',
                'Approach the climax with a devastating revelation',
                'Deliver the climax and set up resolution',
            ][i % 6],
            script: scripts
                ? (scripts[i % scripts.length] || '').replace(/{protagonist}/g, protagonist)
                : _generateGenericScript(protagonist, i + 1, numEps, input.genre),
            cliffhanger: _generateCliffhanger(protagonist, i + 1, numEps),
        });
    }

    return {
        story_title: `The ${input.genre.charAt(0).toUpperCase() + input.genre.slice(1)} of ${protagonist}`,
        genre: input.genre,
        mood: input.emotionMood,
        characters: chars,
        episodes,
    };
}

/**
 * Generate call-2 style demo data (emotional analysis + cliffhanger scores).
 */
function generateDemoCall2(storyData) {
    const numEps = storyData.episodes.length;

    const episode_analysis = storyData.episodes.map((ep, i) => {
        const emotionLevel = Math.min(3 + Math.ceil((i / (numEps - 1)) * 7), 10);
        const cliffScore = Math.min(4 + Math.ceil((i / (numEps - 1)) * 5), 10);
        const emotions = ['curiosity', 'tension', 'fear', 'determination', 'shock', 'catharsis'];
        let risk = 'LOW';
        if (emotionLevel < 4) risk = 'HIGH';
        else if (emotionLevel < 6) risk = 'MEDIUM';

        // Retention blocks — escalating within each episode
        const blockLabels = ['0-10s', '10-30s', '30-60s', '60-90s'];
        const hookBoost = i === 0 ? 2 : 0; // Episode 1 gets strong hooks
        const retention_blocks = blockLabels.map((label, bi) => {
            const base = 4 + Math.ceil((i / (numEps - 1)) * 3);
            const curiosity = Math.min(base + (bi === 0 ? 3 + hookBoost : bi), 10);
            const conflict = Math.min(base + bi, 10);
            const info = Math.min(base + (bi === 1 ? 2 : bi === 2 ? 3 : 1), 10);
            const emo = Math.min(base + (bi === 3 ? 4 : bi), 10);
            const overall = +((curiosity + conflict + info + emo) / 4).toFixed(1);
            let blockRisk = 'SAFE';
            if (overall < 4) blockRisk = 'HIGH';
            else if (overall < 6) blockRisk = 'MEDIUM';
            const reasons = [
                'Strong pattern interrupt hook captures attention',
                'Setup establishes situation — pacing acceptable',
                'New evidence discovered — conflict rising',
                'Powerful cliffhanger drives next-episode curiosity',
            ];
            return { block: label, curiosity, conflict, information_gain: info, emotional_shift: emo, overall, risk: blockRisk, reason: reasons[bi] };
        });

        // Momentum score
        const momentum_score = +((cliffScore + emotionLevel + Math.min(cliffScore + 1, 10) + Math.min(emotionLevel - 1, 10)) / 4).toFixed(1);

        return {
            episode_number: ep.episode_number,
            emotion_level: emotionLevel,
            dominant_emotion: emotions[i % emotions.length],
            engagement_risk: risk,
            cliffhanger_score: cliffScore,
            score_reason: `Strong ${emotions[i % emotions.length]} driver with escalating stakes.`,
            sub_scores: { curiosity: cliffScore, shock: cliffScore - 1, stakes: cliffScore, urgency: cliffScore - 2 },
            retention_blocks,
            momentum_score,
        };
    });

    return {
        episode_analysis,
        emotional_arc_analysis: {
            engagement_graph: `Emotional intensity rises from ${episode_analysis[0].emotion_level}/10 to ${episode_analysis[numEps - 1].emotion_level}/10 across ${numEps} episodes. Strong escalation pattern detected.`,
            flat_engagement_episodes: [],
        },
    };
}

/**
 * Generate call-3 style demo data (twists + hashtags).
 */
function generateDemoCall3(storyData) {
    const protagonist = storyData.characters[0]?.name || 'the protagonist';

    return {
        plot_twists: [
            {
                twist_type: 'expectation',
                twist: `The "stolen memories" are not stolen at all — they are suppressed truths the victims chose to forget`,
                setup: 'Throughout the story, victims express relief after losing memories, hinting they wanted to forget',
                reveal: `${protagonist} discovers the memory extraction was a voluntary service that the victims regretted`,
                impact: 'The audience realizes the crime they assumed was happening was actually a service — the real crime is something else entirely',
            },
            {
                twist_type: 'identity',
                twist: `Detective Morrison is not a detective — he is a former client who lost his identity to the memory service`,
                setup: 'Morrison consistently avoids sharing personal details and his badge number doesn\'t check out',
                reveal: 'Database records show Morrison\'s real identity was erased — he stole a detective\'s identity to investigate his own past',
                impact: 'Everything Morrison said must be re-evaluated — his help was motivated by personal loss, not justice',
            },
            {
                twist_type: 'moral',
                twist: `Dr. Voss created the memory service to help abuse survivors erase trauma — ${protagonist}\'s investigation threatens to expose the survivors`,
                setup: 'Voss\'s lab contains thank-you letters from anonymous patients, briefly glimpsed but never read',
                reveal: `${protagonist} reads the letters and realizes shutting down the service will force survivors to relive their worst experiences`,
                impact: 'The audience must question whether ${protagonist} is the hero or the villain — justice and mercy are in direct conflict',
            },
        ],
        hashtags: [
            '#StoryTime', '#ThrillerSeries', '#PlotTwist', '#Cliffhanger',
            '#AIStory', '#StorySeries', '#EpisodeSeries', '#BingeWorthy',
            `#${storyData.genre.charAt(0).toUpperCase() + storyData.genre.slice(1)}Story`,
            '#ShortStory', '#Storytelling', '#DarkTwist',
        ],
    };
}

/**
 * Generate a true branching decision tree for Story Intelligence Map.
 * - 5-6 levels deep, 2-3 children per node
 * - Branch pruning at depth >= 3 (keep top 2)
 * - Retention formula: (curiosity×0.35 + conflict×0.25 + novelty×0.15 + emotion×0.15 + stakes×0.10)
 * - Best path: highest avg retention root-to-leaf
 */
function generateDemoBranchingTree(storyData) {
    const protagonist = storyData.characters[0]?.name || 'the protagonist';
    const genre = storyData.genre || 'thriller';
    const maxDepth = 5; // 0-indexed, so 6 levels total (0..5)

    // ── Narrative direction pools by depth ──
    const narrativePool = [
        // Level 0 → 1 (story opening)
        [
            `${protagonist} discovers a mysterious clue that launches an investigation`,
            `A stranger delivers a warning that changes ${protagonist}'s plans`,
            `${protagonist} witnesses an impossible event that defies explanation`,
        ],
        // Level 1 → 2 (escalation)
        [
            `The investigation reveals a hidden network of connected events`,
            `${protagonist} finds an unexpected ally with a dark secret`,
            `A betrayal from a trusted figure reshapes the entire situation`,
        ],
        // Level 2 → 3 (midpoint)
        [
            `${protagonist} confronts the source of the mystery face-to-face`,
            `A devastating revelation forces ${protagonist} to question everything`,
            `The stakes escalate when innocent lives are put at risk`,
        ],
        // Level 3 → 4 (climax approach)
        [
            `${protagonist} devises a daring plan to expose the truth`,
            `The antagonist makes a move that corners ${protagonist}`,
            `An impossible moral choice splits ${protagonist}'s loyalties`,
        ],
        // Level 4 → 5 (climax)
        [
            `The final confrontation reveals the true mastermind`,
            `${protagonist} sacrifices something precious for the greater good`,
            `A last-minute twist redefines who is hero and who is villain`,
        ],
    ];

    let nodeCounter = 0;

    /**
     * Build a tree node recursively.
     * @param {number} depth — current level (0 = root)
     * @param {string} parentId — parent node id
     * @param {string} label — branch label (e.g. "A", "B1", "A2a")
     */
    function buildNode(depth, parentId, label) {
        const nodeId = depth === 0 ? 'root' : `L${depth}_${label}`;
        nodeCounter++;

        // Retention scoring using weighted formula
        const depthFactor = depth / maxDepth;
        const curiosity = +(3 + Math.random() * 7).toFixed(1);
        const conflict = +(2 + depthFactor * 4 + Math.random() * 4).toFixed(1);
        const novelty = +(2 + Math.random() * 6 + (depth < 2 ? 2 : 0)).toFixed(1);
        const emotion = +(2 + depthFactor * 5 + Math.random() * 3).toFixed(1);
        const stakes = +(2 + depthFactor * 6 + Math.random() * 2).toFixed(1);

        const retention_score = +(
            Math.min(curiosity, 10) * 0.35 +
            Math.min(conflict, 10) * 0.25 +
            Math.min(novelty, 10) * 0.15 +
            Math.min(emotion, 10) * 0.15 +
            Math.min(stakes, 10) * 0.10
        ).toFixed(1);

        const emotion_score = +Math.min(emotion, 10).toFixed(1);
        const cliffhanger_strength = +Math.min(conflict * 0.5 + stakes * 0.5, 10).toFixed(1);

        // Pick narrative direction
        const pool = narrativePool[Math.min(depth, narrativePool.length - 1)];
        const narrative_direction = pool[Math.floor(Math.random() * pool.length)];

        const node = {
            node_id: nodeId,
            level: depth,
            branch_label: label,
            narrative_direction,
            retention_score: Math.min(retention_score, 10),
            emotion_score: Math.min(emotion_score, 10),
            cliffhanger_strength: Math.min(cliffhanger_strength, 10),
            retention_breakdown: {
                curiosity: Math.min(curiosity, 10),
                conflict: Math.min(conflict, 10),
                novelty: Math.min(novelty, 10),
                emotion: Math.min(emotion, 10),
                stakes: Math.min(stakes, 10),
            },
            children: [],
        };

        // Stop branching at max depth
        if (depth >= maxDepth) return node;

        // Determine branch count: 3 at shallow, 2 at deep (pruning)
        const branchCount = depth >= 3 ? 2 : 3;
        const branchLabels = ['A', 'B', 'C'].slice(0, branchCount);

        // Generate children
        const children = branchLabels.map(bl => {
            const childLabel = depth === 0 ? bl : `${label}${bl.toLowerCase()}`;
            return buildNode(depth + 1, nodeId, childLabel);
        });

        // Branch pruning: at depth >= 3, keep only top-2 by retention
        if (depth >= 3 && children.length > 2) {
            children.sort((a, b) => b.retention_score - a.retention_score);
            node.children = children.slice(0, 2);
        } else {
            node.children = children;
        }

        return node;
    }

    // Build the tree
    const tree = buildNode(0, null, 'root');

    // ── Compute best path (highest avg retention root-to-leaf) ──
    let bestPath = [];
    let bestScore = -1;

    function dfs(node, path, totalRetention) {
        const currentPath = [...path, node.node_id];
        const currentTotal = totalRetention + (node.retention_score || 0);

        if (node.children.length === 0) {
            // Leaf node — evaluate path
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

    return {
        tree,
        best_path: bestPath,
        best_path_score: +bestScore.toFixed(2),
        total_nodes: nodeCounter,
    };
}


module.exports = { generateDemoCall1, generateDemoCall2, generateDemoCall3, generateDemoBranchingTree };

