// Infinity gameplay enhancements: visible powerups, triangular squadrons and hunter reinforcements.
(() => {
  const OriginalEnemy = Enemy;

  // Slightly nerf the power curve so collecting powerups is rewarding without becoming overwhelming.
  powerTable.forEach(p => {
    p.cooldown *= 1.10;
    p.speed *= 0.90;
    p.spread *= 0.88;
  });

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
      ctx.shadowBlur = S(8);
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
      this.lastShot = Date.now() + 850;
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

  function formationKind() {
    const t = tier();
    const r = Math.random();
    if (t >= 8 && r < 0.18) return 'hunter';
    if (t >= 5 && r < 0.48) return 'armored';
    if (t >= 3 && r < 0.72) return 'shooter';
    return 'basic';
  }

  // A clearly readable 1-2-3 triangular squadron, all made of the same enemy type.
  function makeTriangleFormation() {
    const t = tier();
    const kind = formationKind();
    const rows = 3;
    const spacingX = S(48);
    const spacingY = S(42);
    const centerX = width / 2 + (Math.random() - 0.5) * width * 0.32;
    const startY = -S(34);
    const queue = [];
    for (let row = 0; row < rows; row++) {
      const count = row + 1;
      for (let col = 0; col < count; col++) {
        const x = centerX + (col - (count - 1) / 2) * spacingX;
        const y = startY - (rows - 1 - row) * spacingY;
        queue.push({ x, y, kind, formationKind: kind, formationSpeed: 1 + t * 0.08 });
      }
    }
    return queue;
  }

  function spawnFormation(force = false) {
    if (!force && enemies.length > 7 + tier() * 2) return false;
    const entries = makeTriangleFormation();
    entries.forEach(entry => {
      const e = entry.kind === 'hunter' ? new HunterEnemy() : new Enemy(entry.kind);
      e.x = entry.x; e.y = entry.y;
      e.formation = true;
      e.formationKind = entry.formationKind;
      const angle = Math.atan2(height * 0.62 - e.y, cx - e.x);
      const speed = S((1.35 + Math.random() * 0.12) * entry.formationSpeed);
      e.vx = Math.cos(angle) * speed;
      e.vy = Math.sin(angle) * speed;
      enemies.push(e);
    });
    return true;
  }

  function spawnFromWave(entry) {
    const e = entry.kind === 'hunter' ? new HunterEnemy() : new Enemy(entry.kind);
    e.x = entry.x; e.y = entry.y;
    const angle = Math.atan2(height * 0.62 - e.y, cx - e.x);
    const speed = S((1.35 + Math.random() * 0.18) * (1 + tier() * 0.10));
    e.vx = Math.cos(angle) * speed;
    e.vy = Math.sin(angle) * speed;
    enemies.push(e);
  }

  // Kept as a fallback for the original game's wave system.
  buildWave = function buildWaveEnhanced() {
    return makeTriangleFormation();
  };

  chooseEnemy = function chooseEnemyEnhanced() {
    const t = tier(), r = Math.random();
    if (t >= 2 && r < Math.min(0.055 + t * 0.006, 0.12)) return 'hunter';
    if (t >= 5 && r < Math.min(0.13 + t * 0.01, 0.24)) return 'ghost';
    if (t >= 4 && r < Math.min(0.22 + t * 0.018, 0.44)) return 'armored';
    if (t >= 2 && r < Math.min(0.32 + t * 0.018, 0.58)) return 'shooter';
    return 'basic';
  };

  function spawnPowerupEvent() {
    const p = new Powerup();
    p._enhanced = true;
    p.size = S(25);
    p.vy = S(1.15 + Math.min(tier(), 12) * 0.035);
    p.vx = (Math.random() < 0.5 ? -1 : 1) * S(0.35 + Math.random() * 0.35);
    p.phase = Math.random() * Math.PI * 2;
    p.update = function(f) {
      this.phase += 0.045 * f;
      this.x += this.vx * f;
      this.y += this.vy * f;
      this.x += Math.sin(this.phase) * S(0.25) * f;
      if (this.x < this.size || this.x > width - this.size) this.vx *= -1;
      this.rot += 0.035 * f;
    };
    p.draw = function() {
      const pulse = 1 + Math.sin(this.phase * 1.5) * 0.10;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.scale(pulse, pulse);
      ctx.shadowColor = '#249bff';
      ctx.shadowBlur = S(16);
      ctx.strokeStyle = '#69c4ff';
      ctx.fillStyle = 'rgba(36,155,255,0.18)';
      ctx.lineWidth = S(3.5);
      ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
      ctx.strokeRect(-this.size / 2, -this.size / 2, this.size, this.size);
      ctx.beginPath();
      ctx.moveTo(-this.size * 0.25, 0); ctx.lineTo(this.size * 0.25, 0);
      ctx.moveTo(0, -this.size * 0.25); ctx.lineTo(0, this.size * 0.25);
      ctx.stroke();
      ctx.restore();
    };
    p.b = function() { return { x: this.x, y: this.y, r: this.size * 0.70 }; };
    powerups.push(p);

    // The reward creates a deliberate risk window: the screen gets busier and nastier.
    const reinforcements = 3 + Math.min(2, Math.floor(tier() / 3));
    for (let i = 0; i < reinforcements; i++) {
      const kind = i === 0 && tier() >= 2 ? 'hunter' : chooseEnemy();
      enemies.push(kind === 'hunter' ? new HunterEnemy() : new Enemy(kind));
    }
    spawnFormation(true);
    if (tier() >= 4) spawnFormation(true);
  }

  spawn = function spawnEnhanced() {
    const t = tier();
    const cap = 8 + t * 3;
    const now = Date.now();

    // Formations are guaranteed in both Normal and Hard Mode and arrive often enough to see.
    if (!inWave && now - waveTimer > 10500) {
      waveTimer = now;
      inWave = true;
      spawnFormation(false);
      waveQueue = [];
      waveSpawnIndex = 0;
      waveSpawnTimer = now;
    }
    if (inWave && enemies.length < cap + 6) {
      inWave = false;
    }

    if (enemies.length < cap && Math.random() < 0.032 + t * 0.006) {
      const kind = chooseEnemy();
      enemies.push(kind === 'hunter' ? new HunterEnemy() : new Enemy(kind));
    }

    // More visible and more frequent, but slower and less powerful.
    const powerupChance = 0.00095 + Math.min(t, 10) * 0.000035;
    if (Math.random() < powerupChance && powerups.length === 0) {
      spawnPowerupEvent();
    }
  };
})();
