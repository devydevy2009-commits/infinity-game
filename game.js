const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const timerEl = document.getElementById('timer');
const startBtn = document.getElementById('startBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsMenu = document.getElementById('settingsMenu');
const newGameBtn = document.getElementById('newGameBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const restartBtn = document.getElementById('restartBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const pauseOverlay = document.getElementById('pauseOverlay');
const resumeFromPauseBtn = document.getElementById('resumeFromPauseBtn');
const restartFromPauseBtn = document.getElementById('restartFromPauseBtn');

let width, height, centerX, centerY;
let player, enemies, bullets, particles, score, lives, gameRunning, paused, lastTime, startTime, timerInterval;

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
  centerX = width / 2;
  centerY = height / 2;
}

window.addEventListener('resize', resize);
resize();

class Player {
  constructor() {
    this.x = centerX;
    this.y = height * 0.8;
    this.angle = -Math.PI / 2;
    this.size = 15;
  }

  update(targetX, targetY) {
    if (targetX !== undefined && targetY !== undefined) {
      this.x = targetX;
      this.y = targetY;
    }

    if (this.x < this.size) this.x = this.size;
    if (this.x > width - this.size) this.x = width - this.size;
    if (this.y < this.size) this.y = this.size;
    if (this.y > height - this.size) this.y = height - this.size;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.beginPath();
    ctx.moveTo(0, -this.size);
    ctx.lineTo(-this.size / 1.5, this.size);
    ctx.lineTo(this.size / 1.5, this.size);
    ctx.closePath();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  getBounds() {
    return { x: this.x, y: this.y, radius: this.size * 0.7 };
  }
}

class Enemy {
  constructor() {
    const edge = Math.floor(Math.random() * 4);
    if (edge === 0) { this.x = Math.random() * width; this.y = -20; }
    else if (edge === 1) { this.x = width + 20; this.y = Math.random() * height; }
    else if (edge === 2) { this.x = Math.random() * width; this.y = height + 20; }
    else { this.x = -20; this.y = Math.random() * height; }

    const angle = Math.atan2(centerY - this.y, centerX - this.x);
    const speed = 1 + Math.random() * 1.5;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.size = 12 + Math.random() * 10;
    this.rotation = 0;
    this.rotationSpeed = (Math.random() - 0.5) * 0.05;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.rotation += this.rotationSpeed;

    if (this.x < -50) this.x = width + 50;
    if (this.x > width + 50) this.x = -50;
    if (this.y < -50) this.y = height + 50;
    if (this.y > height + 50) this.y = -50;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.beginPath();
    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  getBounds() {
    return { x: this.x, y: this.y, radius: this.size };
  }
}

class Bullet {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = -12;
    this.size = 4;
    this.life = 80;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }

  getBounds() {
    return { x: this.x, y: this.y, radius: this.size };
  }
}

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = 1.0;
    this.decay = 0.02 + Math.random() * 0.02;
    this.color = color;
    this.size = 2 + Math.random() * 2;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
  }

  draw() {
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }
}

let playerTargetX = undefined;
let playerTargetY = undefined;
let lastFireTime = 0;
const fireCooldown = 120;

function handleTouchStart(e) {
  e.preventDefault();
  for (const touch of e.touches) {
    playerTargetX = touch.clientX;
    playerTargetY = touch.clientY;
  }
}

function handleTouchMove(e) {
  e.preventDefault();
  for (const touch of e.touches) {
    playerTargetX = touch.clientX;
    playerTargetY = touch.clientY;
  }
}

function handleTouchEnd(e) {
  e.preventDefault();
  const touches = e.touches;
  if (touches.length > 0) {
    playerTargetX = touches[0].clientX;
    playerTargetY = touches[0].clientY;
  } else {
    playerTargetX = undefined;
    playerTargetY = undefined;
  }
}

canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

function handlePointerMove(e) {
  if (e.pointerType === 'pen' || e.pointerType === 'touch') {
    e.preventDefault();
    playerTargetX = e.clientX;
    playerTargetY = e.clientY;
  }
}

function handlePointerDown(e) {
  if (e.pointerType === 'pen' || e.pointerType === 'touch') {
    e.preventDefault();
    playerTargetX = e.clientX;
    playerTargetY = e.clientY;
  }
}

function handlePointerUp(e) {
  if (e.pointerType === 'pen' || e.pointerType === 'touch') {
    e.preventDefault();
  }
}

canvas.addEventListener('pointermove', handlePointerMove, { passive: false });
canvas.addEventListener('pointerdown', handlePointerDown, { passive: false });
canvas.addEventListener('pointerup', handlePointerUp, { passive: false });
canvas.addEventListener('pointercancel', handlePointerUp, { passive: false });

function spawnEnemy() {
  if (enemies.length < 10 && Math.random() < 0.04) {
    enemies.push(new Enemy());
  }
}

function checkCollisions() {
  const playerBounds = player.getBounds();

  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    const enemyBounds = enemy.getBounds();
    const dx = playerBounds.x - enemyBounds.x;
    const dy = playerBounds.y - enemyBounds.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < playerBounds.radius + enemyBounds.radius) {
      enemies.splice(i, 1);
      createExplosion(enemy.x, enemy.y, '#ff4444', 10);
      lives--;
      livesEl.textContent = `Lives: ${lives}`;
      if (lives <= 0) {
        gameOver();
      }
      return;
    }

    for (let j = bullets.length - 1; j >= 0; j--) {
      const bullet = bullets[j];
      const bulletBounds = bullet.getBounds();
      const bdx = bulletBounds.x - enemyBounds.x;
      const bdy = bulletBounds.y - enemyBounds.y;
      const bdist = Math.sqrt(bdx * bdx + bdy * bdy);

      if (bdist < bulletBounds.radius + enemyBounds.radius) {
        enemies.splice(i, 1);
        bullets.splice(j, 1);
        createExplosion(enemy.x, enemy.y, '#ff4444', 12);
        score += 100;
        scoreEl.textContent = `Score: ${score}`;
        break;
      }
    }
  }
}

function createExplosion(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y, color));
  }
}

function updateTimer() {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  timerEl.textContent = `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function update(deltaTime) {
  if (paused) return;

  player.update(playerTargetX, playerTargetY);

  const now = Date.now();
  if (now - lastFireTime > fireCooldown) {
    bullets.push(new Bullet(player.x, player.y - player.size));
    lastFireTime = now;
  }

  enemies.forEach(e => e.update());
  bullets.forEach(b => b.update());
  particles.forEach(p => p.update());

  bullets = bullets.filter(b => b.life > 0);
  particles = particles.filter(p => p.life > 0);

  spawnEnemy();
  checkCollisions();
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  player.draw();
  enemies.forEach(e => e.draw());
  bullets.forEach(b => b.draw());
  particles.forEach(p => p.draw());
}

function gameLoop(timestamp) {
  if (!gameRunning) return;

  const deltaTime = timestamp - lastTime;
  lastTime = timestamp;

  update(deltaTime);
  draw();

  requestAnimationFrame(gameLoop);
}

function startGame() {
  player = new Player();
  enemies = [];
  bullets = [];
  particles = [];
  score = 0;
  lives = 3;
  scoreEl.textContent = `Score: ${score}`;
  livesEl.textContent = `Lives: ${lives}`;
  playerTargetX = undefined;
  playerTargetY = undefined;
  gameRunning = true;
  paused = false;
  startTime = Date.now();
  lastTime = performance.now();
  lastFireTime = 0;
  
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 1000);
  updateTimer();
  
  startBtn.style.display = 'none';
  settingsMenu.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  settingsBtn.style.display = 'block';
  
  requestAnimationFrame(gameLoop);
}

function pauseGame() {
  paused = true;
  pauseOverlay.classList.remove('hidden');
  settingsMenu.classList.add('hidden');
}

function resumeGame() {
  paused = false;
  pauseOverlay.classList.add('hidden');
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function restartGame() {
  if (timerInterval) clearInterval(timerInterval);
  startGame();
}

function gameOver() {
  gameRunning = false;
  if (timerInterval) clearInterval(timerInterval);
  startBtn.textContent = 'Restart';
  startBtn.style.display = 'block';
  settingsBtn.style.display = 'none';
}

settingsBtn.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  settingsMenu.classList.remove('hidden');
  
  if (paused) {
    pauseBtn.classList.add('hidden');
    resumeBtn.classList.remove('hidden');
  } else {
    pauseBtn.classList.remove('hidden');
    resumeBtn.classList.add('hidden');
  }
});

newGameBtn.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (timerInterval) clearInterval(timerInterval);
  startGame();
});

pauseBtn.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  pauseGame();
});

resumeBtn.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  resumeGame();
  settingsMenu.classList.add('hidden');
});

restartBtn.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  restartGame();
  settingsMenu.classList.add('hidden');
});

closeSettingsBtn.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  settingsMenu.classList.add('hidden');
});

resumeFromPauseBtn.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  resumeGame();
});

restartFromPauseBtn.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  restartGame();
});

startBtn.addEventListener('click', startGame);
startBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  startGame();
});

function initialDraw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
}

initialDraw();
