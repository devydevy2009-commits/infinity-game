// ============================================================
// INFINITY — tactical balance & input refinement
// One isolated extension layer for advanced enemy/formation rules.
// ============================================================
(() => {
  'use strict';

  const TIER_HEALTH_START = 5;
  const GHOST_FIRE_START = 10;
  const GHOST_FIRE_INTERVAL = 1650;
  const MAX_HUNTER_DEPTH = 0.68;
  const MAX_ENEMY_SPEED = 3.35;
  const TOUCH_AHEAD_REFINED = 25;
  const TOUCH_MOVE_FACTOR = 0.30;
  const PROTECTED_POWERUP_CHANCE = 0.22;

  const originalPlayerUpdate = Player.prototype.update;
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

  // Touch/pen input remains responsive, but a new contact point is reached
  // through a fast glide instead of an instantaneous teleport.
  Player.prototype.update = function (x, y) {
    if (x === undefined || y === undefined || (inputType !== 'touch' && inputType !== 'pen')) {
      originalPlayerUpdate.call(this, x, y);
      return;
    }

    const dx = x - this.x;
    const dy = y - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance < S(1.5)) {
      originalPlayerUpdate.call(this, x, y);
      return;
    }

    originalPlayerUpdate.call(this, this.x + dx * TOUCH_MOVE_FACTOR, this.y + dy * TOUCH_MOVE_FACTOR);
  };

  // Hunter nose always points at the player; it no longer spins independently.
  Enemy.prototype.updateHunter = function (f) {
    if (!player) return;
    const originalY = this.y;
    originalHunterUpdate.call(this, f);

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    this.rot = Math.atan2(dy, dx) + Math.PI / 2;

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
      if (this.kind !== 'hunter') this.rot += 0.02 * f;
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
        // Diamond marker instead of the old central plus.
        ctx.translate(this.x, this.y);
        ctx.rotate(Date.now() / 1200);
        const s = this.size * 0.72;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s, 0);
        ctx.lineTo(0, s);
        ctx.lineTo(-s, 0);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  function formationOffsets(shape, count) {
    const gapX = S(48);
    const gapY = S(42);
    const out = [];

    if (shape === 'line') {
      for (let i = 0; i < count; i++) out.push({ x: (i - (count - 1) / 2) * gapX, y: 0 });
    } else if (shape === 'v') {
      for (let i = 0; i < count; i++) {
        const row = Math.floor((i + 1) / 2);
        const side = i % 2 === 0 ? -1 : 1;
        out.push({ x: row * gapX * side, y: row * gapY });
      }
      out[0] = { x: 0, y: 0 };
    } else if (shape === 'diamond') {
      const points = [
        { x: 0, y: 0 }, { x: -gapX, y: gapY }, { x: gapX, y: gapY },
        { x: 0, y: gapY * 2 }, { x: -gapX * 2, y: gapY * 2 }, { x: gapX * 2, y: gapY * 2 },
        { x: 0, y: gapY * 3 }, { x: -gapX, y: gapY * 3 }, { x: gapX, y: gapY * 3 }
      ];
      return points.slice(0, count);
    } else {
      for (let i = 0; i < count; i++) {
        const row = Math.floor(i / 3);
        const col = i % 3;
        out.push({ x: (col - 1) * gapX * (1 + row * 0.25), y: row * gapY });
      }
    }
    return out.slice(0, count);
  }

  function formationKinds(t, count, variant) {
    const pools = {
      mixed: ['asteroid', 'drone', 'hunter', 'asteroid', 'drone', 'transport', 'ghost'],
      assault: ['hunter', 'hunter', 'drone', 'drone', 'asteroid', 'transport'],
      convoy: ['transport', 'drone', 'asteroid', 'drone', 'transport', 'hunter'],
      swarm: ['drone', 'asteroid', 'drone', 'hunter', 'asteroid', 'ghost']
    };
    const pool = pools[variant] || pools.mixed;
    return Array.from({ length: count }, (_, i) => {
      let kind = pool[(i + t) % pool.length];
      if (kind === 'ghost' && t < 5) kind = 'asteroid';
      if (kind === 'transport' && t < 4) kind = 'drone';
      return kind;
    });
  }

  // Formations now rotate between several tactical patterns. None creates a
  // power-up: protected power-ups are a separate, less frequent event.
  window.makeFormation = function () {
    const t = tier();
    const shapes = ['line', 'v', 'diamond', 'wedge'];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    const r = Math.random();
    const variant = r < 0.34 ? 'mixed' : r < 0.57 ? 'assault' : r < 0.79 ? 'convoy' : 'swarm';
    const count = Math.min(9, 4 + Math.floor(t / 2));
    const center = width * (0.25 + Math.random() * 0.50);
    const id = ++formationSerial;
    const kinds = formationKinds(t, count, variant);
    const offsets = formationOffsets(shape, count);

    offsets.forEach((o, i) => {
      const e = new Enemy(kinds[i]);
      e.x = center + o.x;
      e.y = -S(46) + o.y;
      e.formationId = id;
      e.formOffset = o;
      e.vx = 0;
      e.vy = S(1.05 + Math.min(t, 15) * 0.04);
      ensureScaledHealth(e);
      if (e.kind === 'hunter' && player) e.rot = Math.atan2(player.y - e.y, player.x - e.x) + Math.PI / 2;
      enemies.push(e);
    });
  };

  function protectPowerup(p) {
    if (!p || p.protected || enemies.some(e => e.protectedPowerup === p)) return;
    p.protected = true;
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
    const beforePowerups = powerups.length;
    originalSpawn();
    if (tier() >= 2 && powerups.length > beforePowerups && Math.random() < PROTECTED_POWERUP_CHANCE) {
      protectPowerup(powerups[powerups.length - 1]);
    }
  };

  Powerup.prototype.draw = function () {
    originalPowerupDraw.call(this);
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
    ctx.fillStyle = '#d8f4ff';
    ctx.globalAlpha = this.protected ? 0.9 : 0.72;
    ctx.fillRect(this.x - this.size * 0.16, this.y - this.size * 0.16, this.size * 0.32, this.size * 0.32);
    ctx.restore();
  };

  // Keep mouse unchanged. Touch receives the requested 25px forward offset.
  const originalSetTarget = window.setTarget;
  if (typeof originalSetTarget === 'function') {
    window.setTarget = function (e) {
      originalSetTarget(e);
      if (e.pointerType === 'touch') targetY = e.clientY - S(TOUCH_AHEAD_REFINED);
    };
  }
})();
