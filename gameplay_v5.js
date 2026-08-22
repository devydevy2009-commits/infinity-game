// Infinity gameplay v5 — deterministic power-up weapon layout.
// The weapon geometry follows the requested progression exactly.
// Gyroscope is intentionally NOT used for firing yet: the ship may rotate,
// but the base weapon pattern remains fixed to the screen axes until gyro
// integration is revisited later.
(() => {
  const getStage = () => Math.floor(Math.max(0, power) / 3);

  function layoutForPower() {
    const stage = getStage();
    if (stage <= 0) return { front: 1, side: 0, rear: 0 };
    if (stage === 1) return { front: 2, side: 0, rear: 0 };
    if (stage === 2) return { front: 1, side: 2, rear: 0 };
    if (stage === 3) return { front: 1, side: 2, rear: 1 };
    if (stage === 4) return { front: 2, side: 2, rear: 1 };
    if (stage === 5) return { front: 2, side: 4, rear: 1 };
    if (stage === 6) return { front: 2, side: 4, rear: 2 };

    // 21+: continue expanding the lateral/rear battery.
    const extra = stage - 6;
    return {
      front: 2,
      side: 4 + Math.floor((extra + 1) / 2) * 2,
      rear: 2 + Math.floor(extra / 2)
    };
  }

  function weaponSlots(layout) {
    const slots = [];
    const frontGap = S(8);
    const sideGap = S(10);
    const rearGap = S(8);

    // Front: all shots are EXACTLY vertical, parallel to the nose.
    for (let i = 0; i < layout.front; i++) {
      slots.push({
        x: (i - (layout.front - 1) / 2) * frontGap,
        y: -S(0.72 * 16),
        dx: 0,
        dy: -1,
        role: 'front'
      });
    }

    // Side: exactly 90 degrees to the front axis.
    // Alternate left/right so every pair is symmetric.
    for (let i = 0; i < layout.side; i++) {
      const pair = Math.floor(i / 2);
      const left = i % 2 === 0;
      slots.push({
        x: (left ? -1 : 1) * (S(0.72 * 16) + pair * sideGap),
        y: S(1.0),
        dx: left ? -1 : 1,
        dy: 0,
        role: 'side'
      });
    }

    // Rear: exactly opposite the front axis.
    for (let i = 0; i < layout.rear; i++) {
      slots.push({
        x: (i - (layout.rear - 1) / 2) * rearGap,
        y: S(0.65 * 16),
        dx: 0,
        dy: 1,
        role: 'rear'
      });
    }
    return slots;
  }

  function drawBarrel(x, y, dx, dy, length, widthPx) {
    const angle = Math.atan2(dx, -dy);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = widthPx;
    ctx.beginPath();
    ctx.moveTo(0, -length * 0.48);
    ctx.lineTo(0, length * 0.48);
    ctx.stroke();
    ctx.restore();
  }

  Player.prototype.draw = function drawV5() {
    const flash = Date.now() < invulnerableUntil && Math.floor(Date.now() / 70) % 2 === 0;
    const layout = layoutForPower();
    const guns = layout.front + layout.side + layout.rear;
    const complexity = Math.min(1.55, 1 + Math.max(0, guns - 1) * 0.065);
    const size = this.size * complexity;
    const angle = Number.isFinite(this.angle) ? this.angle : 0;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);
    ctx.strokeStyle = flash ? '#ff3d3d' : '#fff';
    ctx.lineWidth = S(2.2);

    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(-size * 0.48, size * 0.30);
    ctx.lineTo(-size * 0.78, size * 0.70);
    ctx.lineTo(0, size * 0.52);
    ctx.lineTo(size * 0.78, size * 0.70);
    ctx.lineTo(size * 0.48, size * 0.30);
    ctx.closePath();
    ctx.stroke();

    if (guns >= 3) {
      ctx.beginPath();
      ctx.moveTo(-size * 0.50, size * 0.15);
      ctx.lineTo(-size * 1.05, size * 0.62);
      ctx.lineTo(-size * 0.45, size * 0.50);
      ctx.moveTo(size * 0.50, size * 0.15);
      ctx.lineTo(size * 1.05, size * 0.62);
      ctx.lineTo(size * 0.45, size * 0.50);
      ctx.stroke();
    }
    if (guns >= 4) {
      ctx.beginPath();
      ctx.moveTo(-size * 0.28, size * 0.48);
      ctx.lineTo(0, size * 1.08);
      ctx.lineTo(size * 0.28, size * 0.48);
      ctx.stroke();
    }
    if (guns >= 6) {
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.72, Math.PI * 0.12, Math.PI * 0.88);
      ctx.stroke();
    }

    // Draw the weapon pattern from the same slots used for firing.
    weaponSlots(layout).forEach(s => {
      drawBarrel(s.x, s.y, s.dx, s.dy, s.role === 'side' ? size * 0.64 : size * 0.58, S(2));
    });
    ctx.restore();
  };

  // IMPORTANT: bypass the old Bullet constructor because it converted
  // vy === 0 into a positive vertical speed. That was the source of the
  // incorrect side-shot orientation.
  addShot = function addShotV5(x, y, vx, vy, damage) {
    const speed = S(powerTable[Math.min(power, powerTable.length - 1)].speed);
    const length = Math.hypot(vx, vy) || 1;
    const nx = vx / length;
    const ny = vy / length;
    const bullet = {
      x,
      y,
      vx: nx * speed,
      vy: ny * speed,
      r: S(damage > 1 ? 4.6 : 3.4),
      life: Math.ceil((Math.hypot(width, height) + Math.max(width, height)) / speed) + 30,
      damage,
      update(f) {
        this.x += this.vx * f;
        this.y += this.vy * f;
        this.life--;
      },
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      },
      b() { return { x: this.x, y: this.y, r: this.r }; }
    };
    bullets.push(bullet);
  };

  // Fire only the exact directions specified by the progression schema.
  // No spread, no angle offsets, no gyro transformation.
  shoot = function shootV5(now) {
    const p = powerTable[Math.min(power, powerTable.length - 1)];
    if (now - lastFire < p.cooldown) return;
    lastFire = now;

    const layout = layoutForPower();
    const slots = weaponSlots(layout);
    const damage = 1 + Math.floor(power / 8);

    slots.forEach(s => {
      addShot(
        player.x + s.x,
        player.y + s.y,
        s.dx,
        s.dy,
        damage
      );
    });
  };
})();
