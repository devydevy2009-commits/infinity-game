(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'infiniteLanguage';
  const languages = {
    en: {
      menuNote: 'Ready to see how long you can survive? 🚀',
      newGame: 'New mission',
      resume: 'Resume mission',
      restart: 'Try again',
      scores: 'Your records',
      gyro: '🌀 Gyroscope — in the hangar',
      hardHint: 'This mode is taking a break for now. The ship likes flying straight. 😎',
      install: 'Install INFINITE',
      iosHome: 'Take INFINITE Home',
      refresh: 'Refresh INFINITE',
      closeSettings: 'Back to game',
      missionOver: 'MISSION OVER',
      saveScore: 'Save the record',
      anotherGame: 'Another run!',
      showScores: 'View the records',
      close: 'Close',
      hall: 'HALL OF FAME',
      hallNote: 'Let’s see who lasted the longest.',
      beatIt: 'Beat your record',
      back: 'Back',
      takeWithYou: 'TAKE INFINITE WITH YOU',
      iosHelp: 'In Safari, tap <strong>Share</strong>, then choose <strong>Add to Home Screen</strong>. Your next mission is always one tap away.',
      pauseTitle: 'GALACTIC PAUSE',
      pauseNote: 'Even the best pilots need to catch their breath.',
      resumeMission: 'Resume mission',
      restartMission: 'Restart',
      backToMenu: 'Back to menu',
      languageLabel: 'Language',
      italian: 'Italiano',
      english: 'English',
      score: 'Score',
      lives: 'Lives',
      time: 'Time',
      power: 'Power',
      noScores: 'No saved scores yet',
      loadingInit: 'Engine startup',
      loadingStars: 'Preparing the starfield',
      loadingThreats: 'Deploying threats',
      loadingWeapons: 'Syncing weapons',
      loadingSystems: 'Checking systems',
      loadingOnline: 'INFINITE ONLINE',
      deathTitle: 'TAKE DOWN MOMENT',
      deathPicture: 'Take a picture'
    },
    it: {
      menuNote: 'Pronto a vedere quanto riesci a resistere? 🚀',
      newGame: 'Nuova missione',
      resume: 'Riprendi la missione',
      restart: 'Riprova da capo',
      scores: 'I tuoi record',
      gyro: '🌀 Giroscopio — in hangar',
      hardHint: 'Questa modalità è in pausa per ora. La nave preferisce andare dritta. 😎',
      install: 'Installa INFINITE',
      iosHome: 'Porta INFINITE a Home',
      refresh: 'Aggiorna INFINITE',
      closeSettings: 'Torna al gioco',
      missionOver: 'MISSIONE FINITA',
      saveScore: 'Salva il record',
      anotherGame: "Un'altra partita!",
      showScores: 'Guarda i record',
      close: 'Chiudi',
      hall: 'HALL OF FAME',
      hallNote: 'Vediamo chi ha tenuto duro più a lungo.',
      beatIt: 'Prova a migliorarlo',
      back: 'Indietro',
      takeWithYou: 'PORTA INFINITE CON TE',
      iosHelp: 'Su Safari tocca <strong>Condividi</strong>, poi scegli <strong>Aggiungi a Home</strong>. Così la prossima missione è a un tocco.',
      pauseTitle: 'PAUSA GALATTICA',
      pauseNote: 'Anche i piloti migliori ogni tanto prendono fiato.',
      resumeMission: 'Riprendi la missione',
      restartMission: 'Ricomincia',
      backToMenu: 'Torna al menu',
      languageLabel: 'Lingua',
      italian: 'Italiano',
      english: 'English',
      score: 'Punteggio',
      lives: 'Vite',
      time: 'Tempo',
      power: 'Potenza',
      noScores: 'Nessun punteggio salvato',
      loadingInit: 'Inizializzazione motore',
      loadingStars: 'Preparazione campo stellare',
      loadingThreats: 'Schieramento minacce',
      loadingWeapons: 'Sincronizzazione armi',
      loadingSystems: 'Controllo sistemi',
      loadingOnline: 'INFINITE ONLINE',
      deathTitle: 'MOMENTO DEL KO',
      deathPicture: 'Fai una foto'
    }
  };

  let language = localStorage.getItem(STORAGE_KEY) === 'it' ? 'it' : 'en';

  function t(key) {
    return languages[language][key] ?? languages.en[key] ?? key;
  }

  function setText(id, key) {
    const el = $(id);
    if (el) el.textContent = t(key);
  }

  function setHtml(id, key) {
    const el = $(id);
    if (el) el.innerHTML = t(key);
  }

  function applyStaticText() {
    document.documentElement.lang = language;
    setText('menuNote', 'menuNote');
    setText('newGameBtn', 'newGame');
    setText('resumeBtn', 'resume');
    setText('restartBtn', 'restart');
    setText('scoresBtn', 'scores');
    setText('gyroToggleBtn', 'gyro');
    setText('hardmodeHint', 'hardHint');
    setText('installBtn', 'install');
    setText('iosInstallBtn', 'iosHome');
    setText('refreshBtn', 'refresh');
    setText('closeSettingsBtn', 'closeSettings');
    setText('gameOverTitle', 'missionOver');
    setText('saveScoreBtn', 'saveScore');
    setText('restartFromGameOverBtn', 'anotherGame');
    setText('showScoresFromGameOverBtn', 'showScores');
    setText('closeGameOverBtn', 'close');
    setText('scoreboardTitle', 'hall');
    setText('scoreboardNote', 'hallNote');
    setText('restartFromScoreboardBtn', 'beatIt');
    setText('backFromScoreboardBtn', 'back');
    setText('closeScoresBtn', 'close');
    setText('iosInstallTitle', 'takeWithYou');
    setHtml('iosInstallText', 'iosHelp');
    setText('closeIosInstallHelpBtn', 'back');
    setText('pauseTitle', 'pauseTitle');
    setText('pauseNote', 'pauseNote');
    setText('resumeFromPauseBtn', 'resumeMission');
    setText('restartFromPauseBtn', 'restartMission');
    setText('backFromPauseBtn', 'backToMenu');
    setText('languageLabel', 'languageLabel');
    setText('deathTitleText', 'deathTitle');
    setText('takePictureBtn', 'deathPicture');

    const languageSelect = $('languageSelect');
    if (languageSelect) languageSelect.value = language;
    updateHudLabels();
    translateDynamicText();
  }

  function updateHudLabels() {
    const score = $('score');
    const lives = $('lives');
    const timer = $('timer');
    const power = $('power');
    if (score) score.dataset.label = t('score');
    if (lives) lives.dataset.label = t('lives');
    if (timer) timer.dataset.label = t('time');
    if (power) power.dataset.label = t('power');
  }

  function labelValue(element, key, value) {
    if (element) element.textContent = `${t(key)}: ${value}`;
  }

  function translateDynamicText() {
    const score = $('score');
    const lives = $('lives');
    const timer = $('timer');
    const power = $('power');

    if (score) {
      const value = score.textContent.replace(/^(Score|Punteggio):\s*/i, '');
      labelValue(score, 'score', value || '0');
    }
    if (lives) {
      const value = lives.textContent.replace(/^(Lives|Vite):\s*/i, '');
      labelValue(lives, 'lives', value || '3');
    }
    if (timer) {
      const value = timer.textContent.replace(/^(Time|Tempo):\s*/i, '');
      labelValue(timer, 'time', value || '0:00');
    }
    if (power) {
      const value = power.textContent.replace(/^(Power|Potenza):\s*/i, '');
      labelValue(power, 'power', value || '0');
    }

    const final = $('finalScore');
    if (final) {
      const match = final.textContent.match(/Score:\s*(\d+)\s*·\s*Time:\s*(.+)$/i) || final.textContent.match(/Punteggio:\s*(\d+)\s*·\s*Tempo:\s*(.+)$/i);
      if (match) final.textContent = `${t('score')}: ${match[1]} · ${t('time')}: ${match[2]}`;
    }

    const scoreList = $('scoreList');
    if (scoreList && scoreList.children.length === 1 && /Nessun punteggio salvato|No saved scores yet/i.test(scoreList.textContent)) {
      scoreList.textContent = t('noScores');
    }

    const stage = $('loadingStage');
    if (stage) {
      const map = {
        'Inizializzazione motore': 'loadingInit',
        'Engine startup': 'loadingInit',
        'Preparazione campo stellare': 'loadingStars',
        'Preparing the starfield': 'loadingStars',
        'Schieramento difese e minacce': 'loadingThreats',
        'Schieramento minacce': 'loadingThreats',
        'Deploying threats': 'loadingThreats',
        'Sincronizzazione armi': 'loadingWeapons',
        'Syncing weapons': 'loadingWeapons',
        'Controllo sistemi': 'loadingSystems',
        'Checking systems': 'loadingSystems',
        'Infinity ONLINE': 'loadingOnline',
        'INFINITE ONLINE': 'loadingOnline'
      };
      const key = map[stage.textContent];
      if (key) stage.textContent = t(key);
    }
  }

  function addLanguageControl() {
    if ($('languageRow')) return;
    const menu = document.querySelector('#settingsMenu .menu-content');
    if (!menu) return;
    const row = document.createElement('div');
    row.id = 'languageRow';
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0 4px;color:#fff;font-size:15px;';
    row.innerHTML = '<label id="languageLabel" for="languageSelect">Language</label><select id="languageSelect" style="min-width:120px;padding:8px 10px;border-radius:8px;border:1px solid #555;background:#0a0a0a;color:#fff;"><option value="en">English</option><option value="it">Italiano</option></select>';
    const firstButton = $('newGameBtn');
    menu.insertBefore(row, firstButton);
    $('languageSelect').addEventListener('change', event => {
      language = event.target.value === 'it' ? 'it' : 'en';
      localStorage.setItem(STORAGE_KEY, language);
      applyStaticText();
      renderScores?.();
    });
  }

  function bindSettingsPause() {
    const button = $('settingsBtn');
    if (!button) return;
    button.onclick = () => {
      if (typeof running !== 'undefined' && running && typeof paused !== 'undefined' && !paused && typeof pauseGame === 'function') {
        pauseGame();
      }
      $('pauseOverlay')?.classList.add('hidden');
      $('settingsMenu')?.classList.remove('hidden');
      $('pauseBtn')?.classList.add('hidden');
      $('resumeBtn')?.classList.toggle('hidden', !(typeof paused !== 'undefined' && paused));
    };
  }

  function patchUiFunctions() {
    const originalRenderScores = window.renderScores;
    if (originalRenderScores && !originalRenderScores.__infinitePatched) {
      const wrapped = function () {
        originalRenderScores();
        translateDynamicText();
      };
      wrapped.__infinitePatched = true;
      window.renderScores = wrapped;
    }
  }

  function init() {
    addLanguageControl();
    applyStaticText();
    bindSettingsPause();
    patchUiFunctions();
    const observer = new MutationObserver(() => translateDynamicText());
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
