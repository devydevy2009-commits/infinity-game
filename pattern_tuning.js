// INFINITE — encounter tuning layer. Does not own spawning.
(() => {
  'use strict';

  // Hunters: one projectile per volley and at least 2.2s between volleys.
  // This sits after the tutorial layer so it also applies to the split/surround phase.
  const baseHunterUpdate = Enemy.prototype.updateHunter;
  const baseDirectedBurst = fireDirectedBurst;
  fireDirectedBurst = function(x, y, count, spread, speed) {
    return baseDirectedBurst(x, y, 1, spread, speed);
  };

  Enemy.prototype.updateHunter = function(f) {
    const now = Date.now();
    const canShoot = now - (this.lastShot || 0) >= 2200;
    if (!canShoot) this.lastShot = now;
    baseHunterUpdate.call(this, f);
    if (!canShoot) this.lastShot = now;
  };

  // Ghost tutorial: widen the existing line and increase its stagger.
  // We alter only tutorial offsets; no spawn scheduler or formation owner is touched.
  let tunedPattern = null;
  function tuneGhostPattern() {
    if (!window.INFINITE_TUTORIAL_STATE || window.INFINITE_TUTORIAL_STATE.activeType !== 'ghost') return;
    const members = enemies.filter(e => e.tutorialPattern?.type === 'ghost');
    if (!members.length || members[0].tutorialPattern === tunedPattern) return;
    tunedPattern = members[0].tutorialPattern;
    const gapX = S(54), gapY = S(36);
    members.forEach((enemy, index) => {
      enemy.tutorialOffset.x = index * gapX;
      enemy.tutorialOffset.y = index % 2 === 0 ? -gapY : gapY;
    });
  }

  setInterval(tuneGhostPattern, 50);
})();
