// INFINITY — evolved hunter boss, unlocked 60s after the Drone Carriers.
// Preview branch also supports a dedicated solo test fight.
(() => {
  'use strict';

  const BOSS_NAME = 'RAPTOR HUNTER';
  const DELAY_AFTER_FIRST_BOSS_SEC = 60;
  const HP = 640;
  const SCORE_REWARD = 10000;
  const SHOT_MIN = 280;
  const SHOT_MAX = 620;
  const PHASE2_SHOT_MIN = 190;
  const PHASE2_SHOT_MAX = 390;
  const MISSILE_MIN = 1900;
  const MISSILE_MAX = 3100;
  const PHASE2_MISSILE_MIN = 820;
  const PHASE2_MISSILE_MAX = 1450;
  const BULLET_SPEED = 5.6;
  const MISSILE_SPEED = 3.75;
  const MISSILE_TURN = 0.034;
  const MISSILE_MAX_SPEED = 4.65;
  const MAX_PROJECTILES = 42;
  const MISSILE_HP = 3;
  const BASE_MAX_MISSILES = 5;
  const PHASE2_MAX_MISSILES = 8;
  const PHASE2_THRESHOLD = 0.5;

  // Only the preview branch exposes this mode; production keeps the normal unlock flow.
  const SOLO_PREVIEW = location.hostname.includes('git-preview-boss-hunter-v2');
  const SOLO_POWER = 9;

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
      const a = Math.atan2(player.y - y, player.x - x);
      this.vx = Math.cos(a) * MISSILE_SPEED * S(1);
      this.vy = Math.sin(a) * MISSILE_SPEED * S(1);
      this.r = S(8); this.life = 430; this.phase = Math.random() * Math.PI * 2;
      this.hp = MISSILE_HP;
    }
    update(f) {
      if (!player) return;
      const dx = player.x - this.x, dy = player.y - this.y;
      const desired = Math.atan2(dy, dx);
      const current = Math.atan2(this.vy, this.vx);
      let delta = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
      delta = clamp(delta, -MISSILE_TURN * f, MISSILE_TURN * f);
      const angle = current + delta;
      const speed = Math.min(S(MISSILE_MAX_SPEED), Math.max(S(3.25), Math.hypot(this.vx, this.vy) + S(.018) * f));
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.x += this.vx * f; this.y += this.vy * f;
      this.life -= f; this.phase += .15 * f;
    }
    draw() {
      const pulse = 1 + Math.sin(this.phase) * .08;
      const len = Math.hypot(this.vx, this.vy) || 1;
      ctx.save();
      ctx.translate(this.x, this.y); ctx.rotate(Math.atan2(this.vy, this.vx)); ctx.scale(pulse, pulse);
      ctx.strokeStyle = '#ffd35a'; ctx.shadowColor = '#ff9f1a'; ctx.shadowBlur = S(12); ctx.lineWidth = S(2.2);
      ctx.beginPath(); ctx.moveTo(-S(13), 0); ctx.lineTo(S(6), 0); ctx.lineTo(S(10), -S(4)); ctx.moveTo(S(6), 0); ctx.lineTo(S(10), S(4)); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(S(8), 0, S(2.1), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.save(); ctx.globalAlpha = .32; ctx.strokeStyle = '#ffd35a'; ctx.lineWidth = S(2);
      ctx.beginPath(); ctx.moveTo(this.x - this.vx / len * S(16), this.y - this.vy / len * S(16)); ctx.lineTo(this.x, this.y); ctx.stroke(); ctx.restore();
      if (this.hp > 1) {
        ctx.save(); ctx.globalAlpha = .7; ctx.fillStyle = '#ffd35a';
        ctx.fillRect(this.x - S(8), this.y - S(12), S(16) * (this.hp / MISSILE_HP), S(1.8));
        ctx.restore();
      }
    }
    b() { return { x: this.x, y: this.y, r: this.r }; }
  }

  function createBoss() {
    const now = Date.now();
    return {
      startedAt: now,
      x: cx,
      y: -S(92),
      vx: S(1.15),
      vy: S(.7),
      hp: HP,
      maxHp: HP,
      phase: 'entry',
      phase2: false,
      angle: Math.PI,
      nextShotAt: now + 760,
      nextMissileAt: now + 1900,
      shots: [],
      missiles: [],
      hitUntil: 0,
      flashUntil: 0,
      hitStreak: 0,
      lastHitAt: 0,
      evadingUntil: 0,
      evasionCooldownUntil: 0,
      evasionDir: 1,
      evasionStrength: 0
    };
  }

  function enterPhase2() {
    if (!active || active.phase2) return;
    active.phase2 = true;
    active.hitStreak = 0;
    active.nextShotAt = Date.now() + 260;
    active.nextMissileAt = Date.now() + 700;
    active.vx *= 1.18;
    active.vy *= 1.08;
    burst(active.x, active.y, '#ff42d0', 26);
  }

  function fireShotPattern() {
    if (!active || !player || active.shots.length >= MAX_PROJECTILES) return;
    const angle = Math.atan2(player.y - active.y, player.x - active.x);
    const phase2 = active.phase2;
    const spread = phase2 ? .19 : .115;
    const offsets = phase2 ? [-spread, 0, spread] : [-spread, spread];
    for (const offset of offsets) {
      if (active.shots.length >= MAX_PROJECTILES) break;
      const a = angle + offset;
      active.shots.push(new BossShot(active.x, active.y + S(22), Math.cos(a) * S(BULLET_SPEED), Math.sin(a) * S(BULLET_SPEED)));
    }
    active.nextShotAt = Date.now() + randomBetween(phase2 ? PHASE2_SHOT_MIN : SHOT_MIN, phase2 ? PHASE2_SHOT_MAX : SHOT_MAX);
    active.flashUntil = Date.now() + 95;
  }

  function fireMissile() {
    if (!active || !player) return;
    const maxMissiles = active.phase2 ? PHASE2_MAX_MISSILES : BASE_MAX_MISSILES;
    if (active.missiles.length >= maxMissiles) return;
    const side = active.missiles.length % 2 === 0 ? -1 : 1;
    active.missiles.push(new BossMissile(active.x + side * S(24), active.y + S(8), player));
    active.nextMissileAt = Date.now() + randomBetween(active.phase2 ? PHASE2_MISSILE_MIN : MISSILE_MIN, active.phase2 ? PHASE2_MISSILE_MAX : MISSILE_MAX);
  }

  function triggerEvasion(now) {
    if (!active || now < active.evasionCooldownUntil || active.hitStreak < 5) return;
    const dx = active.x - player.x;
    const dy = active.y - player.y;
    // Move mainly perpendicular to the player->boss firing line, rather than teleporting away.
    const perpX = -dy;
    const perpY = dx;
    const side = (perpX * active.vx + perpY * active.vy) >= 0 ? -1 : 1;
    active.evasionDir = side;
    active.evasionStrength = 1;
    active.evadingUntil = now + (active.phase2 ? 720 : 620);
    active.evasionCooldownUntil = now + (active.phase2 ? 1150 : 1450);
    active.hitStreak = 0;
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
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.28); ctx.lineTo(s * .23, -.63 * s); ctx.lineTo(s * .95, -.28 * s); ctx.lineTo(s * 1.18, .10 * s);
    ctx.lineTo(s * .53, .05 * s); ctx.lineTo(s * .82, .58 * s); ctx.lineTo(s * .34, .47 * s); ctx.lineTo(s * .18, .88 * s);
    ctx.lineTo(s * .52, 1.08 * s); ctx.lineTo(s * .17, 1.00 * s); ctx.lineTo(0, 1.17 * s); ctx.lineTo(-s * .17, 1.00 * s);
    ctx.lineTo(-s * .52, 1.08 * s); ctx.lineTo(-s * .18, .88 * s); ctx.lineTo(-s * .34, .47 * s); ctx.lineTo(-s * .82, .58 * s);
    ctx.lineTo(-s * .53, .05 * s); ctx.lineTo(-s * 1.18, .10 * s); ctx.lineTo(-s * .95, -.28 * s); ctx.lineTo(-s * .23, -.63 * s); ctx.closePath(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.12); ctx.lineTo(0, s * .92); ctx.moveTo(-s * .60, -.22 * s); ctx.lineTo(0, .18 * s); ctx.lineTo(s * .60, -.22 * s);
    ctx.moveTo(-s * .37, .43 * s); ctx.lineTo(0, .26 * s); ctx.lineTo(s * .37, .43 * s); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * .25, .64 * s); ctx.lineTo(-s * .52, .97 * s); ctx.lineTo(-s * .34, .94 * s); ctx.moveTo(s * .25, .64 * s); ctx.lineTo(s * .52, .97 * s); ctx.lineTo(s * .34, .94 * s);
    ctx.moveTo(-s * .16, .82 * s); ctx.lineTo(-s * .16, 1.04 * s); ctx.moveTo(s * .16, .82 * s); ctx.lineTo(s * .16, 1.04 * s); ctx.stroke();
    if (muzzle) {
      ctx.globalAlpha = .9; ctx.strokeStyle = '#fff'; ctx.lineWidth = S(3);
      for (const x of active.phase2 ? [-.22, 0, .22] : [-.16, .16]) { ctx.beginPath(); ctx.moveTo(s * x, s * 1.08); ctx.lineTo(s * x, s * 1.34); ctx.stroke(); }
    }
    ctx.restore();

    const barW = Math.min(width * .74, S(310));
    const barH = S(9); const x = (width - barW) / 2; const y = S(44);
    ctx.save(); ctx.textAlign = 'center'; ctx.font = `bold ${Math.max(11, S(12))}px sans-serif`;
    ctx.fillStyle = '#fff'; ctx.globalAlpha = .92; ctx.fillText(active.phase2 ? `${BOSS_NAME} — PHASE II` : BOSS_NAME, cx, y - S(11)); ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = '#ff42d0'; ctx.fillRect(x, y, barW * clamp(b.hp / b.maxHp, 0, 1), barH); ctx.restore();
  }

  function damageBoss(amount) {
    if (!active) return;
    const now = Date.now();
    active.hp = Math.max(0, active.hp - amount);
    active.hitUntil = now + 75;
    if (now - active.lastHitAt < 420) active.hitStreak += 1;
    else active.hitStreak = 1;
    active.lastHitAt = now;
    if (!active.phase2 && active.hp <= active.maxHp * PHASE2_THRESHOLD) enterPhase2();
    triggerEvasion(now);
    if (active.hp <= 0) finishBoss();
  }

  function damageMissile(missile, amount) {
    missile.hp -= amount;
    burst(missile.x, missile.y, '#ffd35a', missile.hp > 0 ? 4 : 8);
    return missile.hp <= 0;
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
        const destroyed = damageMissile(missile, bullets[j].damage || 1);
        bullets.splice(j, 1);
        if (destroyed) active.missiles.splice(i, 1);
        break;
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
      active.y += S(.82) * f;
      if (active.y >= height * .20) active.phase = 'combat';
    } else {
      const dx = player.x - active.x;
      const dy = player.y - active.y;
      const desiredAngle = Math.atan2(dy, dx) + Math.PI / 2;
      let angleDelta = Math.atan2(Math.sin(desiredAngle - active.angle), Math.cos(desiredAngle - active.angle));
      angleDelta = clamp(angleDelta, -S(active.phase2 ? .14 : .115) * f, S(active.phase2 ? .14 : .115) * f);
      active.angle += angleDelta;

      const nowEvading = now < active.evadingUntil;
      const evade = nowEvading ? active.evasionDir : 0;
      const evadeAmplitude = active.phase2 ? S(155) : S(120);
      const desiredX = player.x + Math.sin(now / (active.phase2 ? 500 : 780)) * S(active.phase2 ? 62 : 42) + evade * evadeAmplitude;
      const desiredY = height * .19 + clamp((player.y - height * .55) * (active.phase2 ? .27 : .22), -S(80), S(active.phase2 ? 210 : 180));
      const steerX = clamp((desiredX - active.x) * (active.phase2 ? .00175 : .00145), -S(active.phase2 ? .12 : .10), S(active.phase2 ? .12 : .10));
      const steerY = clamp((desiredY - active.y) * (active.phase2 ? .00105 : .0009), -S(active.phase2 ? .07 : .055), S(active.phase2 ? .07 : .055));
      if (nowEvading) active.evasionStrength = Math.min(1, active.evasionStrength + .045 * f);
      else active.evasionStrength = Math.max(0, active.evasionStrength - .035 * f);
      active.vx = clamp((active.vx + steerX * f + evade * S(.055) * active.evasionStrength * f) * Math.pow(active.phase2 ? .978 : .982, f), -S(active.phase2 ? 5.25 : 4.4), S(active.phase2 ? 5.25 : 4.4));
      active.vy = clamp((active.vy + steerY * f) * Math.pow(active.phase2 ? .984 : .986, f), -S(active.phase2 ? 2.75 : 2.35), S(active.phase2 ? 2.75 : 2.35));
      active.x += active.vx * f;
      active.y += active.vy * f;
      active.x = clamp(active.x, S(58), width - S(58));
      active.y = clamp(active.y, S(82), height * .54);
    }

    if (now - active.lastHitAt > 520) active.hitStreak = 0;
    if (now >= active.nextShotAt) fireShotPattern();
    if (now >= active.nextMissileAt) fireMissile();

    active.shots.forEach(s => s.update(f));
    active.missiles.forEach(m => m.update(f));
    active.shots = active.shots.filter(s => s.life > 0 && s.x > -S(80) && s.x < width + S(80) && s.y > -S(100) && s.y < height + S(120));
    active.missiles = active.missiles.filter(m => m.life > 0 && m.x > -S(100) && m.x < width + S(100) && m.y > -S(120) && m.y < height + S(140));
    processBossCollisions();
  }

  function startSoloBoss() {
    if (!SOLO_PREVIEW || active || completedThisRun || !running) return;
    power = SOLO_POWER;
    if (powerEl) setHud(powerEl, 'power', 'Power', power);
    score = 0;
    if (scoreEl) setHud(scoreEl, 'score', 'Score', score);
    enemies.length = 0;
    enemyBullets.length = 0;
    powerups.length = 0;
    active = createBoss();
    burst(cx, height * .18, '#ff42d0', 35);
  }

  window.update = function () {
    const firstBoss = window.INFINITE_BOSS_STATE;
    const now = Date.now();
    const elapsed = secs();

    if (SOLO_PREVIEW && !completedThisRun && running && !active) startSoloBoss();
    if (!SOLO_PREVIEW && !completedThisRun && dueAtSec === null && firstBoss?.completed) dueAtSec = elapsed + DELAY_AFTER_FIRST_BOSS_SEC;
    if (!SOLO_PREVIEW && !active && !completedThisRun && dueAtSec !== null && elapsed >= dueAtSec && running) {
      active = createBoss(); enemies.length = 0; enemyBullets.length = 0; powerups.length = 0; burst(cx, height * .20, '#ff42d0', 35);
    }
    if (!active) { previousUpdate.call(this); return; }

    const f = now < slowUntil ? .32 : 1;
    player.update(targetX, targetY);
    shoot(now);
    stars.forEach(s => s.update(f));
    bullets.forEach(b => b.update(f));
    particles.forEach(p => p.update(f));
    bullets = bullets.filter(b => b.life > 0 && b.x > -S(120) && b.x < width + S(120) && b.y > -S(120) && b.y < height + S(120));
    particles = particles.filter(p => p.life > 0);
    enemies.length = 0;
    enemyBullets.length = 0;
    powerups.length = 0;
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
    if (SOLO_PREVIEW) {
      power = SOLO_POWER;
      if (powerEl) setHud(powerEl, 'power', 'Power', power);
    }
  };

  window.INFINITE_SECOND_BOSS_STATE = Object.freeze({
    get active() { return !!active; },
    get completed() { return completedThisRun; },
    get dueAt() { return dueAtSec; },
    get name() { return active ? BOSS_NAME : null; },
    get soloPreview() { return SOLO_PREVIEW; }
  });
})();
