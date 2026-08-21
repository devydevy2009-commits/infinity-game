const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const startBtn = document.getElementById('startBtn');

let width, height, centerX, centerY;
let player, enemies, bullets, particles, score, lives, gameRunning, lastTime;

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
    this.y = centerY;
    this.angle = -Math.PI / 2;
    this.size = 15;
    this.speed = 0;
    this.maxSpeed = 4;
    this.friction = 0.98;
    this.rotationSpeed = 0.08;
  }

  update(input) {
    if (input.left) this.angle -= this.rotationSpeed;
    if (input.right) this.angle += this.rotationSpeed;
    if (input.up) {
      this.speed = Math.min(this.speed + 0.2, this.maxSpeed);
    } else {
      this.speed *= this.friction;
    }

    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;

    if (this.x < 0) this.x = width;
    if (this.x > width) this.x = 0;
    if (this.y < 0) this.y = height;
    if (this.y > height) this.y = 0;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle + Math.PI / 2);
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
    const speed = 0.8 + Math.random() * 1.2;
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
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * 8;
    this.vy = Math.sin(angle) * 8;
    this.size = 3;
    this.life = 100;
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

const input = { up: false, left: false, right: false, firing: false };
let lastFireTime = 0;
const fireCooldown = 150;

function handleTouchStart(e) {
  e.preventDefault();
  for (const touch of e.touches) {
    const x = touch.clientX;
    const y = touch.clientY;
    if (y > height * 0.6) {
      if (x < width * 0.4) input.left = true;
      else if (x > width * 0.6) input.right = true;
      else input.up = true;
    } else {
      input.firing = true;
    }
  }
}

function handleTouchEnd(e) {
  e.preventDefault();
  const touches = e.touches;
  input.left = false;
  input.right = false;
  input.up = false;
  for (const touch of touches) {
    const x = touch.clientX;
    const y = touch.clientY;
    if (y > height * 0.6) {
      if (x < width * 0.4) input.left = true;
      else if (x > width * 0.6) input.right = true;
      else input.up = true;
    } else {
      input.firing = true;
    }
  }
}

canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

function spawnEnemy() {
  if (enemies.length < 8 && Math.random() < 0.03) {
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

function update(deltaTime) {
  player.update(input);

  const now = Date.now();
  if (input.firing && now - lastFireTime > fireCooldown) {
    bullets.push(new Bullet(player.x, player.y, player.angle));
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
  gameRunning = true;
  lastTime = performance.now();
  startBtn.style.display = 'none';
  requestAnimationFrame(gameLoop);
}

function gameOver() {
  gameRunning = false;
  startBtn.textContent = 'Restart';
  startBtn.style.display = 'block';
}

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
