// INFINITE — encounter tuning layer. Does not own spawning.
(() => {
  'use strict';

  const hooks = window.INFINITY_GAME_HOOKS;
  if (!hooks) throw new Error('INFINITY_GAME_HOOKS is not available');

  // Keep directed enemy volleys to one projectile. Tactical firing cadence is
  // owned by tactical_balance.js, so this layer does not wrap Hunter.update again.
  const baseDirectedBurst = fireDirectedBurst;
  fireDirectedBurst = function (x, y, count, spread, speed) {
    return baseDirectedBurst(x, y, 1, spread, speed);
  };

  // Ghost tutorial: widen the existing line and increase its stagger once per pattern.
  let tunedPattern = null;

  function tuneGhostPattern() {
    const tutorial = window.INFINITE_TUTORIAL_STATE;
    if (!tutorial || tutorial.activeType !== 'ghost') {
      tunedPattern = null;
      return;
    }

    const members = enemies.filter(enemy => enemy.tutorialPattern?.type === 'ghost');
    if (!members.length || members[0].tutorialPattern === tunedPattern) return;

    tunedPattern = members[0].tutorialPattern;
    const gapX = S(54);
    const gapY = S(36);

    members.forEach((enemy, index) => {
      enemy.tutorialOffset.x = index * gapX;
      enemy.tutorialOffset.y = index % 2 === 0 ? -gapY : gapY;
    });
  }

  hooks.onUpdate(tuneGhostPattern);
})();
