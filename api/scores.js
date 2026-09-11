import { getSql } from '../lib/db.js';
import { getCurrentUser, json, readJson, requestError } from '../lib/auth.js';
import { GAME_VERSION } from '../lib/config.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  try {
    const sql = getSql();

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT s.id, u.username, s.score, s.survival_time, s.game_version, s.created_at
        FROM scores s
        JOIN users u ON u.id = s.user_id
        ORDER BY s.score DESC, s.survival_time DESC, s.created_at ASC`;
      return json(res, 200, { scores: rows, gameVersion: GAME_VERSION });
    }

    if (req.method === 'POST') {
      const user = await getCurrentUser(req);
      if (!user) return json(res, 401, { error: 'Login required to publish a score' });

      const body = await readJson(req);
      const score = Math.floor(Number(body.score));
      const survivalTime = Math.floor(Number(body.survivalTime));
      const runId = String(body.runId || '');

      if (!Number.isSafeInteger(score) || score < 0 || score > 2_000_000_000) {
        return json(res, 400, { error: 'Invalid score' });
      }
      if (!Number.isSafeInteger(survivalTime) || survivalTime < 0 || survivalTime > 86_400) {
        return json(res, 400, { error: 'Invalid survival time' });
      }
      if (!UUID_PATTERN.test(runId)) return json(res, 400, { error: 'Invalid run id' });

      const rows = await sql`
        INSERT INTO scores (user_id, score, survival_time, game_version, run_id)
        VALUES (${user.id}, ${score}, ${survivalTime}, ${GAME_VERSION}, ${runId})
        ON CONFLICT (run_id) DO NOTHING
        RETURNING id, score, survival_time, game_version, created_at`;
      return json(res, rows.length ? 201 : 200, { score: rows[0] || null });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    return requestError(res, error, 'Scoreboard unavailable');
  }
}
