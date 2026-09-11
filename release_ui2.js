// INFINITE — presentation-only localization layer. Gameplay and UI actions live elsewhere.
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'infiniteLanguage';
  const text = {
    en: {
      note: 'A playable preview. Survive, evolve, and push beyond the limit.',
      language: 'Language', fresh: 'New mission', resume: 'Resume mission', records: 'Global scoreboard',
      fullscreen: 'Enter fullscreen', exitFullscreen: 'Exit fullscreen', back: 'Back to game',
      score: 'Score', lives: 'Lives', time: 'Time', power: 'Power', over: 'MISSION OVER',
      again: 'Another run!', show: 'View global scoreboard', close: 'Close', hall: 'GLOBAL HALL OF FAME',
      hallNote: 'All published runs, across all pilots.', beat: 'Beat the scoreboard', pause: 'GALACTIC PAUSE',
      pauseNote: 'Even the best pilots need to catch their breath.', restart: 'Restart', menu: 'Back to menu',
      authTitle: 'PILOT ACCOUNT', authNote: 'Play as guest anytime. Login is required only to publish scores online.',
      username: 'Username', password: 'Password (8+ characters)', login: 'Login', createAccount: 'Create account',
      logout: 'Logout', account: 'Login / account', guestMode: 'Guest mode', onlineAs: 'Online as',
      publish: 'Publish score online', loginToPublish: 'Login to publish score',
      creatingAccount: 'Creating account…', signingIn: 'Signing in…', loginRequired: 'Login or create an account to publish this score.',
      loadingScores: 'Loading online scoreboard…', noScores: 'No online scores yet', scoreboardUnavailable: 'Online scoreboard unavailable'
    },
    it: {
      note: 'Una preview giocabile. Sopravvivi, evolvi e spingiti oltre il limite.',
      language: 'Lingua', fresh: 'Nuova missione', resume: 'Riprendi la missione', records: 'Classifica globale',
      fullscreen: 'Entra a schermo intero', exitFullscreen: 'Esci da schermo intero', back: 'Torna al gioco',
      score: 'Punteggio', lives: 'Vite', time: 'Tempo', power: 'Potenza', over: 'MISSIONE FINITA',
      again: 'Un’altra partita!', show: 'Guarda la classifica globale', close: 'Chiudi', hall: 'HALL OF FAME GLOBALE',
      hallNote: 'Tutte le partite pubblicate, di tutti i piloti.', beat: 'Scala la classifica', pause: 'PAUSA GALATTICA',
      pauseNote: 'Anche i piloti migliori ogni tanto prendono fiato.', restart: 'Ricomincia', menu: 'Torna al menu',
      authTitle: 'ACCOUNT PILOTA', authNote: 'Puoi giocare sempre come ospite. Il login serve solo per pubblicare i punteggi online.',
      username: 'Nome utente', password: 'Password (almeno 8 caratteri)', login: 'Accedi', createAccount: 'Crea account',
      logout: 'Esci', account: 'Accedi / account', guestMode: 'Modalità ospite', onlineAs: 'Online come',
      publish: 'Pubblica il punteggio online', loginToPublish: 'Accedi per pubblicare il punteggio',
      creatingAccount: 'Creazione account…', signingIn: 'Accesso…', loginRequired: 'Accedi o crea un account per pubblicare questo punteggio.',
      loadingScores: 'Caricamento classifica online…', noScores: 'Nessun punteggio online', scoreboardUnavailable: 'Classifica online non disponibile'
    }
  };

  function loadLanguage() {
    try { return localStorage.getItem(STORAGE_KEY) === 'it' ? 'it' : 'en'; } catch { return 'en'; }
  }

  function saveLanguage(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch {}
  }

  let language = loadLanguage();
  const t = name => text[language][name] || text.en[name] || name;

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
  }

  function replaceHud(id, label) {
    const element = $(id);
    if (!element) return;
    const value = element.textContent.replace(/^[^:]+:\s*/, '');
    element.textContent = `${t(label)}: ${value}`;
  }

  function apply() {
    document.documentElement.lang = language;
    setText('menuNote', t('note'));
    setText('languageLabel', t('language'));
    setText('newGameBtn', t('fresh'));
    setText('resumeBtn', t('resume'));
    setText('scoresBtn', t('records'));
    setText('fullscreenBtn', document.fullscreenElement ? t('exitFullscreen') : t('fullscreen'));
    setText('closeSettingsBtn', t('back'));
    setText('gameOverTitle', t('over'));
    setText('restartFromGameOverBtn', t('again'));
    setText('showScoresFromGameOverBtn', t('show'));
    setText('closeGameOverBtn', t('close'));
    setText('scoreboardTitle', t('hall'));
    setText('scoreboardNote', t('hallNote'));
    setText('restartFromScoreboardBtn', t('beat'));
    setText('backFromScoreboardBtn', t('back'));
    setText('closeScoresBtn', t('close'));
    setText('pauseTitle', t('pause'));
    setText('pauseNote', t('pauseNote'));
    setText('resumeFromPauseBtn', t('resume'));
    setText('restartFromPauseBtn', t('restart'));
    setText('backFromPauseBtn', t('menu'));
    setText('authTitle', t('authTitle'));
    setText('authNote', t('authNote'));
    setText('loginBtn', t('login'));
    setText('registerBtn', t('createAccount'));
    setText('logoutBtn', t('logout'));
    setText('closeAuthBtn', t('close'));

    const username = $('authUsername');
    const password = $('authPassword');
    if (username) username.placeholder = t('username');
    if (password) password.placeholder = t('password');

    replaceHud('score', 'score');
    replaceHud('lives', 'lives');
    replaceHud('timer', 'time');
    replaceHud('power', 'power');

    document.dispatchEvent(new CustomEvent('infinity-languagechange'));
  }

  const select = $('languageSelect');
  if (select) {
    select.value = language;
    select.addEventListener('change', event => {
      language = event.target.value === 'it' ? 'it' : 'en';
      saveLanguage(language);
      apply();
    });
  }

  document.addEventListener('fullscreenchange', apply);
  window.INFINITY_I18N = Object.freeze({ t, apply, get language() { return language; } });
  apply();
})();
