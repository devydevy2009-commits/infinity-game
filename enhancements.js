// Infinity gameplay enhancements: rarer/faster powerups, formations and hunter enemies.
(() => {
  const OriginalEnemy = Enemy;

  class HunterBullet {
    constructor(x, y, vx, vy) {
      this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.r = S(4.5); this.life = 220;
    }
    update(f) { this.x += this.vx * f; this.y += this.vy * f; this.life--; }
    draw() {
      ctx.save();
      ctx.fillStyle = '#ff4fd8';
      ctx.shadowColor = '#ff4fd8';
      ctx.shadowBlur = S(7);
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    b() { return { x: this.x, y: this.y, r: this.r }; }
  }

  class HunterEnemy extends OriginalEnemy {
    constructor() {
      super('hunter');
      this.size = S(16);
      this.hp = 2 + Math.floor(tier() / 4);
      this.lastShot = Date.now() + 900;
      this.orbit = Math.random() * Math.PI * 2;
    }
    update(f) {
      if (!player) return;
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const steer = S(0.055 + tier() * 0.003) * f;
      this.vx += dx / dist * steer;
      this.vy += dy / dist * steer;
      this.orbit += 0.018 * f;
      this.vx += Math.cos(this.orbit) * S(0.008) * f;
      this.vy += Math.sin(this.orbit) * S(0.008) * f;
      const maxSpd = S(2.7 + tier() * 0.16);
      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      if (speed > maxSpd) {
        this.vx = this.vx / speed * maxSpd;
        this.vy = this.vy / speed * maxSpd;
      }
      this.x += this.vx * f;
      this.y += this.vy * f;
      this.rot += 0.045 * f;

      const interval = Math.max(520, 1050 - tier() * 22);
      if (Date.now() - this.lastShot > interval) {
        const lead = Math.min(28, 5 + dist / S(90));
        const tx = player.x + (targetX === undefined ? 0 : (targetX - player.x) * 0.15) * lead;
        const ty = player.y + (targetY === undefined ? 0 : (targetY - player.y) * 0.15) * lead;
        const ax = tx - this.x, ay = ty - this.y;
        const d = Math.sqrt(ax * ax + ay * ay) || 1;
        const speedShot = S(4.7 + Math.min(tier(), 12) * 0.12);
        enemyBullets.push(new HunterBullet(this.x, this.y, ax / d * speedShot, ay / d * speedShot));
        this.lastShot = Date.now();
      }
    }
    draw() {
      const flashing = Date.now() < this.hitUntil && Math.floor(Date.now() / 70) % 2 === 0;
      ctx.save();
      ctx.translate(this.x, this.y); ctx.rotate(this.rot);
      ctx.strokeStyle = flashing ? '#fff' : '#ff4fd8';
      ctx.lineWidth = S(2.5);
      ctx.beginPath(); ctx.moveTo(0, -this.size); ctx.lineTo(this.size, 0); ctx.lineTo(0, this.size); ctx.lineTo(-this.size, 0); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, this.size * 0.42, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  buildWave = function buildWaveEnhanced() {
    const t = tier();
    const count = 5 + Math.min(t, 9);
    const cols = Math.min(count, 5);
    const rows = Math.ceil(count / cols);
    const startX = width / 2;
    const startY = -S(42);
    const spacingX = S(52);
    const spacingY = S(46);
    const kinds = ['basic', 'basic', 'shooter'];
    if (t >= 3) kinds.push('armored');
    if (t >= 5) kinds.push('ghost');
    if (t >= 2) kinds.push('hunter');
    const queue = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (queue.length >= count) break;
        const center = (cols - 1) / 2;
        const x = startX + (c - center) * spacingX + (r % 2 ? spacingX * 0.28 : 0);
        const kind = kinds[(r * cols + c + t) % kinds.length];
        queue.push({ x, y: startY - r * spacingY, kind });
      }
    }
    return queue;
  };

  spawnFromWave = function spawnFromWaveEnhanced(entry) {
    const e = entry.kind === 'hunter' ? new HunterEnemy() : new Enemy(entry.kind);
    e.x = entry.x; e.y = entry.y;
    const angle = Math.atan2(height * 0.58 - e.y, cx - e.x);
    const mult = 1 + tier() * 0.18;
    e.vx = Math.cos(angle) * S((1.22 + Math.random() * 0.4) * mult);
    e.vy = Math.sin(angle) * S((1.22 + Math.random() * 0.4) * mult);
    enemies.push(e);
  };

  chooseEnemy = function chooseEnemyEnhanced() {
    const t = tier(), r = Math.random();
    if (t >= 2 && r < Math.min(0.055 + t * 0.006, 0.12)) return 'hunter';
    if (t >= 5 && r < Math.min(0.13 + t * 0.01, 0.24)) return 'ghost';
    if (t >= 4 && r < Math.min(0.22 + t * 0.018, 0.44)) return 'armored';
    if (t >= 2 && r < Math.min(0.32 + t * 0.018, 0.58)) return 'shooter';
    return 'basic';
  };

  spawn = function spawnEnhanced() {
    const t = tier();
    const cap = 8 + t * 3;
    const now = Date.now();
    if (!inWave && now - waveTimer > 18000) {
      waveTimer = now;
      inWave = true;
      waveQueue = buildWave();
      waveSpawnIndex = 0;
      waveSpawnTimer = now;
    }
    if (inWave) {
      if (now - waveSpawnTimer > 280 && waveSpawnIndex < waveQueue.length) {
        spawnFromWave(waveQueue[waveSpawnIndex]);
        waveSpawnIndex++;
        waveSpawnTimer = now;
      }
      if (waveSpawnIndex >= waveQueue.length) inWave = false;
    }
    if (enemies.length < cap && Math.random() < 0.032 + t * 0.006) {
      const kind = chooseEnemy();
      enemies.push(kind === 'hunter' ? new HunterEnemy() : new Enemy(kind));
    }
    const powerupChance = 0.00045 + Math.min(t, 10) * 0.000025;
    if (Math.random() < powerupChance) {
      const p = new Powerup();
      p._enhanced = true;
      p.vy *= 1.75;
      p.vx = (Math.random() < 0.5 ? -1 : 1) * S(0.9 + Math.random() * 0.7);
      p.baseX = p.x;
      p.phase = Math.random() * Math.PI * 2;
      p.update = function(f) {
        this.phase += 0.065 * f;
        this.x += this.vx * f;
        this.y += this.vy * f;
        this.x += Math.sin(this.phase) * S(0.55) * f;
        this.rot += 0.065 * f;
      };
      p.b = function() { return { x: this.x, y: this.y, r: this.size * 0.54 }; };
      powerups.push(p);
    }
  };
})();
