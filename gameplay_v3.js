// Infinity gameplay v3: denser waves, top + side entries, controlled randomness,
// precise enemy scoring, 3-level weapon progression, and full Hard Mode scaling.
(() => {
  const BASE_KILL_SCORE = 100;
  const SCORE_BY_KIND = { basic: 1, armored: 1.5, shooter: 2, hunter: 3 };
  const NORMAL_SPAWN_START = 520;
  const NORMAL_SPAWN_MIN = 300;
  const WAVE_INTERVAL = 12000;
  const POWERUP_INTERVAL = 17000;
  const LOWER_THIRD = 0.68;

  let nextEnemyAt = 0;
  let nextWaveAt = 0;
  let nextPowerupAt = 0;
  let powerupPressure = false;
  let powerupIndex = 0;
  let waveIndex = 0;

  const hardMultiplier = () => (typeof hardMode !== 'undefined' && hardMode ? 2 : 1);
  const powerupMultiplier = () => powerupPressure ? 2 : 1;
  const difficultyMultiplier = () => hardMultiplier() * powerupMultiplier();
  const elapsedMsV3 = () => startTime ? Math.max(0, Date.now() - startTime) : 0;

  // Lower starting firepower than before. Every 3 power levels adds one gun;
  // levels between gun upgrades only improve projectile speed and cadence.
  powerTable.forEach((p, i) => {
    p.cooldown = Math.max(52, 155 - i * 2.05);
    p.speed = 10 + i * 0.18;
    p.side = false; p.wide = false; p.back = false; p.quad = false;
    p.heavy = false; p.rapid = false;
  });

  function gunCount() { return Math.min(9, 1 + Math.floor(power / 3)); }
  function playerDamage() { return (1 + Math.floor(power / 9)) * hardMultiplier(); }

  function randomKind(t) {
    const r = Math.random();
    if (t >= 8 && r < 0.10) return 'hunter';
    if (t >= 4 && r < 0.30) return 'armored';
    if (t >= 2 && r < 0.62) return 'shooter';
    return 'basic';
  }

  function setupEnemy(e, x, y, targetX = cx, targetY = height * (0.48 + Math.random() * 0.12)) {
    e.x = x; e.y = y;
    const dx = targetX - x, dy = targetY - y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const t = tier();
    const speed = S((1.55 + Math.random() * 0.55) * (1 + Math.min(t, 20) * 0.075) * hardMultiplier());
    e.vx = dx / d * speed;
    e.vy = dy / d * speed;
    const baseHp = e.kind === 'armored' ? 3 + Math.floor(power / 12) : 1 + Math.floor(t / 10);
    e.hp = baseHp * hardMultiplier();
    e.hitUntil = 0;
    e._v3 = true;
    return e;
  }

  function spawnEnemy(kind, edge = null, forcedX = null, forcedY = null) {
    const chosenEdge = edge || (Math.random() < 0.52 ? 'top' : (Math.random() < 0.5 ? 'left' : 'right'));
    let x, y, tx = cx, ty = height * (0.45 + Math.random() * 0.16);
    if (chosenEdge === 'left') {
      x = -S(34); y = height * (0.10 + Math.random() * 0.54); tx = width * (0.35 + Math.random() * 0.3);
    } else if (chosenEdge === 'right') {
      x = width + S(34); y = height * (0.10 + Math.random() * 0.54); tx = width * (0.35 + Math.random() * 0.3);
    } else {
      x = width * (0.08 + Math.random() * 0.84); y = -S(34); tx = width * (0.20 + Math.random() * 0.60);
    }
    if (forcedX !== null) x = forcedX;
    if (forcedY !== null) y = forcedY;
    const e = kind === 'hunter' && typeof HunterEnemy !== 'undefined' ? new HunterEnemy() : new Enemy(kind);
    setupEnemy(e, x, y, tx, ty);
    enemies.push(e);
    return e;
  }

  function spawnFormation() {
    const t = tier();
    const hard = hardMultiplier();
    const count = Math.min(14, 6 + Math.floor(t / 3)) * hard;
    const sideEntry = Math.random() < 0.32;
    const center = sideEntry
      ? (Math.random() < 0.5 ? -S(36) : width + S(36))
      : width * (0.20 + Math.random() * 0.60);
    const startY = sideEntry ? height * (0.20 + Math.random() * 0.28) : -S(42);
    const kinds = [];
    for (let i = 0; i < count; i++) kinds.push(randomKind(t));

    // 1-2-3-4 triangular formation, with a bounded amount of randomness.
    let made = 0, row = 0;
    while (made < count) {
      const rowCount = Math.min(4, row + 1);
      for (let col = 0; col < rowCount && made < count; col++) {
        const offset = (col - (rowCount - 1) / 2) * S(46);
        const x = sideEntry ? center : center + offset;
        const y = sideEntry ? startY + row * S(42) : startY - row * S(40);
        const edge = sideEntry ? (center < 0 ? 'left' : 'right') : 'top';
        spawnEnemy(kinds[made], edge, x, y);
        made++;
      }
      row++;
    }
    waveIndex++;
  }

  spawn = function spawnV3() {
    if (!running || paused) return;
    const now = Date.now();
    const t = tier();
    const cap = (18 + Math.floor(t * 1.6)) * hardMultiplier();
    const interval = Math.max(NORMAL_SPAWN_MIN, NORMAL_SPAWN_START - Math.min(t, 20) * 10) / hardMultiplier();

    if (!nextEnemyAt) nextEnemyAt = now + 500;
    if (now >= nextEnemyAt) {
      if (enemies.length < cap) spawnEnemy(randomKind(t));
      nextEnemyAt += interval;
    }

    // Formations are guaranteed regularly, but their edge, composition and size still vary.
    if (!nextWaveAt) nextWaveAt = now + WAVE_INTERVAL;
    if (now >= nextWaveAt) {
      spawnFormation();
      nextWaveAt += WAVE_INTERVAL;
    }

    // Powerups use a predictable cadence and cycling lanes, with only a small position jitter.
    if (!nextPowerupAt) nextPowerupAt = now + POWERUP_INTERVAL;
    if (now >= nextPowerupAt && powerups.length === 0) {
      spawnPowerupV3();
      nextPowerupAt += POWERUP_INTERVAL;
    }
  };

  function spawnPowerupV3() {
    const p = new Powerup();
    const lane = powerupIndex++ % 5;
    p._gameplayV3 = true;
    p.size = S(25);
    p.x = width * (0.12 + lane * 0.19) + (Math.random() - 0.5) * width * 0.035;
    p.y = -S(30);
    p.vy = S(1.15 + Math.min(tier(), 20) * 0.025);
    p.vx = (lane % 2 ? -1 : 1) * S(0.16);
    p.phase = lane * 0.8;
    p.update = function(f) {
      this.phase += 0.035 * f;
      this.x += this.vx * f;
      this.y += this.vy * f;
      this.x += Math.sin(this.phase) * S(0.16) * f;
      if (this.x < this.size || this.x > width - this.size) this.vx *= -1;
      this.rot += 0.03 * f;
    };
    p.draw = function() {
      const pulse = 1 + Math.sin(this.phase) * 0.08;
      ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot); ctx.scale(pulse, pulse);
      ctx.shadowColor = '#249bff'; ctx.shadowBlur = S(14); ctx.strokeStyle = '#69c4ff'; ctx.lineWidth = S(3.5);
      ctx.strokeRect(-this.size / 2, -this.size / 2, this.size, this.size);
      ctx.beginPath(); ctx.moveTo(-this.size * .25, 0); ctx.lineTo(this.size * .25, 0); ctx.moveTo(0, -this.size * .25); ctx.lineTo(0, this.size * .25); ctx.stroke();
      ctx.restore();
    };
    p.b = function() { return { x: this.x, y: this.y, r: this.size * .70 }; };
    powerups.push(p);
    powerupPressure = true;
  }

  function updateEnemy(e, factor) {
    if (!e || !e._v3) return;
    const pressure = difficultyMultiplier();
    e.x += e.vx * factor * pressure;
    e.y += e.vy * factor * pressure;
    e.rot += 0.04 * factor * pressure;

    if (e.y > height * LOWER_THIRD) {
      e.vy -= S(0.09) * factor * pressure;
      e.vy *= 0.985;
    }

    if (e.kind === 'shooter') {
      const shootInterval = Math.max(420, 1250 - tier() * 22) / hardMultiplier();
      if (Date.now() - e.lastShot > shootInterval) {
        const a = Math.random() * Math.PI * 2;
        const speed = S(4.4 + tier() * 0.10) * hardMultiplier() * powerupMultiplier();
        enemyBullets.push(new EnemyBulletV3(e.x, e.y, Math.cos(a) * speed, Math.sin(a) * speed));
        e.lastShot = Date.now();
      }
    }
    if (e.kind === 'armored' && player) {
      const ax = player.x - e.x, ay = player.y - e.y, d = Math.sqrt(ax * ax + ay * ay) || 1;
      const steer = S(0.025 + tier() * 0.002) * factor * pressure;
      e.vx += ax / d * steer; e.vy += ay / d * steer;
      const max = S(2.8 + tier() * 0.10) * pressure;
      const spd = Math.sqrt(e.vx * e.vx + e.vy * e.vy) || 1;
      if (spd > max) { e.vx = e.vx / spd * max; e.vy = e.vy / spd * max; }
    }
  }

  class EnemyBulletV3 {
    constructor(x, y, vx, vy) { this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.r = S(4); this.life = 190; }
    update(f) { this.x += this.vx * f; this.y += this.vy * f; this.life--; }
    draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fillStyle = '#ff783d'; ctx.fill(); }
    b() { return { x: this.x, y: this.y, r: this.r }; }
  }

  function updateHunter(e, factor) {
    if (!e || e.kind !== 'hunter' || !player) return;
    const dx = player.x - e.x, dy = player.y - e.y, dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const pressure = difficultyMultiplier();
    const steer = S(0.050 + tier() * 0.002) * factor * pressure;
    e.vx += dx / dist * steer; e.vy += dy / dist * steer;
    e.orbit = (e.orbit || 0) + 0.018 * factor;
    e.vx += Math.cos(e.orbit) * S(0.006) * factor * pressure;
    e.vy += Math.sin(e.orbit) * S(0.006) * factor * pressure;
    const max = S(2.9 + tier() * 0.12) * pressure;
    const spd = Math.sqrt(e.vx * e.vx + e.vy * e.vy) || 1;
    if (spd > max) { e.vx = e.vx / spd * max; e.vy = e.vy / spd * max; }
    e.x += e.vx * factor; e.y += e.vy * factor;
    e.rot += 0.045 * factor;
    const interval = Math.max(480, 1050 - tier() * 18) / hardMultiplier();
    if (Date.now() - e.lastShot > interval) {
      const lead = Math.min(35, 6 + dist / S(85));
      const tx = player.x + (targetX === undefined ? 0 : (targetX - player.x) * 0.12) * lead;
      const ty = player.y + (targetY === undefined ? 0 : (targetY - player.y) * 0.12) * lead;
      const ax = tx - e.x, ay = ty - e.y, d = Math.sqrt(ax * ax + ay * ay) || 1;
      const speed = S(5.0 + Math.min(tier(), 12) * 0.12) * hardMultiplier() * powerupMultiplier();
      enemyBullets.push(new EnemyBulletV3(e.x, e.y, ax / d * speed, ay / d * speed));
      e.lastShot = Date.now();
    }
    if (e.y > height * LOWER_THIRD) e.vy -= S(0.11) * factor * pressure;
  }

  function shootV3(now) {
    const p = powerTable[power];
    if (now - lastFire < p.cooldown) return;
    lastFire = now;
    const count = gunCount();
    const damage = playerDamage();
    const spread = count === 1 ? 0 : Math.min(0.72, 0.12 + count * 0.045);
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1) - 0.5;
      const a = t * spread;
      addShot(player.x + Math.sin(a) * player.size, player.y - Math.cos(a) * player.size, Math.sin(a), -Math.cos(a), damage);
    }
  }
  shoot = shootV3;

  function enemyScore(kind) {
    return Math.round(BASE_KILL_SCORE * (SCORE_BY_KIND[kind] || 1));
  }

  // Replaces the old 100/250-point collision scoring with exact per-enemy values.
  collisions = function collisionsV3() {
    const pb = player.b();
    for (let i = powerups.length - 1; i >= 0; i--) {
      for (let j = bullets.length - 1; j >= 0; j--) {
        if (overlap(powerups[i].b(), bullets[j].b())) {
          const p = powerups[i]; powerups.splice(i, 1); bullets.splice(j, 1);
          power = Math.min(49, power + hardMultiplier());
          powerEl.textContent = 'Power: ' + power;
          score += 250 * hardMultiplier();
          scoreEl.textContent = 'Score: ' + score;
          burst(p.x, p.y, '#249bff', 18);
          powerupPressure = false;
          break;
        }
      }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (overlap(pb, e.b())) { enemies.splice(i, 1); burst(e.x, e.y, '#ff4444', 14); damage(); continue; }
      for (let j = bullets.length - 1; j >= 0; j--) {
        if (!overlap(e.b(), bullets[j].b())) continue;
        bullets.splice(j, 1);
        if (e.kind === 'ghost') break;
        e.hp--; e.hitUntil = Date.now() + 180;
        if (e.hp <= 0) {
          enemies.splice(i, 1);
          score += enemyScore(e.kind) * hardMultiplier();
          scoreEl.textContent = 'Score: ' + score;
          burst(e.x, e.y, e.kind === 'armored' ? '#bd4aff' : '#ff4444', 16);
        }
        break;
      }
    }
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      if (overlap(pb, enemyBullets[i].b())) { enemyBullets.splice(i, 1); damage(); }
    }
  };

  const oldReset = resetGame;
  resetGame = function resetGameV3() {
    oldReset();
    nextEnemyAt = 0; nextWaveAt = 0; nextPowerupAt = 0;
    powerupPressure = false; powerupIndex = 0; waveIndex = 0;
  };

  update = function updateV3() {
    if (paused) return;
    const factor = Date.now() < slowUntil ? 0.32 : 1;
    const now = Date.now();
    player.update(targetX, targetY);
    shootV3(now);

    enemies.forEach(e => {
      if (e.kind === 'hunter' && e._v3) updateHunter(e, factor);
      else if (e._v3) updateEnemy(e, factor);
      else e.update(factor * difficultyMultiplier());
    });
    powerups.forEach(p => p.update(factor));
    bullets.forEach(b => b.update(factor));
    enemyBullets.forEach(b => b.update(factor));
    particles.forEach(p => p.update(factor));

    enemies = enemies.filter(e => e.x > -S(120) && e.x < width + S(120) && e.y > -S(120) && e.y < height + S(120));
    powerups = powerups.filter(p => p.y < height + S(50));
    bullets = bullets.filter(b => b.life > 0 && b.x > -S(80) && b.x < width + S(80) && b.y > -S(80) && b.y < height + S(80));
    enemyBullets = enemyBullets.filter(b => b.life > 0 && b.x > -S(100) && b.x < width + S(100) && b.y > -S(100) && b.y < height + S(100));
    particles = particles.filter(p => p.life > 0);

    if (powerupPressure && powerups.length === 0) powerupPressure = false;
    spawn();
    collisions();
    if (powerups.length === 0) powerupPressure = false;
  };

  ensureDeathSnapshotUi();
})();
