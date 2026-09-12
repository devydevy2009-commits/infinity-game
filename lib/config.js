import packageInfo from '../package.json' with { type: 'json' };

const deploymentSha = String(process.env.VERCEL_GIT_COMMIT_SHA || '').trim();
const deploymentBuild = deploymentSha ? `git-${deploymentSha.slice(0, 12)}` : '';

// Every published score is stamped server-side with the exact deployment build.
// This keeps historical scoreboard entries tied to the software that produced them.
export const GAME_VERSION = deploymentBuild || String(packageInfo.gameVersion || packageInfo.version || 'unknown');
