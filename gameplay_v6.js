// Infinity gameplay v6 — FINAL AUTHORITATIVE WEAPON SYSTEM.
// This file is the only owner of player firing and weapon geometry.
// Gyroscope is intentionally not used for firing yet.
(() => {
  function layoutForPower() {
    const stage = Math.floor(Math.max(0, power) / 3);

    // Coherent progression:
    // P0  = 1 front
    // P3  = 2 front
    // P6  = 2 front + 2 sides
    // P9  = 2 front + 2 sides + 2 rear
    // P12 = 3 front + 2 sides + 2 rear
    // P15 = 3 front + 3 sides + 2 rear
    // P18 = 3 front + 3 sides + 3 rear
    // P21 = 4 front + 3 sides + 3 rear ...
    const levelInCycle = stage % 3;
    const cycle = Math.floor(stage / 3);

    return {
      front: 1 + cycle + (levelInCycle >= 1 ? 1 : 0),
      side: (cycle > 0 ? cycle : 0) + (levelInCycle >= 2 ? 1 : 0),
      rear: cycle
    };
  }

  function slots() {
    const l = layoutForPower();
    const out = [];
    const frontGap = S(8);
    const sideGap = S(10);
    const rearGap = S(8);

    for (let i = 0; i < l.front; i++) {
      out.push({
        x: (i - (l.front - 1) / 2) * frontGap,
        y: -S(16),
        dx: 0,
        dy: -1,
        role: 'front'
      });
    }

    // Keep left/right symmetry: a side count > 1 is distributed alternately.
    for (let i = 0; i < l.side; i++) {
      const centerIndex = (l.side - 1) / 2;
      const lateralIndex = i - centerIndex;
      const side = lateralIndex === 0 ? (i % 2 === 0 ? -1 : 1) : Math.sign(lateralIndex);
      const distance = S(13) + Math.abs(lateralIndex) * sideGap;
      out.push({
        x: side * distance,
        y: 0,
        dx: side,
        dy: 0,
        role: 'side'
      });
    }

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

  function makeShot(slot, damage, speed) {
    return {
      x: player.x + slot.x,
      y: player.y + slot.y,
      vx: slot.dx * speed,
      vy: slot.dy * speed,
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

  shoot = function shootV6(now) {
    const index = Math.min(Math.max(power, 0), powerTable.length - 1);
    const p = powerTable[index];
    if (now - lastFire < p.cooldown) return;
    lastFire = now;

    const speed = S(p.speed);
    const damage = 1 + Math.floor(power / 8);
    for (const slot of slots()) {
      bullets.push(makeShot(slot, damage, speed));
    }
  };

  globalThis.shoot = shoot;
  globalThis.InfinityFire = shoot;
  globalThis.InfinityWeaponSlots = slots;
  globalThis.InfinityWeaponLayout = layoutForPower;
})();
