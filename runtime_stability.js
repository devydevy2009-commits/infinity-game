// INFINITY — runtime stability and multi-touch input isolation.
(() => {
  'use strict';

  const LOGIC_STEP_MS = 1000 / 60;
  const MAX_FRAME_GAP_MS = 75;
  const MAX_LOGIC_STEPS = 4;

  let lastFrameAt = 0;
  let accumulator = 0;
  let primaryTouchId = null;

  const stableLoop = now => {
    if (!running) {
      lastFrameAt = 0;
      accumulator = 0;
      return;
    }

    if (!lastFrameAt) lastFrameAt = now;
    const frameDelta = Math.min(MAX_FRAME_GAP_MS, Math.max(0, now - lastFrameAt));
    lastFrameAt = now;

    if (paused) {
      accumulator = 0;
    } else {
      accumulator += frameDelta;
      let steps = 0;

      while (accumulator >= LOGIC_STEP_MS && steps < MAX_LOGIC_STEPS) {
        window.update();
        accumulator -= LOGIC_STEP_MS;
        steps++;
      }

      if (steps === MAX_LOGIC_STEPS && accumulator >= LOGIC_STEP_MS) accumulator = 0;
    }

    draw();
    requestAnimationFrame(stableLoop);
  };

  window.loop = stableLoop;

  const baseSetTarget = window.setTarget;
  if (typeof baseSetTarget === 'function') {
    window.setTarget = event => {
      if (event.pointerType === 'touch' && primaryTouchId !== null && event.pointerId !== primaryTouchId) return;
      baseSetTarget(event);
    };
  }

  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' || primaryTouchId !== null) return;
    primaryTouchId = event.pointerId;
    try { canvas.setPointerCapture(event.pointerId); } catch {}
  }, { capture: true });

  const releasePrimaryTouch = event => {
    if (event.pointerType !== 'touch' || event.pointerId !== primaryTouchId) return;
    try { canvas.releasePointerCapture(event.pointerId); } catch {}
    primaryTouchId = null;
  };

  canvas.addEventListener('pointerup', releasePrimaryTouch, { capture: true });
  canvas.addEventListener('pointercancel', releasePrimaryTouch, { capture: true });
  window.addEventListener('blur', () => {
    primaryTouchId = null;
    lastFrameAt = 0;
    accumulator = 0;
  });
})();
