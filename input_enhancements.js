(() => {
  'use strict';

  // game.js already maps Pointer Events for mouse, trackpad, pen and touch.
  // Add exactly five CSS pixels of extra touch lead in canvas coordinates,
  // without changing mouse/trackpad behavior.
  function addTouchLead(event) {
    if (event.pointerType !== 'touch' || typeof targetY !== 'number') return;
    const rect = canvas.getBoundingClientRect();
    if (rect.height > 0) targetY -= 5 * height / rect.height;
  }

  canvas.addEventListener('pointermove', addTouchLead);
  canvas.addEventListener('pointerdown', addTouchLead);

  // Prevent browser drag/selection gestures from competing with pointer-driven play.
  canvas.addEventListener('dragstart', event => event.preventDefault());
  canvas.addEventListener('contextmenu', event => event.preventDefault());
})();
