// Infinity gameplay v5 — progressive ship silhouette + weapon layout.
// Shape changes every 3 power levels. Milestones:
// 0: single front; 3: double front; 6: front + two 90° side guns;
// 9: add rear; 12: two front + sides + rear; 15: double side pairs;
// 18: double rear. After 18 the same three-stage expansion continues.
//
// IMPORTANT: all weapon directions are defined in the ship's LOCAL frame.
// The player's nose is always local (0,-1). Gyro rotation is then applied
// once to both the drawing and projectile vectors, so the visual weapon
// direction and the real firing direction cannot diverge.
(() => {
  const getStage = () => Math.floor(power / 3);

  function layoutForPower() {
    const stage = getStage();
    if (stage <= 0) return { front: 1, side: 0, rear: 0 };
    if (stage === 1) return { front: 2, side: 0, rear: 0 };
    // Power 6: exactly one nose gun + two lateral guns at +/-90°.
    if (stage === 2) return { front: 1, side: 2, rear: 0 };
    if (stage === 3) return { front: 1, side: 2, rear: 1 };
    if (stage === 4) return { front: 2, side: 2, rear: 1 };
    if (stage === 5) return { front: 2, side: 4, rear: 1 };

    // 21: +1 front, 24: +2 lateral, 27: +1 rear, then repeat.
    const extra = stage - 6;
    const cycle = Math.floor(extra / 3);
    const phase = extra % 3;
    return {
      front: 2 + cycle + (phase >= 0 ? 1 : 0),
      side: 4 + cycle * 2 + (phase >= 1 ? 2 : 0),
      rear: 2 + cycle + (phase >= 2 ? 1 : 0)
    };
  }

  function makeWeaponDirections(layout) {
    const dirs = [];

    // Front guns are parallel to the ship nose: exactly (0,-1).
    if (layout.front === 1) {
      dirs.push({ x: 0, y: -1, role: 'front', barrelX: 0 });
    } else {
      const gap = S(8);
      for (let i = 0; i < layout.front; i++) {
        const barrelX = (i - (layout.front - 1) / 2) * gap;
        dirs.push({ x: 0, y: -1, role: 'front', barrelX });
      }
    }

    // Side guns are mathematically perpendicular to the nose: (±1,0).
    for (let i = 0; i < layout.side; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const pairIndex = Math.floor(i / 2);
      const offset = S(9 + pairIndex * 9);
      dirs.push({ x: side, y: 0, role: 'side', offset });
    }

    // Rear guns are exactly opposite the nose: (0,1).
    for (let i = 0; i < layout.rear; i++) {
      const barrelX = (i - (layout.rear - 1) / 2) * S(8);
      dirs.push({ x: 0, y: 1, role: 'rear', barrelX });
    }
    return dirs;
  }

  function drawBarrel(x, y, dx, dy, length, widthPx) {
    // The barrel is drawn along the supplied local direction.
    // A vertical source line points along local +Y; rotating by atan2(dx,-dy)
    // maps it to the requested direction without introducing an extra offset.
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

  // Rotate a vector from ship-local coordinates into canvas/world coordinates.
  // Canvas +angle is clockwise in screen coordinates, matching the gyro angle.
  function toWorld(x, y, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return { x: x * c - y * s, y: x * s + y * c };
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
    // The nose remains the single authoritative orientation reference.
    ctx.rotate(angle);
    ctx.strokeStyle = flash ? '#ff3d3d' : '#fff';
    ctx.lineWidth = S(2.2);

    // Hull becomes visibly more complex at every 3-power milestone.
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

    makeWeaponDirections(layout).forEach(d => {
      let bx = 0, by = 0;
      if (d.role === 'front') {
        bx = d.barrelX || 0;
        by = -size * 0.56;
      } else if (d.role === 'rear') {
        bx = d.barrelX || 0;
        by = size * 0.56;
      } else {
        bx = d.x * (size * 0.72 + d.offset);
        by = size * 0.10;
      }
      const len = d.role === 'side' ? size * 0.64 : size * 0.58;
      drawBarrel(bx, by, d.x, d.y, len, S(2.0));
    });
    ctx.restore();
  };

  // Visual layout and actual firing layout are identical.
  // Every local direction and offset is rotated by the SAME ship angle.
  shoot = function shootV5(now) {
    const p = powerTable[power];
    if (now - lastFire < p.cooldown) return;
    lastFire = now;

    const layout = layoutForPower();
    const dirs = makeWeaponDirections(layout);
    const damage = playerDamage();
    const angle = Number.isFinite(player.angle) ? player.angle : 0;

    dirs.forEach(d => {
      let ox = 0, oy = 0;
      if (d.role === 'front') {
        ox = d.barrelX || 0;
        oy = -player.size * 0.72;
      } else if (d.role === 'rear') {
        ox = d.barrelX || 0;
        oy = player.size * 0.65;
      } else {
        ox = d.x * player.size * 0.85;
        oy = player.size * 0.10;
      }

      const offset = toWorld(ox, oy, angle);
      const direction = toWorld(d.x, d.y, angle);
      addShot(
        player.x + offset.x,
        player.y + offset.y,
        direction.x,
        direction.y,
        damage
      );
    });
  };
})();
