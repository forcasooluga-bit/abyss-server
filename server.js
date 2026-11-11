
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
    'Cache-Control': ext === '.html'
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

server.listen(PORT, HOST, () => {
  console.log(`ABYSS.IO running on ${HOST}:${PORT}`);
});
