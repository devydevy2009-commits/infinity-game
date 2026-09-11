import { getSql } from '../lib/db.js';
import { createSession, json, readJson, sessionCookie, validatePassword, validateUsername, verifyPassword } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const body = await readJson(req);
    const userInput = validateUsername(body.username);
    const password = validatePassword(body.password);
    if (!userInput || !password) return json(res, 400, { error: 'Username or password not valid' });

    const sql = getSql();
    const rows = await sql`
      SELECT id, username, password_salt, password_hash
      FROM users
      WHERE username_norm = ${userInput.usernameNorm}
      LIMIT 1`;
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_salt, user.password_hash))) {
      return json(res, 401, { error: 'Wrong username or password' });
    }

    await sql`UPDATE users SET last_login_at = now() WHERE id = ${user.id}`;
    const token = await createSession(user.id);
    res.setHeader('Set-Cookie', sessionCookie(token));
    return json(res, 200, { user: { id: user.id, username: user.username } });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'Login failed' });
  }
}
