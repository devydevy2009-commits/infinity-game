// INFINITY — advanced encounter layer.
// Keeps core gameplay intact while introducing later-game pressure,
// advanced Ghosts and a preview-only developer clock for testing.
(() => {
  'use strict';

  const ADVANCED_GHOST_AT = 360;
  const HUNTER_PRESSURE_AT = 300;
  const HUNTER_PRESSURE_INTERVAL = 2600;
  const GHOST_MISSILE_INTERVAL = 2600;
  const GHOST_MISSILE_SPEED = 3.8;
  const GHOST_MISSILE_TURN = 0.030;
  const GHOST_MISSILE_CAP = 18;

  const state = {
    missiles: [],
    nextHunterAt: 0,
    devTime: null,
    devPanel: null,
    devLiveText: null
  };

  const baseUpdate = window.update;
  const baseDraw = window.draw;
  const baseResetGame = window.resetGame;

  function realSeconds() {
    return typeof secs === 'function' ? secs() : 0;
  }

  function eventSeconds() {
    return Number.isFinite(state.devTime) ? state.devTime : realSeconds();
  }

  function isBossActive() {
    return !!window.INFINITE_BOSS_STATE?.active;
  }

  function normalizeAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  class GhostMissile {
    constructor(ghost) {
      this.x = ghost.x;
      this.y = ghost.y;
      const targetAngle = player ? Math.atan2(player.y - this.y, player.x - this.x) : Math.PI / 2;
      const angle = targetAngle + (Math.random() - 0.5) * 0.28;
      this.vx = Math.cos(angle) * S(GHOST_MISSILE_SPEED);
      this.vy = Math.sin(angle) * S(GHOST_MISSILE_SPEED);
      this.r = S(5);
      this.life = 260;
      this.phase = Math.random() * Math.PI * 2;
    }

    update(f) {
      if (player) {
        const desired = Math.atan2(player.y - this.y, player.x - this.x);
        const current = Math.atan2(this.vy, this.vx);
        const delta = normalizeAngle(desired - current);
        const turn = clamp(delta, -GHOST_MISSILE_TURN * f, GHOST_MISSILE_TURN * f);
        const next = current + turn;
        const speed = Math.hypot(this.vx, this.vy) || S(GHOST_MISSILE_SPEED);
        this.vx = Math.cos(next) * speed;
        this.vy = Math.sin(next) * speed;
      }
      this.x += this.vx * f;
      this.y += this.vy * f;
      this.life -= f;
      this.phase += 0.22 * f;
    }

    draw() {
      const color = '#d7d7d7';
      const len = Math.hypot(this.vx, this.vy) || 1;
      const trail = S(9);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = S(9);
      ctx.lineWidth = S(2.2);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.x - this.vx / len * trail, this.y - this.vy / len * trail);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(this.x, this.y, S(3.1), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = S(1.2);
      ctx.beginPath();
      ctx.arc(this.x, this.y, S(5.5 + Math.sin(this.phase) * 0.7), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    b() { return { x: this.x, y: this.y, r: this.r }; }
  }

  function launchGhostMissile(ghost) {
    if (state.missiles.length >= GHOST_MISSILE_CAP) return;
    state.missiles.push(new GhostMissile(ghost));
  }

  function updateGhosts(now) {
    if (eventSeconds() < ADVANCED_GHOST_AT || isBossActive()) return;
    for (const ghost of enemies) {
      if (ghost.kind !== 'ghost') continue;
      if (!ghost.advancedShotAt) ghost.advancedShotAt = now + 700 + Math.random() * 900;
      if (now >= ghost.advancedShotAt) {
        launchGhostMissile(ghost);
        ghost.advancedShotAt = now + GHOST_MISSILE_INTERVAL;
      }
    }
  }

  function updateMissiles(f) {
    for (const missile of state.missiles) missile.update(f);
    const pb = player?.b();
    for (let i = state.missiles.length - 1; i >= 0; i--) {
      const missile = state.missiles[i];
      if (pb && overlap(pb, missile.b())) {
        state.missiles.splice(i, 1);
        damage();
        continue;
      }
      if (missile.life <= 0 || missile.x < -S(80) || missile.x > width + S(80) || missile.y < -S(80) || missile.y > height + S(80)) {
        state.missiles.splice(i, 1);
      }
    }
  }

  function updateHunterPressure(now) {
    if (eventSeconds() < HUNTER_PRESSURE_AT || isBossActive()) return;
    if (!state.nextHunterAt) state.nextHunterAt = now + 900;
    if (now < state.nextHunterAt) return;

    const pressureCap = 12;
    const hunters = enemies.filter(e => e.kind === 'hunter').length;
    if (hunters < pressureCap) enemies.push(new Enemy('hunter'));
    state.nextHunterAt = now + HUNTER_PRESSURE_INTERVAL;
  }

  // Final, single Ghost renderer: B-2-like silhouette, fixed nose toward player,
  // brighter after six minutes, and the normal hit flash remains visible.
  if (typeof Enemy !== 'undefined' && Enemy.prototype) {
    const baseEnemyUpdate = Enemy.prototype.update;
    const baseEnemyDraw = Enemy.prototype.draw;

    Enemy.prototype.update = function (f) {
      baseEnemyUpdate.call(this, f);
      if (this.kind === 'ghost' && player) {
        this.rot = Math.atan2(player.y - this.y, player.x - this.x) + Math.PI / 2;
      }
    };

    Enemy.prototype.draw = function () {
      if (this.kind !== 'ghost') return baseEnemyDraw.call(this);

      const advanced = eventSeconds() >= ADVANCED_GHOST_AT;
      const now = Date.now();
      const flashing = now < this.hitUntil && Math.floor(now / 70) % 2 === 0;
      const color = flashing ? '#fff' : (advanced ? '#cfcfcf' : '#8b8b8b');
      const s = this.size;
      const angle = player ? Math.atan2(player.y - this.y, player.x - this.x) + Math.PI / 2 : this.rot;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(angle);
      ctx.strokeStyle = color;
      ctx.lineWidth = S(2.5);
      ctx.globalAlpha = advanced ? 0.92 : 0.78;

      ctx.beginPath();
      ctx.moveTo(-s * 1.55, s * 0.18);
      ctx.lineTo(-s * 0.92, -s * 0.42);
      ctx.lineTo(-s * 0.25, -s * 0.20);
      ctx.lineTo(0, -s * 0.56);
      ctx.lineTo(s * 0.25, -s * 0.20);
      ctx.lineTo(s * 0.92, -s * 0.42);
      ctx.lineTo(s * 1.55, s * 0.18);
      ctx.lineTo(s * 0.72, s * 0.05);
      ctx.lineTo(s * 0.42, s * 0.34);
      ctx.lineTo(0, s * 0.22);
      ctx.lineTo(-s * 0.42, s * 0.34);
      ctx.lineTo(-s * 0.72, s * 0.05);
      ctx.closePath();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-s * 0.58, s * 0.02);
      ctx.lineTo(0, -s * 0.20);
      ctx.lineTo(s * 0.58, s * 0.02);
      ctx.stroke();

      if (advanced) {
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.arc(0, 0, s * 1.28, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    };
  }

  // Fix the carrier orientation from the moment it enters the screen. The old
  // patch waited for a positive Y range, so the flagship briefly appeared upside down.
  const realTranslate = ctx.translate.bind(ctx);
  const realRotate = ctx.rotate.bind(ctx);
  const oldDraw = window.draw;
  window.draw = function () {
    if (!window.INFINITE_BOSS_STATE?.active) return oldDraw.call(this);
    const originalTranslate = ctx.translate;
    const originalRotate = ctx.rotate;
    let centralRotationPending = false;
    ctx.translate = function (x, y) {
      centralRotationPending = Math.abs(x - cx) < S(45) && y < height * 0.42;
      return realTranslate(x, y);
    };
    ctx.rotate = function (angle) {
      if (centralRotationPending) {
        centralRotationPending = false;
        return realRotate(angle + Math.PI);
      }
      return realRotate(angle);
    };
    try {
      oldDraw.call(this);
    } finally {
      ctx.translate = originalTranslate;
      ctx.rotate = originalRotate;
    }
  };

  function updateDeveloperPanel() {
    if (!state.devPanel) return;
    state.devLiveText.textContent = Number.isFinite(state.devTime) ? `Test time: ${Math.floor(state.devTime / 60)}:${String(Math.floor(state.devTime % 60)).padStart(2, '0')}` : 'Test time: LIVE';
  }

  function setDevTime(value) {
    state.devTime = value === null ? null : Math.max(0, Number(value) || 0);
    updateDeveloperPanel();
  }

  function createDeveloperPanel() {
    const host = location.hostname;
    const enabled = host.endsWith('vercel.app') && new URLSearchParams(location.search).get('dev') === '1';
    if (!enabled) return;

    const panel = document.createElement('div');
    panel.id = 'infinityDevPanel';
    panel.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:25000;padding:8px 9px;border:1px solid rgba(255,255,255,.22);border-radius:10px;background:rgba(0,0,0,.82);color:#fff;font:11px sans-serif;backdrop-filter:blur(6px);display:flex;gap:5px;align-items:center;flex-wrap:wrap;max-width:95vw';
    const title = document.createElement('strong');
    title.textContent = 'DEV';
    title.style.opacity = '.65';
    panel.appendChild(title);
    state.devLiveText = document.createElement('span');
    state.devLiveText.style.marginRight = '3px';
    panel.appendChild(state.devLiveText);
    for (const value of [0, 300, 360, 600, 900]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = value === 0 ? '0:00' : `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
      button.style.cssText = 'border:1px solid rgba(255,255,255,.22);background:#111;color:#fff;border-radius:6px;padding:3px 6px;font:10px sans-serif';
      button.onclick = () => setDevTime(value);
      panel.appendChild(button);
    }
    const live = document.createElement('button');
    live.type = 'button';
    live.textContent = 'LIVE';
    live.style.cssText = 'border:1px solid rgba(255,255,255,.22);background:#111;color:#fff;border-radius:6px;padding:3px 6px;font:10px sans-serif';
    live.onclick = () => setDevTime(null);
    panel.appendChild(live);
    document.body.appendChild(panel);
    state.devPanel = panel;
    updateDeveloperPanel();
  }

  window.update = function () {
    const now = Date.now();
    baseUpdate.call(this);
    if (!running || paused) return;
    updateHunterPressure(now);
    updateGhosts(now);
    updateMissiles(1);
  };

  window.draw = function () {
    baseDraw.call(this);
    for (const missile of state.missiles) missile.draw();
    if (state.devPanel) updateDeveloperPanel();
  };

  window.resetGame = function () {
    state.missiles.length = 0;
    state.nextHunterAt = 0;
    state.devTime = null;
    baseResetGame.call(this);
    updateDeveloperPanel();
  };

  createDeveloperPanel();
})();
