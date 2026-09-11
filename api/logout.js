import { clearSessionCookie, destroySession, json } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    await destroySession(req);
  } catch (error) {
    console.error(error);
  }
  res.setHeader('Set-Cookie', clearSessionCookie());
  return json(res, 200, { ok: true });
}
