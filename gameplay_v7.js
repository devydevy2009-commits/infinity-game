// Infinity gameplay v7 — coherent formations, consistent powerups, and scaled powerup pressure.
// Loaded after v6. This layer owns spawning/group movement only; v6 remains the
// single authoritative player weapon system.
(() => {
  const BASE_FORMATION_INTERVAL = 14000;
  const TEST_POWERUP_INTERVAL = 7500; // ~3x the previous 22s cadence for testing.
  const FIRST_POWERUP_DELAY = 5000;
  const FORMATION_UNLOCK_TIER = 1;
  const ESCORT_UNLOCK_TIER = 4;

  let nextFormationAt = 0;
  let nextPowerupAt = 0;
  let formationId = 0;
  let protectedPowerupCount = 0;
  let formationGroups = [];
  let protectedPowerupGroups = [];

  const baseUpdate = update;
  const baseReset = resetGame;

  function pressureMultiplier() {
    const t = tier();
    if (t <= 2) return 2.0;
    if (t <= 5) return 1.8;
    if (t <= 8) return 1.6;
    if (t <= 11) return 1.45;
    return 1.35;
  }

  function makeConsistentPowerup(x, y) {
    const p = new Powerup();
    p.x = x;
    p.y = y;
    p.size = S(24);
    p.vx = 0;
    p.vy = 0;
    p.rot = 0;
    p.phase = 0;
    p._gameplayV7 = true;
    p._protectedGroupId = null;
    p.update = function() {
      // Position is controlled by the v7 group system.
      this.phase += 0.04;
      this.rot += 0.025;
    };
    p.draw = function() {
      const pulse = 1 + Math.sin(this.phase) * 0.06;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.scale(pulse, pulse);
      ctx.strokeStyle = '#69c4ff';
      ctx.lineWidth = S(3.2);
      ctx.strokeRect(-this.size * 0.5, -this.size * 0.5, this.size, this.size);
      ctx.beginPath();
      ctx.moveTo(-this.size * 0.27, 0);
      ctx.lineTo(this.size * 0.27, 0);
      ctx.moveTo(0, -this.size * 0.27);
      ctx.lineTo(0, this.size * 0.27);
      ctx.stroke();
      ctx.restore();
    };
    p.b = function() { return { x: this.x, y: this.y, r: this.size * 0.72 }; };
    return p;
  }

  function formationShape(count) {
    // Compact 1-2-3-4 rows. Offsets are fixed relative to one moving anchor.
    const offsets = [];
    let row = 1;
    while (offsets.length < count) {
      const rowCount = Math.min(4, row);
      for (let col = 0; col < rowCount && offsets.length < count; col++) {
        offsets.push({
          x: (col - (rowCount - 1) / 2) * S(44),
          y: (row - 1) * S(38)
        });
      }
      row++;
    }
    return offsets;
  }

  function createMovingFormation() {
    const t = tier();
    const count = Math.min(10, 4 + Math.floor((t - 1) / 2));
    const offsets = formationShape(count);
    const anchor = {
      x: width * (0.25 + Math.random() * 0.50),
      y: -S(58),
      vx: (Math.random() - 0.5) * S(0.35),
      vy: S(1.25 + Math.min(t, 15) * 0.04)
    };
    const group = {
      id: ++formationId,
      anchor,
      offsets,
      members: [],
      kind: 'wave'
    };

    offsets.forEach((offset, index) => {
      const kind = index % 5 === 0 && t >= 4 ? 'armored' : (index % 4 === 0 && t >= 2 ? 'shooter' : 'basic');
      const e = new Enemy(kind);
      e._formationGroupId = group.id;
      e._formationOffset = { x: offset.x, y: offset.y };
      e.x = anchor.x + offset.x;
      e.y = anchor.y + offset.y;
      e.vx = 0;
      e.vy = 0;
      group.members.push(e);
      enemies.push(e);
    });

    formationGroups.push(group);
  }

  function createProtectedPowerup() {
    const t = tier();
    const anchor = {
      x: width * (0.25 + Math.random() * 0.50),
      y: -S(72),
      vx: (Math.random() - 0.5) * S(0.28),
      vy: S(1.15 + Math.min(t, 15) * 0.035)
    };
    const group = {
      id: ++formationId,
      anchor,
      members: [],
      powerup: null,
      kind: 'protectedPowerup'
    };

    const p = makeConsistentPowerup(anchor.x, anchor.y);
    p._protectedGroupId = group.id;
    group.powerup = p;
    powerups.push(p);

    const offsets = [
      { x: -S(44), y: 0 },
      { x: S(44), y: 0 },
      { x: 0, y: -S(46) },
      { x: 0, y: S(46) }
    ];

    offsets.forEach((offset, index) => {
      const e = new Enemy(index % 2 === 0 ? 'armored' : 'basic');
      e._protectedPowerupId = group.id;
      e._formationGroupId = group.id;
      e._formationOffset = { x: offset.x, y: offset.y };
      e.x = anchor.x + offset.x;
      e.y = anchor.y + offset.y;
      e.vx = 0;
      e.vy = 0;
      group.members.push(e);
      enemies.push(e);
    });

    protectedPowerupGroups.push(group);
  }

  function spawnSoloPowerup() {
    const x = width * (0.14 + Math.random() * 0.72);
    const p = makeConsistentPowerup(x, -S(28));
    p.vy = S(1.35 + Math.min(tier(), 15) * 0.025);
    powerups.push(p);
  }

  function spawnV7() {
    if (!running || paused) return;
    const now = Date.now();
    const t = tier();
    const cap = 7 + Math.min(t, 10) * 2;

    if (!nextFormationAt) nextFormationAt = now + 11000;
    if (t >= FORMATION_UNLOCK_TIER && now >= nextFormationAt) {
      if (enemies.length + 5 < cap + 8) createMovingFormation();
      nextFormationAt += Math.max(9000, BASE_FORMATION_INTERVAL - Math.min(t, 12) * 250);
    }

    if (!nextPowerupAt) nextPowerupAt = now + FIRST_POWERUP_DELAY;
    if (now >= nextPowerupAt && powerups.length === 0) {
      // Every third powerup becomes a protected formation once the game is established.
      const useEscort = t >= ESCORT_UNLOCK_TIER && (protectedPowerupCount++ % 3 === 2);
      if (useEscort) createProtectedPowerup();
      else spawnSoloPowerup();
      nextPowerupAt += TEST_POWERUP_INTERVAL;
    }

    if (enemies.length < cap && Math.random() < 0.018 + t * 0.002) {
      enemies.push(new Enemy(t >= 2 ? (Math.random() < 0.35 ? 'shooter' : 'basic') : 'basic'));
    }
  }

  function updateFormationGroup(group, factor) {
    if (!group) return;
    const speedFactor = factor;
    group.anchor.x += group.anchor.vx * speedFactor;
    group.anchor.y += group.anchor.vy * speedFactor;

    group.members = group.members.filter(e => enemies.includes(e));
    group.members.forEach(e => {
      const o = e._formationOffset || { x: 0, y: 0 };
      e.x = group.anchor.x + o.x;
      e.y = group.anchor.y + o.y;
      e.vx = group.anchor.vx;
      e.vy = group.anchor.vy;
    });
  }

  function updateProtectedPowerupGroup(group, factor) {
    if (!group) return;
    group.anchor.x += group.anchor.vx * factor;
    group.anchor.y += group.anchor.vy * factor;

    const powerupAlive = group.powerup && powerups.includes(group.powerup);
    if (powerupAlive) {
      group.powerup.x = group.anchor.x;
      group.powerup.y = group.anchor.y;
    }

    group.members = group.members.filter(e => enemies.includes(e));
    group.members.forEach(e => {
      const o = e._formationOffset || { x: 0, y: 0 };
      e.x = group.anchor.x + o.x;
      e.y = group.anchor.y + o.y;
      e.vx = group.anchor.vx;
      e.vy = group.anchor.vy;
    });
  }

  function detachDestroyedProtectedGroups() {
    protectedPowerupGroups = protectedPowerupGroups.filter(group => {
      const powerupAlive = group.powerup && powerups.includes(group.powerup);
      group.members = group.members.filter(e => enemies.includes(e));
      if (powerupAlive) return true;

      // Once the powerup is collected, escorts leave formation and continue normally.
      group.members.forEach(e => {
        e._protectedPowerupId = null;
        e._formationGroupId = null;
        e._formationOffset = null;
        e.vx = e.vx || S((Math.random() - 0.5) * 0.5);
        e.vy = e.vy || S(1.25 + Math.min(tier(), 12) * 0.05);
      });
      return false;
    });
  }

  function cleanupWaveGroups() {
    formationGroups = formationGroups.filter(group => {
      group.members = group.members.filter(e => enemies.includes(e));
      return group.members.length > 0 && group.anchor.y < height + S(150);
    });
  }

  function applyScaledPowerupPressure() {
    const multiplier = pressureMultiplier();
    if (powerups.length === 0) return null;
    const changed = [];
    for (const e of enemies) {
      if (!e || e._formationGroupId) continue;
      e.vx *= multiplier;
      e.vy *= multiplier;
      changed.push(e);
    }
    for (const b of enemyBullets) {
      if (!b) continue;
      if (Number.isFinite(b.vx)) b.vx *= multiplier;
      b.vy *= multiplier;
      b._v7PressureMultiplier = multiplier;
    }
    return { changed, multiplier };
  }

  function restoreScaledPowerupPressure(state) {
    if (!state) return;
    for (const e of state.changed) {
      if (!enemies.includes(e)) continue;
      e.vx /= state.multiplier;
      e.vy /= state.multiplier;
    }
    for (const b of enemyBullets) {
      if (b && b._v7PressureMultiplier === state.multiplier) {
        if (Number.isFinite(b.vx)) b.vx /= state.multiplier;
        b.vy /= state.multiplier;
        delete b._v7PressureMultiplier;
      }
    }
  }

  resetGame = function resetGameV7() {
    baseReset();
    nextFormationAt = 0;
    nextPowerupAt = 0;
    formationId = 0;
    protectedPowerupCount = 0;
    formationGroups = [];
    protectedPowerupGroups = [];
  };

  spawn = spawnV7;

  update = function updateV7() {
    const factor = Date.now() < slowUntil ? 0.32 : 1;

    const pressure = applyScaledPowerupPressure();
    const formationMembers = [];
    formationGroups.forEach(group => group.members.forEach(e => formationMembers.push(e)));
    protectedPowerupGroups.forEach(group => group.members.forEach(e => formationMembers.push(e)));

    // Lock group-member velocities during the base update so AI steering cannot
    // break the formation. We restore the group trajectory after baseUpdate.
    const locked = new Map();
    formationMembers.forEach(e => {
      if (!enemies.includes(e)) return;
      locked.set(e, { vx: e.vx, vy: e.vy });
      e.vx = 0;
      e.vy = 0;
    });

    baseUpdate();

    locked.forEach((velocity, e) => {
      if (enemies.includes(e)) {
        e.vx = velocity.vx;
        e.vy = velocity.vy;
      }
    });

    formationGroups.forEach(group => updateFormationGroup(group, factor));
    protectedPowerupGroups.forEach(group => updateProtectedPowerupGroup(group, factor));
    cleanupWaveGroups();
    detachDestroyedProtectedGroups();
    restoreScaledPowerupPressure(pressure);
  };

  globalThis.InfinityPowerupPressureMultiplier = pressureMultiplier;
  globalThis.InfinityFormationGroups = () => formationGroups.length + protectedPowerupGroups.length;
})();
