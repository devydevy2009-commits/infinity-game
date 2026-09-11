// INFINITE — presentation-only localization layer. Gameplay and UI actions live in game.js.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const key = 'infiniteLanguage';
  const text = {
    en: { note: 'A playable preview. Survive, evolve, and push beyond the limit.', language: 'Language', fresh: 'New mission', resume: 'Resume mission', records: 'Global scoreboard', fullscreen: 'Enter fullscreen', exitFullscreen: 'Exit fullscreen', back: 'Back to game', score: 'Score', lives: 'Lives', time: 'Time', power: 'Power', over: 'MISSION OVER', save: 'Publish score online', again: 'Another run!', show: 'View global scoreboard', close: 'Close', hall: 'GLOBAL HALL OF FAME', hallNote: 'All published runs, across all pilots.', beat: 'Beat the scoreboard', pause: 'GALACTIC PAUSE', pauseNote: 'Even the best pilots need to catch their breath.', restart: 'Restart', menu: 'Back to menu', name: 'Your name' },
    it: { note: 'Una preview giocabile. Sopravvivi, evolvi e spingiti oltre il limite.', language: 'Lingua', fresh: 'Nuova missione', resume: 'Riprendi la missione', records: 'Classifica globale', fullscreen: 'Entra a schermo intero', exitFullscreen: 'Esci da schermo intero', back: 'Torna al gioco', score: 'Punteggio', lives: 'Vite', time: 'Tempo', power: 'Potenza', over: 'MISSIONE FINITA', save: 'Pubblica il punteggio online', again: "Un’altra partita!", show: 'Guarda la classifica globale', close: 'Chiudi', hall: 'HALL OF FAME GLOBALE', hallNote: 'Tutte le partite pubblicate, di tutti i piloti.', beat: 'Scala la classifica', pause: 'PAUSA GALATTICA', pauseNote: 'Anche i piloti migliori ogni tanto prendono fiato.', restart: 'Ricomincia', menu: 'Torna al menu', name: 'Il tuo nome' }
  };
  let language = localStorage.getItem(key) === 'it' ? 'it' : 'en';
  const t = name => text[language][name];
  function replaceHud(id, label) {
    const element = $(id); if (!element) return;
    const value = element.textContent.replace(/^[^:]+:\s*/, '');
    element.textContent = t(label) + ': ' + value;
  }
  function apply() {
    document.documentElement.lang = language;
    $('menuNote').textContent = t('note');
    $('languageLabel').textContent = t('language');
    $('newGameBtn').textContent = t('fresh');
    $('resumeBtn').textContent = t('resume');
    $('scoresBtn').textContent = t('records');
    $('fullscreenBtn').textContent = document.fullscreenElement ? t('exitFullscreen') : t('fullscreen');
    $('closeSettingsBtn').textContent = t('back');
    $('gameOverTitle').textContent = t('over');
    $('saveScoreBtn').textContent = t('save');
    $('restartFromGameOverBtn').textContent = t('again');
    $('showScoresFromGameOverBtn').textContent = t('show');
    $('closeGameOverBtn').textContent = t('close');
    $('scoreboardTitle').textContent = t('hall');
    $('scoreboardNote').textContent = t('hallNote');
    $('restartFromScoreboardBtn').textContent = t('beat');
    $('backFromScoreboardBtn').textContent = t('back');
    $('closeScoresBtn').textContent = t('close');
    $('pauseTitle').textContent = t('pause');
    $('pauseNote').textContent = t('pauseNote');
    $('resumeFromPauseBtn').textContent = t('resume');
    $('restartFromPauseBtn').textContent = t('restart');
    $('backFromPauseBtn').textContent = t('menu');
    $('playerName').placeholder = t('name');
    replaceHud('score', 'score'); replaceHud('lives', 'lives'); replaceHud('timer', 'time'); replaceHud('power', 'power');
  }
  $('languageSelect').value = language;
  $('languageSelect').addEventListener('change', event => { language = event.target.value === 'it' ? 'it' : 'en'; localStorage.setItem(key, language); apply(); });
  document.addEventListener('fullscreenchange', apply);
  apply();
})();
