// INFINITY — lightweight enemy silhouette layer.
// Replaces only the requested silhouettes; gameplay logic remains untouched.
(() => {
  'use strict';

  const baseDraw = Enemy.prototype.draw;

  function healthBar(enemy) {
    if (tier() < 5 || enemy.kind === 'ghost') return;
    const max = enemy.maxHp || enemy.hp || 1;
    const ratio = clamp(enemy.hp / max, 0, 1);
    const w = enemy.size * 2.2;
    const h = S(3);
    const y = enemy.y - enemy.size - S(7);
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.fillRect(enemy.x - w / 2, y, w, h);
    ctx.fillStyle = kindColor(enemy.kind);
    ctx.fillRect(enemy.x - w / 2, y, w * ratio, h);
    ctx.restore();
  }

  function drawGhost(enemy) {
    const s = enemy.size;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(enemy.rot);
    ctx.strokeStyle = '#8b8b8b';
    ctx.lineWidth = S(2.4);
    ctx.globalAlpha = 0.78;
    // Broad flying-wing silhouette: a vague B-2-like reference.
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
    const advanced = tier() >= 10;
    ctx.globalAlpha = advanced ? 0.45 : 0.25;
    ctx.beginPath(); ctx.arc(0, 0, s * 1.42, 0, Math.PI * 2); ctx.stroke();
    if (advanced) {
      ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.moveTo(-s * 0.32, s * 0.10); ctx.lineTo(s * 0.32, s * 0.10); ctx.stroke();
    }
    ctx.restore();
  }

  function drawHunter(enemy) {
    const s = enemy.size;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(enemy.rot);
    ctx.strokeStyle = kindColor('hunter');
    ctx.lineWidth = S(2.2);
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.15);
    ctx.lineTo(s * 0.88, s * 0.45);
    ctx.lineTo(s * 0.58, s * 0.68);
    ctx.lineTo(0, s * 0.28);
    ctx.lineTo(-s * 0.58, s * 0.68);
    ctx.lineTo(-s * 0.88, s * 0.45);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.48, s * 0.18); ctx.lineTo(s * 0.48, s * 0.18); ctx.stroke();
    // Hollow squared boomerang/U tail.
    ctx.beginPath();
    ctx.moveTo(-s * 0.58, s * 0.50); ctx.lineTo(-s * 0.92, s * 0.88); ctx.lineTo(-s * 0.40, s * 0.76);
    ctx.moveTo(s * 0.58, s * 0.50); ctx.lineTo(s * 0.92, s * 0.88); ctx.lineTo(s * 0.40, s * 0.76);
    ctx.moveTo(-s * 0.40, s * 0.76); ctx.lineTo(s * 0.40, s * 0.76);
    ctx.stroke();
    ctx.restore();
    healthBar(enemy);
  }

  function drawDrone(enemy) {
    const s = enemy.size;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(enemy.rot);
    ctx.strokeStyle = kindColor('drone');
    ctx.lineWidth = S(2.2);
    // Short, chunky cigar/capsule silhouette.
    ctx.beginPath();
    ctx.moveTo(-s * 0.92, 0);
    ctx.quadraticCurveTo(-s * 0.68, -s * 0.58, 0, -s * 0.62);
    ctx.quadraticCurveTo(s * 0.68, -s * 0.58, s * 0.92, 0);
    ctx.quadraticCurveTo(s * 0.68, s * 0.58, 0, s * 0.62);
    ctx.quadraticCurveTo(-s * 0.68, s * 0.58, -s * 0.92, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.58, 0); ctx.lineTo(s * 0.58, 0);
    ctx.moveTo(-s * 0.22, -s * 0.34); ctx.lineTo(-s * 0.22, s * 0.34);
    ctx.moveTo(s * 0.22, -s * 0.34); ctx.lineTo(s * 0.22, s * 0.34);
    ctx.stroke();
    ctx.restore();
    healthBar(enemy);
  }

  Enemy.prototype.draw = function () {
    const now = Date.now();
    const flashing = now < this.hitUntil && Math.floor(now / 70) % 2 === 0;
    if (!flashing && this.kind === 'ghost') return drawGhost(this);
    if (!flashing && this.kind === 'hunter') return drawHunter(this);
    if (!flashing && this.kind === 'drone') return drawDrone(this);
    baseDraw.call(this);
  };
})();
