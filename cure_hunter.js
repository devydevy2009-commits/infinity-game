// INFINITY — Cure Hunter.
// Green hunter unlocked after Boss 2. More frequent, tougher and more aggressive.
(() => {
  'use strict';

  const hooks = window.INFINITY_GAME_HOOKS;
  if (!hooks) throw new Error('INFINITY_GAME_HOOKS is not available');

  const SPAWN_INTERVAL_SEC = 90;
  const MAX_ACTIVE = 2;
  const FIRE_INTERVAL_MS = 320;
  const HOMING_SPEED = 4.7;
  const HOMING_TURN = 0.062;
  const HOMING_LIFE = 420;
  const HP_MULTIPLIER = 5;

  const cureHunters = [];
  let unlocked = false;
  let nextSpawnAt = null;

  class CureMissile {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      const angle = Math.atan2(player.y - y, player.x - x);
      this.vx = Math.cos(angle) * S(HOMING_SPEED);
      this.vy = Math.sin(angle) * S(HOMING_SPEED);
      this.r = S(6.5);
      this.life = HOMING_LIFE;
    }

    update(f) {
      if (!player) return;
      const desired = Math.atan2(player.y - this.y, player.x - this.x);
      const current = Math.atan2(this.vy, this.vx);
      let delta = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
      delta = clamp(delta, -HOMING_TURN * f, HOMING_TURN * f);
      const angle = current + delta;
      const speed = Math.hypot(this.vx, this.vy) || S(HOMING_SPEED);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.x += this.vx * f;
      this.y += this.vy * f;
      this.life -= f;
    }

    draw() {
      const len = Math.hypot(this.vx, this.vy) || 1;
      ctx.save();
      ctx.strokeStyle = '#ffd35a';
      ctx.shadowColor = '#ff9f1a';
      ctx.shadowBlur = S(13);
      ctx.lineWidth = S(2.6);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.x - this.vx / len * S(17), this.y - this.vy / len * S(17));
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(this.x, this.y, S(2.5), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    b() { return { x: this.x, y: this.y, r: this.r }; }
  }

  class CureHunter {
    constructor() {
      const edge = Math.floor(Math.random() * 3);
      if (edge === 0) {
        this.x = Math.random() * width;
        this.y = -S(38);
      } else if (edge === 1) {
        this.x = width + S(38);
        this.y = Math.random() * height * .62;
      } else {
        this.x = -S(38);
        this.y = Math.random() * height * .62;
      }

      const normalHunterHp = 2 + Math.floor(tier() / 6);
      this.hp = normalHunterHp * HP_MULTIPLIER;
      this.maxHp = this.hp;
      this.size = S(20);
      const angle = player ? Math.atan2(player.y - this.y, player.x - this.x) : Math.PI / 2;
      const speed = S(2.8 + tier() * .11);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.orbit = Math.random() * Math.PI * 2;
      this.rot = angle + Math.PI / 2;
      this.lastShot = Date.now() + 350;
      this.hitUntil = 0;
      this.missiles = [];
      this.dead = false;
    }

    update(f) {
      if (!player) return;
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      const steer = S(.105 + tier() * .004) * f;
      this.vx += dx / dist * steer;
      this.vy += dy / dist * steer;
      this.orbit += .028 * f;
      this.vx += Math.cos(this.orbit) * S(.018) * f;
      this.vy += Math.sin(this.orbit) * S(.018) * f;

      const speed = Math.hypot(this.vx, this.vy);
      const maxSpeed = S(4.0 + tier() * .15);
      if (speed > maxSpeed) {
        this.vx = this.vx / speed * maxSpeed;
        this.vy = this.vy / speed * maxSpeed;
      }

      this.x += this.vx * f;
      this.y += this.vy * f;
      this.rot = Math.atan2(this.vy, this.vx) + Math.PI / 2;

      const now = Date.now();
      if (now - this.lastShot >= FIRE_INTERVAL_MS) {
        this.missiles.push(new CureMissile(this.x, this.y));
        if (tier() >= 5) this.missiles.push(new CureMissile(this.x, this.y));
        this.lastShot = now;
      }

      for (const missile of this.missiles) missile.update(f);
      this.missiles = this.missiles.filter(m => m.life > 0 && m.x > -S(120) && m.x < width + S(120) && m.y > -S(140) && m.y < height + S(160));

      if (this.x < -S(180) || this.x > width + S(180) || this.y < -S(180) || this.y > height + S(200)) {
        this.dead = true;
      }
    }

    draw() {
      const flashing = Date.now() < this.hitUntil && Math.floor(Date.now() / 65) % 2 === 0;
      const color = flashing ? '#fff' : '#39ff72';
      const s = this.size;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.strokeStyle = color;
      ctx.shadowColor = '#39ff72';
      ctx.shadowBlur = S(14);
      ctx.lineWidth = S(3);
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.28);
      ctx.lineTo(s * 1.1, s * .74);
      ctx.lineTo(0, s * .40);
      ctx.lineTo(-s * 1.1, s * .74);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * .55, s * .16); ctx.lineTo(s * .55, s * .16);
      ctx.moveTo(0, -s * .48); ctx.lineTo(0, s * .48);
      ctx.stroke();
      ctx.restore();

      const barW = s * 2.45;
      const barY = this.y + s * 1.46;
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.fillRect(this.x - barW / 2, barY, barW, S(3));
      ctx.fillStyle = '#39ff72';
      ctx.fillRect(this.x - barW / 2, barY, barW * clamp(this.hp / this.maxHp, 0, 1), S(3));
    }

    b() { return { x: this.x, y: this.y, r: this.size }; }
  }

  function spawnCureHunter() {
    if (!unlocked || nextSpawnAt === null || secs() < nextSpawnAt || !running || paused) return;
    if (cureHunters.length >= MAX_ACTIVE) return;
    cureHunters.push(new CureHunter());
    nextSpawnAt += SPAWN_INTERVAL_SEC;
  }

  function awardLife(hunter) {
    lives += 1;
    setHud(livesEl, 'lives', 'Lives', lives);
    score += 1000;
    setHud(scoreEl, 'score', 'Score', score);
    burst(hunter.x, hunter.y, '#39ff72', 46);
  }

  function handleHunterCollisions() {
    if (!player) return;

    for (let i = cureHunters.length - 1; i >= 0; i--) {
      const hunter = cureHunters[i];
      if (hunter.dead) { cureHunters.splice(i, 1); continue; }

      for (let j = bullets.length - 1; j >= 0; j--) {
        if (!overlap(hunter.b(), bullets[j].b())) continue;
        hunter.hp -= bullets[j].damage || 1;
        hunter.hitUntil = Date.now() + 100;
        bullets.splice(j, 1);
        if (hunter.hp <= 0) {
          awardLife(hunter);
          hunter.dead = true;
          break;
        }
      }

      if (hunter.dead) { cureHunters.splice(i, 1); continue; }

      for (let j = hunter.missiles.length - 1; j >= 0; j--) {
        const missile = hunter.missiles[j];
        for (let k = bullets.length - 1; k >= 0; k--) {
          if (!overlap(missile.b(), bullets[k].b())) continue;
          bullets.splice(k, 1);
          hunter.missiles.splice(j, 1);
          burst(missile.x, missile.y, '#ffd35a', 7);
          break;
        }
        if (!hunter.missiles[j]) continue;
        if (overlap(player.b(), missile.b())) {
          hunter.missiles.splice(j, 1);
          burst(missile.x, missile.y, '#ffd35a', 11);
          damage();
        }
      }

      if (overlap(player.b(), hunter.b())) {
        hunter.dead = true;
        cureHunters.splice(i, 1);
        burst(hunter.x, hunter.y, '#39ff72', 24);
        damage();
      }
    }
  }

  function updateCureHunters() {
    const boss2 = window.INFINITE_SECOND_BOSS_STATE;
    const boss1 = window.INFINITE_BOSS_STATE;
    if (!unlocked && boss2?.completed) {
      unlocked = true;
      nextSpawnAt = secs() + SPAWN_INTERVAL_SEC;
    }

    if (!unlocked || boss1?.active || boss2?.active) return;
    spawnCureHunter();

    const f = Date.now() < slowUntil ? .32 : 1;
    for (const hunter of cureHunters) hunter.update(f);
    handleHunterCollisions();
  }

  hooks.onUpdate(updateCureHunters);

  const baseDraw = window.draw;
  const baseResetGame = window.resetGame;

  window.draw = function () {
    baseDraw.call(this);
    for (const hunter of cureHunters) {
      hunter.draw();
      hunter.missiles.forEach(missile => missile.draw());
    }
  };

  window.resetGame = function () {
    cureHunters.length = 0;
    unlocked = false;
    nextSpawnAt = null;
    baseResetGame.call(this);
  };
})();
