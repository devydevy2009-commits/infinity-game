// INFINITY — single source of truth for "is this a preview build?".
// Production hostnames are listed explicitly; anything else is treated as preview
// (Vercel preview/branch deployments, or local development).
//
// BUGFIX CONTEXT: previously, preview detection lived inline in boss2_system.js and
// checked for one specific deployment hostname that had been hardcoded by hand. That
// broke on every new preview deployment, because Vercel generates a new random
// hostname for each one. Centralizing the check here, based on the small, stable set
// of production hostnames, fixes that for good and lets any future preview-only
// feature reuse the same flag instead of re-inventing hostname parsing.
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
  const isVercelPreview = host.endsWith('.vercel.app') && !PRODUCTION_HOSTNAMES.includes(host);

  // True on any Vercel preview/branch deployment and on local dev.
  // False in production, and false for any unrecognized hostname (fail closed).
  window.INFINITE_PREVIEW_BUILD = isVercelPreview || isLocalDev;
})();
