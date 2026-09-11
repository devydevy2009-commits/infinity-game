import packageInfo from '../package.json' with { type: 'json' };

export const GAME_VERSION = String(packageInfo.gameVersion || packageInfo.version || 'unknown');
