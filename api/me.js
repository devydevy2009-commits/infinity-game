import { getCurrentUser, json, requestError } from '../lib/auth.js';
import { GAME_VERSION } from '../lib/config.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  try {
    const user = await getCurrentUser(req);
    return json(res, 200, { user, gameVersion: GAME_VERSION });
  } catch (error) {
    return requestError(res, error, 'Unable to read session');
  }
}
