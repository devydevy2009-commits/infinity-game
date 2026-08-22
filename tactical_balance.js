// INFINITY — tactical rules consolidated in one extension layer.
(() => {
  'use strict';

  const TIER_HEALTH_START = 5;
  const GHOST_FIRE_START = 10;
  const GHOST_FIRE_INTERVAL = 1650;
  const MAX_HUNTER_DEPTH = 0.68;
  const MAX_ENEMY_SPEED = 3.35;
  const TOUCH_AHEAD = 25;
  const TOUCH_MOVE_FACTOR = 0.30;
  const PROTECTED_POWERUP_CHANCE = 0.22;
  const FORMATION_MARGIN = 18;
  const FORMATION_ENTRY_Y = -46;
  const FORMATION_SPEED = 1.05;

  const formationAnchors = new Map();
  const basePlayerUpdate = Player.prototype.update;
  const baseHunterUpdate = Enemy.prototype.updateHunter;
  const baseEnemyUpdate = Enemy.prototype.update;
  const baseEnemyDraw = Enemy.prototype.draw;
  const baseSpawn = spawn;
  const basePowerupDraw = Powerup.prototype.draw;
  const baseSetTarget = window.setTarget;
  const baseResetGame = window.resetGame;

  function enemySpeedCap() { return S(MAX_ENEMY_SPEED + Math.min(tier(), 10) * 0.04); }
  function clampEnemyVelocity(enemy) {
    const speed = Math.hypot(enemy.vx, enemy.vy), cap = enemySpeedCap();
    if (speed > cap && speed > 0) { const ratio = cap / speed; enemy.vx *= ratio; enemy.vy *= ratio; }
  }
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

  Player.prototype.update = function (x, y) {
    if (x === undefined || y === undefined || (inputType !== 'touch' && inputType !== 'pen')) return basePlayerUpdate.call(this, x, y);
    const dx = x - this.x, dy = y - this.y;
    if (Math.hypot(dx, dy) < S(1.5)) return basePlayerUpdate.call(this, x, y);
    return basePlayerUpdate.call(this, this.x + dx * TOUCH_MOVE_FACTOR, this.y + dy * TOUCH_MOVE_FACTOR);
  };

  Enemy.prototype.updateHunter = function (f) {
    if (!player) return;
    const originalY = this.y;
    baseHunterUpdate.call(this, f);
    this.rot = Math.atan2(player.y - this.y, player.x - this.x) + Math.PI / 2;
    const safeLimit = height * MAX_HUNTER_DEPTH;
    if (!this.formationControlled && this.y > safeLimit) {
      const push = S(0.095 + tier() * 0.002);
      this.vy -= push * f;
      this.vx *= Math.pow(0.985, f);
      this.vy *= Math.pow(0.992, f);
      if (this.y > height * 0.74) this.y = Math.min(originalY, safeLimit);
    }
    clampEnemyVelocity(this);
  };

  Enemy.prototype.update = function (f) {
    const controlled = this.formationControlled;
    const px = this.x, py = this.y;
    baseEnemyUpdate.call(this, f);
    ensureScaledHealth(this);
    if (controlled) {
      this.x = px; this.y = py; this.vx = 0; this.vy = 0;
    } else clampEnemyVelocity(this);

    if (this.protectedPowerup && powerups.includes(this.protectedPowerup)) {
      const p = this.protectedPowerup;
      this.x = p.x + this.guardOffset.x; this.y = p.y + this.guardOffset.y;
      if (this.kind === 'hunter' && player) this.rot = Math.atan2(player.y - this.y, player.x - this.x) + Math.PI / 2;
      else this.rot += 0.02 * f;
    }
    if (this.kind === 'ghost' && tier() >= GHOST_FIRE_START) {
      if (!this.lastGhostShot) this.lastGhostShot = Date.now() + Math.random() * GHOST_FIRE_INTERVAL;
      if (Date.now() - this.lastGhostShot >= GHOST_FIRE_INTERVAL) {
        fireRandomBurst(this.x, this.y, tier() >= 14 ? 2 : 1, 4.4 + tier() * 0.08);
        this.lastGhostShot = Date.now();
      }
    }
  };

  function drawHealthBar(enemy) {
    if (tier() < TIER_HEALTH_START || enemy.kind === 'ghost') return;
    const max = enemy.maxHp || enemy.hp || 1, ratio = clamp(enemy.hp / max, 0, 1), w = enemy.size * 2.2, h = S(3);
    const x = enemy.x - w / 2, y = enemy.y - enemy.size - S(7);
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = kindColor(enemy.kind); ctx.fillRect(x, y, w * ratio, h);
    ctx.restore();
  }

  Enemy.prototype.draw = function () {
    baseEnemyDraw.call(this);
    if (this.kind !== 'transport') drawHealthBar(this);
    if (this.kind !== 'ghost') return;
    const advanced = tier() >= GHOST_FIRE_START;
    ctx.save();
    ctx.strokeStyle = kindColor('ghost');
    ctx.globalAlpha = advanced ? 0.52 + Math.sin(Date.now() / 130) * 0.14 : 0.30;
    ctx.lineWidth = S(advanced ? 2 : 1.4);
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size * (advanced ? 1.65 : 1.45), 0, Math.PI * 2); ctx.stroke();
    if (advanced) {
      ctx.translate(this.x, this.y); ctx.rotate(Date.now() / 1200);
      const s = this.size * 0.72;
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0); ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
  };

  function formationOffsets(shape, count) {
    const gapX = S(48), gapY = S(42);
    if (shape === 'line') return Array.from({ length: count }, (_, i) => ({ x: (i - (count - 1) / 2) * gapX, y: 0 }));
    if (shape === 'v') {
      const out = [{ x: 0, y: 0 }];
      for (let i = 1; i < count; i++) { const row = Math.ceil(i / 2); out.push({ x: (i % 2 ? -1 : 1) * row * gapX, y: row * gapY }); }
      return out;
    }
    if (shape === 'diamond') return [
      { x: 0, y: 0 }, { x: -gapX, y: gapY }, { x: gapX, y: gapY }, { x: 0, y: gapY * 2 },
      { x: -gapX * 2, y: gapY * 2 }, { x: gapX * 2, y: gapY * 2 }, { x: 0, y: gapY * 3 },
      { x: -gapX, y: gapY * 3 }, { x: gapX, y: gapY * 3 }
    ].slice(0, count);
    return Array.from({ length: count }, (_, i) => {
      const row = Math.floor(i / 3), col = i % 3;
      return { x: (col - 1) * gapX * (1 + row * 0.25), y: row * gapY };
    });
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

  window.makeFormation = function () {
    const t = tier();
    const shapes = ['line', 'v', 'diamond', 'wedge'];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    const r = Math.random();
    const variant = r < 0.34 ? 'mixed' : r < 0.57 ? 'assault' : r < 0.79 ? 'convoy' : 'swarm';
    const count = Math.min(9, 4 + Math.floor(t / 2));
    const offsets = formationOffsets(shape, count);
    const maxOffset = Math.max(...offsets.map(o => Math.abs(o.x)), 0);
    const edge = maxOffset + S(FORMATION_MARGIN);
    const center = clamp(width * (0.25 + Math.random() * 0.50), edge, width - edge);
    const id = ++formationSerial;
    const anchor = { x: center, y: S(FORMATION_ENTRY_Y), vy: S(FORMATION_SPEED + Math.min(t, 15) * 0.04) };
    const kinds = formationKinds(t, count, variant);

    formationAnchors.set(id, anchor);
    offsets.forEach((offset, i) => {
      const enemy = new Enemy(kinds[i]);
      enemy.formationId = id; enemy.formOffset = offset; enemy.formAnchor = anchor; enemy.formationControlled = true;
      enemy.x = anchor.x + offset.x; enemy.y = anchor.y + offset.y; enemy.vx = 0; enemy.vy = 0;
      ensureScaledHealth(enemy);
      if (enemy.kind === 'hunter' && player) enemy.rot = Math.atan2(player.y - enemy.y, player.x - enemy.x) + Math.PI / 2;
      enemies.push(enemy);
    });
  };

  window.updateFormations = function (f) {
    const activeIds = new Set();
    for (const enemy of enemies) if (enemy.formationId && enemy.formAnchor) activeIds.add(enemy.formationId);
    for (const [id, anchor] of formationAnchors) {
      if (!activeIds.has(id)) { formationAnchors.delete(id); continue; }
      anchor.y += anchor.vy * f;
      anchor.vy = Math.max(S(0.72), anchor.vy * Math.pow(0.996, f));
      const members = enemies.filter(enemy => enemy.formationId === id && enemy.formAnchor === anchor);
      const maxOffsetX = members.reduce((m, enemy) => Math.max(m, Math.abs(enemy.formOffset?.x || 0)), 0);
      anchor.x = clamp(anchor.x, maxOffsetX + S(FORMATION_MARGIN), width - maxOffsetX - S(FORMATION_MARGIN));
      for (const enemy of members) {
        enemy.x = anchor.x + (enemy.formOffset?.x || 0);
        enemy.y = anchor.y + (enemy.formOffset?.y || 0);
        enemy.vx = 0; enemy.vy = 0;
        if (enemy.kind === 'hunter' && player) enemy.rot = Math.atan2(player.y - enemy.y, player.x - enemy.x) + Math.PI / 2;
      }
    }
  };

  function protectPowerup(p) {
    if (!p || p.protected || enemies.some(e => e.protectedPowerup === p)) return;
    p.protected = true;
    const t = tier(), guardCount = t >= 8 ? 5 : t >= 5 ? 4 : 3;
    const kinds = t >= 6 ? ['hunter', 'drone', 'drone', 'transport', 'hunter'] : ['hunter', 'drone', 'drone', 'transport'];
    const radius = S(46 + Math.min(t, 10) * 3);
    for (let i = 0; i < guardCount; i++) {
      const enemy = new Enemy(kinds[i % kinds.length]), a = (i / guardCount) * Math.PI * 2;
      enemy.protectedPowerup = p; enemy.guardOffset = { x: Math.cos(a) * radius, y: Math.sin(a) * radius };
      enemy.x = p.x + enemy.guardOffset.x; enemy.y = p.y + enemy.guardOffset.y;
      ensureScaledHealth(enemy); clampEnemyVelocity(enemy); enemies.push(enemy);
    }
  }

  window.spawn = function () {
    const before = powerups.length;
    baseSpawn();
    if (tier() >= 2 && powerups.length > before && Math.random() < PROTECTED_POWERUP_CHANCE) protectPowerup(powerups[powerups.length - 1]);
  };

  Powerup.prototype.draw = function () {
    basePowerupDraw.call(this);
    ctx.save(); ctx.strokeStyle = '#69c4ff'; ctx.globalAlpha = this.protected ? 0.48 : 0.36; ctx.lineWidth = S(1.5);
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 1.45, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeRect(this.x - this.size * 0.95, this.y - this.size * 0.58, this.size * 1.9, this.size * 1.16);
    ctx.beginPath();
    ctx.moveTo(this.x - this.size * 0.95, this.y); ctx.lineTo(this.x + this.size * 0.95, this.y);
    ctx.moveTo(this.x - this.size * 0.28, this.y - this.size * 0.58); ctx.lineTo(this.x - this.size * 0.28, this.y);
    ctx.moveTo(this.x + this.size * 0.32, this.y); ctx.lineTo(this.x + this.size * 0.32, this.y + this.size * 0.58); ctx.stroke();
    ctx.fillStyle = '#d8f4ff'; ctx.globalAlpha = this.protected ? 0.9 : 0.72; ctx.fillRect(this.x - this.size * 0.16, this.y - this.size * 0.16, this.size * 0.32, this.size * 0.32); ctx.restore();
  };

  if (typeof baseSetTarget === 'function') {
    window.setTarget = function (e) { baseSetTarget(e); if (e.pointerType === 'touch') targetY = e.clientY - S(TOUCH_AHEAD); };
  }
  if (typeof baseResetGame === 'function') {
    window.resetGame = function () { formationAnchors.clear(); baseResetGame(); };
  }
})();
