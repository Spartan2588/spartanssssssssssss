/**
 * src/routes/story.js
 * ────────────────────
 * Express router for StoryForge AI endpoints.
 * v3.0 — Adds story retrieval, episode editing, and edit actions.
 */

'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const {
    handleGenerate,
    handleGetStory,
    handleEdit,
    handleGetGenres,
    handleGetMoods,
    handleGetEditActions,
    handleAnalytics,
} = require('../controllers/storyController');

const router = express.Router();

// ─── Rate Limiters ───────────────────────────────────────────────────────
const storyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: 'Too many story generation requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const editLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    message: { error: 'Too many edit requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ─── Routes ──────────────────────────────────────────────────────────────
router.get('/genres', handleGetGenres);
router.get('/moods', handleGetMoods);
router.get('/edit-actions', handleGetEditActions);
router.get('/:id', handleGetStory);
router.post('/generate', storyLimiter, handleGenerate);
router.post('/edit', editLimiter, handleEdit);
router.post('/analytics', editLimiter, handleAnalytics);

module.exports = router;
