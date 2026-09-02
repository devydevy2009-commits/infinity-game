// INFINITY — Drone Carriers boss encounter.
// Dedicated boss layer: regular enemy spawning is suspended while active.
(() => {
  'use strict';

  const BOSS_NAME = 'DRONE CARRIERS';
  const BOSS_TRIGGER_DELAY = 20;
  const CARRIER_COUNT = 3;
  const SIDE_HP = 55;
  const CORE_HP = 90;
  const DRONES_PER_CARRIER = 3;
  const DRONE_RESPAWN_MS = 850;
  const DRONE_ORBIT_RADIUS = 54;
  const DRONE_ORBIT_SPEED = 0.018;
  const BOSS_FIRE_INTERVAL = 1450;
  const DRONE_FIRE_INTERVAL = 1850;
  const BOSS_BULLET_SPEED = 3.9;
  const BOSS_BULLET_COUNT = 7;

  const baseSpawn = window.spawn;
  const baseUpdate = window.update;
  const baseDraw = window.draw;
  const baseCollisions = window.collisions;
  const baseResetGame = window.resetGame;

  let activeBoss = null;
  let bossTriggerAt = null;

  function ghostPatternTime() {
    const patterns = window.INFINITE_TUTORIAL_STATE?.patterns || [];
    const ghost = patterns.find(pattern => pattern.type === 'ghost');
    return ghost ? ghost.at : 70;
  }

  function bossStartTime() {
    return ghostPatternTime() + BOSS_TRIGGER_DELAY;
  }

  class BossDrone {
    constructor(carrier, index) {
      this.carrier = carrier;
      this.index = index;
      this.angle = (index / DRONES_PER_CARRIER) * Math.PI * 2;
      this.radius = S(DRONE_ORBIT_RADIUS);
      this.size = S(10);
      this.hp = 3;
      this.maxHp = 3;
      this.lastShot = Date.now() + index * 280;
      this.hitUntil = 0;
      this.dead = false;
      this.x = carrier.x;
      this.y = carrier.y;
    }

    update(f) {
      this.angle += DRONE_ORBIT_SPEED * f * (this.carrier.direction || 1);
      this.x = this.carrier.x + Math.cos(this.angle) * this.radius;
      this.y = this.carrier.y + Math.sin(this.angle) * this.radius;

      const now = Date.now();
      if (now - this.lastShot >= DRONE_FIRE_INTERVAL) {
        fireBossRandomBurst(this.x, this.y, 2, 4.25);
        this.lastShot = now;
      }
    }

    draw() {
      const flashing = Date.now() < this.hitUntil && Math.floor(Date.now() / 70) % 2 === 0;
      const color = flashing ? '#fff' : '#ff9a3d';
      const s = this.size;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.strokeStyle = color;
      ctx.lineWidth = S(2);
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    b() { return { x: this.x, y: this.y, r: this.size * 1.05 }; }
  }

  class Carrier {
    constructor(index) {
      this.index = index;
      this.central = index === 1;
      this.x = cx + (index - 1) * S(118);
      this.y = -S(70) - Math.abs(index - 1) * S(16);
      this.targetY = height * 0.24 + (index === 1 ? 0 : S(10));
      this.hp = this.central ? CORE_HP : SIDE_HP;
      this.maxHp = this.hp;
      this.size = this.central ? S(38) : S(29);
      this.direction = index === 1 ? 1 : index === 0 ? -1 : 1;
      this.phase = index * 1.7;
      this.lastShot = Date.now() + index * 350;
      this.drones = [];
      this.hitUntil = 0;
      this.dead = false;
    }

    update(f) {
      this.phase += 0.012 * f;
      if (this.y < this.targetY) this.y = Math.min(this.targetY, this.y + S(0.72) * f);
      this.x += Math.sin(this.phase) * S(0.32) * f;
      this.x = clamp(this.x, this.size + S(12), width - this.size - S(12));

      const now = Date.now();
      if (now - this.lastShot >= BOSS_FIRE_INTERVAL) {
        fireBossRing(this.x, this.y, BOSS_BULLET_COUNT, BOSS_BULLET_SPEED, this.index * 0.18);
        this.lastShot = now;
      }

      for (const drone of this.drones) if (drone && !drone.dead) drone.update(f);
    }

    draw() {
      const flashing = Date.now() < this.hitUntil && Math.floor(Date.now() / 70) % 2 === 0;
      const color = flashing ? '#fff' : (this.central ? '#ff3d3d' : '#ff7a3d');
      const s = this.size;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(Math.sin(this.phase) * 0.08);
      ctx.strokeStyle = color;
      ctx.lineWidth = S(this.central ? 3.2 : 2.5);
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.78, -s * 0.38);
      ctx.lineTo(s, 0);
      ctx.lineTo(s * 0.78, s * 0.38);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.78, s * 0.38);
      ctx.lineTo(-s, 0);
      ctx.lineTo(-s * 0.78, -s * 0.38);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.58, 0);
      ctx.lineTo(s * 0.58, 0);
      ctx.moveTo(0, -s * 0.58);
      ctx.lineTo(0, s * 0.58);
      ctx.stroke();
      ctx.restore();
      drawCarrierBar(this);
    }

    b() { return { x: this.x, y: this.y, r: this.size * 0.9 }; }
  }

  function createBoss() {
    const boss = {
      name: BOSS_NAME,
      startedAt: Date.now(),
      carriers: Array.from({ length: CARRIER_COUNT }, (_, index) => new Carrier(index)),
      completed: false
    };
    for (const carrier of boss.carriers) {
      for (let i = 0; i < DRONES_PER_CARRIER; i++) carrier.drones.push(new BossDrone(carrier, i));
    }
    return boss;
  }

  function drawCarrierBar(carrier) {
    const widthBar = carrier.central ? S(118) : S(78);
    const heightBar = carrier.central ? S(6) : S(4);
    const x = carrier.x - widthBar / 2;
    const y = carrier.y + carrier.size + S(10);
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.fillRect(x, y, widthBar, heightBar);
    ctx.fillStyle = carrier.central ? '#ff3d3d' : '#ff9a3d';
    ctx.fillRect(x, y, widthBar * clamp(carrier.hp / carrier.maxHp, 0, 1), heightBar);
    ctx.restore();
  }

  function drawBossHud() {
    if (!activeBoss) return;
    const core = activeBoss.carriers[1];
    const widthBar = Math.min(width * 0.68, S(270));
    const heightBar = S(7);
    const x = (width - widthBar) / 2;
    const y = S(44);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.max(11, S(12))}px sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.88;
    ctx.fillText(BOSS_NAME, cx, y - S(10));
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    ctx.fillRect(x, y, widthBar, heightBar);
    ctx.fillStyle = '#ff3d3d';
    ctx.fillRect(x, y, widthBar * clamp(core.hp / core.maxHp, 0, 1), heightBar);
    ctx.restore();
  }

  function fireBossRandomBurst(x, y, count, speedBase) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = S(speedBase * (0.94 + Math.random() * 0.12));
      const bullet = new EnemyBullet(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 'drone');
      bullet.bossBullet = true;
      enemyBullets.push(bullet);
    }
  }

  function fireBossRing(x, y, count, speedBase, rotation) {
    for (let i = 0; i < count; i++) {
      const angle = rotation + (i / count) * Math.PI * 2;
      const speed = S(speedBase);
      const bullet = new EnemyBullet(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 'drone');
      bullet.bossBullet = true;
      enemyBullets.push(bullet);
    }
  }

  function damageBossTarget(target, amount) {
    target.hp -= amount;
    target.hitUntil = Date.now() + 90;
    if (target.hp <= 0) {
      target.hp = 0;
      target.dead = true;
      burst(target.x, target.y, target.central ? '#ff3d3d' : '#ff9a3d', target.central ? 45 : 28);
    }
  }

  function replaceDrone(carrier, index) {
    carrier.drones[index] = new BossDrone(carrier, index);
  }

  function updateDroneRespawns(carrier) {
    for (let i = 0; i < carrier.drones.length; i++) {
      const drone = carrier.drones[i];
      if (!drone || !drone.dead) continue;
      if (!drone.respawnAt) drone.respawnAt = Date.now() + DRONE_RESPAWN_MS;
      if (Date.now() >= drone.respawnAt) replaceDrone(carrier, i);
    }
  }

  function processBossCollisions() {
    if (!activeBoss || !player) return;
    const pb = player.b();

    for (const carrier of activeBoss.carriers) {
      if (carrier.dead) continue;

      for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        if (!overlap(carrier.b(), bullet.b())) continue;
        damageBossTarget(carrier, bullet.damage || 1);
        bullets.splice(i, 1);
        if (carrier.dead) {
          carrier.drones.forEach(drone => { if (drone) drone.dead = true; });
          if (carrier.central) activeBoss.completed = true;
          break;
        }
      }

      for (let i = carrier.drones.length - 1; i >= 0; i--) {
        const drone = carrier.drones[i];
        if (!drone || drone.dead) continue;
        for (let j = bullets.length - 1; j >= 0; j--) {
          if (!overlap(drone.b(), bullets[j].b())) continue;
          damageBossTarget(drone, bullets[j].damage || 1);
          bullets.splice(j, 1);
          if (drone.dead) {
            drone.respawnAt = Date.now() + DRONE_RESPAWN_MS;
            break;
          }
        }
        if (!drone.dead && overlap(pb, drone.b())) {
          damage();
          drone.dead = true;
          drone.respawnAt = Date.now() + DRONE_RESPAWN_MS;
        }
      }

      if (!carrier.dead && overlap(pb, carrier.b())) damage();
    }

    if (activeBoss?.completed) finishBoss();
  }

  function startBoss() {
    if (activeBoss || !running) return;
    activeBoss = createBoss();
    burst(cx, height * 0.22, '#ff3d3d', 34);
  }

  function finishBoss() {
    if (!activeBoss) return;
    score += 5000;
    scoreEl.textContent = 'Score: ' + score;
    enemyBullets = enemyBullets.filter(b => !b.bossBullet);
    for (const carrier of activeBoss.carriers) burst(carrier.x, carrier.y, '#ff3d3d', 24);
    activeBoss = null;
  }

  window.spawn = function () {
    if (activeBoss) return;
    baseSpawn();
  };

  window.update = function () {
    if (bossTriggerAt === null) bossTriggerAt = bossStartTime();
    if (!activeBoss && secs() >= bossTriggerAt) startBoss();
    baseUpdate.call(this);
    if (!activeBoss) return;
    const f = Date.now() < slowUntil ? 0.32 : 1;
    for (const carrier of activeBoss.carriers) {
      if (!carrier.dead) carrier.update(f);
      updateDroneRespawns(carrier);
    }
    processBossCollisions();
  };

  window.draw = function () {
    baseDraw.call(this);
    if (!activeBoss) return;
    for (const carrier of activeBoss.carriers) {
      if (carrier.dead) continue;
      carrier.drones.forEach(drone => { if (drone && !drone.dead) drone.draw(); });
      carrier.draw();
    }
    drawBossHud();
  };

  window.collisions = function () {
    baseCollisions.call(this);
    processBossCollisions();
  };

  window.resetGame = function () {
    activeBoss = null;
    bossTriggerAt = null;
    baseResetGame.call(this);
  };

  window.INFINITE_BOSS_STATE = Object.freeze({
    get active() { return !!activeBoss; },
    get name() { return activeBoss?.name || null; },
    get triggerAt() { return bossTriggerAt ?? bossStartTime(); },
    get carriersAlive() { return activeBoss?.carriers.filter(carrier => !carrier.dead).length || 0; }
  });
})();
