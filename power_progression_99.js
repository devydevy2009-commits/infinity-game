// INFINITE — power progression and power-up spawn guard.
// Extends the existing power system to 99 without rewriting the core engine,
// and prevents multiple power-ups from appearing back-to-back after a delay.
(() => {
  'use strict';

  const MAX_POWER_99 = 99;
  const MIN_POWERUP_GAP_MS = 12000;
  let lastPowerupSpawnAt = 0;

  if (Array.isArray(powerTable)) {
    while (powerTable.length < MAX_POWER_99 + 1) {
      const i = powerTable.length;
      powerTable.push({
        cooldown: Math.max(42, 126 - i * 1.7),
        speed: 13 + i * 0.12,
        side: i >= 2,
        wide: i >= 7,
        heavy: i >= 10,
        rapid: i >= 16,
        back: i >= 20,
        quad: i >= 30
      });
    }
  }

  const baseUpdate = window.update;
  if (typeof baseUpdate !== 'function') return;

  window.update = function () {
    if (!Array.isArray(powerups)) {
      baseUpdate.call(this);
      return;
    }

    const before = new Set(powerups);
    const beforeItems = Array.from(powerups);
    const powerBefore = power;
    const originalMin = Math.min;

    // The legacy engine still has a 49 cap. During its own update only,
    // allow the same min() expression to continue through the new 99 ceiling.
    Math.min = function (...args) {
      if (args.length === 2 && args[0] === 49 && Number.isFinite(args[1]) && args[1] >= 50) return args[1];
      return originalMin.apply(Math, args);
    };

    try {
      baseUpdate.call(this);
    } finally {
      Math.min = originalMin;
    }

    const now = Date.now();
    const created = powerups.filter(item => !before.has(item));

    if (created.length) {
      if (lastPowerupSpawnAt && now - lastPowerupSpawnAt < MIN_POWERUP_GAP_MS) {
        for (const item of created) {
          const index = powerups.indexOf(item);
          if (index >= 0) powerups.splice(index, 1);
        }
        if (typeof nextPowerupAt === 'number') nextPowerupAt = now + MIN_POWERUP_GAP_MS;
      } else {
        lastPowerupSpawnAt = now;
      }
    }

    // If the core collected a power-up while already at 49+, restore the
    // intended next level after its legacy clamp has run.
    if (powerBefore >= 49 && powerups.length < before.size && player) {
      const playerBox = player.b();
      const collected = beforeItems.some(item => {
        if (powerups.includes(item)) return false;
        const radius = Number(item?.r) || S(12);
        const dx = item.x - playerBox.x, dy = item.y - playerBox.y;
        return dx * dx + dy * dy <= (playerBox.r + radius) ** 2;
      });
      if (collected) {
        power = Math.min(MAX_POWER_99, powerBefore + 1);
        setHud(powerEl, 'power', 'Power', power);
      }
    }
  };

  const baseResetGame = window.resetGame;
  if (typeof baseResetGame === 'function') {
    window.resetGame = function () {
      lastPowerupSpawnAt = 0;
      baseResetGame.call(this);
    };
  }
})();
