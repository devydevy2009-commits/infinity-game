// INFINITY — boss support-emitter visuals.
// Keeps the original diagonal barrage while giving every beam a visible source.
(() => {
  'use strict';

  const SUPPORT_COUNT = 8;
  const SUPPORT_Y = S(24);
  const GAP_LANES = new Set([2, 5]);
  const state = { drones: [], lastBossActive: false };

  function supportX(index) {
    return width / SUPPORT_COUNT * (index + 0.5);
  }

  function ensureSupportDrones() {
    const active = !!window.INFINITE_BOSS_STATE?.active;
    if (!active) {
      state.drones.length = 0;
      state.lastBossActive = false;
      return;
    }
    if (!state.lastBossActive) {
      state.drones = [];
      for (let lane = 0; lane < SUPPORT_COUNT; lane++) {
        if (GAP_LANES.has(lane)) continue;
        state.drones.push({ lane, x: supportX(lane), y: SUPPORT_Y, flashUntil: 0 });
      }
      state.lastBossActive = true;
    }
    for (const drone of state.drones) drone.x = supportX(drone.lane);
  }

  const baseUpdate = window.update;
  window.update = function () {
    ensureSupportDrones();
    baseUpdate.call(this);
    if (!window.INFINITE_BOSS_STATE?.active || !state.drones.length) return;

    // The original barrage already has the desired diagonal trajectories.
    // Only move each newly-created boss bullet from just above the viewport
    // to its matching visible emitter on its first frame.
    for (const bullet of enemyBullets) {
      if (!bullet.bossBullet || bullet._supportEmitterAttached || bullet.y > S(2)) continue;
      let nearest = state.drones[0];
      for (let i = 1; i < state.drones.length; i++) {
        const candidate = state.drones[i];
        if (Math.abs(candidate.x - bullet.x) < Math.abs(nearest.x - bullet.x)) nearest = candidate;
      }
      bullet.x = nearest.x;
      bullet.y = nearest.y;
      bullet._supportEmitterAttached = true;
      nearest.flashUntil = Date.now() + 90;
    }
  };

  function drawSupportDrone(drone) {
    const s = S(8);
    const flash = Date.now() < drone.flashUntil;
    ctx.save();
    ctx.translate(drone.x, drone.y);
    ctx.strokeStyle = flash ? '#fff' : '#ff9a3d';
    ctx.lineWidth = S(1.8);
    ctx.beginPath();
    ctx.moveTo(-s * 1.15, 0);
    ctx.quadraticCurveTo(-s * 0.72, -s * 0.65, 0, -s * 0.52);
    ctx.quadraticCurveTo(s * 0.72, -s * 0.65, s * 1.15, 0);
    ctx.quadraticCurveTo(s * 0.72, s * 0.65, 0, s * 0.52);
    ctx.quadraticCurveTo(-s * 0.72, s * 0.65, -s * 1.15, 0);
    ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.62, 0); ctx.lineTo(s * 0.62, 0); ctx.stroke();
    ctx.restore();
  }

  const baseDraw = window.draw;
  window.draw = function () {
    baseDraw.call(this);
    if (!window.INFINITE_BOSS_STATE?.active) return;
    for (const drone of state.drones) drawSupportDrone(drone);
  };
})();
