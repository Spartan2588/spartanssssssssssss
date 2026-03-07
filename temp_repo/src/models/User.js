const { query, queryOne, run } = require('../database/db');

class UserModel {
    static findByGoogleId(googleId) {
        return queryOne('SELECT * FROM users WHERE google_id = ?', [googleId]);
    }

    static findByEmail(email) {
        return queryOne('SELECT * FROM users WHERE email = ?', [email]);
    }

    static findById(id) {
        return queryOne('SELECT * FROM users WHERE id = ?', [id]);
    }

    /**
     * Create or update a user (upsert).
     * Finds existing by googleId → updates mutable fields, or inserts fresh row.
     */
    static createOrUpdate({ googleId, name, email, avatar }) {
        const existing = queryOne('SELECT * FROM users WHERE google_id = ?', [googleId]);

        if (existing) {
            run(
                `UPDATE users SET name = ?, avatar = ?, updated_at = datetime('now') WHERE google_id = ?`,
                [name, avatar || null, googleId]
            );
        } else {
            run(
                `INSERT INTO users (google_id, name, email, avatar, created_at, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
                [googleId, name, email, avatar || null]
            );
        }

        return queryOne('SELECT * FROM users WHERE google_id = ?', [googleId]);
    }

    static findAll() {
        return query(
            'SELECT id, name, email, avatar, created_at FROM users ORDER BY created_at DESC'
        );
    }

    static deleteById(id) {
        run('DELETE FROM users WHERE id = ?', [id]);
    }

    /** Strip internal DB fields, returning a clean public object */
    static toPublic(user) {
        if (!user) return null;
        return {
            id: user.id,
            googleId: user.google_id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            createdAt: user.created_at,
        };
    }
}

module.exports = UserModel;
