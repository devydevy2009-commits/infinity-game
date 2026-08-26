// INFINITE — tutorial encounter patterns.
// Loaded after encounter_system.js so this layer owns only the staged patterns.
(() => {
  'use strict';

  const PATTERNS = [
    { at: 10, type: 'drone' },
    { at: 40, type: 'transport' },
    { at: 70, type: 'ghost' },
    { at: 100, type: 'hunter' }
  ];
  const baseSpawn = window.spawn;
  const baseEnemyUpdate = Enemy.prototype.update;
  const baseHunterUpdate = Enemy.prototype.updateHunter;
  const baseResetGame = window.resetGame;

  let patternIndex = 0;
  let active = null;

  function isActive(pattern) {
    return !!pattern && enemies.some(e => e.tutorialPattern === pattern);
  }

  function blocked() {
    if (!active) return false;
    if (isActive(active)) return true;
    active = null;
    return false;
  }

  function normalKind(t) {
    const r = Math.random();
    if (t < 10) return 'asteroid';
    if (t < 40) return r < 0.68 ? 'asteroid' : 'drone';
    if (t < 70) return r < 0.48 ? 'asteroid' : r < 0.78 ? 'drone' : 'transport';
    if (t < 100) return r < 0.38 ? 'asteroid' : r < 0.64 ? 'drone' : r < 0.84 ? 'transport' : 'ghost';
    return r < 0.30 ? 'asteroid' : r < 0.52 ? 'drone' : r < 0.75 ? 'transport' : r < 0.90 ? 'ghost' : 'hunter';
  }

  function createMember(kind, pattern, offset) {
    const e = new Enemy(kind);
    e.tutorialPattern = pattern;
    e.tutorialOffset = offset;
    e.formationId = null;
    e.formationControlled = true;
    e.x = pattern.anchor.x + offset.x;
    e.y = pattern.anchor.y + offset.y;
    e.vx = 0; e.vy = 0;
    return e;
  }

  function createPattern(type) {
    const p = {
      id: ++patternIndex,
      type,
      phase: 'entry',
      anchor: { x: cx, y: S(-55), vx: 0, vy: S(1.02) }
    };
    const offsets = [];

    if (type === 'drone') {
      const gx = S(34), gy = S(34);
      for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) offsets.push({ x: (col - 1) * gx, y: row * gy });
    } else if (type === 'transport') {
      const gx = S(38), count = Math.ceil(width / gx) + 1;
      p.anchor.x = -gx * 0.5;
      p.anchor.vy = S(1.00);
      for (let i = 0; i < count; i++) offsets.push({ x: i * gx, y: 0 });
    } else if (type === 'ghost') {
      const gx = S(31.5), count = Math.ceil(width / gx) + 2;
      p.anchor.x = -gx;
      p.anchor.vy = S(0.96);
      for (let i = 0; i < count; i++) offsets.push({ x: i * gx, y: 0 });
    } else if (type === 'hunter') {
      const gx = S(38), gy = S(38);
      offsets.push(
        { x: 0, y: 0 },
        { x: -gx, y: gy }, { x: gx, y: gy },
        { x: -gx * 2, y: gy * 2 }, { x: 0, y: gy * 2 }, { x: gx * 2, y: gy * 2 },
        { x: -gx * 3, y: gy * 3 }, { x: 0, y: gy * 3 }, { x: gx * 3, y: gy * 3 }
      );
    }

    p.anchor.x = type === 'transport' || type === 'ghost' ? p.anchor.x : cx;
    p.anchor.vy = p.anchor.vy || S(1.02);
    const members = offsets.map(offset => createMember(type, p, offset));
    enemies.push(...members);
    active = p;
    return p;
  }

  function currentPatternDue(seconds) {
    if (patternIndex >= PATTERNS.length || active) return false;
    return seconds >= PATTERNS[patternIndex].at;
  }

  function updatePattern(p, f) {
    if (!p || !isActive(p)) return;

    if (p.type === 'hunter' && p.phase === 'entry' && p.anchor.y >= height * 0.46) {
      p.phase = 'split';
      const hunters = enemies.filter(e => e.tutorialPattern === p);
      hunters.forEach((e, i) => {
        e.formationControlled = false;
        e.patternDetached = true;
        e.surroundAngle = -Math.PI / 2 + (i / hunters.length) * Math.PI * 2;
      });
      return;
    }

    if (p.phase === 'split') return;

    p.anchor.x = clamp(p.anchor.x + p.anchor.vx * f, -S(140), width + S(140));
    p.anchor.y += p.anchor.vy * f;
    for (const e of enemies) {
      if (e.tutorialPattern !== p || e.patternDetached) continue;
      e.x = p.anchor.x + e.tutorialOffset.x;
      e.y = p.anchor.y + e.tutorialOffset.y;
      e.vx = 0; e.vy = 0;
      if (e.kind === 'hunter' && player) e.rot = Math.atan2(player.y - e.y, player.x - e.x) + Math.PI / 2;
    }
  }

  Enemy.prototype.updateHunter = function (f) {
    baseHunterUpdate.call(this, f);
    if (!player || !this.tutorialPattern || this.tutorialPattern.phase !== 'split') return;

    const angle = this.surroundAngle ?? 0;
    const radius = S(112 + Math.min(tier(), 10) * 3);
    const tx = player.x + Math.cos(angle) * radius;
    const ty = player.y + Math.sin(angle) * radius;
    const dx = tx - this.x, dy = ty - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const steer = S(0.11) * f;
    this.vx += dx / dist * steer;
    this.vy += dy / dist * steer;
    const px = -Math.sin(angle), py = Math.cos(angle);
    const tangential = S(0.035) * f;
    this.vx += px * tangential;
    this.vy += py * tangential;
    this.rot = Math.atan2(player.y - this.y, player.x - this.x) + Math.PI / 2;
  };

  Enemy.prototype.update = function (f) {
    const controlled = this.formationControlled;
    const x = this.x, y = this.y;
    baseEnemyUpdate.call(this, f);
    if (controlled && !this.patternDetached) {
      this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    }
  };

  window.updateFormations = function (f) {
    if (active) updatePattern(active, f);
  };

  window.spawn = function () {
    const t = secs();
    if (blocked()) return;

    if (currentPatternDue(t)) {
      createPattern(PATTERNS[patternIndex].type);
      patternIndex++;
      return;
    }

    // Keep the original power-up timing/guard behavior, but remove every
    // enemy that the legacy random-wave scheduler may add in this frame.
    const before = new Set(enemies);
    baseSpawn();
    const additions = enemies.filter(e => !before.has(e));
    const allowed = normalKind(t);
    for (const e of additions) {
      const legacyFormation = !!e.formationId;
      if (legacyFormation || e.kind !== allowed) {
        const i = enemies.indexOf(e);
        if (i >= 0) enemies.splice(i, 1);
      }
    }
  };

  if (typeof baseResetGame === 'function') {
    window.resetGame = function () {
      patternIndex = 0;
      active = null;
      baseResetGame();
    };
  }
})();
