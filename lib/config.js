import packageInfo from '../package.json' with { type: 'json' };

// Public game version shown on the scoreboard and attached to new scores.
// From this release onward versions follow semantic numbering (1.0.12, 1.0.13, ...).
export const GAME_VERSION = String(packageInfo.gameVersion || packageInfo.version || 'unknown');
