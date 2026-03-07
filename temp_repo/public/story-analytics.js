/* ═══════════════════════════════════════════════════════════════════
   story-analytics.js  (v4.0 — Depth Slider + 100-Node Cap)
   ────────────────────
   True k-ary branching tree with D3.js.
   • Narrative Depth slider (1-6) controls visible levels
   • 100-node hard cap with retention-based pruning
   • Lazy rendering — only visible depth rendered
   • Horizontal layout, zoom/pan, color-coded nodes
   • Best-path glow, hover tooltips, click detail panel
═══════════════════════════════════════════════════════════════════ */

'use strict';

let analyticsData = null;
let storyId = null;
let currentDepth = 4;       // default depth
const MAX_RENDERED_NODES = 100;


// ─── Init ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    storyId = params.get('id');

    document.getElementById('sa-back-btn').addEventListener('click', () => {
        window.location.href = storyId
            ? `/story-viewer.html?id=${storyId}`
            : '/';
    });

    if (!storyId) { showError('No story ID provided.'); return; }

    try {
        const res = await fetch('/api/story/analytics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ story_id: storyId }),
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Analytics generation failed');
        analyticsData = result.data;
        renderAll();
    } catch (err) {
        showError(err.message);
    }
});

function showError(msg) {
    document.getElementById('sa-loading').innerHTML =
        `<span style="color: #f87171;">${msg}. <a href="/" style="color: #a78bfa;">Go back</a></span>`;
}


// ─── Render All ────────────────────────────────────────────────────────────

function renderAll() {
    document.getElementById('sa-loading').style.display = 'none';
    document.getElementById('sa-content').style.display = 'block';

    renderHeader();
    setupDepthSlider();
    renderDecisionTree();
    renderEmotionalArc();
    renderRetentionHeatmap();
    renderCliffhangerStrength();
}


// ─── Header ────────────────────────────────────────────────────────────────

function renderHeader() {
    document.getElementById('sa-title').textContent = analyticsData.story_title || 'Untitled Story';
    document.getElementById('sa-meta').innerHTML = `
        <span class="sa-meta-tag">📚 ${capitalize(analyticsData.genre)}</span>
        <span class="sa-meta-tag">🎭 ${capitalize(analyticsData.mood)}</span>
        <span class="sa-meta-tag">🎬 ${analyticsData.episodes?.length || 0} Episodes</span>
        <span class="sa-meta-tag">🌳 ${analyticsData.total_nodes || 0} Nodes</span>
        <span class="sa-meta-tag">⚡ Best Path: ${analyticsData.best_path_score || 0}/10</span>
    `;
}


// ═══ DEPTH SLIDER ══════════════════════════════════════════════════════════

function setupDepthSlider() {
    const slider = document.getElementById('sa-depth-slider');
    const label = document.getElementById('sa-depth-label');
    if (!slider || !label) return;

    // Determine max depth from tree
    const maxTree = getMaxDepth(analyticsData.decision_tree);
    slider.max = Math.min(maxTree + 1, 6);  // slider values are 1-based
    slider.value = Math.min(currentDepth, slider.max);
    currentDepth = parseInt(slider.value);
    label.textContent = currentDepth;

    slider.addEventListener('input', (e) => {
        currentDepth = parseInt(e.target.value);
        label.textContent = currentDepth;
        renderDecisionTree();
    });
}

function getMaxDepth(node) {
    if (!node || !node.children || node.children.length === 0) return node ? node.level : 0;
    return Math.max(...node.children.map(c => getMaxDepth(c)));
}


// ═══ TREE PRUNING — 100-NODE CAP ══════════════════════════════════════════

/**
 * Deep clone a tree, limiting to maxDepth (0-indexed),
 * and pruning lowest-retention branches to stay under nodeLimit.
 */
function pruneTree(srcNode, maxDepthLevel, nodeLimit) {
    // Phase 1: clone with depth filter
    function cloneToDepth(node, maxLvl) {
        const clone = {
            node_id: node.node_id,
            level: node.level,
            branch_label: node.branch_label,
            narrative_direction: node.narrative_direction,
            retention_score: node.retention_score,
            emotion_score: node.emotion_score,
            cliffhanger_strength: node.cliffhanger_strength,
            retention_breakdown: node.retention_breakdown,
            children: [],
        };
        if (node.level < maxLvl && node.children && node.children.length > 0) {
            clone.children = node.children.map(c => cloneToDepth(c, maxLvl));
        }
        return clone;
    }

    let tree = cloneToDepth(srcNode, maxDepthLevel);

    // Phase 2: count nodes
    function countNodes(n) {
        let c = 1;
        for (const ch of (n.children || [])) c += countNodes(ch);
        return c;
    }

    // Phase 3: iteratively prune lowest-retention leaves until under limit
    let totalNodes = countNodes(tree);
    let iterations = 0;
    while (totalNodes > nodeLimit && iterations < 500) {
        iterations++;
        // Find all parent nodes with children
        const parents = [];
        function collectParents(n) {
            if (n.children && n.children.length > 0) {
                parents.push(n);
                n.children.forEach(c => collectParents(c));
            }
        }
        collectParents(tree);

        if (parents.length === 0) break;

        // Find the leaf with the lowest retention (deepest first, then lowest score)
        let worstParent = null;
        let worstChildIdx = -1;
        let worstScore = Infinity;
        let worstLevel = -1;

        for (const p of parents) {
            for (let i = 0; i < p.children.length; i++) {
                const ch = p.children[i];
                // Only prune leaves or subtrees not on best path
                const subs = countNodes(ch);
                const score = ch.retention_score || 0;
                const lvl = ch.level;
                // Prefer removing: deepest level first, then lowest retention
                if (lvl > worstLevel || (lvl === worstLevel && score < worstScore)) {
                    // Don't prune if it's the only child
                    if (p.children.length > 1) {
                        worstParent = p;
                        worstChildIdx = i;
                        worstScore = score;
                        worstLevel = lvl;
                    }
                }
            }
        }

        if (worstParent && worstChildIdx >= 0) {
            worstParent.children.splice(worstChildIdx, 1);
            totalNodes = countNodes(tree);
        } else {
            break;
        }
    }

    return { tree, renderedNodes: countNodes(tree) };
}


// ═══ DECISION TREE — D3.js HORIZONTAL BRANCHING TREE ═══════════════════════

function renderDecisionTree() {
    const container = document.getElementById('sa-tree');
    const fullTree = analyticsData.decision_tree;
    const bestPath = new Set(analyticsData.best_path || []);

    if (!fullTree || !fullTree.node_id) {
        container.innerHTML = '<p style="color: rgba(200,212,255,0.5); padding: 40px;">No decision tree data.</p>';
        return;
    }

    // Prune tree to current depth and node limit
    const maxLvl = currentDepth - 1;  // slider is 1-based, levels are 0-based
    const { tree, renderedNodes } = pruneTree(fullTree, maxLvl, MAX_RENDERED_NODES);

    // Stats bar
    const statsEl = document.getElementById('sa-tree-stats');
    if (statsEl) {
        statsEl.innerHTML = `
            <div class="sa-tree-stats-bar">
                <span class="sa-stat-item"><span class="sa-stat-dot" style="background: #34d399;"></span>Best Path (${(analyticsData.best_path || []).length} nodes, avg ${analyticsData.best_path_score}/10)</span>
                <span class="sa-stat-item"><span class="sa-stat-dot" style="background: #34d399;"></span>8-10</span>
                <span class="sa-stat-item"><span class="sa-stat-dot" style="background: #fbbf24;"></span>5-7</span>
                <span class="sa-stat-item"><span class="sa-stat-dot" style="background: #f87171;"></span>0-4</span>
                <span class="sa-stat-item sa-stat-rendered">Showing: <b>${renderedNodes}</b> / ${analyticsData.total_nodes || 0} nodes · Depth: <b>${currentDepth}</b></span>
            </div>
        `;
    }

    // Convert to D3 hierarchy
    const root = d3.hierarchy(tree, d => d.children);

    // Layout
    const nodeW = 170, nodeH = 85;
    const dx = nodeH + 30;
    const dy = nodeW + 80;

    const treeLayout = d3.tree().nodeSize([dx, dy]);
    treeLayout(root);

    // Bounding box
    let x0 = Infinity, x1 = -Infinity;
    root.each(d => {
        if (d.x < x0) x0 = d.x;
        if (d.x > x1) x1 = d.x;
    });
    const height = x1 - x0 + dx * 2;
    const width = (root.height + 1) * dy + 120;

    // Clear container and create SVG
    container.innerHTML = '';

    const svg = d3.select(container)
        .append('svg')
        .attr('width', '100%')
        .attr('height', Math.max(600, height + 60))
        .attr('viewBox', `${-80} ${x0 - dx} ${width + 80} ${height + dx}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('font-family', "'Inter', sans-serif");

    // Zoom behavior
    const g = svg.append('g');
    const zoom = d3.zoom()
        .scaleExtent([0.15, 3])
        .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);

    // Defs for glow filter
    const defs = svg.append('defs');
    const glowFilter = defs.append('filter').attr('id', 'bestPathGlow');
    glowFilter.append('feGaussianBlur').attr('stdDeviation', 4).attr('result', 'blur');
    glowFilter.append('feComposite').attr('in', 'SourceGraphic').attr('in2', 'blur').attr('operator', 'over');

    // Shadow filter for non-best nodes
    const shadowFilter = defs.append('filter').attr('id', 'nodeShadow');
    shadowFilter.append('feDropShadow')
        .attr('dx', 0).attr('dy', 2).attr('stdDeviation', 4)
        .attr('flood-color', 'rgba(0,0,0,0.3)');

    // ── Links ──
    const linkGenerator = d3.linkHorizontal()
        .x(d => d.y)
        .y(d => d.x);

    g.selectAll('.sa-d3-link')
        .data(root.links())
        .join('path')
        .attr('class', 'sa-d3-link')
        .attr('d', linkGenerator)
        .attr('fill', 'none')
        .attr('stroke', d => {
            const sId = d.source.data.node_id;
            const tId = d.target.data.node_id;
            return (bestPath.has(sId) && bestPath.has(tId)) ? '#34d399' : 'rgba(200,212,255,0.12)';
        })
        .attr('stroke-width', d => {
            const sId = d.source.data.node_id;
            const tId = d.target.data.node_id;
            return (bestPath.has(sId) && bestPath.has(tId)) ? 3.5 : 1.5;
        })
        .attr('filter', d => {
            const sId = d.source.data.node_id;
            const tId = d.target.data.node_id;
            return (bestPath.has(sId) && bestPath.has(tId)) ? 'url(#bestPathGlow)' : 'none';
        });

    // ── Nodes ──
    const node = g.selectAll('.sa-d3-node')
        .data(root.descendants())
        .join('g')
        .attr('class', 'sa-d3-node')
        .attr('transform', d => `translate(${d.y},${d.x})`)
        .style('cursor', 'pointer')
        .on('click', (event, d) => openDetailPanel(d.data))
        .on('mouseenter', function (event, d) { showTooltip(event, d.data); })
        .on('mouseleave', hideTooltip);

    // Node background card
    const cardW = nodeW, cardH = nodeH;
    node.append('rect')
        .attr('x', -cardW / 2)
        .attr('y', -cardH / 2)
        .attr('width', cardW)
        .attr('height', cardH)
        .attr('rx', 12)
        .attr('ry', 12)
        .attr('fill', d => {
            if (bestPath.has(d.data.node_id)) return 'rgba(16,185,129,0.12)';
            return 'rgba(255,255,255,0.04)';
        })
        .attr('stroke', d => {
            if (bestPath.has(d.data.node_id)) return '#34d399';
            const r = d.data.retention_score || 0;
            if (r >= 8) return 'rgba(16,185,129,0.5)';
            if (r >= 5) return 'rgba(245,158,11,0.5)';
            return 'rgba(239,68,68,0.5)';
        })
        .attr('stroke-width', d => bestPath.has(d.data.node_id) ? 2.5 : 1.5)
        .attr('filter', d => bestPath.has(d.data.node_id) ? 'url(#bestPathGlow)' : 'url(#nodeShadow)');

    // Branch label (top left)
    node.append('text')
        .attr('x', -cardW / 2 + 12)
        .attr('y', -cardH / 2 + 18)
        .attr('fill', d => {
            const labels = { A: '#34d399', B: '#fbbf24', C: '#f87171' };
            return labels[d.data.branch_label] || '#a78bfa';
        })
        .attr('font-size', 12)
        .attr('font-weight', 800)
        .text(d => d.data.level === 0 ? 'ROOT' : d.data.branch_label);

    // Level indicator (top right)
    node.append('text')
        .attr('x', cardW / 2 - 12)
        .attr('y', -cardH / 2 + 18)
        .attr('fill', 'rgba(200,212,255,0.4)')
        .attr('font-size', 9)
        .attr('font-weight', 600)
        .attr('text-anchor', 'end')
        .text(d => `L${d.data.level}`);

    // Direction text (center, truncated)
    node.append('text')
        .attr('x', -cardW / 2 + 12)
        .attr('y', 2)
        .attr('fill', 'rgba(200,212,255,0.85)')
        .attr('font-size', 9)
        .attr('font-weight', 500)
        .text(d => truncate(d.data.narrative_direction || '', 28));

    // Scores row (bottom)
    node.append('text')
        .attr('x', -cardW / 2 + 12)
        .attr('y', cardH / 2 - 10)
        .attr('fill', d => retentionColor(d.data.retention_score))
        .attr('font-size', 10)
        .attr('font-weight', 700)
        .text(d => `⚡${(d.data.retention_score || 0).toFixed(1)}`);

    node.append('text')
        .attr('x', -4)
        .attr('y', cardH / 2 - 10)
        .attr('fill', '#fbbf24')
        .attr('font-size', 10)
        .attr('font-weight', 700)
        .text(d => `💓${(d.data.emotion_score || 0).toFixed(1)}`);

    node.append('text')
        .attr('x', cardW / 2 - 50)
        .attr('y', cardH / 2 - 10)
        .attr('fill', '#f87171')
        .attr('font-size', 10)
        .attr('font-weight', 700)
        .text(d => `🔗${(d.data.cliffhanger_strength || 0).toFixed(1)}`);

    // Best path badge
    node.filter(d => bestPath.has(d.data.node_id))
        .append('rect')
        .attr('x', cardW / 2 - 55)
        .attr('y', -cardH / 2 - 12)
        .attr('width', 52)
        .attr('height', 16)
        .attr('rx', 4)
        .attr('fill', 'rgba(16,185,129,0.25)')
        .attr('stroke', 'rgba(16,185,129,0.5)')
        .attr('stroke-width', 1);

    node.filter(d => bestPath.has(d.data.node_id))
        .append('text')
        .attr('x', cardW / 2 - 29)
        .attr('y', -cardH / 2 - 1)
        .attr('fill', '#34d399')
        .attr('font-size', 7)
        .attr('font-weight', 700)
        .attr('text-anchor', 'middle')
        .text('✅ BEST');

    // Expand indicator for nodes with hidden children
    node.filter(d => {
        // Check if the original tree node has children that were pruned
        const origNode = findNodeById(analyticsData.decision_tree, d.data.node_id);
        return origNode && origNode.children && origNode.children.length > 0 &&
            (!d.data.children || d.data.children.length === 0);
    })
        .append('text')
        .attr('x', cardW / 2 - 6)
        .attr('y', 4)
        .attr('fill', '#a78bfa')
        .attr('font-size', 14)
        .attr('font-weight', 700)
        .attr('text-anchor', 'end')
        .text('▸');

    // Add zoom controls
    const controls = d3.select(container)
        .append('div')
        .attr('class', 'sa-zoom-controls');

    controls.append('button').attr('class', 'sa-zoom-btn').text('+')
        .on('click', () => svg.transition().call(zoom.scaleBy, 1.3));
    controls.append('button').attr('class', 'sa-zoom-btn').text('−')
        .on('click', () => svg.transition().call(zoom.scaleBy, 0.7));
    controls.append('button').attr('class', 'sa-zoom-btn').text('⟲')
        .on('click', () => svg.transition().call(zoom.transform, d3.zoomIdentity));
}

/**
 * Find a node by ID in the full (unpruned) tree.
 */
function findNodeById(node, id) {
    if (!node) return null;
    if (node.node_id === id) return node;
    for (const ch of (node.children || [])) {
        const found = findNodeById(ch, id);
        if (found) return found;
    }
    return null;
}


// ─── Tooltip ───────────────────────────────────────────────────────────────

let tooltipEl = null;

function showTooltip(event, nodeData) {
    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'sa-d3-tooltip';
        document.body.appendChild(tooltipEl);
    }
    tooltipEl.innerHTML = `
        <div style="font-weight: 700; margin-bottom: 4px; color: #f0f4ff;">
            ${nodeData.level === 0 ? 'Story Start' : nodeData.branch_label}
            <span style="color: rgba(200,212,255,0.4); font-weight: 500; margin-left: 6px;">Level ${nodeData.level}</span>
        </div>
        <div style="color: rgba(200,212,255,0.8); font-size: 12px; line-height: 1.5;">
            ${nodeData.narrative_direction || 'No description'}
        </div>
        <div style="margin-top: 6px; color: rgba(200,212,255,0.5); font-size: 11px;">
            Retention: ${(nodeData.retention_score || 0).toFixed(1)} · Emotion: ${(nodeData.emotion_score || 0).toFixed(1)} · Cliff: ${(nodeData.cliffhanger_strength || 0).toFixed(1)}
        </div>
    `;
    tooltipEl.style.display = 'block';
    tooltipEl.style.left = (event.pageX + 16) + 'px';
    tooltipEl.style.top = (event.pageY - 16) + 'px';
}

function hideTooltip() {
    if (tooltipEl) tooltipEl.style.display = 'none';
}


// ─── Detail Panel ──────────────────────────────────────────────────────────

function openDetailPanel(nodeData) {
    let panel = document.getElementById('sa-detail-panel');
    let backdrop = document.getElementById('sa-detail-backdrop');

    if (!panel) {
        document.body.insertAdjacentHTML('beforeend', `
            <div class="sa-detail-backdrop" id="sa-detail-backdrop"></div>
            <div class="sa-detail-panel" id="sa-detail-panel">
                <button class="sa-detail-close" id="sa-detail-close">✕</button>
                <div id="sa-detail-content"></div>
            </div>
        `);
        panel = document.getElementById('sa-detail-panel');
        backdrop = document.getElementById('sa-detail-backdrop');
        document.getElementById('sa-detail-close').addEventListener('click', closeDetailPanel);
        backdrop.addEventListener('click', closeDetailPanel);
    }

    const isBestPath = (analyticsData.best_path || []).includes(nodeData.node_id);
    const branchColors = { A: '#34d399', B: '#fbbf24', C: '#f87171', root: '#a78bfa' };
    const color = branchColors[nodeData.branch_label] || '#a78bfa';
    const branchBg = { A: 'rgba(16,185,129,0.2)', B: 'rgba(245,158,11,0.2)', C: 'rgba(239,68,68,0.2)', root: 'rgba(167,139,250,0.2)' };
    const bg = branchBg[nodeData.branch_label] || 'rgba(167,139,250,0.2)';

    const breakdown = nodeData.retention_breakdown || {};
    // If breakdown is missing, look it up from full tree
    const fullNode = findNodeById(analyticsData.decision_tree, nodeData.node_id);
    const bd = Object.keys(breakdown).length > 0 ? breakdown : (fullNode?.retention_breakdown || {});

    document.getElementById('sa-detail-content').innerHTML = `
        <div class="sa-detail-branch-letter" style="background: ${bg}; color: ${color};">
            ${nodeData.level === 0 ? '🌳' : nodeData.branch_label}
        </div>
        <div class="sa-detail-title">${nodeData.level === 0 ? 'Story Root' : `Node: ${nodeData.node_id}`}</div>
        <div class="sa-detail-selected-badge ${isBestPath ? 'yes' : 'no'}">
            ${isBestPath ? '✅ BEST RETENTION PATH' : `Level ${nodeData.level} Node`}
        </div>
        <div class="sa-detail-direction">${nodeData.narrative_direction || 'No description.'}</div>

        <div class="sa-detail-metrics">
            <div class="sa-detail-metric sa-metric-retention">
                <div class="sa-detail-metric-value">${(nodeData.retention_score || 0).toFixed(1)}</div>
                <div class="sa-detail-metric-label">Retention</div>
            </div>
            <div class="sa-detail-metric sa-metric-emotion">
                <div class="sa-detail-metric-value">${(nodeData.emotion_score || 0).toFixed(1)}</div>
                <div class="sa-detail-metric-label">Emotion</div>
            </div>
            <div class="sa-detail-metric sa-metric-cliff">
                <div class="sa-detail-metric-value">${(nodeData.cliffhanger_strength || 0).toFixed(1)}</div>
                <div class="sa-detail-metric-label">Cliffhanger</div>
            </div>
        </div>

        ${Object.keys(bd).length > 0 ? `
            <div class="sa-detail-curve-title">📊 Retention Breakdown</div>
            <div class="sa-retention-breakdown">
                ${renderBreakdownBars(bd)}
            </div>
        ` : ''}

        <div style="margin-top: 20px; font-size: 12px; color: rgba(200,212,255,0.4);">
            Node ID: ${nodeData.node_id} · Level: ${nodeData.level} · Children: ${(nodeData.children || []).length}
        </div>
    `;

    panel.classList.add('open');
    backdrop.classList.add('open');
}

function closeDetailPanel() {
    const panel = document.getElementById('sa-detail-panel');
    const backdrop = document.getElementById('sa-detail-backdrop');
    if (panel) panel.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
}

function renderBreakdownBars(breakdown) {
    const items = [
        { label: 'Curiosity', value: breakdown.curiosity || 0, weight: '35%', color: '#a78bfa' },
        { label: 'Conflict', value: breakdown.conflict || 0, weight: '25%', color: '#ef4444' },
        { label: 'Novelty', value: breakdown.novelty || 0, weight: '15%', color: '#3b82f6' },
        { label: 'Emotion', value: breakdown.emotion || 0, weight: '15%', color: '#fbbf24' },
        { label: 'Stakes', value: breakdown.stakes || 0, weight: '10%', color: '#34d399' },
    ];

    return items.map(item => `
        <div class="sa-breakdown-row">
            <div class="sa-breakdown-label">${item.label} <span style="color: rgba(200,212,255,0.3);">(${item.weight})</span></div>
            <div class="sa-breakdown-track">
                <div class="sa-breakdown-fill" style="width: ${(item.value / 10) * 100}%; background: ${item.color};">
                    ${item.value.toFixed(1)}
                </div>
            </div>
        </div>
    `).join('');
}


// ═══ EMOTIONAL ARC (SVG LINE CHART) ════════════════════════════════════════

function renderEmotionalArc() {
    const container = document.getElementById('sa-arc-chart');
    const episodes = analyticsData.episodes || [];
    if (episodes.length === 0) { container.innerHTML = '<p style="color: rgba(200,212,255,0.5);">No episode data.</p>'; return; }

    const W = Math.max(episodes.length * 120, 700);
    const H = 280;
    const padL = 40, padR = 30, padT = 40, padB = 50;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const maxVal = 10;

    const points = episodes.map((ep, i) => {
        const x = padL + (i / Math.max(episodes.length - 1, 1)) * chartW;
        const y = padT + chartH - (ep.emotion_level / maxVal) * chartH;
        return { x, y, score: ep.emotion_level, label: `Ep ${ep.episode_number}`, emotion: ep.dominant_emotion };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = linePath + ` L ${points[points.length - 1].x} ${padT + chartH} L ${points[0].x} ${padT + chartH} Z`;

    let gridLines = '';
    for (let v = 0; v <= maxVal; v += 2) {
        const y = padT + chartH - (v / maxVal) * chartH;
        gridLines += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" class="sa-arc-grid"/>`;
        gridLines += `<text x="${padL - 8}" y="${y + 4}" class="sa-arc-axis-label" text-anchor="end">${v}</text>`;
    }

    const dotsHTML = points.map(p => `
        <circle cx="${p.x}" cy="${p.y}" r="6" class="sa-arc-dot">
            <title>${p.label}: ${p.score}/10 (${p.emotion})</title>
        </circle>
        <text x="${p.x}" y="${p.y - 14}" class="sa-arc-score-label">${p.score}</text>
        <text x="${p.x}" y="${padT + chartH + 20}" class="sa-arc-label">${p.label}</text>
    `).join('');

    container.innerHTML = `
        <svg class="sa-arc-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="min-width: ${W}px;">
            <defs>
                <linearGradient id="arcGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.4"/>
                    <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.0"/>
                </linearGradient>
            </defs>
            ${gridLines}
            <path d="${areaPath}" fill="url(#arcGradient)" class="sa-arc-area"/>
            <path d="${linePath}" class="sa-arc-line"/>
            ${dotsHTML}
        </svg>
    `;
}


// ═══ RETENTION HEATMAP ═════════════════════════════════════════════════════

function renderRetentionHeatmap() {
    const container = document.getElementById('sa-heatmap');
    const episodes = analyticsData.episodes || [];
    const blockLabels = ['0-10s', '10-30s', '30-60s', '60-90s'];

    let html = `<div class="sa-heatmap-grid" style="grid-template-columns: 80px repeat(${blockLabels.length}, 1fr);">`;
    html += '<div class="sa-heatmap-header"><span>Episode</span>';
    blockLabels.forEach(l => { html += `<span>${l}</span>`; });
    html += '</div>';

    episodes.forEach(ep => {
        const blocks = ep.retention_blocks || [];
        html += '<div class="sa-heatmap-row">';
        html += `<div class="sa-heatmap-ep-label">Ep ${ep.episode_number}</div>`;
        blockLabels.forEach((_, bi) => {
            const block = blocks[bi] || { overall: 0, risk: 'HIGH', reason: '' };
            const riskClass = getRiskClass(block.risk || block.overall);
            html += `<div class="sa-heatmap-cell ${riskClass}" data-reason="${block.reason || ''}">
                <span class="sa-heat-score">${block.overall}</span>
                <span class="sa-heat-risk">${(block.risk || '').toUpperCase()}</span>
            </div>`;
        });
        html += '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
}

function getRiskClass(riskOrScore) {
    if (typeof riskOrScore === 'string') {
        const r = riskOrScore.toUpperCase();
        if (r === 'HIGH') return 'sa-heat-high';
        if (r === 'MEDIUM') return 'sa-heat-medium';
        return 'sa-heat-safe';
    }
    return riskOrScore < 4 ? 'sa-heat-high' : riskOrScore < 6 ? 'sa-heat-medium' : 'sa-heat-safe';
}


// ═══ CLIFFHANGER STRENGTH ══════════════════════════════════════════════════

function renderCliffhangerStrength() {
    const container = document.getElementById('sa-cliff');
    const episodes = analyticsData.episodes || [];

    container.innerHTML = episodes.map(ep => {
        const score = ep.cliffhanger_score || 0;
        const sub = ep.sub_scores || {};
        const totalClass = score >= 7 ? 'sa-cliff-high' : score >= 5 ? 'sa-cliff-mid' : 'sa-cliff-low';
        return `
            <div class="sa-cliff-card">
                <div class="sa-cliff-header">
                    <span class="sa-cliff-ep">Ep ${ep.episode_number}: ${ep.episode_title || ''}</span>
                    <span class="sa-cliff-total ${totalClass}">${score}/10</span>
                </div>
                <div class="sa-cliff-bars">
                    ${renderCliffBar('Curiosity', sub.curiosity || 0, 'curiosity')}
                    ${renderCliffBar('Shock', sub.shock || 0, 'shock')}
                    ${renderCliffBar('Stakes', sub.stakes || 0, 'stakes')}
                    ${renderCliffBar('Urgency', sub.urgency || 0, 'urgency')}
                </div>
            </div>
        `;
    }).join('');
}

function renderCliffBar(label, value, type) {
    const pct = (value / 10) * 100;
    return `<div class="sa-cliff-bar-row">
        <div class="sa-cliff-bar-label">${label}</div>
        <div class="sa-cliff-bar-track">
            <div class="sa-cliff-bar-fill sa-cliff-fill-${type}" style="width: ${pct}%;">${value}</div>
        </div>
    </div>`;
}


// ─── Helpers ───────────────────────────────────────────────────────────────

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function truncate(s, max) { return s.length > max ? s.substring(0, max) + '…' : s; }

function retentionColor(score) {
    if (score >= 8) return '#34d399';
    if (score >= 5) return '#fbbf24';
    return '#f87171';
}
