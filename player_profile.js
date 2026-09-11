// INFINITY — persistent player profile foundation.
// Gameplay does not depend on these fields yet; they prepare the save model
// for future ship customization without changing the current player behavior.
(() => {
  'use strict';

  const STORAGE_KEY = 'infinitePlayerProfile';
  const DEFAULT_PROFILE = Object.freeze({
    version: 1,
    hull: 'standard',
    accent: 'white',
    trim: 'default'
  });

  function sanitize(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
      version: 1,
      hull: typeof source.hull === 'string' ? source.hull.slice(0, 32) : DEFAULT_PROFILE.hull,
      accent: typeof source.accent === 'string' ? source.accent.slice(0, 32) : DEFAULT_PROFILE.accent,
      trim: typeof source.trim === 'string' ? source.trim.slice(0, 32) : DEFAULT_PROFILE.trim
    };
  }

  function read() {
    try {
      return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'));
    } catch {
      return sanitize(null);
    }
  }

  function save(patch = {}) {
    const next = sanitize({ ...read(), ...patch });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    return next;
  }

  window.INFINITE_PLAYER_PROFILE = Object.freeze({
    get() { return read(); },
    update(patch) { return save(patch); },
    reset() { return save(DEFAULT_PROFILE); }
  });
})();
