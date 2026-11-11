/* =========================================================================
   ABYSS.IO — account layer
   -------------------------------------------------------------------------
   There is no server yet, so nothing here pretends to be one. Accounts
   created today are LOCAL TEST ACCOUNTS: they live in this browser, on this
   machine, and the UI says so out loud everywhere an account is made or used.

   The shape is deliberately the one a real backend will need. Every provider
   exposes the same asynchronous verbs, so swapping in `RemoteProvider` is a
   configuration change (`A.Account.configure({ mode: 'online', baseUrl })`),
   not a rewrite of the callers:

     list() get(username) create(username, password, profile)
     verify(username, password) update(username, patch) remove(username)

   Passwords are never stored, never logged and never kept in memory past the
   call that checks them — only a random salt and a stretched digest are kept.
   ========================================================================= */
(function () {
  'use strict';

  const A = window.ABYSS;
  if (!A) return;

  const STORE_ACCOUNTS = 'abyss.accounts.v1';
  const STORE_SESSION = 'abyss.session.v1';
  const USER_RE = /^[A-Za-z0-9_]{3,16}$/;
  const MAX_ATTEMPTS = 5;
  const LOCK_MS = 30000;

  // PBKDF2 is the real thing and costs nothing to use on a modern browser.
  // The fallback is an iterated SHA-256 for engines without SubtleCrypto
  // (older low-end PCs): weaker per round, so it runs many more of them.
  const KDF_PBKDF2_ROUNDS = 120000;
  const KDF_SHA256_ROUNDS = 24000;
  const SALT_BYTES = 16;
  const KEY_BYTES = 32;

  const WEAK = [
    'password', 'passwort', 'qwerty', 'qwertyui', 'abc123', 'iloveyou',
    'letmein', 'monkey', 'dragon', 'football', 'sunshine', 'princess',
    'abyssio', 'admin', 'welcome'
  ];

  // ------------------------------------------------------------------
  // Small utilities
  // ------------------------------------------------------------------
  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function b64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  function unb64(text) {
    try {
      const s = atob(String(text || ''));
      const out = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
      return out;
    } catch (e) {
      return new Uint8Array(0);
    }
  }

  function utf8(text) {
    return new TextEncoder().encode(String(text));
  }

  function randomBytes(n) {
    const out = new Uint8Array(n);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(out);
      return out;
    }
    // No CSPRNG: still unpredictable enough to stop a casual read of the
    // store, and the UI never claims more than a local test account.
    for (let i = 0; i < n; i++) out[i] = (Math.random() * 256) | 0;
    return out;
  }

  // Byte-for-byte comparison that does not stop at the first difference.
  function sameBytes(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  }

  // ------------------------------------------------------------------
  // SHA-256 (fallback path only; SubtleCrypto is preferred)
  // ------------------------------------------------------------------
  // The round constants are the high 32 bits of the fractional cube roots of
  // the first 64 primes. Deriving them beats typing them out, and the
  // self-test below proves the result against the published SHA-256("abc")
  // digest before the fallback is ever allowed to run.
  function buildConstants() {
    const k = new Uint32Array(64);
    const h = new Uint32Array(8);
    let n = 2, found = 0;
    while (found < 64) {
      let prime = true;
      for (let d = 2; d * d <= n; d++) { if (n % d === 0) { prime = false; break; } }
      if (prime) {
        if (found < 8) h[found] = Math.floor((Math.sqrt(n) % 1) * 4294967296) >>> 0;
        k[found] = Math.floor((Math.cbrt(n) % 1) * 4294967296) >>> 0;
        found++;
      }
      n++;
    }
    return { k: k, h: h };
  }

  const CONST = buildConstants();

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  function sha256(msg) {
    const K = CONST.k;
    const H = new Uint32Array(CONST.h);
    const len = msg.length;
    const padded = new Uint8Array((((len + 9) >> 6) + 1) << 6);
    padded.set(msg);
    padded[len] = 0x80;
    const bits = len * 8;
    const dv = new DataView(padded.buffer);
    dv.setUint32(padded.length - 8, Math.floor(bits / 4294967296));
    dv.setUint32(padded.length - 4, bits >>> 0);

    const w = new Uint32Array(64);
    for (let off = 0; off < padded.length; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let a0 = H[0], b0 = H[1], c0 = H[2], d0 = H[3], e0 = H[4], f0 = H[5], g0 = H[6], h0 = H[7];
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e0, 6) ^ rotr(e0, 11) ^ rotr(e0, 25);
        const ch = (e0 & f0) ^ (~e0 & g0);
        const t1 = (h0 + S1 + ch + SHA_K[i] + w[i]) >>> 0;
        const S0 = rotr(a0, 2) ^ rotr(a0, 13) ^ rotr(a0, 22);
        const maj = (a0 & b0) ^ (a0 & c0) ^ (b0 & c0);
        const t2 = (S0 + maj) >>> 0;
        h0 = g0; g0 = f0; f0 = e0; e0 = (d0 + t1) >>> 0;
        d0 = c0; c0 = b0; b0 = a0; a0 = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a0) >>> 0; H[1] = (H[1] + b0) >>> 0; H[2] = (H[2] + c0) >>> 0; H[3] = (H[3] + d0) >>> 0;
      H[4] = (H[4] + e0) >>> 0; H[5] = (H[5] + f0) >>> 0; H[6] = (H[6] + g0) >>> 0; H[7] = (H[7] + d0) >>> 0;
    }
    const out = new Uint8Array(32);
    const odv = new DataView(out.buffer);
    for (let i = 0; i < 8; i++) odv.setUint32(i * 4, H[i]);
    return out;
  }

  // Prove the hand-rolled path really is SHA-256 before letting it near a
  // credential, using the published digest of "abc".
  const SHA_OK = (function () {
    try {
      const d = sha256(utf8('abc'));
      const hex = [];
      for (let i = 0; i < d.length; i++) hex.push((d[i] + 0x100).toString(16).slice(1));
      return hex.join('') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    } catch (e) {
      return false;
    }
  })();

  function concat(a, b) {
    const out = new Uint8Array(a.length + b.length);
    out.set(a); out.set(b, a.length);
    return out;
  }

  function subtle() {
    return window.crypto && window.crypto.subtle ? window.crypto.subtle : null;
  }

  async function derive(password, saltB64, rounds, algo) {
    const salt = unb64(saltB64);
    if (algo === 'PBKDF2-SHA256' && subtle()) {
      const key = await subtle().importKey('raw', utf8(password), 'PBKDF2', false, ['deriveBits']);
      const bits = await subtle().deriveBits(
        { name: 'PBKDF2', salt: salt, iterations: rounds, hash: 'SHA-256' },
        key, KEY_BYTES * 8
      );
      return new Uint8Array(bits);
    }
    if (!SHA_OK) {
      throw new Error('This browser cannot hash passwords safely, so accounts are unavailable here.');
    }
    let d = sha256(concat(salt, utf8(password)));
    for (let i = 1; i < rounds; i++) d = sha256(concat(d, salt));
    return d;
  }

  async function makeCredential(password) {
    const usePbkdf2 = !!subtle();
    if (!usePbkdf2 && !SHA_OK) {
      throw new Error('This browser cannot hash passwords safely, so accounts are unavailable here.');
    }
    const salt = randomBytes(SALT_BYTES);
    const saltB64 = b64(salt);
    const rounds = usePbkdf2 ? KDF_PBKDF2_ROUNDS : KDF_SHA256_ROUNDS;
    const hash = await derive(password, saltB64, rounds, usePbkdf2 ? 'PBKDF2-SHA256' : 'SHA256-ITER');
    return {
      algo: usePbkdf2 ? 'PBKDF2-SHA256' : 'SHA256-ITER',
      salt: saltB64,
      rounds: rounds,
      digest: b64(hash)
    };
  }

  async function checkCredential(password, cred) {
    if (!cred || !cred.salt || !cred.digest) return false;
    const hash = await derive(password, cred.salt, cred.rounds, cred.algo);
    return sameBytes(hash, unb64(cred.digest));
  }

  // ------------------------------------------------------------------
  // The progression record every future feature will hang off
  // ------------------------------------------------------------------
  function newProfile(username) {
    return {
      username: username,
      // Empty means "show the username". The menu name field writes here while
      // an account is signed in, so a rename rides along with the profile.
      displayName: '',
      crystals: 0,
      xp: 0,
      // Highest level whose reward has already been claimed. XP keeps its own
      // lifetime total; the level is derived from it and only advanced when the
      // player collects the reward, so a refresh can never skip a level.
      level: 0,
      unlockedEvolutions: ['blue'],
      currentEvolution: 'blue',
      skins: [],
      equippedSkin: null,
      pets: [],
      activePet: null,
      weapons: [],
      equippedWeapon: null,
      bestRun: null,
      // Quest progress lives in its own store; this is the copy a future
      // server would receive so a re-login restores the mission board.
      quests: { date: '', claimed: [], chests: 0, crystalsEarned: 0, lifetime: {} },
      stats: { runs: 0, fishEaten: 0, playSeconds: 0, deaths: 0 },
      prefs: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      schema: 1
    };
  }

  // Two devices, one account: union the collections, keep the better of the
  // ceilings (xp, crystals, best run) and add up the lifetime counters. Only
  // the cross-device sync path uses this - a plain write replaces instead, so
  // re-saving the same profile can never double-count a run.
  function mergeProfile(a, b) {
    if (!a) return b;
    if (!b) return a;
    const out = Object.assign({}, a, b.updatedAt > a.updatedAt ? b : a);
    out.crystals = Math.max(a.crystals | 0, b.crystals | 0);
    out.xp = Math.max(a.xp | 0, b.xp | 0);
    out.level = Math.max(a.level | 0, b.level | 0);
    const unlocks = {};
    (a.unlockedEvolutions || []).concat(b.unlockedEvolutions || []).forEach(function (k) { unlocks[k] = 1; });
    out.unlockedEvolutions = Object.keys(unlocks);
    const skins = {};
    (a.skins || []).concat(b.skins || []).forEach(function (k) { skins[k] = 1; });
    out.skins = Object.keys(skins);
    const pets = {};
    (a.pets || []).concat(b.pets || []).forEach(function (k) { pets[k] = 1; });
    out.pets = Object.keys(pets);
    const weapons = {};
    (a.weapons || []).concat(b.weapons || []).forEach(function (k) { weapons[k] = 1; });
    out.weapons = Object.keys(weapons);
    out.equippedWeapon = (a.weapons || []).indexOf(b.equippedWeapon) >= 0 ||
      (b.weapons || []).indexOf(b.equippedWeapon) >= 0 ? b.equippedWeapon : a.equippedWeapon;
    out.bestRun = (a.bestRun && b.bestRun)
      ? (a.bestRun.xp >= b.bestRun.xp ? a.bestRun : b.bestRun)
      : (a.bestRun || b.bestRun);
    const sa = a.stats || {};
    const sb = b.stats || {};
    out.stats = {
      runs: (sa.runs | 0) + (sb.runs | 0),
      fishEaten: (sa.fishEaten | 0) + (sb.fishEaten | 0),
      playSeconds: (sa.playSeconds | 0) + (sb.playSeconds | 0),
      deaths: (sa.deaths | 0) + (sb.deaths | 0)
    };
    out.updatedAt = Date.now();
    out.quests = mergeQuests(a.quests, b.quests);
    return out;
  }

  // ------------------------------------------------------------------
  // Levels
  // ------------------------------------------------------------------
  // Lifetime XP is the ladder. L0->L1 costs 1,000; L1->L2 costs 1,500; from
  // there every step is three times the previous one. The reward for a level
  // is claimed through the congratulations card, which is why `profile.level`
  // records what was collected rather than what the XP says.
  //
  // The payout is 50 crystals for levels 1-5 and doubles every five levels
  // after that: 50, 100, 200, 400, 800...
  const LEVEL_REWARD = 50;
  const LEVEL_MAX = 200;

  function levelNeed(level) {
    if (level <= 0) return 1000;
    if (level === 1) return 1500;
    let need = 1500;
    for (let i = 2; i <= level; i++) need *= 3;
    return need;
  }

  function levelReward(level) {
    const lv = Math.max(1, Math.floor(Number(level) || 1));
    return LEVEL_REWARD * Math.pow(2, Math.floor((lv - 1) / 5));
  }

  function levelForXp(xp) {
    let left = Math.max(0, Math.floor(Number(xp) || 0));
    let level = 0;
    let need = levelNeed(0);
    while (level < LEVEL_MAX && left >= need) {
      left -= need;
      level++;
      need = levelNeed(level);
    }
    return { level: level, into: left, need: need };
  }

  // The tag above the fish takes its colour from this. Levels are grouped in
  // fives and every group keeps its own colour all the way to LEVEL_MAX: the
  // first seven are hand-picked for the levels most players reach, and past
  // those the hue walks by the golden angle — which keeps neighbouring groups
  // about 137 degrees apart — while the lightness steps across three bands so
  // groups that land on a similar hue still read as different numbers.
  const LEVEL_COLORS = ['#a9f0ff', '#7dffb0', '#ffd166', '#ff9f68', '#ff6d7f', '#c792ff', '#6fd6ff'];

  function levelColor(level) {
    const lv = Math.max(0, Math.floor(Number(level) || 0));
    const block = Math.max(0, Math.floor((lv - 1) / 5));
    if (block < LEVEL_COLORS.length) return LEVEL_COLORS[block];
    const hue = Math.round((block * 137.508) % 360);
    const light = 66 + (block % 3) * 5;
    return 'hsl(' + hue + ', 84%, ' + light + '%)';
  }

  A.Levels = {
    need: levelNeed,
    forXp: levelForXp,
    reward: LEVEL_REWARD,
    rewardFor: levelReward,
    colorFor: levelColor
  };

  // Mission boards are per-day, so only the lifetime half of quest progress is
  // worth reconciling between devices.
  function mergeQuests(a, b) {
    a = a || {};
    b = b || {};
    const claimed = {};
    (a.claimed || []).concat(b.claimed || []).forEach(function (k) { claimed[k] = 1; });
    const life = {};
    const la = a.lifetime || {};
    const lb = b.lifetime || {};
    Object.keys(la).concat(Object.keys(lb)).forEach(function (k) {
      life[k] = Math.max(la[k] | 0, lb[k] | 0);
    });
    return {
      date: (a.date || '') > (b.date || '') ? a.date : (b.date || ''),
      claimed: Object.keys(claimed),
      chests: Math.max(a.chests | 0, b.chests | 0),
      crystalsEarned: (a.crystalsEarned | 0) + (b.crystalsEarned | 0),
      lifetime: life
    };
  }

  // ------------------------------------------------------------------
  // Providers
  // ------------------------------------------------------------------
  function store() {
    const s = readJSON(STORE_ACCOUNTS, null);
    if (!s || !s.accounts) return { version: 1, provider: 'local', accounts: {} };
    return s;
  }

  function saveStore(s) {
    return writeJSON(STORE_ACCOUNTS, s);
  }

  function key(username) {
    return String(username || '').toLowerCase();
  }

  const LocalProvider = {
    id: 'local',
    online: false,
    label: 'Local test accounts',

    async list() {
      const s = store();
      return Object.keys(s.accounts).map(function (k) {
        const a = s.accounts[k];
        return { username: a.username, createdAt: a.createdAt, updatedAt: a.updatedAt };
      });
    },

    async get(username) {
      const s = store();
      const a = s.accounts[key(username)];
      if (!a) return null;
      return { username: a.username, profile: a.profile, createdAt: a.createdAt, updatedAt: a.updatedAt };
    },

    async create(username, password, profile) {
      const s = store();
      if (s.accounts[key(username)]) {
        const err = new Error('That username is already registered on this device.');
        err.field = 'username';
        throw err;
      }
      const cred = await makeCredential(password);
      s.accounts[key(username)] = {
        username: username,
        credential: cred,
        profile: profile || newProfile(username),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      if (!saveStore(s)) {
        throw new Error('This browser will not save anything, so the account cannot be created.');
      }
      return { username: username, profile: s.accounts[key(username)].profile };
    },

    async verify(username, password) {
      const s = store();
      const a = s.accounts[key(username)];
      // Verify against a decoy too, so a missing username is not measurably
      // faster than a wrong password.
      if (!a) {
        await derive(password || 'x', b64(new Uint8Array(SALT_BYTES)), KDF_SHA256_ROUNDS, 'SHA256-ITER');
        return null;
      }
      return (await checkCredential(password, a.credential)) ? { username: a.username, profile: a.profile } : null;
    },

    async update(username, patch) {
      const s = store();
      const a = s.accounts[key(username)];
      if (!a) return null;
      // A write from this device is authoritative for its own copy; merging
      // here would count the same run twice the moment it is saved back.
      a.profile = Object.assign({}, a.profile, patch || {});
      a.updatedAt = Date.now();
      saveStore(s);
      return a.profile;
    },

    async remove(username) {
      const s = store();
      if (!s.accounts[key(username)]) return false;
      delete s.accounts[key(username)];
      saveStore(s);
      return true;
    }
  };

  /*
     Real online accounts, served by this game's own origin (`/api/...`).
     The session is an HttpOnly cookie set by the server, so no token is ever
     stored in JavaScript. Every verb fails loudly instead of pretending when
     the backend is unreachable.
  */
  const RemoteProvider = {
    id: 'remote',
    online: true,
    label: 'Online accounts',
    baseUrl: '',

    async request(path, options) {
      const opts = options || {};
      const init = {
        method: opts.method || 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'X-Requested-With': 'ABYSS' }
      };
      if (opts.body !== undefined) {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(opts.body);
      }
      const res = await fetch(this.baseUrl + path, init);
      let data = null;
      try { data = await res.json(); } catch (e) { data = null; }
      if (!res.ok) {
        const err = new Error((data && data.error) || 'The account service refused that request.');
        err.status = res.status;
        if (data && data.field) err.field = data.field;
        throw err;
      }
      return data || {};
    },

    async list() {
      return [];
    },

    // The server only ever returns the caller's own account here - an
    // arbitrary username cannot be looked up, so `get` doubles as a session
    // restore check.
    async get(username) {
      const data = await this.request('/api/me');
      const user = data.user;
      if (!user || String(user.username).toLowerCase() !== String(username).toLowerCase()) return null;
      return {
        username: user.username,
        profile: data.profile || newProfile(user.username),
        createdAt: user.createdAt
      };
    },

    async create(username, password, profile) {
      const data = await this.request('/api/signup', {
        method: 'POST',
        body: { username: username, password: password, confirm: password, profile: profile }
      });
      return {
        username: data.user.username,
        profile: data.profile || profile,
        createdAt: data.user.createdAt
      };
    },

    async verify(username, password) {
      let data;
      try {
        data = await this.request('/api/login', {
          method: 'POST',
          body: { identifier: username, password: password }
        });
      } catch (err) {
        // 401 is the expected "wrong username or password" answer.
        if (err && err.status === 401) return null;
        throw err;
      }
      return {
        username: data.user.username,
        profile: data.profile || newProfile(data.user.username)
      };
    },

    async update(username, patch) {
      const data = await this.request('/api/profile', {
        method: 'PUT',
        body: { profile: patch || {} }
      });
      return data.profile || patch;
    },

    async remove() {
      return false;
    },

    async logout() {
      try {
        await this.request('/api/logout', { method: 'POST', body: {} });
      } catch (e) { /* signing out locally still has to work */ }
    }
  };

  const providers = { local: LocalProvider, remote: RemoteProvider };

  // ------------------------------------------------------------------
  // Session
  // ------------------------------------------------------------------
  function readSession() {
    const s = readJSON(STORE_SESSION, null);
    return s && s.username ? s : null;
  }

  function writeSession(s) {
    if (!s) { try { localStorage.removeItem(STORE_SESSION); } catch (e) { /* ignore */ } return; }
    writeJSON(STORE_SESSION, s);
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------
  const listeners = [];
  const attempts = {};
  let current = null;
  let mode = 'local';
  let detection = null;

  // When the game is served by the ABYSS server, `/api/health` answers and
  // accounts automatically become real online accounts. On a plain static
  // host (or file://), the probe fails quietly and the local test store keeps
  // working exactly as before. Nothing is ever half-online: the provider
  // switch only happens on a confirmed server answer.
  async function detectServer() {
    if (!/^https?:$/.test(location.protocol)) return false;
    try {
      const res = await fetch('api/health', { credentials: 'same-origin', cache: 'no-store' });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data || data.ok !== true || data.accounts !== true) return false;
      RemoteProvider.baseUrl = '';
      mode = 'remote';
      if (A.Account) A.Account.emit();
      return true;
    } catch (e) {
      return false;
    }
  }

  // Push the live profile to the active provider and adopt whatever it hands
  // back, so the in-memory copy and the stored copy never drift apart.
  //
  // Writes are serialised: a death save and a mission payout can land in the
  // same tick, and two requests in flight at once could otherwise resolve out
  // of order and restore an older XP total. The response is only adopted when
  // nothing was edited while the request was out, so a slower echo can never
  // undo a newer local change either.
  let writeChain = Promise.resolve();

  function persist() {
    if (!current) return Promise.resolve(null);
    const who = current;
    writeChain = writeChain.then(async function () {
      if (!current || current !== who) return null;
      const sent = JSON.stringify(current.profile);
      try {
        const saved = await providers[mode].update(current.username, current.profile);
        if (saved && JSON.stringify(current.profile) === sent) current.profile = saved;
      } catch (e) { /* a mirror write must never block play */ }
      return current.profile;
    }).catch(function () { return null; });
    return writeChain;
  }

  const Account = {
    get mode() { return mode; },
    get online() { return !!providers[mode].online; },
    get provider() { return providers[mode]; },

    /* Switching to a real backend later is one call:
         A.Account.configure({ mode: 'online', baseUrl: 'https://api.example' })
       Until that exists, anything online is refused rather than faked. */
    configure(opts) {
      const o = opts || {};
      if (o.baseUrl) RemoteProvider.baseUrl = String(o.baseUrl);
      const want = o.mode === 'online' ? 'remote' : 'local';
      if (want === 'remote' && !RemoteProvider.baseUrl) {
        return { ok: false, error: 'No account server address has been set.' };
      }
      mode = want;
      return { ok: true, mode: mode };
    },

    onChange(cb) {
      if (typeof cb === 'function') listeners.push(cb);
    },

    emit() {
      const snap = Account.status();
      for (let i = 0; i < listeners.length; i++) {
        try { listeners[i](snap); } catch (e) { /* a broken listener must not lock the account */ }
      }
    },

    status() {
      return {
        mode: mode,
        online: Account.online,
        signedIn: !!current,
        username: current ? current.username : '',
        profile: current ? current.profile : null
      };
    },

    currentUser() {
      return current ? { username: current.username, profile: current.profile } : null;
    },

    profile() {
      return current ? current.profile : null;
    },

    displayName() {
      if (!current) return '';
      return current.profile.displayName || current.username;
    },

    async setDisplayName(raw) {
      if (!current) return '';
      const clean = String(raw == null ? '' : raw)
        .replace(/[<>]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 16);
      current.profile.displayName = clean;
      current.profile.updatedAt = Date.now();
      await persist();
      Account.emit();
      return clean || current.username;
    },

    // Guest play keeps using the game's own local save untouched. This only
    // reports whether an account exists to receive progression later.
    async restore() {
      if (detection) await detection;
      const s = readSession();
      if (!s) return null;
      let rec = null;
      try {
        rec = await providers[mode].get(s.username);
      } catch (e) {
        // Offline while signed in: keep the stored session rather than
        // deleting it, so a temporary outage does not sign the player out.
        return null;
      }
      if (!rec) {
        writeSession(null);
        return null;
      }
      current = rec;
      Account.emit();
      return current;
    },

    validateUsername(username) {
      const u = String(username || '').trim();
      if (!u) return 'Pick a username.';
      if (u.length < 3) return 'Usernames need at least 3 characters.';
      if (u.length > 16) return 'Usernames are capped at 16 characters.';
      if (!USER_RE.test(u)) return 'Letters, numbers and _ only - no spaces or symbols.';
      return '';
    },

    // Returns { score 0..4, label, error }
    passwordScore(pw, username) {
      const p = String(pw || '');
      if (!p) return { score: 0, label: '', error: 'Enter a password.' };
      let score = 0;
      if (p.length >= 8) score++;
      if (p.length >= 12) score++;
      if (/[A-Za-z]/.test(p) && /[0-9]/.test(p)) score++;
      if (/[^A-Za-z0-9]/.test(p)) score++;
      const lower = p.toLowerCase();
      let weak = false;
      for (let i = 0; i < WEAK.length; i++) {
        if (lower === WEAK[i] || lower === WEAK[i] + '1' || lower === WEAK[i] + '123') { weak = true; break; }
      }
      if (weak) score = Math.min(score, 1);
      if (username && p.toLowerCase() === String(username).toLowerCase()) {
        return { score: 0, label: 'too obvious', error: 'Do not reuse your username as the password.' };
      }
      if (p.length < 8) {
        return { score: score, label: 'too short', error: 'Passwords need at least 8 characters.' };
      }
      if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) {
        return { score: Math.min(score, 1), label: 'weak', error: 'Mix in at least one letter and one number.' };
      }
      if (weak) {
        return { score: 1, label: 'common', error: 'That password is on the common-list. Pick a stranger one.' };
      }
      const labels = ['weak', 'weak', 'fair', 'strong', 'excellent'];
      return { score: score, label: labels[Math.min(score, 4)], error: '' };
    },

    lockReason(username) {
      const a = attempts[key(username)];
      if (!a || a.count < MAX_ATTEMPTS) return '';
      const wait = Math.ceil((a.until - Date.now()) / 1000);
      if (wait <= 0) { delete attempts[key(username)]; return ''; }
      return 'Too many attempts. Try again in ' + wait + 's.';
    },

    bumpAttempts(username) {
      const k = key(username);
      const a = attempts[k] || { count: 0, until: 0 };
      a.count++;
      if (a.count >= MAX_ATTEMPTS) a.until = Date.now() + LOCK_MS;
      attempts[k] = a;
    },

    async signUp(form) {
      if (detection) await detection;
      const username = String(form.username || '').trim();
      const password = String(form.password || '');
      const confirm = String(form.confirm || '');

      const uErr = Account.validateUsername(username);
      if (uErr) return { ok: false, field: 'username', error: uErr };
      const pErr = Account.passwordScore(password, username);
      if (pErr.error) return { ok: false, field: 'password', error: pErr.error };
      if (!confirm) return { ok: false, field: 'confirm', error: 'Confirm your password.' };
      if (confirm !== password) return { ok: false, field: 'confirm', error: 'The two passwords do not match.' };

      try {
        const rec = await providers[mode].create(username, password, newProfile(username));
        current = rec;
        writeSession({ username: rec.username, since: Date.now() });
        Account.emit();
        return { ok: true, username: rec.username };
      } catch (err) {
        if (err && err.code === 'NOT_CONFIGURED') {
          return { ok: false, error: 'Online accounts are not live yet, so this can only be a local test account.' };
        }
        return { ok: false, field: err && err.field, error: (err && err.message) || 'Could not create that account.' };
      }
    },

    async logIn(form) {
      if (detection) await detection;
      const username = String(form.username || '').trim();
      const password = String(form.password || '');

      const uErr = Account.validateUsername(username);
      if (uErr) return { ok: false, field: 'username', error: uErr };
      const locked = Account.lockReason(username);
      if (locked) return { ok: false, field: 'username', error: locked };
      if (!password) return { ok: false, field: 'password', error: 'Enter your password.' };

      let rec = null;
      try {
        rec = await providers[mode].verify(username, password);
      } catch (err) {
        if (err && err.code === 'NOT_CONFIGURED') {
          return { ok: false, error: 'Online accounts are not live yet. Use a local test account.' };
        }
        if (err && err.status) {
          return { ok: false, field: err.status === 429 ? 'username' : undefined,
                   error: err.message || 'Could not reach the account service.' };
        }
        return { ok: false, error: 'Could not reach the account service.' };
      }
      if (!rec) {
        Account.bumpAttempts(username);
        const why = Account.lockReason(username) ||
          (providers[mode].online ? 'Wrong username or password.' : 'No local account matches that username and password.');
        return { ok: false, field: 'password', error: why };
      }
      delete attempts[key(username)];
      current = rec;
      writeSession({ username: rec.username, since: Date.now() });
      Account.emit();
      return { ok: true, username: rec.username };
    },

    logOut() {
      current = null;
      writeSession(null);
      if (mode === 'remote' && RemoteProvider.logout) RemoteProvider.logout();
      Account.emit();
      return { ok: true };
    },

    // Progression is mirrored into the account only while signed in. The
    // game's own `abyss.best` save is never read from or written to here, so
    // guest progress survives a login untouched.
    //
    // A death costs a third of the XP earned in that run - the evolutions the
    // player reached - never a third of the lifetime bank. The bank therefore
    // only ever climbs: the deduction is taken out of the run before it is
    // added, so `profile.xp` cannot go backwards.
    async recordRun(run) {
      if (!current) return null;
      const p = current.profile;
      p.stats = p.stats || { runs: 0, fishEaten: 0, playSeconds: 0 };
      const earned = Math.max(0, run.xp | 0);
      let lost = 0;
      if (run.died) {
        p.stats.deaths = (p.stats.deaths | 0) + 1;
        if (run.penalized) lost = Math.floor(earned / 3);
      }
      p.xp = Math.max(0, (p.xp | 0) + earned - lost);
      p.stats.runs = (p.stats.runs | 0) + 1;
      p.stats.fishEaten = (p.stats.fishEaten | 0) + (run.eaten | 0);
      p.stats.playSeconds = (p.stats.playSeconds | 0) + (run.time | 0);
      if (run.stageKey && p.unlockedEvolutions.indexOf(run.stageKey) === -1) {
        p.unlockedEvolutions.push(run.stageKey);
      }
      p.currentEvolution = run.stageKey || p.currentEvolution;
      // The loss is a penalty, not a missed run, so the best-run record keeps
      // the full score the player actually reached.
      if (!p.bestRun || (run.xp | 0) > (p.bestRun.xp | 0)) {
        p.bestRun = { xp: run.xp | 0, stageKey: run.stageKey || '', time: run.time | 0 };
      }
      p.updatedAt = Date.now();
      await persist();
      Account.emit();
      return { profile: current.profile, lost: lost };
    },

    async addCrystals(n) {
      if (!current) return 0;
      current.profile.crystals = Math.max(0, (current.profile.crystals | 0) + (n | 0));
      current.profile.updatedAt = Date.now();
      await persist();
      Account.emit();
      return current.profile.crystals;
    },

    // Mission rewards and future event payouts land here. Only ever additive,
    // for the same reason the bank never shrinks on a death.
    async addXp(n) {
      if (!current) return 0;
      current.profile.xp = Math.max(0, (current.profile.xp | 0) + Math.max(0, n | 0));
      current.profile.updatedAt = Date.now();
      await persist();
      Account.emit();
      return current.profile.xp;
    },

    // Generic write for any feature that owns its own store (quests, pets,
    // skins). Nested objects are merged one level deep so a caller can update
    // `quests.chests` without erasing `quests.claimed`.
    async patchProfile(patch) {
      if (!current || !patch) return null;
      const p = current.profile;
      for (const k in patch) {
        if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
        const v = patch[k];
        if (v && typeof v === 'object' && !Array.isArray(v) && p[k] && typeof p[k] === 'object' && !Array.isArray(p[k])) {
          p[k] = Object.assign({}, p[k], v);
        } else {
          p[k] = v;
        }
      }
      p.updatedAt = Date.now();
      await persist();
      Account.emit();
      return current.profile;
    },

    newProfile: newProfile,
    mergeProfile: mergeProfile,
    LocalProvider: LocalProvider,
    RemoteProvider: RemoteProvider
  };

  A.Account = Account;
  Account.ready = detectServer();
  detection = Account.ready;
})();
