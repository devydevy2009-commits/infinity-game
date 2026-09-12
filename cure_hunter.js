// INFINITY — Cure Hunter.
// A rare green hunter that appears only after the second boss and rewards a
// life when destroyed. Its shots use the same homing behavior as boss missiles.
(() => {
  'use strict';

  const hooks = window.INFINITY_GAME_HOOKS;
  if (!hooks) throw new Error('INFINITY_GAME_HOOKS is not available');

  const SPAWN_INTERVAL_SEC = 120;
  const FIRE_INTERVAL_MS = 760;
  const HOMING_SPEED = 2.8;
  const HOMING_TURN = 0.028;
  const HOMING_LIFE = 320;

  const cureHunters = [];
  let unlocked = false;
  let nextSpawnAt = null;

  class CureMissile {
    constructor(x, y, target) {
      this.x = x;
      this.y = y;
      const angle = Math.atan2(target.y - y, target.x - x);
      this.vx = Math.cos(angle) * S(HOMING_SPEED);
      this.vy = Math.sin(angle) * S(HOMING_SPEED);
      this.r = S(6.5);
      this.life = HOMING_LIFE;
      this.phase = Math.random() * Math.PI * 2;
      this.kind = 'hunter';
    }

    update(f) {
      if (player) {
        const desired = Math.atan2(player.y - this.y, player.x - this.x);
        const current = Math.atan2(this.vy, this.vx);
        let delta = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
        delta = clamp(delta, -HOMING_TURN * f, HOMING_TURN * f);
        const angle = current + delta;
        const speed = Math.hypot(this.vx, this.vy) || S(HOMING_SPEED);
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
      }
      this.x += this.vx * f;
      this.y += this.vy * f;
      this.life -= f;
      this.phase += 0.12 * f;
    }

    draw() {
      const len = Math.hypot(this.vx, this.vy) || 1;
      ctx.save();
      ctx.strokeStyle = '#ffd35a';
      ctx.shadowColor = '#ff9f1a';
      ctx.shadowBlur = S(11);
      ctx.lineWidth = S(2.2);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.x - this.vx / len * S(13), this.y - this.vy / len * S(13));
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(this.x, this.y, S(2.2), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    b() { return { x: this.x, y: this.y, r: this.r }; }
  }

  class CureHunter {
    constructor() {
      const edge = Math.floor(Math.random() * 3);
      if (edge === 0) {
        this.x = Math.random() * width;
        this.y = -S(34);
      } else if (edge === 1) {
        this.x = width + S(34);
        this.y = Math.random() * height * 0.65;
      } else {
        this.x = -S(34);
        this.y = Math.random() * height * 0.65;
      }

      const normalHunterHp = 2 + Math.floor(tier() / 6);
      this.hp = normalHunterHp * 2;
      this.maxHp = this.hp;
      this.size = S(18);
      this.vx = 0;
      this.vy = S(1.55 + tier() * 0.04);
      this.orbit = Math.random() * Math.PI * 2;
      this.rot = 0;
      this.lastShot = Date.now() + 450;
      this.hitUntil = 0;
      this.missiles = [];
      this.dead = false;
    }

    update(f) {
      if (!player) return;
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      const steer = S(0.052 + tier() * 0.0025) * f;
      this.vx += dx / dist * steer;
      this.vy += dy / dist * steer;
      this.orbit += 0.016 * f;
      this.vx += Math.cos(this.orbit) * S(0.012) * f;
      this.vy += Math.sin(this.orbit) * S(0.012) * f;

      const speed = Math.hypot(this.vx, this.vy);
      const maxSpeed = S(2.65 + tier() * 0.12);
      if (speed > maxSpeed) {
        this.vx = this.vx / speed * maxSpeed;
        this.vy = this.vy / speed * maxSpeed;
      }

      this.x += this.vx * f;
      this.y += this.vy * f;
      this.rot = Math.atan2(this.vy, this.vx) + Math.PI / 2;

      const now = Date.now();
      if (now - this.lastShot >= FIRE_INTERVAL_MS) {
        this.missiles.push(new CureMissile(this.x, this.y, player));
        this.lastShot = now;
      }

      for (const missile of this.missiles) missile.update(f);
      this.missiles = this.missiles.filter(m => m.life > 0 && m.x > -S(100) && m.x < width + S(100) && m.y > -S(120) && m.y < height + S(140));

      if (this.x < -S(140) || this.x > width + S(140) || this.y < -S(140) || this.y > height + S(160)) {
        this.dead = true;
      }
    }

    draw() {
      const flashing = Date.now() < this.hitUntil && Math.floor(Date.now() / 70) % 2 === 0;
      const color = flashing ? '#fff' : '#39ff72';
      const s = this.size;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.strokeStyle = color;
      ctx.shadowColor = '#39ff72';
      ctx.shadowBlur = S(10);
      ctx.lineWidth = S(2.5);
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.2);
      ctx.lineTo(s * 1.02, s * 0.72);
      ctx.lineTo(0, s * 0.38);
      ctx.lineTo(-s * 1.02, s * 0.72);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.48, s * 0.16);
      ctx.lineTo(s * 0.48, s * 0.16);
      ctx.moveTo(0, -s * 0.42);
      ctx.lineTo(0, s * 0.42);
      ctx.stroke();
      ctx.restore();

      const barW = s * 2.1;
      const barY = this.y + s * 1.35;
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.fillRect(this.x - barW / 2, barY, barW, S(3));
      ctx.fillStyle = '#39ff72';
      ctx.fillRect(this.x - barW / 2, barY, barW * clamp(this.hp / this.maxHp, 0, 1), S(3));
    }

    b() { return { x: this.x, y: this.y, r: this.size }; }
  }

  function spawnCureHunter() {
    if (!unlocked || nextSpawnAt === null || secs() < nextSpawnAt || !running || paused) return;
    cureHunters.push(new CureHunter());
    nextSpawnAt += SPAWN_INTERVAL_SEC;
  }

  function awardLife(hunter) {
    lives += 1;
    setHud(livesEl, 'lives', 'Lives', lives);
    score += 750;
    setHud(scoreEl, 'score', 'Score', score);
    burst(hunter.x, hunter.y, '#39ff72', 34);
  }

  function handleHunterCollisions() {
    if (!player) return;

    for (let i = cureHunters.length - 1; i >= 0; i--) {
      const hunter = cureHunters[i];
      if (hunter.dead) {
        cureHunters.splice(i, 1);
        continue;
      }

      for (let j = bullets.length - 1; j >= 0; j--) {
        if (!overlap(hunter.b(), bullets[j].b())) continue;
        hunter.hp -= bullets[j].damage || 1;
        hunter.hitUntil = Date.now() + 110;
        bullets.splice(j, 1);
        if (hunter.hp <= 0) {
          awardLife(hunter);
          hunter.dead = true;
          break;
        }
      }

      if (hunter.dead) {
        cureHunters.splice(i, 1);
        continue;
      }

      if (overlap(player.b(), hunter.b())) {
        hunter.dead = true;
        cureHunters.splice(i, 1);
        burst(hunter.x, hunter.y, '#39ff72', 18);
        damage();
      }
    }
  }

  function updateCureHunters() {
    const bossState = window.INFINITE_BOSS_STATE;
    if (!unlocked && bossState?.completed) {
      unlocked = true;
      nextSpawnAt = secs() + SPAWN_INTERVAL_SEC;
    }

    if (!unlocked || bossState?.active) return;
    spawnCureHunter();

    const f = Date.now() < slowUntil ? 0.32 : 1;
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
