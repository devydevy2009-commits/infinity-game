// INFINITY — preview-only "Boss 2 test" menu entry.
// Adds a button to the main menu that starts a run directly at the second boss
// ("Raptor Hunter") with Power 9, to speed up iterating on that fight.
//
// This file is a strict no-op in production: if window.INFINITE_PREVIEW_BUILD
// (set by preview_env.js) is not true, it does nothing and adds nothing to the DOM.
(() => {
  'use strict';

  if (!window.INFINITE_PREVIEW_BUILD) return;

  const BUTTON_ID = 'previewBoss2TestBtn';
  // startGame() runs an async multi-step loading sequence before `running` flips
  // to true, and its length can change over time. A fixed setTimeout guessed that
  // duration and silently failed once the sequence grew longer than the guess
  // (startSoloBoss() bails out via its `!running` guard). We poll the real
  // `running` flag on every frame instead, so this keeps working regardless of
  // how long the loading sequence takes.
  const MAX_WAIT_FRAMES = 600; // ~10s at 60fps, generous safety cap

  function injectMenuButton() {
    const menuContent = document.querySelector('#settingsMenu .menu-content');
    const anchor = document.getElementById('closeSettingsBtn');
    if (!menuContent || !anchor || document.getElementById(BUTTON_ID)) return;

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.textContent = '🧪 Test mode: Boss 2';
    button.title = 'Preview only — starts a run at Boss 2 with Power 9';
    button.style.cssText = 'margin-top:10px;border:1px dashed #ffb347;color:#ffb347;background:transparent;';
    button.addEventListener('click', startBoss2TestRun);

    menuContent.insertBefore(button, anchor);
  }

  function waitForRunningThenStart(test, framesLeft) {
    if (typeof running !== 'undefined' && running) {
      test.start();
      return;
    }
    if (framesLeft <= 0) {
      console.warn('[preview_test_mode] Timed out waiting for the game to start; Boss 2 test mode was not triggered.');
      return;
    }
    requestAnimationFrame(() => waitForRunningThenStart(test, framesLeft - 1));
  }

  function startBoss2TestRun() {
    const test = window.INFINITE_SECOND_BOSS_TEST;
    if (!test?.available || typeof startGame !== 'function') return;

    document.getElementById('settingsMenu')?.classList.add('hidden');
    startGame();
    waitForRunningThenStart(test, MAX_WAIT_FRAMES);
  }

  function init() {
    injectMenuButton();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init, { once: true })
    : init();
})();
