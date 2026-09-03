// INFINITY — boss support-emitter visuals.
// Keeps the original diagonal barrage while giving every beam a visible source.
// Also fixes the boss trigger's seconds/milliseconds mismatch without disturbing
// the boss timing once the encounter is active.
(() => {
  'use strict';

  // Must mirror boss_system.js exactly: 10 lanes, with 2 permanent gaps.
  const BARRAGE_LANES = 10;
  const GAP_LANES = new Set([3, 7]);
  const LANE_SPACING = 58;
  const SUPPORT_Y = S(24);
  const SUPPORT_SIZE = S(8);
  const state = { drones: [], lastBossActive: false };

  function laneGeometry() {
    const spacing = Math.max(S(LANE_SPACING), width / (BARRAGE_LANES + 1));
    const startX = cx - spacing * ((BARRAGE_LANES - 1) / 2);
    return { spacing, startX };
  }

  function ensureSupportDrones() {
    const active = !!window.INFINITE_BOSS_STATE?.active;
    if (!active) {
      state.drones.length = 0;
      state.lastBossActive = false;
      return;
    }
    if (!state.lastBossActive) {
      const { spacing, startX } = laneGeometry();
      state.drones.length = 0;
      for (let lane = 0; lane < BARRAGE_LANES; lane++) {
        if (GAP_LANES.has(lane)) continue;
        state.drones.push({
          lane,
          x: startX + lane * spacing,
          y: SUPPORT_Y
        });
      }
      state.lastBossActive = true;
    }

    // Recalculate only the eight emitter positions; no allocations per frame.
    const { spacing, startX } = laneGeometry();
    for (const drone of state.drones) drone.x = startX + drone.lane * spacing;
  }

  const realDateNow = Date.now;
  const baseUpdate = window.update;

  // boss_system.js stores bossTriggerAt in elapsed seconds, while its trigger
  // check uses Date.now(). We only translate that first read while the boss is
  // NOT active. Once the boss starts, every Date.now() call remains the real
  // epoch timestamp, so barrage timing, movement, muzzle flashes and cleanup
  // use exactly the same clock as the original boss implementation.
  window.update = function () {
    ensureSupportDrones();

    const bossActive = !!window.INFINITE_BOSS_STATE?.active;
    const elapsedSeconds = typeof secs === 'function' ? secs() : 0;
    let firstDateNowCall = true;

    Date.now = function () {
      if (firstDateNowCall) {
        firstDateNowCall = false;
        Date.now = realDateNow;
        return bossActive ? realDateNow() : elapsedSeconds;
      }
      return realDateNow();
    };

    try {
      return baseUpdate.call(this);
    } finally {
      Date.now = realDateNow;
    }
  };

  function drawSupportDrone(drone) {
    const s = SUPPORT_SIZE;
    ctx.save();
    ctx.translate(drone.x, drone.y);

    // Cover the old diamond emitter underneath, then draw the requested
    // short chunky cigar silhouette in the same neon line-art style.
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.45, s * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ff9a3d';
    ctx.lineWidth = S(1.8);
    ctx.beginPath();
    ctx.moveTo(-s * 1.15, 0);
    ctx.quadraticCurveTo(-s * 0.72, -s * 0.65, 0, -s * 0.52);
    ctx.quadraticCurveTo(s * 0.72, -s * 0.65, s * 1.15, 0);
    ctx.quadraticCurveTo(s * 0.72, s * 0.65, 0, s * 0.52);
    ctx.quadraticCurveTo(-s * 0.72, s * 0.65, -s * 1.15, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.62, 0);
    ctx.lineTo(s * 0.62, 0);
    ctx.stroke();
    ctx.restore();
  }

  const baseDraw = window.draw;
  window.draw = function () {
    baseDraw.call(this);
    if (!window.INFINITE_BOSS_STATE?.active) return;
    for (const drone of state.drones) drawSupportDrone(drone);
  };
})();