// Infinity gameplay v5 — progressive ship silhouette + weapon layout.
// Shape changes every 3 power levels. Milestones requested by design:
// 0: single front; 3: double front; 6: front + two 90° side guns;
// 9: add rear; 12: two front + sides + rear; 15: double side pairs;
// 18: double rear. After 18 the same three-stage cycle continues.
(() => {
  const getStage = () => Math.floor(power / 3);

  function layoutForPower() {
    const stage = getStage();
    if (stage <= 0) return { front: 1, side: 0, rear: 0 };
    if (stage === 1) return { front: 2, side: 0, rear: 0 };
    if (stage === 2) return { front: 1, side: 2, rear: 0 };
    if (stage === 3) return { front: 1, side: 2, rear: 1 };
    if (stage === 4) return { front: 2, side: 2, rear: 1 };
    if (stage === 5) return { front: 2, side: 4, rear: 1 };
    // From here every 3 levels expands one weapon group while preserving all others:
    // 21 front +1, 24 sides +2, 27 rear +1, 30 front +1, ...
    const extra = stage - 6;
    const front = 2 + Math.floor((extra + 2) / 3);
    const side = 4 + Math.floor((extra + 1) / 3) * 2;
    const rear = 2 + Math.floor(extra / 3);
    const phase = extra % 3;
    if (phase === 0) return { front, side: Math.max(4, side - 2), rear: Math.max(2, rear - 1) };
    if (phase === 1) return { front: Math.max(2, front - 1), side, rear: Math.max(2, rear - 1) };
    return { front: Math.max(2, front - 1), side: Math.max(4, side - 2), rear };
  }

  function makeWeaponDirections(layout) {
    const dirs = [];
    const frontSpread = 0.11;
    if (layout.front === 1) dirs.push({ x: 0, y: -1, role: 'front' });
    else {
      const gap = S(8);
      for (let i = 0; i < layout.front; i++) {
        const x = (i - (layout.front - 1) / 2) * gap;
        dirs.push({ x, y: -1, role: 'front' });
      }
    }

    for (let i = 0; i < layout.side; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const pairIndex = Math.floor(i / 2);
      const offset = S(9 + pairIndex * 9);
      // Exact 90-degree lateral barrels as requested.
      dirs.push({ x: side, y: 0, role: 'side', offset });
    }

    if (layout.rear > 0) {
      for (let i = 0; i < layout.rear; i++) {
        const x = (i - (layout.rear - 1) / 2) * S(8);
        dirs.push({ x, y: 1, role: 'rear' });
      }
    }
    return dirs;
  }

  function drawBarrel(x, y, dx, dy, length, widthPx) {
    const angle = Math.atan2(dy, dx) + Math.PI / 2;
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

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = flash ? '#ff3d3d' : '#fff';
    ctx.lineWidth = S(2.2);

    // Central hull becomes progressively more complex every 3 power levels.
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

    const dirs = makeWeaponDirections(layout);
    dirs.forEach(d => {
      let bx = 0, by = 0;
      if (d.role === 'front') bx = d.x;
      if (d.role === 'rear') { bx = d.x; by = size * 0.56; }
      if (d.role === 'side') { bx = d.x * (size * 0.72 + d.offset); by = size * 0.10; }
      const len = d.role === 'side' ? size * 0.64 : size * 0.58;
      drawBarrel(bx, by, d.x, d.y, len, S(2.0));
    });
    ctx.restore();
  };

  // The same layout drives projectile directions, so the visual silhouette and
  // actual fire positions always agree.
  shoot = function shootV5(now) {
    const p = powerTable[power];
    if (now - lastFire < p.cooldown) return;
    lastFire = now;
    const layout = layoutForPower();
    const dirs = makeWeaponDirections(layout);
    const damage = playerDamage();
    dirs.forEach(d => {
      let ox = 0, oy = 0;
      if (d.role === 'front') { ox = d.x; oy = -player.size * 0.75; }
      else if (d.role === 'rear') { ox = d.x; oy = player.size * 0.65; }
      else { ox = d.x * player.size * 0.85; oy = 0; }
      const vx = d.x;
      const vy = d.y;
      addShot(player.x + ox, player.y + oy, vx, vy, damage);
    });
  };
})();
