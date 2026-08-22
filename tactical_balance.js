// ============================================================
// INFINITY — tactical balancing pass
// Keeps enemy balancing in one isolated rules module.
// ============================================================
(() => {
  'use strict';

  const TIER_HEALTH_START = 5;
  const GHOST_FIRE_START = 10;
  const GHOST_FIRE_INTERVAL = 1650;
  const MAX_HUNTER_DEPTH = 0.68;
  const MAX_ENEMY_SPEED = 3.35;

  const originalHunterUpdate = Enemy.prototype.updateHunter;
  const originalEnemyUpdate = Enemy.prototype.update;
  const originalEnemyDraw = Enemy.prototype.draw;
  const originalSpawn = spawn;
  const originalPowerupDraw = Powerup.prototype.draw;

  function difficultyHealthBonus(kind) {
    const t = tier();
    if (t < TIER_HEALTH_START) return 0;
    const steps = t - TIER_HEALTH_START + 1;
    if (kind === 'asteroid') return Math.min(5, Math.floor(steps / 2));
    if (kind === 'drone') return Math.min(6, Math.floor(steps / 2));
    if (kind === 'hunter') return Math.min(8, Math.floor(steps / 2));
    if (kind === 'transport') return Math.min(12, Math.floor(steps / 1.5));
    return 0;
  }

  function ensureScaledHealth(enemy) {
    if (enemy.kind === 'ghost' || enemy._tacticalHpReady) return;
    enemy.hp += difficultyHealthBonus(enemy.kind);
    enemy._tacticalHpReady = true;
    enemy.maxHp = enemy.hp;
  }

  Enemy.prototype.updateHunter = function (f) {
    if (!player) return;
    const originalY = this.y;
    originalHunterUpdate.call(this, f);
    const safeLimit = height * MAX_HUNTER_DEPTH;
    if (this.y > safeLimit) {
      const push = S(0.095 + tier() * 0.002);
      this.vy -= push * f;
      this.vx *= Math.pow(0.985, f);
      this.vy *= Math.pow(0.992, f);
      if (this.y > height * 0.74) this.y = Math.min(originalY, safeLimit);
    }
    const speed = Math.hypot(this.vx, this.vy);
    const cap = S(MAX_ENEMY_SPEED + Math.min(tier(), 10) * 0.04);
    if (speed > cap) {
      this.vx = this.vx / speed * cap;
      this.vy = this.vy / speed * cap;
    }
  };

  Enemy.prototype.update = function (f) {
    originalEnemyUpdate.call(this, f);
    ensureScaledHealth(this);
    const speed = Math.hypot(this.vx, this.vy);
    const cap = S(MAX_ENEMY_SPEED + Math.min(tier(), 10) * 0.04);
    if (speed > cap) {
      this.vx = this.vx / speed * cap;
      this.vy = this.vy / speed * cap;
    }

    if (this.protectedPowerup && powerups.includes(this.protectedPowerup)) {
      const p = this.protectedPowerup;
      this.x = p.x + this.guardOffset.x;
      this.y = p.y + this.guardOffset.y;
      this.rot += 0.02 * f;
    }

    if (this.kind === 'ghost' && tier() >= GHOST_FIRE_START) {
      if (!this.lastGhostShot) this.lastGhostShot = Date.now() + Math.random() * GHOST_FIRE_INTERVAL;
      if (Date.now() - this.lastGhostShot >= GHOST_FIRE_INTERVAL) {
        const count = tier() >= 14 ? 2 : 1;
        fireRandomBurst(this.x, this.y, count, 4.4 + tier() * 0.08);
        this.lastGhostShot = Date.now();
      }
    }
  };

  function drawHealthBar(enemy) {
    if (tier() < TIER_HEALTH_START || enemy.kind === 'ghost') return;
    const max = enemy.maxHp || enemy.hp || 1;
    const ratio = clamp(enemy.hp / max, 0, 1);
    const w = enemy.size * 2.2;
    const h = S(3);
    const x = enemy.x - w / 2;
    const y = enemy.y - enemy.size - S(7);
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = kindColor(enemy.kind);
    ctx.fillRect(x, y, w * ratio, h);
    ctx.restore();
  }

  Enemy.prototype.draw = function () {
    originalEnemyDraw.call(this);
    // Transport already owns its base HP bar in the consolidated engine.
    if (this.kind !== 'transport') drawHealthBar(this);

    if (this.kind === 'ghost') {
      const advanced = tier() >= GHOST_FIRE_START;
      ctx.save();
      ctx.strokeStyle = kindColor('ghost');
      ctx.globalAlpha = advanced ? 0.52 + Math.sin(Date.now() / 130) * 0.14 : 0.30;
      ctx.lineWidth = S(advanced ? 2 : 1.4);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * (advanced ? 1.65 : 1.45), 0, Math.PI * 2);
      ctx.stroke();
      if (advanced) {
        ctx.translate(this.x, this.y);
        ctx.rotate(Date.now() / 1200);
        ctx.beginPath();
        ctx.moveTo(-this.size * 1.55, 0);
        ctx.lineTo(this.size * 1.55, 0);
        ctx.moveTo(0, -this.size * 1.55);
        ctx.lineTo(0, this.size * 1.55);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  function formationKinds(t, count) {
    const pool = ['asteroid'];
    if (t >= 2) pool.push('drone');
    if (t >= 3) pool.push('hunter');
    if (t >= 4) pool.push('transport');
    if (t >= 5) pool.push('ghost');
    return Array.from({ length: count }, (_, i) => {
      if (i === 0 && t >= 3) return 'hunter';
      if (i === 1 && t >= 2) return 'drone';
      if (i === 2 && t >= 4) return 'transport';
      return pool[(i + t) % pool.length];
    });
  }

  window.makeFormation = function () {
    const t = tier();
    const count = Math.min(9, 4 + Math.floor(t / 2));
    const center = width * (0.25 + Math.random() * 0.50);
    const id = ++formationSerial;
    const kinds = formationKinds(t, count);
    const offsets = [];
    for (let i = 0; i < count; i++) {
      const cols = Math.min(3, count);
      const row = Math.floor(i / cols);
      const col = i % cols;
      offsets.push({ x: (col - (Math.min(cols, count - row * cols) - 1) / 2) * S(48), y: row * S(42) });
    }
    offsets.forEach((o, i) => {
      const e = new Enemy(kinds[i]);
      e.x = center + o.x;
      e.y = -S(46) + o.y;
      e.formationId = id;
      e.formOffset = o;
      e.vx = 0;
      e.vy = S(1.05 + Math.min(t, 15) * 0.04);
      ensureScaledHealth(e);
      enemies.push(e);
    });
  };

  function spawnProtectedPowerup() {
    if (tier() < 2 || powerups.length !== 0) return;
    const p = new Powerup();
    p.protected = true;
    powerups.push(p);
    const t = tier();
    const guardCount = t >= 8 ? 5 : t >= 5 ? 4 : 3;
    const kinds = t >= 6 ? ['hunter', 'drone', 'drone', 'transport', 'hunter'] : ['hunter', 'drone', 'drone', 'transport'];
    const radius = S(46 + Math.min(t, 10) * 3);
    for (let i = 0; i < guardCount; i++) {
      const e = new Enemy(kinds[i % kinds.length]);
      const a = (i / guardCount) * Math.PI * 2;
      e.formationId = null;
      e.protectedPowerup = p;
      e.guardOffset = { x: Math.cos(a) * radius, y: Math.sin(a) * radius };
      e.x = p.x + e.guardOffset.x;
      e.y = p.y + e.guardOffset.y;
      ensureScaledHealth(e);
      enemies.push(e);
    }
  }

  window.spawn = function () {
    originalSpawn();
    if (tier() >= 2 && Date.now() % 97 < 2) spawnProtectedPowerup();
  };

  Powerup.prototype.draw = function () {
    originalPowerupDraw.call(this);
    // Every power-up is now visually a special cargo vessel carrying crates.
    ctx.save();
    ctx.strokeStyle = '#69c4ff';
    ctx.globalAlpha = this.protected ? 0.48 : 0.36;
    ctx.lineWidth = S(1.5);
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * 1.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeRect(this.x - this.size * 0.95, this.y - this.size * 0.58, this.size * 1.9, this.size * 1.16);
    ctx.beginPath();
    ctx.moveTo(this.x - this.size * 0.95, this.y);
    ctx.lineTo(this.x + this.size * 0.95, this.y);
    ctx.moveTo(this.x - this.size * 0.28, this.y - this.size * 0.58);
    ctx.lineTo(this.x - this.size * 0.28, this.y);
    ctx.moveTo(this.x + this.size * 0.32, this.y);
    ctx.lineTo(this.x + this.size * 0.32, this.y + this.size * 0.58);
    ctx.stroke();
    // A small bright crate mark makes the collectible readable at speed.
    ctx.fillStyle = '#d8f4ff';
    ctx.globalAlpha = this.protected ? 0.9 : 0.72;
    ctx.fillRect(this.x - this.size * 0.16, this.y - this.size * 0.16, this.size * 0.32, this.size * 0.32);
    ctx.restore();
  };
})();
