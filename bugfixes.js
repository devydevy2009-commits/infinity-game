// Infinity bug fixes and compatibility layer.
// Loaded after game.js so the original game logic remains easy to audit.
(() => {
  let pausedAt = 0;
  let pausedTotal = 0;
  let finalElapsed = 0;
  let hardMode = false;
  let gyroEnabled = false;
  let gyroListenerAttached = false;

  const originalResetGame = resetGame;
  const originalStartGame = startGame;
  const originalPauseGame = pauseGame;
  const originalResumeGame = resumeGame;
  const originalGameOver = gameOver;
  const originalUpdate = update;

  // Fix the pause timer: paused time must not count toward the run.
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
    originalResetGame();
  }
  resetGame = resetGameFixed;

  // Preserve elapsed time when the game ends so saved scores retain their time.
  function gameOverFixed() {
    finalElapsed = secsFixed();
    updateTimer();
    originalGameOver();
  }
  gameOver = gameOverFixed;

  // Fix bullets: the original constructor turned vy=0 side shots into downward shots.
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

  // Restarting while already running must not create a second animation loop.
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
    pauseOverlay.classList.add('hidden');
    requestAnimationFrame(loop);
  }
  resumeGame = resumeGameFixed;

  // Apply the advertised +50% hard-mode score bonus without duplicating collision code.
  function updateFixed() {
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
    try {
      localStorage.setItem('infinityScores', JSON.stringify(all.slice(0, 10)));
    } catch {
      // Private browsing/storage-disabled environments should not crash the game.
    }
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
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') return;
      } catch {
        return;
      }
    }

    hardMode = !hardMode;
    if (hardMode && !gyroListenerAttached && 'DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', onOrientation, { passive: true });
      gyroListenerAttached = true;
    }
    gyroEnabled = hardMode && 'DeviceOrientationEvent' in window;
    $('gyroToggleBtn').textContent = gyroEnabled ? '🌀 Giroscopio (Hard Mode): ON' : '🌀 Hard Mode: ON';
    $('gyroLabel').classList.toggle('hidden', !gyroEnabled);
    showHardModeNotice();
  }

  function onOrientation(e) {
    if (!gyroEnabled || !running || paused || !player) return;
    const gamma = clamp(Number(e.gamma) || 0, -45, 45);
    const beta = clamp(Number(e.beta) || 45, 0, 90);
    targetX = cx + (gamma / 45) * Math.max(0, width / 2 - player.size);
    targetY = height * 0.55 + ((beta - 45) / 45) * Math.max(0, height * 0.35 - player.size);
  }

  // Mouse support was missing: desktop users can now control the ship too.
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') setTarget(e);
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') setTarget(e);
  });

  $('gyroToggleBtn').onclick = toggleGyro;
  $('saveScoreBtn').onclick = saveScoreFixed;
  $('restartFromGameOverBtn').onclick = startGameFixed;
  $('restartFromScoreboardBtn').onclick = startGameFixed;
  $('newGameBtn').onclick = startGameFixed;
  $('restartBtn').onclick = startGameFixed;
  $('restartFromPauseBtn').onclick = startGameFixed;
  $('pauseBtn').onclick = pauseGameFixed;
  $('resumeBtn').onclick = () => {
    settingsMenu.classList.add('hidden');
    resumeGameFixed();
  };
  $('resumeFromPauseBtn').onclick = resumeGameFixed;

  // The original Game Over close button had no handler and left the UI unusable.
  $('closeGameOverBtn').onclick = () => {
    gameOverMenu.classList.add('hidden');
    settingsBtn.style.display = 'none';
    startBtn.style.display = 'block';
  };

  // Closing settings while paused must reveal the pause overlay again.
  $('closeSettingsBtn').onclick = () => {
    settingsMenu.classList.add('hidden');
    if (paused) pauseOverlay.classList.remove('hidden');
  };

  // Keep the score timer accurate when the settings menu is opened during a pause.
  const originalSettingsClick = settingsBtn.onclick;
  settingsBtn.onclick = e => {
    if (originalSettingsClick) originalSettingsClick.call(settingsBtn, e);
    if (paused) pauseOverlay.classList.add('hidden');
  };
})();
