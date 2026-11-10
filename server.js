/*
 * ABYSS.IO account server (Node twin of server.py).
 *
 * Same SQLite file, same scrypt parameters, same cookies, same endpoints as
 * the Python server, plus the private admin API. Zero dependencies beyond
 * Node core (`node:sqlite` requires Node 22.5+).
 *
 * Security model: player sessions and admin sessions are separate HttpOnly
 * cookies, both stored only as SHA-256 digests. The administrator identity
 * comes from the process environment; no database row, signup path or
 * endpoint can turn a player into an admin. Every /api/admin/* call
 * re-validates the admin session server-side.
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

// Argon2id verification comes from the vendored pure-WASM hash-wasm build, so
// the server still runs without a compiler or an npm install step.
let hashWasm = null;
try { hashWasm = require('hash-wasm'); } catch (e) { hashWasm = null; }
const ARGON2_OK = Boolean(hashWasm && hashWasm.argon2Verify);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE = __dirname;
const ROOT = path.resolve(BASE, '..');
const ADMIN_DIR = path.join(BASE, 'admin');

function loadEnvFile(file) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#') || line.indexOf('=') < 0) continue;
      const i = line.indexOf('=');
      const key = line.slice(0, i).trim();
      let value = line.slice(i + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch (e) { /* no .env is normal */ }
}

loadEnvFile(path.join(BASE, '.env'));

const DATA_DIR = process.env.ABYSS_DATA_DIR || path.join(BASE, 'data');
const PORT = Number(process.env.ABYSS_PORT || 8730);
const HOST = process.env.ABYSS_HOST || '127.0.0.1';

const SESSION_TTL = 1000 * 60 * 60 * 24 * 30;
const ADMIN_SESSION_TTL = Math.round(Number(process.env.ABYSS_ADMIN_SESSION_HOURS || 8) * 3600 * 1000);
const ADMIN_IDLE_TTL = Math.round(Number(process.env.ABYSS_ADMIN_IDLE_MINUTES || 60) * 60 * 1000);
const ADMIN_MAX_FAILS = Math.max(3, Math.floor(Number(process.env.ABYSS_ADMIN_MAX_FAILS || 5)));
const ADMIN_LOCK_MS = Math.round(Number(process.env.ABYSS_ADMIN_LOCK_MINUTES || 15) * 60 * 1000);
const ADMIN_BIND_IP = ['1', 'true', 'yes', 'on'].includes(String(process.env.ABYSS_ADMIN_BIND_IP || '').toLowerCase());
const ADMIN_PASSWORD_MIN = 16;
const ONLINE_WINDOW = Math.round(Number(process.env.ABYSS_ONLINE_WINDOW || 60) * 1000);
const GUEST_WINDOW = 45 * 1000;

// Server-wide monster gate clock: 20 minutes sealed, 7 minutes open, counted
// from process start. /api/world hands this to every client.
const SERVER_START_MS = Date.now();
const PORTAL_CLOSED_SECONDS = 20 * 60;
const PORTAL_OPEN_SECONDS = 7 * 60;

const COOKIE = 'abyss_session';
const ADMIN_COOKIE = 'abyss_admin';
const MAX_BODY = 128 * 1024;
const MAX_PROFILE = 64 * 1024;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const DKLEN = 64;

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
const GUEST_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

const TRUST_PROXY = ['1', 'true', 'yes', 'on'].includes(String(process.env.ABYSS_TRUST_PROXY || '').toLowerCase());
const ADMIN_USER = String(process.env.ABYSS_ADMIN_USER || '').trim();
const ADMIN_USER_RE = /^[A-Za-z0-9_.@-]{3,64}$/;

// Exact IPs or IPv4/IPv6 CIDR blocks. IPv6 entries must be exact addresses.
function parseAllowIps(raw) {
  const out = [];
  for (const part of String(raw || '').split(',')) {
    const entry = part.trim();
    if (!entry) continue;
    const slash = entry.indexOf('/');
    if (slash < 0) {
      if (net.isIP(entry)) out.push({ ip: normalizeIp(entry), bits: null });
      else console.error('[admin] ignoring invalid allowlist entry ' + JSON.stringify(entry));
      continue;
    }
    const base = entry.slice(0, slash);
    const bits = Number(entry.slice(slash + 1));
    if (net.isIP(base) !== 4 || !Number.isInteger(bits) || bits < 0 || bits > 32) {
      console.error('[admin] ignoring invalid allowlist entry ' + JSON.stringify(entry)
        + ' (IPv4 CIDR only)');
      continue;
    }
    out.push({ ip: base, bits: bits });
  }
  return out;
}

function normalizeIp(value) {
  return String(value || '').replace(/^::ffff:/i, '');
}

const ADMIN_ALLOW_IPS = parseAllowIps(process.env.ABYSS_ADMIN_ALLOW_IPS || '');

const ADMIN_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "font-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

function parseAdminHash(raw) {
  const parts = String(raw || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return null;
  if (n < 1024 || r < 1 || p < 1) return null;
  try {
    return {
      N: n, r: r, p: p,
      salt: Buffer.from(parts[4], 'hex'),
      digest: Buffer.from(parts[5], 'hex')
    };
  } catch (e) {
    return null;
  }
}

function buildAdminCredential() {
  const raw = String(process.env.ABYSS_ADMIN_PASSWORD_HASH || '').trim();
  if (raw.startsWith('$argon2id$')) return { kind: 'argon2id', phc: raw };
  const parsed = parseAdminHash(raw);
  if (parsed) return { kind: 'scrypt', scrypt: parsed };
  const password = process.env.ABYSS_ADMIN_PASSWORD || '';
  if (!password) return null;
  if (password.length < ADMIN_PASSWORD_MIN) {
    console.error('[admin] ABYSS_ADMIN_PASSWORD is shorter than ' + ADMIN_PASSWORD_MIN
      + ' characters; admin access stays disabled.');
    return null;
  }
  // A plain-text env password is only the convenience path. The generator
  // writes an Argon2id hash instead; this one keeps the scrypt fallback.
  const salt = crypto.randomBytes(16);
  return {
    kind: 'scrypt',
    scrypt: {
      N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p,
      salt: salt,
      digest: crypto.scryptSync(password, salt, DKLEN, SCRYPT)
    }
  };
}

const ADMIN_CRED = buildAdminCredential();
const ADMIN_HASH_KIND = ADMIN_CRED ? ADMIN_CRED.kind : '';
const ADMIN_READY = Boolean(ADMIN_USER && ADMIN_USER_RE.test(ADMIN_USER) && ADMIN_CRED
  && (ADMIN_HASH_KIND !== 'argon2id' || ARGON2_OK));
if (ADMIN_USER && !ADMIN_USER_RE.test(ADMIN_USER)) {
  console.error('[admin] ABYSS_ADMIN_USER must be 3-64 characters: letters, numbers, . _ @ -');
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'abyss.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT NOT NULL UNIQUE,
    email      TEXT NOT NULL UNIQUE,
    pass_salt  TEXT NOT NULL,
    pass_hash  TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cloud_saves (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    payload    TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS profiles (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    payload    TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    ip         TEXT,
    user_agent TEXT,
    last_used_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS admin_lockouts (
    key          TEXT PRIMARY KEY,
    failures     INTEGER NOT NULL DEFAULT 0,
    first_at     INTEGER NOT NULL,
    locked_until INTEGER NOT NULL DEFAULT 0,
    updated_at   INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
`);

function hasColumn(table, column) {
  return db.prepare("SELECT name FROM pragma_table_info(?)").all(table)
    .some((row) => row.name === column);
}

// Non-destructive migrations - existing accounts and saves are untouched.
if (!hasColumn('users', 'last_login_at')) db.exec('ALTER TABLE users ADD COLUMN last_login_at INTEGER');
if (!hasColumn('users', 'last_seen_at')) db.exec('ALTER TABLE users ADD COLUMN last_seen_at INTEGER');
if (!hasColumn('users', 'disabled')) db.exec('ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0');
if (!hasColumn('admin_sessions', 'last_used_at')) db.exec('ALTER TABLE admin_sessions ADD COLUMN last_used_at INTEGER');
db.exec('UPDATE admin_sessions SET last_used_at = created_at WHERE last_used_at IS NULL');
db.exec('CREATE INDEX IF NOT EXISTS users_last_seen ON users(last_seen_at)');

const q = {
  insertUser: db.prepare(`INSERT INTO users (username, email, pass_salt, pass_hash, created_at,
    last_login_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)`),
  byUsername: db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE'),
  byEmail: db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE'),
  anyUsername: db.prepare('SELECT 1 AS hit FROM users WHERE username = ? COLLATE NOCASE'),
  anyEmail: db.prepare('SELECT 1 AS hit FROM users WHERE email = ? COLLATE NOCASE'),
  addSession: db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'),
  getSession: db.prepare(`SELECT s.user_id, s.expires_at, u.username, u.email, u.created_at,
    u.last_seen_at, u.disabled FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?`),
  dropSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
  touchSeen: db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?'),
  touchLogin: db.prepare('UPDATE users SET last_login_at = ?, last_seen_at = ? WHERE id = ?'),
  prune: db.prepare('DELETE FROM sessions WHERE expires_at < ?'),
  pruneAdmins: db.prepare('DELETE FROM admin_sessions WHERE expires_at < ?'),
  getSave: db.prepare('SELECT payload, updated_at FROM cloud_saves WHERE user_id = ?'),
  putSave: db.prepare(`INSERT INTO cloud_saves (user_id, payload, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`),
  getProfile: db.prepare('SELECT payload FROM profiles WHERE user_id = ?'),
  putProfile: db.prepare(`INSERT INTO profiles (user_id, payload, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`),
  addAdminSession: db.prepare(`INSERT INTO admin_sessions (token_hash, expires_at, created_at, ip, user_agent, last_used_at)
    VALUES (?, ?, ?, ?, ?, ?)`),
  getAdminSession: db.prepare('SELECT expires_at, last_used_at, ip FROM admin_sessions WHERE token_hash = ?'),
  touchAdminSession: db.prepare('UPDATE admin_sessions SET last_used_at = ? WHERE token_hash = ?'),
  trimAdminSessions: db.prepare(`DELETE FROM admin_sessions WHERE token_hash NOT IN
    (SELECT token_hash FROM admin_sessions ORDER BY created_at DESC LIMIT 10)`),
  dropAdminSession: db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?'),
  getLock: db.prepare('SELECT failures, first_at, locked_until FROM admin_lockouts WHERE key = ?'),
  putLock: db.prepare(`INSERT INTO admin_lockouts (key, failures, first_at, locked_until, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET failures = excluded.failures,
      first_at = excluded.first_at, locked_until = excluded.locked_until,
      updated_at = excluded.updated_at`),
  dropLock: db.prepare('DELETE FROM admin_lockouts WHERE key = ?'),
  pruneLocks: db.prepare('DELETE FROM admin_lockouts WHERE locked_until < ? AND first_at < ?')
};

// ---------------------------------------------------------------------------
// Passwords and validation
// ---------------------------------------------------------------------------

function hashPassword(password, saltHex) {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, DKLEN, SCRYPT);
  return { salt: salt.toString('hex'), hash: hash.toString('hex') };
}

function verifyPassword(password, saltHex, expectedHex) {
  let actual;
  try {
    actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), DKLEN, SCRYPT);
  } catch (e) {
    return false;
  }
  let expected;
  try {
    expected = Buffer.from(expectedHex, 'hex');
  } catch (e) {
    return false;
  }
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

async function verifyAdminPassword(password) {
  const pw = String(password == null ? '' : password).slice(0, 1024);
  if (!ADMIN_CRED) {
    // Burn comparable time even when admin access is unconfigured.
    hashPassword(pw || 'x', crypto.randomBytes(16).toString('hex'));
    return false;
  }
  if (ADMIN_CRED.kind === 'argon2id') {
    if (!ARGON2_OK) return false;
    try {
      return Boolean(await hashWasm.argon2Verify({ password: pw, hash: ADMIN_CRED.phc }));
    } catch (e) {
      return false;
    }
  }
  const cred = ADMIN_CRED.scrypt;
  try {
    const actual = crypto.scryptSync(pw, cred.salt, cred.digest.length,
      { N: cred.N, r: cred.r, p: cred.p, maxmem: SCRYPT.maxmem });
    return actual.length === cred.digest.length && crypto.timingSafeEqual(actual, cred.digest);
  } catch (e) {
    return false;
  }
}

const digest = (token) => crypto.createHash('sha256').update(token).digest('hex');

function checkCredentials(username, email, password) {
  if (!USERNAME_RE.test(username)) {
    return 'Username must be 3-20 characters: letters, numbers or underscore.';
  }
  if (email && !EMAIL_RE.test(email)) return 'That email address does not look right.';
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 200) return 'Password is too long.';
  return null;
}

function normaliseIdentifier(raw) {
  const s = String(raw == null ? '' : raw).trim();
  return EMAIL_RE.test(s) ? s.toLowerCase() : s;
}

function cleanName(raw, fallback) {
  const base = String(raw == null ? '' : raw)
    .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
  return base || (fallback === undefined ? 'Guest_1' : fallback);
}

function profileText(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Profile must be an object.');
  }
  const text = JSON.stringify(value);
  if (Buffer.byteLength(text, 'utf8') > MAX_PROFILE) throw new Error('Profile is too large.');
  return text;
}

function loadProfile(userId) {
  const row = q.getProfile.get(userId);
  if (!row) return null;
  try {
    const value = JSON.parse(row.payload);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch (e) {
    return null;
  }
}

function num(value) {
  const n = Math.floor(Number(value) || 0);
  return n > 0 ? n : 0;
}

function profileSummary(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const stats = p.stats && typeof p.stats === 'object' ? p.stats : {};
  const best = p.bestRun && typeof p.bestRun === 'object' ? p.bestRun : null;
  const quests = p.quests && typeof p.quests === 'object' ? p.quests : {};
  const count = (v) => (Array.isArray(v) ? v.length : 0);
  return {
    present: Boolean(payload),
    displayName: p.displayName ? cleanName(p.displayName, '') : '',
    xp: num(p.xp),
    crystals: num(p.crystals),
    currentEvolution: String(p.currentEvolution || '').slice(0, 32),
    unlockedEvolutions: count(p.unlockedEvolutions),
    skins: count(p.skins),
    pets: count(p.pets),
    weapons: count(p.weapons),
    runs: num(stats.runs),
    fishEaten: num(stats.fishEaten),
    playSeconds: num(stats.playSeconds),
    bestRun: best ? {
      xp: num(best.xp),
      stageKey: String(best.stageKey || '').slice(0, 32),
      time: num(best.time)
    } : null,
    questChests: num(quests.chests),
    updatedAt: num(p.updatedAt)
  };
}

function accountRow(row, now) {
  const lastSeen = row.last_seen_at || 0;
  let status = 'active';
  if (row.disabled) status = 'suspended';
  else if (lastSeen >= now - ONLINE_WINDOW) status = 'online';
  return {
    id: row.id,
    username: row.username,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    lastSeenAt: row.last_seen_at,
    status: status
  };
}

// ---------------------------------------------------------------------------
// Rate limiting + presence
// ---------------------------------------------------------------------------

const attempts = new Map();
const WINDOW = 15 * 60 * 1000;
const LIMIT = 8;
const ADMIN_WINDOW = 10 * 60 * 1000;

function throttled(store, key, windowMs, limit) {
  const now = Date.now();
  const hit = store.get(key);
  if (!hit) return false;
  if (now - hit.first > windowMs) { store.delete(key); return false; }
  return hit.count >= limit;
}

function noteAttempt(store, key) {
  const now = Date.now();
  const hit = store.get(key);
  if (!hit || now - hit.first > WINDOW) store.set(key, { first: now, count: 1 });
  else hit.count++;
}

function adminLockRemaining(keys, now) {
  let remaining = 0;
  for (const key of keys) {
    const row = q.getLock.get(key);
    if (!row) continue;
    if (row.locked_until && row.locked_until > now) {
      remaining = Math.max(remaining, row.locked_until - now);
    } else if (!row.locked_until && now - row.first_at > ADMIN_WINDOW) {
      q.dropLock.run(key);
    }
  }
  return remaining;
}

function noteAdminFailure(keys, now) {
  let lockedFor = 0;
  for (const key of keys) {
    const row = q.getLock.get(key);
    if (!row || (!row.locked_until && now - row.first_at > ADMIN_WINDOW)) {
      q.putLock.run(key, 1, now, 0, now);
      continue;
    }
    const failures = row.failures + 1;
    let lockedUntil = row.locked_until || 0;
    if (failures >= ADMIN_MAX_FAILS && failures % ADMIN_MAX_FAILS === 0) {
      const level = Math.floor(failures / ADMIN_MAX_FAILS);
      const span = Math.min(ADMIN_LOCK_MS * Math.pow(2, Math.min(3, level - 1)), 3600000);
      lockedUntil = now + span;
    }
    q.putLock.run(key, failures, row.first_at, lockedUntil, now);
    if (lockedUntil > now) lockedFor = Math.max(lockedFor, lockedUntil - now);
  }
  return lockedFor;
}

function clearAdminFailures(keys) {
  for (const key of keys) q.dropLock.run(key);
}

const guestsOnline = new Map();

function pruneGuests(now) {
  for (const [gid, rec] of guestsOnline) {
    if (now - rec.last > GUEST_WINDOW * 4) guestsOnline.delete(gid);
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of attempts) if (now - v.first > WINDOW) attempts.delete(k);
  q.prune.run(now);
  q.pruneAdmins.run(now);
  q.pruneLocks.run(now - 86400000, now - 86400000);
  pruneGuests(now);
}, 60 * 1000).unref();

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2'
};

function sendJson(res, status, body, headers) {
  const text = JSON.stringify(body);
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  }, headers || {}));
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        const err = new Error('Request is too large.');
        err.status = 413;
        chunks.length = 0;
        req.removeAllListeners('data');
        req.resume();
        reject(err);
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) { resolve({}); return; }
      try {
        const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(value && typeof value === 'object' && !Array.isArray(value) ? value : {});
      } catch (e) {
        const err = new Error('That request was not valid JSON.');
        err.status = 400;
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie;
  if (!raw) return out;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    let value = part.slice(i + 1).trim();
    try { value = decodeURIComponent(value); } catch (e) { /* keep raw */ }
    out[key] = value;
  }
  return out;
}

function isHttps(req) {
  const mode = String(process.env.ABYSS_COOKIE_SECURE || 'auto').toLowerCase();
  if (mode === 'always') return true;
  if (mode === 'never') return false;
  if (TRUST_PROXY) {
    const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
    if (proto) return proto === 'https';
  }
  return Boolean(req.socket && req.socket.encrypted);
}

function cookie(name, token, maxAge, req) {
  let out = name + '=' + token + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=' + Math.floor(maxAge / 1000);
  if (isHttps(req)) out += '; Secure';
  return out;
}

function sessionCookie(token, maxAge, req) {
  return cookie(COOKIE, token, maxAge, req);
}

function adminCookie(token, maxAge, req) {
  return cookie(ADMIN_COOKIE, token, maxAge, req);
}

function clientIp(req) {
  if (TRUST_PROXY) {
    for (const header of ['cf-connecting-ip', 'x-forwarded-for', 'x-real-ip']) {
      const raw = req.headers[header];
      if (!raw) continue;
      const candidate = String(raw).split(',')[0].trim();
      if (net.isIP(candidate)) return normalizeIp(candidate);
    }
  }
  const raw = (req.socket && req.socket.remoteAddress) || 'unknown';
  return net.isIP(raw) ? normalizeIp(raw) : raw;
}

function ipv4ToInt(ip) {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function adminIpAllowed(req) {
  if (!ADMIN_ALLOW_IPS.length) return true;
  const ip = normalizeIp(clientIp(req));
  if (!net.isIP(ip)) return false;
  for (const entry of ADMIN_ALLOW_IPS) {
    if (entry.bits === null) {
      if (entry.ip === ip) return true;
      continue;
    }
    if (net.isIP(ip) !== 4) continue;
    const mask = entry.bits === 0 ? 0 : (0xFFFFFFFF << (32 - entry.bits)) >>> 0;
    if ((ipv4ToInt(ip) & mask) === (ipv4ToInt(entry.ip) & mask)) return true;
  }
  return false;
}

function adminOriginOk(req) {
  const site = String(req.headers['sec-fetch-site'] || '').toLowerCase();
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const origin = String(req.headers.origin || '').trim();
  if (!origin) return true;
  if (origin.toLowerCase() === 'null') return false;
  let parsed;
  try { parsed = new URL(origin); } catch (e) { return false; }
  const host = String(req.headers.host || '').toLowerCase();
  return Boolean(host) && parsed.host.toLowerCase() === host
    && (parsed.protocol === 'http:' || parsed.protocol === 'https:');
}

function currentUser(req) {
  const token = parseCookies(req)[COOKIE];
  if (!token || token.length !== 64) return null;
  const row = q.getSession.get(digest(token));
  if (!row) return null;
  const now = Date.now();
  if (row.expires_at < now) { q.dropSession.run(digest(token)); return null; }
  if (!row.disabled && now - (row.last_seen_at || 0) > 20000) {
    q.touchSeen.run(now, row.user_id);
  }
  if (row.disabled) return null;
  return {
    token: token, id: row.user_id, username: row.username,
    email: row.email, createdAt: row.created_at
  };
}

function startSession(res, req, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  q.addSession.run(digest(token), userId, now + SESSION_TTL, now);
  res.setHeader('Set-Cookie', sessionCookie(token, SESSION_TTL, req));
}

function currentAdmin(req) {
  const token = parseCookies(req)[ADMIN_COOKIE];
  if (!token || token.length !== 64) return null;
  const now = Date.now();
  const row = q.getAdminSession.get(digest(token));
  if (!row) return null;
  const idleFrom = row.last_used_at || (row.expires_at - ADMIN_SESSION_TTL);
  if (row.expires_at < now || now - idleFrom > ADMIN_IDLE_TTL) {
    q.dropAdminSession.run(digest(token));
    return null;
  }
  if (ADMIN_BIND_IP && row.ip && row.ip !== clientIp(req)) return null;
  if (now - (row.last_used_at || 0) > 60000) {
    q.touchAdminSession.run(now, digest(token));
  }
  return { username: ADMIN_USER, expiresAt: row.expires_at };
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function handleAdmin(req, res, pathname) {
  const method = req.method;

  if (!adminOriginOk(req)) {
    sendJson(res, 403, { error: 'This request was not made from the console.' });
    return;
  }
  if (!adminIpAllowed(req)) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  if (pathname === '/api/admin/login' && method === 'POST') {
    if (!ADMIN_READY) {
      const reason = ADMIN_HASH_KIND === 'argon2id' && !ARGON2_OK
        ? 'Administrator access needs the hash-wasm verifier on this server.'
        : 'Administrator access is not configured on this server.';
      sendJson(res, 503, { error: reason });
      return;
    }

    const ip = clientIp(req);
    const now = Date.now();
    const keys = ['admin-ip:' + ip, 'admin-user:' + ADMIN_USER.toLowerCase()];
    const locked = adminLockRemaining(keys, now);
    if (locked) {
      sendJson(res, 429, {
        error: 'Too many sign-in attempts. Try again in '
          + Math.max(1, Math.ceil(locked / 60000)) + ' minute(s).'
      }, { 'Retry-After': String(Math.max(1, Math.ceil(locked / 1000))) });
      return;
    }

    const b = await readBody(req);
    const username = String(b.username == null ? '' : b.username);
    const password = String(b.password == null ? '' : b.password);
    const userBuf = Buffer.from(username, 'utf8');
    const adminBuf = Buffer.from(ADMIN_USER, 'utf8');
    // Always hash, whatever the username, so both checks cost the same time.
    const okPass = await verifyAdminPassword(password);
    const okUser = userBuf.length === adminBuf.length && crypto.timingSafeEqual(userBuf, adminBuf);
    if (!(okUser && okPass)) {
      const wait = noteAdminFailure(keys, now);
      console.error('[admin] failed sign-in ip=' + ip + ' user=' + JSON.stringify(username.slice(0, 64))
        + ' at=' + now);
      if (wait) {
        sendJson(res, 429, {
          error: 'Too many sign-in attempts. Try again in '
            + Math.max(1, Math.ceil(wait / 60000)) + ' minute(s).'
        }, { 'Retry-After': String(Math.max(1, Math.ceil(wait / 1000))) });
      } else {
        sendJson(res, 401, { error: 'Invalid administrator credentials.' });
      }
      return;
    }

    clearAdminFailures(keys);
    const token = crypto.randomBytes(32).toString('hex');
    q.pruneAdmins.run(now);
    q.addAdminSession.run(digest(token), now + ADMIN_SESSION_TTL, now, ip,
      String(req.headers['user-agent'] || '').slice(0, 200), now);
    q.trimAdminSessions.run();
    sendJson(res, 200, {
      ok: true,
      admin: { username: ADMIN_USER, expiresAt: now + ADMIN_SESSION_TTL }
    }, { 'Set-Cookie': adminCookie(token, ADMIN_SESSION_TTL, req) });
    return;
  }

  if (pathname === '/api/admin/session' && method === 'GET') {
    const me = currentAdmin(req);
    sendJson(res, 200, {
      authenticated: Boolean(me),
      configured: ADMIN_READY,
      admin: me ? { username: me.username, expiresAt: me.expiresAt } : null
    });
    return;
  }

  if (pathname === '/api/admin/logout' && method === 'POST') {
    const token = parseCookies(req)[ADMIN_COOKIE];
    if (token) q.dropAdminSession.run(digest(token));
    sendJson(res, 200, { ok: true }, { 'Set-Cookie': adminCookie('', 0, req) });
    return;
  }

  if (!currentAdmin(req)) {
    sendJson(res, 401, { error: 'Administrator sign-in required.' });
    return;
  }

  const url = new URL(req.url || '/', 'http://localhost');

  if (pathname === '/api/admin/stats' && method === 'GET') {
    const now = Date.now();
    pruneGuests(now);
    const total = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
    const online = db.prepare('SELECT COUNT(*) AS c FROM users WHERE last_seen_at >= ?')
      .get(now - ONLINE_WINDOW).c;
    const new24 = db.prepare('SELECT COUNT(*) AS c FROM users WHERE created_at >= ?')
      .get(now - 86400000).c;
    const newest = db.prepare('SELECT MAX(created_at) AS t FROM users').get().t;
    let guests = 0;
    for (const rec of guestsOnline.values()) if (now - rec.last <= GUEST_WINDOW) guests++;
    sendJson(res, 200, {
      ok: true,
      stats: {
        registeredAccounts: total,
        accountsCreated: total,
        registeredOnline: online,
        guestsOnline: guests,
        newAccounts24h: new24,
        newestAccountAt: newest,
        generatedAt: now,
        onlineWindowSeconds: Math.floor(ONLINE_WINDOW / 1000)
      }
    });
    return;
  }

  if (pathname === '/api/admin/players' && method === 'GET') {
    const search = String(url.searchParams.get('q') || '').trim().slice(0, 40);
    const sortMap = {
      username: 'username COLLATE NOCASE',
      id: 'id',
      created: 'created_at',
      lastLogin: 'COALESCE(last_login_at, 0)',
      lastSeen: 'COALESCE(last_seen_at, 0)',
      status: 'disabled'
    };
    const sort = sortMap[url.searchParams.get('sort')] || 'created_at';
    const dir = String(url.searchParams.get('dir') || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    let limit = Number(url.searchParams.get('limit') || 25);
    if (!Number.isFinite(limit)) limit = 25;
    limit = Math.max(1, Math.min(100, Math.floor(limit)));
    let offset = Number(url.searchParams.get('offset') || 0);
    if (!Number.isFinite(offset)) offset = 0;
    offset = Math.max(0, Math.min(100000, Math.floor(offset)));

    let where = '';
    const params = [];
    if (search) {
      const escaped = search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      where = " WHERE username LIKE ? ESCAPE '\\' COLLATE NOCASE";
      params.push('%' + escaped + '%');
    }

    const now = Date.now();
    const total = db.prepare('SELECT COUNT(*) AS c FROM users' + where).get(...params).c;
    const rows = db.prepare(
      'SELECT id, username, created_at, last_login_at, last_seen_at, disabled FROM users' +
      where + ' ORDER BY ' + sort + ' ' + dir + ' LIMIT ? OFFSET ?'
    ).all(...params, limit, offset);

    sendJson(res, 200, {
      ok: true,
      players: rows.map((row) => accountRow(row, now)),
      total: total,
      limit: limit,
      offset: offset,
      now: now
    });
    return;
  }

  const match = /^\/api\/admin\/players\/(\d{1,12})$/.exec(pathname);
  if (match && method === 'GET') {
    const id = Number(match[1]);
    const row = db.prepare(
      'SELECT id, username, created_at, last_login_at, last_seen_at, disabled FROM users WHERE id = ?'
    ).get(id);
    if (!row) { sendJson(res, 404, { error: 'No such player.' }); return; }
    const player = accountRow(row, Date.now());
    player.profile = profileSummary(loadProfile(id));
    sendJson(res, 200, { ok: true, player: player });
    return;
  }

  if (pathname === '/api/admin/guests' && method === 'GET') {
    const now = Date.now();
    pruneGuests(now);
    const guests = [];
    for (const [gid, rec] of guestsOnline) {
      if (now - rec.last <= GUEST_WINDOW) {
        guests.push({ id: gid, name: rec.name, firstSeenAt: rec.first, lastSeenAt: rec.last });
      }
    }
    guests.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
    sendJson(res, 200, { ok: true, guests: guests, now: now, totalOnline: guests.length });
    return;
  }

  sendJson(res, 404, { error: 'No such endpoint.' });
}

async function handleApi(req, res, pathname) {
  const method = req.method;

  if (pathname === '/api/health') {
    sendJson(res, 200, { ok: true, service: 'abyss-auth', accounts: true });
    return;
  }

  // Every mutating call has to come from our own page.
  if (method !== 'GET' && method !== 'HEAD' && req.headers['x-requested-with'] !== 'ABYSS') {
    sendJson(res, 403, { error: 'This request has to come from the game.' });
    return;
  }

  if (pathname === '/api/admin' || pathname.startsWith('/api/admin/')) {
    await handleAdmin(req, res, pathname);
    return;
  }

  if (pathname === '/api/signup' && method === 'POST') {
    const b = await readBody(req);
    const username = String(b.username == null ? '' : b.username).trim();
    let email = String(b.email == null ? '' : b.email).trim().toLowerCase();
    const password = String(b.password == null ? '' : b.password);
    const confirm = String(b.confirm == null ? '' : b.confirm);

    const bad = checkCredentials(username, email, password);
    if (bad) { sendJson(res, 400, { error: bad }); return; }
    if (password !== confirm) { sendJson(res, 400, { error: 'The two passwords do not match.' }); return; }

    let profileJson = null;
    if (b.profile !== undefined) {
      try { profileJson = profileText(b.profile); }
      catch (err) { sendJson(res, 400, { error: err.message }); return; }
    }

    if (q.anyUsername.get(username)) {
      sendJson(res, 409, { error: 'That username is taken.', field: 'username' });
      return;
    }
    if (!email) email = username.toLowerCase() + '@players.abyss.local';
    if (q.anyEmail.get(email)) {
      if (b.email) { sendJson(res, 409, { error: 'An account already uses that email.' }); return; }
      email = username.toLowerCase() + '.' + crypto.randomBytes(3).toString('hex') + '@players.abyss.local';
    }

    const { salt, hash } = hashPassword(password);
    const now = Date.now();
    const info = q.insertUser.run(username, email, salt, hash, now, now, now);
    const userId = Number(info.lastInsertRowid);
    if (profileJson !== null) q.putProfile.run(userId, profileJson, now);
    startSession(res, req, userId);
    sendJson(res, 200, {
      ok: true,
      user: { id: userId, username: username, createdAt: now },
      profile: loadProfile(userId)
    });
    return;
  }

  if (pathname === '/api/login' && method === 'POST') {
    const b = await readBody(req);
    const identifier = normaliseIdentifier(b.identifier) || String(b.username || '').trim();
    const password = String(b.password == null ? '' : b.password);
    const key = clientIp(req) + '|' + identifier.toLowerCase();

    if (throttled(attempts, key, WINDOW, LIMIT)) {
      sendJson(res, 429, { error: 'Too many attempts. Wait a few minutes and try again.' });
      return;
    }
    noteAttempt(attempts, key);

    const row = (EMAIL_RE.test(identifier) ? q.byEmail.get(identifier) : q.byUsername.get(identifier)) ||
      (function () {
        hashPassword(password, crypto.randomBytes(16).toString('hex'));
        return null;
      })();

    if (!row || !verifyPassword(password, row.pass_salt, row.pass_hash)) {
      sendJson(res, 401, { error: 'Wrong username/email or password.' });
      return;
    }
    if (row.disabled) { sendJson(res, 403, { error: 'This account has been suspended.' }); return; }

    attempts.delete(key);
    const now = Date.now();
    q.touchLogin.run(now, now, row.id);
    startSession(res, req, row.id);
    sendJson(res, 200, {
      ok: true,
      user: { id: row.id, username: row.username, createdAt: row.created_at },
      profile: loadProfile(row.id)
    });
    return;
  }

  if (pathname === '/api/logout' && method === 'POST') {
    const me = currentUser(req);
    if (me) q.dropSession.run(digest(me.token));
    sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0, req) });
    return;
  }

  if (pathname === '/api/me' && method === 'GET') {
    const me = currentUser(req);
    if (!me) { sendJson(res, 200, { user: null }); return; }
    sendJson(res, 200, {
      user: { id: me.id, username: me.username, createdAt: me.createdAt },
      profile: loadProfile(me.id)
    });
    return;
  }

  if (pathname === '/api/profile') {
    const me = currentUser(req);
    if (!me) { sendJson(res, 401, { error: 'You are not signed in.' }); return; }
    if (method === 'GET') {
      sendJson(res, 200, { profile: loadProfile(me.id) });
      return;
    }
    if (method === 'PUT') {
      const b = await readBody(req);
      let text;
      try { text = profileText(b.profile); }
      catch (err) { sendJson(res, 400, { error: err.message }); return; }
      const now = Date.now();
      q.putProfile.run(me.id, text, now);
      q.touchSeen.run(now, me.id);
      sendJson(res, 200, { ok: true, profile: JSON.parse(text), savedAt: now });
      return;
    }
  }

  if (pathname === '/api/presence' && method === 'POST') {
    const b = await readBody(req);
    const name = cleanName(b.name);
    const gid = String(b.id == null ? '' : b.id).trim();
    const me = currentUser(req);
    if (me) {
      // Drop any guest entry this browser left behind before signing in, so
      // one player is never counted twice.
      if (GUEST_ID_RE.test(gid)) guestsOnline.delete(gid);
      sendJson(res, 200, { ok: true, registered: true });
      return;
    }
    if (!GUEST_ID_RE.test(gid)) { sendJson(res, 400, { error: 'Unknown guest identifier.' }); return; }
    const now = Date.now();
    const rec = guestsOnline.get(gid);
    guestsOnline.set(gid, { name: name, first: rec ? rec.first : now, last: now });
    if (guestsOnline.size > 20000) pruneGuests(now);
    sendJson(res, 200, { ok: true, registered: false });
    return;
  }

  if (pathname === '/api/world' && method === 'GET') {
    // Public read-only snapshot for the leaderboard and the monster gate
    // clock: display names and lifetime XP only.
    const current = Date.now();
    const rows = db.prepare(
      'SELECT u.username AS username, p.payload AS payload ' +
      'FROM users u LEFT JOIN profiles p ON p.user_id = u.id ' +
      'WHERE u.last_seen_at >= ? ORDER BY u.last_seen_at DESC LIMIT 50'
    ).all(current - ONLINE_WINDOW);
    const online = rows.map(function (row) {
      let payload = {};
      if (row.payload) {
        try {
          const parsed = JSON.parse(row.payload);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) payload = parsed;
        } catch (e) { payload = {}; }
      }
      const xp = Math.max(0, Math.floor(Number(payload.xp) || 0));
      const name = cleanName(payload.displayName, '') || row.username;
      return { name: name, xp: xp };
    });
    sendJson(res, 200, {
      ok: true,
      now: current,
      startedAt: SERVER_START_MS,
      portal: {
        closedSeconds: PORTAL_CLOSED_SECONDS,
        openSeconds: PORTAL_OPEN_SECONDS
      },
      online: online,
      onlineWindowSeconds: Math.floor(ONLINE_WINDOW / 1000)
    });
    return;
  }

  if (pathname === '/api/save') {
    const me = currentUser(req);
    if (!me) { sendJson(res, 401, { error: 'You are not signed in.' }); return; }

    if (method === 'GET') {
      const row = q.getSave.get(me.id);
      if (!row) { sendJson(res, 200, { save: null }); return; }
      let payload;
      try { payload = JSON.parse(row.payload); } catch (e) { payload = null; }
      sendJson(res, 200, { save: payload, updatedAt: row.updated_at });
      return;
    }

    if (method === 'PUT') {
      const b = await readBody(req);
      const save = b.save;
      if (!save || typeof save !== 'object') { sendJson(res, 400, { error: 'Nothing to save.' }); return; }
      const payload = JSON.stringify({
        xp: Math.max(0, Math.floor(Number(save.xp) || 0)),
        stageKey: String(save.stageKey || '').slice(0, 24),
        stageIndex: Math.max(0, Math.floor(Number(save.stageIndex) || 0)),
        time: Math.max(0, Math.floor(Number(save.time) || 0)),
        runs: Math.max(0, Math.floor(Number(save.runs) || 0)),
        eaten: Math.max(0, Math.floor(Number(save.eaten) || 0))
      });
      if (payload.length > 4000) { sendJson(res, 413, { error: 'Save is too large.' }); return; }
      q.putSave.run(me.id, payload, Date.now());
      sendJson(res, 200, { ok: true, savedAt: Date.now() });
      return;
    }
  }

  sendJson(res, 404, { error: 'No such endpoint.' });
}

// ---------------------------------------------------------------------------
// Admin page + static files
// ---------------------------------------------------------------------------

function serveAdmin(req, res, pathname) {
  const name = decodeURIComponent(pathname.slice('/admin'.length)).replace(/^[/\\]+/, '') || 'index.html';
  if (!['index.html', 'app.js', 'style.css'].includes(name)) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }
  const target = path.join(ADMIN_DIR, name);
  fs.readFile(target, (err, blob) => {
    if (err) { sendJson(res, 404, { error: 'Not found' }); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(name).toLowerCase()] || 'application/octet-stream',
      'Content-Length': blob.length,
      'Cache-Control': 'no-store',
      'Content-Security-Policy': ADMIN_CSP,
      'X-Frame-Options': 'DENY',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    });
    res.end(req.method === 'HEAD' ? undefined : blob);
  });
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/index.html';
  const lowered = rel.toLowerCase();
  if (lowered === '/server' || lowered.startsWith('/server/') || lowered.includes('/server/')) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }
  if (rel.replace(/\\/g, '/').split('/').some((part) => part.startsWith('.'))) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }
  const target = path.resolve(ROOT, rel.replace(/^[/\\]+/, ''));
  if (!(target === ROOT || target.startsWith(ROOT + path.sep)) || target === BASE || target.startsWith(BASE + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(target, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(target).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(target).pipe(res);
  });
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 8730;
const HOST = '0.0.0.0'; // Forcé à 0.0.0.0 pour Railway
const server = http.createServer((req, res) => {
  // Keep the path encoded here; serveStatic/serveAdmin decode exactly once.
  const pathname = (req.url || '/').split('?')[0];

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  if (isHttps(req)) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/')
    || pathname === '/api/admin' || pathname.startsWith('/api/admin/');
  if (isAdminPath && !adminIpAllowed(req)) {
    // Outside the allowlist the console does not exist.
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  if (pathname.startsWith('/api/')) {
    Promise.resolve(handleApi(req, res, pathname)).catch((e) => {
      if (res.headersSent) { try { res.end(); } catch (ignored) { /* closed */ } return; }
      sendJson(res, e && e.status ? e.status : 400, { error: (e && e.message) || 'Bad request.' });
    });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end();
    return;
  }
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    serveAdmin(req, res, pathname);
    return;
  }
  serveStatic(req, res, pathname);
});

server.on('error', (err) => {
  if (err && (err.code === 'EADDRINUSE' || err.code === 'EACCES') && portTry < 12) {
    portTry++;
    server.listen(PORT + portTry, HOST);
    return;
  }
  console.error('ABYSS.IO could not open a port (' + (err && err.code) + ').');
  console.error('Close whatever is using ' + HOST + ':' + PORT + ' and run this again.');
});

server.listen(PORT, HOST, () => {
  const url = 'http://' + HOST + ':' + PORT;
  console.log('');
  console.log('  ABYSS.IO  -  account server is up');
  console.log('  play here:  ' + url);
  console.log('  admin:      ' + url + '/admin');
  console.log('  database:   ' + path.join(DATA_DIR, 'abyss.db'));
  if (ADMIN_READY) {
    console.log('  admin gate: user "' + ADMIN_USER + '" (password hashing: ' + ADMIN_HASH_KIND + ')');
    console.log('  admin idle: ' + (ADMIN_IDLE_TTL / 60000) + ' min, absolute: '
      + (ADMIN_SESSION_TTL / 3600000) + ' h, lockout after ' + ADMIN_MAX_FAILS + ' failures');
    if (ADMIN_ALLOW_IPS.length) {
      console.log('  admin ip allowlist: ' + ADMIN_ALLOW_IPS.map((e) => e.bits === null
        ? e.ip : e.ip + '/' + e.bits).join(', '));
    }
    if (ADMIN_BIND_IP) console.log('  admin sessions are bound to the sign-in IP');
    if (ADMIN_HASH_KIND === 'scrypt') {
      console.log('  note: this credential uses the scrypt fallback; run');
      console.log('        python server/hash_admin_password.py --write-env for Argon2id.');
    }
  } else {
    console.log('');
    console.log('  ADMIN ACCESS IS NOT CONFIGURED YET.');
    console.log('  Run: python server/hash_admin_password.py --write-env');
    console.log('  or set ABYSS_ADMIN_USER and ABYSS_ADMIN_PASSWORD_HASH yourself.');
  }
  if (TRUST_PROXY) {
    console.log('  proxy: trusting CF-Connecting-IP / X-Forwarded-For / Forwarded-Proto');
  }
  console.log('');
  console.log('  leave this window open while you play. Ctrl+C stops it.');
  console.log('');
});
