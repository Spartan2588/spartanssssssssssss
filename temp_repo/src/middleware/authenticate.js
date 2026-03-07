const { verifyToken, extractToken } = require('../services/jwtService');
const UserModel = require('../models/User');

/**
 * authenticate — Middleware that protects routes.
 *
 * BYPASS MODE: Always allows access with a demo user (no auth required)
 */
function authenticate(req, res, next) {
    // BYPASS: Auto-login with demo user
    req.user = {
        id: 'demo-user-123',
        email: 'demo@storyforge.ai',
        name: 'Demo User',
        avatar: 'https://ui-avatars.com/api/?name=Demo+User&background=6c63ff&color=fff&size=200&bold=true'
    };
    next();
}

/**
 * optionalAuthenticate — Same as authenticate but does NOT block the request.
 *
 * BYPASS MODE: Always sets demo user
 */
function optionalAuthenticate(req, res, next) {
    req.user = {
        id: 'demo-user-123',
        email: 'demo@storyforge.ai',
        name: 'Demo User',
        avatar: 'https://ui-avatars.com/api/?name=Demo+User&background=6c63ff&color=fff&size=200&bold=true'
    };
    next();
}

module.exports = { authenticate, optionalAuthenticate };
