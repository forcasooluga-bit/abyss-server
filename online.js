(function () {
  'use strict';

  const A = window.ABYSS;
  if (!A) return;

  let socket = null;
  let playerId = '';
  let roster = [];
  let reconnectTimer = 0;

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

    try {
      socket.send(JSON.stringify({ type: 'state', player: player }));
    } catch (error) {}
  }

  A.Online = {
    connected: connected,
    players: players,
    id: function () { return playerId; },
    connect: connect
  };

  connect();
  window.setInterval(sendState, 100);
  window.addEventListener('online', connect);
})();
