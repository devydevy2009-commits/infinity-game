(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const state = { user: null, loadingScores: false };
  const version = window.INFINITY_GAME_VERSION || 'unknown';

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
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

  function syncAccountUI() {
    const accountBtn = $('accountBtn');
    const accountStatus = $('accountStatus');
    if (accountBtn) accountBtn.textContent = state.user ? `Account · ${state.user.username}` : 'Login / account';
    if (accountStatus) accountStatus.textContent = state.user ? `Online as ${state.user.username}` : 'Guest mode';

    const nameInput = $('playerName');
    const saveBtn = $('saveScoreBtn');
    if (nameInput) nameInput.classList.toggle('hidden', !!state.user);
    if (saveBtn) saveBtn.textContent = state.user ? 'Publish score online' : 'Login to publish score';
  }

  async function refreshSession() {
    try {
      const body = await api('/api/me', { method: 'GET', headers: {} });
      state.user = body.user || null;
    } catch {
      state.user = null;
    }
    syncAccountUI();
  }

  function openAuth() {
    $('authMenu')?.classList.remove('hidden');
    setAuthMessage(state.user ? `Logged in as ${state.user.username}` : '');
    $('authGuestPanel')?.classList.toggle('hidden', !!state.user);
    $('authUserPanel')?.classList.toggle('hidden', !state.user);
    if (state.user) $('authUsernameLabel').textContent = state.user.username;
  }

  function closeAuth() {
    $('authMenu')?.classList.add('hidden');
  }

  async function submitAuth(mode) {
    const username = $('authUsername')?.value.trim() || '';
    const password = $('authPassword')?.value || '';
    setAuthMessage(mode === 'register' ? 'Creating account…' : 'Signing in…');
    try {
      const body = await api(`/api/${mode}`, {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      state.user = body.user;
      $('authPassword').value = '';
      syncAccountUI();
      openAuth();
      setAuthMessage(`Online as ${state.user.username}`);
    } catch (error) {
      setAuthMessage(error.message, true);
    }
  }

  async function logout() {
    try { await api('/api/logout', { method: 'POST', body: '{}' }); } catch {}
    state.user = null;
    syncAccountUI();
    openAuth();
    setAuthMessage('Guest mode');
  }

  function renderScoreRows(rows) {
    const list = $('scoreList');
    if (!list) return;
    list.replaceChildren();
    if (!rows.length) {
      const li = document.createElement('li');
      li.textContent = 'No online scores yet';
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
      const build = document.createElement('span');
      build.className = 'score-build';
      build.textContent = entry.game_version;
      li.append(rank, pilot, points, build);
      list.appendChild(li);
    });
  }

  async function renderOnlineScores() {
    if (state.loadingScores) return;
    state.loadingScores = true;
    const list = $('scoreList');
    if (list) list.innerHTML = '<li>Loading online scoreboard…</li>';
    try {
      const body = await api('/api/scores', { method: 'GET', headers: {} });
      renderScoreRows(body.scores || []);
    } catch (error) {
      if (list) {
        list.replaceChildren();
        const li = document.createElement('li');
        li.textContent = `Online scoreboard unavailable: ${error.message}`;
        list.appendChild(li);
      }
    } finally {
      state.loadingScores = false;
    }
  }

  async function publishCurrentScore() {
    if (!state.user) {
      openAuth();
      setAuthMessage('Login or create an account to publish this score.');
      return;
    }

    const button = $('saveScoreBtn');
    if (button) button.disabled = true;
    try {
      const runId = crypto.randomUUID();
      await api('/api/scores', {
        method: 'POST',
        body: JSON.stringify({
          score: Math.max(0, Math.floor(Number(score) || 0)),
          survivalTime: Math.max(0, Math.floor(Number(finalElapsed || secs()) || 0)),
          gameVersion: version,
          runId
        })
      });
      saveScoreBox?.classList.add('hidden');
      await renderOnlineScores();
    } catch (error) {
      if (button) button.textContent = error.message;
    } finally {
      if (button) button.disabled = false;
    }
  }

  function wireUI() {
    $('accountBtn')?.addEventListener('click', openAuth);
    $('closeAuthBtn')?.addEventListener('click', closeAuth);
    $('loginBtn')?.addEventListener('click', () => submitAuth('login'));
    $('registerBtn')?.addEventListener('click', () => submitAuth('register'));
    $('logoutBtn')?.addEventListener('click', logout);
    $('saveScoreBtn').onclick = publishCurrentScore;

    const showScores = () => renderOnlineScores();
    $('scoresBtn')?.addEventListener('click', showScores);
    $('showScoresFromGameOverBtn')?.addEventListener('click', showScores);
    $('scoreboardVersion') && ($('scoreboardVersion').textContent = `Build ${version}`);
    $('gameVersion') && ($('gameVersion').textContent = version);
  }

  wireUI();
  refreshSession();
  window.INFINITY_ONLINE = Object.freeze({ refreshSession, renderScores: renderOnlineScores });
})();
