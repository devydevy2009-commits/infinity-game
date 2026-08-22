// Infinity gameplay v6 — FINAL AUTHORITATIVE WEAPON SYSTEM.
// This file is loaded LAST and therefore directly replaces the global shoot()
// binding. No older gameplay layer can capture the firing function after this.
// Gyroscope is intentionally NOT used for firing yet.
(() => {
  function layoutForPower() {
    const stage = Math.floor(Math.max(0, power) / 3);
    if (stage <= 0) return { front: 1, side: 0, rear: 0 };
    if (stage === 1) return { front: 2, side: 0, rear: 0 };
    if (stage === 2) return { front: 1, side: 2, rear: 0 };
    if (stage === 3) return { front: 1, side: 2, rear: 1 };
    if (stage === 4) return { front: 2, side: 2, rear: 1 };
    if (stage === 5) return { front: 2, side: 4, rear: 1 };
    if (stage === 6) return { front: 2, side: 4, rear: 2 };

    const extra = stage - 6;
    return {
      front: 2,
      side: 4 + Math.floor((extra + 1) / 2) * 2,
      rear: 2 + Math.floor(extra / 2)
    };
  }

  function slots() {
    const l = layoutForPower();
    const out = [];
    const frontGap = S(8);
    const sideGap = S(10);
    const rearGap = S(8);

    // FRONT: exactly (0,-1).
    for (let i = 0; i < l.front; i++) {
      out.push({
        x: (i - (l.front - 1) / 2) * frontGap,
        y: -S(16),
        dx: 0,
        dy: -1,
        role: 'front'
      });
    }

    // SIDES: exactly (-1,0) or (+1,0), never diagonal.
    for (let i = 0; i < l.side; i++) {
      const pair = Math.floor(i / 2);
      const side = i % 2 === 0 ? -1 : 1;
      out.push({
        x: side * (S(13) + pair * sideGap),
        y: 0,
        dx: side,
        dy: 0,
        role: 'side'
      });
    }

    // REAR: exactly (0,+1).
    for (let i = 0; i < l.rear; i++) {
      out.push({
        x: (i - (l.rear - 1) / 2) * rearGap,
        y: S(12),
        dx: 0,
        dy: 1,
        role: 'rear'
      });
    }
    return out;
  }

  function makeShot(s, damage, speed) {
    // Do NOT normalize into an angle. Preserve the exact axis vector.
    const vx = s.dx * speed;
    const vy = s.dy * speed;
    return {
      x: player.x + s.x,
      y: player.y + s.y,
      vx,
      vy,
      r: S(damage > 1 ? 4.6 : 3.4),
      life: 1000,
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
  }

  // IMPORTANT: overwrite the actual global binding used by game.js update().
  // This is the critical fix for the old gameplay_v3/finaltouch shoot overrides.
  shoot = function shootV6(now) {
    const index = Math.min(Math.max(power, 0), powerTable.length - 1);
    const p = powerTable[index];
    if (now - lastFire < p.cooldown) return;
    lastFire = now;

    const speed = S(p.speed);
    const damage = 1 + Math.floor(power / 8);

    for (const s of slots()) {
      bullets.push(makeShot(s, damage, speed));
    }
  };

  globalThis.shoot = shoot;
  globalThis.InfinityFire = shoot;
  globalThis.InfinityWeaponSlots = slots;
  globalThis.InfinityWeaponLayout = layoutForPower;
})();
