const http = require('node:http');
const fs = nodeRequireOrFallback('node:fs') || require('fs');
const path = require('node:path');

const PORT = process.env.PORT || 8730;
const HOST = '0.0.0.0';

function nodeRequireOrFallback(name) {
  try { return require(name); } catch (e) { return null; }
}

const server = http.createServer((req, res) => {
  const pathname = (req.url || '/').split('?')[0];

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end();
    return;
  }

  let target = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);
  
  fs.stat(target, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(target).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log('ABYSS.IO server is up on http://' + HOST + ':' + PORT);
});
