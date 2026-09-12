// INFINITY — boss-aware power-up scheduler.
// Keeps the normal power-up cadence in gameplay time instead of letting a boss
// fight consume real-world time and then release a backlog immediately.
(() => {
  'use strict';

  const baseDraw = window.draw;
  const baseResetGame = window.resetGame;

  let tracking = false;
  let accumulatedBossMs = 0;
  let lastSample = 0;

  function bossIsActive() {
    return !!window.INFINITE_BOSS_STATE?.active;
  }

  function sampleBossTime(now) {
    if (!bossIsActive()) {
      if (tracking) {
        nextPowerupAt += accumulatedBossMs;
        tracking = false;
        accumulatedBossMs = 0;
        lastSample = 0;
      }
      return;
    }

    if (!tracking) {
      tracking = true;
      accumulatedBossMs = 0;
      lastSample = now;
      return;
    }

    if (!paused) accumulatedBossMs += Math.max(0, now - lastSample);
    lastSample = now;
  }

  window.draw = function () {
    const now = Date.now();
    sampleBossTime(now);
    baseDraw.call(this);
  };

  window.resetGame = function () {
    tracking = false;
    accumulatedBossMs = 0;
    lastSample = 0;
    baseResetGame.call(this);
  };
})();
