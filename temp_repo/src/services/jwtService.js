const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = '7d';
const COOKIE_NAME = 'auth_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

if (!JWT_SECRET) {
    console.warn('⚠️  JWT_SECRET is not set. Authentication will fail at runtime.');
}

/**
 * Sign a JWT containing the user's public info.
 * @param {{ id, googleId, name, email, avatar }} user
 * @returns {string} Signed JWT
 */
function signToken(user) {
    return jwt.sign(
        {
            sub: user.id,
            googleId: user.googleId,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES, algorithm: 'HS256' }
    );
}

/**
 * Verify a JWT and return its decoded payload.
 * @param {string} token
 * @returns {Object} Decoded payload
 * @throws {Error} If the token is invalid or expired
 */
function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
}

/**
 * Attach the auth cookie to the response.
 * @param {import('express').Response} res
 * @param {string} token
 */
function setAuthCookie(res, token) {
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,                                    // Not accessible via JS
        secure: process.env.NODE_ENV === 'production',  // HTTPS only in prod
        sameSite: 'lax',                                  // CSRF protection
        maxAge: COOKIE_MAX_AGE,
        path: '/',
    });
}

/**
 * Clear the auth cookie from the response.
 * @param {import('express').Response} res
 */
function clearAuthCookie(res) {
    res.clearCookie(COOKIE_NAME, { path: '/', httpOnly: true, sameSite: 'lax' });
}

/**
 * Extract JWT from request: first checks HTTP-only cookie, then Authorization header.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function extractToken(req) {
    // Prefer the secure HTTP-only cookie
    if (req.cookies && req.cookies[COOKIE_NAME]) {
        return req.cookies[COOKIE_NAME];
    }
    // Fallback: Bearer token in Authorization header (useful for API clients)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }
    return null;
}

module.exports = { signToken, verifyToken, setAuthCookie, clearAuthCookie, extractToken, COOKIE_NAME };
