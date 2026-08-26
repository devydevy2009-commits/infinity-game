// INFINITE — tutorial encounter patterns.
// One owner for staged tutorial patterns; legacy random formations remain active.
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
  const baseUpdateFormations = window.updateFormations;
  const baseResetGame = window.resetGame;

  let patternIndex = 0;
  let active = null;

  function activePatternExists(pattern) {
    return !!pattern && enemies.some(e => e.tutorialPattern === pattern);
  }

  function releaseFinishedPattern() {
    if (!active || activePatternExists(active)) return false;
    active = null;
    return true;
  }

  function skipPastMissedPatterns(seconds) {
    while (patternIndex < PATTERNS.length && seconds > PATTERNS[patternIndex].at) patternIndex++;
  }

  function allowedKinds(seconds) {
    if (seconds < 10) return ['asteroid'];
    if (seconds < 40) return ['asteroid', 'drone'];
    if (seconds < 70) return ['asteroid', 'drone', 'transport'];
    if (seconds < 100) return ['asteroid', 'drone', 'transport', 'ghost'];
    return ['asteroid', 'drone', 'transport', 'ghost', 'hunter'];
  }

  function fallbackKind(seconds) {
    if (seconds < 10) return 'asteroid';
    if (seconds < 40) return 'drone';
    if (seconds < 70) return 'transport';
    if (seconds < 100) return 'ghost';
    return 'hunter';
  }

  // Preserve formation / power-up guard geometry while changing only an
  // enemy type that would violate the staged progression.
  function replaceEnemyKind(enemy, kind) {
    if (!enemy || enemy.kind === kind) return enemy;
    const replacement = new Enemy(kind);
    const fields = [
      'x', 'y', 'vx', 'vy', 'rot', 'hitUntil', 'lastShot', 'lastGhostShot',
      'orbit', 'formationId', 'formOffset', 'formAnchor', 'formationControlled',
      'protectedPowerup', 'guardOffset'
    ];
    for (const field of fields) if (field in enemy) replacement[field] = enemy[field];
    replacement._tacticalHpReady = false;
    return replacement;
  }

  function sanitizeNewEnemies(before, seconds) {
    const allowed = allowedKinds(seconds);
    const fallback = fallbackKind(seconds);
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (before.has(enemy) || allowed.includes(enemy.kind)) continue;
      enemies[i] = replaceEnemyKind(enemy, fallback);
    }
  }

  function createMember(kind, pattern, offset) {
    const enemy = new Enemy(kind);
    enemy.tutorialPattern = pattern;
    enemy.tutorialOffset = offset;
    enemy.formationId = null;
    enemy.formationControlled = true;
    enemy.x = pattern.anchor.x + offset.x;
    enemy.y = pattern.anchor.y + offset.y;
    enemy.vx = 0;
    enemy.vy = 0;
    return enemy;
  }

  function createPattern(type) {
    const pattern = {
      type,
      phase: 'entry',
      anchor: { x: cx, y: -S(58), vx: 0, vy: S(1.02) }
    };
    const offsets = [];

    if (type === 'drone') {
      const gx = S(34), gy = S(34);
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) offsets.push({ x: (col - 1) * gx, y: row * gy });
      }
    } else if (type === 'transport') {
      // Continuous wall: transport collision radius is S(20), so S(40)
      // center spacing removes the passage without overlapping hulls.
      const gx = S(40);
      const count = Math.ceil(width / gx) + 2;
      pattern.anchor.x = -gx;
      pattern.anchor.vy = S(1.00);
      for (let i = 0; i < count; i++) offsets.push({ x: i * gx, y: 0 });
    } else if (type === 'ghost') {
      // Checker/zig-zag line. The diagonal spacing leaves a real corridor
      // between consecutive ghosts while still covering the full width.
      const gx = S(44), gy = S(26);
      const count = Math.ceil(width / gx) + 3;
      pattern.anchor.x = -gx;
      pattern.anchor.vy = S(0.96);
      for (let i = 0; i < count; i++) offsets.push({ x: i * gx, y: i % 2 === 0 ? -gy : gy });
    } else if (type === 'hunter') {
      const gx = S(46), gy = S(42);
      offsets.push(
        { x: 0, y: 0 },
        { x: -gx, y: gy }, { x: gx, y: gy },
        { x: -gx * 2, y: gy * 2 }, { x: 0, y: gy * 2 }, { x: gx * 2, y: gy * 2 },
        { x: -gx * 3, y: gy * 3 }, { x: 0, y: gy * 3 }, { x: gx * 3, y: gy * 3 }
      );
    }

    const members = offsets.map(offset => createMember(type, pattern, offset));
    enemies.push(...members);
    active = pattern;
    return pattern;
  }

  function patternDue(seconds) {
    skipPastMissedPatterns(seconds);
    return !active && patternIndex < PATTERNS.length && seconds >= PATTERNS[patternIndex].at;
  }

  function updateTutorialPattern(pattern, f) {
    if (!pattern || !activePatternExists(pattern)) return;

    if (pattern.type === 'hunter' && pattern.phase === 'entry' && pattern.anchor.y >= height * 0.46) {
      pattern.phase = 'split';
      const hunters = enemies.filter(e => e.tutorialPattern === pattern);
      const count = hunters.length || 1;
      hunters.forEach((enemy, index) => {
        enemy.formationControlled = false;
        enemy.patternDetached = true;
        enemy.tutorialSurround = true;
        enemy.surroundAngle = -Math.PI / 2 + (index / count) * Math.PI * 2;
      });
      return;
    }

    if (pattern.phase === 'split') return;

    pattern.anchor.x = clamp(pattern.anchor.x + pattern.anchor.vx * f, -S(160), width + S(160));
    pattern.anchor.y += pattern.anchor.vy * f;
    for (const enemy of enemies) {
      if (enemy.tutorialPattern !== pattern || enemy.patternDetached) continue;
      enemy.x = pattern.anchor.x + enemy.tutorialOffset.x;
      enemy.y = pattern.anchor.y + enemy.tutorialOffset.y;
      enemy.vx = 0;
      enemy.vy = 0;
      if (enemy.kind === 'hunter' && player) enemy.rot = Math.atan2(player.y - enemy.y, player.x - enemy.x) + Math.PI / 2;
    }
  }

  Enemy.prototype.updateHunter = function (f) {
    const surround = this.tutorialSurround && this.tutorialPattern?.phase === 'split';
    if (surround) {
      // Tactical balance normally applies a lower-screen Hunter brake.
      // Temporarily mark this Hunter as controlled so that brake does not
      // fight the intentional tutorial surround movement.
      const wasControlled = this.formationControlled;
      this.formationControlled = true;
      baseHunterUpdate.call(this, f);
      this.formationControlled = wasControlled;

      if (!player) return;
      const angle = this.surroundAngle ?? 0;
      const radius = S(118);
      const tx = player.x + Math.cos(angle) * radius;
      const ty = player.y + Math.sin(angle) * radius;
      const dx = tx - this.x, dy = ty - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      const steer = S(0.095) * f;
      this.vx += (dx / dist) * steer;
      this.vy += (dy / dist) * steer;

      const txv = -Math.sin(angle), tyv = Math.cos(angle);
      const tangential = S(0.025) * f;
      this.vx += txv * tangential;
      this.vy += tyv * tangential;
      this.rot = Math.atan2(player.y - this.y, player.x - this.x) + Math.PI / 2;
      return;
    }
    baseHunterUpdate.call(this, f);
  };

  Enemy.prototype.update = function (f) {
    const controlled = this.formationControlled;
    const x = this.x, y = this.y;
    baseEnemyUpdate.call(this, f);
    if (controlled && !this.patternDetached) {
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
    }
  };

  window.updateFormations = function (f) {
    if (active) updateTutorialPattern(active, f);
    releaseFinishedPattern();
    // Keep the tactical layer responsible for legacy random formations.
    if (typeof baseUpdateFormations === 'function') baseUpdateFormations(f);
  };

  window.spawn = function () {
    const seconds = secs();
    releaseFinishedPattern();
    if (active) return;

    if (patternDue(seconds)) {
      createPattern(PATTERNS[patternIndex].type);
      patternIndex++;
      return;
    }

    const before = new Set(enemies);
    baseSpawn();
    sanitizeNewEnemies(before, seconds);
  };

  if (typeof baseResetGame === 'function') {
    window.resetGame = function () {
      patternIndex = 0;
      active = null;
      baseResetGame();
    };
  }

  window.INFINITE_TUTORIAL_STATE = Object.freeze({
    patterns: PATTERNS.map(p => ({ ...p })),
    get index() { return patternIndex; },
    get activeType() { return active?.type || null; },
    get blocked() { return !!active; }
  });
})();
