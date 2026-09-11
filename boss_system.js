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

  // Keep the original diagonal roguelike barrage: dense parallel streams,
  // two permanent dodge corridors, and alternating sweep direction.
  const BARRAGE_INTERVAL = 620;
  const BARRAGE_LANES = 10;
  const BARRAGE_SPEED_Y = 4.8;
  const BARRAGE_SPEED_X = 1.35;
  const BARRAGE_GAP_LANES = new Set([3, 7]);
  const BARRAGE_LANE_SPACING = 58;
  const BOSS_BULLET_CAP = 72;

  // These are visual emitters only: one fixed drone per barrage lane.
  // They make the original bullet pattern visibly originate from enemies
  // without changing its geometry or difficulty.
  const BARRAGE_DRONE_Y = 18;
  const BARRAGE_DRONE_SIZE = 9;
  const MUZZLE_FLASH_MS = 150;

  const POST_BOSS_RELIEF_MS = 5000;
  const POST_BOSS_SLOW_MS = 900;

  const baseSpawn = window.spawn;
  const baseUpdate = window.update;
  const baseDraw = window.draw;
  const baseResetGame = window.resetGame;

  let activeBoss = null;
  let bossTriggerAt = null;
  let bossCompleted = false;
  let postBossReliefUntil = 0;

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
      const now = activeBoss.now;
      const flashing = now < this.hitUntil && Math.floor(now / 70) % 2 === 0;
      const color = flashing ? '#fff' : '#ff9a3d';
      const s = this.size;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(activeBoss.orbitPhase + this.index * Math.PI * 2 / DRONES_PER_CARRIER);
      ctx.strokeStyle = color;
      ctx.lineWidth = S(2);
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0); ctx.closePath();
      ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, s * 0.35, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    b() { return { x: this.x, y: this.y, r: this.size * 1.05 }; }
  }

  // Non-orbiting firing drones. They are deliberately separate from the
  // carrier escorts: their only job is to visually own the barrage streams.
  class BarrageDrone {
    constructor(x) {
      this.x = x;
      this.y = S(BARRAGE_DRONE_Y);
      this.size = S(BARRAGE_DRONE_SIZE);
      this.flashUntil = 0;
    }

    draw(now) {
      const flashing = now < this.flashUntil;
      const color = flashing ? '#fff' : '#ff9a3d';
      const s = this.size;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = S(1.8);

      // Small downward-facing diamond/ship with a visible central emitter.
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.9);
      ctx.lineTo(s * 0.72, -s * 0.15);
      ctx.lineTo(s * 0.48, s * 0.62);
      ctx.lineTo(0, s * 0.9);
      ctx.lineTo(-s * 0.48, s * 0.62);
      ctx.lineTo(-s * 0.72, -s * 0.15);
      ctx.closePath();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-s * 0.45, s * 0.18);
      ctx.lineTo(s * 0.45, s * 0.18);
      ctx.stroke();

      // Barrel/muzzle pointing exactly along the barrage's initial direction.
      ctx.beginPath();
      ctx.moveTo(0, s * 0.55);
      ctx.lineTo(0, s * 1.35);
      ctx.stroke();

      if (flashing) {
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(0, s * 1.2);
        ctx.lineTo(-s * 0.42, s * 1.85);
        ctx.lineTo(s * 0.42, s * 1.85);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    }
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
      const now = activeBoss.now;
      const flashing = now < this.hitUntil && Math.floor(now / 70) % 2 === 0;
      const color = flashing ? '#fff' : (this.central ? '#ff3d3d' : '#ff7a3d');
      const l = this.length;
      const w = this.width;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(Math.sin(this.phase) * 0.035);
      ctx.strokeStyle = color;
      ctx.lineWidth = S(this.central ? 3.2 : 2.5);
      ctx.lineJoin = this.central ? 'miter' : 'round';

      if (this.central) {
        // Aggressive triangular flagship: broad armored rear and very pointed bow.
        ctx.beginPath();
        ctx.moveTo(0, -l * 0.72);
        ctx.lineTo(w * 0.62, l * 0.34);
        ctx.lineTo(w * 0.95, l * 0.48);
        ctx.lineTo(w * 0.46, l * 0.57);
        ctx.lineTo(w * 0.28, l * 0.69);
        ctx.lineTo(-w * 0.28, l * 0.69);
        ctx.lineTo(-w * 0.46, l * 0.57);
        ctx.lineTo(-w * 0.95, l * 0.48);
        ctx.lineTo(-w * 0.62, l * 0.34);
        ctx.closePath();
        ctx.stroke();

        // Layered deck and central command spine.
        ctx.beginPath();
        ctx.moveTo(0, -l * 0.55);
        ctx.lineTo(w * 0.44, l * 0.30);
        ctx.lineTo(0, l * 0.47);
        ctx.lineTo(-w * 0.44, l * 0.30);
        ctx.closePath();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-w * 0.54, l * 0.39);
        ctx.lineTo(w * 0.54, l * 0.39);
        ctx.moveTo(-w * 0.40, l * 0.52);
        ctx.lineTo(w * 0.40, l * 0.52);
        ctx.moveTo(0, -l * 0.18);
        ctx.lineTo(0, l * 0.28);
        ctx.moveTo(-w * 0.22, l * 0.02);
        ctx.lineTo(w * 0.22, l * 0.02);
        ctx.stroke();

        // Four separated rear engine channels.
        for (const ex of [-0.36, -0.12, 0.12, 0.36]) {
          ctx.beginPath();
          ctx.moveTo(w * ex, l * 0.55);
          ctx.lineTo(w * ex, l * 0.70);
          ctx.stroke();
        }
      } else {
        // Side carrier: elongated, squared technological cigar silhouette.
        ctx.beginPath();
        ctx.moveTo(0, -l * 0.62);
        ctx.lineTo(w * 0.70, -l * 0.43);
        ctx.lineTo(w * 0.84, l * 0.33);
        ctx.lineTo(w * 0.58, l * 0.53);
        ctx.lineTo(w * 0.32, l * 0.62);
        ctx.lineTo(-w * 0.32, l * 0.62);
        ctx.lineTo(-w * 0.58, l * 0.53);
        ctx.lineTo(-w * 0.84, l * 0.33);
        ctx.lineTo(-w * 0.70, -l * 0.43);
        ctx.closePath();
        ctx.stroke();

        // Longitudinal spine and squared armour sections.
        ctx.beginPath();
        ctx.moveTo(-w * 0.56, -l * 0.17);
        ctx.lineTo(w * 0.56, -l * 0.17);
        ctx.moveTo(-w * 0.62, l * 0.16);
        ctx.lineTo(w * 0.62, l * 0.16);
        ctx.moveTo(0, -l * 0.43);
        ctx.lineTo(0, l * 0.48);
        ctx.moveTo(-w * 0.62, l * 0.34);
        ctx.lineTo(w * 0.62, l * 0.34);
        ctx.moveTo(-w * 0.38, l * 0.51);
        ctx.lineTo(w * 0.38, l * 0.51);
        ctx.stroke();
      }

      ctx.restore();
      drawCarrierBar(this);
    }

    b() { return { x: this.x, y: this.y, r: Math.max(this.width, this.length * 0.42) }; }
  }

  function createBoss() {
    const now = Date.now();
    const laneSpacing = Math.max(S(BARRAGE_LANE_SPACING), width / (BARRAGE_LANES + 1));
    const startX = cx - laneSpacing * ((BARRAGE_LANES - 1) / 2);

    const boss = {
      name: BOSS_NAME,
      startedAt: now,
      now,
      orbitPhase: 0,
      nextBarrageAt: now + 900,
      barrageStep: 0,
      muzzleFlashes: [],
      carriers: Array.from({ length: CARRIER_COUNT }, (_, index) => new Carrier(index)),
      barrageDrones: []
    };

    for (let lane = 0; lane < BARRAGE_LANES; lane++) {
      if (BARRAGE_GAP_LANES.has(lane)) continue;
      boss.barrageDrones.push(new BarrageDrone(startX + lane * laneSpacing));
    }

    for (const carrier of boss.carriers) {
      for (let i = 0; i < DRONES_PER_CARRIER; i++) carrier.drones.push(new BossDrone(carrier, i));
    }
    return boss;
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
    let hp = 0;
    let maxHp = 0;
    for (const carrier of activeBoss.carriers) {
      hp += carrier.hp;
      maxHp += carrier.maxHp;
    }

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
    ctx.fillRect(x, y, barWidth * clamp(hp / maxHp, 0, 1), barHeight);
    ctx.restore();
  }

  function addMuzzleFlash(x, y, angle, size) {
    if (!activeBoss) return;
    activeBoss.muzzleFlashes.push({
      x,
      y,
      angle,
      size,
      until: activeBoss.now + MUZZLE_FLASH_MS
    });
  }

  function drawMuzzleFlashes() {
    if (!activeBoss || !activeBoss.muzzleFlashes.length) return;
    const now = activeBoss.now;
    const flashes = activeBoss.muzzleFlashes;

    ctx.save();
    for (let i = flashes.length - 1; i >= 0; i--) {
      const flash = flashes[i];
      if (flash.until <= now) {
        flashes.splice(i, 1);
        continue;
      }
      const life = (flash.until - now) / MUZZLE_FLASH_MS;
      ctx.save();
      ctx.translate(flash.x, flash.y);
      ctx.rotate(flash.angle);
      ctx.globalAlpha = life;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = S(2.5);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -S(flash.size));
      ctx.lineTo(S(flash.size * 0.38), 0);
      ctx.lineTo(0, S(flash.size));
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function createBossBullet(x, y, vx, vy) {
    const bullet = new EnemyBullet(x, y, vx, vy, 'drone');
    bullet.bossBullet = true;
    return bullet;
  }

  function addBossBullet(bullet) {
    let count = 0;
    for (const existing of enemyBullets) if (existing.bossBullet) count++;
    if (count < BOSS_BULLET_CAP) enemyBullets.push(bullet);
  }

  function fireDiagonalBarrage() {
    if (!activeBoss) return;

    // This is intentionally the old barrage geometry. The only change is
    // that every stream now has a visible fixed drone at its origin.
    const laneSpacing = Math.max(S(BARRAGE_LANE_SPACING), width / (BARRAGE_LANES + 1));
    const startX = cx - laneSpacing * ((BARRAGE_LANES - 1) / 2);
    const direction = activeBoss.barrageStep % 2 === 0 ? 1 : -1;

    let firingDroneIndex = 0;
    for (let lane = 0; lane < BARRAGE_LANES; lane++) {
      if (BARRAGE_GAP_LANES.has(lane)) continue;

      const x = startX + lane * laneSpacing;
      const vx = S(BARRAGE_SPEED_X * direction);
      const vy = S(BARRAGE_SPEED_Y);
      const firingDrone = activeBoss.barrageDrones[firingDroneIndex++];
      const y = firingDrone ? firingDrone.y + S(10) : S(28);

      addBossBullet(createBossBullet(x, y, vx, vy));
      if (firingDrone) {
        firingDrone.flashUntil = activeBoss.now + MUZZLE_FLASH_MS;
        addMuzzleFlash(firingDrone.x, firingDrone.y + S(9), Math.atan2(vy, vx), 7);
      }
    }

    activeBoss.barrageStep++;
  }

  function damageBossTarget(target, amount) {
    target.hp = Math.max(0, target.hp - amount);
    target.hitUntil = activeBoss.now + 90;
    if (target.hp === 0) {
      target.dead = true;
      burst(target.x, target.y, target.central ? '#ff3d3d' : '#ff9a3d', target.central ? 38 : 22);
    }
  }

  function replaceDrone(carrier, index) {
    carrier.drones[index] = new BossDrone(carrier, index);
  }

  function updateDroneRespawns(carrier) {
    if (carrier.dead) return;
    for (let i = 0; i < carrier.drones.length; i++) {
      const drone = carrier.drones[i];
      if (!drone || !drone.dead) continue;
      if (!drone.respawnAt) drone.respawnAt = activeBoss.now + DRONE_RESPAWN_MS;
      if (activeBoss.now >= drone.respawnAt) replaceDrone(carrier, i);
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
            drone.respawnAt = activeBoss.now + DRONE_RESPAWN_MS;
            break;
          }
        }

        if (!drone.dead && overlap(pb, drone.b())) {
          damage();
          drone.dead = true;
          drone.respawnAt = activeBoss.now + DRONE_RESPAWN_MS;
        }
      }

      if (overlap(pb, carrier.b())) damage();
    }

    if (activeBoss.carriers.every(carrier => carrier.dead)) finishBoss();
  }

  function startBoss() {
    if (activeBoss || bossCompleted || !running) return;
    enemies.length = 0;
    activeBoss = createBoss();
    burst(cx, height * 0.22, '#ff3d3d', 28);
  }

  function finishBoss() {
    if (!activeBoss) return;
    bossCompleted = true;
    const now = Date.now();
    postBossReliefUntil = now + POST_BOSS_RELIEF_MS;
    slowUntil = now + POST_BOSS_SLOW_MS;

    // Free +1 power immediately, without spawning a pickup object.
    power = Math.min(MAX_POWER, power + 1);
    powerEl.textContent = 'Power: ' + power;
    score += 5000;
    scoreEl.textContent = 'Score: ' + score;

    // Five-second clean breathing room: remove all threats and suppress spawning.
    enemies.length = 0;
    powerups.length = 0;
    enemyBullets = enemyBullets.filter(b => !b.bossBullet);
    for (const carrier of activeBoss.carriers) burst(carrier.x, carrier.y, '#ff3d3d', 18);
    activeBoss = null;
  }

  window.spawn = function () {
    if (activeBoss || Date.now() < postBossReliefUntil) return;
    baseSpawn();
  };

  window.update = function () {
    const now = Date.now();
    if (bossTriggerAt === null) bossTriggerAt = bossStartTime();
    if (!activeBoss && !bossCompleted && now >= bossTriggerAt) startBoss();

    baseUpdate.call(this);
    if (!activeBoss) return;

    activeBoss.now = now;
    const f = now < slowUntil ? 0.32 : 1;
    activeBoss.orbitPhase += DRONE_ORBIT_SPEED * f;

    for (const carrier of activeBoss.carriers) {
      if (!carrier.dead) carrier.update(f);
      updateDroneRespawns(carrier);
    }

    if (now >= activeBoss.nextBarrageAt) {
      fireDiagonalBarrage();
      activeBoss.nextBarrageAt = now + BARRAGE_INTERVAL;
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

    for (const drone of activeBoss.barrageDrones) drone.draw(activeBoss.now);
    drawMuzzleFlashes();
    drawBossHud();
  };

  window.resetGame = function () {
    activeBoss = null;
    bossTriggerAt = null;
    bossCompleted = false;
    postBossReliefUntil = 0;
    baseResetGame.call(this);
  };

  window.INFINITE_BOSS_STATE = Object.freeze({
    get active() { return !!activeBoss; },
    get name() { return activeBoss?.name || null; },
    get triggerAt() { return bossTriggerAt ?? bossStartTime(); },
    get carriersAlive() { return activeBoss?.carriers.filter(carrier => !carrier.dead).length || 0; },
    get completed() { return bossCompleted; },
    get reliefUntil() { return postBossReliefUntil; }
  });
})();
