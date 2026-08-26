(() => {
  'use strict';

  class LifeReward {
    constructor() {
      this.isLifeReward = true;
      this.x = width / 2;
      this.y = -S(42);
      this.size = S(30);
      this.vy = S(1);
      this.vx = 0;
      this.hp = 8;
      this.maxHp = 8;
      this.phase = 0;
      this.rot = 0;
    }

    update(f) {
      this.phase += 0.045 * f;
      this.y += this.vy * f;
      this.rot += 0.012 * f;
      if (this.y > height * 0.78) this.vy = 0;
    }

    draw() {
      const s = this.size * (1 + Math.sin(this.phase) * 0.05);
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.shadowColor = '#39ff72';
      ctx.shadowBlur = S(18);
      ctx.strokeStyle = '#39ff72';
      ctx.fillStyle = 'rgba(40,255,100,.12)';
      ctx.lineWidth = S(3.2);

      ctx.beginPath();
      ctx.moveTo(0, -s * 1.05);
      ctx.lineTo(s * 0.82, -s * 0.45);
      ctx.lineTo(s * 0.82, s * 0.42);
      ctx.lineTo(0, s * 1.05);
      ctx.lineTo(-s * 0.82, s * 0.42);
      ctx.lineTo(-s * 0.82, -s * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-s * 0.42, 0);
      ctx.lineTo(s * 0.42, 0);
      ctx.moveTo(0, -s * 0.42);
      ctx.lineTo(0, s * 0.42);
      ctx.stroke();
      ctx.restore();

      const ratio = clamp(this.hp / this.maxHp, 0, 1);
      const barW = this.size * 2.2;
      const barY = this.y + this.size + S(7);
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.fillRect(this.x - barW / 2, barY, barW, S(4));
      ctx.fillStyle = '#39ff72';
      ctx.fillRect(this.x - barW / 2, barY, barW * ratio, S(4));
    }

    b() {
      return { x: this.x, y: this.y, r: this.size * 1.02 };
    }
  }

  window.spawnLifeReward = () => {
    if (typeof powerups === 'undefined' || powerups.some(p => p.isLifeReward)) return false;
    powerups.push(new LifeReward());
    return true;
  };

  // Extend collisions only. Do not wrap resetGame: game.js calls resetGame()
  // through the global binding, and wrapping it here would access powerups
  // before game.js has initialized that let binding.
  const baseCollisions = collisions;
  collisions = function () {
    const rewards = powerups.filter(p => p.isLifeReward);
    powerups = powerups.filter(p => !p.isLifeReward);

    for (const reward of rewards) {
      for (let j = bullets.length - 1; j >= 0; j--) {
        if (!overlap(reward.b(), bullets[j].b())) continue;
        bullets.splice(j, 1);
        reward.hp--;
        burst(reward.x, reward.y, '#39ff72', 3);

        if (reward.hp <= 0) {
          reward.destroyed = true;
          burst(reward.x, reward.y, '#39ff72', 30);
          lives++;
          livesEl.textContent = 'Lives: ' + lives;
          score += 500;
          scoreEl.textContent = 'Score: ' + score;
          break;
        }
      }
    }

    powerups.push(...rewards.filter(reward => !reward.destroyed));
    baseCollisions();
  };

  let hunterRewardArmed = false;
  let hunterRewardDropped = false;

  setInterval(() => {
    const state = window.INFINITE_TUTORIAL_STATE;
    if (!state) return;

    if (state.index === 0 && !state.activeType) {
      hunterRewardArmed = false;
      hunterRewardDropped = false;
    }

    if (state.activeType === 'hunter') hunterRewardArmed = true;

    if (hunterRewardArmed && !hunterRewardDropped && state.index >= 4 && !state.activeType) {
      hunterRewardDropped = !!window.spawnLifeReward();
    }
  }, 100);
})();