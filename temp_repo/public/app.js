/* ───────────────────────────────────────────────────────────────────────────
   app.js  —  StoryForge AI Frontend Controller
   Handles:
     • Google One Tap / popup sign-in
     • Token posting to backend
     • Session persistence check on page load
     • StoryForge wizard (3-step input flow)
     • Story generation API call
     • Results rendering (episodes, characters, emotional arc, twists, hashtags)
     • Logout
─────────────────────────────────────────────────────────────────────────── */

'use strict';

// ─── Config ──────────────────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = '263914103895-mcbbpm3o1qgjt1e9gr10ja2ltsq5jl1e.apps.googleusercontent.com';
const API_BASE = '/api';

// ─── DOM References ──────────────────────────────────────────────────────────
const authScreen = document.getElementById('auth-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const googleSignInBtn = document.getElementById('google-signin-btn');
const authLoading = document.getElementById('auth-loading');
const authError = document.getElementById('auth-error');

// Dashboard elements
const navAvatar = document.getElementById('nav-avatar');
const navName = document.getElementById('nav-name');

// ─── State ───────────────────────────────────────────────────────────────────
let currentUser = {
    id: 'demo-user-123',
    email: 'demo@storyforge.ai',
    name: 'Demo User',
    avatar: 'https://ui-avatars.com/api/?name=Demo+User&background=6c63ff&color=fff&size=200&bold=true'
};
let currentCharMode = 'AI_GENERATED';
let storyData = null;

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN TRANSITION
// ─────────────────────────────────────────────────────────────────────────────
function showScreen(screenEl) {
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
    });
    screenEl.classList.add('active');
    document.body.style.overflow = screenEl === dashboardScreen ? 'auto' : 'hidden';
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR & LOADING STATE (Auth)
// ─────────────────────────────────────────────────────────────────────────────
function showError(message) {
    authError.textContent = message;
    authError.classList.remove('hidden');
    authLoading.classList.add('hidden');
    googleSignInBtn.disabled = false;
}

function showLoading() {
    authError.classList.add('hidden');
    authLoading.classList.remove('hidden');
    googleSignInBtn.disabled = true;
}

function hideLoading() {
    authLoading.classList.add('hidden');
    googleSignInBtn.disabled = false;
}

// ─────────────────────────────────────────────────────────────────────────────
// POPULATE DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function populateDashboard(user) {
    currentUser = user;

    const avatarSrc = user.avatar || generateAvatarUrl(user.name);

    // Navbar
    navAvatar.src = avatarSrc;
    navAvatar.alt = user.name || 'User';
    navName.textContent = user.name || user.email;
}

function generateAvatarUrl(name) {
    const initials = (name || 'U')
        .split(' ')
        .map(p => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=6c63ff&color=fff&size=200&bold=true`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEND TOKEN TO BACKEND
// ─────────────────────────────────────────────────────────────────────────────
async function sendTokenToBackend(idToken) {
    const response = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Authentication failed.');
    }

    return data.user;
}

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE SIGN-IN
// ─────────────────────────────────────────────────────────────────────────────
async function handleGoogleSignIn() {
    if (typeof google === 'undefined' || !google.accounts) {
        showError('Google Sign-In is not available. Please check your internet connection and refresh.');
        return;
    }

    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
        showError('⚙️ Developer: Replace GOOGLE_CLIENT_ID in public/app.js with your real Google Client ID.');
        return;
    }

    showLoading();

    try {
        const idToken = await new Promise((resolve, reject) => {
            google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                ux_mode: 'popup',
                callback: (response) => {
                    if (response && response.credential) {
                        resolve(response.credential);
                    } else {
                        reject(new Error('Sign-in was cancelled or no credential was returned.'));
                    }
                },
                auto_select: false,
                cancel_on_tap_outside: false,
            });

            google.accounts.id.prompt((notification) => {
                const reason = notification.getNotDisplayedReason?.() || '';

                if (notification.isNotDisplayed()) {
                    reject(new Error(
                        reason === 'suppressed_by_user'
                            ? 'Sign-in was suppressed. Please clear cookies and try again.'
                            : `Google sign-in could not be displayed (${reason || 'unknown reason'}). Make sure pop-ups are allowed.`
                    ));
                } else if (notification.isDismissedMoment()) {
                    const dismissedReason = notification.getDismissedReason?.() || '';
                    if (dismissedReason === 'credential_returned') return;
                    reject(new Error('Sign-in popup was closed. Please try again.'));
                }
            });
        });

        const user = await sendTokenToBackend(idToken);
        populateDashboard(user);
        showScreen(dashboardScreen);

    } catch (err) {
        console.error('[handleGoogleSignIn]', err);
        showError(err.message || 'Sign-in failed. Please try again.');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────────────────────
async function handleLogout() {
    try {
        await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            credentials: 'include',
        });
    } catch (err) {
        console.warn('Logout request failed:', err);
    }

    if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.disableAutoSelect();
        if (currentUser?.email) {
            google.accounts.id.revoke(currentUser.email, () => { });
        }
    }

    currentUser = null;
    showScreen(authScreen);
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION CHECK ON PAGE LOAD
// ─────────────────────────────────────────────────────────────────────────────
async function checkExistingSession() {
    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            credentials: 'include',
        });

        if (response.ok) {
            const data = await response.json();
            if (data.user) {
                populateDashboard(data.user);
                showScreen(dashboardScreen);
                return true;
            }
        }
    } catch (err) {
        console.log('No existing session found.');
    }

    showScreen(authScreen);
    return false;
}


// ═════════════════════════════════════════════════════════════════════════════
// ███████╗████████╗ ██████╗ ██████╗ ██╗   ██╗███████╗ ██████╗ ██████╗  ██████╗ ███████╗
// ██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗╚██╗ ██╔╝██╔════╝██╔═══██╗██╔══██╗██╔════╝ ██╔════╝
// ███████╗   ██║   ██║   ██║██████╔╝ ╚████╔╝ █████╗  ██║   ██║██████╔╝██║  ███╗█████╗
// ╚════██║   ██║   ██║   ██║██╔══██╗  ╚██╔╝  ██╔══╝  ██║   ██║██╔══██╗██║   ██║██╔══╝
// ███████║   ██║   ╚██████╔╝██║  ██║   ██║   ██║     ╚██████╔╝██║  ██║╚██████╔╝███████╗
// ╚══════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝      ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝
// ═════════════════════════════════════════════════════════════════════════════

// ─── Wizard State ────────────────────────────────────────────────────────────
let wizardStep = 1;

function setWizardStep(step) {
    wizardStep = step;

    // Update step indicators
    document.querySelectorAll('.sf-step').forEach(el => {
        const s = parseInt(el.dataset.step);
        el.classList.toggle('active', s === step);
        el.classList.toggle('done', s < step);
    });

    // Update step lines
    const lines = document.querySelectorAll('.sf-step-line');
    lines.forEach((line, i) => {
        line.classList.toggle('done', (i + 1) < step);
    });

    // Show correct panel
    document.querySelectorAll('.sf-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById(`sf-step${step}`);
    if (panel) panel.classList.add('active');
}


// ─── Character Mode Toggle ──────────────────────────────────────────────────
function setupCharacterMode() {
    const modeAI = document.getElementById('sf-mode-ai');
    const modeUser = document.getElementById('sf-mode-user');

    modeAI.addEventListener('click', () => {
        currentCharMode = 'AI_GENERATED';
        modeAI.classList.add('active');
        modeUser.classList.remove('active');
    });

    modeUser.addEventListener('click', () => {
        currentCharMode = 'USER_DEFINED';
        modeUser.classList.add('active');
        modeAI.classList.remove('active');
    });
}


// ─── Build Character Input Cards ─────────────────────────────────────────────
function buildCharacterCards() {
    const numChars = parseInt(document.getElementById('sf-num-chars').value) || 3;
    const container = document.getElementById('sf-characters-list');
    container.innerHTML = '';

    for (let i = 0; i < numChars; i++) {
        const card = document.createElement('div');
        card.className = 'sf-char-card';
        card.innerHTML = `
            <div class="sf-char-num">Character ${i + 1}</div>
            <div class="sf-field">
                <label class="sf-label">Name</label>
                <input type="text" class="sf-input sf-char-name" placeholder="Enter character name" data-index="${i}" />
            </div>
            <div class="sf-field">
                <label class="sf-label">Personality Traits</label>
                <input type="text" class="sf-input sf-char-traits" placeholder="e.g. determined, witty, secretive" data-index="${i}" />
            </div>
        `;
        container.appendChild(card);
    }
}


// ─── Wizard Navigation ──────────────────────────────────────────────────────
function setupWizardNav() {
    // Step 1 → Step 2
    document.getElementById('sf-next1').addEventListener('click', () => {
        setWizardStep(2);

        // Update Step 2 button text based on character mode
        const next2Text = document.getElementById('sf-next2-text');
        if (currentCharMode === 'USER_DEFINED') {
            next2Text.textContent = 'Next: Characters';
        } else {
            next2Text.textContent = 'Generate Story';
        }
    });

    // Step 2 → Step 3 or Generate
    document.getElementById('sf-next2').addEventListener('click', () => {
        const desc = document.getElementById('sf-description').value.trim();
        if (desc.length < 10) {
            alert('Please provide a story description (minimum 10 characters).');
            return;
        }

        if (currentCharMode === 'USER_DEFINED') {
            buildCharacterCards();
            setWizardStep(3);
        } else {
            generateStory();
        }
    });

    // Step 2 ← Step 1
    document.getElementById('sf-back2').addEventListener('click', () => {
        setWizardStep(1);
    });

    // Step 3 ← Step 2
    document.getElementById('sf-back3').addEventListener('click', () => {
        setWizardStep(2);
    });

    // Step 3 → Generate
    document.getElementById('sf-generate').addEventListener('click', () => {
        generateStory();
    });

    // New Story button
    document.getElementById('sf-new-story').addEventListener('click', () => {
        resetToWizard();
    });
}


// ─── Template Buttons ────────────────────────────────────────────────────────
function setupTemplates() {
    document.querySelectorAll('.sf-template-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('sf-description').value = btn.dataset.template;
        });
    });
}


// ─── Tab Navigation ─────────────────────────────────────────────────────────
function setupTabs() {
    document.querySelectorAll('.sf-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;

            document.querySelectorAll('.sf-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            document.querySelectorAll('.sf-tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`tab-${target}`).classList.add('active');
        });
    });
}


// ─── Loading Animation ──────────────────────────────────────────────────────
function showStoryLoading() {
    document.getElementById('sf-wizard').classList.add('hidden');
    document.getElementById('sf-results').classList.add('hidden');
    document.getElementById('sf-loading').classList.remove('hidden');

    // Animate steps
    const steps = ['ls-1', 'ls-2', 'ls-3', 'ls-4', 'ls-5', 'ls-6'];
    const messages = [
        'Building story foundation & characters…',
        'Decomposing into cinematic episodes…',
        'Analyzing emotional progression…',
        'Scoring cliffhanger strength…',
        'Generating plot twists (Call 2)…',
        'Optimizing hashtags for discovery…',
    ];

    let current = 0;
    const statusEl = document.getElementById('sf-loading-status');

    // Reset all steps
    steps.forEach(id => {
        const el = document.getElementById(id);
        el.classList.remove('active', 'done');
    });
    document.getElementById(steps[0]).classList.add('active');

    const interval = setInterval(() => {
        if (current < steps.length - 1) {
            document.getElementById(steps[current]).classList.remove('active');
            document.getElementById(steps[current]).classList.add('done');
            current++;
            document.getElementById(steps[current]).classList.add('active');
            statusEl.textContent = messages[current];
        } else {
            clearInterval(interval);
        }
    }, 800);

    return interval;
}

function hideStoryLoading() {
    document.getElementById('sf-loading').classList.add('hidden');
}


// ─── Generate Story ─────────────────────────────────────────────────────────
async function generateStory() {
    const genre = document.getElementById('sf-genre').value;
    const mood = document.getElementById('sf-mood').value;
    const numEpisodes = parseInt(document.getElementById('sf-episodes').value) || 6;
    const numCharacters = parseInt(document.getElementById('sf-num-chars').value) || 3;
    const description = document.getElementById('sf-description').value.trim();

    // Gather characters if user-defined
    let characters = [];
    if (currentCharMode === 'USER_DEFINED') {
        const names = document.querySelectorAll('.sf-char-name');
        const traits = document.querySelectorAll('.sf-char-traits');
        names.forEach((nameEl, i) => {
            characters.push({
                name: nameEl.value.trim() || `Character ${i + 1}`,
                traits: traits[i]?.value.trim() || 'mysterious',
            });
        });
    }

    const payload = {
        genre,
        numCharacters,
        emotionMood: mood,
        characterMode: currentCharMode,
        description,
        characters,
        numEpisodes,
    };

    const loadingInterval = showStoryLoading();

    try {
        const response = await fetch(`${API_BASE}/story/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Story generation failed.');
        }

        storyData = result.data;
        const returnedStoryId = result.story_id;
        clearInterval(loadingInterval);

        // Mark all loading steps as done
        for (let i = 1; i <= 6; i++) {
            const el = document.getElementById(`ls-${i}`);
            el.classList.remove('active');
            el.classList.add('done');
        }

        // Redirect to Story Viewer page
        setTimeout(() => {
            hideStoryLoading();
            if (returnedStoryId) {
                window.location.href = `/story-viewer.html?id=${returnedStoryId}`;
            } else {
                // Fallback: render inline if no story_id
                renderResults(storyData);
            }
        }, 500);

    } catch (err) {
        clearInterval(loadingInterval);
        hideStoryLoading();
        resetToWizard();
        console.error('[generateStory]', err);
        alert(`Story generation failed: ${err.message}`);
    }
}


// ─── Reset to Wizard ─────────────────────────────────────────────────────────
function resetToWizard() {
    document.getElementById('sf-wizard').classList.remove('hidden');
    document.getElementById('sf-results').classList.add('hidden');
    document.getElementById('sf-loading').classList.add('hidden');
    setWizardStep(1);
    storyData = null;
}


// ─── Render Results ─────────────────────────────────────────────────────────
function renderResults(data) {
    document.getElementById('sf-wizard').classList.add('hidden');
    document.getElementById('sf-results').classList.remove('hidden');

    // Header
    document.getElementById('sf-result-title').textContent = data.story_title || 'Untitled Story';
    document.getElementById('sf-result-genre').textContent = `🎭 ${data.genre || 'Unknown'}`;
    document.getElementById('sf-result-mood').textContent = `💫 ${data.mood || 'Unknown'}`;
    document.getElementById('sf-result-mode').textContent = data._meta?.mode === 'demo' ? '⚡ Demo Mode' : '🤖 AI Generated';

    renderEpisodes(data.episodes || []);
    renderCharacters(data.characters || []);
    renderEmotionalArc(data.episodes || [], data.emotional_arc_analysis || {});
    renderTwists(data.plot_twists || []);
    renderHashtags(data.hashtags || []);

    // Reset to first tab
    document.querySelectorAll('.sf-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.sf-tab[data-tab="episodes"]').classList.add('active');
    document.querySelectorAll('.sf-tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('tab-episodes').classList.add('active');
}


// ─── Render Episodes ─────────────────────────────────────────────────────────
function renderEpisodes(episodes) {
    const grid = document.getElementById('sf-episodes-grid');
    grid.innerHTML = '';

    episodes.forEach(ep => {
        const card = document.createElement('div');
        card.className = 'sf-ep-card';

        card.innerHTML = `
            <div class="sf-ep-header">
                <div class="sf-ep-left">
                    <div class="sf-ep-num">${ep.episode_number}</div>
                    <div class="sf-ep-info">
                        <h3>${escapeHtml(ep.episode_title)}</h3>
                        <p>${escapeHtml(ep.purpose)}</p>
                    </div>
                </div>
                <div class="sf-ep-scores">
                    <span class="sf-score-badge emotion">💓 ${ep.emotion_level}/10</span>
                    <span class="sf-score-badge cliff">🎣 ${ep.cliffhanger_score}/10</span>
                </div>
                <div class="sf-ep-expand">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
            </div>
            <div class="sf-ep-body">
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;">
                    <span class="sf-tag">${ep.dominant_emotion || 'neutral'}</span>
                    <span class="sf-tag">~${countWords(ep.script)} words</span>
                </div>
                <div class="sf-ep-script">${escapeHtml(ep.script)}</div>
                <div class="sf-ep-cliff">
                    <div class="sf-ep-cliff-label">🎣 Cliffhanger (Score: ${ep.cliffhanger_score}/10)</div>
                    <div class="sf-ep-cliff-text">${escapeHtml(ep.cliffhanger)}</div>
                    ${ep.score_reason ? `<div class="sf-ep-cliff-reason">${escapeHtml(ep.score_reason)}</div>` : ''}
                </div>
            </div>
        `;

        // Toggle expand
        card.querySelector('.sf-ep-header').addEventListener('click', () => {
            card.classList.toggle('open');
        });

        grid.appendChild(card);
    });
}


// ─── Render Characters ───────────────────────────────────────────────────────
function renderCharacters(characters) {
    const grid = document.getElementById('sf-chars-grid');
    grid.innerHTML = '';

    characters.forEach(c => {
        const card = document.createElement('div');
        card.className = 'sf-char-result';
        card.innerHTML = `
            <h3>${escapeHtml(c.name)}</h3>
            <div class="sf-char-field">
                <div class="sf-char-field-label">Personality Traits</div>
                <div class="sf-char-field-value">${escapeHtml(c.personality_traits)}</div>
            </div>
            <div class="sf-char-field">
                <div class="sf-char-field-label">Motivation</div>
                <div class="sf-char-field-value">${escapeHtml(c.motivation)}</div>
            </div>
            <div class="sf-char-field">
                <div class="sf-char-field-label">Internal Conflict</div>
                <div class="sf-char-field-value">${escapeHtml(c.internal_conflict)}</div>
            </div>
        `;
        grid.appendChild(card);
    });
}


// ─── Render Emotional Arc ────────────────────────────────────────────────────
function renderEmotionalArc(episodes, analysis) {
    const container = document.getElementById('sf-emotional-arc');

    const maxEmotion = 10;
    const barHeight = 180; // px

    let barsHtml = episodes.map(ep => {
        const pct = (ep.emotion_level / maxEmotion) * barHeight;
        let riskClass = '';
        if (ep.engagement_risk === 'HIGH') riskClass = 'risk-high';
        else if (ep.engagement_risk === 'MEDIUM') riskClass = 'risk-medium';

        return `
            <div class="sf-arc-bar-wrap">
                <span class="sf-arc-bar-score">${ep.emotion_level}</span>
                <div class="sf-arc-bar ${riskClass}" style="height: ${pct}px;" title="Ep ${ep.episode_number}: ${ep.dominant_emotion}"></div>
                <span class="sf-arc-bar-label">Ep ${ep.episode_number}</span>
            </div>
        `;
    }).join('');

    let flatWarning = '';
    if (analysis.flat_engagement_episodes && analysis.flat_engagement_episodes.length > 0) {
        flatWarning = `
            <div class="sf-arc-flat">
                ⚠️ Flat engagement risk in episodes: ${analysis.flat_engagement_episodes.join(', ')}
            </div>
        `;
    }

    container.innerHTML = `
        <h3 class="sf-arc-title">📊 Emotional Arc Progression</h3>
        ${analysis.engagement_graph ? `<p class="sf-arc-graph-label">${escapeHtml(analysis.engagement_graph)}</p>` : ''}
        <div class="sf-arc-bars">${barsHtml}</div>
        ${flatWarning}
    `;
}


// ─── Render Twists ───────────────────────────────────────────────────────────
function renderTwists(twists) {
    const container = document.getElementById('sf-twists-list');
    container.innerHTML = '';

    if (twists.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px;">No plot twists generated.</p>';
        return;
    }

    twists.forEach((tw, i) => {
        const card = document.createElement('div');
        card.className = 'sf-twist-card';
        card.innerHTML = `
            <h4 class="sf-twist-header">🔄 Twist ${i + 1}: ${escapeHtml(tw.twist)}</h4>
            <div class="sf-twist-detail">
                <div class="sf-twist-detail-label">Setup</div>
                <div class="sf-twist-detail-text">${escapeHtml(tw.setup)}</div>
            </div>
            <div class="sf-twist-detail">
                <div class="sf-twist-detail-label">Reveal</div>
                <div class="sf-twist-detail-text">${escapeHtml(tw.reveal)}</div>
            </div>
            <div class="sf-twist-detail">
                <div class="sf-twist-detail-label">Impact</div>
                <div class="sf-twist-detail-text">${escapeHtml(tw.impact)}</div>
            </div>
        `;
        container.appendChild(card);
    });
}


// ─── Render Hashtags ─────────────────────────────────────────────────────────
function renderHashtags(hashtags) {
    const container = document.getElementById('sf-hashtags-wrap');

    const tagsHtml = hashtags.map(tag => {
        const clean = tag.startsWith('#') ? tag : `#${tag}`;
        return `<span class="sf-hashtag">${escapeHtml(clean)}</span>`;
    }).join('');

    container.innerHTML = `
        <h3 class="sf-hashtags-title"># Viral Hashtags (${hashtags.length})</h3>
        <div class="sf-hashtags-cloud">${tagsHtml}</div>
        <button class="sf-copy-all" id="sf-copy-hashtags">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" stroke-width="2"/>
            </svg>
            Copy All Hashtags
        </button>
    `;

    // Copy button
    document.getElementById('sf-copy-hashtags').addEventListener('click', function () {
        const text = hashtags.map(t => t.startsWith('#') ? t : `#${t}`).join(' ');
        navigator.clipboard.writeText(text).then(() => {
            this.classList.add('copied');
            this.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Copied!
            `;
            setTimeout(() => {
                this.classList.remove('copied');
                this.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    Copy All Hashtags
                `;
            }, 2000);
        });
    });
}


// ─── Utility ─────────────────────────────────────────────────────────────────
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function countWords(str) {
    if (!str) return 0;
    return str.trim().split(/\s+/).length;
}


// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Auth listeners
    document.getElementById('google-signin-btn').addEventListener('click', handleGoogleSignIn);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // StoryForge setup
    setupCharacterMode();
    setupWizardNav();
    setupTemplates();
    setupTabs();

    // BYPASS AUTH: Auto-login with demo user
    populateDashboard(currentUser);
    showScreen(dashboardScreen);
});
