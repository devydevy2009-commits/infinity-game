// INFINITY — boss-aware power-up scheduler.
// Time spent fighting either boss does not advance the normal power-up clock,
// preventing a backlog of delayed power-ups after a long boss fight.
(() => {
  'use strict';

  const baseDraw = window.draw;
  const baseResetGame = window.resetGame;
  let tracking = false;
  let accumulatedBossMs = 0;
  let lastSample = 0;

  function bossIsActive() {
    return !!window.INFINITE_BOSS_STATE?.active || !!window.INFINITE_SECOND_BOSS_STATE?.active;
  }

  function sampleBossTime(now) {
    if (!bossIsActive()) {
      if (tracking) {
        if (typeof nextPowerupAt === 'number') nextPowerupAt += accumulatedBossMs;
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
    sampleBossTime(Date.now());
    baseDraw.call(this);
  };

  window.resetGame = function () {
    tracking = false;
    accumulatedBossMs = 0;
    lastSample = 0;
    baseResetGame.call(this);
  };
})();
