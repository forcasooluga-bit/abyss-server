(function () {
  'use strict';

  const A = window.ABYSS;
  const TAU = A.TAU;
  const W = A.WORLD;

  // ------------------------------------------------------------------
  // The secret monster world
  // ------------------------------------------------------------------
  // This build has no server-side boss authority: the arena is a local
  // encounter (the honest limit of this build). The gate window, however, is
  // shared. When the ABYSS server answers, /api/world hands every client the
  // same start time, so the countdown is identical for everyone: 20 minutes
  // sealed, then 7 minutes open, repeating forever. Offline the same schedule
  // runs from the moment this page loaded.
  const CLOSED_FOR = 1200;  // 20 minutes sealed
  const OPEN_FOR = 420;     // 7 minutes open
  const CYCLE = CLOSED_FOR + OPEN_FOR;
  const LOAD_SEC = Date.now() / 1000;

  const ELIGIBLE = { shark: 1, octopus: 1, sawshark: 1, orca: 1, megalodon: 1 };
  const HITS = 12;
  const BOSS_NAME = 'POSEIDON, TYRANT OF THE MONSTER WORLD';
  const REWARD = 100;
  const GUARD_KEY = 'abyss.monster.reward.v1';

  // The gate sits on the sand in the south-west of the reef, at the end of a
  // rune-cut path. The path is roughly five seconds of swimming for a shark.
  const GATE_X = 2450;
  const PATH_X0 = 1120;
  const PATH_SLABS = 15;

  // Arena space. Its own coordinates, its own camera: the main reef is never
  // touched while the player is inside.
  const AW = 5200;
  const AH = 3400;
  const FLOOR = 3060;
  const SPAWN = { x: 680, y: 2740 };
  const BOSS_HOME = { x: 3370, y: 2200 };
  const BOSS_R = 300;

  const S = {
    mode: 'idle',          // idle | arena | leaving
    t: 0,
    fade: 0,
    savedPos: null,
    savedCam: null,
    cam: { x: SPAWN.x, y: SPAWN.y, zoom: 0.8, shake: 0 },
    boss: null,
    attacks: [],
    bolts: [],
    rocks: [],
    sparks: [],
    texts: [],
    eels: [],
    arena: null,
    panel: null,
    panelTimer: 0,
    hudTimer: 0,
    msg: null,
    msgUntil: 0,
    victoryAt: 0,
    leaveIn: 0,
    leaveReason: '',
    awarded: false,
    near: 0,
    guards: {
      shake: 0, flash: 0, lowWarned: false
    }
  };

  function nowSec() { return Date.now() / 1000; }

  // The top-left status panel and the ability docks still belong to the
  // player; the reef's score board, minimap and depth chip do not.
  (function injectStyle() {
    const style = document.createElement('style');
    style.textContent =
      'body.monster-world #rightHud,body.monster-world #zoneChip,' +
      'body.monster-world #gateChip,' +
      'body.monster-world #starvationWarn,body.monster-world #controlsHint{display:none!important}' +
      'body.monster-world #statusPanel{opacity:.94}';
    document.head.appendChild(style);
  })();

  function portalWindow() {
    // The server publishes the two lengths so a config change there does not
    // need a client rebuild; the constants above are the fallback.
    const cfg = A.Online && A.Online.portal ? A.Online.portal() : null;
    const closed = cfg && cfg.closedSeconds > 0 ? cfg.closedSeconds : CLOSED_FOR;
    const openFor = cfg && cfg.openSeconds > 0 ? cfg.openSeconds : OPEN_FOR;
    return { closed: closed, open: openFor, total: closed + openFor };
  }

  function cycle() {
    const win = portalWindow();
    let elapsed = A.Online && A.Online.elapsed ? A.Online.elapsed() : null;
    if (elapsed == null) elapsed = nowSec() - LOAD_SEC;
    if (!(elapsed >= 0)) elapsed = 0;
    const idx = Math.floor(elapsed / win.total);
    const phase = elapsed % win.total;
    const open = phase >= win.closed;
    return {
      idx: idx,
      open: open,
      left: open ? (win.total - phase) : (win.closed - phase),
      phase: phase
    };
  }

  function fmt(sec) {
    const s = Math.max(0, Math.ceil(sec));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function game() { return A.game; }
  function player() { return A.game ? A.game.player : null; }

  function stageOf(p) {
    return p ? A.STAGES[p.stageIndex] : null;
  }

  function eligible(p) {
    const st = stageOf(p);
    return !!(st && ELIGIBLE[st.key]);
  }

  function gateBase(world) {
    const w = world || (A.game && A.game.world);
    return (w && w.floorY ? w.floorY(GATE_X) : W.h - 380) - 18;
  }

  function gateMid(world) {
    return { x: GATE_X, y: gateBase(world) - 250 };
  }

  // ------------------------------------------------------------------
  // Small local effect helpers (the arena has its own pools; the reef's
  // particle arrays belong to the reef and are not touched from here)
  // ------------------------------------------------------------------
  function spark(x, y, vx, vy, size, color, life) {
    if (S.sparks.length > 220) S.sparks.splice(0, 40);
    S.sparks.push({ x: x, y: y, vx: vx, vy: vy, size: size, color: color, life: life, maxLife: life });
  }

  function burst(x, y, n, colors, speed, size) {
    for (let i = 0; i < n; i++) {
      const a = A.rand(0, TAU);
      const v = A.rand(speed * 0.25, speed);
      spark(x, y, Math.cos(a) * v, Math.sin(a) * v - speed * 0.12,
        A.rand(size * 0.5, size), colors[(Math.random() * colors.length) | 0], A.rand(0.35, 0.85));
    }
  }

  function text(x, y, txt, color, size) {
    if (S.texts.length > 30) S.texts.shift();
    S.texts.push({ x: x, y: y, text: txt, color: color, size: size || 26, life: 1.0, maxLife: 1.0 });
  }

  function say(title, sub, seconds) {
    S.msg = { title: title, sub: sub || '' };
    S.msgUntil = S.t + (seconds || 3.2);
  }

  function toast(txt, ms) {
    const g = game();
    if (g && g.ui && g.ui.toast) g.ui.toast(txt, ms || 3200);
  }

  function shake(amount) {
    S.cam.shake = Math.min(1.2, S.cam.shake + amount);
  }

  function hitPlayer(amount, fromX, fromY, source) {
    const p = player();
    const g = game();
    if (!p || !g || S.mode !== 'arena') return;
    if (g.sim < p.invulnUntil) return;
    const ab = p.ability;
    if (ab && ab.id === 'shield' && g.sim < p.abilityActiveUntil) amount *= 1 - ab.shield;
    p.health = Math.max(0, p.health - amount);
    p.lastDamage = g.sim;
    p.invulnUntil = g.sim + 0.75;
    p.hitFlash = 0.3;
    if (fromX != null) {
      const ang = Math.atan2(p.y - fromY, p.x - fromX);
      p.knockX = (p.knockX || 0) + Math.cos(ang) * 380;
      p.knockY = (p.knockY || 0) + Math.sin(ang) * 380;
    }
    S.guards.flash = 0.55;
    shake(0.45);
    A.Audio.hurt();
    burst(p.x, p.y, 8, ['#ff6d7f', '#ffb0a0', '#ffffff'], 140, 3);
    text(p.x, p.y - p.radius * 1.6, '-' + Math.round(amount), '#ff9aa6', 30);
    const flash = document.getElementById('damageFlash');
    if (flash) flash.style.opacity = '0.5';
    if (p.health <= 0) {
      // Dying inside the gate must never swallow the run: the monster world
      // rejects the intruder instead of ending the dive.
      p.health = Math.max(1, Math.round(p.maxHealth * 0.35));
      p.invulnUntil = g.sim + 3;
      leave('defeated');
    }
  }

  // ------------------------------------------------------------------
  // Entrance panel
  // ------------------------------------------------------------------
  function ensurePanel() {
    if (S.panel) return;
    const hud = document.getElementById('hud');
    if (!hud) return;
    const el = document.createElement('div');
    el.id = 'monsterGateHud';
    el.style.cssText = [
      'position:absolute', 'left:18px', 'bottom:104px', 'z-index:6',
      'display:none', 'min-width:250px', 'padding:10px 14px 11px',
      'border-radius:12px', 'border:1px solid rgba(126,220,206,0.35)',
      'background:linear-gradient(160deg, rgba(6,26,32,0.92), rgba(3,14,20,0.9))',
      'box-shadow:0 10px 30px rgba(0,0,0,0.45), inset 0 0 22px rgba(46,180,168,0.08)',
      'color:#d8fbf6', 'font-family:Trebuchet MS, Verdana, sans-serif',
      'letter-spacing:0.06em', 'pointer-events:none', 'transition:opacity .35s'
    ].join(';');
    el.innerHTML =
      '<div style="display:flex;justify-content:space-between;gap:14px;align-items:baseline">' +
      '<span style="font-size:11px;color:#79d9cd;letter-spacing:0.22em">MONSTER GATE</span>' +
      '<span id="mgState" style="font-size:11px;font-weight:700;color:#8ff7d8">OPEN</span></div>' +
      '<div id="mgTimer" style="margin-top:5px;font-size:19px;font-weight:700;color:#eafffb">0:00</div>' +
      '<div id="mgHint" style="margin-top:4px;font-size:11px;color:#8fb9b6;line-height:1.35"></div>';
    hud.appendChild(el);
    S.panel = el;
  }

  function updatePanel() {
    ensurePanel();
    if (!S.panel) return;
    const p = player();
    const g = game();
    if (!p || !g || g.state !== 'playing' || S.mode !== 'idle') {
      if (S.panel.style.display !== 'none') S.panel.style.display = 'none';
      return;
    }
    const mid = gateMid(g.world);
    const d2 = A.dist2(p.x, p.y, mid.x, mid.y);
    const near = d2 < 2600 * 2600;
    S.near = Math.sqrt(d2);
    if (!near) {
      if (S.panel.style.display !== 'none') S.panel.style.display = 'none';
      return;
    }
    const c = cycle();
    const stEl = document.getElementById('mgState');
    const timerEl = document.getElementById('mgTimer');
    const hintEl = document.getElementById('mgHint');
    if (!stEl || !timerEl || !hintEl) return;
    if (S.panel.style.display !== 'block') S.panel.style.display = 'block';
    stEl.textContent = c.open ? 'OPEN' : 'SEALED';
    stEl.style.color = c.open ? '#8ff7d8' : '#f0a58a';
    timerEl.textContent = (c.open ? 'Closes in ' : 'Reopens in ') + fmt(c.left);
    let hint;
    if (!eligible(p)) hint = 'Only sharks, octopuses, sawsharks, orcas and megalodons may pass.';
    else if (!c.open) hint = 'The gate is barred until the next window.';
    else if (S.near < 340) hint = 'Press E to enter the monster world.';
    else hint = 'Follow the rune path to the gate.';
    if (hintEl.textContent !== hint) hintEl.textContent = hint;
  }

  // ------------------------------------------------------------------
  // Enter / leave
  // ------------------------------------------------------------------
  function attemptEnter() {
    const p = player();
    const g = game();
    if (!p || !g || g.state !== 'playing' || S.mode !== 'idle') return;
    const mid = gateMid(g.world);
    if (A.dist2(p.x, p.y, mid.x, mid.y) > 340 * 340) return;
    const c = cycle();
    if (!eligible(p)) {
      toast('The gate refuses you. Only sharks, octopuses, sawsharks, orcas and megalodons may pass.', 4200);
      A.Audio.deny ? A.Audio.deny() : A.Audio.click();
      return;
    }
    if (!c.open) {
      toast('The monster gate is sealed. It reopens in ' + fmt(c.left) + '.', 3600);
      A.Audio.click();
      return;
    }
    enter();
  }

  function enter() {
    const p = player();
    const g = game();
    if (!p || !g || S.mode !== 'idle') return;
    S.savedPos = { x: p.x, y: p.y, angle: p.angle };
    S.savedCam = { x: g.camera.x, y: g.camera.y, zoom: g.camera.zoom };
    S.mode = 'arena';
    S.fade = 1;
    S.t = 0;
    S.guards.lowWarned = false;
    S.guards.flash = 0;
    S.awarded = false;
    S.leaveIn = 0;
    resetArena(p);
    p.x = SPAWN.x;
    p.y = SPAWN.y;
    p.angle = -0.05;
    p.targetAngle = p.angle;
    p.speedSmooth = 0;
    p.knockX = 0;
    p.knockY = 0;
    p.chargeUntil = 0;
    p.abilityActiveUntil = 0;
    const st = stageOf(p);
    if (A.Shop) {
      p.weapon = A.Shop.heldFor(st && st.key);
      p.weaponSkin = A.Shop.activeSlot ? A.Shop.activeSlot('skin') : null;
    }
    S.cam.x = SPAWN.x + 260;
    S.cam.y = SPAWN.y - 60;
    S.cam.zoom = zoomFor(p);
    S.cam.shake = 0;
    if (A.Collection && A.Collection.reset) A.Collection.reset();
    document.body.classList.add('monster-world');
    if (S.panel) S.panel.style.display = 'none';
    const flash = document.getElementById('damageFlash');
    if (flash) flash.style.opacity = '0';
    say('MONSTER WORLD', 'The gate closes behind you.', 3.0);
    A.Audio.discover();
    if (A.Quests) A.Quests.site();
  }

  function leave(reason) {
    const p = player();
    const g = game();
    if (S.mode === 'idle') return;
    if (reason !== 'victory' && reason !== 'defeated') reason = reason || 'exit';
    S.leaveReason = reason;
    if (!p || !g) { reset(); return; }
    if (S.savedPos) {
      p.x = S.savedPos.x;
      p.y = S.savedPos.y;
      p.angle = S.savedPos.angle;
      p.knockX = 0;
      p.knockY = 0;
      p.speedSmooth = 0;
    }
    if (S.savedCam) {
      g.camera.x = S.savedCam.x;
      g.camera.y = S.savedCam.y;
      g.camera.zoom = S.savedCam.zoom;
    }
    p.invulnUntil = g.sim + 2.2;
    p.chargeUntil = 0;
    p.abilityActiveUntil = 0;
    g.camera.shake = 0;
    S.mode = 'idle';
    S.fade = 0;
    S.savedPos = null;
    S.savedCam = null;
    S.attacks.length = 0;
    S.bolts.length = 0;
    S.rocks.length = 0;
    S.boss = null;
    document.body.classList.remove('monster-world');
    if (S.panel) S.panel.style.display = 'none';
    const flash = document.getElementById('damageFlash');
    if (flash) flash.style.opacity = '0';
    if (reason === 'victory') {
      say('', '', 0);
      toast('The monster world is quiet again. 100 gems richer.', 4200);
    } else if (reason === 'defeated') {
      toast('The deep spits you back into the reef. Your progress is safe.', 4200);
    } else if (reason === 'sealed') {
      toast('The event window closed. The gate returns you to the reef.', 4200);
    } else {
      toast('You slip back out through the gate.', 2800);
    }
    A.Audio.click();
  }

  function reset() {
    S.mode = 'idle';
    S.fade = 0;
    S.savedPos = null;
    S.savedCam = null;
    S.boss = null;
    S.attacks.length = 0;
    S.bolts.length = 0;
    S.rocks.length = 0;
    S.sparks.length = 0;
    S.texts.length = 0;
    S.msg = null;
    S.msgUntil = 0;
    S.leaveIn = 0;
    document.body.classList.remove('monster-world');
    if (S.panel) S.panel.style.display = 'none';
  }

  function active() { return S.mode === 'arena'; }

  // ------------------------------------------------------------------
  // Arena content
  // ------------------------------------------------------------------
  function zoomFor(p) {
    const g = game();
    const base = g ? A.clamp(g.h / 1050, 0.72, 1.05) : 0.8;
    return base * A.clamp(96 / Math.max(70, p.radius), 0.72, 1.08);
  }

  function rngFor(seed) { return A.seedRand(seed); }

  function makeArena() {
    const rng = rngFor(0x9e3779b9 ^ 0x51ed);
    const rocks = [];
    for (let i = 0; i < 46; i++) {
      const x = rng() * AW;
      const depth = 0.55 + rng() * 0.5;
      rocks.push({
        x: x,
        y: FLOOR + 20 + rng() * (AH - FLOOR - 30),
        w: 60 + rng() * 220 * depth,
        h: 30 + rng() * 90 * depth,
        rot: (rng() - 0.5) * 0.5,
        tone: rng()
      });
    }
    const columns = [];
    for (let i = 0; i < 9; i++) {
      columns.push({
        x: 360 + rng() * (AW - 720),
        h: 260 + rng() * 460,
        w: 54 + rng() * 46,
        lean: (rng() - 0.5) * 0.14,
        broken: rng() < 0.45,
        tone: rng()
      });
    }
    const bones = [];
    for (let i = 0; i < 7; i++) {
      bones.push({ x: 300 + rng() * (AW - 600), y: FLOOR + 8 + rng() * 120, r: 40 + rng() * 120, rot: rng() * TAU });
    }
    const orbs = [];
    for (let i = 0; i < 12; i++) {
      orbs.push({ x: rng() * AW, y: FLOOR - 100 - rng() * 2000, r: 3 + rng() * 6, ph: rng() * TAU });
    }
    const eels = [];
    for (let i = 0; i < 7; i++) {
      eels.push({
        x: rng() * AW, y: 900 + rng() * 1800, len: 180 + rng() * 220,
        ph: rng() * TAU, sp: 0.16 + rng() * 0.22, dir: rng() < 0.5 ? -1 : 1,
        speed: 22 + rng() * 36
      });
    }
    return { rocks: rocks, columns: columns, bones: bones, orbs: orbs, eels: eels };
  }

  function makeBoss() {
    return {
      x: BOSS_HOME.x, baseX: BOSS_HOME.x, y: BOSS_HOME.y,
      r: BOSS_R, hitsLeft: HITS, maxHits: HITS,
      flash: 0, pose: 'idle', poseT: 0, enraged: false,
      born: S.t,
      nextBolt: 1.6, nextWave: 4.2, nextRocks: 7.4, nextVortex: 9.6,
      lastChargeUid: -1, lastAbilityUntil: -1, nextMelee: 0, nextContact: 0,
      dead: false, dieT: 0, rewardDone: false
    };
  }

  function resetArena(p) {
    S.arena = makeArena();
    S.boss = makeBoss();
    S.attacks.length = 0;
    S.bolts.length = 0;
    S.rocks.length = 0;
    S.sparks.length = 0;
    S.texts.length = 0;
    S.victoryAt = 0;
    S.cam.zoom = zoomFor(p || player() || { radius: 60 });
  }

  // ------------------------------------------------------------------
  // Combat
  // ------------------------------------------------------------------
  function bossRadiusAt(b) { return b.r * 0.86; }

  function damageBoss(amount, source) {
    const b = S.boss;
    if (!b || b.dead) return;
    b.hitsLeft = Math.max(0, b.hitsLeft - amount);
    b.flash = 0.32;
    shake(0.34);
    A.Audio.tridentHit ? A.Audio.tridentHit(1) : A.Audio.chomp();
    burst(b.x + A.rand(-160, 160), b.y - 80 + A.rand(-120, 120), 12,
      ['#9ff7e6', '#ffe6a3', '#dffcff'], 240, 4);
    text(b.x + A.rand(-80, 80), b.y - 240, 'HIT', '#c8fff2', 34);
    if (b.hitsLeft <= b.maxHits / 2 && !b.enraged) {
      b.enraged = true;
      say('POSEIDON IS ENRAGED', 'The temple itself starts to move.', 3.0);
      A.Audio.terrorRoar();
      shake(0.9);
      for (let i = 0; i < 3; i++) burst(b.x, b.y - 120, 16, ['#ffcf7a', '#ff8f6a', '#8ff7e6'], 300, 5);
    }
    if (b.hitsLeft <= 0) {
      b.dead = true;
      b.dieT = 0;
      S.victoryAt = S.t;
      S.attacks.length = 0;
      S.bolts.length = 0;
      S.rocks.length = 0;
      A.Audio.terrorRoar();
      A.Audio.evolve();
      shake(1.2);
      const p = player();
      if (p && A.Collection) A.Collection.onEvolve(p);
    }
  }

  function award() {
    const b = S.boss;
    if (!b || b.rewardDone) return 0;
    b.rewardDone = true;
    const c = cycle();
    let paid = 0;
    try {
      const claimed = parseInt(localStorage.getItem(GUARD_KEY) || '-1', 10);
      if (claimed !== c.idx) {
        paid = REWARD;
        localStorage.setItem(GUARD_KEY, String(c.idx));
      }
    } catch (e) {
      paid = REWARD;
    }
    if (paid && A.Quests) A.Quests.addCrystals(paid);
    const p = player();
    if (p && paid) text(p.x, p.y - p.radius * 2.2, '+' + paid + ' GEMS', '#ffe9a8', 40);
    say('POSEIDON DEFEATED!', paid ? '+' + REWARD + ' GEMS' : 'Reward already claimed this window', 4.6);
    return paid;
  }

  function spawnBolt(fromX, fromY, angle) {
    S.bolts.push({
      x: fromX, y: fromY,
      vx: Math.cos(angle) * 460, vy: Math.sin(angle) * 460,
      r: 22, life: 3.4, rot: angle
    });
  }

  function scheduleAttack(kind) {
    const b = S.boss;
    const p = player();
    if (!b || !p || b.dead) return;
    const speedUp = b.enraged ? 0.78 : 1;
    if (kind === 'bolt') {
      S.attacks.push({ k: 'bolt', t: 0, windup: 0.5 * speedUp, fired: false, count: b.enraged ? 3 : 1, x: b.x, y: b.y - 220 });
      b.pose = 'bolt'; b.poseT = 0;
      b.nextBolt = (b.enraged ? 2.2 : 3.0) * A.rand(0.9, 1.15);
    } else if (kind === 'wave') {
      S.attacks.push({ k: 'wave', t: 0, windup: 0.95 * speedUp, r: 0, speed: b.enraged ? 760 : 620, hit: false, x: b.x, y: b.y + 40 });
      b.pose = 'wave'; b.poseT = 0;
      b.nextWave = (b.enraged ? 4.6 : 6.2) * A.rand(0.92, 1.1);
    } else if (kind === 'rocks') {
      const spots = [];
      for (let i = 0; i < 4; i++) {
        spots.push({
          x: A.clamp(p.x + A.rand(-420, 420), 260, AW - 260),
          y: A.clamp(p.y + A.rand(-260, 320), 300, FLOOR - 60)
        });
      }
      S.attacks.push({ k: 'rocks', t: 0, windup: 1.15 * speedUp, spots: spots, fired: false });
      b.pose = 'wave'; b.poseT = 0;
      b.nextRocks = (b.enraged ? 6.0 : 8.0) * A.rand(0.9, 1.1);
    } else if (kind === 'vortex') {
      S.attacks.push({ k: 'vortex', t: 0, windup: 0.7 * speedUp, dur: 2.3, hitAt: 0, x: b.x, y: b.y });
      b.pose = 'vortex'; b.poseT = 0;
      b.nextVortex = (b.enraged ? 8.0 : 11.0) * A.rand(0.9, 1.1);
    }
  }

  function updateAttacks(dt) {
    const b = S.boss;
    const p = player();
    if (!b || !p) return;
    if (!b.dead) {
      b.nextBolt -= dt; b.nextWave -= dt; b.nextRocks -= dt; b.nextVortex -= dt;
      if (b.nextBolt <= 0) scheduleAttack('bolt');
      if (b.nextWave <= 0) scheduleAttack('wave');
      if (b.nextRocks <= 0) scheduleAttack('rocks');
      if (b.nextVortex <= 0) scheduleAttack('vortex');
      if (b.poseT > 0) { b.poseT -= dt; if (b.poseT <= 0) b.pose = 'idle'; }
    }

    for (let i = S.attacks.length - 1; i >= 0; i--) {
      const a = S.attacks[i];
      a.t += dt;
      if (a.k === 'bolt') {
        if (!a.fired && a.t >= a.windup) {
          a.fired = true;
          const base = Math.atan2(p.y - a.y, p.x - a.x);
          const spread = a.count > 1 ? 0.22 : 0;
          for (let n = 0; n < a.count; n++) {
            const off = (n - (a.count - 1) / 2) * spread;
            spawnBolt(a.x, a.y, base + off);
          }
          b.poseT = 0.3;
          A.Audio.orcaBreath(0.6);
        }
        if (a.fired) S.attacks.splice(i, 1);
      } else if (a.k === 'wave') {
        if (a.t >= a.windup) {
          a.r += a.speed * dt;
          if (!a.hit) {
            const d = Math.sqrt(A.dist2(p.x, p.y, a.x, a.y));
            const band = Math.abs(d - a.r);
            if (band < 34 + p.radius * 0.6) {
              a.hit = true;
              hitPlayer(14, a.x, a.y, 'wave');
            }
          }
          if (a.r > 2800) { S.attacks.splice(i, 1); continue; }
        }
        if (a.t > 4.2) S.attacks.splice(i, 1);
      } else if (a.k === 'rocks') {
        if (!a.fired && a.t >= a.windup) {
          a.fired = true;
          for (let n = 0; n < a.spots.length; n++) {
            const sp = a.spots[n];
            S.rocks.push({ x: sp.x, y: -140 - A.rand(0, 260), vy: 980, rot: A.rand(0, TAU), spin: A.rand(-1.6, 1.6), rock: true });
          }
          A.Audio.sawBite ? A.Audio.sawBite(0.6) : A.Audio.chomp();
        }
        if (a.fired) S.attacks.splice(i, 1);
      } else if (a.k === 'vortex') {
        if (a.t >= a.windup && a.t < a.windup + a.dur) {
          const dx = b.x - p.x, dy = b.y - p.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          if (d > 180) {
            p.x += (dx / d) * 190 * dt;
            p.y += (dy / d) * 190 * dt;
          }
          a.hitAt -= dt;
          if (d < 460 && a.hitAt <= 0) {
            a.hitAt = 0.45;
            hitPlayer(6, b.x, b.y, 'vortex');
          }
        }
        if (a.t > a.windup + a.dur + 0.15) S.attacks.splice(i, 1);
      }
    }

    // Bolts fly straight, hit once, and break on the arena walls.
    for (let i = S.bolts.length - 1; i >= 0; i--) {
      const q = S.bolts[i];
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.life -= dt;
      if (q.life <= 0 || q.x < -60 || q.x > AW + 60 || q.y < -60 || q.y > FLOOR + 40) {
        S.bolts.splice(i, 1);
        continue;
      }
      if (A.dist2(q.x, q.y, p.x, p.y) < Math.pow(q.r + p.radius * 0.7, 2)) {
        hitPlayer(9, q.x, q.y, 'bolt');
        burst(q.x, q.y, 10, ['#8ff7e6', '#dffcff', '#5fd6c4'], 190, 3);
        S.bolts.splice(i, 1);
      }
    }

    for (let i = S.rocks.length - 1; i >= 0; i--) {
      const r = S.rocks[i];
      r.y += r.vy * dt;
      r.rot += r.spin * dt;
      const floorY = r.y + 34;
      if (floorY >= FLOOR) {
        if (A.dist2(r.x, FLOOR - 30, p.x, p.y) < Math.pow(90 + p.radius, 2)) hitPlayer(10, r.x, FLOOR - 40, 'rock');
        burst(r.x, FLOOR - 10, 14, ['#6f8f8c', '#b7c7b8', '#3f5d5a'], 220, 5);
        shake(0.18);
        S.rocks.splice(i, 1);
        continue;
      }
      if (A.dist2(r.x, r.y, p.x, p.y) < Math.pow(40 + p.radius, 2)) {
        hitPlayer(10, r.x, r.y, 'rock');
        burst(r.x, r.y, 12, ['#6f8f8c', '#d7e2cf'], 200, 5);
        S.rocks.splice(i, 1);
      }
    }
  }

  function playerHitsBoss(p) {
    const b = S.boss;
    const g = game();
    if (!b || b.dead || !g) return;
    const reach = bossRadiusAt(b) + p.radius + 46;
    const dist2 = A.dist2(p.x, p.y, b.x, b.y - 60);
    if (dist2 > reach * reach) return;

    const charging = g.sim < (p.chargeUntil || 0);
    if (charging) {
      if (b.lastChargeUid !== p.chargeUid) {
        b.lastChargeUid = p.chargeUid;
        damageBoss(1, 'charge');
      }
      return;
    }
    const active = g.sim < (p.abilityActiveUntil || 0);
    if (active) {
      if (b.lastAbilityUntil !== p.abilityActiveUntil) {
        b.lastAbilityUntil = p.abilityActiveUntil;
        damageBoss(1, 'ability');
      }
      return;
    }
    if (g.sim >= b.nextMelee) {
      b.nextMelee = g.sim + 1.6;
      damageBoss(1, 'bite');
    }
  }

  // ------------------------------------------------------------------
  // Update
  // ------------------------------------------------------------------
  function update(dt) {
    const g = game();
    const p = player();
    if (!g || !p || S.mode !== 'arena') return;
    S.t += dt;
    if (S.fade > 0) S.fade = Math.max(0, S.fade - dt * 1.8);
    if (S.cam.shake > 0) S.cam.shake = Math.max(0, S.cam.shake - dt * 2.4);
    if (S.guards.flash > 0) {
      S.guards.flash = Math.max(0, S.guards.flash - dt * 3);
      const flash = document.getElementById('damageFlash');
      if (flash) flash.style.opacity = (S.guards.flash * 0.9).toFixed(3);
    }

    const c = cycle();
    if (!c.open && !S.leaveIn) {
      S.leaveIn = 1;
      say('THE MONSTER WORLD SEALS', 'The seven-minute window is over.', 2.6);
      setTimeout(function () { if (S.mode === 'arena') leave('sealed'); }, 1500);
    }

    arenaPlayer(dt, p, g);
    updateAttacks(dt);
    playerHitsBoss(p);
    updateBoss(dt, p, g);
    if (A.Collection) A.Collection.update(dt);
    updateSparks(dt);
    updateCam(dt, p, g);
    updateHUD(dt, p, g);

    // A boss that dies ends the event for everyone in the party. There is no
    // party here, so the local intruder is the whole reward roll.
    const b = S.boss;
    if (b && b.dead) {
      b.dieT += dt;
      if (b.dieT >= 1.1 && !b.rewardDone) award();
      if (b.dieT > 5.0 && !S.leaveIn) {
        S.leaveIn = 1;
        leave('victory');
      }
    }
  }

  function kbd(g) {
    const k = g.keys;
    let x = 0, y = 0;
    if (k.KeyA || k.ArrowLeft) x -= 1;
    if (k.KeyD || k.ArrowRight) x += 1;
    if (k.KeyW || k.ArrowUp) y -= 1;
    if (k.KeyS || k.ArrowDown) y += 1;
    if (!x && !y) return null;
    const l = Math.sqrt(x * x + y * y);
    return { x: x / l, y: y / l };
  }

  function arenaPlayer(dt, p, g) {
    const charging = g.sim < (p.chargeUntil || 0);
    const active = g.sim < (p.abilityActiveUntil || 0);
    const kb = kbd(g);
    const before = p.angle;
    let dist = 0;

    if (kb) {
      p.targetAngle = Math.atan2(kb.y, kb.x);
      p.angle = A.angleDamp(p.angle, p.targetAngle, 10, dt);
    } else if (g.mouse.active) {
      const tx = S.cam.x + (g.mouse.x - g.w / 2) / S.cam.zoom;
      const ty = S.cam.y + (g.mouse.y - g.h / 2) / S.cam.zoom;
      const dx = tx - p.x, dy = ty - p.y;
      dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 16) {
        p.targetAngle = Math.atan2(dy, dx);
        p.angle = A.angleDamp(p.angle, p.targetAngle, 8, dt);
      }
    }

    const mult = charging ? A.TRIDENT_CHARGE.speed : (active && p.ability.speed ? p.ability.speed : 1);
    let desired = 0;
    if (charging) desired = p.speed * mult;
    else if (kb) desired = p.speed * mult;
    else if (g.mouse.active && dist > 16) desired = p.speed * mult * A.clamp((dist - 12) / 130, 0, 1);
    p.speedSmooth = A.damp(p.speedSmooth, desired, charging ? 16 : (kb ? 9.5 : 7), dt);

    p.x += Math.cos(p.angle) * p.speedSmooth * dt + (p.knockX || 0) * dt;
    p.y += Math.sin(p.angle) * p.speedSmooth * dt + (p.knockY || 0) * dt;
    p.knockX = A.damp(p.knockX || 0, 0, 7, dt);
    p.knockY = A.damp(p.knockY || 0, 0, 7, dt);
    p.x = A.clamp(p.x, 220, AW - 220);
    p.y = A.clamp(p.y, 240, FLOOR - 50 - p.radius * 0.4);

    p.swim = A.clamp(p.speedSmooth / Math.max(1, p.speed), 0.22, 1.4);
    p.phase += dt * (3.2 + 6.5 * p.swim);
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    if (p.bite > 0) p.bite = Math.max(0, p.bite - dt * 3.6);
    p.bank = A.damp(p.bank || 0, A.clamp(A.angleDiff(before, p.angle) / Math.max(0.0001, dt) * 0.4, -1, 1), 3, dt);
    if (charging) {
      p.bite = Math.max(p.bite, 0.5);
      if (Math.random() < 0.6) {
        const back = p.angle + Math.PI;
        spark(p.x + Math.cos(back) * p.radius * 1.02, p.y + Math.sin(back) * p.radius * 1.02,
          Math.cos(back) * A.rand(40, 150), Math.sin(back) * A.rand(40, 150) - 18,
          A.rand(2, 5), p.colors.accent, 0.5);
      }
    }
  }

  function updateBoss(dt, p, g) {
    const b = S.boss;
    if (!b) return;
    b.flash = Math.max(0, b.flash - dt);
    if (!b.dead) {
      b.x = b.baseX + Math.sin(S.t * 0.24) * 64;
      // The colossal body is not a wall you want to stand in.
      const reach = bossRadiusAt(b) + p.radius * 0.7;
      if (A.dist2(p.x, p.y, b.x, b.y - 40) < reach * reach && g.sim >= b.nextContact) {
        b.nextContact = g.sim + 1.15;
        hitPlayer(12, b.x, b.y - 40, 'body');
      }
    }
  }
  function updateSparks(dt) {
    for (let i = S.sparks.length - 1; i >= 0; i--) {
      const s = S.sparks[i];
      s.life -= dt;
      if (s.life <= 0) { S.sparks.splice(i, 1); continue; }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 1 - Math.min(0.9, dt * 1.6);
      s.vy = s.vy * (1 - Math.min(0.9, dt * 1.2)) - 14 * dt;
    }
    for (let i = S.texts.length - 1; i >= 0; i--) {
      const t = S.texts[i];
      t.life -= dt;
      t.y -= 34 * dt;
      if (t.life <= 0) S.texts.splice(i, 1);
    }
    const ar = S.arena;
    if (ar) {
      for (let i = 0; i < ar.eels.length; i++) {
        const e = ar.eels[i];
        e.x += e.dir * e.speed * dt;
        if (e.x < -500) e.x = AW + 500;
        if (e.x > AW + 500) e.x = -500;
      }
    }
  }

  function updateCam(dt, p, g) {
    let lx = 0, ly = 0;
    const kb = kbd(g);
    if (kb) { lx = kb.x * 60; ly = kb.y * 44; }
    else if (g.mouse.active) {
      lx = A.clamp(((g.mouse.x - g.w / 2) / S.cam.zoom) * 0.08, -60, 60);
      ly = A.clamp(((g.mouse.y - g.h / 2) / S.cam.zoom) * 0.08, -44, 44);
    }
    S.cam.x = A.damp(S.cam.x, p.x + lx, 5.5, dt);
    S.cam.y = A.damp(S.cam.y, p.y + ly, 5.5, dt);
    S.cam.zoom = A.damp(S.cam.zoom, zoomFor(p), 2.2, dt);
    const halfW = g.w / (2 * S.cam.zoom);
    const halfH = g.h / (2 * S.cam.zoom);
    S.cam.x = A.clamp(S.cam.x, halfW * 0.6, AW - halfW * 0.6);
    S.cam.y = A.clamp(S.cam.y, halfH * 0.6, AH - halfH * 0.6);
  }

  function updateHUD(dt, p, g) {
    S.hudTimer -= dt;
    if (S.hudTimer > 0) return;
    S.hudTimer = 0.1;
    const hText = document.getElementById('healthText');
    const hFill = document.getElementById('healthFill');
    if (hText) hText.textContent = Math.max(0, Math.ceil(p.health));
    if (hFill) hFill.style.width = A.clamp((p.health / p.maxHealth) * 100, 0, 100) + '%';
    const shotCd = document.getElementById('shotCdOverlay');
    if (shotCd) {
      const left = Math.max(0, g.chargeReadyAt - g.sim);
      shotCd.style.height = left > 0 ? Math.round((left / A.TRIDENT_CHARGE.cooldown) * 100) + '%' : '0%';
    }
  }

  // ------------------------------------------------------------------
  // Arena drawing
  // ------------------------------------------------------------------
  function render(ctx) {
    const g = game();
    const p = player();
    if (!g) return;
    const w = g.w, h = g.h, dpr = g.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    const low = g.quality < 0.9;
    const cam = S.cam;
    const shake = cam.shake;
    const sx = shake > 0 ? A.rand(-1, 1) * shake * 16 : 0;
    const sy = shake > 0 ? A.rand(-1, 1) * shake * 12 : 0;

    // Backdrop: deep water, temple gloom, moonlight from the broken roof.
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#0a3341');
    bg.addColorStop(0.45, '#052029');
    bg.addColorStop(1, '#020f15');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    drawShafts(ctx, w, h, cam);
    drawRuinSilhouette(ctx, w, h, cam);

    ctx.save();
    ctx.translate(w / 2 + sx, h / 2 + sy);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    const view = { x: cam.x - w / (2 * cam.zoom), y: cam.y - h / (2 * cam.zoom), w: w / cam.zoom, h: h / cam.zoom };
    drawArenaFloor(ctx, view, low);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.1;
    ctx.drawImage(A.glowSprite('#4fd6c6'), 120, FLOOR - 1200, 1700, 1500);
    ctx.restore();
    drawRuins(ctx, view, low);
    drawExitGate(ctx, view);
    if (S.arena) drawEels(ctx, view, low);
    if (S.boss) drawBoss(ctx, S.boss, low);
    drawAttacks(ctx, low);
    drawRocks(ctx);
    drawPlayerArena(ctx, p, low);
    if (A.Collection) A.Collection.drawWorld(ctx, g.sim);
    drawSparks(ctx);
    drawWorldTexts(ctx);
    ctx.restore();

    drawHud(ctx, w, h);
    if (S.fade > 0) {
      ctx.globalAlpha = S.fade;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }

  function drawShafts(ctx, w, h, cam) {
    const t = S.t;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const x = ((i * 0.23 + 0.06) * w + Math.sin(t * 0.08 + i) * 40 + (cam.x * 0.02)) % (w + 400) - 200;
      const a = 0.035 + 0.02 * Math.sin(t * 0.3 + i * 1.7);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#63d6cf';
      ctx.beginPath();
      ctx.moveTo(x - 70, 0);
      ctx.lineTo(x + 70, 0);
      ctx.lineTo(x + 240, h);
      ctx.lineTo(x + 20, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRuinSilhouette(ctx, w, h, cam) {
    const off = (cam.x * 0.06) % 900;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#021017';
    for (let i = -1; i < 3; i++) {
      const x = i * 900 - off;
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x, h * 0.32);
      ctx.lineTo(x + 90, h * 0.2);
      ctx.lineTo(x + 150, h * 0.42);
      ctx.lineTo(x + 250, h * 0.36);
      ctx.lineTo(x + 330, h * 0.52);
      ctx.lineTo(x + 430, h * 0.44);
      ctx.lineTo(x + 520, h * 0.62);
      ctx.lineTo(x + 640, h * 0.5);
      ctx.lineTo(x + 760, h * 0.7);
      ctx.lineTo(x + 900, h * 0.58);
      ctx.lineTo(x + 900, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawArenaFloor(ctx, view, low) {
    if (view.y + view.h < FLOOR - 80) return;
    const top = FLOOR;
    const g = ctx.createLinearGradient(0, top, 0, AH);
    g.addColorStop(0, '#16383a');
    g.addColorStop(0.4, '#0c2426');
    g.addColorStop(1, '#041012');
    ctx.fillStyle = g;
    ctx.fillRect(-200, top, AW + 400, AH - top + 400);
    ctx.strokeStyle = 'rgba(110,190,175,0.14)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-200, top);
    for (let x = -200; x <= AW + 400; x += 120) {
      ctx.lineTo(x, top + Math.sin(x * 0.0021) * 16 + Math.sin(x * 0.0007) * 22);
    }
    ctx.stroke();

    const ar = S.arena;
    if (!ar) return;
    for (let i = 0; i < ar.rocks.length; i++) {
      const r = ar.rocks[i];
      if (r.x < view.x - 300 || r.x > view.x + view.w + 300) continue;
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.rot);
      ctx.fillStyle = r.tone > 0.6 ? '#11282a' : (r.tone > 0.3 ? '#0c1f21' : '#081719');
      ctx.beginPath();
      ctx.ellipse(0, 0, r.w / 2, r.h / 2, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    if (!low) {
      for (let i = 0; i < ar.bones.length; i++) {
        const b = ar.bones[i];
        if (b.x < view.x - 200 || b.x > view.x + view.w + 200) continue;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.strokeStyle = 'rgba(198,209,178,0.34)';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-b.r, 0);
        ctx.quadraticCurveTo(0, -b.r * 0.4, b.r, 0);
        ctx.stroke();
        ctx.lineWidth = 5;
        for (let k = -2; k <= 2; k++) {
          ctx.beginPath();
          ctx.moveTo(k * b.r * 0.3, 0);
          ctx.lineTo(k * b.r * 0.34, b.r * 0.32);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    for (let i = 0; i < ar.orbs.length; i++) {
      const o = ar.orbs[i];
      if (o.x < view.x - 100 || o.x > view.x + view.w + 100 || o.y < view.y - 100 || o.y > view.y + view.h + 100) continue;
      const a = 0.4 + 0.3 * Math.sin(S.t * 1.3 + o.ph);
      ctx.globalAlpha = a;
      ctx.drawImage(A.glowSprite('#54d9c8'), o.x - o.r * 4, o.y - o.r * 4, o.r * 8, o.r * 8);
      ctx.globalAlpha = 1;
    }
  }

  function drawRuins(ctx, view, low) {
    const ar = S.arena;
    if (!ar) return;
    for (let i = 0; i < ar.columns.length; i++) {
      const c = ar.columns[i];
      if (c.x < view.x - 300 || c.x > view.x + view.w + 300) continue;
      const baseY = FLOOR + 6;
      ctx.save();
      ctx.translate(c.x, baseY);
      ctx.rotate(c.lean);
      const g = ctx.createLinearGradient(-c.w / 2, 0, c.w / 2, 0);
      g.addColorStop(0, '#0a1c1e');
      g.addColorStop(0.5, c.tone > 0.5 ? '#1a3434' : '#142b2c');
      g.addColorStop(1, '#071416');
      ctx.fillStyle = g;
      ctx.fillRect(-c.w / 2, -c.h, c.w, c.h);
      ctx.fillStyle = '#203c3a';
      ctx.fillRect(-c.w / 2 - 12, -c.h - 22, c.w + 24, 22);
      if (c.broken) {
        ctx.fillStyle = '#02090b';
        ctx.beginPath();
        ctx.moveTo(-c.w / 2, -c.h);
        ctx.lineTo(-c.w * 0.1, -c.h - 40);
        ctx.lineTo(c.w * 0.2, -c.h + 30);
        ctx.lineTo(c.w / 2, -c.h - 14);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(121,217,205,0.12)';
      ctx.lineWidth = 2;
      for (let k = 1; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(-c.w / 2 + 6, -c.h * (k / 4));
        ctx.lineTo(c.w / 2 - 6, -c.h * (k / 4));
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawExitGate(ctx, view) {
    if (SPAWN.x < view.x - 300 || SPAWN.x > view.x + view.w + 300) return;
    const x = 400, y = FLOOR;
    const open = cycle().open;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = open ? 0.34 + 0.08 * Math.sin(S.t * 2) : 0.12;
    const gs = 560;
    ctx.drawImage(A.glowSprite(open ? '#56e0d0' : '#7a4b32'), x - gs / 2, y - 330 - gs / 2, gs, gs);
    ctx.restore();
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#081719';
    ctx.beginPath();
    ctx.moveTo(-130, 0);
    ctx.lineTo(-110, -300);
    ctx.quadraticCurveTo(0, -400, 110, -300);
    ctx.lineTo(130, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = open ? 'rgba(137,247,225,0.8)' : 'rgba(160,110,80,0.55)';
    ctx.lineWidth = 6;
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const a = S.t * 0.6 + i * 1.25;
      ctx.globalAlpha = open ? 0.6 : 0.2;
      ctx.beginPath();
      ctx.arc(0, -170, 40 + i * 12, a, a + 1.4);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(210,245,236,0.75)';
    ctx.font = 'bold 22px "Trebuchet MS", Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('[E] LEAVE', 0, 46);
    ctx.restore();
  }

  function drawEels(ctx, view, low) {
    const ar = S.arena;
    for (let i = 0; i < ar.eels.length; i++) {
      const e = ar.eels[i];
      if (e.x < view.x - 500 || e.x > view.x + view.w + 500) continue;
      ctx.save();
      ctx.translate(e.x, e.y + Math.sin(S.t * 0.7 + e.ph) * 40);
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = '#020c10';
      ctx.lineWidth = 16;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let k = 1; k <= 8; k++) {
        const u = k / 8;
        ctx.lineTo(e.dir * e.len * u, Math.sin(S.t * 1.6 + e.ph + u * 4.2) * 22 * u);
      }
      ctx.stroke();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#8ff7e6';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------
  // The boss: a colossal drowned god, not the weapon in the player's jaws.
  // ------------------------------------------------------------------
  function drawBoss(ctx, b, low) {
    const t = S.t;
    const breathe = Math.sin(t * 0.8) * 6;
    const deadT = b.dead ? Math.min(1, b.dieT / 3.2) : 0;
    const flash = A.clamp(b.flash / 0.32, 0, 1);
    const x = b.x;
    const y = b.y;

    ctx.save();
    ctx.translate(x, y + breathe);

    // The dais the god rises from.
    ctx.fillStyle = '#071516';
    ctx.beginPath();
    ctx.ellipse(0, 512, 470, 78, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,196,178,0.18)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 512, 470, 78, 0, 0, TAU);
    ctx.stroke();

    // Aura and pressure.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const auraColor = b.enraged ? '#ffb06a' : '#4fe0d0';
    ctx.globalAlpha = 0.18 + 0.05 * Math.sin(t * 1.7) + deadT * 0.2;
    const as = 1180;
    ctx.drawImage(A.glowSprite(auraColor), -as / 2, -as * 0.62, as, as);
    ctx.restore();

    // Base: a body of temple stone rising off the dais.
    const base = ctx.createLinearGradient(0, -120, 0, 520);
    base.addColorStop(0, '#1d3a38');
    base.addColorStop(0.5, '#122726');
    base.addColorStop(1, '#071314');
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.moveTo(-360, 520);
    ctx.quadraticCurveTo(-300, 120, -180, 40);
    ctx.quadraticCurveTo(-120, -10, -60, -40);
    ctx.lineTo(60, -40);
    ctx.quadraticCurveTo(140, 0, 210, 60);
    ctx.quadraticCurveTo(330, 180, 380, 520);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(96,196,178,0.22)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Barnacle plates on the chest.
    if (!low) {
      for (let i = 0; i < 9; i++) {
        const ang = -1.9 + i * 0.34;
        const bx = Math.cos(ang) * 180;
        const by = 120 + Math.sin(ang) * 120;
        ctx.fillStyle = 'rgba(214,201,166,0.22)';
        ctx.beginPath();
        ctx.arc(bx, by, 10 + (i % 3) * 4, 0, TAU);
        ctx.fill();
      }
    }

    // Arms. One raised behind the weapon, one resting on the dais.
    drawArm(ctx, -1, b.pose, b.poseT, t);
    drawArm(ctx, 1, b.pose, b.poseT, t);

    // Huge stone trident planted behind the god (not the playable weapon art).
    drawGodTrident(ctx, b, t);

    // Torso armour band and glowing runes.
    ctx.strokeStyle = 'rgba(144,232,214,0.28)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-230, 280);
    ctx.quadraticCurveTo(0, 350, 230, 280);
    ctx.stroke();
    for (let i = -2; i <= 2; i++) {
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 2.2 + i);
      ctx.fillStyle = b.enraged ? '#ffc477' : '#7ff0e0';
      ctx.beginPath();
      ctx.arc(i * 70, 312, 5, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Head.
    const headY = -250 + Math.sin(t * 0.9) * 4;
    ctx.save();
    ctx.translate(0, headY);
    // Neck
    ctx.fillStyle = '#16302e';
    ctx.beginPath();
    ctx.moveTo(-100, -10);
    ctx.lineTo(-80, 90);
    ctx.lineTo(80, 90);
    ctx.lineTo(100, -10);
    ctx.closePath();
    ctx.fill();
    // Skull
    const skull = ctx.createLinearGradient(-130, -120, 130, 130);
    skull.addColorStop(0, '#2b504b');
    skull.addColorStop(0.45, '#1a3834');
    skull.addColorStop(1, '#0c1f1e');
    ctx.fillStyle = skull;
    ctx.beginPath();
    ctx.moveTo(-128, -30);
    ctx.quadraticCurveTo(-140, -140, -40, -170);
    ctx.quadraticCurveTo(60, -196, 130, -120);
    ctx.quadraticCurveTo(160, -20, 120, 60);
    ctx.quadraticCurveTo(40, 130, -50, 110);
    ctx.quadraticCurveTo(-130, 80, -128, -30);
    ctx.closePath();
    ctx.fill();
    // Brow
    ctx.fillStyle = '#24463f';
    ctx.beginPath();
    ctx.moveTo(-120, -70);
    ctx.quadraticCurveTo(0, -112, 122, -66);
    ctx.lineTo(112, -34);
    ctx.quadraticCurveTo(0, -70, -112, -36);
    ctx.closePath();
    ctx.fill();
    // Eyes
    const eyePulse = 0.7 + 0.3 * Math.sin(t * (b.enraged ? 5 : 2.6));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 * eyePulse;
    for (let s = -1; s <= 1; s += 2) {
      ctx.drawImage(A.glowSprite(b.enraged ? '#ffb45e' : '#8ff7e6'), s * 56 - 70, -58 - 70, 140, 140);
    }
    ctx.restore();
    ctx.fillStyle = b.enraged ? '#ffd49a' : '#c8fff7';
    for (let s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      ctx.ellipse(s * 56, -52, 26, 13, s * 0.08, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#061311';
    for (let s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      ctx.ellipse(s * 56, -52, 7, 12, 0, 0, TAU);
      ctx.fill();
    }
    // Nose and mouth
    ctx.fillStyle = '#132a27';
    ctx.beginPath();
    ctx.moveTo(-16, -36);
    ctx.lineTo(0, 14);
    ctx.lineTo(20, -30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#030b0b';
    ctx.beginPath();
    ctx.ellipse(0, 58, 52, 14, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(84,140,124,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 58, 52, 14, 0, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(196,214,180,0.6)';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 17 - 5, 48);
      ctx.lineTo(i * 17 + 5, 48);
      ctx.lineTo(i * 17, 58);
      ctx.closePath();
      ctx.fill();
    }

    // Beard of kelp, swaying.
    for (let i = -4; i <= 4; i++) {
      const sway = Math.sin(t * 1.5 + i * 0.6) * 14;
      ctx.strokeStyle = i % 2 ? 'rgba(42,96,78,0.9)' : 'rgba(30,76,62,0.9)';
      ctx.lineWidth = 12 - Math.abs(i);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(i * 18, 66);
      ctx.quadraticCurveTo(i * 22 + sway, 150, i * 16 + sway * 1.4, 210 + Math.abs(i) * 12);
      ctx.stroke();
    }

    // Coral crown with glowing gems.
    const crownColor = b.enraged ? '#8a4632' : '#9c5238';
    const crownY = -150;
    for (let i = -3; i <= 3; i++) {
      const h = 74 - Math.abs(i) * 12;
      ctx.fillStyle = crownColor;
      ctx.beginPath();
      ctx.moveTo(i * 40 - 16, crownY + 10);
      ctx.lineTo(i * 40, crownY - h);
      ctx.lineTo(i * 40 + 16, crownY + 10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,176,120,0.28)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = b.enraged ? '#ffc477' : '#8ff7e6';
      ctx.beginPath();
      ctx.arc(i * 40, crownY - h + 16, 4.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // Damage flash and cracks.
    if (flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = flash * 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -250, 170, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    if (b.hitsLeft < b.maxHits * 0.66) {
      ctx.strokeStyle = 'rgba(255,220,170,0.36)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const a = i * 1.7 + 0.6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 60, -250 + Math.sin(a) * 60);
        ctx.lineTo(Math.cos(a) * 150, -250 + Math.sin(a) * 200);
        ctx.stroke();
      }
    }

    if (deadT > 0) {
      ctx.save();
      ctx.globalAlpha = deadT * 0.9;
      ctx.fillStyle = '#02080a';
      ctx.beginPath();
      ctx.arc(0, -250, 200 * deadT, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = deadT * 0.6;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(A.glowSprite('#8ff7e6'), -500, -760, 1000, 1000);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawArm(ctx, side, pose, poseT, t) {
    const spread = pose === 'vortex' ? 1 : 0;
    const raise = pose === 'bolt' ? 1 : 0;
    const lift = side < 0 ? raise : 0;
    const baseX = side * 210;
    const baseY = 30;
    const elbowX = side * (300 + 40 * spread + 60 * lift);
    const elbowY = -20 - 130 * lift + Math.sin(t * 1.2 + side) * 10;
    const handX = side * (250 + 120 * spread - 30 * lift);
    const handY = 130 - 210 * lift + Math.sin(t * 1.2 + side + 1) * 8;
    ctx.save();
    ctx.strokeStyle = '#18332f';
    ctx.lineWidth = 84;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.quadraticCurveTo(elbowX, elbowY, handX, handY);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(74,150,134,0.35)';
    ctx.lineWidth = 12;
    ctx.stroke();
    // Bracer rings
    ctx.strokeStyle = 'rgba(233,200,106,0.3)';
    ctx.lineWidth = 7;
    for (let i = 1; i <= 2; i++) {
      const u = i / 3;
      const mx = baseX + (handX - baseX) * u;
      const my = baseY + (handY - baseY) * u;
      ctx.beginPath();
      ctx.arc(mx, my, 40 - i * 4, 0, TAU);
      ctx.stroke();
    }
    // Hand
    ctx.fillStyle = '#20403b';
    ctx.beginPath();
    ctx.arc(handX, handY, 46, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(143,247,230,0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(handX, handY, 54, 0.3, 2.6);
    ctx.stroke();
    ctx.restore();
  }

  function drawGodTrident(ctx, b, t) {
    const x = 380, y = -260;
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 0.5) * 6);
    ctx.rotate(0.16);
    const steel = '#5f4b34';
    const edge = '#a8814f';
    // Shaft
    ctx.strokeStyle = steel;
    ctx.lineWidth = 22;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 560);
    ctx.lineTo(0, -260);
    ctx.stroke();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 560);
    ctx.lineTo(0, -260);
    ctx.stroke();
    // Crossguard
    ctx.strokeStyle = steel;
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(-70, -250);
    ctx.lineTo(70, -250);
    ctx.stroke();
    // Tines
    ctx.lineWidth = 15;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 68, -250);
      if (i === 0) ctx.lineTo(0, -470);
      else ctx.quadraticCurveTo(i * 92, -380, i * 58, -440);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(143,247,230,0.2)';
    ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 68, -250);
      ctx.quadraticCurveTo(i * 90, -350, i * 58, -440);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawAttacks(ctx, low) {
    const b = S.boss;
    for (let i = 0; i < S.attacks.length; i++) {
      const a = S.attacks[i];
      const warn = a.windup ? A.clamp(a.t / a.windup, 0, 1) : 0;
      if (a.k === 'wave') {
        if (a.t < a.windup) {
          ctx.save();
          ctx.globalAlpha = 0.25 + warn * 0.4;
          ctx.strokeStyle = '#ffcf9a';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(a.x, a.y, 120 + warn * 90, 0, TAU);
          ctx.stroke();
          ctx.restore();
        } else {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = 'rgba(137,247,225,0.65)';
          ctx.lineWidth = 26;
          ctx.beginPath();
          ctx.arc(a.x, a.y, a.r, 0, TAU);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.55)';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(a.x, a.y, a.r, 0, TAU);
          ctx.stroke();
          ctx.restore();
        }
      } else if (a.k === 'vortex' && a.t >= a.windup) {
        const u = A.clamp((a.t - a.windup) / a.dur, 0, 1);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5 * (1 - u * 0.4);
        for (let k = 0; k < 4; k++) {
          const rr = 160 + k * 80 + u * 120;
          const a0 = S.t * 2.4 + k * 1.4;
          ctx.strokeStyle = k % 2 ? '#8ff7e6' : '#4fc7bb';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(a.x, a.y, rr, a0, a0 + 2.2);
          ctx.stroke();
        }
        ctx.restore();
      } else if (a.k === 'rocks' && !a.fired) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,188,140,0.8)';
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.4 + warn * 0.5;
        for (let k = 0; k < a.spots.length; k++) {
          const sp = a.spots[k];
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 60 + warn * 30, 0, TAU);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(sp.x - 70, sp.y);
          ctx.lineTo(sp.x + 70, sp.y);
          ctx.moveTo(sp.x, sp.y - 70);
          ctx.lineTo(sp.x, sp.y + 70);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    for (let i = 0; i < S.bolts.length; i++) {
      const q = S.bolts[i];
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(q.rot);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55;
      ctx.drawImage(A.glowSprite('#8ff7e6'), -70, -70, 140, 140);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#e8fffb';
      ctx.beginPath();
      ctx.moveTo(30, 0);
      ctx.lineTo(-8, -18);
      ctx.lineTo(-2, -5);
      ctx.lineTo(-30, -5);
      ctx.lineTo(-30, 5);
      ctx.lineTo(-2, 5);
      ctx.lineTo(-8, 18);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawRocks(ctx) {
    for (let i = 0; i < S.rocks.length; i++) {
      const r = S.rocks[i];
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.rot);
      ctx.fillStyle = '#233b38';
      ctx.strokeStyle = 'rgba(126,190,175,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-38, -20);
      ctx.lineTo(-10, -40);
      ctx.lineTo(34, -18);
      ctx.lineTo(40, 24);
      ctx.lineTo(2, 42);
      ctx.lineTo(-36, 20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawPlayerArena(ctx, p, low) {
    if (!p) return;
    // Halo
    const g = A.glowSprite(p.colors.accent);
    const size = p.radius * 5.4;
    ctx.save();
    ctx.globalAlpha = 0.3 + Math.sin(S.t * 2.6) * 0.05;
    ctx.drawImage(g, p.x - size / 2, p.y - size / 2, size, size);
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = p.colors.accent;
    ctx.lineWidth = Math.max(2, p.radius * 0.07);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * 1.55, 0, TAU);
    ctx.stroke();
    ctx.restore();

    if (p.hitFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = p.hitFlash * 0.5;
      ctx.drawImage(A.glowSprite('#ff7d8a'), p.x - p.radius * 2, p.y - p.radius * 2, p.radius * 4, p.radius * 4);
      ctx.restore();
    }
    ctx.save();
    if (A.game && A.game.sim < (p.invulnUntil || 0)) {
      ctx.globalAlpha = 0.68 + 0.32 * Math.abs(Math.sin((A.game.sim || 0) * 14));
    }
    A.FishArt.draw(ctx, p, A.game ? A.game.sim : S.t, low);
    if (p.weapon && A.Weapons) A.Weapons.drawHeld(ctx, p, A.game ? A.game.sim : S.t, low);
    ctx.restore();
  }

  function drawSparks(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < S.sparks.length; i++) {
      const s = S.sparks[i];
      const f = A.clamp(s.life / s.maxLife, 0, 1);
      ctx.globalAlpha = f;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * (0.6 + f * 0.6), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawWorldTexts(ctx) {
    for (let i = 0; i < S.texts.length; i++) {
      const t = S.texts[i];
      const f = A.clamp(t.life / t.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = f;
      ctx.font = 'bold ' + t.size + 'px "Trebuchet MS", Verdana, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }
  }

  function drawBossBar(ctx, w, h) {
    const b = S.boss;
    if (!b) return;
    const bw = Math.min(760, w - 120);
    const x = (w - bw) / 2;
    const y = h - 196;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillStyle = 'rgba(168,233,222,0.9)';
    ctx.fillText(BOSS_NAME, w / 2, y - 22);
    // Trough
    ctx.fillStyle = 'rgba(2,14,16,0.85)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, bw, 20, 10) : ctx.rect(x, y, bw, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(122,226,208,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Fill
    const frac = b.hitsLeft / b.maxHits;
    const fw = Math.max(0, bw - 8) * frac;
    const grad = ctx.createLinearGradient(x, y, x + bw, y);
    grad.addColorStop(0, b.enraged ? '#ffb168' : '#63e2cf');
    grad.addColorStop(0.6, b.enraged ? '#ff8f6a' : '#8ff7e6');
    grad.addColorStop(1, '#ffe6a3');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x + 4, y + 4, fw, 12, 6) : ctx.rect(x + 4, y + 4, fw, 12);
    ctx.fill();
    // Notches
    ctx.strokeStyle = 'rgba(1,10,12,0.75)';
    ctx.lineWidth = 2;
    for (let i = 1; i < b.maxHits; i++) {
      const nx = x + 4 + ((bw - 8) * i) / b.maxHits;
      ctx.beginPath();
      ctx.moveTo(nx, y + 3);
      ctx.lineTo(nx, y + 17);
      ctx.stroke();
    }
    ctx.font = 'bold 11px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillStyle = 'rgba(230,255,250,0.85)';
    ctx.fillText('HITS LEFT ' + b.hitsLeft + ' / ' + b.maxHits, w / 2, y + 38);
    ctx.restore();
  }

  function drawHud(ctx, w, h) {
    const p = player();
    const g = game();
    if (!p || !g) return;
    drawBossBar(ctx, w, h);

    // Event clock, out of the way of the top chip row.
    const c = cycle();
    ctx.save();
    ctx.textAlign = 'right';
    ctx.font = 'bold 12px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillStyle = c.open ? 'rgba(143,247,216,0.9)' : 'rgba(240,165,138,0.92)';
    ctx.fillText('MONSTER WORLD — ' + (c.open ? 'EVENT OPEN ' : 'SEALED ') + fmt(c.left), w - 24, 28);

    // Controls
    ctx.textAlign = 'left';
    ctx.font = '11px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillStyle = 'rgba(180,220,214,0.6)';
    ctx.fillText('SPACE — charge / ability   ·   E near the exit gate — leave', 24, h - 24);
    ctx.restore();

    // Low health veil
    const frac = p.health / p.maxHealth;
    if (frac < 0.4) {
      const v = (1 - frac / 0.4) * (0.16 + 0.14 * Math.sin(S.t * 3));
      const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, Math.max(w, h) * 0.72);
      vg.addColorStop(0, 'rgba(120,0,10,0)');
      vg.addColorStop(1, 'rgba(120,0,10,' + v.toFixed(3) + ')');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
      if (!S.guards.lowWarned) {
        S.guards.lowWarned = true;
        toast('Your blood is in the water. Break off or heal.', 3000);
      }
    }

    // Banner
    if (S.msg && S.t < S.msgUntil) {
      const left = S.msgUntil - S.t;
      const alpha = A.clamp(left / 0.6, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.font = 'bold 46px "Trebuchet MS", Verdana, sans-serif';
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(S.msg.title, w / 2, h * 0.34);
      ctx.fillStyle = '#eafffb';
      ctx.fillText(S.msg.title, w / 2, h * 0.34);
      if (S.msg.sub) {
        ctx.font = 'bold 22px "Trebuchet MS", Verdana, sans-serif';
        ctx.fillStyle = '#9ff7e6';
        ctx.fillText(S.msg.sub, w / 2, h * 0.34 + 38);
      }
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------
  // The gate in the main reef
  // ------------------------------------------------------------------
  function drawEntrance(ctx, view, sim) {
    const world = A.game && A.game.world;
    if (!world) return;
    const base = gateBase(world);
    if (GATE_X < view.x - 2100 || GATE_X > view.x + view.w + 2100) return;
    if (base < view.y - 900 || base > view.y + view.h + 900) return;
    const c = cycle();
    const open = c.open;
    const t = sim || 0;
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
    const mid = { x: GATE_X, y: base - 250 };
    const p = player();
    const dist = p ? Math.sqrt(A.dist2(p.x, p.y, mid.x, mid.y)) : 99999;
    const near = dist < 1500;
    const ok = eligible(p);

    // Stone path
    ctx.save();
    for (let i = 0; i < PATH_SLABS; i++) {
      const u = i / (PATH_SLABS - 1);
      const x = PATH_X0 + (GATE_X - PATH_X0) * u;
      const y = world.floorY ? world.floorY(x) - 8 : base;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(i * 1.7) * 0.03);
      ctx.fillStyle = i % 3 === 0 ? '#2d3b3a' : '#243130';
      ctx.strokeStyle = 'rgba(118,196,184,0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-64, -14, 128, 28, 6) : ctx.rect(-64, -14, 128, 28);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = open ? 0.45 + pulse * 0.3 : 0.12;
      ctx.fillStyle = '#7ff0e0';
      ctx.beginPath();
      ctx.arc(0, 1, 4, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // Gate
    ctx.save();
    ctx.translate(GATE_X, base);
    // Glow behind the arch
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = open ? 0.22 + pulse * 0.12 : 0.05;
    const gs = 760;
    ctx.drawImage(A.glowSprite(open ? '#56e0d0' : '#a06b4a'), -gs / 2, -300 - gs / 2, gs, gs);
    ctx.restore();

    // Broken flanking walls: the gate belongs to a much larger ruin.
    for (let s = -1; s <= 1; s += 2) {
      const wx = s * 372;
      const wh = s < 0 ? 176 : 150;
      const wg = ctx.createLinearGradient(wx, -wh, wx, 0);
      wg.addColorStop(0, '#3a2f27');
      wg.addColorStop(0.55, '#4a3a2e');
      wg.addColorStop(1, '#241b16');
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.moveTo(wx - 196, 40);
      ctx.lineTo(wx - 196, -wh + 24);
      ctx.lineTo(wx - 132, -wh - 8);
      ctx.lineTo(wx - 70, -wh + 20);
      ctx.lineTo(wx - 6, -wh - 12);
      ctx.lineTo(wx + 62, -wh + 16);
      ctx.lineTo(wx + 128, -wh - 4);
      ctx.lineTo(wx + 196, -wh + 30);
      ctx.lineTo(wx + 196, 40);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(28,44,40,0.45)';
      ctx.lineWidth = 3;
      for (let r = 0; r < 3; r++) {
        const yy = -wh + 52 + r * 44;
        if (yy > -8) break;
        ctx.beginPath();
        ctx.moveTo(wx - 196, yy);
        ctx.lineTo(wx + 196, yy);
        ctx.stroke();
      }
      for (let c2 = 0; c2 < 5; c2++) {
        const xx = wx - 176 + c2 * 88 + (s < 0 ? 10 : -14);
        ctx.beginPath();
        ctx.moveTo(xx, -wh + 52);
        ctx.lineTo(xx, 0);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(63,107,98,0.28)';
      for (let m = 0; m < 4; m++) {
        ctx.beginPath();
        ctx.ellipse(wx - 120 + m * 78, -40 - (m % 2) * 46, 26, 12, 0.2, 0, TAU);
        ctx.fill();
      }
    }

    // Pillars
    for (let s = -1; s <= 1; s += 2) {
      const px = s * 168;
      const g = ctx.createLinearGradient(px - 46, 0, px + 46, 0);
      g.addColorStop(0, '#33291f');
      g.addColorStop(0.45, '#5a4536');
      g.addColorStop(0.7, '#6d5544');
      g.addColorStop(1, '#241b16');
      ctx.fillStyle = g;
      ctx.fillRect(px - 46, -310, 92, 350);
      ctx.strokeStyle = 'rgba(40,80,74,0.5)';
      ctx.lineWidth = 4;
      ctx.strokeRect(px - 46, -310, 92, 350);
      // Rust bands and rivets
      for (let b = 0; b < 3; b++) {
        const by = -274 + b * 94;
        ctx.fillStyle = 'rgba(52,32,24,0.5)';
        ctx.fillRect(px - 46, by, 92, 13);
        ctx.fillStyle = 'rgba(168,116,74,0.85)';
        for (let rv = 0; rv < 3; rv++) {
          ctx.beginPath();
          ctx.arc(px - 28 + rv * 28, by + 6, 2.6, 0, TAU);
          ctx.fill();
        }
      }
      // Corrosion
      ctx.fillStyle = 'rgba(63,107,98,0.4)';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.ellipse(px - 22 + (i % 3) * 24, -268 + i * 58, 10, 6, 0.3, 0, TAU);
        ctx.fill();
      }
      // Capital
      ctx.fillStyle = '#453327';
      ctx.fillRect(px - 58, -340, 116, 34);
      ctx.fillStyle = '#6d5544';
      ctx.fillRect(px - 48, -334, 96, 10);
      ctx.fillStyle = 'rgba(30,22,17,0.55)';
      ctx.fillRect(px - 58, -312, 116, 6);
      // Rust bleed
      ctx.fillStyle = 'rgba(150,86,50,0.22)';
      for (let r2 = 0; r2 < 3; r2++) {
        ctx.beginPath();
        ctx.ellipse(px - 24 + r2 * 24, -300 + r2 * 60, 7, 22, 0.08, 0, TAU);
        ctx.fill();
      }
      // Runes
      ctx.globalAlpha = open ? 0.6 + pulse * 0.3 : 0.18;
      ctx.fillStyle = '#8ff7e6';
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(px - 4, -246 + i * 74, 8, 22);
      }
      ctx.globalAlpha = 1;
    }

    // Portal mouth behind the arch
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-92, 40);
    ctx.lineTo(-92, -310);
    ctx.arc(0, -310, 92, Math.PI, TAU);
    ctx.lineTo(92, 40);
    ctx.closePath();
    ctx.fillStyle = open ? 'rgba(9,42,45,0.94)' : 'rgba(19,15,13,0.95)';
    ctx.fill();
    if (open) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.2 + pulse * 0.12;
      const pg = ctx.createLinearGradient(0, -402, 0, 0);
      pg.addColorStop(0, 'rgba(143,247,230,0.85)');
      pg.addColorStop(0.55, 'rgba(80,210,200,0.28)');
      pg.addColorStop(1, 'rgba(20,90,100,0.08)');
      ctx.fillStyle = pg;
      ctx.fill();
      ctx.globalAlpha = 0.4 - pulse * 0.22;
      ctx.strokeStyle = '#b9fff2';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const yy = -30 - ((t * 46 + i * 110) % 250);
        ctx.beginPath();
        ctx.ellipse(0, yy, 74 - i * 9, 11, 0, 0, TAU);
        ctx.stroke();
      }
    } else {
      // Sealed stone plug, cracked by the weight of the gate
      ctx.fillStyle = 'rgba(74,50,38,0.85)';
      ctx.beginPath();
      ctx.ellipse(0, -170, 84, 130, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(24,18,15,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-44, -60);
      ctx.lineTo(-8, -130);
      ctx.lineTo(-26, -196);
      ctx.moveTo(40, -40);
      ctx.lineTo(18, -112);
      ctx.lineTo(52, -174);
      ctx.stroke();
    }
    ctx.restore();

    // Rubble at the threshold
    ctx.fillStyle = '#33291f';
    for (let i = 0; i < 7; i++) {
      const rx = (i < 3 ? -1 : 1) * (240 + (i % 3) * 58 + (i > 3 ? 40 : 0));
      const ry = 20 + (i % 3) * 9;
      const rs = 12 + (i % 3) * 6;
      ctx.beginPath();
      ctx.ellipse(rx, ry, rs * 1.4, rs * 0.7, (i % 5) * 0.4, 0, TAU);
      ctx.fill();
    }

    // Arch
    ctx.strokeStyle = '#453327';
    ctx.lineWidth = 42;
    ctx.beginPath();
    ctx.arc(0, -310, 106, Math.PI, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#6d5544';
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.arc(0, -310, 130, Math.PI * 1.05, TAU - 0.05);
    ctx.stroke();
    // Rust bleeding down the arch stones
    ctx.fillStyle = 'rgba(63,107,98,0.35)';
    for (let i = 0; i < 4; i++) {
      const a = Math.PI + 0.55 + i * 0.68;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 116, -310 + Math.sin(a) * 116, 9, 16, a, 0, TAU);
      ctx.fill();
    }

    // Seal
    ctx.save();
    ctx.translate(0, -262);
    ctx.fillStyle = open ? 'rgba(6,26,28,0.92)' : '#241811';
    ctx.beginPath();
    ctx.arc(0, 0, 42, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = open ? 'rgba(143,247,230,' + (0.5 + pulse * 0.4) + ')' : 'rgba(143,95,63,0.7)';
    ctx.lineWidth = 5;
    ctx.stroke();
    // Trident sigil (the god's mark, not the player's weapon)
    ctx.strokeStyle = open ? '#b9fff2' : '#5d4436';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 25);
    ctx.lineTo(0, -26);
    ctx.moveTo(-17, 13);
    ctx.lineTo(-17, -10);
    ctx.moveTo(17, 13);
    ctx.lineTo(17, -10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-17, -10);
    ctx.lineTo(0, -32);
    ctx.lineTo(17, -10);
    ctx.stroke();
    ctx.restore();

    // Slack chains between the capitals
    ctx.strokeStyle = 'rgba(58,46,38,0.75)';
    ctx.lineWidth = 4;
    ctx.setLineDash([9, 6]);
    for (let s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      ctx.moveTo(s * 122, -334);
      ctx.quadraticCurveTo(s * 62, -356, s * 10, -312);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Inscription banner, only once the player is close enough to read it
    if (near) {
      const plateW = 520;
      const plateY = -152;
      ctx.save();
      ctx.fillStyle = 'rgba(4,18,20,0.88)';
      ctx.strokeStyle = open ? 'rgba(143,247,230,0.6)' : 'rgba(170,116,82,0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-plateW / 2, plateY - 56, plateW, 112, 12) : ctx.rect(-plateW / 2, plateY - 56, plateW, 112);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-plateW / 2 + 7, plateY - 49, plateW - 14, 98, 8) : ctx.rect(-plateW / 2 + 7, plateY - 49, plateW - 14, 98);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.textAlign = 'center';
      let fs = 25;
      ctx.font = 'bold ' + fs + 'px "Trebuchet MS", Verdana, sans-serif';
      while (fs > 15 && ctx.measureText('Bienvenue au monde des monstres').width > plateW - 34) {
        fs -= 1;
        ctx.font = 'bold ' + fs + 'px "Trebuchet MS", Verdana, sans-serif';
      }
      ctx.fillStyle = open ? '#eafffb' : '#d9c1ad';
      ctx.fillText('Bienvenue au monde des monstres', 0, plateY - 20);
      ctx.strokeStyle = open ? 'rgba(143,247,230,0.35)' : 'rgba(170,116,82,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-plateW / 2 + 26, plateY - 4);
      ctx.lineTo(plateW / 2 - 26, plateY - 4);
      ctx.stroke();
      const line = !ok
        ? 'Only sharks, octopuses, sawsharks, orcas and megalodons may pass'
        : (open ? (dist < 340 ? '[E] ENTER  —  ' + fmt(c.left) + ' left in the window' : 'Follow the path to the gate') : 'SEALED  —  reopens in ' + fmt(c.left));
      let sfs = 16;
      ctx.font = 'bold ' + sfs + 'px "Trebuchet MS", Verdana, sans-serif';
      while (sfs > 10 && ctx.measureText(line).width > plateW - 30) {
        sfs -= 1;
        ctx.font = 'bold ' + sfs + 'px "Trebuchet MS", Verdana, sans-serif';
      }
      ctx.fillStyle = !ok ? 'rgba(255,150,130,0.95)' : (open ? '#8ff7d8' : '#e0a98a');
      ctx.fillText(line, 0, plateY + 24);
      if (!ok) {
        ctx.fillStyle = 'rgba(255,150,130,0.8)';
        ctx.font = '14px "Trebuchet MS", Verdana, sans-serif';
        ctx.fillText('The stone turns cold under your fins.', 0, plateY + 46);
      }
      ctx.restore();
    }

    // Beam, visible from afar.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = open ? 0.1 + pulse * 0.05 : 0.035;
    const beam = ctx.createLinearGradient(0, -310, 0, -2100);
    beam.addColorStop(0, 'rgba(143,247,230,0.8)');
    beam.addColorStop(1, 'rgba(143,247,230,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(-40, -310);
    ctx.lineTo(-130, -2100);
    ctx.lineTo(130, -2100);
    ctx.lineTo(40, -310);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  // ------------------------------------------------------------------
  // Input + public API
  // ------------------------------------------------------------------
  function onKey(e) {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const k = (e.key || '').toLowerCase();
    if (k !== 'e') return;
    if (S.mode === 'arena') {
      const g = game();
      const p = player();
      if (!g || !p) return;
      if (A.dist2(p.x, p.y, 400, FLOOR - 150) < 300 * 300) leave('exit');
    } else {
      attemptEnter();
    }
  }

  window.addEventListener('keydown', onKey);

  // The always-on gate clock in the top HUD. It reads the shared server start
  // time, so a player who joins ten minutes into a window sees the same
  // number as everyone already in the water.
  let chipAt = 0;
  function updateGateChip() {
    const el = document.getElementById('gateChip');
    if (!el) return;
    const g = game();
    if (!g || g.state !== 'playing' || S.mode !== 'idle') {
      el.classList.remove('show');
      return;
    }
    el.classList.add('show');
    const nowMs = Date.now();
    if (nowMs - chipAt < 200) return;
    chipAt = nowMs;
    const c = cycle();
    const stateEl = document.getElementById('gateState');
    const timerEl = document.getElementById('gateTimer');
    if (stateEl) stateEl.textContent = c.open ? 'GATE OPEN' : 'GATE OPENS';
    if (timerEl) timerEl.textContent = fmt(c.left);
    el.classList.toggle('open', c.open);
  }

  function tick() {
    updatePanel();
    ensurePanel();
    updateGateChip();
  }

  A.Monsters = {
    active: active,
    update: update,
    render: render,
    tick: tick,
    drawEntrance: drawEntrance,
    enter: function () { if (S.mode === 'idle') enter(); },
    leave: leave,
    reset: reset,
    cycle: cycle,
    eligible: function () { return eligible(player()); },
    state: function () { return S; }
  };
})();
