// INFINITY — smooth lower-screen return for Hunters.
// Hunters begin their return before the engine's off-screen cleanup can remove them.
(() => {
  'use strict';

  const baseUpdate = Enemy.prototype.update;
  const baseReset = window.resetGame;

  Enemy.prototype.update = function (f) {
    const isHunter = this.kind === 'hunter';
    if (!isHunter) return baseUpdate.call(this, f);

    baseUpdate.call(this, f);

    if (!this._smoothHunterReturn && this.y >= height - S(34)) {
      this._smoothHunterReturn = true;
      this._smoothHunterReturnStarted = Date.now();
    }

    if (!this._smoothHunterReturn) return;

    const targetY = height * 0.28;
    const distance = targetY - this.y;
    const returnSpeed = S(2.35 + Math.min(tier(), 12) * 0.055);
    const step = clamp(distance * 0.055, -returnSpeed, returnSpeed) * f;
    this.y += step;
    this.y = clamp(this.y, -S(60), height - S(26));

    const vxLimit = S(2.7 + tier() * 0.16);
    this.vy = clamp(this.vy * 0.86 - S(0.025) * f, -returnSpeed * 1.15, vxLimit);
    if (Math.abs(distance) < S(8)) {
      this._smoothHunterReturn = false;
      this.vy = Math.min(this.vy, -S(.2));
    }
  };

  window.resetGame = function () {
    const result = baseReset.call(this);
    return result;
  };
})();
