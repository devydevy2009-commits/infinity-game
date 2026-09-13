// INFINITY — smooth lower-screen return for Hunters.
// Blend the lower-screen safety steering with the Hunter's normal player pursuit
// instead of overwriting Y position, which used to create a visible snap.
(() => {
  'use strict';

  const baseUpdate = Enemy.prototype.update;
  const baseReset = window.resetGame;

  Enemy.prototype.update = function (f) {
    const isHunter = this.kind === 'hunter';
    if (!isHunter) return baseUpdate.call(this, f);

    // Keep the Hunter's normal steering toward the player. The return layer below
    // adds an opposing vertical steering force rather than teleporting the sprite.
    baseUpdate.call(this, f);

    const returnStartY = height * 0.80;
    const targetY = height * 0.30;
    if (!this._smoothHunterReturn && this.y >= returnStartY) {
      this._smoothHunterReturn = true;
      this._smoothHunterReturnStarted = Date.now();
    }

    if (!this._smoothHunterReturn) return;

    const distance = targetY - this.y;
    const tierBoost = Math.min(tier(), 12);
    const maxReturnSpeed = S(3.0 + tierBoost * 0.10);
    const returnAcceleration = S(0.075 + tierBoost * 0.0045);

    // Blend with player tracking: only the vertical component is redirected,
    // while vx remains controlled by the Hunter's normal pursuit logic.
    this.vy += clamp(distance * 0.0018, -returnAcceleration, returnAcceleration) * f;
    this.vy = clamp(this.vy, -maxReturnSpeed, S(2.7 + tierBoost * 0.16));

    // If another lower-screen safety pass pushed it very close to cleanup,
    // keep it inside the playfield without jumping it to the target position.
    const safeBottom = height - S(18);
    if (this.y > safeBottom) this.y = safeBottom;

    // Release the safety steering once the Hunter is back in the upper-middle area.
    if (Math.abs(distance) < S(18)) {
      this._smoothHunterReturn = false;
      this.vy *= 0.78;
    }
  };

  window.resetGame = function () {
    const result = baseReset.call(this);
    return result;
  };
})();
