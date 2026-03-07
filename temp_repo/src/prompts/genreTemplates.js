/**
 * prompts/genreTemplates.js
 * ──────────────────────────
 * Configuration-driven genre and mood templates.
 * All genre-specific logic lives here — zero conditionals in service code.
 *
 * Usage:
 *   const template = GENRE_TEMPLATES[genre];
 *   const modifier = MOOD_MODIFIERS[mood];
 */

'use strict';

// ─── Genre Templates ─────────────────────────────────────────────────────
// Each genre defines: tone, narrative style, pacing, themes, and example hooks.
// The prompt builder assembles these into the LLM prompt dynamically.

const GENRE_TEMPLATES = {
    thriller: {
        tone: 'fast-paced, tense, adrenaline-fueled',
        style: 'sharp cuts between scenes, urgent narration, ticking-clock tension',
        pacing: 'rapid escalation with brief moments of false safety',
        themes: ['deception', 'pursuit', 'hidden identity', 'conspiracy'],
        hookStyle: 'Start with an impossible situation or a devastating revelation',
        cliffhangerStyle: 'End on life-or-death stakes or a shocking betrayal',
    },
    horror: {
        tone: 'creeping dread, atmospheric, psychologically unsettling',
        style: 'slow burn with sudden visceral shocks, sensory-rich descriptions',
        pacing: 'gradual tension build punctuated by terrifying reveals',
        themes: ['the unknown', 'isolation', 'supernatural threat', 'body horror'],
        hookStyle: 'Begin with an eerie normalcy that feels slightly wrong',
        cliffhangerStyle: 'End with the horror getting closer or a terrifying new discovery',
    },
    romance: {
        tone: 'emotionally charged, intimate, heart-fluttering',
        style: 'close POV narration, sensory details of attraction and connection',
        pacing: 'push-pull rhythm of connection and conflict',
        themes: ['forbidden love', 'second chances', 'emotional vulnerability', 'sacrifice'],
        hookStyle: 'Open with a charged encounter or an impossible situation for love',
        cliffhangerStyle: 'End on an emotional revelation or a forced separation',
    },
    'sci-fi': {
        tone: 'wonder-filled, cerebral, high-concept',
        style: 'vivid world-building woven into action, concept-driven revelations',
        pacing: 'discovery-driven escalation with paradigm-shifting twists',
        themes: ['technology vs humanity', 'first contact', 'dystopia', 'time paradox'],
        hookStyle: 'Open with a mind-bending concept or impossible technology',
        cliffhangerStyle: 'End with a reality-shattering discovery or system failure',
    },
    fantasy: {
        tone: 'epic, mythical, immersive',
        style: 'rich sensory world-building, archetypal character journeys',
        pacing: 'quest-driven progression with escalating magical stakes',
        themes: ['chosen one', 'ancient prophecy', 'magical corruption', 'hidden world'],
        hookStyle: 'Begin with a call to adventure or a magical awakening',
        cliffhangerStyle: 'End with a magical betrayal or an impossible choice',
    },
    mystery: {
        tone: 'suspenseful, intellectually engaging, layered',
        style: 'clue-driven narration, misdirection, unreliable perspectives',
        pacing: 'methodical revelation with periodic paradigm shifts',
        themes: ['whodunit', 'locked room', 'unreliable narrator', 'cold case'],
        hookStyle: 'Open with a baffling crime or impossible situation',
        cliffhangerStyle: 'End with a new suspect or evidence that changes everything',
    },
    drama: {
        tone: 'emotionally resonant, character-driven, nuanced',
        style: 'intimate character study with high emotional stakes',
        pacing: 'slow-building emotional intensity with cathartic releases',
        themes: ['family secrets', 'moral dilemma', 'redemption', 'identity crisis'],
        hookStyle: 'Begin with a life-changing event or buried secret surfacing',
        cliffhangerStyle: 'End on an emotional revelation or irreversible decision',
    },
    comedy: {
        tone: 'witty, fast-paced, absurdist',
        style: 'snappy dialogue, escalating absurdity, comedic timing in narration',
        pacing: 'rapid-fire gags building to increasingly ridiculous situations',
        themes: ['misunderstanding', 'fish out of water', 'rivalry', 'impersonation'],
        hookStyle: 'Open with a hilarious predicament or catastrophic miscommunication',
        cliffhangerStyle: 'End with the situation getting hilariously worse',
    },
    action: {
        tone: 'explosive, visceral, high-octane',
        style: 'kinetic action descriptions, short punchy sentences, visual set pieces',
        pacing: 'relentless forward momentum with brief strategic pauses',
        themes: ['survival', 'revenge', 'rescue mission', 'last stand'],
        hookStyle: 'Open mid-action or with an explosive inciting event',
        cliffhangerStyle: 'End on a physical peril or impossible odds',
    },
    crime: {
        tone: 'gritty, morally ambiguous, street-level',
        style: 'noir-influenced narration, procedural detail, moral grey zones',
        pacing: 'investigation-driven with escalating personal stakes',
        themes: ['corruption', 'undercover', 'heist', 'moral compromise'],
        hookStyle: 'Begin with a crime in progress or a devastating discovery',
        cliffhangerStyle: 'End with a double-cross or evidence pointing at the protagonist',
    },
    dystopian: {
        tone: 'oppressive, urgent, revolutionary',
        style: 'world-as-character narration, systemic tension, rebellion imagery',
        pacing: 'building resistance against escalating oppression',
        themes: ['surveillance state', 'rebellion', 'class warfare', 'forbidden knowledge'],
        hookStyle: 'Open with a rule being broken or a system glitch revealing truth',
        cliffhangerStyle: 'End with capture, exposure, or a devastating system response',
    },
    supernatural: {
        tone: 'mysterious, otherworldly, boundary-blurring',
        style: 'reality-bending descriptions, liminal atmosphere, cosmic scale',
        pacing: 'gradual revelation of supernatural rules with escalating consequences',
        themes: ['ghosts', 'curses', 'parallel dimensions', 'divine intervention'],
        hookStyle: 'Open with an inexplicable event that defies natural law',
        cliffhangerStyle: 'End with a supernatural escalation or reality fracture',
    },
    psychological: {
        tone: 'mind-bending, unreliable, deeply internal',
        style: 'stream-of-consciousness, shifting perspectives, gaslighting narration',
        pacing: 'reality-questioning escalation with perception-shattering reveals',
        themes: ['split identity', 'repressed memory', 'manipulation', 'sanity vs madness'],
        hookStyle: 'Open with a perception that doesn\'t match reality',
        cliffhangerStyle: 'End with everything the audience believed being questioned',
    },
    adventure: {
        tone: 'exhilarating, discovery-driven, larger-than-life',
        style: 'vivid location descriptions, globe-trotting momentum, treasure-hunt energy',
        pacing: 'location-hopping escalation with increasing danger at each stop',
        themes: ['treasure hunt', 'lost civilization', 'survival journey', 'map quest'],
        hookStyle: 'Open with a mysterious artifact or impossible map',
        cliffhangerStyle: 'End with a trap sprung or a rival arriving first',
    },
    historical: {
        tone: 'immersive, authentic, dramatically heightened',
        style: 'period-accurate atmosphere with modern narrative urgency',
        pacing: 'event-driven escalation anchored to historical turning points',
        themes: ['war', 'revolution', 'forbidden love across class', 'secret history'],
        hookStyle: 'Open on the eve of a historical event with a personal stake',
        cliffhangerStyle: 'End with history diverging from what the audience expects',
    },
};


// ─── Mood Modifiers ──────────────────────────────────────────────────────
// Applied on top of genre template to shift emotional register.

const MOOD_MODIFIERS = {
    suspense: {
        instruction: 'Maintain constant undercurrent of tension. Every scene should feel like something could go wrong.',
        emotionFocus: 'anxiety, anticipation, unease',
    },
    fear: {
        instruction: 'Lean into primal fear responses. Use darkness, isolation, and the unknown.',
        emotionFocus: 'terror, dread, panic',
    },
    hope: {
        instruction: 'Thread moments of light through darkness. Make the audience root for survival.',
        emotionFocus: 'determination, resilience, faith',
    },
    melancholy: {
        instruction: 'Infuse scenes with bittersweet longing. Loss should feel beautiful and devastating.',
        emotionFocus: 'sadness, nostalgia, wistfulness',
    },
    tension: {
        instruction: 'Ratchet up pressure continuously. Every decision should feel weighty and irreversible.',
        emotionFocus: 'stress, urgency, pressure',
    },
    excitement: {
        instruction: 'Maintain high energy and forward momentum. Make audience feel breathless.',
        emotionFocus: 'thrill, adrenaline, exhilaration',
    },
    wonder: {
        instruction: 'Create awe-inspiring moments of discovery. Scale should be overwhelming.',
        emotionFocus: 'amazement, curiosity, transcendence',
    },
    dread: {
        instruction: 'Build inevitable doom. The audience should feel it coming but be unable to look away.',
        emotionFocus: 'foreboding, inevitability, horror',
    },
    anger: {
        instruction: 'Channel righteous fury. Injustice should make the audience burn with protagonist.',
        emotionFocus: 'rage, indignation, vengeance',
    },
    joy: {
        instruction: 'Celebrate human connection and triumph. Earned happiness after struggle.',
        emotionFocus: 'elation, warmth, celebration',
    },
    nostalgia: {
        instruction: 'Evoke longing for the past. Contrast lost innocence with present reality.',
        emotionFocus: 'remembrance, loss, yearning',
    },
    dark: {
        instruction: 'Explore the shadows of human nature. Moral lines should blur and break.',
        emotionFocus: 'despair, corruption, moral decay',
    },
    bittersweet: {
        instruction: 'Balance loss with meaning. Every ending should carry both pain and grace.',
        emotionFocus: 'acceptance, sacrifice, poignant beauty',
    },
    inspirational: {
        instruction: 'Build toward triumph of the human spirit. Obstacles exist to be overcome.',
        emotionFocus: 'courage, perseverance, transformation',
    },
    eerie: {
        instruction: 'Create wrongness beneath the surface. Normality should feel subtly distorted.',
        emotionFocus: 'uncanny, discomfort, atmospheric unease',
    },
};


// ─── Available Genres & Moods (derived from templates) ───────────────────

const GENRES = Object.keys(GENRE_TEMPLATES);
const MOODS = Object.keys(MOOD_MODIFIERS);


module.exports = { GENRE_TEMPLATES, MOOD_MODIFIERS, GENRES, MOODS };
