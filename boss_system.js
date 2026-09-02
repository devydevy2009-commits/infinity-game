// INFINITY — Drone Carriers boss encounter.
// Dedicated boss layer. The core game/pattern engine remains untouched.
(() => {
  'use strict';

  const BOSS_NAME = 'DRONE CARRIERS';
  const BOSS_TRIGGER_DELAY = 20;
  const CARRIER_COUNT = 3;
  const SIDE_HP = 55;
  const CORE_HP = 90;
  const DRONES_PER_CARRIER = 3;

  const DRONE_RESPAWN_MS = 180;
  const DRONE_ORBIT_RADIUS = 54;
  const DRONE_ORBIT_SPEED = 0.018;

  // Deterministic roguelike-style barrage: dense diagonal lanes with two
  // permanent dodge corridors. No random bullet direction is used here.
  const BARRAGE_INTERVAL = 620;
  const BARRAGE_LANES = 10;
  const BARRAGE_SPEED_Y = 4.8;
  const BARRAGE_SPEED_X = 1.35;
  const BARRAGE_GAP_LANES = new Set([3, 7]);
  const BARRAGE_LANE_SPACING = 58;

  const baseSpawn = window.spawn;
  const baseUpdate = window.update;
  const baseDraw = window.draw;
  const baseResetGame = window.resetGame;

  let activeBoss = null;
  let bossTriggerAt = null;
  let bossCompleted = false;

  function hunterPatternTime() {
    const patterns = window.INFINITE_TUTORIAL_STATE?.patterns || [];
    const hunter = patterns.find(pattern => pattern.type === 'hunter');
    return hunter ? hunter.at : 100;
  }

  function bossStartTime() {
    return hunterPatternTime() + BOSS_TRIGGER_DELAY;
  }

  class BossDrone {
    constructor(carrier, index) {
      this.carrier = carrier;
      this.index = index;
      this.size = S(10);
      this.hp = 3;
      this.maxHp = 3;
      this.hitUntil = 0;
      this.dead = false;
      this.respawnAt = 0;
      this.x = carrier.x;
      this.y = carrier.y;
    }

    update() {
      const angle = activeBoss.orbitPhase + this.index * (Math.PI * 2 / DRONES_PER_CARRIER);
      this.x = this.carrier.x + Math.cos(angle) * this.radius;
      this.y = this.carrier.y + Math.sin(angle) * this.radius;
    }

    get radius() {
      return S(DRONE_ORBIT_RADIUS);
    }

    draw() {
      const flashing = Date.now() < this.hitUntil && Math.floor(Date.now() / 70) % 2 === 0;
      const color = flashing ? '#fff' : '#ff9a3d';
      const s = this.size;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(activeBoss.orbitPhase + this.index * Math.PI * 2 / DRONES_PER_CARRIER);
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
      this.x = cx + (index - 1) * S(122);
      this.y = -S(95) - Math.abs(index - 1) * S(12);
      this.targetY = height * (this.central ? 0.21 : 0.26);
      this.hp = this.central ? CORE_HP : SIDE_HP;
      this.maxHp = this.hp;
      this.length = this.central ? S(82) : S(70);
      this.width = this.central ? S(25) : S(21);
      this.phase = index * 1.4;
      this.hitUntil = 0;
      this.dead = false;
      this.drones = [];
    }

    update(f) {
      this.phase += 0.010 * f;
      if (this.y < this.targetY) this.y = Math.min(this.targetY, this.y + S(0.72) * f);
      this.x += Math.sin(this.phase) * S(0.32) * f;
      this.x = clamp(this.x, this.length * 0.55, width - this.length * 0.55);
      for (const drone of this.drones) if (drone && !drone.dead) drone.update();
    }

    draw() {
      const flashing = Date.now() < this.hitUntil && Math.floor(Date.now() / 70) % 2 === 0;
      const color = flashing ? '#fff' : (this.central ? '#ff3d3d' : '#ff7a3d');
      const l = this.length;
      const w = this.width;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(Math.sin(this.phase) * 0.035);
      ctx.strokeStyle = color;
      ctx.lineWidth = S(this.central ? 3.2 : 2.5);

      // Long spacecraft silhouette: pointed bow, elongated hull, engine tail.
      ctx.beginPath();
      ctx.moveTo(0, -l * 0.58);
      ctx.lineTo(w * 0.62, -l * 0.28);
      ctx.lineTo(w * 0.48, l * 0.34);
      ctx.lineTo(w * 0.22, l * 0.49);
      ctx.lineTo(0, l * 0.58);
      ctx.lineTo(-w * 0.22, l * 0.49);
      ctx.lineTo(-w * 0.48, l * 0.34);
      ctx.lineTo(-w * 0.62, -l * 0.28);
      ctx.closePath();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-w * 0.40, -l * 0.12);
      ctx.lineTo(w * 0.40, -l * 0.12);
      ctx.moveTo(-w * 0.30, l * 0.18);
      ctx.lineTo(w * 0.30, l * 0.18);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, -l * 0.02, w * 0.34, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-w * 0.26, l * 0.45);
      ctx.lineTo(-w * 0.18, l * 0.68);
      ctx.moveTo(w * 0.26, l * 0.45);
      ctx.lineTo(w * 0.18, l * 0.68);
      ctx.stroke();
      ctx.restore();

      drawCarrierBar(this);
    }

    b() { return { x: this.x, y: this.y, r: Math.max(this.width, this.length * 0.42) }; }
  }

  function createBoss() {
    const boss = {
      name: BOSS_NAME,
      startedAt: Date.now(),
      orbitPhase: 0,
      nextBarrageAt: Date.now() + 900,
      barrageStep: 0,
      carriers: Array.from({ length: CARRIER_COUNT }, (_, index) => new Carrier(index))
    };

    for (const carrier of boss.carriers) {
      for (let i = 0; i < DRONES_PER_CARRIER; i++) carrier.drones.push(new BossDrone(carrier, i));
    }
    return boss;
  }

  function totalBossHp() {
    if (!activeBoss) return { hp: 0, maxHp: 0 };
    return activeBoss.carriers.reduce(
      (total, carrier) => ({ hp: total.hp + carrier.hp, maxHp: total.maxHp + carrier.maxHp }),
      { hp: 0, maxHp: 0 }
    );
  }

  function drawCarrierBar(carrier) {
    const barWidth = carrier.central ? S(112) : S(82);
    const barHeight = carrier.central ? S(6) : S(4);
    const x = carrier.x - barWidth / 2;
    const y = carrier.y + carrier.length * 0.58 + S(8);
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = carrier.central ? '#ff3d3d' : '#ff9a3d';
    ctx.fillRect(x, y, barWidth * clamp(carrier.hp / carrier.maxHp, 0, 1), barHeight);
    ctx.restore();
  }

  function drawBossHud() {
    if (!activeBoss) return;
    const total = totalBossHp();
    const barWidth = Math.min(width * 0.72, S(300));
    const barHeight = S(9);
    const x = (width - barWidth) / 2;
    const y = S(44);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.max(11, S(12))}px sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.9;
    ctx.fillText(BOSS_NAME, cx, y - S(11));
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = '#ff3d3d';
    ctx.fillRect(x, y, barWidth * clamp(total.hp / total.maxHp, 0, 1), barHeight);
    ctx.restore();
  }

  function createBossBullet(x, y, vx, vy) {
    const bullet = new EnemyBullet(x, y, vx, vy, 'drone');
    bullet.bossBullet = true;
    return bullet;
  }

  function fireDiagonalBarrage() {
    if (!activeBoss) return;

    const laneSpacing = Math.max(S(BARRAGE_LANE_SPACING), width / (BARRAGE_LANES + 1));
    const startX = cx - laneSpacing * ((BARRAGE_LANES - 1) / 2);
    const direction = activeBoss.barrageStep % 2 === 0 ? 1 : -1;

    for (let lane = 0; lane < BARRAGE_LANES; lane++) {
      if (BARRAGE_GAP_LANES.has(lane)) continue;
      const x = startX + lane * laneSpacing;
      const vx = S(BARRAGE_SPEED_X * direction);
      const vy = S(BARRAGE_SPEED_Y);
      enemyBullets.push(createBossBullet(x, -S(18), vx, vy));
    }
    activeBoss.barrageStep++;
  }

  function damageBossTarget(target, amount) {
    target.hp = Math.max(0, target.hp - amount);
    target.hitUntil = Date.now() + 90;
    if (target.hp === 0) {
      target.dead = true;
      burst(target.x, target.y, target.central ? '#ff3d3d' : '#ff9a3d', target.central ? 45 : 28);
    }
  }

  function replaceDrone(carrier, index) {
    carrier.drones[index] = new BossDrone(carrier, index);
  }

  function updateDroneRespawns(carrier) {
    if (carrier.dead) return;
    const now = Date.now();
    for (let i = 0; i < carrier.drones.length; i++) {
      const drone = carrier.drones[i];
      if (!drone || !drone.dead) continue;
      if (!drone.respawnAt) drone.respawnAt = now + DRONE_RESPAWN_MS;
      if (now >= drone.respawnAt) replaceDrone(carrier, i);
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
          for (const drone of carrier.drones) if (drone) drone.dead = true;
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

      if (overlap(pb, carrier.b())) damage();
    }

    if (activeBoss.carriers.every(carrier => carrier.dead)) finishBoss();
  }

  function startBoss() {
    if (activeBoss || bossCompleted || !running) return;
    activeBoss = createBoss();
    burst(cx, height * 0.22, '#ff3d3d', 34);
  }

  function finishBoss() {
    if (!activeBoss) return;
    bossCompleted = true;
    score += 5000;
    scoreEl.textContent = 'Score: ' + score;
    enemyBullets = enemyBullets.filter(b => !b.bossBullet);
    for (const carrier of activeBoss.carriers) burst(carrier.x, carrier.y, '#ff3d3d', 24);
    activeBoss = null;
  }

  // The boss temporarily owns the spawn gate. Once defeated, normal spawning
  // resumes automatically and the completed boss cannot retrigger this run.
  window.spawn = function () {
    if (activeBoss) return;
    baseSpawn();
  };

  window.update = function () {
    if (bossTriggerAt === null) bossTriggerAt = bossStartTime();
    if (!activeBoss && !bossCompleted && secs() >= bossTriggerAt) startBoss();

    baseUpdate.call(this);
    if (!activeBoss) return;

    const f = Date.now() < slowUntil ? 0.32 : 1;
    activeBoss.orbitPhase += DRONE_ORBIT_SPEED * f;

    for (const carrier of activeBoss.carriers) {
      if (!carrier.dead) carrier.update(f);
      updateDroneRespawns(carrier);
    }

    if (Date.now() >= activeBoss.nextBarrageAt) {
      fireDiagonalBarrage();
      activeBoss.nextBarrageAt = Date.now() + BARRAGE_INTERVAL;
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

  window.resetGame = function () {
    activeBoss = null;
    bossTriggerAt = null;
    bossCompleted = false;
    baseResetGame.call(this);
  };

  window.INFINITE_BOSS_STATE = Object.freeze({
    get active() { return !!activeBoss; },
    get name() { return activeBoss?.name || null; },
    get triggerAt() { return bossTriggerAt ?? bossStartTime(); },
    get carriersAlive() { return activeBoss?.carriers.filter(carrier => !carrier.dead).length || 0; },
    get completed() { return bossCompleted; }
  });
})();