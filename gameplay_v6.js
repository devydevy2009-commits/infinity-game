// Infinity gameplay v6 — FINAL AUTHORITATIVE WEAPON SYSTEM.
(() => {
  function layoutForPower() {
    const stage = Math.floor(Math.max(0, power) / 3);
    const cycle = Math.floor(stage / 3);
    const phase = stage % 3;
    return { front: 1 + cycle + (phase >= 1 ? 1 : 0), side: 2 * cycle + (phase >= 2 ? 2 : 0), rear: 2 * cycle };
  }
  function sideSlots(count) {
    const out = [], pairs = Math.floor(count / 2), gap = S(10), yGap = S(8);
    for (let i = 0; i < pairs; i++) {
      const y = (i - (pairs - 1) / 2) * yGap;
      out.push({ x: -(S(13) + i * gap), y, dx: -1, dy: 0, role: 'side' });
      out.push({ x: S(13) + i * gap, y, dx: 1, dy: 0, role: 'side' });
    }
    return out;
  }
  function slots() {
    const l = layoutForPower(), out = [], frontGap = S(8), rearGap = S(8);
    for (let i = 0; i < l.front; i++) out.push({ x: (i - (l.front - 1) / 2) * frontGap, y: -S(16), dx: 0, dy: -1, role: 'front' });
    out.push(...sideSlots(l.side));
    for (let i = 0; i < l.rear; i++) out.push({ x: (i - (l.rear - 1) / 2) * rearGap, y: S(12), dx: 0, dy: 1, role: 'rear' });
    return out;
  }
  shoot = function shootV6(now) {
    const p = powerTable[Math.min(Math.max(power, 0), powerTable.length - 1)];
    if (now - lastFire < p.cooldown) return;
    lastFire = now;
    const speed = S(p.speed), damage = 1 + Math.floor(power / 8);
    for (const s of slots()) bullets.push({ x: player.x + s.x, y: player.y + s.y, vx: s.dx * speed, vy: s.dy * speed, r: S(damage > 1 ? 4.6 : 3.4), life: 1000, damage, update(f){this.x += this.vx*f;this.y += this.vy*f;this.life--;}, draw(){ctx.beginPath();ctx.arc(this.x,this.y,this.r,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();}, b(){return {x:this.x,y:this.y,r:this.r};} });
  };
  globalThis.shoot = shoot;
  globalThis.InfinityFire = shoot;
  globalThis.InfinityWeaponSlots = slots;
  globalThis.InfinityWeaponLayout = layoutForPower;
})();
