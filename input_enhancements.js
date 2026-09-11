(() => {
  'use strict';

  // game.js already maps Pointer Events for mouse, trackpad, pen and touch.
  // Add only the requested extra 5px touch lead without changing mouse/trackpad behavior.
  canvas.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' && typeof targetY === 'number') targetY -= S(5);
  });
  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch' && typeof targetY === 'number') targetY -= S(5);
  });

  // Prevent browser drag/selection gestures from competing with pointer-driven play.
  canvas.addEventListener('dragstart', event => event.preventDefault());
  canvas.addEventListener('contextmenu', event => event.preventDefault());
})();
