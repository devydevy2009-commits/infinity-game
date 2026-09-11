// INFINITY — evolved hunter boss, unlocked 60s after the Drone Carriers.
// Kept isolated from the first boss so the original encounter remains stable.
(() => {
  'use strict';

  const BOSS_NAME = 'RAPTOR HUNTER';
  const DELAY_AFTER_FIRST_BOSS_SEC = 60;
  const HP = 360;
  const SCORE_REWARD = 10000;
  const DOUBLE_SHOT_MIN = 360;
  const DOUBLE_SHOT_MAX = 820;
  const MISSILE_MIN = 2600;
  const MISSILE_MAX = 4300;
  const BULLET_SPEED = 5.2;
  const MISSILE_SPEED = 2.65;
  const MISSILE_TURN = 0.026;
  const MAX_PROJECTILES = 42;

  let active = null;
  let dueAtSec = null;
  let completedThisRun = false;

  const previousUpdate = window.update;
  const previousDraw = window.draw;
  const previousReset = window.resetGame;

  function randomBetween(a, b) { return a + Math.random() * (b - a); }

  class BossShot {
    constructor(x, y, vx, vy) {
      this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.r = S(4.8); this.life = 260; this.phase = Math.random() * Math.PI * 2;
      this.kind = 'boss2';
    }
    update(f) { this.x += this.vx * f; this.y += this.vy * f; this.life -= f; this.phase += 0.16 * f; }
    draw() {
      const len = Math.hypot(this.vx, this.vy) || 1;
      const trail = this.r * 3.2;
      ctx.save();
      ctx.strokeStyle = '#ff6b5f'; ctx.shadowColor = '#ff3d3d'; ctx.shadowBlur = S(9);
      ctx.lineWidth = this.r * 1.25; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.x - this.vx / len * trail, this.y - this.vy / len * trail);
      ctx.lineTo(this.x, this.y); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(this.x, this.y, this.r * .72, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    b() { return { x: this.x, y: this.y, r: this.r }; }
  }

  class BossMissile {
    constructor(x, y, target) {
      this.x = x; this.y = y; this.target = target;
      this.vx = 0; this.vy = MISSILE_SPEED * S(1);
      this.r = S(7); this.life = 360; this.phase = Math.random() * Math.PI * 2;
    }
    update(f) {
      if (!player) return;
      const dx = player.x - this.x, dy = player.y - this.y;
      const desired = Math.atan2(dy, dx);
      const current = Math.atan2(this.vy, this.vx);
      let delta = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
      delta = clamp(delta, -MISSILE_TURN * f, MISSILE_TURN * f);
      const angle = current + delta;
      const speed = Math.max(S(2.25), Math.min(S(3.05), Math.hypot(this.vx, this.vy) + S(.008) * f));
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.x += this.vx * f; this.y += this.vy * f;
      this.life -= f; this.phase += .12 * f;
    }
    draw() {
      const pulse = 1 + Math.sin(this.phase) * .08;
      const len = Math.hypot(this.vx, this.vy) || 1;
      ctx.save();
      ctx.translate(this.x, this.y); ctx.rotate(Math.atan2(this.vy, this.vx)); ctx.scale(pulse, pulse);
      ctx.strokeStyle = '#ffd35a'; ctx.shadowColor = '#ff9f1a'; ctx.shadowBlur = S(12); ctx.lineWidth = S(2.2);
      ctx.beginPath(); ctx.moveTo(-S(11), 0); ctx.lineTo(S(5), 0); ctx.lineTo(S(9), -S(4)); ctx.moveTo(S(5), 0); ctx.lineTo(S(9), S(4)); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(S(7), 0, S(2.1), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.save(); ctx.globalAlpha = .32; ctx.strokeStyle = '#ffd35a'; ctx.lineWidth = S(2);
      ctx.beginPath(); ctx.moveTo(this.x - this.vx / len * S(13), this.y - this.vy / len * S(13)); ctx.lineTo(this.x, this.y); ctx.stroke(); ctx.restore();
    }
    b() { return { x: this.x, y: this.y, r: this.r }; }
  }

  function createBoss() {
    const now = Date.now();
    return {
      startedAt: now,
      x: cx,
      y: -S(92),
      vx: S(1.0),
      vy: S(.55),
      hp: HP,
      maxHp: HP,
      phase: 'entry',
      angle: 0,
      nextShotAt: now + 850,
      nextMissileAt: now + 2500,
      shots: [],
      missiles: [],
      hitUntil: 0,
      flashUntil: 0
    };
  }

  function fireDoubleShot() {
    if (!active || active.shots.length >= MAX_PROJECTILES || !player) return;
    const angle = Math.atan2(player.y - active.y, player.x - active.x);
    const spread = .115;
    for (const offset of [-spread, spread]) {
      const a = angle + offset;
      active.shots.push(new BossShot(active.x, active.y + S(22), Math.cos(a) * S(BULLET_SPEED), Math.sin(a) * S(BULLET_SPEED)));
    }
    active.nextShotAt = Date.now() + randomBetween(DOUBLE_SHOT_MIN, DOUBLE_SHOT_MAX);
    active.flashUntil = Date.now() + 95;
  }

  function fireMissile() {
    if (!active || active.missiles.length >= 4 || !player) return;
    const side = active.missiles.length % 2 === 0 ? -1 : 1;
    active.missiles.push(new BossMissile(active.x + side * S(22), active.y + S(8), player));
    active.nextMissileAt = Date.now() + randomBetween(MISSILE_MIN, MISSILE_MAX);
  }

  function drawBoss() {
    if (!active) return;
    const b = active;
    const flash = Date.now() < b.hitUntil && Math.floor(Date.now() / 65) % 2 === 0;
    const muzzle = Date.now() < b.flashUntil;
    const s = S(46);
    const color = flash ? '#fff' : '#ff42d0';

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.strokeStyle = color; ctx.lineWidth = S(2.8); ctx.lineJoin = 'miter';
    ctx.shadowColor = color; ctx.shadowBlur = S(9);

    // Angular stealth-fighter silhouette inspired by the broad planform of modern twin-tail fighters.
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.28);
    ctx.lineTo(s * .23, -.63 * s);
    ctx.lineTo(s * .95, -.28 * s);
    ctx.lineTo(s * 1.18, .10 * s);
    ctx.lineTo(s * .53, .05 * s);
    ctx.lineTo(s * .82, .58 * s);
    ctx.lineTo(s * .34, .47 * s);
    ctx.lineTo(s * .18, .88 * s);
    ctx.lineTo(s * .52, 1.08 * s);
    ctx.lineTo(s * .17, 1.00 * s);
    ctx.lineTo(0, 1.17 * s);
    ctx.lineTo(-s * .17, 1.00 * s);
    ctx.lineTo(-s * .52, 1.08 * s);
    ctx.lineTo(-s * .18, .88 * s);
    ctx.lineTo(-s * .34, .47 * s);
    ctx.lineTo(-s * .82, .58 * s);
    ctx.lineTo(-s * .53, .05 * s);
    ctx.lineTo(-s * 1.18, .10 * s);
    ctx.lineTo(-s * .95, -.28 * s);
    ctx.lineTo(-s * .23, -.63 * s);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -s * 1.12); ctx.lineTo(0, s * .92);
    ctx.moveTo(-s * .60, -.22 * s); ctx.lineTo(0, .18 * s); ctx.lineTo(s * .60, -.22 * s);
    ctx.moveTo(-s * .37, .43 * s); ctx.lineTo(0, .26 * s); ctx.lineTo(s * .37, .43 * s);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-s * .25, .64 * s); ctx.lineTo(-s * .52, .97 * s); ctx.lineTo(-s * .34, .94 * s);
    ctx.moveTo(s * .25, .64 * s); ctx.lineTo(s * .52, .97 * s); ctx.lineTo(s * .34, .94 * s);
    ctx.moveTo(-s * .16, .82 * s); ctx.lineTo(-s * .16, 1.04 * s);
    ctx.moveTo(s * .16, .82 * s); ctx.lineTo(s * .16, 1.04 * s);
    ctx.stroke();

    if (muzzle) {
      ctx.globalAlpha = .9; ctx.strokeStyle = '#fff'; ctx.lineWidth = S(3);
      for (const x of [-.16, .16]) {
        ctx.beginPath(); ctx.moveTo(s * x, s * 1.08); ctx.lineTo(s * x, s * 1.34); ctx.stroke();
      }
    }
    ctx.restore();

    const barW = Math.min(width * .74, S(310));
    const barH = S(9); const x = (width - barW) / 2; const y = S(44);
    ctx.save(); ctx.textAlign = 'center'; ctx.font = `bold ${Math.max(11, S(12))}px sans-serif`;
    ctx.fillStyle = '#fff'; ctx.globalAlpha = .92; ctx.fillText(BOSS_NAME, cx, y - S(11)); ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = '#ff42d0'; ctx.fillRect(x, y, barW * clamp(b.hp / b.maxHp, 0, 1), barH); ctx.restore();
  }

  function damageBoss(amount) {
    if (!active) return;
    active.hp = Math.max(0, active.hp - amount);
    active.hitUntil = Date.now() + 75;
    if (active.hp <= 0) finishBoss();
  }

  function dropRewards(x, y) {
    if (typeof spawnLifeReward === 'function') spawnLifeReward();
    const reward = new Powerup();
    reward.x = clamp(x + S(30), S(28), width - S(28));
    reward.y = y;
    powerups.push(reward);
  }

  function finishBoss() {
    if (!active) return;
    const x = active.x, y = active.y;
    burst(x, y, '#ff42d0', 70);
    score += SCORE_REWARD;
    setHud(scoreEl, 'score', 'Score', score);
    dropRewards(x, y);
    active = null;
    completedThisRun = true;
  }

  function processBossCollisions() {
    if (!active || !player) return;
    const pb = player.b();

    for (let i = bullets.length - 1; i >= 0; i--) {
      if (!active || !overlap({ x: active.x, y: active.y, r: S(45) }, bullets[i].b())) continue;
      damageBoss(bullets[i].damage || 1);
      bullets.splice(i, 1);
      if (!active) return;
    }

    for (let i = active.shots.length - 1; i >= 0; i--) {
      const shot = active.shots[i];
      if (overlap(pb, shot.b())) { active.shots.splice(i, 1); damage(); }
    }
    if (!active) return;

    for (let i = active.missiles.length - 1; i >= 0; i--) {
      const missile = active.missiles[i];
      for (let j = bullets.length - 1; j >= 0; j--) {
        if (!overlap(missile.b(), bullets[j].b())) continue;
        bullets.splice(j, 1); burst(missile.x, missile.y, '#ffd35a', 8); active.missiles.splice(i, 1); break;
      }
      if (!active?.missiles.includes(missile)) continue;
      if (overlap(pb, missile.b())) { active.missiles.splice(i, 1); burst(missile.x, missile.y, '#ffd35a', 12); damage(); }
    }

    if (active && overlap(pb, { x: active.x, y: active.y, r: S(40) })) damage();
  }

  function updateBoss(now) {
    if (!active || !player) return;
    const f = now < slowUntil ? .32 : 1;

    if (active.phase === 'entry') {
      active.y += S(.72) * f;
      if (active.y >= height * .20) active.phase = 'combat';
    } else {
      const targetX = player.x + Math.sin(now / 1100) * S(85);
      const dx = targetX - active.x;
      active.vx += clamp(dx * .00095, -S(.06), S(.06)) * f;
      active.vx *= Math.pow(.985, f);
      active.vx = clamp(active.vx, -S(3.0), S(3.0));
      active.x += active.vx * f;
      active.x = clamp(active.x, S(58), width - S(58));
      active.y = height * .20 + Math.sin(now / 1200) * S(20);
      active.angle = clamp(active.vx / S(7), -.28, .28);
    }

    if (now >= active.nextShotAt) fireDoubleShot();
    if (now >= active.nextMissileAt) fireMissile();

    active.shots.forEach(s => s.update(f));
    active.missiles.forEach(m => m.update(f));
    active.shots = active.shots.filter(s => s.life > 0 && s.x > -S(80) && s.x < width + S(80) && s.y > -S(100) && s.y < height + S(120));
    active.missiles = active.missiles.filter(m => m.life > 0 && m.x > -S(100) && m.x < width + S(100) && m.y > -S(120) && m.y < height + S(140));
    processBossCollisions();
  }

  window.update = function () {
    const firstBoss = window.INFINITE_BOSS_STATE;
    const now = Date.now();
    const elapsed = secs();

    if (!completedThisRun && dueAtSec === null && firstBoss?.completed) {
      dueAtSec = elapsed + DELAY_AFTER_FIRST_BOSS_SEC;
    }

    if (!active && !completedThisRun && dueAtSec !== null && elapsed >= dueAtSec && running) {
      active = createBoss();
      enemies.length = 0; enemyBullets.length = 0; powerups.length = 0;
      burst(cx, height * .20, '#ff42d0', 35);
    }

    previousUpdate.call(this);

    if (!active) return;
    enemies.length = 0;
    enemyBullets.length = 0;
    updateBoss(now);
  };

  window.draw = function () {
    previousDraw.call(this);
    if (!active) return;
    active.shots.forEach(s => s.draw());
    active.missiles.forEach(m => m.draw());
    drawBoss();
  };

  window.resetGame = function () {
    active = null;
    dueAtSec = null;
    completedThisRun = false;
    previousReset.call(this);
  };

  window.INFINITE_SECOND_BOSS_STATE = Object.freeze({
    get active() { return !!active; },
    get completed() { return completedThisRun; },
    get dueAt() { return dueAtSec; },
    get name() { return active ? BOSS_NAME : null; }
  });
})();
