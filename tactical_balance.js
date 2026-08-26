// ============================================================
// INFINITY — tactical balance, input refinement & tutorial patterns
// Isolated extension layer for advanced enemy and formation rules.
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

  // Tutorial pattern schedule. A pattern blocks ordinary enemy spawning
  // until every member of that pattern has disappeared from the arena.
  const TUTORIAL_PATTERNS = [
    { at: 10, type: 'drone' },
    { at: 40, type: 'transport' },
    { at: 70, type: 'ghost' },
    { at: 100, type: 'hunter' }
  ];

  let tutorialIndex = 0;
  let tutorialSerial = 0;
  let activeTutorial = null;

  const originalPlayerUpdate = Player.prototype.update;
  const originalHunterUpdate = Enemy.prototype.updateHunter;
  const originalEnemyUpdate = Enemy.prototype.update;
  const originalEnemyDraw = Enemy.prototype.draw;
  const originalPowerupDraw = Powerup.prototype.draw;
  const originalResetGame = window.resetGame;

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

  function hunterIsInTutorialSurround(enemy) {
    return enemy && enemy.tutorialPattern?.type === 'hunter' && enemy.tutorialPattern.phase === 'split';
  }

  Enemy.prototype.updateHunter = function (f) {
    if (!player) return;
    const originalY = this.y;
    originalHunterUpdate.call(this, f);

    // Once the wedge splits, hunters stop behaving like independent random
    // pursuers and deliberately move toward fixed orbit targets around the player.
    if (hunterIsInTutorialSurround(this)) {
      const p = this.tutorialPattern;
      const angle = this.surroundAngle ?? 0;
      const radius = S(112 + Math.min(tier(), 10) * 3);
      const tx = player.x + Math.cos(angle) * radius;
      const ty = player.y + Math.sin(angle) * radius;
      const dx = tx - this.x;
      const dy = ty - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      const steer = S(0.11) * f;
      this.vx += (dx / dist) * steer;
      this.vy += (dy / dist) * steer;

      // Add tangential movement so the formation visibly tries to envelop
      // the player instead of simply converging on four static points.
      const px = -Math.sin(angle);
      const py = Math.cos(angle);
      const tangential = S(0.035) * f;
      this.vx += px * tangential;
      this.vy += py * tangential;

      const dxp = player.x - this.x;
      const dyp = player.y - this.y;
      this.rot = Math.atan2(dyp, dxp) + Math.PI / 2;

      const speed = Math.hypot(this.vx, this.vy);
      const cap = S(MAX_ENEMY_SPEED + Math.min(tier(), 10) * 0.04);
      if (speed > cap) {
        this.vx = this.vx / speed * cap;
        this.vy = this.vy / speed * cap;
      }
      return;
    }

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
        ctx.translate(this.x, this.y);
        ctx.rotate(Date.now() / 1200);
        const s = this.size * 0.72;
        ctx.beginPath();
        ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0); ctx.closePath(); ctx.stroke();
      }
      ctx.restore();
    }
  };

  function patternStillOnScreen(pattern) {
    if (!pattern) return false;
    return enemies.some(e => e.tutorialPattern === pattern);
  }

  function tutorialBlocked() {
    if (!activeTutorial) return false;
    if (patternStillOnScreen(activeTutorial)) return true;
    activeTutorial = null;
    return false;
  }

  function makeTutorialEnemy(kind, pattern, offset) {
    const e = new Enemy(kind);
    e.formationId = null;
    e.formOffset = offset;
    e.tutorialPattern = pattern;
    e.x = pattern.anchor.x + offset.x;
    e.y = pattern.anchor.y + offset.y;
    e.vx = pattern.anchor.vx;
    e.vy = pattern.anchor.vy;
    ensureScaledHealth(e);
    return e;
  }

  function makeTutorialPattern(type) {
    const pattern = {
      id: ++tutorialSerial,
      type,
      phase: 'entry',
      anchor: { x: cx, y: -S(55), vx: 0, vy: S(1.05) },
      members: []
    };

    if (type === 'drone') {
      // Compact 3 x 3 block: the first real tutorial pattern.
      const gapX = S(34);
      const gapY = S(34);
      pattern.anchor.x = cx;
      pattern.members = [];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          pattern.members.push({ x: (col - 1) * gapX, y: row * gapY });
        }
      }
      pattern.anchor.vy = S(1.02);
    } else if (type === 'transport') {
      // Solid convoy: transport hulls touch/overlap slightly so there is no
      // artificial gap to slip through.
      const gapX = S(38);
      const count = Math.ceil(width / gapX) + 1;
      pattern.anchor.x = -gapX * 0.5;
      pattern.members = Array.from({ length: count }, (_, i) => ({ x: i * gapX, y: 0 }));
      pattern.anchor.vy = S(1.00);
    } else if (type === 'ghost') {
      // Nearly wall-to-wall ghost line with only a narrow visual gap between units.
      const gapX = S(31.5);
      const count = Math.ceil(width / gapX) + 2;
      pattern.anchor.x = -gapX;
      pattern.members = Array.from({ length: count }, (_, i) => ({ x: i * gapX, y: 0 }));
      pattern.anchor.vy = S(0.96);
    } else if (type === 'hunter') {
      // Nine-hunter wedge. At mid-screen it releases into a controlled surround.
      const gapX = S(38);
      const gapY = S(38);
      const wedge = [
        { x: 0, y: 0 },
        { x: -gapX, y: gapY }, { x: gapX, y: gapY },
        { x: -gapX * 2, y: gapY * 2 }, { x: 0, y: gapY * 2 }, { x: gapX * 2, y: gapY * 2 },
        { x: -gapX * 3, y: gapY * 3 }, { x: 0, y: gapY * 3 }, { x: gapX * 3, y: gapY * 3 }
      ];
      pattern.members = wedge;
      pattern.anchor.x = cx;
      pattern.anchor.vy = S(1.02);
    }

    for (const offset of pattern.members) {
      const kind = type;
      const e = makeTutorialEnemy(kind, pattern, offset);
      if (type === 'hunter') {
        e.rot = Math.atan2(player.y - e.y, player.x - e.x) + Math.PI / 2;
      }
      enemies.push(e);
    }

    activeTutorial = pattern;
    return pattern;
  }

  function updateTutorialPattern(pattern, f) {
    if (!pattern || !patternStillOnScreen(pattern)) return;

    // Hunters intentionally stop being a rigid formation near mid-screen.
    if (pattern.type === 'hunter' && pattern.phase === 'entry' && pattern.anchor.y >= height * 0.46) {
      pattern.phase = 'split';
      const hunters = enemies.filter(e => e.tutorialPattern === pattern && e.kind === 'hunter');
      const count = Math.max(1, hunters.length);
      hunters.forEach((e, i) => {
        e.formationId = null;
        e.patternDetached = true;
        e.surroundAngle = -Math.PI / 2 + (i / count) * Math.PI * 2;
      });
    }

    if (pattern.phase === 'split') return;

    pattern.anchor.x = clamp(pattern.anchor.x + pattern.anchor.vx * f, -S(100), width + S(100));
    pattern.anchor.y += pattern.anchor.vy * f;

    for (const e of enemies) {
      if (e.tutorialPattern !== pattern || e.patternDetached) continue;
      e.x = pattern.anchor.x + (e.formOffset?.x || 0);
      e.y = pattern.anchor.y + (e.formOffset?.y || 0);
      if (e.kind === 'hunter' && player) e.rot = Math.atan2(player.y - e.y, player.x - e.x) + Math.PI / 2;
    }
  }

  // Keep the existing global hook so game.js can keep calling updateFormations().
  window.updateFormations = function (f) {
    if (activeTutorial) updateTutorialPattern(activeTutorial, f);

    // Preserve formation support for any legacy/external formation members,
    // but never let it interfere with the new tutorial patterns.
    const groups = new Map();
    for (const e of enemies) {
      if (!e.formationId || e.tutorialPattern || e.patternDetached || !e.formAnchor) continue;
      if (!groups.has(e.formationId)) groups.set(e.formationId, { anchor: e.formAnchor, members: [] });
      groups.get(e.formationId).members.push(e);
    }
    for (const { anchor, members } of groups.values()) {
      anchor.x = clamp(anchor.x + anchor.vx * f, S(90), Math.max(S(90), width - S(90)));
      anchor.y += anchor.vy * f;
      for (const e of members) {
        e.x = anchor.x + (e.formOffset?.x || 0);
        e.y = anchor.y + (e.formOffset?.y || 0);
      }
    }
  };

  function protectPowerup(p) {
    if (!p || p.protected || tutorialBlocked() || enemies.some(e => e.protectedPowerup === p)) return;
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

  function allowedRandomKinds(t) {
    if (t < 10) return ['asteroid'];
    if (t < 40) return ['asteroid', 'drone'];
    if (t < 70) return ['asteroid', 'drone', 'transport'];
    if (t < 100) return ['asteroid', 'drone', 'transport', 'ghost'];
    return ['asteroid', 'drone', 'transport', 'ghost', 'hunter'];
  }

  function spawnRandomEnemy() {
    const t = secs();
    const kinds = allowedRandomKinds(t);
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    enemies.push(new Enemy(kind));
  }

  function maybeStartTutorialPattern() {
    if (tutorialBlocked() || tutorialIndex >= TUTORIAL_PATTERNS.length) return;
    const nowSec = secs();
    if (nowSec < TUTORIAL_PATTERNS[tutorialIndex].at) return;

    const next = TUTORIAL_PATTERNS[tutorialIndex++];
    makeTutorialPattern(next.type);
  }

  // Replace the base spawn scheduler. The original engine used random
  // formations every few seconds, which directly conflicted with tutorial mode.
  window.spawn = function () {
    const now = Date.now();
    maybeStartTutorialPattern();

    // While a tutorial pattern is alive, ordinary enemy spawning is completely paused.
    if (!tutorialBlocked()) {
      const t = tier();
      const cap = 8 + t * 3;
      if (enemies.length < cap && Math.random() < 0.024 + Math.min(t, 18) * 0.0028) {
        spawnRandomEnemy();
      }
    }

    // Power-up timing remains independent from enemy pattern timing.
    if (!nextPowerupAt) nextPowerupAt = now + 12000;
    if (now >= nextPowerupAt && powerups.length === 0) {
      const p = new Powerup();
      powerups.push(p);
      if (!tutorialBlocked() && tier() >= 2 && Math.random() < PROTECTED_POWERUP_CHANCE) protectPowerup(p);
      nextPowerupAt += 22000;
    }
  };

  // Reset the tutorial sequence together with the normal game state.
  if (typeof originalResetGame === 'function') {
    window.resetGame = function () {
      tutorialIndex = 0;
      tutorialSerial = 0;
      activeTutorial = null;
      originalResetGame.call(this);
    };
  }

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
    ctx.moveTo(this.x - this.size * 0.95, this.y); ctx.lineTo(this.x + this.size * 0.95, this.y);
    ctx.moveTo(this.x - this.size * 0.28, this.y - this.size * 0.58); ctx.lineTo(this.x - this.size * 0.28, this.y);
    ctx.moveTo(this.x + this.size * 0.32, this.y); ctx.lineTo(this.x + this.size * 0.32, this.y + this.size * 0.58);
    ctx.stroke();
    ctx.fillStyle = '#d8f4ff';
    ctx.globalAlpha = this.protected ? 0.9 : 0.72;
    ctx.fillRect(this.x - this.size * 0.16, this.y - this.size * 0.16, this.size * 0.32, this.size * 0.32);
    ctx.restore();
  };

  const originalSetTarget = window.setTarget;
  if (typeof originalSetTarget === 'function') {
    window.setTarget = function (e) {
      originalSetTarget(e);
      if (e.pointerType === 'touch') targetY = e.clientY - S(TOUCH_AHEAD_REFINED);
    };
  }
})();
