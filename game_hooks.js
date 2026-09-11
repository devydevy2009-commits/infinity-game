// INFINITY — shared lightweight gameplay extension hooks.
(() => {
  'use strict';

  const updateHooks = [];
  const baseUpdate = window.update;

  if (typeof baseUpdate !== 'function') return;

  window.INFINITY_GAME_HOOKS = Object.freeze({
    onUpdate(handler) {
      if (typeof handler !== 'function' || updateHooks.includes(handler)) return;
      updateHooks.push(handler);
    }
  });

  window.update = function () {
    baseUpdate.call(this);
    if (!running || paused) return;

    for (const handler of updateHooks) {
      try {
        handler();
      } catch (error) {
        console.error('Infinity update hook failed', error);
      }
    }
  };
})();
