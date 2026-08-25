// ============================================================
// INFINITY — consolidated game engine
// One source of truth for gameplay, input, weapons, enemies,
// scoring, UI state, gyro and visual effects.
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);

const scoreEl = $('score');
const livesEl = $('lives');
const timerEl = $('timer');
const powerEl = $('power');
const startBtn = $('startBtn');
const settingsBtn = $('settingsBtn');
const settingsMenu = $('settingsMenu');
const gameOverMenu = $('gameOverMenu');
const scoreboardMenu = $('scoreboardMenu');
const pauseOverlay = $('pauseOverlay');
const finalScore = $('finalScore');
const playerName = $('playerName');
const saveScoreBox = $('saveScoreBox');
const scoreList = $('scoreList');

let width = 0, height = 0, cx = 0, cy = 0, scale = 1;
let player, enemies, bullets, enemyBullets, particles, powerups, stars;
let score = 0, lives = 3, power = 0;
let running = false, paused = false, starting = false;
let startTime = 0, finalElapsed = 0, timerId = 0, lastFire = 0;
let pausedAt = 0, pausedTotal = 0;
let targetX, targetY, inputType = null;
let slowUntil = 0, invulnerableUntil = 0;
let combo = 0, lastKillAt = 0;
let nextWaveAt = 0, nextPowerupAt = 0;
let deathSnapshot = null;
let frameStamp = 0;
let sessionSaveAt = 0;
let resumableSession = null;

const TOUCH_AHEAD = 22;
const MAX_POWER = 49;
const STAR_COUNT = 120;
const SCORE_BY_KIND = { asteroid: 50, drone: 100, hunter: 200, transport: 400 };

const powerTable = Array.from({ length: 50 }, (_, i) => ({
  cooldown: Math.max(42, 126 - i * 1.7),
  speed: 13 + i * 0.12,
  side: i >= 2,
  wide: i >= 7,
  heavy: i >= 10,
  rapid: i >= 16,
  back: i >= 20,
  quad: i >= 30
}));

function resize() {
  const oldWidth = width, oldHeight = height;
  const viewport = window.visualViewport;
  width = Math.max(1, Math.round(viewport ? viewport.width : innerWidth));
  height = Math.max(1, Math.round(viewport ? viewport.height : innerHeight));
  canvas.width = width;
  canvas.height = height;
  cx = width / 2;
  cy = height / 2;
  scale = Math.max(0.78, Math.min(1.18, Math.min(width, height) / 390));
  if (stars?.length && oldWidth && oldHeight) {
    // Keep the field evenly distributed when mobile browser chrome settles.
    for (const star of stars) {
      star.x = clamp(star.x * width / oldWidth, 0, width);
      star.y = clamp(star.y * height / oldHeight, -S(4), height);
    }
  }
}
addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
const S = n => n * scale;

function secs() {
  if (!startTime) return 0;
  const now = Date.now();
  let elapsed = now - startTime - pausedTotal;
  if (pausedAt) elapsed -= now - pausedAt;
  if (!running && finalElapsed > 0) return finalElapsed;
  return Math.max(0, Math.floor(elapsed / 1000));
}
function tier() { return Math.floor(secs() / 15); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function overlap(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy < (a.r + b.r) ** 2; }
function burst(x, y, color, count) { for (let i = 0; i < count; i++) particles.push(new Particle(x, y, color)); }
function escapeHtml(s) { return String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }

class Star {
  constructor(initial = false) { this.reset(initial); }
  reset(initial = false) {
    this.x = Math.random() * width;
    this.y = initial ? Math.random() * height : -S(3);
    this.r = S(0.5 + Math.random() * 1.5);
    this.speed = S(0.35 + Math.random() * 1.6);
    this.alpha = 0.25 + Math.random() * 0.65;
    this.phase = Math.random() * Math.PI * 2;
  }
  update(f) { this.y += this.speed * f; this.phase += 0.035 * f; if (this.y > height + S(4)) this.reset(false); }
  draw() { ctx.globalAlpha = this.alpha * (0.78 + Math.sin(this.phase) * 0.22); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
}
function createStars(preservePositions = false) {
  if (preservePositions && stars?.length) return;
  stars = Array.from({ length: STAR_COUNT }, () => new Star(true));
}

class Player {
  constructor() { this.x = cx; this.y = height * 0.8; this.size = S(16); this.angle = 0; }
  update(x, y) {
    this.size = S(16);
    if (x !== undefined && y !== undefined) { this.x = x; this.y = y; }
    this.x = clamp(this.x, this.size, width - this.size);
    this.y = clamp(this.y, this.size, height - this.size);
  }
  stage() { return Math.min(8, Math.floor(power / 3)); }
  draw() {
    const flash = Date.now() < invulnerableUntil && Math.floor(Date.now() / 70) % 2 === 0;
    const stage = this.stage();
    const size = this.size * (1 + stage * 0.055);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle || 0);
    ctx.strokeStyle = flash ? '#ff3d3d' : '#fff';
    ctx.lineWidth = S(2.5);

    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(-size * 0.72, size * 0.72);
    ctx.lineTo(size * 0.72, size * 0.72);
    ctx.closePath();
    ctx.stroke();

    if (stage >= 1) {
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.48);
      ctx.lineTo(-size * 0.34, size * 0.42);
      ctx.lineTo(size * 0.34, size * 0.42);
      ctx.closePath();
      ctx.stroke();
    }
    if (stage >= 2) {
      ctx.beginPath();
      ctx.moveTo(-size * 0.52, size * 0.28);
      ctx.lineTo(-size * 0.98, size * 0.66);
      ctx.lineTo(-size * 0.48, size * 0.58);
      ctx.moveTo(size * 0.52, size * 0.28);
      ctx.lineTo(size * 0.98, size * 0.66);
      ctx.lineTo(size * 0.48, size * 0.58);
      ctx.stroke();
    }
    if (stage >= 3) {
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.82);
      ctx.lineTo(-size * 0.20, -size * 1.18);
      ctx.lineTo(size * 0.20, -size * 1.18);
      ctx.closePath();
      ctx.stroke();
    }
    if (stage >= 4) {
      ctx.beginPath();
      ctx.arc(0, size * 0.18, size * 0.22, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (stage >= 5) {
      ctx.beginPath();
      ctx.moveTo(-size * 0.86, -size * 0.10);
      ctx.lineTo(-size * 1.12, size * 0.05);
      ctx.moveTo(size * 0.86, -size * 0.10);
      ctx.lineTo(size * 1.12, size * 0.05);
      ctx.stroke();
    }
    ctx.restore();
  }
  b() { return { x: this.x, y: this.y, r: this.size * 0.68 }; }
}

function kindColor(kind) {
  return ({ asteroid: '#ff4040', drone: '#ff9a3d', hunter: '#ff42d0', transport: '#b84cff', ghost: '#8b8b8b' }[kind] || '#fff');
}

class Enemy {
  constructor(kind = 'asteroid') {
    this.kind = kind;
    const angleToPlayer = Math.random() * Math.PI * 2;
    const edge = Math.floor(Math.random() * 3);
    if (edge === 0) { this.x = Math.random() * width; this.y = -S(32); }
    else if (edge === 1) { this.x = width + S(32); this.y = Math.random() * height * 0.7; }
    else { this.x = -S(32); this.y = Math.random() * height * 0.7; }

    const baseSpeed = kind === 'transport' ? 0.78 : kind === 'hunter' ? 1.55 : 1.15 + Math.random() * 0.8;
    const mult = 1 + tier() * 0.11;
    const angle = kind === 'hunter' ? angleToPlayer : Math.atan2(height * 0.58 - this.y, cx - this.x);
    this.vx = Math.cos(angle) * S(baseSpeed * mult);
    this.vy = Math.sin(angle) * S(baseSpeed * mult);
    this.size = S(kind === 'transport' ? 20 : kind === 'ghost' ? 14 : kind === 'hunter' ? 16 : kind === 'drone' ? 14 : 13 + Math.random() * 6);
    this.rot = Math.random() * Math.PI * 2;
    this.lastShot = Date.now() + Math.random() * 1000;
    this.hitUntil = 0;
    this.hp = kind === 'ghost' ? Infinity : kind === 'transport' ? 5 + Math.min(5, Math.floor(power / 9)) : kind === 'hunter' ? 2 + Math.floor(tier() / 6) : 1 + (tier() >= 7 ? 1 : 0);
    this.orbit = Math.random() * Math.PI * 2;
    this.formOffset = null;
    this.formationId = null;
  }
  update(f) {
    this.x += this.vx * f;
    this.y += this.vy * f;
    this.rot += (this.kind === 'hunter' ? 0.05 : 0.035) * f;

    if (this.kind === 'hunter') {
      this.updateHunter(f);
    } else if (this.kind === 'drone') {
      this.updateDrone(f);
    }
  }
  updateHunter(f) {
    if (!player) return;
    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const steer = S(0.055 + tier() * 0.003) * f;
    this.vx += (dx / dist) * steer;
    this.vy += (dy / dist) * steer;
    this.orbit += 0.018 * f;
    this.vx += Math.cos(this.orbit) * S(0.01) * f;
    this.vy += Math.sin(this.orbit) * S(0.01) * f;
    const speed = Math.hypot(this.vx, this.vy);
    const maxSpeed = S(2.7 + tier() * 0.16);
    if (speed > maxSpeed) { this.vx = this.vx / speed * maxSpeed; this.vy = this.vy / speed * maxSpeed; }

    const interval = Math.max(420, 1050 - tier() * 28);
    if (Date.now() - this.lastShot > interval) {
      const shots = tier() >= 8 ? 3 : tier() >= 4 ? 2 : 1;
      fireDirectedBurst(this.x, this.y, shots, 0.20 + tier() * 0.012, 4.8 + tier() * 0.12);
      this.lastShot = Date.now();
    }
  }
  updateDrone() {
    const interval = Math.max(340, 1350 - tier() * 34);
    if (Date.now() - this.lastShot > interval) {
      const shots = tier() >= 9 ? 3 : tier() >= 5 ? 2 : 1;
      fireRandomBurst(this.x, this.y, shots, 4.7 + tier() * 0.11);
      this.lastShot = Date.now();
    }
  }
  draw() {
    const flashing = Date.now() < this.hitUntil && Math.floor(Date.now() / 70) % 2 === 0;
    const color = flashing ? '#fff' : kindColor(this.kind);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = color;
    ctx.lineWidth = S(this.kind === 'ghost' ? 2.8 : 2.2);

    if (this.kind === 'asteroid') {
      ctx.beginPath();
      ctx.arc(0, 0, this.size, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, this.size * 0.62, 0, Math.PI * 2);
      ctx.globalAlpha = 0.35;
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (this.kind === 'drone') {
      const s = this.size;
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, s * 0.35, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.55, 0); ctx.lineTo(s * 0.55, 0); ctx.stroke();
    } else if (this.kind === 'hunter') {
      const s = this.size;
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.15); ctx.lineTo(s * 0.95, s * 0.75); ctx.lineTo(0, s * 0.40); ctx.lineTo(-s * 0.95, s * 0.75); ctx.closePath(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.45, s * 0.18); ctx.lineTo(s * 0.45, s * 0.18); ctx.stroke();
    } else if (this.kind === 'transport') {
      const s = this.size;
      ctx.beginPath();
      ctx.moveTo(-s * 0.78, -s * 0.55); ctx.lineTo(s * 0.78, -s * 0.55); ctx.lineTo(s, 0); ctx.lineTo(s * 0.78, s * 0.55); ctx.lineTo(-s * 0.78, s * 0.55); ctx.lineTo(-s, 0); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, s * 0.58, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.42, 0); ctx.lineTo(s * 0.42, 0); ctx.stroke();
    } else if (this.kind === 'ghost') {
      const s = this.size;
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.42, 0); ctx.lineTo(s * 0.42, 0); ctx.moveTo(0, -s * 0.42); ctx.lineTo(0, s * 0.42); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    if (this.kind === 'transport' && this.hp > 1) {
      const ratio = clamp(this.hp / (5 + Math.min(5, Math.floor(power / 9))), 0, 1);
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ctx.fillRect(this.x - this.size, this.y + this.size + S(4), this.size * 2 * ratio, S(2));
    }
  }
  b() { return { x: this.x, y: this.y, r: this.size }; }
}

class PlayerBullet {
  constructor(x, y, vx, vy, damage = 1) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.damage = damage; this.r = S(damage > 1 ? 4.8 : 3.5); this.life = 105;
  }
  update(f) { this.x += this.vx * f; this.y += this.vy * f; this.life--; }
  draw() {
    const len = Math.hypot(this.vx, this.vy) || 1;
    const tx = this.x - this.vx / len * S(8), ty = this.y - this.vy / len * S(8);
    ctx.save();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = this.r * 1.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(this.x, this.y); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  b() { return { x: this.x, y: this.y, r: this.r }; }
}

class EnemyBullet {
  constructor(x, y, vx, vy, kind = 'drone') {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.kind = kind;
    this.r = S(kind === 'hunter' ? 4.8 : 4.3); this.life = 220; this.phase = Math.random() * Math.PI * 2;
  }
  update(f) { this.x += this.vx * f; this.y += this.vy * f; this.life--; this.phase += 0.18 * f; }
  draw() {
    const color = this.kind === 'hunter' ? '#ff42d0' : '#ff9a3d';
    const len = Math.hypot(this.vx, this.vy) || 1;
    const trail = this.r * 3.6;
    ctx.save();
    ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = S(10); ctx.lineWidth = this.r * 1.45; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(this.x - this.vx / len * trail, this.y - this.vy / len * trail); ctx.lineTo(this.x, this.y); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 0.72, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.95; ctx.strokeStyle = color; ctx.lineWidth = S(1.4);
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r * (1.25 + Math.sin(this.phase) * 0.08), 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  b() { return { x: this.x, y: this.y, r: this.r }; }
}

class Powerup {
  constructor() {
    this.x = S(28) + Math.random() * (width - S(56)); this.y = -S(28);
    this.size = S(24); this.vy = S(1.15 + Math.min(tier(), 15) * 0.035); this.vx = (Math.random() < 0.5 ? -1 : 1) * S(0.35 + Math.random() * 0.3);
    this.rot = 0; this.phase = Math.random() * Math.PI * 2;
  }
  update(f) { this.phase += 0.045 * f; this.x += this.vx * f; this.y += this.vy * f; if (this.x < this.size || this.x > width - this.size) this.vx *= -1; this.rot += 0.035 * f; }
  draw() {
    const pulse = 1 + Math.sin(this.phase * 1.5) * 0.10;
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot); ctx.scale(pulse, pulse);
    ctx.shadowColor = '#69c4ff'; ctx.shadowBlur = S(16); ctx.strokeStyle = '#69c4ff'; ctx.fillStyle = 'rgba(36,155,255,.16)'; ctx.lineWidth = S(3.5);
    ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size); ctx.strokeRect(-this.size / 2, -this.size / 2, this.size, this.size);
    ctx.beginPath(); ctx.moveTo(-this.size * .25, 0); ctx.lineTo(this.size * .25, 0); ctx.moveTo(0, -this.size * .25); ctx.lineTo(0, this.size * .25); ctx.stroke();
    ctx.restore();
  }
  b() { return { x: this.x, y: this.y, r: this.size * 0.70 }; }
}

class Particle {
  constructor(x, y, color) { this.x = x; this.y = y; const a = Math.random() * Math.PI * 2, s = S(Math.random() * 3.5); this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s; this.life = 1; this.decay = 0.025 + Math.random() * 0.03; this.color = color; this.r = S(1.5 + Math.random() * 2.5); }
  update(f) { this.x += this.vx * f; this.y += this.vy * f; this.life -= this.decay * f; }
  draw() { ctx.globalAlpha = Math.max(0, this.life); ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
}

function weaponLayout() {
  const stage = Math.floor(Math.max(0, power) / 3);
  const cycle = Math.floor(stage / 3);
  const phase = stage % 3;
  return { front: 1 + cycle + (phase >= 1 ? 1 : 0), side: 2 * cycle + (phase >= 2 ? 2 : 0), rear: 2 * cycle };
}
function sideSlots(count) {
  const out = [], pairs = Math.floor(count / 2), gap = S(10), yGap = S(8);
  for (let i = 0; i < pairs; i++) {
    const y = (i - (pairs - 1) / 2) * yGap;
    out.push({ x: -(S(13) + i * gap), y, dx: -1, dy: 0 });
    out.push({ x: S(13) + i * gap, y, dx: 1, dy: 0 });
  }
  return out;
}
function localWeaponSlots() {
  const l = weaponLayout(), out = [], frontGap = S(8), rearGap = S(8);
  for (let i = 0; i < l.front; i++) out.push({ x: (i - (l.front - 1) / 2) * frontGap, y: -S(16), dx: 0, dy: -1 });
  out.push(...sideSlots(l.side));
  for (let i = 0; i < l.rear; i++) out.push({ x: (i - (l.rear - 1) / 2) * rearGap, y: S(12), dx: 0, dy: 1 });
  return out;
}
function rotateVector(x, y, angle) { const c = Math.cos(angle), s = Math.sin(angle); return { x: x * c - y * s, y: x * s + y * c }; }
function addPlayerShot(slot, damage, speed) {
  const local = rotateVector(slot.x, slot.y, player.angle || 0);
  const dir = rotateVector(slot.dx, slot.dy, player.angle || 0);
  const len = Math.hypot(dir.x, dir.y) || 1;
  bullets.push(new PlayerBullet(player.x + local.x, player.y + local.y, dir.x / len * speed, dir.y / len * speed, damage));
}
function shoot(now) {
  const p = powerTable[Math.min(power, MAX_POWER)];
  if (now - lastFire < p.cooldown) return;
  lastFire = now;
  const damage = 1 + Math.floor(power / 8);
  const speed = S(p.speed);
  localWeaponSlots().forEach(slot => addPlayerShot(slot, damage, speed));
}

function fireDirectedBurst(x, y, count, spread, speedBase) {
  if (!player) return;
  const base = Math.atan2(player.y - y, player.x - x);
  for (let i = 0; i < count; i++) {
    const offset = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
    const a = base + offset;
    const speed = S(speedBase);
    enemyBullets.push(new EnemyBullet(x, y, Math.cos(a) * speed, Math.sin(a) * speed, 'hunter'));
  }
}
function fireRandomBurst(x, y, count, speedBase) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = S(speedBase * (0.92 + Math.random() * 0.16));
    enemyBullets.push(new EnemyBullet(x, y, Math.cos(a) * speed, Math.sin(a) * speed, 'drone'));
  }
}

function chooseEnemy() {
  const t = tier(), r = Math.random();
  if (t >= 5 && r < Math.min(0.06 + t * 0.007, 0.16)) return 'ghost';
  if (t >= 4 && r < Math.min(0.18 + t * 0.012, 0.34)) return 'transport';
  if (t >= 3 && r < Math.min(0.28 + t * 0.012, 0.46)) return 'hunter';
  if (t >= 2 && r < Math.min(0.50 + t * 0.01, 0.68)) return 'drone';
  return 'asteroid';
}

let formationSerial = 0;
function makeFormation() {
  const t = tier();
  const roll = Math.random();
  const kind = t >= 5 && roll < 0.18 ? 'hunter' : t >= 4 && roll < 0.42 ? 'transport' : t >= 2 ? 'drone' : 'asteroid';
  const count = Math.min(9, 3 + Math.floor(t / 2));
  const center = width * (0.25 + Math.random() * 0.50);
  const id = ++formationSerial;
  const offsets = [];
  let row = 1;
  while (offsets.length < count) {
    const rowCount = Math.min(3, row);
    for (let c = 0; c < rowCount && offsets.length < count; c++) offsets.push({ x: (c - (rowCount - 1) / 2) * S(48), y: (row - 1) * S(42) });
    row++;
  }
  offsets.forEach(o => {
    const e = new Enemy(kind);
    e.x = center + o.x; e.y = -S(46) + o.y; e.formationId = id; e.formOffset = o;
    e.vx = 0; e.vy = S(1.05 + Math.min(t, 15) * 0.04); enemies.push(e);
  });
}

function spawn() {
  const now = Date.now();
  const t = tier();
  const cap = 8 + t * 3;
  if (!nextWaveAt) nextWaveAt = now + 8000;
  if (now >= nextWaveAt && enemies.length < cap + 5) { makeFormation(); nextWaveAt += Math.max(8500, 14000 - Math.min(t, 16) * 250); }
  if (enemies.length < cap && Math.random() < 0.024 + Math.min(t, 18) * 0.0028) enemies.push(new Enemy(chooseEnemy()));
  if (!nextPowerupAt) nextPowerupAt = now + 12000;
  if (now >= nextPowerupAt && powerups.length === 0) { powerups.push(new Powerup()); nextPowerupAt += 22000; }
}

function updateFormations(f) {
  const groups = new Map();
  for (const e of enemies) if (e.formationId) { if (!groups.has(e.formationId)) groups.set(e.formationId, []); groups.get(e.formationId).push(e); }
  for (const members of groups.values()) {
    const anchor = members[0];
    for (const e of members) { e.x = anchor.x + (e.formOffset?.x || 0); e.y = anchor.y + (e.formOffset?.y || 0); }
    anchor.x += S((Math.random() - 0.5) * 0.05) * f;
  }
}

function registerKill(enemy) {
  const now = Date.now();
  combo = now - lastKillAt <= 2400 ? combo + 1 : 1;
  lastKillAt = now;
  const comboMultiplier = Math.min(3, 1 + Math.floor(combo / 5) * 0.25);
  const evolutionMultiplier = 1 + Math.min(tier(), 12) * 0.06;
  score += Math.round(SCORE_BY_KIND[enemy.kind] * comboMultiplier * evolutionMultiplier);
  scoreEl.textContent = 'Score: ' + score;
}

function collectPowerup(p) {
  power = Math.min(MAX_POWER, power + 1);
  powerEl.textContent = 'Power: ' + power;
  score += 250;
  scoreEl.textContent = 'Score: ' + score;
  burst(p.x, p.y, '#69c4ff', 24);
}

function damage() {
  if (Date.now() < invulnerableUntil) return;
  lives--;
  livesEl.textContent = 'Lives: ' + lives;
  invulnerableUntil = Date.now() + 850;
  slowUntil = Date.now() + 900;
  burst(player.x, player.y, '#ff3d3d', 20);
  if (lives <= 0) gameOver();
}

function collisions() {
  const pb = player.b();
  for (let i = powerups.length - 1; i >= 0; i--) {
    if (bullets.some((b, j) => { if (!overlap(powerups[i].b(), b.b())) return false; bullets.splice(j, 1); return true; })) {
      const p = powerups[i]; powerups.splice(i, 1); collectPowerup(p);
    }
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (overlap(pb, e.b())) { enemies.splice(i, 1); burst(e.x, e.y, kindColor(e.kind), 16); damage(); continue; }
    for (let j = bullets.length - 1; j >= 0; j--) {
      if (!overlap(e.b(), bullets[j].b())) continue;
      if (e.kind === 'ghost') { bullets.splice(j, 1); e.hitUntil = Date.now() + 80; break; }
      e.hp--; e.hitUntil = Date.now() + 120; bullets.splice(j, 1);
      if (e.hp <= 0) { enemies.splice(i, 1); registerKill(e); burst(e.x, e.y, kindColor(e.kind), e.kind === 'transport' ? 26 : 17); }
      break;
    }
  }
  for (let i = enemyBullets.length - 1; i >= 0; i--) if (overlap(pb, enemyBullets[i].b())) { enemyBullets.splice(i, 1); damage(); }
}

function updateTimer() {
  const t = secs();
  timerEl.textContent = 'Time: ' + Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
}

function update() {
  if (paused || !running) return;
  const now = Date.now();
  const f = now < slowUntil ? 0.32 : 1;
  player.update(targetX, targetY);
  shoot(now);
  stars.forEach(s => s.update(f));
  enemies.forEach(e => e.update(f));
  updateFormations(f);
  powerups.forEach(p => p.update(f));
  bullets.forEach(b => b.update(f));
  enemyBullets.forEach(b => b.update(f));
  particles.forEach(p => p.update(f));

  enemies = enemies.filter(e => e.x > -S(120) && e.x < width + S(120) && e.y > -S(120) && e.y < height + S(120));
  powerups = powerups.filter(p => p.y < height + S(60));
  bullets = bullets.filter(b => b.life > 0 && b.x > -S(120) && b.x < width + S(120) && b.y > -S(120) && b.y < height + S(120));
  enemyBullets = enemyBullets.filter(b => b.life > 0 && b.x > -S(140) && b.x < width + S(140) && b.y > -S(140) && b.y < height + S(140));
  particles = particles.filter(p => p.life > 0);

  if (combo && Date.now() - lastKillAt > 2400) combo = 0;
  spawn();
  collisions();
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  stars.forEach(s => s.draw());
  particles.forEach(p => p.draw());
  powerups.forEach(p => p.draw());
  enemies.forEach(e => e.draw());
  bullets.forEach(b => b.draw());
  enemyBullets.forEach(b => b.draw());
  if (player) player.draw();
}

function loop(now) {
  if (!running) return;
  if (!frameStamp || now - frameStamp >= 1000 / 60) { frameStamp = now; update(); draw(); }
  requestAnimationFrame(loop);
}

function resetGame() {
  player = new Player(); enemies = []; bullets = []; enemyBullets = []; particles = []; powerups = [];
  score = 0; lives = 3; power = 0; combo = 0; lastKillAt = 0;
  targetX = undefined; targetY = undefined; inputType = null;
  slowUntil = 0; invulnerableUntil = 0; finalElapsed = 0; deathSnapshot = null;
  nextWaveAt = 0; nextPowerupAt = 0; formationSerial = 0; frameStamp = 0;
  createStars();
  player.angle = 0;
  scoreEl.textContent = 'Score: 0'; livesEl.textContent = 'Lives: 3'; powerEl.textContent = 'Power: 0';
  ensureDeathSnapshotUI();
  $('takePictureBtn')?.classList.add('hidden');
}

function readSession() {
  try {
    const value = JSON.parse(sessionStorage.getItem('infiniteActiveSession') || 'null');
    if (!value || typeof value !== 'object') return null;
    return {
      score: Math.max(0, Math.floor(Number(value.score) || 0)),
      lives: clamp(Math.floor(Number(value.lives) || 3), 1, 3),
      power: clamp(Math.floor(Number(value.power) || 0), 0, MAX_POWER),
      elapsed: Math.max(0, Math.floor(Number(value.elapsed) || 0)),
      savedAt: Number(value.savedAt) || 0
    };
  } catch { return null; }
}
function saveSession() {
  if (!running || !player) return;
  try { sessionStorage.setItem('infiniteActiveSession', JSON.stringify({ score, lives, power, elapsed: secs(), savedAt: Date.now() })); } catch {}
}
function clearSession() { try { sessionStorage.removeItem('infiniteActiveSession'); } catch {} resumableSession = null; }
function refreshHud() {
  scoreEl.textContent = 'Score: ' + score;
  livesEl.textContent = 'Lives: ' + lives;
  powerEl.textContent = 'Power: ' + power;
  updateTimer();
}

function setGameVisible() {
  startBtn.style.display = 'none'; settingsBtn.style.display = 'block';
  settingsMenu.classList.add('hidden'); gameOverMenu.classList.add('hidden'); scoreboardMenu.classList.add('hidden'); pauseOverlay.classList.add('hidden');
}

function ensureLoadingUI() {
  if ($('loadingOverlay')) return;
  const style = document.createElement('style');
  style.id = 'infinityLoadingStyle';
  style.textContent = `
    #loadingOverlay{position:fixed;inset:0;z-index:20000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.96)}
    #loadingOverlay.hidden{display:none}.loading-card{width:min(82vw,360px);padding:24px;border:1px solid rgba(255,255,255,.18);border-radius:16px;background:rgba(10,10,14,.94);text-align:center;box-sizing:border-box}.loading-title{font-size:18px;letter-spacing:.2em;margin-bottom:18px}.loading-stage{font-size:12px;opacity:.7;min-height:18px}.loading-bar{height:6px;border-radius:999px;background:rgba(255,255,255,.10);overflow:hidden;margin-top:16px}.loading-fill{height:100%;width:0;background:#fff;transition:width .18s ease}.loading-percent{margin-top:9px;font-size:11px;opacity:.6}`;
  document.head.appendChild(style);
  const overlay = document.createElement('div'); overlay.id = 'loadingOverlay'; overlay.className = 'hidden';
  overlay.innerHTML = '<div class="loading-card"><div class="loading-title">INFINITY</div><div id="loadingStage" class="loading-stage">Preparazione</div><div class="loading-bar"><div id="loadingFill" class="loading-fill"></div></div><div id="loadingPercent" class="loading-percent">0%</div></div>';
  document.body.appendChild(overlay);
}

function showLoading(stage, percent) {
  ensureLoadingUI();
  $('loadingOverlay').classList.remove('hidden'); $('loadingStage').textContent = stage; $('loadingFill').style.width = percent + '%'; $('loadingPercent').textContent = percent + '%';
}
function hideLoading() { $('loadingOverlay').classList.add('hidden'); }

function startGame(resumeSaved = false) {
  if (starting) return;
  starting = true;
  running = false;
  clearInterval(timerId);
  resetGame();
  const restored = resumeSaved ? resumableSession : null;
  if (restored) { score = restored.score; lives = restored.lives; power = restored.power; }
  showLoading('Inizializzazione motore', 12);
  const steps = [
    ['Preparazione campo stellare', 32],
    ['Schieramento difese e minacce', 54],
    ['Sincronizzazione armi', 74],
    ['Controllo sistemi', 90],
    ['Infinity ONLINE', 100]
  ];
  let index = 0;
  const advance = () => {
    if (index < steps.length) { showLoading(steps[index][0], steps[index][1]); index++; setTimeout(advance, 110); return; }
    hideLoading();
    starting = false; running = true; paused = false; startTime = Date.now() - (restored?.elapsed || 0) * 1000; finalElapsed = 0; pausedAt = 0; pausedTotal = 0; lastFire = 0; setGameVisible();
    resumableSession = null; refreshHud();
    updateTimer(); clearInterval(timerId); timerId = setInterval(updateTimer, 1000); requestAnimationFrame(loop);
  };
  setTimeout(advance, 110);
}

function pauseGame() {
  if (!running || paused) return;
  paused = true; pausedAt = Date.now(); pauseOverlay.classList.remove('hidden'); settingsMenu.classList.add('hidden');
  saveSession();
}
function resumeGame() {
  if (!running || !paused) return;
  pausedTotal += Date.now() - pausedAt; pausedAt = 0; paused = false; pauseOverlay.classList.add('hidden'); frameStamp = 0; requestAnimationFrame(loop);
}

function gameOver() {
  if (!running) return;
  finalElapsed = secs(); running = false; paused = false; clearInterval(timerId);
  power = 0; powerEl.textContent = 'Power: 0';
  clearSession();
  try { deathSnapshot = { image: canvas.toDataURL('image/png'), score, time: finalElapsed, date: Date.now() }; } catch { deathSnapshot = null; }
  finalScore.textContent = 'Score: ' + score + ' · Time: ' + timerEl.textContent.replace('Time: ', '');
  playerName.value = ''; saveScoreBox.classList.remove('hidden'); gameOverMenu.classList.remove('hidden'); settingsBtn.style.display = 'none';
  ensureDeathSnapshotUI(); $('takePictureBtn').classList.toggle('hidden', !deathSnapshot);
}

function readScores() {
  try {
    const parsed = JSON.parse(localStorage.getItem('infinityScores') || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(x => x && typeof x === 'object').map(x => ({ name: String(x.name || 'Player').slice(0, 14), score: Math.max(0, Math.floor(Number(x.score) || 0)), time: Math.max(0, Math.floor(Number(x.time) || 0)), date: Number(x.date) || 0 })).sort((a, b) => b.score - a.score || b.time - a.time).slice(0, 10);
  } catch { return []; }
}
function renderScores() {
  const all = readScores();
  scoreList.innerHTML = all.length ? all.map(x => '<li>' + escapeHtml(x.name) + ' <span class="score-value">' + x.score + '</span></li>').join('') : '<li>Nessun punteggio salvato</li>';
}
function saveScore() {
  const name = (playerName.value.trim() || 'Player').slice(0, 14);
  const all = readScores(); all.push({ name, score, time: finalElapsed || secs(), date: Date.now() }); all.sort((a, b) => b.score - a.score || b.time - a.time);
  try { localStorage.setItem('infinityScores', JSON.stringify(all.slice(0, 10))); } catch {}
  saveScoreBox.classList.add('hidden'); renderScores();
}

function showDeathSnapshot() {
  if (!deathSnapshot) return;
  ensureDeathSnapshotUI();
  $('deathShotImage').src = deathSnapshot.image;
  $('deathShotStats').textContent = 'Score ' + deathSnapshot.score + ' · Time ' + Math.floor(deathSnapshot.time / 60) + ':' + String(deathSnapshot.time % 60).padStart(2, '0');
  $('deathSnapshotOverlay').classList.remove('hidden');
}
function ensureDeathSnapshotUI() {
  if ($('deathSnapshotOverlay')) return;
  const style = document.createElement('style'); style.id = 'infinitySnapshotStyle'; style.textContent = `#takePictureBtn{margin-top:6px}#deathSnapshotOverlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.88)}#deathSnapshotOverlay.hidden{display:none}.death-shot-card{position:relative;width:min(92vw,520px);max-height:92vh;overflow:auto;background:#090909;border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:14px;box-sizing:border-box}.death-shot-title{font-size:12px;letter-spacing:.18em;opacity:.72;margin:2px 42px 10px 2px}#deathShotImage{display:block;width:100%;max-height:72vh;object-fit:contain;border-radius:8px;background:#000}.death-shot-stats{margin-top:10px;font-size:15px;text-align:center;opacity:.9}.death-shot-close{position:absolute;top:5px;right:7px;width:30px;height:30px;border:0;background:transparent;color:rgba(255,255,255,.45);font-size:24px;line-height:30px;padding:0}`; document.head.appendChild(style);
  const btn = document.createElement('button'); btn.id = 'takePictureBtn'; btn.type = 'button'; btn.textContent = 'Take a picture'; btn.className = 'menu-secondary hidden'; btn.onclick = showDeathSnapshot;
  const close = $('closeGameOverBtn'); if (close?.parentNode) close.parentNode.insertBefore(btn, close);
  const overlay = document.createElement('div'); overlay.id = 'deathSnapshotOverlay'; overlay.className = 'hidden'; overlay.innerHTML = '<div class="death-shot-card"><button id="deathShotClose" class="death-shot-close" type="button" aria-label="Chiudi">×</button><div class="death-shot-title">MOMENTO DEL KO</div><img id="deathShotImage" alt="Screenshot del momento in cui sei stato colpito" /><div id="deathShotStats" class="death-shot-stats"></div></div>';
  document.body.appendChild(overlay); $('deathShotClose').onclick = () => overlay.classList.add('hidden');
}

function setTarget(e) {
  inputType = e.pointerType;
  const rect = canvas.getBoundingClientRect();
  targetX = (e.clientX - rect.left) * width / rect.width;
  targetY = (e.clientY - rect.top) * height / rect.height;
  if (e.pointerType === 'touch') targetY -= S(TOUCH_AHEAD);
}
canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' || e.pointerType === 'pen' || e.pointerType === 'mouse') { if (e.pointerType !== 'mouse') e.preventDefault(); setTarget(e); } });
canvas.addEventListener('pointermove', e => { if (e.pointerType === 'touch' || e.pointerType === 'pen' || e.pointerType === 'mouse') { if (e.pointerType !== 'mouse') e.preventDefault(); setTarget(e); } });
canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

function scoresBack() { scoreboardMenu.classList.add('hidden'); if (!running) gameOverMenu.classList.remove('hidden'); else settingsMenu.classList.remove('hidden'); }
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {}
}
function syncFullscreenLabel() { const button = $('fullscreenBtn'); if (button) button.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'; }

settingsBtn.onclick = () => {
  if (running && !paused) pauseGame();
  settingsMenu.classList.remove('hidden'); pauseOverlay.classList.add('hidden');
  $('resumeBtn').classList.toggle('hidden', !(running && paused) && !resumableSession);
  syncFullscreenLabel();
};
$('newGameBtn').onclick = () => { clearSession(); startGame(); };
$('resumeBtn').onclick = () => {
  settingsMenu.classList.add('hidden');
  if (running && paused) resumeGame(); else if (resumableSession) startGame(true);
};
$('scoresBtn').onclick = () => { settingsMenu.classList.add('hidden'); renderScores(); scoreboardMenu.classList.remove('hidden'); };
$('closeSettingsBtn').onclick = () => { settingsMenu.classList.add('hidden'); if (paused) pauseOverlay.classList.remove('hidden'); };
$('restartFromGameOverBtn').onclick = startGame;
$('showScoresFromGameOverBtn').onclick = () => { gameOverMenu.classList.add('hidden'); renderScores(); scoreboardMenu.classList.remove('hidden'); };
$('restartFromScoreboardBtn').onclick = startGame;
$('backFromScoreboardBtn').onclick = scoresBack;
$('saveScoreBtn').onclick = saveScore;
$('closeScoresBtn').onclick = scoresBack;
$('resumeFromPauseBtn').onclick = resumeGame;
$('restartFromPauseBtn').onclick = startGame;
$('backFromPauseBtn').onclick = () => { pauseOverlay.classList.add('hidden'); settingsMenu.classList.remove('hidden'); };
$('fullscreenBtn').onclick = toggleFullscreen;
document.addEventListener('fullscreenchange', syncFullscreenLabel);
startBtn.onclick = () => { if (resumableSession) startGame(true); else startGame(); };
document.addEventListener('visibilitychange', () => { if (document.hidden) { saveSession(); if (running && !paused) pauseGame(); } });

ensureLoadingUI();
ensureDeathSnapshotUI();
resize();
createStars();
draw();
resumableSession = readSession();
if (resumableSession) startBtn.textContent = 'Resume mission';
requestAnimationFrame(() => { resize(); draw(); });
