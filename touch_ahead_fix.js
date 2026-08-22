// Touch-only presentation offset.
// game.js keeps the core input logic; this adjusts the final touch target
// by +2px so its existing 22px upward offset becomes an effective 20px.
(() => {
  'use strict';
  const originalUpdate = Player.prototype.update;
  Player.prototype.update = function (x, y) {
    if (typeof inputType !== 'undefined' && inputType === 'touch' && x !== undefined && y !== undefined) {
      return originalUpdate.call(this, x, y + S(2));
    }
    return originalUpdate.call(this, x, y);
  };
})();
