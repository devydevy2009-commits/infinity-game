(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const state = {
    user: null,
    gameVersion: '…',
    scoreOrigin: 'settings',
    scoreRequest: null,
    authBusy: false
  };

  const t = (key, fallback = key) => window.INFINITY_I18N?.t(key) || fallback;

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

    const response = await fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers
    });

    let body = {};
    try { body = await response.json(); } catch {}
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    return body;
  }

  function setAuthMessage(message, isError = false) {
    const node = $('authMessage');
    if (!node) return;
    node.textContent = message || '';
    node.classList.toggle('error', !!isError);
  }

  function setPublishMessage(message, isError = false) {
    const node = $('scorePublishMessage');
    if (!node) return;
    node.textContent = message || '';
    node.classList.toggle('error', !!isError);
  }

  function syncVersionUI() {
    const value = state.gameVersion || '…';
    if ($('gameVersion')) $('gameVersion').textContent = value;
    if ($('scoreboardVersion')) $('scoreboardVersion').textContent = `Build ${value}`;
  }

  function syncAccountUI() {
    const accountBtn = $('accountBtn');
    const accountStatus = $('accountStatus');
    const saveBtn = $('saveScoreBtn');

    if (accountBtn) accountBtn.textContent = state.user ? `Account · ${state.user.username}` : t('account', 'Login / account');
    if (accountStatus) accountStatus.textContent = state.user ? `${t('onlineAs', 'Online as')} ${state.user.username}` : t('guestMode', 'Guest mode');
    if (saveBtn) saveBtn.textContent = state.user ? t('publish', 'Publish score online') : t('loginToPublish', 'Login to publish score');
  }

  function syncOnlineUI() {
    syncVersionUI();
    syncAccountUI();
    if ($('authOnlineLabel')) $('authOnlineLabel').textContent = t('onlineAs', 'Online as');
  }

  async function refreshSession() {
    try {
      const body = await api('/api/me', { method: 'GET' });
      state.user = body.user || null;
      state.gameVersion = body.gameVersion || state.gameVersion;
    } catch {
      state.user = null;
    }
    syncOnlineUI();
  }

  function openAuth(message = '') {
    $('authMenu')?.classList.remove('hidden');
    $('authGuestPanel')?.classList.toggle('hidden', !!state.user);
    $('authUserPanel')?.classList.toggle('hidden', !state.user);
    if (state.user && $('authUsernameLabel')) $('authUsernameLabel').textContent = state.user.username;
    setAuthMessage(message || (state.user ? `${t('onlineAs', 'Online as')} ${state.user.username}` : ''));
  }

  function closeAuth() {
    $('authMenu')?.classList.add('hidden');
    setAuthMessage('');
  }

  function setAuthBusy(busy) {
    state.authBusy = busy;
    for (const id of ['loginBtn', 'registerBtn']) {
      const button = $(id);
      if (button) button.disabled = busy;
    }
  }

  async function submitAuth(mode) {
    if (state.authBusy) return;

    const username = $('authUsername')?.value.trim() || '';
    const password = $('authPassword')?.value || '';
    setAuthMessage(mode === 'register' ? t('creatingAccount', 'Creating account…') : t('signingIn', 'Signing in…'));
    setAuthBusy(true);

    try {
      const body = await api(`/api/${mode}`, {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      state.user = body.user;
      if ($('authPassword')) $('authPassword').value = '';
      syncOnlineUI();
      openAuth(`${t('onlineAs', 'Online as')} ${state.user.username}`);
      setPublishMessage('');
    } catch (error) {
      setAuthMessage(error.message, true);
    } finally {
      setAuthBusy(false);
    }
  }

  async function logout() {
    try { await api('/api/logout', { method: 'POST', body: '{}' }); } catch {}
    state.user = null;
    syncOnlineUI();
    openAuth(t('guestMode', 'Guest mode'));
  }

  function formatDuration(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  }

  function renderScoreRows(rows) {
    const list = $('scoreList');
    if (!list) return;
    list.replaceChildren();

    if (!rows.length) {
      const li = document.createElement('li');
      li.className = 'score-empty';
      li.textContent = t('noScores', 'No online scores yet');
      list.appendChild(li);
      return;
    }

    rows.forEach((entry, index) => {
      const li = document.createElement('li');
      li.className = 'online-score-row';

      const rank = document.createElement('span');
      rank.className = 'score-rank';
      rank.textContent = `${index + 1}.`;

      const pilot = document.createElement('span');
      pilot.className = 'score-pilot';
      pilot.textContent = entry.username;

      const points = document.createElement('span');
      points.className = 'score-points';
      points.textContent = Number(entry.score).toLocaleString();

      const details = document.createElement('span');
      details.className = 'score-build';
      details.textContent = `${entry.game_version} · ${formatDuration(entry.survival_time)}`;

      li.append(rank, pilot, points, details);
      list.appendChild(li);
    });
  }

  function renderOnlineScores() {
    if (state.scoreRequest) return state.scoreRequest;

    state.scoreRequest = (async () => {
      const list = $('scoreList');
      if (list) {
        list.replaceChildren();
        const li = document.createElement('li');
        li.className = 'score-empty';
        li.textContent = t('loadingScores', 'Loading online scoreboard…');
        list.appendChild(li);
      }

      try {
        const body = await api('/api/scores', { method: 'GET' });
        state.gameVersion = body.gameVersion || state.gameVersion;
        syncVersionUI();
        renderScoreRows(body.scores || []);
      } catch (error) {
        if (list) {
          list.replaceChildren();
          const li = document.createElement('li');
          li.className = 'score-empty error';
          li.textContent = `${t('scoreboardUnavailable', 'Online scoreboard unavailable')}: ${error.message}`;
          list.appendChild(li);
        }
      } finally {
        state.scoreRequest = null;
      }
    })();

    return state.scoreRequest;
  }

  function openScores(origin) {
    state.scoreOrigin = origin;
    settingsMenu.classList.add('hidden');
    gameOverMenu.classList.add('hidden');
    scoreboardMenu.classList.remove('hidden');
    renderOnlineScores();
  }

  function closeScores() {
    scoreboardMenu.classList.add('hidden');
    if (state.scoreOrigin === 'gameover') gameOverMenu.classList.remove('hidden');
    else settingsMenu.classList.remove('hidden');
  }

  async function publishCurrentScore() {
    if (!state.user) {
      openAuth(t('loginRequired', 'Login or create an account to publish this score.'));
      return;
    }

    const button = $('saveScoreBtn');
    if (button?.disabled) return;
    if (button) button.disabled = true;
    setPublishMessage('');

    try {
      await api('/api/scores', {
        method: 'POST',
        body: JSON.stringify({
          score: Math.max(0, Math.floor(Number(score) || 0)),
          survivalTime: Math.max(0, Math.floor(Number(finalElapsed || secs()) || 0)),
          runId: crypto.randomUUID()
        })
      });
      saveScoreBox?.classList.add('hidden');
      openScores('gameover');
    } catch (error) {
      setPublishMessage(error.message, true);
    } finally {
      if (button) button.disabled = false;
      syncAccountUI();
    }
  }

  function wireUI() {
    $('accountBtn')?.addEventListener('click', () => openAuth());
    $('closeAuthBtn')?.addEventListener('click', closeAuth);
    $('loginBtn')?.addEventListener('click', () => submitAuth('login'));
    $('registerBtn')?.addEventListener('click', () => submitAuth('register'));
    $('logoutBtn')?.addEventListener('click', logout);

    $('authPassword')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') submitAuth('login');
    });

    if ($('saveScoreBtn')) $('saveScoreBtn').onclick = publishCurrentScore;
    if ($('scoresBtn')) $('scoresBtn').onclick = () => openScores('settings');
    if ($('showScoresFromGameOverBtn')) $('showScoresFromGameOverBtn').onclick = () => openScores('gameover');
    if ($('backFromScoreboardBtn')) $('backFromScoreboardBtn').onclick = closeScores;
    if ($('closeScoresBtn')) $('closeScoresBtn').onclick = closeScores;

    document.addEventListener('infinity-languagechange', syncOnlineUI);
  }

  wireUI();
  syncOnlineUI();
  refreshSession();
  window.INFINITY_ONLINE = Object.freeze({ refreshSession, renderScores: renderOnlineScores });
})();
