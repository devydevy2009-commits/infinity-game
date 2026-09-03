// INFINITY — boss support-emitter visuals.
// Keeps the original diagonal barrage while giving every beam a visible source.
// Also fixes the boss trigger's seconds/milliseconds mismatch without disturbing
// the boss timing once the encounter is active.
// Visual-only layer: gameplay, collision radii and barrage geometry stay unchanged.
(() => {
  'use strict';

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
        state.drones.push({ lane, x: startX + lane * spacing, y: SUPPORT_Y });
      }
      state.lastBossActive = true;
    }
    const { spacing, startX } = laneGeometry();
    for (const drone of state.drones) drone.x = startX + drone.lane * spacing;
  }

  const realDateNow = Date.now;
  const baseUpdate = window.update;

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

  // Restore the normal enemy hit feedback: the existing hitUntil flash is
  // allowed to render again. No damage, particles or collision behavior changes.
  // Ghosts are visual-only reoriented toward the player and no longer spin.
  if (typeof Enemy !== 'undefined' && Enemy.prototype) {
    const baseEnemyUpdate = Enemy.prototype.update;
    const baseEnemyDraw = Enemy.prototype.draw;

    Enemy.prototype.update = function (f) {
      baseEnemyUpdate.call(this, f);
      if (this.kind === 'ghost' && player) {
        this.rot = Math.atan2(player.y - this.y, player.x - this.x) + Math.PI / 2;
      }
    };

    Enemy.prototype.draw = function () {
      if (this.kind !== 'ghost') return baseEnemyDraw.call(this);

      const flashing = Date.now() < this.hitUntil && Math.floor(Date.now() / 70) % 2 === 0;
      const color = flashing ? '#fff' : kindColor(this.kind);
      const s = this.size;
      const angle = player ? Math.atan2(player.y - this.y, player.x - this.x) + Math.PI / 2 : this.rot;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(angle);
      ctx.strokeStyle = color;
      ctx.lineWidth = S(2.8);
      ctx.globalAlpha = 0.7;

      // Directional ghost silhouette with a clear pointed nose.
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.22);
      ctx.lineTo(s * 0.62, -s * 0.35);
      ctx.lineTo(s * 0.82, s * 0.45);
      ctx.lineTo(0, s * 0.88);
      ctx.lineTo(-s * 0.82, s * 0.45);
      ctx.lineTo(-s * 0.62, -s * 0.35);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, s * 0.12, s * 0.48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.38, s * 0.25);
      ctx.lineTo(s * 0.38, s * 0.25);
      ctx.stroke();

      ctx.globalAlpha = 1;
      ctx.restore();
    };

    // The central Star-Destroyer drawing in boss_system.js uses +Y as its rear.
    // Add exactly 180° to its existing visual rotation, without touching its
    // position, collisions, HP, drones, bars or barrage behavior.
    const realRotate = ctx.rotate.bind(ctx);
    const realTranslate = ctx.translate.bind(ctx);
    let centralCarrierRotationPending = false;

    const baseDraw = window.draw;
    window.draw = function () {
      if (!window.INFINITE_BOSS_STATE?.active) return baseDraw.call(this);

      const originalTranslate = ctx.translate;
      const originalRotate = ctx.rotate;
      centralCarrierRotationPending = false;

      ctx.translate = function (x, y) {
        centralCarrierRotationPending = Math.abs(x - cx) < S(45) && y > height * 0.15 && y < height * 0.24;
        return realTranslate(x, y);
      };
      ctx.rotate = function (angle) {
        if (centralCarrierRotationPending) {
          centralCarrierRotationPending = false;
          return realRotate(angle + Math.PI);
        }
        return realRotate(angle);
      };

      try {
        baseDraw.call(this);
      } finally {
        ctx.translate = originalTranslate;
        ctx.rotate = originalRotate;
      }

      for (const drone of state.drones) drawSupportDrone(drone);
    };
  }

  function drawSupportDrone(drone) {
    const s = SUPPORT_SIZE;
    ctx.save();
    ctx.translate(drone.x, drone.y);
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
})();
