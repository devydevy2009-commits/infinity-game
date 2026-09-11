import { getCurrentUser, json } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const user = await getCurrentUser(req);
    return json(res, 200, { user });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'Unable to read session' });
  }
}
