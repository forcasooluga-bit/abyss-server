/* ABYSS.IO — account interface
   Drives the menu account card and the login / sign up modal. All of the
   actual account work lives in js/account.js behind the provider seam, so this
   file keeps no secrets and makes no network calls: swapping the local test
   store for a real backend later is a change in account.js, not here. */
(function () {
  const A = window.ABYSS;
  if (!A || !A.Account) return;

  const $ = function (id) { return document.getElementById(id); };

  const el = {
    card: $('accountCard'),
    mode: $('accountMode'),
    guest: $('accountGuest'),
    user: $('accountUser'),
    avatar: $('accountAvatar'),
    name: $('accountName'),
    countryFlag: $('accountCountryFlag'),
    crystals: $('accountCrystals'),
    level: $('accountLevel'),
    profile: $('accountProfile'),
    profileBtn: $('profileBtn'),
    logoutBtn: $('logoutBtn'),
    modal: $('authModal'),
    close: $('authClose'),
    tabs: document.querySelector('.auth-tabs'),
    tabLogin: $('tabLogin'),
    tabSignup: $('tabSignup'),
    paneLogin: $('paneLogin'),
    paneSignup: $('paneSignup'),
    loginUser: $('loginUser'),
    loginPass: $('loginPass'),
    loginSubmit: $('loginSubmit'),
    signupUser: $('signupUser'),
    signupPass: $('signupPass'),
    signupConfirm: $('signupConfirm'),
    signupStrength: $('signupStrength'),
    signupSubmit: $('signupSubmit'),
    toast: $('toast'),
    nameHint: $('nameHint')
  };

    // Anything the player already typed stays put until they ask otherwise.
  let busy = false;
  let pane = 'login';
  let toastTimer = 0;
  let lastFocus = null;
  let levelOpen = false;

  // ------------------------------------------------------------------
  // World snapshot
  // ------------------------------------------------------------------
  // /api/world is the only public feed this page reads: the server's start
  // time (the monster-gate clock) and the names of registered players seen in
  // the last minute. The game reads it through A.Online; nothing is cached
  // beyond this object and nothing is ever written to storage.
  const world = { startedAt: 0, portal: null, online: [], syncedAt: 0, skew: 0 };
  A.Online = {
    players: function () { return world.online; },
    startedAt: function () { return world.startedAt; },
    portal: function () { return world.portal; },
    syncedAt: function () { return world.syncedAt; },
    // Seconds since the server process started, corrected for clock drift
    // between this machine and the host. Null when no snapshot exists yet.
    elapsed: function () {
      if (!world.startedAt) return null;
      const sec = (Date.now() + world.skew - world.startedAt) / 1000;
      return sec > 0 ? sec : 0;
    },
    connected: function () {
      return !!(A.Account && A.Account.online && A.Account.mode === 'remote');
    }
  };

  function pollWorld() {
    fetch('api/world', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.ok) return;
        world.startedAt = Number(data.startedAt) || 0;
        world.portal = data.portal || null;
        world.online = Array.isArray(data.online) ? data.online.slice(0, 50) : [];
        const serverNow = Number(data.now);
        world.skew = serverNow ? serverNow - Date.now() : 0;
        world.syncedAt = Date.now();
      })
      .catch(function () { /* the reef plays fine without the feed */ });
  }

  function say(text, ms) {
    if (!el.toast) return;
    el.toast.textContent = text;
    el.toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.toast.classList.remove('show');
      toastTimer = 0;
    }, ms || 3200);
  }

  // ------------------------------------------------------------------
  // Field errors
  // ------------------------------------------------------------------
  function fieldOf(input) {
    return input ? input.closest('.field') : null;
  }

  function setError(input, msg) {
    if (!input) return;
    const field = fieldOf(input);
    if (!field) return;
    const note = field.querySelector('.field-error');
    const bad = !!msg;
    field.classList.toggle('bad', bad);
    if (note) {
      note.textContent = msg || '';
      note.classList.toggle('show', bad);
    }
  }

  function clearErrors(pane) {
    const fields = pane.querySelectorAll('.field');
    for (let i = 0; i < fields.length; i++) {
      fields[i].classList.remove('bad');
      const note = fields[i].querySelector('.field-error');
      if (note) { note.textContent = ''; note.classList.remove('show'); }
    }
  }

  function report(result, inputs) {
    let first = null;
    if (result && result.field && inputs[result.field]) {
      setError(inputs[result.field], result.error);
      first = inputs[result.field];
    } else if (result && result.error) {
      say(result.error);
    }
    const shell = el.modal.querySelector('.auth-card');
    if (shell) {
      shell.classList.remove('shake');
      // Force a reflow so the same failure twice in a row still animates.
      void shell.offsetWidth;
      shell.classList.add('shake');
    }
    if (first) first.focus();
  }

  // ------------------------------------------------------------------
  // Panes
  // ------------------------------------------------------------------
  function setPane(which, focusFirst) {
    const signup = which === 'signup';
    pane = signup ? 'signup' : 'login';
    if (el.tabs) el.tabs.setAttribute('data-pane', pane);
    el.tabLogin.classList.toggle('active', !signup);
    el.tabSignup.classList.toggle('active', signup);
    el.tabLogin.setAttribute('aria-selected', String(!signup));
    el.tabSignup.setAttribute('aria-selected', String(signup));
    el.paneLogin.classList.toggle('active', !signup);
    el.paneSignup.classList.toggle('active', signup);
    clearErrors(el.paneLogin);
    clearErrors(el.paneSignup);
    if (focusFirst) {
      const target = signup ? el.signupUser : el.loginUser;
      if (target) target.focus();
    }
  }

  function isOpen() {
    return !!el.modal && !el.modal.classList.contains('hidden');
  }

  function openAuth(which) {
    if (!el.modal) return;
    lastFocus = document.activeElement;
    el.modal.classList.remove('hidden');
    document.body.classList.add('auth-open');
    setPane(which || 'login', true);
  }

  function closeAuth() {
    if (!isOpen()) return;
    el.modal.classList.add('hidden');
    document.body.classList.remove('auth-open');
    el.signupPass.value = '';
    el.signupConfirm.value = '';
    setEye(el.signupPass, false);
    setEye(el.signupConfirm, false);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // ------------------------------------------------------------------
  // Password visibility
  // ------------------------------------------------------------------
  function setEye(input, visible) {
    if (!input) return;
    const btn = document.querySelector('.field-eye[data-eye="' + input.id + '"]');
    input.type = visible ? 'text' : 'password';
    if (btn) {
      btn.textContent = visible ? 'HIDE' : 'SHOW';
      btn.classList.toggle('on', visible);
    }
  }

  function toggleBusy(btn, on, workingLabel) {
    if (!btn) return;
    if (on) {
      btn.dataset.label = btn.textContent;
      btn.textContent = workingLabel || 'CHECKING…';
      btn.disabled = true;
    } else {
      btn.textContent = btn.dataset.label || btn.textContent;
      btn.disabled = false;
    }
  }

  // ------------------------------------------------------------------
  // Live validation
  // ------------------------------------------------------------------
  function validateLoginUser(show) {
    const v = el.loginUser.value.trim();
    if (!show && !v) { setError(el.loginUser, ''); return true; }
    const err = v ? A.Account.lockReason(v) || A.Account.validateUsername(v) : 'Pick a username.';
    setError(el.loginUser, err);
    return !err;
  }

  function validateSignupUser() {
    const v = el.signupUser.value.trim();
    const err = A.Account.validateUsername(v);
    setError(el.signupUser, err);
    return !err;
  }

  function validateSignupPass() {
    const p = el.signupPass.value;
    const res = A.Account.passwordScore(p, el.signupUser.value.trim());
    if (el.signupStrength) {
      el.signupStrength.setAttribute('data-score', String(res.score));
      el.signupStrength.setAttribute('title', res.label || '');
    }
    setError(el.signupPass, res.error);
    return !res.error;
  }

  function validateSignupConfirm() {
    const c = el.signupConfirm.value;
    if (!c) { setError(el.signupConfirm, 'Confirm your password.'); return false; }
    const err = c === el.signupPass.value ? '' : 'The two passwords do not match.';
    setError(el.signupConfirm, err);
    return !err;
  }

  // ------------------------------------------------------------------
  // Submissions
  // ------------------------------------------------------------------
  async function submitLogIn(ev) {
    if (ev) ev.preventDefault();
    if (busy) return;
    const inputs = { username: el.loginUser, password: el.loginPass };
    clearErrors(el.paneLogin);
    if (!validateLoginUser(true)) { report({ error: 'Check the username.' }, inputs); return; }
    if (!el.loginPass.value) {
      setError(el.loginPass, 'Enter your password.');
      report({ error: 'Check the password.' }, inputs);
      return;
    }
    busy = true;
    toggleBusy(el.loginSubmit, true, 'CHECKING…');
    const res = await A.Account.logIn({ username: el.loginUser.value, password: el.loginPass.value });
    busy = false;
    toggleBusy(el.loginSubmit, false);
    if (!res.ok) { report(res, inputs); return; }
    el.loginPass.value = '';
    setEye(el.loginPass, false);
    closeAuth();
    say('Welcome back, ' + A.Account.displayName() + '.');
  }

  async function submitSignUp(ev) {
    if (ev) ev.preventDefault();
    if (busy) return;
    const inputs = { username: el.signupUser, password: el.signupPass, confirm: el.signupConfirm };
    clearErrors(el.paneSignup);
    const okU = validateSignupUser();
    const okP = validateSignupPass();
    const okC = validateSignupConfirm();
    if (!okU || !okP || !okC) { report({ error: 'Fix the highlighted fields.' }, inputs); return; }
    busy = true;
    toggleBusy(el.signupSubmit, true, 'CREATING…');
    const res = await A.Account.signUp({
      username: el.signupUser.value,
      password: el.signupPass.value,
      confirm: el.signupConfirm.value
    });
    busy = false;
    toggleBusy(el.signupSubmit, false);
    if (!res.ok) { report(res, inputs); return; }
    el.signupPass.value = '';
    el.signupConfirm.value = '';
    setEye(el.signupPass, false);
    setEye(el.signupConfirm, false);
    if (el.signupStrength) el.signupStrength.setAttribute('data-score', '0');
    closeAuth();
    say((A.Account.online ? 'Account created for ' : 'Local test account created for ') + res.username + '.');
  }

  // ------------------------------------------------------------------
  // Account card
  // ------------------------------------------------------------------
  function initials(username) {
    const u = String(username || '?');
    return u.slice(0, 2).toUpperCase();
  }

  function stageName(key) {
    const idx = A.stageByKey ? A.stageByKey(key) : 0;
    return A.STAGES[idx] ? A.STAGES[idx].name : 'Tiny Blue Fish';
  }

  function num(n) {
    return A.formatNumber ? A.formatNumber(n | 0) : String(n | 0);
  }

  function updateCountryFlag() {
    if (!el.countryFlag) return;
    let code = '';
    try {
      code = A.Online && typeof A.Online.countryCode === 'function'
        ? String(A.Online.countryCode() || '').toUpperCase()
        : String(localStorage.getItem('abyss_country_code') || '').toUpperCase();
    } catch (error) {}
    if (!/^[A-Z]{2}$/.test(code)) {
      el.countryFlag.hidden = true;
      el.countryFlag.textContent = '';
      return;
    }
    el.countryFlag.hidden = false;
    const image = document.createElement('img');
    image.alt = code + ' flag';
    image.src = 'https://flagcdn.com/w40/' + code.toLowerCase() + '.png';
    image.onerror = function () {
      el.countryFlag.textContent = code;
    };
    el.countryFlag.replaceChildren(image);
  }

  window.addEventListener('abyss-country-detected', updateCountryFlag);

  function render(snap) {
    const s = snap || A.Account.status();
    if (!el.card) return;
    const signedIn = !!s.signedIn;
    const online = !!s.online;
    el.card.classList.toggle('has-user', signedIn);
    if (el.mode) {
      el.mode.textContent = online ? 'ONLINE ACCOUNTS' : 'LOCAL TEST MODE';
      el.mode.classList.toggle('online', online);
    }
    // The account card tells the truth about where the account actually lives.
    const note = function (id, text) {
      const node = $(id);
      if (node) node.textContent = text;
    };
    note('guestNote', online
      ? 'Playing as a guest. Create an account to keep your crystals, evolutions and runs across devices.'
      : 'Playing as a guest. Your run is saved on this device only.');
    note('memberNote', online
      ? 'Registered account · progress is saved to the ABYSS.IO account server.'
      : 'Local test account - kept in this browser only. It is not registered with any online service yet.');
    note('loginNotice', online
      ? 'Online account. Your password is checked by the ABYSS.IO server and is never stored in this browser.'
      : 'Local test account. Your password is never stored - only a random salt and a stretched digest stay in this browser, and nothing is sent anywhere.');
    note('signupNotice', online
      ? 'Creates a real ABYSS.IO account on this server. Your password is sent over this connection and stored only as a salted hash.'
      : 'This is a temporary local test account on this PC. It is not a secure online registration, and it can be lost if the browser storage is cleared.');
    note('loginSub', online
      ? 'Sign in to sync your crystals, evolutions and runs with the ABYSS.IO server.'
      : 'Sign in to attach this device\u2019s progress to an account.');
    note('signupSub', online
      ? 'Reserves your name on the ABYSS.IO account server.'
      : 'Reserves your name for the day cross-device sync arrives.');
    note('pfSync', online
      ? 'This profile is synced with the ABYSS.IO account server. Signing in with this username on another device restores your crystals, evolutions, skins, pets and XP.'
      : 'Cross-device sync is not live on this host. When the account server is running, signing in with this username on another PC restores the crystals, evolutions, skins, pets and XP held here.');
    if (el.guest) el.guest.hidden = signedIn;
    if (el.user) el.user.hidden = !signedIn;
    if (signedIn) {
      if (el.avatar) el.avatar.textContent = initials(s.username);
      if (el.name) el.name.textContent = s.username;
      updateCountryFlag();
      const crystals = s.profile ? s.profile.crystals | 0 : 0;
      if (el.crystals) el.crystals.textContent = num(crystals);
      if (el.level) {
        const lv = s.profile && A.Levels ? A.Levels.forXp(s.profile.xp | 0).level : 0;
        el.level.textContent = 'LV ' + lv;
      }
      fillProfile(s.profile);
    }
    // The name field has a different owner once an account is attached.
    const nameField = $('playerNameInput');
    if (nameField) {
      nameField.disabled = !signedIn;
      if (!signedIn) nameField.value = 'Guest';
    }
    if (el.nameHint) {
      el.nameHint.textContent = signedIn
        ? 'Account display name · saved to the account · change it any time'
        : 'Sign up or log in to change your name · you swim as Guest';
    }
    if (A.AccountUI && typeof A.AccountUI.onRender === 'function') {
      try { A.AccountUI.onRender(s); } catch (e) { /* the game can live without a repaint */ }
    }
    if (signedIn) maybeLevelUp();
  }

  function fillProfile(p) {
    if (!p || !el.profile) return;
    const set = function (id, value) {
      const n = $(id);
      if (n) n.textContent = value;
    };
    set('pfCrystals', num(p.crystals | 0));
    set('pfXp', A.Levels
      ? 'LV ' + A.Levels.forXp(p.xp | 0).level + ' · ' + num(p.xp | 0) + ' XP'
      : num(p.xp | 0) + ' XP');
    set('pfEvolutions', String((p.unlockedEvolutions || []).length));
    set('pfCurrent', stageName(p.currentEvolution));
    set('pfSkins', String((p.skins || []).length));
    set('pfPets', String((p.pets || []).length));
    set('pfRuns', num((p.stats && p.stats.runs) | 0));
    set('pfBest', p.bestRun ? num(p.bestRun.xp | 0) + ' XP' : 'No runs yet');
  }

  // ------------------------------------------------------------------
  // Level-up card
  // ------------------------------------------------------------------
  // One level at a time: the reward is only banked when OK is pressed, and the
  // claimed level rides on the profile, so closing the tab cannot double-pay.
  function maybeLevelUp() {
    if (levelOpen) return;
    // Never slap a dialog over a live dive: the check runs again as soon as
    // the reef is idle, so a level earned mid-run still pays out.
    if (A.game && A.game.state === 'playing') return;
    const p = A.Account.profile();
    if (!p || !A.Levels) return;
    const reached = A.Levels.forXp(p.xp | 0).level;
    const claimed = p.level | 0;
    if (reached <= claimed) return;
    showLevelCard(claimed + 1);
  }

  function showLevelCard(level) {
    levelOpen = true;
    const gain = A.Levels.rewardFor ? A.Levels.rewardFor(level) : A.Levels.reward;
    const overlay = document.createElement('div');
    overlay.className = 'levelup-overlay';
    overlay.innerHTML =
      '<div class="levelup-card" role="dialog" aria-modal="true" aria-labelledby="levelupTitle">' +
        '<span class="levelup-kicker">PROGRESSION</span>' +
        '<h2 class="levelup-title" id="levelupTitle">Congrats, you reached level ' + level + '</h2>' +
        '<p class="levelup-text">Here ' + (gain === 1 ? 'is' : 'are') + ' ' +
          num(gain) + ' crystals for you.</p>' +
        '<div class="levelup-reward"><b>+' + num(gain) + '</b><span>CRYSTALS</span></div>' +
        '<button class="btn primary levelup-ok" type="button">OK</button>' +
      '</div>';
    document.body.appendChild(overlay);
    const btn = overlay.querySelector('.levelup-ok');
    if (btn) btn.focus();
    overlay.addEventListener('click', async function (ev) {
      if (!ev.target.closest('.levelup-ok')) return;
      ev.preventDefault();
      overlay.remove();
      levelOpen = false;
      const p = A.Account.profile();
      if (p && (p.level | 0) < level) {
        await A.Account.patchProfile({
          level: level,
          crystals: (p.crystals | 0) + (gain | 0)
        });
      }
      render();
      say('Level ' + level + ' · +' + num(gain) + ' crystals');
      if (A.Audio && A.Audio.evolve) A.Audio.evolve();
      maybeLevelUp();
    });
  }

  function bind() {
    if (!el.modal) return;
    $('loginBtn').addEventListener('click', function () { openAuth('login'); });
    $('signupBtn').addEventListener('click', function () { openAuth('signup'); });
    el.close.addEventListener('click', closeAuth);
    el.modal.addEventListener('mousedown', function (ev) {
      if (ev.target === el.modal) closeAuth();
    });
    el.tabLogin.addEventListener('click', function () { setPane('login', true); });
    el.tabSignup.addEventListener('click', function () { setPane('signup', true); });

    const links = el.modal.querySelectorAll('.auth-link');
    for (let i = 0; i < links.length; i++) {
      links[i].addEventListener('click', function () {
        setPane(this.getAttribute('data-goto'), true);
      });
    }
    const eyes = el.modal.querySelectorAll('.field-eye');
    for (let i = 0; i < eyes.length; i++) {
      eyes[i].addEventListener('click', function () {
        const input = $(this.getAttribute('data-eye'));
        setEye(input, input.type !== 'text');
      });
    }

    el.paneLogin.addEventListener('submit', submitLogIn);
    el.paneSignup.addEventListener('submit', submitSignUp);

    el.loginUser.addEventListener('input', function () { validateLoginUser(false); });
    el.loginUser.addEventListener('blur', function () { validateLoginUser(true); });
    el.signupUser.addEventListener('blur', validateSignupUser);
    el.signupPass.addEventListener('input', validateSignupPass);
    el.signupPass.addEventListener('blur', function () {
      if (el.signupConfirm.value) validateSignupConfirm();
    });
    el.signupConfirm.addEventListener('input', validateSignupConfirm);

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && isOpen()) {
        ev.preventDefault();
        closeAuth();
      }
    });

    if (el.profileBtn) {
      el.profileBtn.addEventListener('click', function () {
        const open = el.profile.hidden;
        el.profile.hidden = !open;
        el.profileBtn.textContent = open ? 'HIDE PROFILE' : 'PROFILE';
        if (open) render();
      });
    }
    if (el.logoutBtn) {
      el.logoutBtn.addEventListener('click', function () {
        A.Account.logOut();
        el.profile.hidden = true;
        if (el.profileBtn) el.profileBtn.textContent = 'PROFILE';
        say('Signed out. This device keeps playing as a guest.');
      });
    }
  }

  A.AccountUI = {
    open: openAuth,
    close: closeAuth,
    isOpen: isOpen,
    isBlocking: function () { return levelOpen; },
    render: render,
    say: say,
    get pane() { return pane; }
  };

  A.Account.onChange(render);
  bind();
  render();

  // A session saved before a refresh is restored without asking again.
  const boot = A.Account.restore();
  if (boot && typeof boot.then === 'function') {
    boot.then(function (rec) {
      render();
      if (rec) say('Signed in as ' + A.Account.displayName() + '.');
    }).catch(function () { render(); });
  }

  // ------------------------------------------------------------------
  // Presence heartbeat
  // ------------------------------------------------------------------
  // The admin dashboard needs to know how many guests are in the water
  // without inventing accounts for them. Only runs when the probe confirmed
  // this origin is the ABYSS server, so a static host never sees the call.
  function guestId() {
    try {
      const stored = localStorage.getItem('abyss.guest.id');
      if (stored && /^[A-Za-z0-9_-]{8,64}$/.test(stored)) return stored;
      const bytes = new Uint8Array(12);
      if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
      else for (let i = 0; i < bytes.length; i++) bytes[i] = (Math.random() * 256) | 0;
      let id = '';
      for (let i = 0; i < bytes.length; i++) id += (bytes[i] + 0x100).toString(16).slice(1);
      localStorage.setItem('abyss.guest.id', id);
      return id;
    } catch (e) {
      return 'guest' + Math.random().toString(16).slice(2, 14);
    }
  }

  function currentPresenceName() {
    if (A.Account && A.Account.status && A.Account.status().signedIn) {
      return A.Account.displayName() || 'Guest';
    }
    return 'Guest';
  }

  function startPresence() {
    const id = guestId();
    function beat() {
      fetch('api/presence', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'ABYSS' },
        body: JSON.stringify({ id: id, name: currentPresenceName() })
      }).catch(function () { /* presence is best-effort */ });
      pollWorld();
    }
    setTimeout(beat, 1200);
    setInterval(beat, 20000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) beat();
    });
    window.addEventListener('pagehide', beat);
  }

  if (A.Account.ready && typeof A.Account.ready.then === 'function') {
    A.Account.ready.then(function (online) {
      if (online) startPresence();
    });
  }

  // A run banks its XP when it ends, which can happen without any account
  // change to trigger a render. This quiet poll catches that moment.
  setInterval(function () {
    if (A.Account.status && A.Account.status().signedIn) maybeLevelUp();
  }, 3000);
})();
