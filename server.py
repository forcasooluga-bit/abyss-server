"""
ABYSS.IO server - accounts, cloud profiles and the private admin dashboard.

Standard library only. Node twin lives in server.js and shares the same
SQLite file and the same endpoints, so an account made by one is understood
by the other.

Security model
--------------
* Players authenticate with an HttpOnly `abyss_session` cookie. The database
  stores only a SHA-256 digest of that token.
* The administrator is NOT a row in `users`. Admin identity comes from the
  process environment (ABYSS_ADMIN_USER + ABYSS_ADMIN_PASSWORD_HASH or
  ABYSS_ADMIN_PASSWORD). There is no signup path, role column or endpoint
  that can grant admin rights to a player.
* Every /api/admin/* request re-validates a separate HttpOnly `abyss_admin`
  cookie against the `admin_sessions` table. The dashboard is not protected
  by hiding a URL.
* Passwords, password hashes, e-mails and session tokens are never returned
  by any endpoint.
"""

import hashlib
import hmac
import ipaddress
import json
import math
import mimetypes
import os
import re
import secrets
import sqlite3
import sys
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

try:
    from argon2 import PasswordHasher as _Argon2Hasher
    from argon2.exceptions import Argon2Error as _Argon2Error
except ImportError:  # optional: scrypt still works when the package is absent
    _Argon2Hasher = None
    _Argon2Error = Exception

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
ADMIN_DIR = os.path.join(BASE, 'admin')


def load_env_file(path):
    """Optional convenience for Windows hosts: KEY=VALUE lines in server/.env.

    Real environment variables always win. The file is never served to the
    browser (the whole /server tree is blocked by the static handler).
    """
    try:
        with open(path, 'r', encoding='utf-8') as fh:
            for raw in fh:
                line = raw.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = value
    except OSError:
        pass


load_env_file(os.path.join(BASE, '.env'))

DATA_DIR = os.environ.get('ABYSS_DATA_DIR') or os.path.join(BASE, 'data')
PORT = int(os.environ.get('ABYSS_PORT', '8730'))
HOST = os.environ.get('ABYSS_HOST', '127.0.0.1')

SESSION_TTL = 60 * 60 * 24 * 30
ADMIN_SESSION_TTL = int(float(os.environ.get('ABYSS_ADMIN_SESSION_HOURS', '8')) * 3600 * 1000)
ADMIN_IDLE_TTL = int(float(os.environ.get('ABYSS_ADMIN_IDLE_MINUTES', '60')) * 60 * 1000)
ADMIN_MAX_FAILS = max(3, int(float(os.environ.get('ABYSS_ADMIN_MAX_FAILS', '5'))))
ADMIN_LOCK_MS = int(float(os.environ.get('ABYSS_ADMIN_LOCK_MINUTES', '15')) * 60 * 1000)
ADMIN_BIND_IP = os.environ.get('ABYSS_ADMIN_BIND_IP', '').lower() in ('1', 'true', 'yes', 'on')
ADMIN_PASSWORD_MIN = 16
ONLINE_WINDOW = int(float(os.environ.get('ABYSS_ONLINE_WINDOW', '60')) * 1000)
GUEST_WINDOW = 45 * 1000

COOKIE = 'abyss_session'
ADMIN_COOKIE = 'abyss_admin'
MAX_BODY = 128 * 1024
MAX_PROFILE = 64 * 1024
SCRYPT_N, SCRYPT_R, SCRYPT_P, DKLEN = 16384, 8, 1, 64
SCRYPT_MAXMEM = 64 * 1024 * 1024

USERNAME_RE = re.compile(r'^[A-Za-z0-9_]{3,20}$')
EMAIL_RE = re.compile(r'^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$')
GUEST_ID_RE = re.compile(r'^[A-Za-z0-9_-]{8,64}$')

TRUST_PROXY = os.environ.get('ABYSS_TRUST_PROXY', '').lower() in ('1', 'true', 'yes', 'on')
ADMIN_USER = os.environ.get('ABYSS_ADMIN_USER', '').strip()
ADMIN_USER_RE = re.compile(r'^[A-Za-z0-9_.@-]{3,64}$')


def parse_allow_ips(raw):
    """Comma separated exact IPs or CIDR blocks for ABYSS_ADMIN_ALLOW_IPS."""
    nets = []
    for part in str(raw or '').split(','):
        part = part.strip()
        if not part:
            continue
        try:
            nets.append(ipaddress.ip_network(part, strict=False))
        except ValueError:
            sys.stderr.write('[admin] ignoring invalid allowlist entry %r\n' % part)
    return nets


ADMIN_ALLOW_IPS = parse_allow_ips(os.environ.get('ABYSS_ADMIN_ALLOW_IPS', ''))

MIME = {
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
    '.woff2': 'font/woff2',
}

ADMIN_CSP = (
    "default-src 'none'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data:; "
    "connect-src 'self'; "
    "font-src 'self'; "
    "base-uri 'none'; "
    "form-action 'self'; "
    "frame-ancestors 'none'"
)


def parse_admin_hash(raw):
    """scrypt$N$r$p$salt_hex$hash_hex -> (n, r, p, salt, digest) or None."""
    parts = str(raw or '').split('$')
    if len(parts) != 6 or parts[0] != 'scrypt':
        return None
    try:
        n, r, p = int(parts[1]), int(parts[2]), int(parts[3])
        salt = bytes.fromhex(parts[4])
        expected = bytes.fromhex(parts[5])
    except (TypeError, ValueError):
        return None
    if n < 1024 or r < 1 or p < 1 or not salt or not expected:
        return None
    return n, r, p, salt, expected


ARGON2 = (_Argon2Hasher(time_cost=3, memory_cost=65536, parallelism=4,
                        hash_len=32, salt_len=16) if _Argon2Hasher else None)


def build_admin_credential():
    """('argon2id', phc_string) or ('scrypt', (n, r, p, salt, digest))."""
    raw = os.environ.get('ABYSS_ADMIN_PASSWORD_HASH', '').strip()
    if raw.startswith('$argon2id$'):
        return ('argon2id', raw)
    parsed = parse_admin_hash(raw)
    if parsed:
        return ('scrypt', parsed)
    password = os.environ.get('ABYSS_ADMIN_PASSWORD', '')
    if not password:
        return None
    if len(password) < ADMIN_PASSWORD_MIN:
        sys.stderr.write('[admin] ABYSS_ADMIN_PASSWORD is shorter than %d characters; '
                         'admin access stays disabled.\n' % ADMIN_PASSWORD_MIN)
        return None
    if ARGON2 is not None:
        return ('argon2id', ARGON2.hash(password))
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode('utf-8'), salt=salt, n=SCRYPT_N,
                            r=SCRYPT_R, p=SCRYPT_P, dklen=DKLEN,
                            maxmem=SCRYPT_MAXMEM)
    return ('scrypt', (SCRYPT_N, SCRYPT_R, SCRYPT_P, salt, digest))


ADMIN_CRED = build_admin_credential()
ADMIN_HASH_KIND = ADMIN_CRED[0] if ADMIN_CRED else ''
ADMIN_READY = bool(ADMIN_USER and ADMIN_CRED and ADMIN_USER_RE.match(ADMIN_USER)
                   and (ADMIN_HASH_KIND != 'argon2id' or ARGON2 is not None))
if ADMIN_USER and not ADMIN_USER_RE.match(ADMIN_USER):
    sys.stderr.write('[admin] ABYSS_ADMIN_USER must be 3-64 characters: letters, numbers, . _ @ -\n')

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

os.makedirs(DATA_DIR, exist_ok=True)
db = sqlite3.connect(os.path.join(DATA_DIR, 'abyss.db'), check_same_thread=False)
db.row_factory = sqlite3.Row
db.execute('PRAGMA journal_mode = WAL')
db.execute('PRAGMA foreign_keys = ON')
db.executescript("""
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
""")
db.commit()


def table_columns(name):
    try:
        return {row[1] for row in db.execute('PRAGMA table_info(%s)' % name)}
    except sqlite3.DatabaseError:
        return set()


# Non-destructive migrations: existing accounts, sessions and saves are kept.
for _column, _ddl in (
    ('last_login_at', 'ALTER TABLE users ADD COLUMN last_login_at INTEGER'),
    ('last_seen_at', 'ALTER TABLE users ADD COLUMN last_seen_at INTEGER'),
    ('disabled', "ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0"),
):
    if _column not in table_columns('users'):
        db.execute(_ddl)
if 'last_used_at' not in table_columns('admin_sessions'):
    db.execute('ALTER TABLE admin_sessions ADD COLUMN last_used_at INTEGER')
db.execute('UPDATE admin_sessions SET last_used_at = created_at WHERE last_used_at IS NULL')
db.execute('CREATE INDEX IF NOT EXISTS users_last_seen ON users(last_seen_at)')
db.commit()

lock = threading.Lock()
presence_lock = threading.Lock()
guests_online = {}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def now_ms():
    return int(time.time() * 1000)


# The monster gate is a server-wide window: 20 minutes sealed, 7 minutes open,
# measured from the moment this process started. /api/world hands the start
# time to every client so all of them agree on the countdown.
SERVER_START_MS = now_ms()
PORTAL_CLOSED_SECONDS = 20 * 60
PORTAL_OPEN_SECONDS = 7 * 60


def scrypt(password, salt_bytes, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=DKLEN):
    return hashlib.scrypt(password.encode('utf-8'), salt=salt_bytes,
                          n=n, r=r, p=p, dklen=dklen, maxmem=SCRYPT_MAXMEM)


def hash_password(password, salt_hex=None):
    salt = bytes.fromhex(salt_hex) if salt_hex else secrets.token_bytes(16)
    return salt.hex(), scrypt(password, salt).hex()


def verify_password(password, salt_hex, expected_hex):
    try:
        actual = scrypt(password, bytes.fromhex(salt_hex))
        expected = bytes.fromhex(expected_hex)
    except (ValueError, TypeError):
        return False
    return len(expected) == len(actual) and hmac.compare_digest(actual, expected)


def verify_admin_password(password):
    pw = (password or '')[:1024]
    if not ADMIN_CRED:
        # Burn comparable time even when admin access is unconfigured, so the
        # response does not advertise that fact through latency alone.
        try:
            if ARGON2 is not None:
                ARGON2.hash(pw or 'x')
            else:
                hash_password(pw or 'x', secrets.token_hex(16))
        except (ValueError, TypeError):
            pass
        return False
    kind, data = ADMIN_CRED
    if kind == 'argon2id':
        if ARGON2 is None:
            return False
        try:
            return bool(ARGON2.verify(data, pw))
        except _Argon2Error:
            return False
        except (ValueError, TypeError):
            return False
    n, r, p, salt, expected = data
    try:
        actual = scrypt(pw, salt, n, r, p, len(expected))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


def digest(token):
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def check_credentials(username, email, password):
    if not USERNAME_RE.match(username):
        return 'Username must be 3-20 characters: letters, numbers or underscore.'
    if email and not EMAIL_RE.match(email):
        return 'That email address does not look right.'
    if len(password) < 8:
        return 'Password must be at least 8 characters.'
    if len(password) > 200:
        return 'Password is too long.'
    return None


def normalise_identifier(raw):
    s = str(raw or '').strip()
    return s.lower() if EMAIL_RE.match(s) else s


def clean_name(raw, fallback='Guest_1'):
    s = str(raw or '')
    s = ''.join(ch for ch in s if ch.isprintable())
    s = ' '.join(s.split())[:16]
    return s or fallback


def profile_text(value):
    """Validate an incoming profile object and return compact JSON text."""
    if not isinstance(value, dict):
        raise ValueError('Profile must be an object.')
    text = json.dumps(value, separators=(',', ':'), ensure_ascii=False)
    if len(text.encode('utf-8')) > MAX_PROFILE:
        raise ValueError('Profile is too large.')
    return text


def load_profile(user_id):
    with lock:
        row = db.execute('SELECT payload FROM profiles WHERE user_id = ?', (user_id,)).fetchone()
    if not row:
        return None
    try:
        value = json.loads(row['payload'])
    except ValueError:
        return None
    return value if isinstance(value, dict) else None


def profile_summary(payload):
    """Only public-facing progression facts leave the admin API."""
    p = payload if isinstance(payload, dict) else {}
    stats = p.get('stats') if isinstance(p.get('stats'), dict) else {}
    best = p.get('bestRun') if isinstance(p.get('bestRun'), dict) else None
    quests = p.get('quests') if isinstance(p.get('quests'), dict) else {}

    def count(value):
        return len(value) if isinstance(value, list) else 0

    def num(value):
        try:
            return max(0, int(float(value or 0)))
        except (TypeError, ValueError):
            return 0

    return {
        'present': bool(payload),
        'displayName': clean_name(p.get('displayName'), '') if p.get('displayName') else '',
        'xp': num(p.get('xp')),
        'crystals': num(p.get('crystals')),
        'currentEvolution': str(p.get('currentEvolution') or '')[:32],
        'unlockedEvolutions': count(p.get('unlockedEvolutions')),
        'skins': count(p.get('skins')),
        'pets': count(p.get('pets')),
        'weapons': count(p.get('weapons')),
        'runs': num(stats.get('runs')),
        'fishEaten': num(stats.get('fishEaten')),
        'playSeconds': num(stats.get('playSeconds')),
        'bestRun': {
            'xp': num(best.get('xp')),
            'stageKey': str(best.get('stageKey') or '')[:32],
            'time': num(best.get('time'))
        } if best else None,
        'questChests': num(quests.get('chests')),
        'updatedAt': num(p.get('updatedAt'))
    }


def account_row(row, now):
    last_seen = row['last_seen_at'] or 0
    if row['disabled']:
        status = 'suspended'
    elif last_seen >= now - ONLINE_WINDOW:
        status = 'online'
    else:
        status = 'active'
    return {
        'id': row['id'],
        'username': row['username'],
        'createdAt': row['created_at'],
        'lastLoginAt': row['last_login_at'],
        'lastSeenAt': row['last_seen_at'],
        'status': status
    }


attempts = {}
WINDOW = 15 * 60 * 1000
LIMIT = 8
ADMIN_WINDOW = 10 * 60 * 1000


def throttled(store, key, window, limit):
    hit = store.get(key)
    if not hit:
        return False
    if now_ms() - hit[0] > window:
        store.pop(key, None)
        return False
    return hit[1] >= limit


def note_attempt(store, key):
    now = now_ms()
    hit = store.get(key)
    if not hit or now - hit[0] > WINDOW:
        store[key] = [now, 1]
    else:
        hit[1] += 1


def admin_lock_remaining(keys, now):
    """Longest remaining lockout across keys, in milliseconds (0 = free)."""
    with lock:
        rows = db.execute(
            'SELECT key, first_at, locked_until FROM admin_lockouts WHERE key IN (%s)'
            % ','.join('?' * len(keys)), tuple(keys)).fetchall()
        stale = [row['key'] for row in rows
                 if not row['locked_until'] and now - row['first_at'] > ADMIN_WINDOW]
        if stale:
            db.executemany('DELETE FROM admin_lockouts WHERE key = ?',
                           [(key,) for key in stale])
            db.commit()
    remaining = 0
    for row in rows:
        if row['locked_until'] and row['locked_until'] > now:
            remaining = max(remaining, row['locked_until'] - now)
    return remaining


def note_admin_failure(keys, now):
    """Persist a failed attempt and start (or escalate) a temporary lockout."""
    locked_for = 0
    with lock:
        for key in keys:
            row = db.execute(
                'SELECT failures, first_at, locked_until FROM admin_lockouts WHERE key = ?',
                (key,)).fetchone()
            if not row or (not row['locked_until'] and now - row['first_at'] > ADMIN_WINDOW):
                db.execute(
                    'INSERT OR REPLACE INTO admin_lockouts '
                    '(key, failures, first_at, locked_until, updated_at) '
                    'VALUES (?, 1, ?, 0, ?)', (key, now, now))
                continue
            failures = row['failures'] + 1
            locked_until = row['locked_until'] or 0
            if failures >= ADMIN_MAX_FAILS and failures % ADMIN_MAX_FAILS == 0:
                level = failures // ADMIN_MAX_FAILS
                span = min(ADMIN_LOCK_MS * (2 ** min(3, level - 1)), 60 * 60 * 1000)
                locked_until = now + span
            db.execute(
                'UPDATE admin_lockouts SET failures = ?, locked_until = ?, updated_at = ? '
                'WHERE key = ?', (failures, locked_until, now, key))
            if locked_until > now:
                locked_for = max(locked_for, locked_until - now)
        db.commit()
    return locked_for


def clear_admin_failures(keys):
    with lock:
        db.executemany('DELETE FROM admin_lockouts WHERE key = ?',
                       [(key,) for key in keys])
        db.commit()


def sweeper():
    while True:
        time.sleep(60)
        now = now_ms()
        for store, window in ((attempts, WINDOW),):
            for k, v in list(store.items()):
                if now - v[0] > window:
                    store.pop(k, None)
        with lock:
            db.execute('DELETE FROM sessions WHERE expires_at < ?', (now,))
            db.execute('DELETE FROM admin_sessions WHERE expires_at < ?', (now,))
            db.execute('DELETE FROM admin_lockouts WHERE locked_until < ? AND first_at < ?',
                       (now - 86400000, now - 86400000))
            db.commit()
        with presence_lock:
            for gid, rec in list(guests_online.items()):
                if now - rec['last'] > GUEST_WINDOW * 4:
                    guests_online.pop(gid, None)


# ---------------------------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    server_version = 'abyss-auth/2.0'

    def log_message(self, fmt, *args):
        pass

    # -- request helpers ----------------------------------------------------

    def base_headers(self):
        headers = {
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'no-referrer',
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Resource-Policy': 'same-origin',
            'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
        }
        if self.is_https():
            headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        return headers

    def send_json(self, status, body, extra_headers=None):
        text = json.dumps(body).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(text)))
        self.send_header('Cache-Control', 'no-store')
        for key, value in self.base_headers().items():
            self.send_header(key, value)
        for key, value in (extra_headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(text)

    def read_json(self):
        if not self._body:
            return {}
        try:
            value = json.loads(self._body.decode('utf-8'))
        except (ValueError, UnicodeDecodeError):
            raise ValueError('That request was not valid JSON.')
        return value if isinstance(value, dict) else {}

    def cookies(self):
        out = {}
        for part in (self.headers.get('Cookie') or '').split(';'):
            if '=' in part:
                key, value = part.split('=', 1)
                out[key.strip()] = unquote(value.strip())
        return out

    def is_https(self):
        mode = os.environ.get('ABYSS_COOKIE_SECURE', 'auto').lower()
        if mode == 'always':
            return True
        if mode == 'never':
            return False
        if TRUST_PROXY:
            proto = (self.headers.get('X-Forwarded-Proto') or '').split(',')[0].strip().lower()
            if proto:
                return proto == 'https'
        try:
            return self.connection.cipher() is not None
        except Exception:  # noqa: BLE001
            return False

    def cookie(self, name, token, max_age):
        bits = ['%s=%s' % (name, token), 'HttpOnly', 'SameSite=Strict', 'Path=/',
                'Max-Age=%d' % int(max_age / 1000)]
        if self.is_https():
            bits.append('Secure')
        return '; '.join(bits)

    def session_cookie(self, token, max_age):
        return self.cookie(COOKIE, token, max_age)

    def client_ip(self):
        if TRUST_PROXY:
            # Cloudflare overwrites CF-Connecting-IP itself; the first
            # X-Forwarded-For entry is the client for the other proxies.
            for header in ('CF-Connecting-IP', 'X-Forwarded-For', 'X-Real-IP'):
                raw = self.headers.get(header)
                if not raw:
                    continue
                candidate = raw.split(',')[0].strip()
                try:
                    return str(ipaddress.ip_address(candidate))
                except ValueError:
                    continue
        return self.client_address[0] if self.client_address else 'unknown'

    def admin_ip_allowed(self):
        if not ADMIN_ALLOW_IPS:
            return True
        try:
            ip = ipaddress.ip_address(self.client_ip())
        except ValueError:
            return False
        return any(ip in net for net in ADMIN_ALLOW_IPS)

    def admin_origin_ok(self):
        """Defence in depth on top of the SameSite cookie and CSRF header."""
        site = (self.headers.get('Sec-Fetch-Site') or '').strip().lower()
        if site and site not in ('same-origin', 'none'):
            return False
        origin = (self.headers.get('Origin') or '').strip()
        if not origin:
            return True
        if origin.lower() == 'null':
            return False
        host = (self.headers.get('Host') or '').strip().lower()
        if not host:
            return False
        try:
            parts = urlsplit(origin)
        except ValueError:
            return False
        return parts.scheme in ('http', 'https') and parts.netloc.lower() == host

    # -- player sessions ----------------------------------------------------

    def current_user(self):
        token = self.cookies().get(COOKIE)
        if not token or len(token) != 64:
            return None
        with lock:
            row = db.execute(
                'SELECT s.user_id, s.expires_at, u.username, u.email, u.created_at, '
                'u.last_seen_at, u.disabled '
                'FROM sessions s JOIN users u ON u.id = s.user_id '
                'WHERE s.token_hash = ?', (digest(token),)).fetchone()
            if row and row['expires_at'] < now_ms():
                db.execute('DELETE FROM sessions WHERE token_hash = ?', (digest(token),))
                db.commit()
                return None
            if row and not row['disabled']:
                seen = row['last_seen_at'] or 0
                now = now_ms()
                if now - seen > 20000:
                    db.execute('UPDATE users SET last_seen_at = ? WHERE id = ?',
                               (now, row['user_id']))
                    db.commit()
        if not row or row['disabled']:
            return None
        return {'token': token, 'id': row['user_id'], 'username': row['username'],
                'email': row['email'], 'createdAt': row['created_at']}

    def start_session(self, user_id):
        token = secrets.token_hex(32)
        now = now_ms()
        with lock:
            db.execute('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) '
                       'VALUES (?, ?, ?, ?)', (digest(token), user_id, now + SESSION_TTL, now))
            db.commit()
        return self.session_cookie(token, SESSION_TTL)

    # -- admin sessions -----------------------------------------------------

    def current_admin(self):
        token = self.cookies().get(ADMIN_COOKIE)
        if not token or len(token) != 64:
            return None
        now = now_ms()
        with lock:
            row = db.execute(
                'SELECT expires_at, last_used_at, ip FROM admin_sessions '
                'WHERE token_hash = ?', (digest(token),)).fetchone()
            if row:
                idle_from = row['last_used_at'] or (row['expires_at'] - ADMIN_SESSION_TTL)
                if row['expires_at'] < now or now - idle_from > ADMIN_IDLE_TTL:
                    db.execute('DELETE FROM admin_sessions WHERE token_hash = ?',
                               (digest(token),))
                    db.commit()
                    return None
                if ADMIN_BIND_IP and row['ip'] and row['ip'] != self.client_ip():
                    return None
                if now - (row['last_used_at'] or 0) > 60000:
                    db.execute('UPDATE admin_sessions SET last_used_at = ? '
                               'WHERE token_hash = ?', (now, digest(token)))
                    db.commit()
        if not row:
            return None
        return {'username': ADMIN_USER, 'expiresAt': row['expires_at']}

    def admin_cookie(self, token, max_age):
        return self.cookie(ADMIN_COOKIE, token, max_age)

    def require_admin(self, pathname):
        if self.current_admin():
            return True
        self.send_json(401, {'error': 'Administrator sign-in required.'})
        return False

    # -- player API ---------------------------------------------------------

    def handle_api(self, pathname):
        method = self.command

        if pathname == '/api/health':
            self.send_json(200, {'ok': True, 'service': 'abyss-auth', 'accounts': True})
            return

        # CSRF: every state-changing call has to carry the game's header.
        if method != 'GET' and self.headers.get('X-Requested-With') != 'ABYSS':
            self.send_json(403, {'error': 'This request has to come from the game.'})
            return

        if pathname.startswith('/api/admin'):
            self.handle_admin(pathname)
            return

        if pathname == '/api/signup' and method == 'POST':
            b = self.read_json()
            username = str(b.get('username') or '').strip()
            email = str(b.get('email') or '').strip().lower()
            password = str(b.get('password') or '')
            confirm = str(b.get('confirm') or '')

            bad = check_credentials(username, email, password)
            if bad:
                self.send_json(400, {'error': bad})
                return
            if password != confirm:
                self.send_json(400, {'error': 'The two passwords do not match.'})
                return

            profile_value = b.get('profile')
            profile_json = None
            if profile_value is not None:
                try:
                    profile_json = profile_text(profile_value)
                except ValueError as exc:
                    self.send_json(400, {'error': str(exc)})
                    return

            with lock:
                if db.execute('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE',
                              (username,)).fetchone():
                    self.send_json(409, {'error': 'That username is taken.', 'field': 'username'})
                    return
                if not email:
                    email = '%s@players.abyss.local' % username.lower()
                if db.execute('SELECT 1 FROM users WHERE email = ? COLLATE NOCASE',
                              (email,)).fetchone():
                    if b.get('email'):
                        self.send_json(409, {'error': 'An account already uses that email.'})
                    else:
                        email = '%s.%s@players.abyss.local' % (username.lower(),
                                                               secrets.token_hex(3))
                salt, hashed = hash_password(password)
                now = now_ms()
                cur = db.execute(
                    'INSERT INTO users (username, email, pass_salt, pass_hash, created_at, '
                    'last_login_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    (username, email, salt, hashed, now, now, now))
                user_id = cur.lastrowid
                if profile_json is not None:
                    db.execute('INSERT INTO profiles (user_id, payload, updated_at) '
                               'VALUES (?, ?, ?)', (user_id, profile_json, now))
                db.commit()
            stored = load_profile(user_id)
            self.send_json(200, {'ok': True,
                                 'user': {'id': user_id, 'username': username, 'createdAt': now},
                                 'profile': stored},
                           {'Set-Cookie': self.start_session(user_id)})
            return

        if pathname == '/api/login' and method == 'POST':
            b = self.read_json()
            identifier = normalise_identifier(b.get('identifier'))
            if not identifier:
                identifier = str(b.get('username') or '').strip()
            password = str(b.get('password') or '')
            key = self.client_ip() + '|' + identifier.lower()

            if throttled(attempts, key, WINDOW, LIMIT):
                self.send_json(429, {'error': 'Too many attempts. Wait a few minutes and try again.'})
                return
            note_attempt(attempts, key)

            with lock:
                lookup = 'email = ? COLLATE NOCASE' if EMAIL_RE.match(identifier) else 'username = ? COLLATE NOCASE'
                row = db.execute('SELECT * FROM users WHERE %s' % lookup, (identifier,)).fetchone()
            if row is None:
                # Burn the same time a real check would, so the response does not
                # reveal whether the account exists.
                hash_password(password, secrets.token_hex(16))
                self.send_json(401, {'error': 'Wrong username/email or password.'})
                return

            if not verify_password(password, row['pass_salt'], row['pass_hash']):
                self.send_json(401, {'error': 'Wrong username/email or password.'})
                return
            if row['disabled']:
                self.send_json(403, {'error': 'This account has been suspended.'})
                return

            attempts.pop(key, None)
            now = now_ms()
            with lock:
                db.execute('UPDATE users SET last_login_at = ?, last_seen_at = ? WHERE id = ?',
                           (now, now, row['id']))
                db.commit()
            self.send_json(200, {'ok': True,
                                 'user': {'id': row['id'], 'username': row['username'],
                                          'createdAt': row['created_at']},
                                 'profile': load_profile(row['id'])},
                           {'Set-Cookie': self.start_session(row['id'])})
            return

        if pathname == '/api/logout' and method == 'POST':
            me = self.current_user()
            if me:
                with lock:
                    db.execute('DELETE FROM sessions WHERE token_hash = ?', (digest(me['token']),))
                    db.commit()
            self.send_json(200, {'ok': True}, {'Set-Cookie': self.session_cookie('', 0)})
            return

        if pathname == '/api/me' and method == 'GET':
            me = self.current_user()
            if not me:
                self.send_json(200, {'user': None})
                return
            self.send_json(200, {'user': {'id': me['id'], 'username': me['username'],
                                          'createdAt': me['createdAt']},
                                 'profile': load_profile(me['id'])})
            return

        if pathname == '/api/profile':
            me = self.current_user()
            if not me:
                self.send_json(401, {'error': 'You are not signed in.'})
                return
            if method == 'GET':
                self.send_json(200, {'profile': load_profile(me['id'])})
                return
            if method == 'PUT':
                b = self.read_json()
                try:
                    text = profile_text(b.get('profile'))
                except ValueError as exc:
                    self.send_json(400, {'error': str(exc)})
                    return
                now = now_ms()
                with lock:
                    db.execute('INSERT INTO profiles (user_id, payload, updated_at) '
                               'VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET '
                               'payload = excluded.payload, updated_at = excluded.updated_at',
                               (me['id'], text, now))
                    db.execute('UPDATE users SET last_seen_at = ? WHERE id = ?', (now, me['id']))
                    db.commit()
                self.send_json(200, {'ok': True, 'profile': json.loads(text), 'savedAt': now})
                return

        if pathname == '/api/presence' and method == 'POST':
            b = self.read_json()
            name = clean_name(b.get('name'))
            gid = str(b.get('id') or '').strip()
            me = self.current_user()
            if me:
                # current_user() already refreshed last_seen_at (throttled).
                # Drop any guest entry this browser left behind before signing
                # in, so one player is never counted twice.
                if GUEST_ID_RE.match(gid):
                    with presence_lock:
                        guests_online.pop(gid, None)
                self.send_json(200, {'ok': True, 'registered': True})
                return
            if not GUEST_ID_RE.match(gid):
                self.send_json(400, {'error': 'Unknown guest identifier.'})
                return
            now = now_ms()
            with presence_lock:
                rec = guests_online.get(gid)
                guests_online[gid] = {
                    'name': name,
                    'first': rec['first'] if rec else now,
                    'last': now
                }
                if len(guests_online) > 20000:
                    for key, item in list(guests_online.items()):
                        if now - item['last'] > GUEST_WINDOW:
                            guests_online.pop(key, None)
            self.send_json(200, {'ok': True, 'registered': False})
            return

        if pathname == '/api/world' and method == 'GET':
            # Public, read-only snapshot for the in-game leaderboard and the
            # monster gate clock. It carries display names and lifetime XP and
            # nothing else: no ids, no e-mails, no session data.
            current = now_ms()
            with lock:
                rows = db.execute(
                    'SELECT u.username AS username, p.payload AS payload '
                    'FROM users u LEFT JOIN profiles p ON p.user_id = u.id '
                    'WHERE u.last_seen_at >= ? ORDER BY u.last_seen_at DESC LIMIT 50',
                    (current - ONLINE_WINDOW,)).fetchall()
            online = []
            for row in rows:
                payload = {}
                if row['payload']:
                    try:
                        parsed = json.loads(row['payload'])
                        if isinstance(parsed, dict):
                            payload = parsed
                    except ValueError:
                        payload = {}
                try:
                    xp = max(0, int(float(payload.get('xp') or 0)))
                except (TypeError, ValueError):
                    xp = 0
                name = clean_name(payload.get('displayName'), '') or row['username']
                online.append({'name': name, 'xp': xp})
            self.send_json(200, {
                'ok': True,
                'now': current,
                'startedAt': SERVER_START_MS,
                'portal': {
                    'closedSeconds': PORTAL_CLOSED_SECONDS,
                    'openSeconds': PORTAL_OPEN_SECONDS
                },
                'online': online,
                'onlineWindowSeconds': int(ONLINE_WINDOW / 1000)
            })
            return

        if pathname == '/api/save':
            me = self.current_user()
            if not me:
                self.send_json(401, {'error': 'You are not signed in.'})
                return

            if method == 'GET':
                with lock:
                    row = db.execute('SELECT payload, updated_at FROM cloud_saves WHERE user_id = ?',
                                     (me['id'],)).fetchone()
                if not row:
                    self.send_json(200, {'save': None})
                    return
                try:
                    payload = json.loads(row['payload'])
                except ValueError:
                    payload = None
                self.send_json(200, {'save': payload, 'updatedAt': row['updated_at']})
                return

            if method == 'PUT':
                save = self.read_json().get('save')
                if not isinstance(save, dict):
                    self.send_json(400, {'error': 'Nothing to save.'})
                    return

                def num(key):
                    try:
                        return max(0, int(float(save.get(key) or 0)))
                    except (TypeError, ValueError):
                        return 0

                payload = json.dumps({
                    'xp': num('xp'),
                    'stageKey': str(save.get('stageKey') or '')[:24],
                    'stageIndex': num('stageIndex'),
                    'time': num('time'),
                    'runs': num('runs'),
                    'eaten': num('eaten'),
                })
                if len(payload) > 4000:
                    self.send_json(413, {'error': 'Save is too large.'})
                    return
                with lock:
                    db.execute(
                        'INSERT INTO cloud_saves (user_id, payload, updated_at) VALUES (?, ?, ?) '
                        'ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, '
                        'updated_at = excluded.updated_at', (me['id'], payload, now_ms()))
                    db.commit()
                self.send_json(200, {'ok': True, 'savedAt': now_ms()})
                return

        self.send_json(404, {'error': 'No such endpoint.'})

    # -- admin API ----------------------------------------------------------

    def handle_admin(self, pathname):
        method = self.command

        if not self.admin_origin_ok():
            self.send_json(403, {'error': 'This request was not made from the console.'})
            return
        if not self.admin_ip_allowed():
            # Same answer as a missing route: never advertise the console.
            self.send_json(404, {'error': 'Not found'})
            return

        if pathname == '/api/admin/login' and method == 'POST':
            if not ADMIN_READY:
                if ADMIN_HASH_KIND == 'argon2id' and ARGON2 is None:
                    reason = 'Administrator access needs the argon2-cffi package on this server.'
                else:
                    reason = 'Administrator access is not configured on this server.'
                self.send_json(503, {'error': reason})
                return

            b = self.read_json()
            ip = self.client_ip()
            now = now_ms()
            keys = ('admin-ip:' + ip, 'admin-user:' + ADMIN_USER.lower())
            locked = admin_lock_remaining(keys, now)
            if locked:
                self.send_json(429, {
                    'error': 'Too many sign-in attempts. Try again in %d minute(s).'
                             % max(1, int(math.ceil(locked / 60000.0)))
                }, {'Retry-After': str(max(1, int(math.ceil(locked / 1000.0))))})
                return

            username = str(b.get('username') or '')
            password = str(b.get('password') or '')
            # Always hash, whatever the username, so a wrong name and a wrong
            # password cost the same amount of time.
            ok_pass = verify_admin_password(password[:1024])
            ok_user = hmac.compare_digest(username.encode('utf-8'),
                                          ADMIN_USER.encode('utf-8'))
            if not (ok_user and ok_pass):
                wait = note_admin_failure(keys, now)
                sys.stderr.write('[admin] failed sign-in ip=%s user=%r at=%d\n'
                                 % (ip, username[:64], now))
                if wait:
                    self.send_json(429, {
                        'error': 'Too many sign-in attempts. Try again in %d minute(s).'
                                 % max(1, int(math.ceil(wait / 60000.0)))
                    }, {'Retry-After': str(max(1, int(math.ceil(wait / 1000.0))))})
                else:
                    self.send_json(401, {'error': 'Invalid administrator credentials.'})
                return

            clear_admin_failures(keys)
            token = secrets.token_hex(32)
            with lock:
                db.execute('DELETE FROM admin_sessions WHERE expires_at < ?', (now,))
                db.execute(
                    'INSERT INTO admin_sessions '
                    '(token_hash, expires_at, created_at, ip, user_agent, last_used_at) '
                    'VALUES (?, ?, ?, ?, ?, ?)',
                    (digest(token), now + ADMIN_SESSION_TTL, now, ip,
                     (self.headers.get('User-Agent') or '')[:200], now))
                # Keep the newest handful of sessions and drop older ones.
                db.execute(
                    'DELETE FROM admin_sessions WHERE token_hash NOT IN '
                    '(SELECT token_hash FROM admin_sessions ORDER BY created_at DESC LIMIT 10)')
                db.commit()
            self.send_json(200, {'ok': True,
                                 'admin': {'username': ADMIN_USER,
                                           'expiresAt': now + ADMIN_SESSION_TTL}},
                           {'Set-Cookie': self.admin_cookie(token, ADMIN_SESSION_TTL)})
            return

        if pathname == '/api/admin/session' and method == 'GET':
            me = self.current_admin()
            self.send_json(200, {'authenticated': bool(me),
                                 'configured': ADMIN_READY,
                                 'admin': {'username': me['username'],
                                           'expiresAt': me['expiresAt']} if me else None})
            return

        if pathname == '/api/admin/logout' and method == 'POST':
            me = self.current_admin()
            if me:
                token = self.cookies().get(ADMIN_COOKIE)
                with lock:
                    db.execute('DELETE FROM admin_sessions WHERE token_hash = ?',
                               (digest(token or ''),))
                    db.commit()
            self.send_json(200, {'ok': True},
                           {'Set-Cookie': self.admin_cookie('', 0)})
            return

        # Everything below this line requires a live, server-side admin session.
        if not self.require_admin(pathname):
            return

        if pathname == '/api/admin/stats' and method == 'GET':
            now = now_ms()
            with lock:
                total = db.execute('SELECT COUNT(*) AS c FROM users').fetchone()['c']
                online = db.execute('SELECT COUNT(*) AS c FROM users WHERE last_seen_at >= ?',
                                    (now - ONLINE_WINDOW,)).fetchone()['c']
                new24 = db.execute('SELECT COUNT(*) AS c FROM users WHERE created_at >= ?',
                                   (now - 86400000,)).fetchone()['c']
                newest = db.execute('SELECT MAX(created_at) AS t FROM users').fetchone()['t']
            with presence_lock:
                for gid, rec in list(guests_online.items()):
                    if now - rec['last'] > GUEST_WINDOW * 4:
                        guests_online.pop(gid, None)
                guests = sum(1 for rec in guests_online.values()
                             if now - rec['last'] <= GUEST_WINDOW)
            self.send_json(200, {
                'ok': True,
                'stats': {
                    'registeredAccounts': total,
                    'accountsCreated': total,
                    'registeredOnline': online,
                    'guestsOnline': guests,
                    'newAccounts24h': new24,
                    'newestAccountAt': newest,
                    'generatedAt': now,
                    'onlineWindowSeconds': int(ONLINE_WINDOW / 1000)
                }
            })
            return

        if pathname == '/api/admin/players' and method == 'GET':
            query = self.query()
            q = str(query.get('q') or '').strip()[:40]
            sort_map = {
                'username': 'username COLLATE NOCASE',
                'id': 'id',
                'created': 'created_at',
                'lastLogin': 'COALESCE(last_login_at, 0)',
                'lastSeen': 'COALESCE(last_seen_at, 0)',
                'status': 'disabled'
            }
            sort = sort_map.get(str(query.get('sort') or 'created'), 'created_at')
            direction = 'ASC' if str(query.get('dir') or 'desc').lower() == 'asc' else 'DESC'
            try:
                limit = max(1, min(100, int(query.get('limit') or 25)))
            except ValueError:
                limit = 25
            try:
                offset = max(0, min(100000, int(query.get('offset') or 0)))
            except ValueError:
                offset = 0

            where, params = '', []
            if q:
                escaped = q.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
                where = " WHERE username LIKE ? ESCAPE '\\' COLLATE NOCASE"
                params.append('%' + escaped + '%')

            now = now_ms()
            with lock:
                total = db.execute('SELECT COUNT(*) AS c FROM users' + where,
                                   params).fetchone()['c']
                rows = db.execute(
                    'SELECT id, username, created_at, last_login_at, last_seen_at, disabled '
                    'FROM users' + where + ' ORDER BY ' + sort + ' ' + direction +
                    ' LIMIT ? OFFSET ?', params + [limit, offset]).fetchall()
            self.send_json(200, {
                'ok': True,
                'players': [account_row(row, now) for row in rows],
                'total': total,
                'limit': limit,
                'offset': offset,
                'now': now
            })
            return

        match = re.match(r'^/api/admin/players/(\d{1,12})$', pathname)
        if match and method == 'GET':
            player_id = int(match.group(1))
            with lock:
                row = db.execute(
                    'SELECT id, username, created_at, last_login_at, last_seen_at, disabled '
                    'FROM users WHERE id = ?', (player_id,)).fetchone()
            if not row:
                self.send_json(404, {'error': 'No such player.'})
                return
            summary = profile_summary(load_profile(player_id))
            player = account_row(row, now_ms())
            player['profile'] = summary
            self.send_json(200, {'ok': True, 'player': player})
            return

        if pathname == '/api/admin/guests' and method == 'GET':
            now = now_ms()
            with presence_lock:
                entries = [
                    {'id': gid, 'name': rec['name'], 'firstSeenAt': rec['first'],
                     'lastSeenAt': rec['last']}
                    for gid, rec in guests_online.items()
                    if now - rec['last'] <= GUEST_WINDOW
                ]
            entries.sort(key=lambda item: item['lastSeenAt'], reverse=True)
            self.send_json(200, {'ok': True, 'guests': entries, 'now': now,
                                 'totalOnline': len(entries)})
            return

        self.send_json(404, {'error': 'No such endpoint.'})

    def query(self):
        raw = (self.path or '').split('?', 1)
        if len(raw) < 2:
            return {}
        from urllib.parse import parse_qs
        parsed = parse_qs(raw[1], keep_blank_values=True)
        return {key: values[0] for key, values in parsed.items()}

    # -- admin page ---------------------------------------------------------

    def serve_admin(self, pathname):
        name = unquote(pathname[len('/admin'):]).lstrip('/\\') or 'index.html'
        if name not in ('index.html', 'app.js', 'style.css'):
            self.send_json(404, {'error': 'Not found'})
            return
        target = os.path.join(ADMIN_DIR, name)
        if not os.path.isfile(target):
            self.send_json(404, {'error': 'Not found'})
            return
        with open(target, 'rb') as fh:
            blob = fh.read()
        ext = os.path.splitext(target)[1].lower()
        self.send_response(200)
        self.send_header('Content-Type', MIME.get(ext) or 'application/octet-stream')
        self.send_header('Content-Length', str(len(blob)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Security-Policy', ADMIN_CSP)
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('X-Robots-Tag', 'noindex, nofollow')
        for key, value in self.base_headers().items():
            self.send_header(key, value)
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(blob)

    # -- static game files --------------------------------------------------

    def serve_static(self, pathname):
        rel = unquote(pathname)
        if rel == '/':
            rel = '/index.html'
        lowered = rel.lower()
        if lowered == '/server' or lowered.startswith('/server/') or '/server/' in lowered:
            self.send_json(403, {'error': 'Forbidden'})
            return
        if any(part.startswith('.') for part in rel.replace('\\', '/').split('/') if part):
            self.send_json(403, {'error': 'Forbidden'})
            return
        target = os.path.realpath(os.path.join(ROOT, rel.lstrip('/\\')))
        if not (target == ROOT or target.startswith(ROOT + os.sep)):
            self.send_json(403, {'error': 'Forbidden'})
            return
        if target == os.path.realpath(BASE) or target.startswith(os.path.realpath(BASE) + os.sep):
            self.send_json(403, {'error': 'Forbidden'})
            return
        if not os.path.isfile(target):
            self.send_json(404, {'error': 'Not found'})
            return

        ext = os.path.splitext(target)[1].lower()
        ctype = MIME.get(ext) or mimetypes.guess_type(target)[0] or 'application/octet-stream'
        with open(target, 'rb') as fh:
            blob = fh.read()
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(blob)))
        self.send_header('Cache-Control', 'no-cache')
        for key, value in self.base_headers().items():
            self.send_header(key, value)
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(blob)

    # -- dispatch -----------------------------------------------------------

    def route(self):
        pathname = (self.path or '/').split('?')[0]

        # Drain the body before anything else. Answering while the request body
        # is still in the socket corrupts the next request on a keep-alive
        # connection.
        try:
            length = int(self.headers.get('Content-Length') or 0)
        except ValueError:
            length = 0
        self._body = b''
        if length > MAX_BODY:
            self.send_json(413, {'error': 'Request is too large.'})
            self.close_connection = True
            return
        if length:
            self._body = self.rfile.read(length)

        try:
            is_admin_path = (pathname == '/admin' or pathname.startswith('/admin/')
                             or pathname.startswith('/api/admin'))
            if is_admin_path and not self.admin_ip_allowed():
                # Outside the allowlist the console does not exist.
                self.send_json(404, {'error': 'Not found'})
                return
            if pathname.startswith('/api/'):
                self.handle_api(pathname)
                return
            if self.command not in ('GET', 'HEAD'):
                self.send_json(405, {'error': 'Method not allowed'})
                return
            if pathname == '/admin' or pathname.startswith('/admin/'):
                self.serve_admin(pathname)
                return
            self.serve_static(pathname)
        except ValueError as exc:
            try:
                self.send_json(400, {'error': str(exc) or 'Bad request.'})
            except Exception:  # noqa: BLE001
                pass
        except Exception:  # noqa: BLE001 - never leak a stack to the client
            try:
                self.send_json(500, {'error': 'Server error.'})
            except Exception:  # noqa: BLE001
                pass

    do_GET = do_HEAD = do_POST = do_PUT = route

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Allow', 'GET, POST, PUT, HEAD, OPTIONS')
        self.send_header('Content-Length', '0')
        self.end_headers()


def main():
    threading.Thread(target=sweeper, daemon=True).start()

    server = None
    port = PORT
    for candidate in range(PORT, PORT + 12):
        try:
            server = ThreadingHTTPServer((HOST, candidate), Handler)
            port = candidate
            break
        except OSError:
            continue
    if server is None:
        print('Could not open a port between %d and %d. Close other programs '
              'using them and run this again.' % (PORT, PORT + 11))
        return

    url = 'http://%s:%d' % (HOST, port)
    print('')
    print('  ABYSS.IO  -  account server is up')
    print('  play here:  ' + url)
    print('  admin:      ' + url + '/admin')
    print('  database:   %s' % os.path.join(DATA_DIR, 'abyss.db'))
    if ADMIN_READY:
        print('  admin gate: user "%s" (password hashing: %s)' % (ADMIN_USER, ADMIN_HASH_KIND))
        print('  admin idle: %d min, absolute: %d h, lockout after %d failures'
              % (ADMIN_IDLE_TTL // 60000, ADMIN_SESSION_TTL // 3600000, ADMIN_MAX_FAILS))
        if ADMIN_ALLOW_IPS:
            print('  admin ip allowlist: %s' % ', '.join(str(n) for n in ADMIN_ALLOW_IPS))
        if ADMIN_BIND_IP:
            print('  admin sessions are bound to the sign-in IP')
    else:
        print('')
        print('  ADMIN ACCESS IS NOT CONFIGURED YET.')
        print('  Run: python server\\hash_admin_password.py --write-env')
        print('  or set ABYSS_ADMIN_USER and ABYSS_ADMIN_PASSWORD_HASH yourself.')
    if TRUST_PROXY:
        print('  proxy: trusting CF-Connecting-IP / X-Forwarded-For / Forwarded-Proto')
    if ADMIN_READY and ADMIN_HASH_KIND == 'scrypt':
        print('  note: Argon2id is available if argon2-cffi is installed; '
              'this credential uses the scrypt fallback.')
    print('')
    print('  leave this window open while you play. Ctrl+C stops it.')
    print('')
    if not os.environ.get('ABYSS_NO_BROWSER'):
        try:
            webbrowser.open(url)
        except Exception:  # noqa: BLE001
            pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()


if __name__ == '__main__':
    main()
