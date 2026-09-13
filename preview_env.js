// INFINITY — single source of truth for "is this a preview build?".
// Production must never expose preview-only controls, including on Vercel's
// random deployment URL. Preview controls are therefore enabled only on local
// development or on an explicit Vercel Git branch alias (git-...), excluding main.
(() => {
  'use strict';

  const PRODUCTION_HOSTNAMES = [
    'infinity-game-xi.vercel.app',
    'infinity-game-davideacme.vercel.app',
    'infinity-game-git-main-davideacme.vercel.app'
    // Add any future custom production domain here.
  ];

  const host = location.hostname;
  const isLocalDev = host === 'localhost' || host === '127.0.0.1' || host === '';
  const isProductionAlias = PRODUCTION_HOSTNAMES.includes(host);

  // Vercel Git preview aliases have the stable `git-<branch>-<owner>` shape.
  // The production main alias is explicitly excluded above.
  const isVercelGitPreview =
    host.endsWith('.vercel.app') &&
    host.startsWith('infinity-game-git-') &&
    !isProductionAlias;

  // Fail closed: random Vercel deployment URLs are NOT treated as preview.
  window.INFINITE_PREVIEW_BUILD = isLocalDev || isVercelGitPreview;
})();
