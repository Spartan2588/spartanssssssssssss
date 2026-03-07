const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const UserModel = require('../models/User');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/user/profile
// Returns the authenticated user's profile
// ─────────────────────────────────────────────────────────────────────────────
router.get('/profile', authenticate, (req, res) => {
    res.json({ success: true, user: req.user });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/user/account
// Deletes the authenticated user's account
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/account', authenticate, (req, res) => {
    try {
        UserModel.deleteById(req.user.id);
        res.json({ success: true, message: 'Account deleted.' });
    } catch (err) {
        console.error('[DELETE /api/user/account]', err);
        res.status(500).json({ error: 'Failed to delete account.' });
    }
});

module.exports = router;
