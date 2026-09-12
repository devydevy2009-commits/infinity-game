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
  const START_DELAY_MS = 220; // gives startGame()'s loading sequence time to finish

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

  function startBoss2TestRun() {
    const test = window.INFINITE_SECOND_BOSS_TEST;
    if (!test?.available || typeof startGame !== 'function') return;

    document.getElementById('settingsMenu')?.classList.add('hidden');
    startGame();
    setTimeout(() => test.start(), START_DELAY_MS);
  }

  function init() {
    injectMenuButton();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init, { once: true })
    : init();
})();
