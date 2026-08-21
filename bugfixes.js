// Infinity bug fixes and compatibility layer.
// Loaded after game.js so the original game logic remains easy to audit.
(() => {
  let pausedAt = 0;
  let pausedTotal = 0;
  let finalElapsed = 0;
  let hardMode = false;
  let gyroEnabled = false;
  let gyroListenerAttached = false;
  let lastSimulationAt = 0;

  const originalResetGame = resetGame;
  const originalStartGame = startGame;
  const originalGameOver = gameOver;
  const originalUpdate = update;

  function secsFixed() {
    if (!startTime) return 0;
    let elapsed = Date.now() - startTime - pausedTotal;
    if (pausedAt) elapsed -= Date.now() - pausedAt;
    if (!running && finalElapsed > 0) return finalElapsed;
    return Math.max(0, Math.floor(elapsed / 1000));
  }
  secs = secsFixed;

  function resetGameFixed() {
    pausedAt = 0;
    pausedTotal = 0;
    finalElapsed = 0;
    lastSimulationAt = 0;
    if (player) player.angle = 0;
    originalResetGame();
    if (player) player.angle = 0;
  }
  resetGame = resetGameFixed;

  function gameOverFixed() {
    finalElapsed = secsFixed();
    updateTimer();
    originalGameOver();
  }
  gameOver = gameOverFixed;

  Bullet = class BulletFixed {
    constructor(x, y, vx = 0, vy = -1, damage = 1) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy * S(powerTable[power].speed);
      this.r = S(damage > 1 ? 4.6 : 3.4);
      this.life = 125;
      this.damage = damage;
    }
    update(f) {
      this.x += this.vx * f;
      this.y += this.vy * f;
      this.life--;
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    b() { return { x: this.x, y: this.y, r: this.r }; }
  };

  function startGameFixed() {
    if (!running) {
      finalElapsed = 0;
      originalStartGame();
      return;
    }
    const needsNewFrameLoop = paused;
    resetGameFixed();
    running = true;
    paused = false;
    startTime = Date.now();
    lastFire = 0;
    clearInterval(timerId);
    timerId = setInterval(updateTimer, 1000);
    updateTimer();
    startBtn.style.display = 'none';
    settingsBtn.style.display = 'block';
    settingsMenu.classList.add('hidden');
    gameOverMenu.classList.add('hidden');
    scoreboardMenu.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    if (needsNewFrameLoop) requestAnimationFrame(loop);
  }
  startGame = startGameFixed;

  function pauseGameFixed() {
    if (!running || paused) return;
    paused = true;
    pausedAt = Date.now();
    pauseOverlay.classList.remove('hidden');
    settingsMenu.classList.add('hidden');
  }
  pauseGame = pauseGameFixed;

  function resumeGameFixed() {
    if (!running || !paused) return;
    pausedTotal += Date.now() - pausedAt;
    pausedAt = 0;
    paused = false;
    lastSimulationAt = 0;
    pauseOverlay.classList.add('hidden');
    requestAnimationFrame(loop);
  }
  resumeGame = resumeGameFixed;

  function updateFixed() {
    const now = performance.now();
    if (lastSimulationAt && now - lastSimulationAt < 1000 / 60) return;
    lastSimulationAt = now;
    const before = score;
    originalUpdate();
    if (hardMode && score > before) {
      score += Math.round((score - before) * 0.5);
      scoreEl.textContent = 'Score: ' + score;
    }
  }
  update = updateFixed;

  function readScoresSafe() {
    try {
      const parsed = JSON.parse(localStorage.getItem('infinityScores') || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(x => x && typeof x === 'object')
        .map(x => ({
          name: String(x.name || 'Player').slice(0, 14),
          score: Number.isFinite(Number(x.score)) ? Math.max(0, Math.floor(Number(x.score))) : 0,
          time: Number.isFinite(Number(x.time)) ? Math.max(0, Math.floor(Number(x.time))) : 0,
          date: Number.isFinite(Number(x.date)) ? Number(x.date) : 0,
        }))
        .sort((a, b) => b.score - a.score || b.time - a.time)
        .slice(0, 10);
    } catch {
      return [];
    }
  }
  scores = readScoresSafe;

  function renderScoresFixed() {
    const all = readScoresSafe();
    scoreList.innerHTML = all.length
      ? all.map(x => '<li>' + escapeHtml(x.name) + ' <span class="score-value">' + x.score + '</span></li>').join('')
      : '<li>Nessun punteggio salvato</li>';
  }
  renderScores = renderScoresFixed;

  function saveScoreFixed() {
    const name = (playerName.value.trim() || 'Player').slice(0, 14);
    const all = readScoresSafe();
    const elapsed = finalElapsed || secsFixed();
    all.push({ name, score: Math.max(0, Math.floor(Number(score) || 0)), time: elapsed, date: Date.now() });
    all.sort((a, b) => b.score - a.score || b.time - a.time);
    try { localStorage.setItem('infinityScores', JSON.stringify(all.slice(0, 10))); } catch {}
    saveScoreBox.classList.add('hidden');
    renderScoresFixed();
  }
  saveScore = saveScoreFixed;

  function showHardModeNotice() {
    const notice = $('hardModeNotice');
    notice.textContent = hardMode ? '⚡ HARD MODE — +50% score' : 'HARD MODE OFF';
    notice.classList.remove('hidden');
    clearTimeout(showHardModeNotice.timer);
    showHardModeNotice.timer = setTimeout(() => notice.classList.add('hidden'), 1600);
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  async function toggleGyro() {
    if (!hardMode && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try { await DeviceOrientationEvent.requestPermission(); } catch {}
    }
    hardMode = !hardMode;
    if (hardMode && !gyroListenerAttached && 'DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', onOrientation, { passive: true });
      gyroListenerAttached = true;
    }
    gyroEnabled = hardMode && 'DeviceOrientationEvent' in window;
    $('gyroToggleBtn').textContent = hardMode
      ? (gyroEnabled ? '🌀 Giroscopio (Hard Mode): ON' : '🌀 Hard Mode: ON')
      : '🌀 Giroscopio (Hard Mode)';
    $('gyroLabel').classList.toggle('hidden', !gyroEnabled);
    showHardModeNotice();
  }

  // In Hard Mode the gyroscope only rotates the ship's nose.
  // Position remains controlled by the normal touch/mouse target.
  function onOrientation(e) {
    if (!gyroEnabled || !running || paused || !player) return;
    const gamma = clamp(Number(e.gamma) || 0, -45, 45);
    const beta = clamp(Number(e.beta) || 0, -45, 45);
    const yaw = (gamma / 45) * 0.95;
    const pitch = (beta / 45) * 0.22;
    player.angle = Math.atan2(yaw, -1 + pitch);
  }

  // Draw the triangle using the gyro orientation without changing its position.
  const basePlayerDraw = Player.prototype.draw;
  Player.prototype.draw = function drawOrientedPlayer() {
    const flash = Date.now() < invulnerableUntil && Math.floor(Date.now() / 70) % 2 === 0;
    const angle = Number.isFinite(this.angle) ? this.angle : 0;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, -this.size);
    ctx.lineTo(-this.size * 0.72, this.size * 0.72);
    ctx.lineTo(this.size * 0.72, this.size * 0.72);
    ctx.closePath();
    ctx.strokeStyle = flash ? '#ff3d3d' : '#fff';
    ctx.lineWidth = S(2.5);
    ctx.stroke();
    ctx.restore();
  };

  canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') setTarget(e); });
  canvas.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') setTarget(e); });

  $('gyroToggleBtn').onclick = toggleGyro;
  $('saveScoreBtn').onclick = saveScoreFixed;
  $('restartFromGameOverBtn').onclick = startGameFixed;
  $('restartFromScoreboardBtn').onclick = startGameFixed;
  $('newGameBtn').onclick = startGameFixed;
  $('restartBtn').onclick = startGameFixed;
  $('restartFromPauseBtn').onclick = startGameFixed;
  $('pauseBtn').onclick = pauseGameFixed;
  $('resumeBtn').onclick = () => { settingsMenu.classList.add('hidden'); resumeGameFixed(); };
  $('resumeFromPauseBtn').onclick = resumeGameFixed;

  $('closeGameOverBtn').onclick = () => {
    gameOverMenu.classList.add('hidden');
    settingsBtn.style.display = 'none';
    startBtn.style.display = 'block';
  };

  $('closeSettingsBtn').onclick = () => {
    settingsMenu.classList.add('hidden');
    if (paused) pauseOverlay.classList.remove('hidden');
  };

  const originalSettingsClick = settingsBtn.onclick;
  settingsBtn.onclick = e => {
    if (originalSettingsClick) originalSettingsClick.call(settingsBtn, e);
    if (paused) pauseOverlay.classList.add('hidden');
  };
})();
