
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function safePath(base, relative) {
  const target = path.resolve(base, relative);
  if (target === base || target.startsWith(base + path.sep)) {
    return target;
  }
  return null;
}

async function findFile(relative) {
  const candidates = [];

  // First, check the requested path normally
  candidates.push(safePath(PUBLIC, relative));
  candidates.push(safePath(ROOT, relative));

  // Compatibility with the current index.html:
  // css/style.css -> style.css
  // js/game.js -> game.js
  // js/config.js -> config.js
  if (relative.startsWith('css/') || relative.startsWith('js/')) {
    const rootFile = relative.slice(relative.indexOf('/') + 1);
    candidates.push(safePath(PUBLIC, rootFile));
    candidates.push(safePath(ROOT, rootFile));
  }

  for (const file of candidates) {
    if (!file) continue;

    try {
      const stats = await fs.promises.stat(file);
      if (stats.isFile()) return file;
    } catch {
      // Try the next location
    }
  }

  return null;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method not allowed');
    return;
  }

  let pathname;

  try {
    pathname = decodeURIComponent(
      new URL(req.url, 'http://localhost').pathname
    );
  } catch {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  if (pathname.includes('\0')) {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  const relative = pathname === '/'
    ? 'index.html'
    : pathname.replace(/^\/+/, '');

  const filePath = await findFile(relative);

  if (!filePath) {
    res.writeHead(404, {
      'Content-Type': 'text/plain; charset=utf-8'
    });
    res.end('File not found: ' + pathname);
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': contentType,
    // Revalidate HTML and JavaScript on every load so gameplay config updates
    // (including evolution XP thresholds) cannot stay stale in the browser cache.
    'Cache-Control': (ext === '.html' || ext === '.js')
      ? 'no-cache'
      : 'public, max-age=3600'
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  const stream = fs.createReadStream(filePath);

  stream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(500);
    }
    res.end();
  });

  stream.pipe(res);
});


const WebSocket = require('ws');

// Realtime multiplayer: the server relays validated player snapshots.
// The existing single-player simulation remains client-side and unchanged.
const wss = new WebSocket.Server({ noServer: true, maxPayload: 2048 });
const onlinePlayers = new Map();

function sendJson(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function publicRoster() {
  return Array.from(onlinePlayers.values()).map((player) => ({
    id: player.id,
    name: player.name,
    x: player.x,
    y: player.y,
    angle: player.angle,
    stageIndex: player.stageIndex,
    xp: player.xp,
    showFlag: player.showFlag,
    countryCode: player.showFlag ? player.countryCode : ''
  }));
}

function broadcastRoster() {
  if (onlinePlayers.size === 0) return;
  const message = JSON.stringify({ type: 'players', players: publicRoster() });
  for (const socket of wss.clients) {
    if (socket.readyState === WebSocket.OPEN) socket.send(message);
  }
}

// Server-checked close-range bites. Stage order mirrors A.STAGES in config.js:
// blue, coral, fast, hunter, angler, shark, manta, octopus, sawshark, orca, megalodon.
// Only a clearly larger animal can bite; the attacker must be facing the target.
const STAGE_RADII = [13, 19, 25.5, 34, 40, 46, 50, 74, 54, 104, 156];
const biteCooldowns = new Map();

function resolvePlayerCombat() {
  const players = Array.from(onlinePlayers.values());
  const now = Date.now();
  for (let i = 0; i < players.length; i++) {
    const attacker = players[i];
    if (now - attacker.lastUpdate > 500) continue;
    const attackRadius = STAGE_RADII[attacker.stageIndex] || 13;
    for (let j = 0; j < players.length; j++) {
      if (i === j) continue;
      const target = players[j];
      if (now - target.lastUpdate > 500) continue;
      const targetRadius = STAGE_RADII[target.stageIndex] || 13;
      if (attackRadius < targetRadius * 0.86) continue;

      const dx = target.x - attacker.x;
      const dy = target.y - attacker.y;
      const distance = Math.hypot(dx, dy);
      // Match the normal fish-eating rule in game.js: a player can eat
      // eligible prey by jaw-range contact, without needing a special facing
      // cone. The local PvE collision has no angle gate, so PvP must not add one.
      const biteReach = attackRadius * 0.9 + targetRadius * 0.6;
      if (distance > biteReach) continue;

      const key = attacker.id + ':' + target.id;
      if (now - (biteCooldowns.get(key) || 0) < 900) continue;
      biteCooldowns.set(key, now);

      // The size advantage must matter in PvP: apex animals should take down
      // tiny fish in a few bites, not need a long chain of tiny damage ticks.
      const sizeGap = Math.max(0, attackRadius - targetRadius);
      const damage = Math.max(16, Math.min(60, Math.round(18 + sizeGap * 0.42)));
      const victimSocket = Array.from(wss.clients).find((socket) => socket.playerId === target.id);
      const attackerSocket = Array.from(wss.clients).find((socket) => socket.playerId === attacker.id);
      if (victimSocket) sendJson(victimSocket, {
        type: 'pvp-hit', damage, attackerName: attacker.name,
        x: attacker.x, y: attacker.y
      });
      if (attackerSocket) sendJson(attackerSocket, {
        type: 'pvp-hit-confirm', targetName: target.name
      });
    }
  }
  if (biteCooldowns.size > 5000) {
    for (const [key, time] of biteCooldowns) {
      if (now - time > 30000) biteCooldowns.delete(key);
    }
  }
}

server.on('upgrade', (req, socket, head) => {
  let pathname = '/';
  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
  } catch {
    socket.destroy();
    return;
  }

  if (pathname !== '/ws') {
    socket.destroy();
    return;
  }

  // Browser clients must connect from the same site that serves the game.
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }
    } catch {
      socket.destroy();
      return;
    }
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws) => {
  const id = require('node:crypto').randomUUID();
  const player = {
    id,
    name: 'Guest',
    x: 7000,
    y: 1000,
    angle: 0,
    stageIndex: 0,
    xp: 0,
    lastUpdate: 0
  };
  ws.playerId = id;
  onlinePlayers.set(id, player);
  sendJson(ws, { type: 'welcome', id });
  broadcastRoster();

  ws.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!message || message.type !== 'state') return;

    const now = Date.now();
    if (now - player.lastUpdate < 25) return;
    player.lastUpdate = now;

    const state = message.player;
    if (!state || typeof state !== 'object') return;
    const x = Number(state.x);
    const y = Number(state.y);
    const angle = Number(state.angle);
    const stageIndex = Number(state.stageIndex);
    const xp = Number(state.xp);

    if (![x, y, angle, stageIndex, xp].every(Number.isFinite)) return;
    if (x < 0 || x > 50000 || y < 0 || y > 50000) return;
    if (!Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex > 30) return;

    player.name = String(state.name || 'Guest')
      .replace(/[<>\u0000-\u001f]/g, '')
      .trim()
      .slice(0, 16) || 'Guest';
    player.x = x;
    player.y = y;
    player.angle = Math.max(-Math.PI * 4, Math.min(Math.PI * 4, angle));
    player.stageIndex = stageIndex;
    player.xp = Math.max(0, Math.min(2147483647, Math.floor(xp)));
    player.showFlag = state.showFlag === true && /^[A-Z]{2}$/.test(String(state.countryCode || ''));
    player.countryCode = player.showFlag ? String(state.countryCode).toUpperCase() : '';
  });

  ws.on('close', () => {
    onlinePlayers.delete(id);
    broadcastRoster();
  });

  ws.on('error', () => {
    onlinePlayers.delete(id);
    broadcastRoster();
  });
});

const rosterTimer = setInterval(() => {
  broadcastRoster();
  resolvePlayerCombat();
}, 50);
rosterTimer.unref();

server.listen(PORT, HOST, () => {
  console.log(`ABYSS.IO running on ${HOST}:${PORT}`);
});
