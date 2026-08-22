// Final gameplay polish: gyro-oriented player ship and evolving hull.
// Player firing is intentionally owned only by gameplay_v6.js.
(() => {
  let collectedPowerups = 0;
  let lastPowerLevel = 0;
  const originalReset = resetGame;
  const originalUpdate = update;

  resetGame = function resetGameWithShipEvolutionReset() {
    collectedPowerups = 0;
    lastPowerLevel = 0;
    originalReset();
    if (player) player.angle = 0;
  };

  update = function updateWithPowerupCounter() {
    const before = power;
    originalUpdate();
    if (power > before) collectedPowerups += power - before;
    lastPowerLevel = power;
  };

  function shipStage() {
    return Math.floor(collectedPowerups / 5);
  }

  Player.prototype.draw = function drawEvolvingOrientedPlayer() {
    const flash = Date.now() < invulnerableUntil && Math.floor(Date.now() / 70) % 2 === 0;
    const angle = Number.isFinite(this.angle) ? this.angle : 0;
    const stage = shipStage();
    const size = S(16) * (1 + Math.min(stage, 8) * 0.055);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);
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
    ctx.restore();
  };
})();
