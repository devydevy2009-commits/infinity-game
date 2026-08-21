// Small compatibility layer for v3 Hard Mode: keep stored enemy velocity at normal scale
// while the simulation applies the requested x2 movement multiplier.
(() => {
  const updateV3 = update;
  update = function updateV4() {
    if (typeof hardMode !== 'undefined' && hardMode && enemies) {
      for (const e of enemies) {
        if (e && e._v3) { e.vx *= 0.5; e.vy *= 0.5; }
      }
    }
    updateV3();
  };
})();
