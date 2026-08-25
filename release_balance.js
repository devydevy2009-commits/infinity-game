// INFINITE — release balance tuning
(() => {
  'use strict';

  const POWERUP_INTERVAL = 18500;
  const HUNTER_BULLET_SPEED_MULT = 0.94;
  const HUNTER_STEER_MULT = 0.96;
  const HUNTER_EXTRA_FIRE_DELAY = 90;

  let nextTunedPowerupAt = 0;

  const baseHunterUpdate = Enemy.prototype.updateHunter;
  Enemy.prototype.updateHunter = function (f) {
    const before = enemyBullets.length;
    const previousLastShot = this.lastShot;
    baseHunterUpdate.call(this, f);

    this.vx *= Math.pow(HUNTER_STEER_MULT, f);
    this.vy *= Math.pow(HUNTER_STEER_MULT, f);

    if (enemyBullets.length > before) {
      for (let i = before; i < enemyBullets.length; i++) {
        const bullet = enemyBullets[i];
        bullet.vx *= HUNTER_BULLET_SPEED_MULT;
        bullet.vy *= HUNTER_BULLET_SPEED_MULT;
      }
      this.lastShot = Math.max(this.lastShot, Date.now() + HUNTER_EXTRA_FIRE_DELAY);
    } else if (this.lastShot !== previousLastShot) {
      this.lastShot += HUNTER_EXTRA_FIRE_DELAY;
    }
  };

  const baseEnemyUpdate = Enemy.prototype.update;
  Enemy.prototype.update = function (f) {
    baseEnemyUpdate.call(this, f);

    if (this.kind === 'hunter' && !this._releaseHealthTuned) {
      const t = tier();
      if (t >= 5) {
        const reduction = Math.min(2, Math.floor((t - 5) / 4) + 1);
        this.hp = Math.max(1, this.hp - reduction);
        this.maxHp = this.hp;
      }
      this._releaseHealthTuned = true;
    }
  };

  const baseSpawn = window.spawn;
  window.spawn = function () {
    baseSpawn();
    const now = Date.now();
    if (!nextTunedPowerupAt) nextTunedPowerupAt = now + POWERUP_INTERVAL;
    if (powerups.length === 0 && now >= nextTunedPowerupAt) {
      powerups.push(new Powerup());
      nextTunedPowerupAt = now + POWERUP_INTERVAL;
    }
  };

  const baseResetGame = window.resetGame;
  window.resetGame = function () {
    nextTunedPowerupAt = 0;
    baseResetGame();
  };
})();
