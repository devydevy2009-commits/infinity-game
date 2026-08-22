// Infinity gameplay v2: deterministic pacing, safer lower third, powerup risk window,
// and death snapshot / "Take a picture" mode.
(() => {
  const SAFE_BOTTOM_START = 0.68;
  const SAFE_BOTTOM_FORCE = 0.085;
  const POWERUP_DIFFICULTY = 2;
  const POWERUP_INTERVAL = 22000;
  const WAVE_INTERVAL = 10500;
  const NORMAL_SPAWN_INTERVAL = 1150;
  const SCORE_VARIANCE_REDUCTION = 0.65;

  let nextPowerupAt = 0;
  let nextEnemyAt = 0;
  let nextWaveAt = 0;
  let powerupPressure = false;
  let deathSnapshot = null;

  const originalReset = resetGame;
  const originalUpdate = update;
  const originalDamage = damage;

  function elapsedMs() {
    return startTime ? Math.max(0, Date.now() - startTime) : 0;
  }

  function deterministicEnemyKind(t) {
    if (t >= 5) return ['basic', 'basic', 'shooter', 'armored'][Math.floor(elapsedMs() / NORMAL_SPAWN_INTERVAL) % 4];
    if (t >= 1) return ['basic', 'basic', 'shooter'][Math.floor(elapsedMs() / NORMAL_SPAWN_INTERVAL) % 3];
    return 'basic';
  }

  function spawnDeterministicPowerup() {
    const p = new Powerup();
    p._gameplayV2 = true;
    p.size = S(25);
    const lane = Math.floor(elapsedMs() / POWERUP_INTERVAL) % 5;
    p.x = width * (0.20 + lane * 0.15);
    p.y = -S(28);
    p.vy = S(1.25 + Math.min(tier(), 12) * 0.035);
    p.vx = lane % 2 === 0 ? S(0.22) : -S(0.22);
    p.rot = 0;
    p.phase = lane * 0.9;
    p.update = function(f) {
      this.phase += 0.035 * f;
      this.x += this.vx * f;
      this.y += this.vy * f;
      if (this.x < this.size || this.x > width - this.size) this.vx *= -1;
      this.rot += 0.03 * f;
    };
    p.draw = function() {
      const pulse = 1 + Math.sin(this.phase) * 0.08;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.scale(pulse, pulse);
      ctx.strokeStyle = '#69c4ff';
      ctx.lineWidth = S(3.5);
      ctx.strokeRect(-this.size / 2, -this.size / 2, this.size, this.size);
      ctx.beginPath();
      ctx.moveTo(-this.size * 0.25, 0); ctx.lineTo(this.size * 0.25, 0);
      ctx.moveTo(0, -this.size * 0.25); ctx.lineTo(0, this.size * 0.25);
      ctx.stroke();
      ctx.restore();
    };
    p.b = function() { return { x: this.x, y: this.y, r: this.size * 0.70 }; };
    powerups.push(p);
  }

  function spawnDeterministic() {
    if (!running || paused) return;
    const now = Date.now();
    const t = tier();
    const cap = 7 + Math.min(t, 9) * 2;

    if (!nextEnemyAt) nextEnemyAt = now + 700;
    if (now >= nextEnemyAt && enemies.length < cap) {
      const e = new Enemy(deterministicEnemyKind(t));
      const slot = Math.floor(elapsedMs() / NORMAL_SPAWN_INTERVAL) % 5;
      const laneX = [0.16, 0.34, 0.50, 0.66, 0.84][slot] * width;
      e.x = laneX;
      e.y = -S(32);
      const angle = Math.atan2(height * 0.53 - e.y, cx - e.x);
      const mult = 1 + t * 0.16;
      const speed = S((1.28 + (slot % 2) * 0.08) * mult);
      e.vx = Math.cos(angle) * speed;
      e.vy = Math.sin(angle) * speed;
      enemies.push(e);
      nextEnemyAt += NORMAL_SPAWN_INTERVAL;
    }

    if (!nextWaveAt) nextWaveAt = now + WAVE_INTERVAL;
    if (now >= nextWaveAt && enemies.length < cap + 4) {
      const center = [0.25, 0.50, 0.75][Math.floor(elapsedMs() / WAVE_INTERVAL) % 3] * width;
      const count = 3 + Math.min(4, Math.floor(t / 3));
      for (let i = 0; i < count && enemies.length < cap + 4; i++) {
        const e = new Enemy(deterministicEnemyKind(t));
        e.x = center + (i - (count - 1) / 2) * S(46);
        e.y = -S(38) - i * S(36);
        const angle = Math.atan2(height * 0.54 - e.y, cx - e.x);
        const speed = S((1.32 + (i % 2) * 0.07) * (1 + t * 0.16));
        e.vx = Math.cos(angle) * speed;
        e.vy = Math.sin(angle) * speed;
        enemies.push(e);
      }
      nextWaveAt += WAVE_INTERVAL;
    }

    if (!nextPowerupAt) nextPowerupAt = now + 14000;
    if (now >= nextPowerupAt && powerups.length === 0) {
      spawnDeterministicPowerup();
      powerupPressure = true;
      nextPowerupAt += POWERUP_INTERVAL;
    }
  }

  resetGame = function resetGameV2() {
    originalReset();
    nextPowerupAt = 0;
    nextEnemyAt = 0;
    nextWaveAt = 0;
    powerupPressure = false;
    deathSnapshot = null;
  };

  spawn = spawnDeterministic;

  function applyBottomSafeZone() {
    for (const e of enemies) {
      if (!e) continue;
      if (e.y > height * SAFE_BOTTOM_START) {
        e.vy -= S(SAFE_BOTTOM_FORCE);
        e.vy *= 0.992;
      }
    }
  }

  function applyPowerupPressure() {
    if (!powerupPressure || powerups.length === 0) return false;
    for (const e of enemies) {
      if (!e) continue;
      e.vx *= POWERUP_DIFFICULTY;
      e.vy *= POWERUP_DIFFICULTY;
    }
    for (const b of enemyBullets) {
      if (!b) continue;
      b.vx *= POWERUP_DIFFICULTY;
      b.vy *= POWERUP_DIFFICULTY;
    }
    return true;
  }

  function restorePowerupPressure() {
    if (!powerupPressure) return;
    for (const e of enemies) {
      if (!e) continue;
      e.vx /= POWERUP_DIFFICULTY;
      e.vy /= POWERUP_DIFFICULTY;
    }
    for (const b of enemyBullets) {
      if (!b) continue;
      b.vx /= POWERUP_DIFFICULTY;
      b.vy /= POWERUP_DIFFICULTY;
    }
  }

  update = function updateV2() {
    const pressured = applyPowerupPressure();
    applyBottomSafeZone();
    const scoreBefore = score;
    originalUpdate();
    if (pressured) restorePowerupPressure();
    if (powerups.length === 0) powerupPressure = false;

    const delta = score - scoreBefore;
    if (delta > 0 && Number.isFinite(delta)) {
      score = scoreBefore + Math.max(1, Math.round(delta * SCORE_VARIANCE_REDUCTION));
      scoreEl.textContent = 'Score: ' + score;
    }
  };

  damage = function damageWithSnapshot() {
    const wasLastLife = lives <= 1;
    if (wasLastLife && running && canvas) {
      try {
        deathSnapshot = {
          image: canvas.toDataURL('image/png'),
          score,
          time: timerEl.textContent.replace('Time: ', ''),
          date: Date.now()
        };
      } catch {}
    }
    originalDamage();
    if (wasLastLife) showDeathSnapshotButton();
  };

  function ensureDeathSnapshotUi() {
    if (!$('infinityV2Styles')) {
      const style = document.createElement('style');
      style.id = 'infinityV2Styles';
      style.textContent = `
        #takePictureBtn { margin-top: 6px; }
        #deathSnapshotOverlay { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 18px; background: rgba(0,0,0,.88); }
        #deathSnapshotOverlay.hidden { display: none; }
        .death-shot-card { position: relative; width: min(92vw, 520px); max-height: 92vh; overflow: auto; background: #090909; border: 1px solid rgba(255,255,255,.18); border-radius: 14px; padding: 14px; box-sizing: border-box; }
        .death-shot-title { font-size: 12px; letter-spacing: .18em; opacity: .72; margin: 2px 42px 10px 2px; }
        #deathShotImage { display: block; width: 100%; max-height: 72vh; object-fit: contain; border-radius: 8px; background: #000; }
        .death-shot-stats { margin-top: 10px; font-size: 15px; text-align: center; opacity: .9; }
        .death-shot-close { position: absolute; top: 5px; right: 7px; width: 30px; height: 30px; border: 0; background: transparent; color: rgba(255,255,255,.45); font-size: 24px; line-height: 30px; padding: 0; }
        .death-shot-close:active { color: rgba(255,255,255,.8); }
      `;
      document.head.appendChild(style);
    }
    if ($('takePictureBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'takePictureBtn';
    btn.type = 'button';
    btn.textContent = 'Take a picture';
    btn.className = 'menu-secondary';
    btn.onclick = showDeathSnapshot;
    const close = $('closeGameOverBtn');
    if (close && close.parentNode) close.parentNode.insertBefore(btn, close);

    const overlay = document.createElement('div');
    overlay.id = 'deathSnapshotOverlay';
    overlay.className = 'hidden';
    overlay.innerHTML = `
      <div class="death-shot-card">
        <button id="deathShotClose" class="death-shot-close" type="button" aria-label="Chiudi">×</button>
        <div class="death-shot-title">MOMENTO DEL KO</div>
        <img id="deathShotImage" alt="Screenshot del momento in cui sei stato colpito" />
        <div id="deathShotStats" class="death-shot-stats"></div>
      </div>`;
    document.body.appendChild(overlay);
    $('deathShotClose').onclick = () => overlay.classList.add('hidden');
  }

  function showDeathSnapshotButton() {
    ensureDeathSnapshotUi();
    const btn = $('takePictureBtn');
    if (btn) btn.classList.toggle('hidden', !deathSnapshot);
  }

  function showDeathSnapshot() {
    if (!deathSnapshot) return;
    ensureDeathSnapshotUi();
    $('deathShotImage').src = deathSnapshot.image;
    $('deathShotStats').textContent = `Score ${deathSnapshot.score} · Time ${deathSnapshot.time}`;
    $('deathSnapshotOverlay').classList.remove('hidden');
  }

  ensureDeathSnapshotUi();
})();
