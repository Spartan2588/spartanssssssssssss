/* ═══════════════════════════════════════════════════════════════════
   story-viewer.js
   ─────────────────
   Frontend logic for the StoryForge AI Story Viewer.
   Handles: data loading, tab rendering, retention heatmap,
            emotional arc chart, momentum chart, edit chatbar.
═══════════════════════════════════════════════════════════════════ */

'use strict';

let storyData = null;
let storyId = null;
let selectedEpisode = null;
let editActions = [];
let isEditing = false;

// ─── Init ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    storyId = params.get('id');

    if (!storyId) {
        document.getElementById('sv-loading').innerHTML =
            '<span style="color: #ef4444;">No story ID provided. <a href="/" style="color: var(--accent-2);">Go back</a></span>';
        return;
    }

    try {
        // Load story + edit actions in parallel
        const [storyRes, actionsRes] = await Promise.all([
            fetch(`/api/story/${storyId}`).then(r => r.json()),
            fetch('/api/story/edit-actions').then(r => r.json()),
        ]);

        if (!storyRes.success) throw new Error(storyRes.error || 'Failed to load story');

        storyData = storyRes.data;
        editActions = actionsRes.actions || [];

        renderViewer();
    } catch (err) {
        document.getElementById('sv-loading').innerHTML =
            `<span style="color: #ef4444;">${err.message}. <a href="/" style="color: var(--accent-2);">Go back</a></span>`;
    }
});


// ─── Render All ────────────────────────────────────────────────────────────

function renderViewer() {
    document.getElementById('sv-loading').style.display = 'none';
    document.getElementById('sv-content').style.display = 'block';

    // Show Intelligence Map button
    const intelBtn = document.getElementById('sv-intel-btn');
    if (intelBtn && storyId) {
        intelBtn.style.display = 'inline-block';
        intelBtn.addEventListener('click', () => {
            window.location.href = `/story-analytics.html?id=${storyId}`;
        });
    }

    renderHeader();
    renderEpisodes();
    renderCharacters();
    renderEmotionalArc();
    renderRetention();
    renderTwists();
    renderHashtags();
    setupTabs();
    setupChatbar();
}


// ─── Header ────────────────────────────────────────────────────────────────

function renderHeader() {
    document.getElementById('sv-story-title').textContent = storyData.story_title || 'Untitled Story';
    const tags = document.getElementById('sv-meta-tags');
    const mode = storyData._meta?.mode || 'unknown';
    tags.innerHTML = `
        <span class="sv-tag">📚 ${capitalize(storyData.genre)}</span>
        <span class="sv-tag">🎭 ${capitalize(storyData.mood)}</span>
        <span class="sv-tag">🎬 ${storyData.episodes?.length || 0} Episodes</span>
        <span class="sv-tag">${mode === 'demo' ? '⚡ Demo' : '🤖 Live'} Mode</span>
        <span class="sv-tag">v${storyData._meta?.engine_version || '?'}</span>
    `;
}


// ─── Episodes ──────────────────────────────────────────────────────────────

function renderEpisodes() {
    const container = document.getElementById('sv-episodes-list');
    container.innerHTML = '';

    (storyData.episodes || []).forEach(ep => {
        const momentumClass = ep.momentum_score < 5 ? 'risk' : '';
        const retentionHTML = renderRetentionBlocks(ep.retention_blocks || []);

        const div = document.createElement('div');
        div.className = 'sv-episode';
        div.innerHTML = `
            <div class="sv-ep-header" onclick="toggleEpisode(this)">
                <div class="sv-ep-left">
                    <div class="sv-ep-number">${ep.episode_number}</div>
                    <div>
                        <div class="sv-ep-title">${ep.episode_title || 'Episode ' + ep.episode_number}</div>
                        <div class="sv-ep-purpose">${ep.purpose || ''}</div>
                    </div>
                </div>
                <div class="sv-ep-badges">
                    <span class="sv-ep-badge sv-badge-emotion">💓 ${ep.emotion_level}/10</span>
                    <span class="sv-ep-badge sv-badge-cliff">🔗 ${ep.cliffhanger_score}/10</span>
                    <span class="sv-ep-badge sv-badge-momentum ${momentumClass}">🚀 ${ep.momentum_score}/10</span>
                    <span class="sv-ep-toggle">▼</span>
                </div>
            </div>
            <div class="sv-ep-body">
                <div class="sv-ep-script">${ep.script || 'No script available.'}</div>
                <div class="sv-ep-cliff"><strong>Cliffhanger:</strong> ${ep.cliffhanger || 'N/A'}</div>
                ${ep.score_reason ? `<div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 8px;">Score reason: ${ep.score_reason}</div>` : ''}
                ${retentionHTML}
                <button class="sv-btn sv-btn-accent" style="margin-top: 14px;" onclick="selectEpisodeForEdit(${ep.episode_number})">✏️ Edit This Episode</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function toggleEpisode(headerEl) {
    const ep = headerEl.closest('.sv-episode');
    ep.classList.toggle('open');
}

function renderRetentionBlocks(blocks) {
    if (!blocks || blocks.length === 0) return '';
    return `
        <div class="sv-retention-section">
            <div class="sv-retention-label">📊 Retention Analysis</div>
            <div class="sv-retention-grid">
                ${blocks.map(b => `
                    <div class="sv-retention-block risk-${(b.risk || 'safe').toLowerCase()}">
                        <div class="sv-ret-block-label">${b.block}</div>
                        <div class="sv-ret-score">${b.overall}</div>
                        <div class="sv-ret-risk">${b.risk || 'SAFE'}</div>
                        <div class="sv-ret-reason">${b.reason || ''}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}


// ─── Characters ────────────────────────────────────────────────────────────

function renderCharacters() {
    const container = document.getElementById('sv-characters-list');
    container.innerHTML = (storyData.characters || []).map(c => `
        <div class="sv-card">
            <div class="sv-card-title">${c.name}</div>
            <div class="sv-card-detail"><strong>Traits:</strong> ${c.personality_traits || 'N/A'}</div>
            <div class="sv-card-detail"><strong>Motivation:</strong> ${c.motivation || 'N/A'}</div>
            <div class="sv-card-detail"><strong>Hidden Flaw:</strong> ${c.hidden_flaw || 'N/A'}</div>
            <div class="sv-card-detail"><strong>Internal Conflict:</strong> ${c.internal_conflict || 'N/A'}</div>
        </div>
    `).join('');
}


// ─── Emotional Arc ─────────────────────────────────────────────────────────

function renderEmotionalArc() {
    const container = document.getElementById('sv-arc-container');
    const episodes = storyData.episodes || [];
    const arcAnalysis = storyData.emotional_arc_analysis || {};

    const summary = arcAnalysis.engagement_graph || '';
    const maxVal = 10;

    container.innerHTML = `
        <div class="sv-arc-summary">${summary}</div>
        <div class="sv-arc-bars">
            ${episodes.map(ep => {
        const pct = (ep.emotion_level / maxVal) * 100;
        const color = getEmotionColor(ep.emotion_level);
        return `
                    <div class="sv-arc-bar-col">
                        <div class="sv-arc-score">${ep.emotion_level}</div>
                        <div class="sv-arc-bar" style="height: ${pct}%; background: ${color};"></div>
                        <div class="sv-arc-label">Ep ${ep.episode_number}</div>
                    </div>
                `;
    }).join('')}
        </div>
    `;

    // Momentum chart
    renderMomentumChart();
}

function renderMomentumChart() {
    const container = document.getElementById('sv-momentum-container');
    const episodes = storyData.episodes || [];

    container.innerHTML = `
        <div class="sv-momentum-title">🚀 Story Momentum Score</div>
        <div class="sv-momentum-bars">
            ${episodes.map(ep => {
        const pct = (ep.momentum_score / 10) * 100;
        const color = ep.momentum_score < 5 ? '#ef4444' : ep.momentum_score < 7 ? '#f59e0b' : 'var(--green)';
        return `
                    <div class="sv-momentum-bar-col">
                        <div class="sv-momentum-score" style="color: ${color}">${ep.momentum_score}</div>
                        <div class="sv-momentum-bar" style="height: ${pct}%; background: ${color};"></div>
                        <div class="sv-momentum-label">Ep ${ep.episode_number}</div>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}


// ─── Retention Tab ─────────────────────────────────────────────────────────

function renderRetention() {
    const container = document.getElementById('sv-retention-list');
    const episodes = storyData.episodes || [];

    container.innerHTML = episodes.map(ep => `
        <div class="sv-card">
            <div class="sv-card-title">Episode ${ep.episode_number}: ${ep.episode_title || ''}</div>
            ${renderRetentionBlocks(ep.retention_blocks || [])}
        </div>
    `).join('');
}


// ─── Twists (Netflix 3-Layer) ──────────────────────────────────────────────

function renderTwists() {
    const container = document.getElementById('sv-twists-list');
    const layerLabels = {
        expectation: { label: 'Layer 1 — Expectation Twist', class: 'sv-twist-expectation' },
        identity: { label: 'Layer 2 — Identity Twist', class: 'sv-twist-identity' },
        moral: { label: 'Layer 3 — Moral Twist', class: 'sv-twist-moral' },
    };

    container.innerHTML = (storyData.plot_twists || []).map(tw => {
        const info = layerLabels[tw.twist_type] || { label: tw.twist_type, class: 'sv-twist-expectation' };
        return `
            <div class="sv-card">
                <span class="sv-twist-type ${info.class}">${info.label}</span>
                <div class="sv-card-title">${tw.twist || 'No twist'}</div>
                <div class="sv-card-detail"><strong>Setup:</strong> ${tw.setup || 'N/A'}</div>
                <div class="sv-card-detail"><strong>Reveal:</strong> ${tw.reveal || 'N/A'}</div>
                <div class="sv-card-detail"><strong>Impact:</strong> ${tw.impact || 'N/A'}</div>
            </div>
        `;
    }).join('');
}


// ─── Hashtags ──────────────────────────────────────────────────────────────

function renderHashtags() {
    const container = document.getElementById('sv-hashtag-cloud');
    container.innerHTML = (storyData.hashtags || []).map(h => `
        <span class="sv-hashtag" onclick="navigator.clipboard.writeText('${h}').then(() => showToast('Copied: ${h}', 'success'))">${h}</span>
    `).join('');
}


// ─── Tabs ──────────────────────────────────────────────────────────────────

function setupTabs() {
    document.querySelectorAll('.sv-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.sv-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.sv-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
        });
    });
}


// ─── Edit Chatbar ──────────────────────────────────────────────────────────

function setupChatbar() {
    const quickContainer = document.getElementById('sv-quick-actions');
    quickContainer.innerHTML = editActions.map(a =>
        `<button class="sv-quick-btn" data-action="${a.id}" title="${a.instruction}" disabled>${a.icon} ${a.label}</button>`
    ).join('');

    // Quick action clicks
    quickContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.sv-quick-btn');
        if (!btn || btn.disabled || isEditing) return;
        applyEdit(btn.dataset.action, null);
    });

    // Custom prompt
    const sendBtn = document.getElementById('sv-send-edit');
    const input = document.getElementById('sv-custom-prompt');

    sendBtn.addEventListener('click', () => {
        if (!input.value.trim() || isEditing) return;
        applyEdit(null, input.value.trim());
        input.value = '';
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !isEditing) {
            sendBtn.click();
        }
    });

    input.addEventListener('input', () => {
        sendBtn.disabled = !input.value.trim() || !selectedEpisode;
    });
}

function selectEpisodeForEdit(episodeNumber) {
    selectedEpisode = episodeNumber;
    const ep = (storyData.episodes || []).find(e => e.episode_number === episodeNumber);
    if (!ep) return;

    const chatbar = document.getElementById('sv-chatbar');
    chatbar.classList.remove('hidden');

    document.getElementById('sv-chatbar-episode').textContent =
        `Editing: Episode ${ep.episode_number} — ${ep.episode_title || ''}`;

    // Enable buttons
    document.querySelectorAll('.sv-quick-btn').forEach(b => b.disabled = false);
    document.getElementById('sv-send-edit').disabled = !document.getElementById('sv-custom-prompt').value.trim();
}

async function applyEdit(actionId, customPrompt) {
    if (!selectedEpisode || isEditing) return;

    isEditing = true;
    setEditingState(true);

    try {
        const res = await fetch('/api/story/edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                story_id: storyId,
                episode_number: selectedEpisode,
                action_id: actionId,
                custom_prompt: customPrompt,
            }),
        });

        const result = await res.json();
        if (!result.success) throw new Error(result.error);

        // Update local data
        const idx = storyData.episodes.findIndex(e => e.episode_number === selectedEpisode);
        if (idx >= 0) {
            Object.assign(storyData.episodes[idx], result.data);
        }

        renderEpisodes();
        showToast('✓ Episode updated successfully', 'success');

    } catch (err) {
        showToast(`✕ Edit failed: ${err.message}`, 'error');
    } finally {
        isEditing = false;
        setEditingState(false);
    }
}

function setEditingState(editing) {
    document.querySelectorAll('.sv-quick-btn').forEach(b => b.disabled = editing);
    document.getElementById('sv-send-edit').disabled = editing;
    document.getElementById('sv-custom-prompt').disabled = editing;
}


// ─── Toast Notifications ───────────────────────────────────────────────────

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `sv-toast sv-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}


// ─── Helpers ───────────────────────────────────────────────────────────────

function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function getEmotionColor(level) {
    if (level <= 3) return '#ef4444';
    if (level <= 5) return '#f59e0b';
    if (level <= 7) return 'var(--accent-2)';
    return 'var(--green)';
}
