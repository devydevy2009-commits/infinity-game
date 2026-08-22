// TEMPORARY TEST MODE: triple power-up arrival rate.
// Does not alter weapon geometry, cadence, projectile speed, gyro, or Hard Mode.
(() => {
  const originalSpawn = window.spawn;
  if (typeof originalSpawn !== 'function') return;

  window.spawn = function spawnWithTriplePowerups() {
    const before = powerups.length;
    originalSpawn.apply(this, arguments);

    // Add two extra chances using the same base probability as the original.
    // The original spawn() already performs one power-up roll; these two rolls
    // make the arrival rate approximately 3x without changing anything else.
    const t = typeof tier === 'function' ? tier() : 0;
    const probability = 0.0017 + Math.min(t, 16) * 0.00025;
    if (Math.random() < probability) powerups.push(new Powerup());
    if (Math.random() < probability) powerups.push(new Powerup());
  };
})();
