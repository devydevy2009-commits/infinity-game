// ============================================================
//  INFINITY — game.js
//  Core game loop. Weapon firing is intentionally routed through
//  globalThis.shoot so later gameplay layers cannot accidentally
//  capture an older shoot() implementation.
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
const saveScoreBtn = $('saveScoreBtn');
const saveScoreBox = $('saveScoreBox');
const scoreList = $('scoreList');

let width, height, cx, cy, scale = 1;
let player, enemies, bullets, enemyBullets, particles, powerups;
let score = 0, lives = 3, power = 0;
let running = false, paused = false;
let startTime, timerId, lastFire = 0;
let targetX, targetY;
let slowUntil = 0, invulnerableUntil = 0;
let deferredPrompt = null;

let waveTimer = 0;
let inWave = false;
let waveQueue = [];
let waveSpawnIndex = 0;
let waveSpawnTimer = 0;

const powerTable = Array.from({ length: 50 }, (_, i) => ({
  shots: 1,
  cooldown: Math.max(42, 126 - i * 1.7),
  speed: 13 + i * 0.12,
  spread: Math.min(0.48, 0.09 + i * 0.008),
  side: i >= 2,
  wide: i >= 7,
  heavy: i >= 10,
  rapid: i >= 16,
  back: i >= 20,
  quad: i >= 30,
}));

function resize() {
  width = innerWidth;
  height = innerHeight;
  canvas.width = width;
  canvas.height = height;
  cx = width / 2;
  cy = height / 2;
  scale = Math.max(0.78, Math.min(1.18, Math.min(width, height) / 390));
}
addEventListener('resize', resize);
resize();
const S = n => n * scale;

function secs() { return running ? Math.floor((Date.now() - startTime) / 1000) : 0; }
function tier() { return Math.floor(secs() / 15); }
function burst(x, y, color, n) { for (let i = 0; i < n; i++) particles.push(new Particle(x, y, color)); }
function overlap(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy < (a.r + b.r) * (a.r + b.r); }
function escapeHtml(s) { return String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }

class Player {
  constructor() { this.x = cx; this.y = height * 0.8; this.size = S(16); }
  update(x, y) {
    this.size = S(16);
    if (x !== undefined) { this.x = x; this.y = y; }
    this.x = Math.max(this.size, Math.min(width - this.size, this.x));
    this.y = Math.max(this.size, Math.min(height - this.size, this.y));
  }
  draw() {
    const flash = Date.now() < invulnerableUntil && Math.floor(Date.now() / 70) % 2 === 0;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.beginPath();
    ctx.moveTo(0, -this.size);
    ctx.lineTo(-this.size * 0.72, this.size * 0.72);
    ctx.lineTo(this.size * 0.72, this.size * 0.72);
    ctx.closePath();
    ctx.strokeStyle = flash ? '#ff3d3d' : '#fff';
    ctx.lineWidth = S(2.5);
    ctx.stroke();
    ctx.restore();
  }
  b() { return { x: this.x, y: this.y, r: this.size * 0.68 }; }
}

class Enemy {
  constructor(kind = 'basic') {
    this.kind = kind;
    const edge = Math.floor(Math.random() * 3);
    if (edge === 0) { this.x = Math.random() * width; this.y = -S(32); }
    else if (edge === 1) { this.x = width + S(32); this.y = Math.random() * height * 0.7; }
    else { this.x = -S(32); this.y = Math.random() * height * 0.7; }
    const angle = Math.atan2(height * 0.58 - this.y, cx - this.x);
    const mult = 1 + tier() * 0.18;
    this.vx = Math.cos(angle) * S((1.22 + Math.random() * 1.05) * mult);
    this.vy = Math.sin(angle) * S((1.22 + Math.random() * 1.05) * mult);
    this.size = S(kind === 'armored' ? 19 : kind === 'ghost' ? 14 : 12 + Math.random() * 9);
    this.rot = 0;
    this.lastShot = Date.now() + Math.random() * 1000;
    this.hitUntil = 0;
    if (kind === 'ghost') this.hp = Infinity;
    else if (kind === 'armored') this.hp = Math.min(8, 3 + Math.floor(power / 10));
    else this.hp = tier() >= 6 ? 2 : 1;
  }
  update(factor) {
    this.x += this.vx * factor;
    this.y += this.vy * factor;
    this.rot += 0.04 * factor;
    if (this.kind === 'shooter') {
      const shootInterval = Math.max(330, 1200 - tier() * 34);
      if (Date.now() - this.lastShot > shootInterval) {
        enemyBullets.push(new EnemyBullet(this.x, this.y + this.size * 0.8));
        this.lastShot = Date.now();
      }
    }
    if ((this.kind === 'shooter' || this.kind === 'armored') && player) {
      const ax = player.x - this.x;
      const ay = player.y - this.y;
      const dist = Math.sqrt(ax * ax + ay * ay) || 1;
      const steer = S(0.04 + tier() * 0.004) * factor;
      this.vx += ax / dist * steer;
      this.vy += ay / dist * steer;
      const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      const maxSpd = S(2.5 + tier() * 0.2);
      if (spd > maxSpd) { this.vx = this.vx / spd * maxSpd; this.vy = this.vy / spd * maxSpd; }
    }
  }
  draw() {
    const flashing = Date.now() < this.hitUntil && Math.floor(Date.now() / 70) % 2 === 0;
    let color = '#ff4444';
    if (this.kind === 'shooter') color = '#ff963d';
    if (this.kind === 'armored') color = '#bd4aff';
    if (this.kind === 'ghost') color = '#888888';
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = flashing ? '#fff' : color;
    ctx.lineWidth = S(this.kind === 'ghost' ? 3 : 2);
    ctx.beginPath();
    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
    ctx.stroke();
    if (this.kind === 'shooter') { ctx.beginPath(); ctx.moveTo(0, -this.size * 0.42); ctx.lineTo(0, this.size * 0.42); ctx.stroke(); }
    if (this.kind === 'armored') { ctx.beginPath(); ctx.arc(0, 0, this.size * 0.55, 0, Math.PI * 2); ctx.stroke(); }
    if (this.kind === 'ghost') {
      ctx.beginPath(); ctx.moveTo(-this.size * 0.35, 0); ctx.lineTo(this.size * 0.35, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -this.size * 0.35); ctx.lineTo(0, this.size * 0.35); ctx.stroke();
    }
    ctx.restore();
  }
  b() { return { x: this.x, y: this.y, r: this.size }; }
}

class Powerup {
  constructor() { this.x = S(28) + Math.random() * (width - S(56)); this.y = -S(28); this.size = S(18); this.vy = S(2 + tier() * 0.09); this.rot = 0; }
  update(f) { this.y += this.vy * f; this.rot += 0.03 * f; }
  draw() { ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot); ctx.strokeStyle = '#249bff'; ctx.lineWidth = S(3); ctx.strokeRect(-this.size / 2, -this.size / 2, this.size, this.size); ctx.restore(); }
  b() { return { x: this.x, y: this.y, r: this.size * 0.72 }; }
}

class Bullet {
  constructor(x, y, vx = 0, vy = -1, damage = 1) {
    this.x = x; this.y = y;
    const speed = S(powerTable[Math.min(Math.max(power, 0), powerTable.length - 1)].speed);
    const len = Math.hypot(vx, vy) || 1;
    this.vx = (vx / len) * speed;
    this.vy = (vy / len) * speed;
    this.r = S(damage > 1 ? 4.6 : 3.4);
    this.life = 1000;
    this.damage = damage;
  }
  update(f) { this.x += this.vx * f; this.y += this.vy * f; this.life--; }
  draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); }
  b() { return { x: this.x, y: this.y, r: this.r }; }
}

class EnemyBullet {
  constructor(x, y) { this.x = x; this.y = y; this.vy = S(5.8 + tier() * 0.16); this.r = S(4); this.life = 190; }
  update(f) { this.y += this.vy * f; this.life--; }
  draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fillStyle = '#ff783d'; ctx.fill(); }
  b() { return { x: this.x, y: this.y, r: this.r }; }
}

class Particle {
  constructor(x, y, color) { this.x = x; this.y = y; const angle = Math.random() * Math.PI * 2; const speed = S(Math.random() * 3.5); this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed; this.life = 1; this.d = 0.025 + Math.random() * 0.03; this.c = color; this.r = S(1.5 + Math.random() * 2.5); }
  update(f) { this.x += this.vx * f; this.y += this.vy * f; this.life -= this.d * f; }
  draw() { ctx.globalAlpha = Math.max(0, this.life); ctx.fillStyle = this.c; ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
}

function chooseEnemy() {
  const t = tier(), r = Math.random();
  if (t >= 5 && r < Math.min(0.08 + t * 0.01, 0.22)) return 'ghost';
  if (t >= 4 && r < Math.min(0.14 + t * 0.018, 0.42)) return 'armored';
  if (t >= 2 && r < Math.min(0.20 + t * 0.018, 0.52)) return 'shooter';
  return 'basic';
}

function buildWave() {
  const t = tier();
  const count = 4 + Math.min(t, 8);
  const kind = chooseEnemy();
  const cols = Math.min(count, 4);
  const rows = Math.ceil(count / cols);
  const startX = width * 0.2 + Math.random() * width * 0.4;
  const startY = -S(40);
  const spacingX = S(48);
  const spacingY = S(44);
  const queue = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (queue.length >= count) break;
      queue.push({ x: startX + (c - (cols - 1) / 2) * spacingX, y: startY - r * spacingY, kind });
    }
  }
  return queue;
}

function spawnFromWave(entry) {
  const e = new Enemy(entry.kind);
  e.x = entry.x; e.y = entry.y;
  const angle = Math.atan2(height * 0.58 - e.y, cx - e.x);
  const mult = 1 + tier() * 0.18;
  e.vx = Math.cos(angle) * S((1.22 + Math.random() * 0.4) * mult);
  e.vy = Math.sin(angle) * S((1.22 + Math.random() * 0.4) * mult);
  enemies.push(e);
}

function spawn() {
  const t = tier();
  const cap = 8 + t * 3;
  const now = Date.now();
  if (t >= 1 && !inWave && now - waveTimer > 20000) {
    waveTimer = now; inWave = true; waveQueue = buildWave(); waveSpawnIndex = 0; waveSpawnTimer = now;
  }
  if (inWave) {
    if (now - waveSpawnTimer > 350 && waveSpawnIndex < waveQueue.length) {
      spawnFromWave(waveQueue[waveSpawnIndex]);
      waveSpawnIndex++; waveSpawnTimer = now;
    }
    if (waveSpawnIndex >= waveQueue.length) inWave = false;
  }
  if (enemies.length < cap && Math.random() < 0.032 + t * 0.006) enemies.push(new Enemy(chooseEnemy()));
  if (Math.random() < 0.0017 + Math.min(t, 16) * 0.00025) powerups.push(new Powerup());
}

function addShot(x, y, vx, vy, damage) { bullets.push(new Bullet(x, y, vx, vy, damage)); }

// Canonical firing entry point. Weapon geometry is supplied by the final
// weapon layer, but the core loop always resolves the current global function.
function shoot(now) {
  if (typeof globalThis.InfinityFire === 'function') globalThis.InfinityFire(now);
}

globalThis.shoot = shoot;
globalThis.addShot = addShot;

function damage() {
  if (Date.now() < invulnerableUntil) return;
  lives--;
  livesEl.textContent = 'Lives: ' + lives;
  invulnerableUntil = Date.now() + 850;
  slowUntil = Date.now() + 1000;
  burst(player.x, player.y, '#ff3d3d', 18);
  if (lives <= 0) gameOver();
}

function collisions() {
  const pb = player.b();
  for (let i = powerups.length - 1; i >= 0; i--) {
    for (let j = bullets.length - 1; j >= 0; j--) {
      if (overlap(powerups[i].b(), bullets[j].b())) {
        const p = powerups[i];
        powerups.splice(i, 1); bullets.splice(j, 1);
        power = Math.min(49, power + 1);
        powerEl.textContent = 'Power: ' + power;
        score += 250; scoreEl.textContent = 'Score: ' + score;
        burst(p.x, p.y, '#249bff', 18);
        break;
      }
    }
  }
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i], eb = e.b();
    if (overlap(pb, eb)) { enemies.splice(i, 1); burst(e.x, e.y, '#ff4444', 14); damage(); continue; }
    for (let j = bullets.length - 1; j >= 0; j--) {
      if (overlap(eb, bullets[j].b())) {
        if (e.kind === 'ghost') { bullets.splice(j, 1); e.hitUntil = Date.now() + 80; break; }
        bullets.splice(j, 1);
        e.hp--; e.hitUntil = Date.now() + 180;
        if (e.hp <= 0) {
          enemies.splice(i, 1);
          const baseScore = e.kind === 'armored' ? 250 : 100;
          score += baseScore;
          scoreEl.textContent = 'Score: ' + score;
          burst(e.x, e.y, e.kind === 'armored' ? '#bd4aff' : '#ff4444', 16);
        }
        break;
      }
    }
  }
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    if (overlap(pb, enemyBullets[i].b())) { enemyBullets.splice(i, 1); damage(); }
  }
}

function updateTimer() { const t = secs(); timerEl.textContent = 'Time: ' + Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }

function update() {
  if (paused) return;
  const f = Date.now() < slowUntil ? 0.32 : 1;
  const now = Date.now();
  player.update(targetX, targetY);
  globalThis.shoot(now);
  enemies.forEach(x => x.update(f));
  powerups.forEach(x => x.update(f));
  bullets.forEach(x => x.update(f));
  enemyBullets.forEach(x => x.update(f));
  particles.forEach(x => x.update(f));
  enemies = enemies.filter(x => x.x > -S(100) && x.x < width + S(100) && x.y > -S(100) && x.y < height + S(100));
  powerups = powerups.filter(x => x.y < height + S(50));
  // Do not filter by Y alone: side and rear weapons travel horizontally.
  bullets = bullets.filter(x => x.life > 0 && x.x > -S(100) && x.x < width + S(100) && x.y > -S(100) && x.y < height + S(100));
  enemyBullets = enemyBullets.filter(x => x.life > 0 && x.x > -S(100) && x.x < width + S(100) && x.y < height + S(100));
  particles = particles.filter(x => x.life > 0);
  spawn();
  collisions();
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  player.draw();
  enemies.forEach(x => x.draw());
  powerups.forEach(x => x.draw());
  bullets.forEach(x => x.draw());
  enemyBullets.forEach(x => x.draw());
  particles.forEach(x => x.draw());
}

function loop() { if (!running) return; update(); draw(); requestAnimationFrame(loop); }

function resetGame() {
  player = new Player(); enemies = []; bullets = []; enemyBullets = []; particles = []; powerups = [];
  score = 0; lives = 3; power = 0; targetX = undefined; targetY = undefined; slowUntil = 0; invulnerableUntil = 0;
  waveTimer = Date.now(); inWave = false; waveQueue = []; waveSpawnIndex = 0; waveSpawnTimer = 0;
  scoreEl.textContent = 'Score: 0'; livesEl.textContent = 'Lives: 3'; powerEl.textContent = 'Power: 0';
}

function startGame() {
  resetGame(); running = true; paused = false; startTime = Date.now(); lastFire = 0;
  clearInterval(timerId); timerId = setInterval(updateTimer, 1000); updateTimer();
  startBtn.style.display = 'none'; settingsBtn.style.display = 'block';
  settingsMenu.classList.add('hidden'); gameOverMenu.classList.add('hidden'); scoreboardMenu.classList.add('hidden'); pauseOverlay.classList.add('hidden');
  requestAnimationFrame(loop);
}

function pauseGame() { paused = true; pauseOverlay.classList.remove('hidden'); settingsMenu.classList.add('hidden'); }
function resumeGame() { paused = false; pauseOverlay.classList.add('hidden'); requestAnimationFrame(loop); }
function gameOver() { running = false; clearInterval(timerId); power = 0; powerEl.textContent = 'Power: 0'; finalScore.textContent = 'Score: ' + score + ' · Time: ' + timerEl.textContent.replace('Time: ', ''); playerName.value = ''; saveScoreBox.classList.remove('hidden'); gameOverMenu.classList.remove('hidden'); settingsBtn.style.display = 'none'; }

function scores() { try { return JSON.parse(localStorage.getItem('infinityScores') || '[]'); } catch { return []; } }
function renderScores() { const all = scores(); scoreList.innerHTML = all.length ? all.map(x => '<li>' + escapeHtml(x.name) + ' <span class="score-value">' + x.score + '</span></li>').join('') : '<li>Nessun punteggio salvato</li>'; }
function saveScore() { const name = (playerName.value.trim() || 'Player').slice(0, 14); const all = scores(); all.push({ name, score, time: secs(), date: Date.now() }); all.sort((a, b) => b.score - a.score || b.time - a.time); localStorage.setItem('infinityScores', JSON.stringify(all.slice(0, 10))); saveScoreBox.classList.add('hidden'); renderScores(); }
function forceRefresh() { if ('caches' in window) { caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => location.replace(location.pathname + '?update=' + Date.now())); } else { location.replace(location.pathname + '?update=' + Date.now()); } }

function setTarget(e) { targetX = e.clientX; targetY = e.clientY; }
canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' || e.pointerType === 'pen') { e.preventDefault(); setTarget(e); } });
canvas.addEventListener('pointermove', e => { if (e.pointerType === 'touch' || e.pointerType === 'pen') { e.preventDefault(); setTarget(e); } });
canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

function backToSettings() { scoreboardMenu.classList.add('hidden'); if (!running) gameOverMenu.classList.remove('hidden'); else settingsMenu.classList.remove('hidden'); }

settingsBtn.onclick = () => { settingsMenu.classList.remove('hidden'); $('pauseBtn').classList.toggle('hidden', paused); $('resumeBtn').classList.toggle('hidden', !paused); };
$('newGameBtn').onclick = startGame;
$('pauseBtn').onclick = pauseGame;
$('resumeBtn').onclick = () => { settingsMenu.classList.add('hidden'); resumeGame(); };
$('restartBtn').onclick = startGame;
$('scoresBtn').onclick = () => { settingsMenu.classList.add('hidden'); renderScores(); scoreboardMenu.classList.remove('hidden'); };
$('closeSettingsBtn').onclick = () => settingsMenu.classList.add('hidden');
$('restartFromGameOverBtn').onclick = startGame;
$('showScoresFromGameOverBtn').onclick = () => { gameOverMenu.classList.add('hidden'); renderScores(); scoreboardMenu.classList.remove('hidden'); };
$('restartFromScoreboardBtn').onclick = startGame;
$('backFromScoreboardBtn').onclick = backToSettings;
$('saveScoreBtn').onclick = saveScore;
$('closeScoresBtn').onclick = backToSettings;
$('resumeFromPauseBtn').onclick = resumeGame;
$('restartFromPauseBtn').onclick = startGame;
$('backFromPauseBtn').onclick = () => { pauseOverlay.classList.add('hidden'); settingsMenu.classList.remove('hidden'); };
$('refreshBtn').onclick = forceRefresh;
$('iosInstallBtn').onclick = () => { settingsMenu.classList.add('hidden'); $('iosInstallHelp').classList.remove('hidden'); };
$('closeIosInstallHelpBtn').onclick = () => $('iosInstallHelp').classList.add('hidden');
startBtn.onclick = startGame;

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; $('installBtn').classList.remove('hidden'); });
$('installBtn').onclick = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $('installBtn').classList.add('hidden'); };

ctx.fillStyle = '#000';
ctx.fillRect(0, 0, width, height);
