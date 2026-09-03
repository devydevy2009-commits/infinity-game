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

  // boss_system.js stores bossTriggerAt in elapsed seconds, while its trigger
  // check uses Date.now(). Translate only the first read before the boss starts.
  // During the boss encounter Date.now() remains the real epoch timestamp.
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

  // Enemies no longer use the temporary hit-flash overlay. Their normal neon
  // identity color remains unchanged, as do damage, particles and collisions.
  if (typeof Enemy !== 'undefined' && Enemy.prototype?.draw) {
    const baseEnemyDraw = Enemy.prototype.draw;
    Enemy.prototype.draw = function () {
      const hitUntil = this.hitUntil;
      this.hitUntil = 0;
      try {
        return baseEnemyDraw.call(this);
      } finally {
        this.hitUntil = hitUntil;
      }
    };
  }

  // Local visual mirror of the carrier motion. The real Carrier objects remain
  // untouched, so collision bounds, HP and movement logic cannot be affected.
  const carrierVisual = {
    active: false,
    startedAt: 0,
    phase: [0, 1.4, 2.8],
    y: [-S(95), -S(107), -S(107)]
  };

  function syncCarrierVisuals(now) {
    const active = !!window.INFINITE_BOSS_STATE?.active;
    if (!active) {
      carrierVisual.active = false;
      return;
    }
    if (!carrierVisual.active) {
      carrierVisual.active = true;
      carrierVisual.startedAt = now;
      carrierVisual.phase = [0, 1.4, 2.8];
      carrierVisual.y = [-S(95), -S(107), -S(107)];
    }

    const elapsed = Math.max(0, now - carrierVisual.startedAt);
    const f = elapsed < 900 ? 0.32 : 1;
    for (let i = 0; i < 3; i++) {
      carrierVisual.phase[i] += 0.010 * f;
      const targetY = height * (i === 1 ? 0.21 : 0.26);
      if (carrierVisual.y[i] < targetY) carrierVisual.y[i] = Math.min(targetY, carrierVisual.y[i] + S(0.72) * f);
    }
  }

  function coverCarrier(x, y, length, width) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(0, -length * 0.66);
    ctx.lineTo(width * 0.72, -length * 0.34);
    ctx.lineTo(width * 0.58, length * 0.40);
    ctx.lineTo(width * 0.28, length * 0.58);
    ctx.lineTo(0, length * 0.66);
    ctx.lineTo(-width * 0.28, length * 0.58);
    ctx.lineTo(-width * 0.58, length * 0.40);
    ctx.lineTo(-width * 0.72, -length * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawCentralCarrier(x, y, angle) {
    const l = S(82);
    const w = S(25);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = '#ff3d3d';
    ctx.lineWidth = S(3.2);
    ctx.lineJoin = 'miter';

    // Broad rear + extremely pointed bow: Star-Destroyer-inspired geometry,
    // but rebuilt as Infinity's own neon line-art silhouette.
    ctx.beginPath();
    ctx.moveTo(0, -l * 0.72);
    ctx.lineTo(w * 0.62, l * 0.34);
    ctx.lineTo(w * 0.95, l * 0.48);
    ctx.lineTo(w * 0.46, l * 0.57);
    ctx.lineTo(w * 0.28, l * 0.69);
    ctx.lineTo(-w * 0.28, l * 0.69);
    ctx.lineTo(-w * 0.46, l * 0.57);
    ctx.lineTo(-w * 0.95, l * 0.48);
    ctx.lineTo(-w * 0.62, l * 0.34);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -l * 0.55);
    ctx.lineTo(w * 0.44, l * 0.30);
    ctx.lineTo(0, l * 0.47);
    ctx.lineTo(-w * 0.44, l * 0.30);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-w * 0.54, l * 0.39);
    ctx.lineTo(w * 0.54, l * 0.39);
    ctx.moveTo(-w * 0.40, l * 0.52);
    ctx.lineTo(w * 0.40, l * 0.52);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -l * 0.18);
    ctx.lineTo(0, l * 0.28);
    ctx.moveTo(-w * 0.22, l * 0.02);
    ctx.lineTo(w * 0.22, l * 0.02);
    ctx.stroke();

    for (const ex of [-0.36, -0.12, 0.12, 0.36]) {
      ctx.beginPath();
      ctx.moveTo(w * ex, l * 0.55);
      ctx.lineTo(w * ex, l * 0.70);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSideCarrier(x, y, angle) {
    const l = S(70);
    const w = S(21);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = '#ff7a3d';
    ctx.lineWidth = S(2.5);
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(0, -l * 0.62);
    ctx.lineTo(w * 0.70, -l * 0.43);
    ctx.lineTo(w * 0.84, l * 0.33);
    ctx.lineTo(w * 0.58, l * 0.53);
    ctx.lineTo(w * 0.32, l * 0.62);
    ctx.lineTo(-w * 0.32, l * 0.62);
    ctx.lineTo(-w * 0.58, l * 0.53);
    ctx.lineTo(-w * 0.84, l * 0.33);
    ctx.lineTo(-w * 0.70, -l * 0.43);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-w * 0.56, -l * 0.17);
    ctx.lineTo(w * 0.56, -l * 0.17);
    ctx.moveTo(-w * 0.62, l * 0.16);
    ctx.lineTo(w * 0.62, l * 0.16);
    ctx.moveTo(0, -l * 0.43);
    ctx.lineTo(0, l * 0.48);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-w * 0.62, l * 0.34);
    ctx.lineTo(w * 0.62, l * 0.34);
    ctx.moveTo(-w * 0.38, l * 0.51);
    ctx.lineTo(w * 0.38, l * 0.51);
    ctx.stroke();
    ctx.restore();
  }

  function drawCarrierOverlay(now) {
    syncCarrierVisuals(now);
    if (!carrierVisual.active) return;

    for (let i = 0; i < 3; i++) {
      const central = i === 1;
      const x = cx + (i - 1) * S(122) + Math.sin(carrierVisual.phase[i]) * S(0.32);
      const y = carrierVisual.y[i];
      const length = central ? S(82) : S(70);
      const widthValue = central ? S(25) : S(21);
      coverCarrier(x, y, length, widthValue);
      const angle = Math.sin(carrierVisual.phase[i]) * 0.035;
      if (central) drawCentralCarrier(x, y, angle);
      else drawSideCarrier(x, y, angle);
    }
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

  const baseDraw = window.draw;
  window.draw = function () {
    baseDraw.call(this);
    if (!window.INFINITE_BOSS_STATE?.active) return;
    drawCarrierOverlay(realDateNow());
    for (const drone of state.drones) drawSupportDrone(drone);
  };
})();