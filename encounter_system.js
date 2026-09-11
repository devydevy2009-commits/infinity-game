// ============================================================
// INFINITE — encounter architecture placeholder
// Copyright © 2026 Infinity Game. All rights reserved.
//
// Phase 2 preparation only: patterns and bosses are registered
// here but intentionally DISABLED. No gameplay is changed yet.
// ============================================================
(() => {
  'use strict';

  const encounters = {
    version: 1,
    enabled: false,
    patterns: [],
    bosses: [],
    registerPattern(definition) {
      if (!definition?.id) throw new Error('Pattern requires an id');
      this.patterns.push({
        id: definition.id,
        trigger: definition.trigger ?? null,
        duration: definition.duration ?? null,
        objective: definition.objective ?? 'survive',
        setup: definition.setup ?? null,
        active: false
      });
    },
    registerBoss(definition) {
      if (!definition?.id) throw new Error('Boss requires an id');
      this.bosses.push({
        id: definition.id,
        trigger: definition.trigger ?? null,
        phases: Array.isArray(definition.phases) ? definition.phases : [],
        active: false
      });
    },
    reset() {
      for (const item of this.patterns) item.active = false;
      for (const item of this.bosses) item.active = false;
    }
  };

  // Examples only: these are data contracts, not active encounters.
  encounters.registerPattern({ id: 'pattern-template', trigger: null, objective: 'survive', setup: null });
  encounters.registerBoss({ id: 'boss-template', trigger: null, phases: [] });
  encounters.reset();

  window.INFINITE_ENCOUNTERS = Object.freeze(encounters);

  // Player-facing release identity.
  document.title = 'INFINITE';
  const loadingTitle = document.querySelector('#loadingOverlay .loading-title');
  if (loadingTitle) loadingTitle.textContent = 'INFINITE';

  // Gentle early-game Ghost nerf: slightly lower their top speed when they first appear.
  const baseEnemyUpdate = Enemy.prototype.update;
  Enemy.prototype.update = function (frameFactor) {
    baseEnemyUpdate.call(this, frameFactor);
    if (this.kind !== 'ghost' || tier() >= 10) return;
    const maxSpeed = S(1.90 + Math.min(tier(), 8) * 0.08);
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > maxSpeed) {
      const ratio = maxSpeed / speed;
      this.vx *= ratio;
      this.vy *= ratio;
    }
  };

  // These phase-2 hooks are intentionally inert until pattern/boss gameplay is implemented.
  window.INFINITE_ENCOUNTER_HOOKS = Object.freeze({
    beforeEncounter() {},
    afterEncounter() {},
    onPatternComplete() {},
    onBossDefeated() {}
  });
})();
