import { getSql } from '../lib/db.js';
import {
  createSession,
  hashPassword,
  json,
  readJson,
  requestError,
  sessionCookie,
  validatePassword,
  validateUsername
} from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const body = await readJson(req);
    const user = validateUsername(body.username);
    const password = validatePassword(body.password);
    if (!user || !password) return json(res, 400, { error: 'Username or password not valid' });

    const { salt, hash } = await hashPassword(password);
    const sql = getSql();
    const rows = await sql`
      INSERT INTO users (username, username_norm, password_salt, password_hash, last_login_at)
      VALUES (${user.username}, ${user.usernameNorm}, ${salt}, ${hash}, now())
      RETURNING id, username`;

    const token = await createSession(rows[0].id);
    res.setHeader('Set-Cookie', sessionCookie(token));
    return json(res, 201, { user: rows[0] });
  } catch (error) {
    if (error?.code === '23505') return json(res, 409, { error: 'Username already in use' });
    return requestError(res, error, 'Registration failed');
  }
}
