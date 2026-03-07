const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Verify a Google ID token and return the decoded payload.
 * Throws if the token is invalid or not issued for this app.
 *
 * @param {string} idToken  The token received from the frontend
 * @returns {Promise<Object>} Decoded token payload
 */
async function verifyGoogleToken(idToken) {
    if (!idToken || typeof idToken !== 'string') {
        throw new Error('ID token must be a non-empty string.');
    }

    const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    // Extra safety: ensure the token was actually issued for our app
    if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
        throw new Error('Token audience mismatch.');
    }

    // Ensure the account's email is verified
    if (!payload.email_verified) {
        throw new Error('Google account email is not verified.');
    }

    return {
        googleId: payload.sub,          // Unique Google user ID
        name: payload.name,
        email: payload.email,
        avatar: payload.picture || null,
    };
}

module.exports = { verifyGoogleToken };
