const express = require('express');
const rateLimit = require('express-rate-limit');
const { verifyGoogleToken } = require('../services/googleAuth');
const { signToken, setAuthCookie, clearAuthCookie } = require('../services/jwtService');
const { authenticate } = require('../middleware/authenticate');
const UserModel = require('../models/User');

const router = express.Router();

// ─── Strict Rate Limit for Auth Endpoints ────────────────────────────────────
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/google
// Body: { idToken: string }
//
// 1. Verifies the Google ID token server-side
// 2. Creates or updates the user in the DB
// 3. Issues a signed JWT stored in an HTTP-only cookie
// Returns the public user object
// ─────────────────────────────────────────────────────────────────────────────
router.post('/google', authLimiter, async (req, res) => {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            return res.status(400).json({ error: 'idToken is required.' });
        }

        // 1. Verify with Google
        const googleUser = await verifyGoogleToken(idToken);

        // 2. Upsert user in DB (handles duplicates safely)
        const user = UserModel.createOrUpdate(googleUser);
        const publicUser = UserModel.toPublic(user);

        // 3. Sign JWT
        const jwtToken = signToken(publicUser);

        // 4. Set HTTP-only cookie
        setAuthCookie(res, jwtToken);

        res.status(200).json({
            success: true,
            message: 'Authentication successful.',
            user: publicUser,
        });
    } catch (err) {
        console.error('[POST /api/auth/google]', err.message);

        // Don't leak internal error details to the client
        if (err.message.includes('Token used too late') || err.message.includes('Invalid token')) {
            return res.status(401).json({ error: 'Google token verification failed. Please try again.' });
        }
        if (err.message.includes('email is not verified')) {
            return res.status(403).json({ error: 'Your Google account email must be verified.' });
        }

        res.status(500).json({ error: 'Authentication failed. Please try again.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// Clears the auth cookie and ends the session
// ─────────────────────────────────────────────────────────────────────────────
router.post('/logout', authenticate, (req, res) => {
    clearAuthCookie(res);
    res.json({ success: true, message: 'Logged out successfully.' });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// Returns the currently authenticated user (or 401 if not logged in)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
    res.json({ success: true, user: req.user });
});

module.exports = router;
