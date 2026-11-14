(function () {
  'use strict';

  const A = window.ABYSS;
  if (!A) return;

  let socket = null;
  let playerId = '';
  let roster = [];
  let reconnectTimer = 0;
  let detectedCountryCode = '';
  const FLAG_PREF_KEY = 'abyss_show_country_flag';
  let flagEnabled = false;
  try { flagEnabled = localStorage.getItem(FLAG_PREF_KEY) === '1'; } catch (error) {}

  function detectCountry() {
    try {
      const cached = localStorage.getItem('abyss_country_code') || '';
      if (/^[A-Z]{2}$/.test(cached)) detectedCountryCode = cached;
    } catch (error) {}

    // Try two CORS-enabled country lookup services. Only the ISO country code
    // is kept; the raw IP address is never stored or sent to the game server.
    fetch('https://ipwho.is/', { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('Country lookup failed');
        return response.json();
      })
      .then(function (data) {
        const code = String(data && data.success !== false && data.country_code || '').toUpperCase();
        if (!/^[A-Z]{2}$/.test(code)) throw new Error('No country code');
        detectedCountryCode = code;
        try { localStorage.setItem('abyss_country_code', code); } catch (error) {}
        window.dispatchEvent(new Event('abyss-country-detected'));
      })
      .catch(function () {
        return fetch('https://ipapi.co/json/', { cache: 'no-store' })
          .then(function (response) {
            if (!response.ok) throw new Error('Country lookup failed');
            return response.json();
          })
          .then(function (data) {
            const code = String(data && data.country_code || '').toUpperCase();
            if (!/^[A-Z]{2}$/.test(code)) return;
            detectedCountryCode = code;
            try { localStorage.setItem('abyss_country_code', code); } catch (error) {}
            window.dispatchEvent(new Event('abyss-country-detected'));
          })
          .catch(function () {});
      });
  }

  function showFlag() { return flagEnabled; }
  function setShowFlag(enabled) {
    flagEnabled = !!enabled;
    try { localStorage.setItem(FLAG_PREF_KEY, flagEnabled ? '1' : '0'); } catch (error) {}
  }
  function countryCode() { return detectedCountryCode; }

  function connected() {
    return !!socket && socket.readyState === WebSocket.OPEN;
  }

  function players() {
    return roster.slice();
  }

  function connect() {
    if (!/^https?:$/.test(location.protocol) || connected() ||
        (socket && socket.readyState === WebSocket.CONNECTING)) return;

    const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
    try {
      socket = new WebSocket(scheme + '//' + location.host + '/ws');
    } catch (error) {
      scheduleReconnect();
      return;
    }

    socket.addEventListener('message', function (event) {
      let message;
      try { message = JSON.parse(event.data); } catch (error) { return; }
      if (!message || typeof message !== 'object') return;

      if (message.type === 'welcome') {
        playerId = String(message.id || '');
      } else if (message.type === 'pvp-hit') {
        if (A.GameNet && A.GameNet.applyPvPHit) A.GameNet.applyPvPHit(message);
      } else if (message.type === 'pvp-hit-confirm') {
        if (A.game && A.game.ui && A.game.ui.toast) A.game.ui.toast('HIT CONFIRMED · ' + String(message.targetName || 'PLAYER'), 1100);
      } else if (message.type === 'players' && Array.isArray(message.players)) {
        roster = message.players.filter(function (player) {
          return player && String(player.id) !== playerId;
        });
        if (A.GameNet && A.GameNet.setRemotePlayers) {
          A.GameNet.setRemotePlayers(roster);
        }
      }
    });

    socket.addEventListener('close', function () {
      playerId = '';
      roster = [];
      if (A.GameNet && A.GameNet.setRemotePlayers) A.GameNet.setRemotePlayers([]);
      scheduleReconnect();
    });

    socket.addEventListener('error', function () {
      // The close event handles reconnection; avoid noisy console errors.
    });
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = window.setTimeout(function () {
      reconnectTimer = 0;
      connect();
    }, 3000);
  }

  function sendState() {
    if (!connected() || !A.GameNet || !A.GameNet.snapshot) return;
    const player = A.GameNet.snapshot();
    if (!player) return;

    // A signed-in display name wins; guests keep the name selected in-game.
    try {
      const account = A.Account && A.Account.status ? A.Account.status() : null;
      if (account && account.signedIn && A.Account.displayName) {
        player.name = A.Account.displayName() || player.name;
      }
    } catch (error) {}

    player.showFlag = flagEnabled && /^[A-Z]{2}$/.test(detectedCountryCode);
    player.countryCode = player.showFlag ? detectedCountryCode : '';
    try {
      socket.send(JSON.stringify({ type: 'state', player: player }));
    } catch (error) {}
  }

  A.Online = {
    connected: connected,
    players: players,
    id: function () { return playerId; },
    connect: connect,
    showFlag: showFlag,
    setShowFlag: setShowFlag,
    countryCode: countryCode
  };

  detectCountry();
  connect();
  window.setInterval(sendState, 33);
  window.addEventListener('online', connect);
})();
