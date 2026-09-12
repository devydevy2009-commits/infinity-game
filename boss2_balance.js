// INFINITY — second-boss difficulty pass.
// The original boss module stays isolated; this layer adds a controlled armor
// multiplier and a separate homing-salvo channel so the encounter is harder
// without touching the first boss or the normal enemy traffic.
(() => {
  'use strict';

  const baseUpdate = window.update;
  const baseDraw = window.draw;
  const baseResetGame = window.resetGame;

  const ARMOR_DAMAGE_MULTIPLIER = 2 / 3; // 360 effective HP -> ~540 effective HP.
  const EXTRA_MISSILE_INTERVAL = 1250;
  const EXTRA_MISSILE_SPEED = 2.8;
  const EXTRA_MISSILE_TURN = 0.028;
  const EXTRA_MISSILE_CAP = 5;

  let nextMissileAt = 0;
  let extraMissiles = [];

  function active() {
    return !!window.INFINITE_BOSS_STATE?.active;
  }

  function spawnExtraMissile() {
    if (!active() || !player || extraMissiles.length >= EXTRA_MISSILE_CAP) return;
    const x = cx + (Math.random() - 0.5) * S(70);
    const y = height * 0.20 + S(12);
    const angle = Math.atan2(player.y - y, player.x - x);
    extraMissiles.push({
      x,
      y,
      vx: Math.cos(angle) * S(EXTRA_MISSILE_SPEED),
      vy: Math.sin(angle) * S(EXTRA_MISSILE_SPEED),
      r: S(6.5),
      life: 320,
      phase: Math.random() * Math.PI * 2
    });
  }

  function updateExtraMissiles(f) {
    for (const missile of extraMissiles) {
      if (player) {
        const desired = Math.atan2(player.y - missile.y, player.x - missile.x);
        const current = Math.atan2(missile.vy, missile.vx);
        let delta = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
        delta = clamp(delta, -EXTRA_MISSILE_TURN * f, EXTRA_MISSILE_TURN * f);
        const angle = current + delta;
        const speed = Math.hypot(missile.vx, missile.vy) || S(EXTRA_MISSILE_SPEED);
        missile.vx = Math.cos(angle) * speed;
        missile.vy = Math.sin(angle) * speed;
      }
      missile.x += missile.vx * f;
      missile.y += missile.vy * f;
      missile.life -= f;
      missile.phase += 0.14 * f;
    }

    for (let i = extraMissiles.length - 1; i >= 0; i--) {
      const missile = extraMissiles[i];

      for (let j = bullets.length - 1; j >= 0; j--) {
        if (!overlap(missile, bullets[j].b())) continue;
        bullets.splice(j, 1);
        burst(missile.x, missile.y, '#ffd35a', 8);
        extraMissiles.splice(i, 1);
        break;
      }
      if (!extraMissiles[i]) continue;

      if (overlap(player.b(), missile)) {
        extraMissiles.splice(i, 1);
        burst(missile.x, missile.y, '#ffd35a', 12);
        damage();
        continue;
      }

      if (missile.life <= 0 || missile.x < -S(100) || missile.x > width + S(100) || missile.y < -S(120) || missile.y > height + S(140)) {
        extraMissiles.splice(i, 1);
      }
    }
  }

  function drawExtraMissiles() {
    for (const missile of extraMissiles) {
      const len = Math.hypot(missile.vx, missile.vy) || 1;
      ctx.save();
      ctx.strokeStyle = '#ffd35a';
      ctx.shadowColor = '#ff9f1a';
      ctx.shadowBlur = S(11);
      ctx.lineWidth = S(2.2);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(missile.x - missile.vx / len * S(13), missile.y - missile.vy / len * S(13));
      ctx.lineTo(missile.x, missile.y);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(missile.x, missile.y, S(2.2), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function applyArmorToExistingBullets() {
    if (!active()) return;
    for (const bullet of bullets) {
      if (bullet.boss2ArmorApplied) continue;
      bullet.damage *= ARMOR_DAMAGE_MULTIPLIER;
      bullet.boss2ArmorApplied = true;
    }
  }

  window.update = function () {
    if (!active()) {
      extraMissiles.length = 0;
      nextMissileAt = 0;
      baseUpdate.call(this);
      return;
    }

    // Bullets from the previous frame are the ones about to be tested by the
    // boss. Scale them once, producing the requested higher effective HP.
    applyArmorToExistingBullets();
    baseUpdate.call(this);

    if (!active()) {
      extraMissiles.length = 0;
      nextMissileAt = 0;
      return;
    }

    const now = Date.now();
    if (!nextMissileAt) nextMissileAt = now + 850;
    if (now >= nextMissileAt) {
      spawnExtraMissile();
      nextMissileAt = now + EXTRA_MISSILE_INTERVAL;
    }

    const f = now < slowUntil ? 0.32 : 1;
    updateExtraMissiles(f);
  };

  window.draw = function () {
    baseDraw.call(this);
    if (active()) drawExtraMissiles();
  };

  window.resetGame = function () {
    extraMissiles.length = 0;
    nextMissileAt = 0;
    baseResetGame.call(this);
  };
})();
