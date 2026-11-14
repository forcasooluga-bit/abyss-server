(function () {
  'use strict';

  const A = window.ABYSS;
  const W = A.WORLD;
  const TAU = A.TAU;
  const FOOD_TARGET = A.FOOD_TARGET;
  const SURFACE_WORLD_Y = 220;

  const $ = function (id) { return document.getElementById(id); };

  // ------------------------------------------------------------------
  // Spatial hash
  // ------------------------------------------------------------------
  // The expanded 14000x9600 ocean holds ~260 fish and ~1600 food at once.
  // Every proximity query - separation, AI threat/prey scans, player
  // collisions - goes through one of these grids instead of walking the whole
  // list, which is what kept the old O(n^2) pair loop from surviving the
  // resize. Queries return a shared scratch buffer, so a scan allocates
  // nothing; read the result before issuing the next query.
  const GRID_CELL = 700;

  function makeGrid() {
    return {
      cols: Math.max(1, Math.ceil(W.w / GRID_CELL)),
      rows: Math.max(1, Math.ceil(W.h / GRID_CELL)),
      cells: null,
      buf: []
    };
  }

  function gridReset(g) {
    if (!g.cells) {
      g.cells = new Array(g.cols * g.rows);
      for (let i = 0; i < g.cells.length; i++) g.cells[i] = [];
    } else {
      for (let i = 0; i < g.cells.length; i++) g.cells[i].length = 0;
    }
  }

  function gridBuild(g, list) {
    gridReset(g);
    const cells = g.cells;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.dead) continue;
      const cx = A.clamp((e.x / GRID_CELL) | 0, 0, g.cols - 1);
      const cy = A.clamp((e.y / GRID_CELL) | 0, 0, g.rows - 1);
      cells[cy * g.cols + cx].push(e);
    }
  }

  function gridQuery(g, x, y, r) {
    const buf = g.buf;
    buf.length = 0;
    const c0 = A.clamp(((x - r) / GRID_CELL) | 0, 0, g.cols - 1);
    const c1 = A.clamp(((x + r) / GRID_CELL) | 0, 0, g.cols - 1);
    const r0 = A.clamp(((y - r) / GRID_CELL) | 0, 0, g.rows - 1);
    const r1 = A.clamp(((y + r) / GRID_CELL) | 0, 0, g.rows - 1);
    for (let cy = r0; cy <= r1; cy++) {
      const row = cy * g.cols;
      for (let cx = c0; cx <= c1; cx++) {
        const cell = g.cells[row + cx];
        for (let i = 0; i < cell.length; i++) buf.push(cell[i]);
      }
    }
    return buf;
  }

  const fishGrid = makeGrid();
  const foodGrid = makeGrid();

  const dom = {
    canvas: $('game'),
    menu: $('menu'),
    playBtn: $('playBtn'),
    soundBtn: $('soundBtn'),
    evolutionPreview: $('evolutionPreview'),
    bestValue: $('bestValue'),
    nameInput: $('playerNameInput'),
    pauseNameInput: $('pauseNameInput'),
    pauseMenu: $('pauseMenu'),
    resumeBtn: $('resumeBtn'),
    restartBtn: $('restartBtn'),
    pauseSoundBtn: $('pauseSoundBtn'),
    menuBtn: $('menuBtn'),
    deathMenu: $('deathMenu'),
    deathSub: $('deathSub'),
    deathStage: $('deathStage'),
    deathScore: $('deathScore'),
    deathEaten: $('deathEaten'),
    deathTime: $('deathTime'),
    deathBest: $('deathBest'),
    deathPenalty: $('deathPenalty'),
    againBtn: $('againBtn'),
    deathMenuBtn: $('deathMenuBtn'),
    hud: $('hud'),
    statusPanel: $('statusPanel'),
    rightHud: $('rightHud'),
    abilityDock: $('abilityDock'),
    portrait: $('portrait'),
    stageTag: $('stageTag'),
    fishRole: $('fishRole'),
    fishName: $('fishName'),
    healthText: $('healthText'),
    healthFill: $('healthFill'),
    hungerText: $('hungerText'),
    hungerFill: $('hungerFill'),
    xpText: $('xpText'),
    xpFill: $('xpFill'),
    pips: $('pips'),
    scoreText: $('scoreText'),
    timeText: $('timeText'),
    eatenText: $('eatenText'),
    leaderboard: $('leaderboard'),
    minimap: $('minimap'),
    abilityBtn: $('abilityBtn'),
    abilityIcon: $('abilityIcon'),
    abilityName: $('abilityName'),
    cdOverlay: $('cdOverlay'),
    cdText: $('cdText'),
    shotDock: $('shotDock'),
    shotBtn: $('shotBtn'),
    shotIcon: $('shotIcon'),
    shotCdOverlay: $('shotCdOverlay'),
    shotCdText: $('shotCdText'),
    starvationWarn: $('starvationWarn'),
    zoneChip: $('zoneChip'),
    zoneName: $('zoneName'),
    poiCount: $('poiCount'),
    eventBanner: $('eventBanner'),
    eventBannerTitle: $('eventBannerTitle'),
    eventBannerSub: $('eventBannerSub'),
    toast: $('toast'),
    damageFlash: $('damageFlash'),
    dangerVignette: $('dangerVignette'),
    cursor: $('cursor')
  };

  const ctx = dom.canvas.getContext('2d', { alpha: false });

  const G = {
    state: 'menu',
    frozen: false,
    sim: 0,
    runTime: 0,
    w: 0,
    h: 0,
    dpr: 1,
    quality: 1,
    perfAccum: 0,
    perfFrames: 0,
    world: null,
    player: null,
    playerName: '',
    fishes: [],
    remotePlayers: [],
    foods: [],
    particles: [],
    popups: [],
    motes: [],
    camera: { x: W.w / 2, y: W.h / 2, zoom: 0.85, shake: 0 },
    deathCam: { x: W.w / 2, y: W.h / 2 },
    mouse: { x: 0, y: 0, active: false },
    keys: Object.create(null),
    hudTimer: 0,
    boardTimer: 0,
    mapTimer: 0,
    portraitTimer: 0,
    popTimer: 0,
    foodTimer: 0,
    flash: 0,
    danger: -1,
    ink: [],
    inkUid: 0,
    shots: [],
    shotUid: 0,
    shotReadyAt: 0,
    shuriken: [],
    shurikenUid: 0,
    shurikenReadyAt: 0,
    chargeReadyAt: 0,
    evolveFlash: 0,
    eaten: 0,
    deathTimer: 0,
    bannerTimer: 0,
    toastTimer: 0,
    lastAbilityId: '',
    pipEls: [],
    activeR2: 2500 * 2500,   // squared radius around the camera that gets full AI
    zoneId: '',
    zoneBannerAt: 0,
    poiFound: 0,
    poiTotal: 0,
    orcaHunter: null,        // at most one orca may hunt the player at a time
    fishHunter: null,        // ...and at most one ordinary fish
    fishChaseReadyAt: 0,     // breathing room between ordinary fish chases
    orcaWarnAt: -99,
    orcaReadyAt: 0,
    panelRects: null,
    rectTimer: 0
  };

  // ------------------------------------------------------------------
  // Setup
  // ------------------------------------------------------------------
  function init() {
    resize();
    G.world = new A.OceanWorld((Math.random() * 1e9) | 0);
    buildPips();
    buildPreviews();
    bindEvents();
    updateSoundLabels();
    updateBestUI();
    G.playerName = loadPlayerName();
    syncNameInput();
    dom.abilityIcon.innerHTML = A.ABILITY_ICONS.boost;
    dom.abilityName.textContent = A.ABILITIES.boost.name;
    resetMenuScene();
    setState('menu');
    requestAnimationFrame(loop);
    G.ui = {
      toast: showToast,
      banner: showBanner,
      sound: toggleSound,
      soundLabel: updateSoundLabels,
      pause: togglePause,
      best: updateBestUI
    };
    A.game = G;
    if (A.AccountUI) A.AccountUI.onRender = applyAccountName;
    if (A.Account && A.Account.restore) A.Account.restore().then(applyAccountName);
  }

  function resetMenuScene() {
    G.player = null;
    G.fishes.length = 0;
    G.foods.length = 0;
    G.ink.length = 0;
    G.inkUid = 0;
    G.shots.length = 0;
    G.shotUid = 0;
    G.shotReadyAt = 0;
    G.shuriken.length = 0;
    G.shurikenUid = 0;
    G.shurikenReadyAt = 0;
    G.chargeReadyAt = 0;
    G.particles.length = 0;
    G.popups.length = 0;
    if (A.Collection) A.Collection.reset();
    spawnInitialPopulation(true);
    seedInitialFood();
    G.camera.x = W.w * 0.5;
    G.camera.y = W.h * 0.5;
    G.camera.zoom = A.clamp(G.h / 1150, 0.68, 0.92);
    G.camera.shake = 0;
  }

  function applyResolution() {
    // Native pixels on a 4K panel: the art is vector, so extra backing store
    // buys real crispness. The adaptive quality pass sheds it again if the
    // frame budget cannot hold it.
    G.dpr = Math.max(0.6, Math.min(window.devicePixelRatio || 1, 2) * G.quality);
    dom.canvas.width = Math.floor(G.w * G.dpr);
    dom.canvas.height = Math.floor(G.h * G.dpr);
    dom.canvas.style.width = G.w + 'px';
    dom.canvas.style.height = G.h + 'px';
  }

  function resize() {
    G.w = window.innerWidth;
    G.h = window.innerHeight;
    applyResolution();
    G.perfAccum = 0;
    G.perfFrames = 0;
    G.rectTimer = 0;
    initMotes();
    clampCamera();
  }

  function initMotes() {
    G.motes = [];
    const count = 34;
    for (let i = 0; i < count; i++) {
      G.motes.push({
        x: A.rand(0, G.w || 800),
        y: A.rand(0, G.h || 600),
        r: A.rand(0.7, 2.1),
        vx: A.rand(-4, 4),
        vy: A.rand(-7, -1.5),
        a: A.rand(0.07, 0.22)
      });
    }
  }

  function buildPips() {
    dom.pips.innerHTML = '';
    G.pipEls = [];
    for (let i = 0; i < A.STAGES.length; i++) {
      const pip = document.createElement('span');
      pip.className = 'pip';
      pip.title = 'Stage ' + (i + 1) + ' - ' + A.STAGES[i].name;
      dom.pips.appendChild(pip);
      G.pipEls.push(pip);
    }
  }

  function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
  }

  function buildPreviews() {
    dom.evolutionPreview.innerHTML = '';
    // The cards are ~132 CSS px wide; back them with at least 2x pixels so a
    // 4K panel gets a native-resolution creature instead of an upscaled one.
    const dpr = Math.max(2, Math.min(3, window.devicePixelRatio || 1));
    A.STAGES.forEach(function (stage, i) {
      const card = document.createElement('div');
      card.className = 'evo-card';
      card.style.setProperty('--glow', hexToRgba(stage.palette.body, 0.22));

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(150 * dpr);
      canvas.height = Math.round(99 * dpr);
      A.FishArt.drawPreview(canvas, i);

      const step = document.createElement('div');
      step.className = 'evo-step';
      step.textContent = 'STAGE ' + (i + 1);

      const name = document.createElement('div');
      name.className = 'evo-name';
      name.textContent = stage.name;

      const ability = document.createElement('div');
      ability.className = 'evo-ability';
      ability.textContent = 'Ability: ' + stage.ability.name;

      card.appendChild(canvas);
      card.appendChild(step);
      card.appendChild(name);
      card.appendChild(ability);
      dom.evolutionPreview.appendChild(card);
    });
  }

  // ------------------------------------------------------------------
  // State & overlays
  // ------------------------------------------------------------------
  function setState(state) {
    G.state = state;
    document.body.classList.toggle('playing', state === 'playing');
    document.body.classList.toggle('paused', state === 'paused');
    document.body.classList.toggle('dead', state === 'dead');
    if (state !== 'playing') document.body.classList.remove('ability-live');
    dom.menu.classList.toggle('hidden', state !== 'menu');
    dom.pauseMenu.classList.toggle('hidden', state !== 'paused');
    if (state !== 'dead') dom.deathMenu.classList.add('hidden');
    if (state !== 'playing') hideBanner();
    if (state !== 'playing') clearKeys();
    if (state === 'menu' || state === 'paused') syncNameInput();
  }

  function clearOverlayTimers() {
    if (G.deathTimer) { clearTimeout(G.deathTimer); G.deathTimer = 0; }
    if (G.bannerTimer) { clearTimeout(G.bannerTimer); G.bannerTimer = 0; }
    if (G.toastTimer) { clearTimeout(G.toastTimer); G.toastTimer = 0; }
    hideBanner();
    hideToast();
  }

  function showBanner(title, sub, ms) {
    dom.eventBannerTitle.textContent = title;
    dom.eventBannerSub.textContent = sub || '';
    dom.eventBanner.classList.add('show');
    if (G.bannerTimer) clearTimeout(G.bannerTimer);
    G.bannerTimer = setTimeout(function () {
      dom.eventBanner.classList.remove('show');
      G.bannerTimer = 0;
    }, ms || 2400);
  }

  function hideBanner() {
    dom.eventBanner.classList.remove('show');
    if (G.bannerTimer) { clearTimeout(G.bannerTimer); G.bannerTimer = 0; }
  }

  function showToast(text, ms) {
    dom.toast.textContent = text;
    dom.toast.classList.add('show');
    if (G.toastTimer) clearTimeout(G.toastTimer);
    G.toastTimer = setTimeout(function () {
      dom.toast.classList.remove('show');
      G.toastTimer = 0;
    }, ms || 3200);
  }

  function hideToast() {
    dom.toast.classList.remove('show');
    if (G.toastTimer) { clearTimeout(G.toastTimer); G.toastTimer = 0; }
  }

  // ------------------------------------------------------------------
  // Run lifecycle
  // ------------------------------------------------------------------
  function createPlayer() {
    const stage = A.STAGES[0];
    const x = A.clamp(W.w / 2 + A.rand(-900, 900), W.margin + 60, W.w - W.margin - 60);
    const y = A.clamp(W.h * 0.085 + A.rand(-240, 240), W.margin + 60, W.h - W.margin - 60);
    G.player = {
      isPlayer: true,
      name: 'You',
      stageIndex: 0,
      art: stage.art,
      colors: stage.palette,
      x: x,
      y: y,
      angle: A.rand(0, TAU),
      targetAngle: 0,
      bank: 0,
      speed: stage.speed,
      radius: stage.radius,
      baseRadius: stage.radius,
      speedSmooth: 0,
      airborne: false,
      airVx: 0,
      airVy: 0,
      swim: 0.3,
      phase: A.rand(0, TAU),
      xp: 0,
      health: 100,
      maxHealth: 100,
      hunger: 100,
      maxHunger: 100,
      ability: stage.ability,
      abilityReadyAt: 0,
      abilityActiveUntil: 0,
      invulnUntil: G.sim + 2,
      evolveReadyAt: 0,
      lastDamage: -99,
      hitFlash: 0,
      knockX: 0,
      knockY: 0,
      fxTimer: 0,
      bite: 0,
      lure: 0,
      chargeUntil: 0,
      chargeUid: 0,
      chargeFxTimer: 0,
      noShadow: false
    };
  }

  function startRun() {
    if (dom.nameInput) dom.nameInput.blur();
    if (dom.pauseNameInput) dom.pauseNameInput.blur();
    if (A.Monsters) A.Monsters.reset();
    A.Audio.init();
    A.Audio.click();
    clearOverlayTimers();
    G.fishes.length = 0;
    G.foods.length = 0;
    G.ink.length = 0;
    G.inkUid = 0;
    G.shots.length = 0;
    G.shotUid = 0;
    G.shotReadyAt = 0;
    G.shuriken.length = 0;
    G.shurikenUid = 0;
    G.shurikenReadyAt = 0;
    G.chargeReadyAt = 0;
    G.particles.length = 0;
    G.popups.length = 0;
    if (A.Collection) A.Collection.reset();
    G.runTime = 0;
    G.eaten = 0;
    if (A.Quests) A.Quests.diveStart();
    G.flash = 0;
    G.evolveFlash = 0;
    G.camera.shake = 0;
    G.hudTimer = 0;
    G.boardTimer = 0;
    G.mapTimer = 0;
    G.portraitTimer = 0;
    G.popTimer = 0;
    G.foodTimer = 0;
    G.lastAbilityId = '';
    dom.damageFlash.style.opacity = '0';
    G.world.initBubbles();
    G.orcaHunter = null;
    G.fishHunter = null;
    G.fishChaseReadyAt = 0;
    G.orcaWarnAt = -99;
    G.orcaReadyAt = 0;
    G.zoneId = '';
    G.poiFound = 0;
    const markers = G.world.mapMarkers;
    G.poiTotal = markers.length;
    for (let i = 0; i < markers.length; i++) markers[i].seen = false;

    createPlayer();
    spawnInitialPopulation(false);
    const p = G.player;
    for (let i = 0; i < 7; i++) {
      spawnAI(0, { scale: A.rand(0.58, 0.8), near: p });
    }
    seedInitialFood();

    G.zoneId = A.zoneAt(p.y).id;
    dom.zoneName.textContent = A.zoneAt(p.y).name;
    dom.poiCount.textContent = '0 / ' + G.poiTotal + ' SITES';
    dom.zoneChip.classList.add('show');

    G.camera.x = p.x;
    G.camera.y = p.y;
    G.camera.zoom = computeTargetZoom();
    G.camera.shake = 0;

    setState('playing');
    updateHUD(true);
    updateAbilityUI(true);
    drawPortrait();
    drawLeaderboard();
    drawMinimap();
    showToast('Move with your mouse or WASD - eat glowing plankton to grow', 5200);
  }

  function goMenu() {
    clearOverlayTimers();
    if (G.player) {
      if (G.player.xp > 0) saveBest(G.player);
      G.player.dead = true;
      G.player = null;
    }
    dom.damageFlash.style.opacity = '0';
    setState('menu');
    updateBestUI();
  }

  function togglePause() {
    if (G.state === 'playing') {
      setState('paused');
      A.Audio.click();
    } else if (G.state === 'paused') {
      setState('playing');
      A.Audio.click();
    }
  }

  function toggleSound() {
    A.Audio.init();
    A.Audio.toggleMute();
    updateSoundLabels();
    if (!A.Audio.muted) A.Audio.click();
  }

  function updateSoundLabels() {
    const label = A.Audio.muted ? 'SOUND: OFF' : 'SOUND: ON';
    dom.soundBtn.textContent = label;
    dom.pauseSoundBtn.textContent = label;
  }

  // ------------------------------------------------------------------
  // Best run
  // ------------------------------------------------------------------
  function getBest() {
    try {
      const raw = localStorage.getItem('abyss.best');
      if (!raw) return null;
      const b = JSON.parse(raw);
      if (!b || typeof b.xp !== 'number') return null;
      return b;
    } catch (e) {
      return null;
    }
  }

  function saveBest(p) {
    const best = getBest();
    if (!best || p.xp > best.xp) {
      try {
        localStorage.setItem('abyss.best', JSON.stringify({
          xp: Math.floor(p.xp),
          stageIndex: p.stageIndex,
          stageKey: A.STAGES[p.stageIndex].key,
          time: Math.floor(G.runTime)
        }));
      } catch (e) { /* storage unavailable */ }
    }
    const mirrored = mirrorRun(p);
    closeDive(p);
    return mirrored;
  }

  // The mission board needs every dive, signed in or not, so this is separate
  // from the account mirror. `saveBest` can be reached twice for one run
  // (death, then back to menu), hence its own once-only flag.
  function closeDive(p) {
    if (!A.Quests || p.diveRecorded) return;
    p.diveRecorded = true;
    A.Quests.diveEnd({
      xp: Math.floor(p.xp),
      fish: G.eaten | 0,
      time: Math.floor(G.runTime)
    });
  }

  // Progress is mirrored onto the account as well, but only while signed in and
  // only once per run - `abyss.best` stays the source of truth for guests.
  function mirrorRun(p) {
    if (!A.Account || !A.Account.recordRun || p.runMirrored) return null;
    if (!A.Account.currentUser()) return null;
    p.runMirrored = true;
    return A.Account.recordRun({
      xp: Math.floor(p.xp),
      stageKey: A.STAGES[p.stageIndex] ? A.STAGES[p.stageIndex].key : '',
      eaten: G.eaten | 0,
      time: Math.floor(G.runTime),
      died: !!p.died,
      penalized: !!p.penalized
    });
  }

  function updateBestUI() {
    const b = getBest();
    if (!b) {
      dom.bestValue.textContent = 'No runs yet - the reef awaits.';
      return;
    }
    // Best runs are keyed by species, because the ladder grows and a stored
    // index would quietly start pointing at the wrong animal.
    let idx = A.clamp(b.stageIndex || 0, 0, A.STAGES.length - 1);
    if (b.stageKey) idx = A.stageByKey(b.stageKey);
    else if (idx === 6) idx = A.stageByKey('orca');
    const stage = A.STAGES[idx];
    dom.bestValue.textContent = stage.name + ' - ' + A.formatNumber(b.xp) + ' XP - ' + A.formatTime(b.time || 0);
  }

  // ------------------------------------------------------------------
  // Player name — a local, always-editable tag that rides above the fish
  // ------------------------------------------------------------------
  const NAME_MAX = 16;

  function cleanName(raw) {
    return String(raw == null ? '' : raw)
      .replace(/[<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, NAME_MAX);
  }

  function loadPlayerName() {
    // A signed-in account owns the name that rides above the fish. A guest is
    // always "Guest": names are an account feature, so there is nothing on the
    // device to read and nothing to rename.
    const onAccount = A.Account && A.Account.displayName ? A.Account.displayName() : '';
    if (onAccount) return cleanName(onAccount);
    return 'Guest';
  }

  function setPlayerName(raw) {
    const clean = cleanName(raw);
    if (A.Account && A.Account.currentUser && A.Account.currentUser()) {
      if (A.Account.setDisplayName) A.Account.setDisplayName(clean);
      G.playerName = clean || A.Account.displayName();
      return G.playerName;
    }
    G.playerName = 'Guest';
    return G.playerName;
  }

  // Called back after any account change: re-derive the name and repaint the
  // fields. It reads rather than writes, so it cannot loop through the account.
  function applyAccountName() {
    G.playerName = loadPlayerName();
    syncNameInput();
  }

  function syncNameInput() {
    const fields = [dom.nameInput, dom.pauseNameInput];
    const guest = !(A.Account && A.Account.currentUser && A.Account.currentUser());
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      if (!f) continue;
      // Guests have no account to store a name on, so the field is a label.
      f.disabled = guest;
      if (f !== document.activeElement && f.value !== G.playerName) f.value = G.playerName;
    }
  }

  // ------------------------------------------------------------------
  // Spawning
  // ------------------------------------------------------------------
  // Each tier keeps to a depth band, so the expanded map fills with the right
  // creatures in the right places instead of a uniform scatter. Bands are
  // fractions of world height and therefore survive another resize.
  const TIER_BANDS = [
    [0.06, 0.52],
    [0.2, 0.7],
    [0.32, 0.86],
    [0.46, 0.96],
    [0.55, 0.99],
    [0.4, 0.99],
    [0.28, 0.88],
    // The octopus dens on the bottom shelf, below the manta's glide path and
    // just above the sawshark's patrol.
    [0.62, 0.99],
    [0.5, 0.98]
  ];
  const FOOD_BANDS = [
    [0.05, 0.62],
    [0.24, 0.86],
    [0.55, 0.99],
    [0.55, 0.95]
  ];

  function bandY(band) {
    return Math.min(W.h * A.rand(band[0], band[1]), floorTop(W.w * 0.5) - 70);
  }

  // The sandy floor is a real surface now, so swimmers, hunters and food stop
  // at the sand instead of drifting down through it.
  function floorTop(x) {
    const fy = G.world && G.world.floorY ? G.world.floorY(x) : W.h - W.margin;
    return Math.min(fy, W.h - W.margin);
  }

  function ceilingAt(x, r) {
    return floorTop(x) - (r || 0) * 0.55;
  }

  function findSpawnSpot(minDist, point) {
    const m = 230;
    for (let i = 0; i < 40; i++) {
      const x = A.rand(m, W.w - m);
      const y = A.rand(m, Math.min(W.h - m, floorTop(x) - 90));
      if (point && minDist && A.dist2(x, y, point.x, point.y) < minDist * minDist) continue;
      return { x: x, y: y };
    }
    const fx = A.rand(m, W.w - m);
    return { x: fx, y: A.rand(m, Math.min(W.h - m, floorTop(fx) - 90)) };
  }

  function buildSharkTerritories() {
    const list = [];
    const cols = Math.max(3, Math.round(W.w / 2400));
    const rows = Math.max(2, Math.round(W.h / 2600));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        list.push({
          x: (i + 0.5) * (W.w / cols),
          y: W.h * (0.42 + 0.55 * ((j + 0.5) / rows)),
          jx: (W.w / cols) * 0.26,
          jy: (W.h * 0.55 / rows) * 0.3
        });
      }
    }
    return list;
  }

  function uniqueName() {
    const suffixes = ['II', 'III', 'IV', 'V', 'VI'];
    for (let attempt = 0; attempt < 10; attempt++) {
      const base = A.pick(A.FISH_NAMES);
      const name = attempt === 0 ? base : base + ' ' + suffixes[Math.min(attempt - 1, suffixes.length - 1)];
      let taken = false;
      for (let i = 0; i < G.fishes.length; i++) {
        if (G.fishes[i].name === name) { taken = true; break; }
      }
      if (!taken) return name;
    }
    return A.pick(A.FISH_NAMES) + ' ' + A.randInt(2, 9);
  }

  function spawnAI(tierIndex, opts) {
    opts = opts || {};
    const stage = A.STAGES[tierIndex];
    const scale = opts.scale != null ? opts.scale : A.rand(0.72, 1.32);
    const radius = stage.radius * scale;

    let pos;
    if (opts.near) {
      const ang = A.rand(0, TAU);
      const dist = A.rand(250, 640);
      pos = {
        x: A.clamp(opts.near.x + Math.cos(ang) * dist, 230, W.w - 230),
        y: A.clamp(opts.near.y + Math.sin(ang) * dist, 230, W.h - 230)
      };
    } else if (tierIndex === A.SHARK_TIER || tierIndex === A.SAW_TIER) {
      // Apex sharks hold distinct territories spread across the whole map
      const terr = G.territories || (G.territories = buildSharkTerritories());
      const z = terr[(G.sharkZoneCursor = ((G.sharkZoneCursor || 0) + 1)) % terr.length];
      pos = { x: z.x + A.rand(-z.jx, z.jx), y: z.y + A.rand(-z.jy, z.jy) };
    } else {
      const p = G.player;
      let minD = 0;
      if (p) {
        minD = tierIndex === 0 ? 620 : tierIndex === 1 ? 760 : tierIndex === 2 ? 950 : 1180;
      }
      pos = findSpawnSpot(minD, p);
      pos.y = bandY(TIER_BANDS[tierIndex]);
    }

    const ai = {
      isPlayer: false,
      name: uniqueName(),
      tier: tierIndex + 1,
      stageIndex: tierIndex,
      x: pos.x,
      y: pos.y,
      angle: A.rand(0, TAU),
      targetAngle: A.rand(0, TAU),
      radius: radius,
      baseRadius: radius,
      cruise: stage.aiSpeed * A.rand(0.88, 1.12),
      speedSmooth: stage.aiSpeed * 0.4,
      speedMul: 0.5,
      turnRate: A.rand(3.4, 5.4),
      attackAt: 0,
      think: A.rand(0, 0.35),
      mode: 'wander',
      targetX: pos.x,
      targetY: pos.y,
      wanderUntil: G.sim + A.rand(1, 4),
      threat: null,
      prey: null,
      foodRef: null,
      hunger: A.rand(55, 100),
      xp: Math.max(10, 50 + tierIndex * 65 + A.randInt(-25, 25)),
      phase: A.rand(0, TAU),
      swim: 0.4,
      colors: A.makeAIPalette(stage.palette, A.rand(-27, 27)),
      art: stage.art,
      aggression: stage.aggression * A.rand(0.8, 1.2),
      seed: A.rand(0, TAU),
      // Ink is the only thing that spends this, and it spends it in
      // percentages, so the pool is the same size for every animal.
      health: A.BASE_HEALTH,
      maxHealth: A.BASE_HEALTH,
      bite: 0,
      dead: false
    };
    G.fishes.push(ai);
    return ai;
  }

  function spawnOrca() {
    const cfg = A.ORCA;
    const B = A.ORCA_BEHAVIOR;
    const scale = A.rand(0.92, 1.14);
    const radius = cfg.radius * scale;
    const p = G.player;

    // Arrive from far away: an orca should be an event you hear about before
    // you see it, not something that materialises next to you.
    let pos = { x: A.rand(600, W.w - 600), y: bandY([0.42, 0.96]) };
    for (let i = 0; i < 24; i++) {
      pos = { x: A.rand(600, W.w - 600), y: bandY([0.42, 0.96]) };
      if (!p || A.dist2(pos.x, pos.y, p.x, p.y) > 2400 * 2400) break;
    }

    const o = {
      isPlayer: false,
      predator: true,
      name: cfg.name,
      tier: 99,
      stageIndex: -1,
      x: pos.x,
      y: pos.y,
      angle: A.rand(0, TAU),
      targetAngle: 0,
      radius: radius,
      baseRadius: radius,
      cruise: cfg.aiSpeed * A.rand(0.92, 1.08),
      speedSmooth: cfg.aiSpeed * 0.4,
      speedMul: B.patrolSpeed,
      turnRate: B.turnRate,
      attackAt: 0,
      think: A.rand(0, 0.4),
      mode: 'patrol',
      targetX: pos.x,
      targetY: pos.y,
      wanderUntil: 0,
      threat: null,
      prey: null,
      foodRef: null,
      hunger: 100,
      xp: 0,
      phase: A.rand(0, TAU),
      swim: 0.4,
      colors: cfg.palette,
      art: cfg.art,
      aggression: cfg.aggression,
      seed: A.rand(0, TAU),
      bank: 0,
      bite: 0,
      chaseUntil: 0,
      feedUntil: 0,
      restUntil: 0,
      retreatUntil: 0,
      ignorePlayerUntil: 0,
      burstUntil: 0,
      lastCall: G.sim,
      health: A.BASE_HEALTH,
      maxHealth: A.BASE_HEALTH,
      smokedUntil: 0,
      breathAt: G.sim + A.rand(3, B.breathInterval),
      dead: false
    };
    o.targetAngle = o.angle;
    G.fishes.push(o);
    return o;
  }

  // Medusas are scenery that bites: they live in G.fishes so the grid, the
  // art pipeline and the draw pass come free, but nothing else in the game
  // treats them as animals. They are never eaten, never stunned, never respawned.
  function spawnJelly() {
    const cfg = A.JELLY;
    const scale = A.rand(0.8, 1.6);
    const radius = cfg.radius * scale;

    let pos = { x: A.rand(500, W.w - 500), y: bandY([0.2, 0.94]) };
    for (let i = 0; i < 24; i++) {
      pos = { x: A.rand(500, W.w - 500), y: bandY([0.2, 0.94]) };
      if (!G.player || A.dist2(pos.x, pos.y, G.player.x, G.player.y) > 1100 * 1100) break;
    }

    const j = {
      isPlayer: false,
      hazard: true,
      name: cfg.name,
      tier: 0,
      stageIndex: -1,
      x: pos.x,
      y: pos.y,
      angle: 0,
      targetAngle: 0,
      radius: radius,
      baseRadius: radius,
      cruise: cfg.aiSpeed * A.rand(0.7, 1.35),
      speedSmooth: 0,
      speedMul: 1,
      turnRate: 0.4,
      attackAt: 0,
      think: 0,
      mode: 'drift',
      targetX: pos.x,
      targetY: pos.y,
      wanderUntil: 0,
      threat: null,
      prey: null,
      foodRef: null,
      hunger: 100,
      xp: 0,
      phase: A.rand(0, TAU),
      pulseRate: A.rand(1.5, 2.4),
      driftX: A.rand(-13, 13),
      turnAt: G.sim + A.rand(4, 16),
      stingUntil: 0,
      swim: 0.4,
      colors: A.makeAIPalette(cfg.palette, A.rand(-34, 34)),
      art: cfg.art,
      aggression: 0,
      seed: A.rand(0, TAU),
      bite: 0,
      dead: false
    };
    G.fishes.push(j);
    return j;
  }

  function spawnInitialPopulation(menu) {
    for (let tier = 0; tier < A.TIER_TARGETS.length; tier++) {
      const count = A.TIER_TARGETS[tier];
      for (let i = 0; i < count; i++) {
        spawnAI(tier, menu ? { menu: true } : {});
      }
    }
    for (let i = 0; i < A.ORCA_TARGET; i++) spawnOrca();
    for (let i = 0; i < A.JELLY_COUNT; i++) spawnJelly();
  }

  function rollFoodKind() {
    const roll = Math.random();
    let acc = 0;
    for (let i = 0; i < A.FOOD.length; i++) {
      acc += A.FOOD[i].weight;
      if (roll <= acc) return i;
    }
    return 0;
  }

  function makeFood(x, y, kind) {
    if (kind == null) kind = rollFoodKind();
    const type = A.FOOD[kind];
    const skins = type.skins;
    return {
      x: x,
      y: y,
      r: type.radius,
      kind: kind,
      xp: type.xp,
      phase: A.rand(0, TAU),
      // An animal keeps the heading and colour it was spawned with for its
      // whole life, so a population looks like individuals rather than copies.
      spin: A.rand(0, TAU),
      skin: skins ? A.randInt(0, skins.length - 1) : 0,
      shape: skins ? A.randInt(0, 2) : 0,
      dead: false
    };
  }

  function spawnFoodAt(x, y, kind) {
    const fx = A.clamp(x, 90, W.w - 90);
    if (kind == null) kind = rollFoodKind();
    G.foods.push(makeFood(
      fx,
      A.clamp(y, 90, Math.min(W.h - 90, floorTop(fx) - 12)),
      kind
    ));
  }

  function spawnFoodRandom(minDistFromPlayer) {
    // Food follows its own depth band, which is what makes the deep trenches
    // worth diving into: pearls only establish themselves near the floor.
    const kind = rollFoodKind();
    let x = A.rand(110, W.w - 110);
    let y = bandY(FOOD_BANDS[kind]);
    if (G.player && minDistFromPlayer) {
      for (let i = 0; i < 14; i++) {
        if (A.dist2(x, y, G.player.x, G.player.y) >= minDistFromPlayer * minDistFromPlayer) break;
        x = A.rand(110, W.w - 110);
        y = bandY(FOOD_BANDS[kind]);
      }
    }
    spawnFoodAt(x, y, kind);
  }

  function seedInitialFood() {
    for (let i = 0; i < FOOD_TARGET; i++) spawnFoodRandom(0);
    if (G.player) {
      for (let i = 0; i < 26; i++) {
        const ang = A.rand(0, TAU);
        const dist = A.rand(140, 880);
        spawnFoodAt(G.player.x + Math.cos(ang) * dist, G.player.y + Math.sin(ang) * dist);
      }
    }
  }

  // ------------------------------------------------------------------
  // Ability
  // ------------------------------------------------------------------
  function useAbility() {
    if (G.state !== 'playing' || !G.player) return;
    const p = G.player;
    if (G.sim < p.abilityReadyAt) return;
    const ab = p.ability;

    if ((ab.id === 'chomp' || ab.id === 'breach' || ab.id === 'dash') && G.mouse.active && !keyboardDir()) {
      const target = pointerWorld();
      p.angle = Math.atan2(target.y - p.y, target.x - p.x);
    }

    p.abilityActiveUntil = G.sim + ab.duration;
    p.abilityReadyAt = G.sim + ab.cooldown;
    p.fxTimer = 0;
    if (A.Quests) A.Quests.ability(ab);
    // A breach is a collision; a lure is a held breath. Only the former shakes.
    G.camera.shake = Math.min(1, G.camera.shake + (ab.shock ? 0.6 : ab.pull ? 0 : ab.slash ? 0.34 : ab.flap ? 0.06 : ab.ink ? 0.1 : 0.22));
    A.Audio.ability();
    if (ab.shock) A.Audio.orcaBreath(1);
    if (ab.pull) A.Audio.lureFlare();
    if (ab.slash) A.Audio.dash();
    if (ab.flap) A.Audio.wingBoost();
    if (ab.ink) castInk(p, ab);
    // A terror roar is louder than the shockwave it rides out on, so it gets
    // its own voice instead of sharing the breach breath.
    if (ab.fear) {
      A.Audio.terrorRoar();
      spawnRing(p.x, p.y, 'rgba(214,246,255,0.5)', p.radius * 0.8, p.radius * ab.fear, 0.7, 3.4);
      spawnRing(p.x, p.y, 'rgba(143,217,232,0.35)', p.radius * 0.4, p.radius * ab.fear * 0.72, 0.95, 3);
    }
    spawnRing(p.x, p.y, 'rgba(185,246,255,0.55)', p.radius * 1.1, p.radius * 5, 0.45, 2.5);
    spawnSparks(p.x, p.y, [p.colors.accent, p.colors.fin, '#ffffff'], 10, 130, 2.6);
    updateAbilityUI(true);
  }

  // ------------------------------------------------------------------
  // Camera & input
  // ------------------------------------------------------------------
  function pointerWorld() {
    const z = G.camera.zoom;
    return {
      x: G.camera.x + (G.mouse.x - G.w / 2) / z,
      y: G.camera.y + (G.mouse.y - G.h / 2) / z
    };
  }

  function keyboardDir() {
    const k = G.keys;
    let x = 0;
    let y = 0;
    if (k.KeyA || k.ArrowLeft) x -= 1;
    if (k.KeyD || k.ArrowRight) x += 1;
    if (k.KeyW || k.ArrowUp) y -= 1;
    if (k.KeyS || k.ArrowDown) y += 1;
    if (!x && !y) return null;
    const len = Math.sqrt(x * x + y * y);
    return { x: x / len, y: y / len };
  }

  function clearKeys() {
    for (const code in G.keys) delete G.keys[code];
  }

  function computeTargetZoom() {
    const base = A.clamp(G.h / 950, 0.8, 1.3);
    const p = G.player;
    if (!p) return 0.85;
    return A.clamp(base * 1.08 * Math.pow(13 / Math.max(10, p.radius), 0.36), 0.7, 1.45);
  }

  function clampCamera() {
    const halfW = G.w / (2 * G.camera.zoom);
    const halfH = G.h / (2 * G.camera.zoom);
    G.camera.x = (halfW * 2 > W.w) ? W.w / 2 : A.clamp(G.camera.x, halfW, W.w - halfW);
    G.camera.y = (halfH * 2 > W.h) ? W.h / 2 : A.clamp(G.camera.y, halfH, W.h - halfH);
  }

  function updateCamera(dt) {
    const p = G.player;
    if (!p) return;
    let lx = 0;
    let ly = 0;
    const kb = keyboardDir();
    if (kb) {
      lx = kb.x * 55;
      ly = kb.y * 40;
    } else if (G.mouse.active) {
      lx = A.clamp(((G.mouse.x - G.w / 2) / G.camera.zoom) * 0.08, -55, 55);
      ly = A.clamp(((G.mouse.y - G.h / 2) / G.camera.zoom) * 0.08, -40, 40);
    }
    G.camera.x = A.damp(G.camera.x, p.x + lx, 5, dt);
    G.camera.y = A.damp(G.camera.y, p.y + ly, 5, dt);
    G.camera.zoom = A.damp(G.camera.zoom, computeTargetZoom(), 2.4, dt);
    clampCamera();
  }

  function updateMenuCamera(dt) {
    const t = G.sim;
    const tx = W.w * 0.5 + Math.sin(t * 0.06) * W.w * 0.26;
    const ty = W.h * 0.5 + Math.cos(t * 0.045) * W.h * 0.2;
    G.camera.x = A.damp(G.camera.x, tx, 0.6, dt);
    G.camera.y = A.damp(G.camera.y, ty, 0.6, dt);
    G.camera.zoom = A.damp(G.camera.zoom, A.clamp(G.h / 1150, 0.68, 0.92), 1.2, dt);
    clampCamera();
  }

  function updateDeadCamera(dt) {
    G.camera.zoom = A.damp(G.camera.zoom, 0.72, 1.1, dt);
    G.camera.x = A.damp(G.camera.x, G.deathCam.x + Math.sin(G.sim * 0.15) * 60, 0.9, dt);
    G.camera.y = A.damp(G.camera.y, G.deathCam.y + Math.cos(G.sim * 0.12) * 40, 0.9, dt);
    clampCamera();
  }

  function onPointerMove(e) {
    G.mouse.x = e.clientX;
    G.mouse.y = e.clientY;
    G.mouse.active = true;
    dom.cursor.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)';
  }

  function onPointerDown(e) {
    if (G.state !== 'playing') return;
    if (e.pointerType === 'mouse' && e.target === dom.canvas && e.button === 0) {
      useAbility();
    }
  }

  const MOVE_CODES = {
    KeyW: 1, KeyA: 1, KeyS: 1, KeyD: 1,
    ArrowUp: 1, ArrowLeft: 1, ArrowDown: 1, ArrowRight: 1
  };

  function isTyping(e) {
    const t = (e && e.target && e.target.tagName) ? e.target : document.activeElement;
    const tag = t && t.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  function onKeyDown(e) {
    // While a name field has the caret, the keyboard belongs to the keyboard.
    if (isTyping(e)) return;
    // The sign-in dialog owns the keys while it is up - a stray space should
    // never drop the player into a run behind the modal.
    if (A.AccountUI && A.AccountUI.isOpen()) return;
    if (A.AccountUI && A.AccountUI.isBlocking && A.AccountUI.isBlocking()) return;
    // Same for the mission board - it is a full-screen dialog.
    if (A.QuestsUI && A.QuestsUI.isOpen()) return;
    // And for the shop.
    if (A.ShopUI && A.ShopUI.isOpen()) return;
    const key = (e.key || '').toLowerCase();
    if (key === 'e') {
      if (G.state === 'playing' && G.player && G.player.weapon === 'abyss_shuriken') {
        e.preventDefault();
        throwShuriken();
      }
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      if (G.state === 'playing') {
        // SPACE remains the species ability; a carried shuriken is launched
        // separately with E, while the Poseidon trident still owns its charge.
        if (!tridentCharge()) useAbility();
      } else if (G.state === 'menu') startRun();
      return;
    }
    if (MOVE_CODES[e.code]) {
      if (e.code.indexOf('Arrow') === 0) e.preventDefault();
      G.keys[e.code] = true;
      G.mouse.active = false;
      return;
    }
    if (key === 'p' || e.key === 'Escape') {
      if (G.state === 'playing' || G.state === 'paused') {
        e.preventDefault();
        togglePause();
      }
      return;
    }
    if (key === 'm') {
      toggleSound();
      return;
    }
    // The trident's own key, so a player can charge without letting go of the
    // movement keys.
    if (key === 't') {
      if (G.state === 'playing') tridentCharge();
      return;
    }
    if (key === 'b') {
      if (A.ShopUI) {
        if (A.ShopUI.isOpen()) A.ShopUI.close();
        else A.ShopUI.open();
      }
      return;
    }
    if (e.key === 'Enter' || key === 'r') {
      if (G.state === 'menu') startRun();
      else if (G.state === 'dead') startRun();
    }
  }

  function onKeyUp(e) {
    if (MOVE_CODES[e.code]) delete G.keys[e.code];
  }

  function bindEvents() {
    dom.playBtn.addEventListener('click', startRun);
    dom.againBtn.addEventListener('click', startRun);
    dom.restartBtn.addEventListener('click', startRun);
    dom.resumeBtn.addEventListener('click', togglePause);
    dom.menuBtn.addEventListener('click', goMenu);
    dom.deathMenuBtn.addEventListener('click', goMenu);
    dom.soundBtn.addEventListener('click', toggleSound);
    dom.pauseSoundBtn.addEventListener('click', toggleSound);
    dom.abilityBtn.addEventListener('click', useAbility);
    if (dom.shotBtn) dom.shotBtn.addEventListener('click', tridentCharge);

    const nameFields = [dom.nameInput, dom.pauseNameInput];
    for (let i = 0; i < nameFields.length; i++) {
      const field = nameFields[i];
      if (!field) continue;
      const other = nameFields[i === 0 ? 1 : 0];
      field.addEventListener('input', function () {
        const name = setPlayerName(field.value);
        if (field.value !== name) field.value = name;
        if (other && other !== document.activeElement) other.value = name;
      });
      field.addEventListener('blur', syncNameInput);
      field.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          field.blur();
          if (G.state === 'menu') startRun();
        }
      });
    }

    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', function () {
      clearKeys();
      if (G.state === 'playing') togglePause();
    });
    document.addEventListener('visibilitychange', function () {
      clearKeys();
      if (document.hidden && G.state === 'playing') togglePause();
    });
    dom.canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  // ------------------------------------------------------------------
  // Player update
  // ------------------------------------------------------------------
  function updatePlayer(dt) {
    const p = G.player;
    if (!p) return;
    const ab = p.ability;
    const active = G.sim < p.abilityActiveUntil;
    const charging = G.sim < (p.chargeUntil || 0);
    // The art reads `lure` to flare the esca while Lure Flash is up.
    p.lure = A.damp(p.lure || 0, active && ab.pull ? 1 : 0, 9, dt);
    // ...and `saw` to heat the rostrum while Rip Dash is driving.
    p.saw = A.damp(p.saw || 0, active && ab.slash ? 1 : 0, 11, dt);
    // ...and `flap` to drive the wing beat while Wing Boost is carrying.
    p.flap = A.damp(p.flap || 0, active && ab.flap ? 1 : 0, 7, dt);

    const kb = keyboardDir();
    let dist = 0;
    const before = p.angle;
    if (!p.airborne && kb) {
      p.targetAngle = Math.atan2(kb.y, kb.x);
      p.angle = A.angleDamp(p.angle, p.targetAngle, 10, dt);
    } else if (!p.airborne && G.mouse.active) {
      const target = pointerWorld();
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 16) {
        p.targetAngle = Math.atan2(dy, dx);
        p.angle = A.angleDamp(p.angle, p.targetAngle, 8, dt);
      }
    }

    const mult = charging ? A.TRIDENT_CHARGE.speed : (active && ab.speed ? ab.speed : 1);
    let desired = 0;
    if (!p.airborne) {
      if (charging) {
        // The charge is a commitment: the animal keeps driving along its nose
        // even with no key held, so the ram always covers the same water.
        desired = p.speed * mult;
      } else if (kb) {
        desired = p.speed * mult;
      } else if (G.mouse.active && dist > 16) {
        desired = p.speed * mult * A.clamp((dist - 12) / 130, 0, 1);
      }
      p.speedSmooth = A.damp(p.speedSmooth, desired, charging ? 16 : (kb ? 9.5 : 7), dt);

      const previousY = p.y;
      p.x += Math.cos(p.angle) * p.speedSmooth * dt + p.knockX * dt;
      p.y += Math.sin(p.angle) * p.speedSmooth * dt + p.knockY * dt;

      // Invisible surface hitbox: trigger as soon as the fish crosses the
      // waterline zone while driving upward. The old check required the
      // centre to pass above the exact line in one frame, which could miss.
      const surfaceHitboxBottom = SURFACE_WORLD_Y + Math.max(28, p.radius * 0.9);
      const crossedSurfaceHitbox = previousY > surfaceHitboxBottom && p.y <= surfaceHitboxBottom;
      if (crossedSurfaceHitbox &&
          p.speedSmooth > Math.max(55, p.speed * 0.3) &&
          Math.sin(p.angle) < -0.22) {
        p.airborne = true;
        p.airVx = Math.cos(p.angle) * p.speedSmooth * 0.82;
        p.airVy = Math.min(-150, Math.sin(p.angle) * p.speedSmooth * 2.65);
        p.y = SURFACE_WORLD_Y - p.radius * 0.12;
        // Splash on takeoff; the same effect fires again when the fish lands.
        spawnSurfaceSplash(p.x, SURFACE_WORLD_Y, p.radius);
      }

      // Missions count the water you actually propelled through, not the shove
      // you got from a bigger fish. A breach is airborne time, not swimming.
      if (A.Quests) A.Quests.swim(Math.abs(p.speedSmooth) * dt);
      if (p.airborne) {
        p.x += p.airVx * dt;
        p.y += p.airVy * dt;
      }
    } else {
      // Air has no water drag: keep the launch momentum and let gravity pull
      // the animal through a natural arc. Steering resumes on splashdown.
      p.airVy += 900 * dt;
      p.airVx *= Math.exp(-0.22 * dt);
      p.x += p.airVx * dt;
      p.y += p.airVy * dt;
      p.angle = Math.atan2(p.airVy, p.airVx);
      if (p.airVy > 0 && p.y >= SURFACE_WORLD_Y + p.radius * 0.24) {
        p.y = SURFACE_WORLD_Y + p.radius * 0.24;
        p.airborne = false;
        p.speedSmooth = 0;
        spawnSurfaceSplash(p.x, SURFACE_WORLD_Y, p.radius);
      }
    }

    p.knockX = A.damp(p.knockX, 0, 7, dt);
    p.knockY = A.damp(p.knockY, 0, 7, dt);
    p.x = A.clamp(p.x, W.margin, W.w - W.margin);
    p.y = p.airborne
      ? A.clamp(p.y, 24, W.h - W.margin)
      : A.clamp(p.y, W.margin, ceilingAt(p.x, p.radius));

    p.swim = p.airborne ? 0.06 : A.clamp(p.speedSmooth / Math.max(1, p.speed), 0.22, 1.4);
    p.phase += dt * (p.airborne ? 1.6 : (3.2 + 6.5 * p.swim));
    // A sawshark at full drive gets a rush of water off the flank. Throttled
    // inside the sound, so holding the direction key does not stack into a roar.
    if (p.art === 'sawshark' && p.speedSmooth > p.speed * 0.82) {
      A.Audio.sawRush(A.clamp(p.speedSmooth / (p.speed * 1.5), 0.3, 1));
    }
    // A manta under boost power throws a heavy stroke every beat or so; the
    // cadence is throttled inside the sound so it stays a wing, not a fan.
    if (p.art === 'manta' && (p.flap || 0) > 0.2) {
      A.Audio.wingThrust(p.flap);
    }
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    if (p.bite > 0) p.bite = Math.max(0, p.bite - dt * 3.6);
    // Jaws stay clamped around the rod while the surge is on.
    if (charging) p.bite = Math.max(p.bite, 0.5);
    if (charging && G.quality >= 0.5) {
      p.chargeFxTimer -= dt;
      if (p.chargeFxTimer <= 0) {
        p.chargeFxTimer = 0.035;
        const back = p.angle + Math.PI;
        const bx = p.x + Math.cos(back) * p.radius * 1.02 + A.rand(-1, 1) * p.radius * 0.3;
        const by = p.y + Math.sin(back) * p.radius * 1.02 + A.rand(-1, 1) * p.radius * 0.3;
        addParticle({
          type: 'bubble', x: bx, y: by,
          vx: Math.cos(back) * A.rand(40, 140), vy: Math.sin(back) * A.rand(40, 140) - 18,
          size: A.rand(2, 5) + p.radius * 0.04,
          life: 0.55, maxLife: 0.55
        });
        addParticle({
          type: 'streak', x: bx, y: by,
          vx: Math.cos(back) * A.rand(80, 240), vy: Math.sin(back) * A.rand(80, 240),
          size: p.radius * 0.1, color: p.colors.accent,
          life: 0.26, maxLife: 0.26
        });
      }
    }
    // Bank into the turn, so an evolved orca rolls the way the wild ones do.
    p.bank = A.damp(p.bank, A.clamp(A.angleDiff(before, p.angle) / Math.max(0.0001, dt) * 0.4, -1, 1), 3, dt);

    if (active) {
      p.fxTimer -= dt;
      if (p.fxTimer <= 0) {
        p.fxTimer = (ab.id === 'chomp' || ab.id === 'breach' || ab.id === 'dash') ? 0.025 : 0.055;
        spawnAbilityTrail(p, ab);
      }
    }
  }

  function spawnAbilityTrail(p, ab) {
    const back = p.angle + Math.PI;
    const bx = p.x + Math.cos(back) * p.radius * 1.05 + A.rand(-1, 1) * p.radius * 0.25;
    const by = p.y + Math.sin(back) * p.radius * 1.05 + A.rand(-1, 1) * p.radius * 0.25;

    if (ab.id === 'boost' || ab.id === 'chomp') {
      addParticle({
        type: 'bubble', x: bx, y: by,
        vx: A.rand(-16, 16), vy: A.rand(-38, -12),
        size: A.rand(2, 4.5) + p.radius * 0.04,
        life: 0.65, maxLife: 0.65
      });
      addParticle({
        type: 'spark', x: bx, y: by,
        vx: Math.cos(back) * A.rand(20, 70), vy: Math.sin(back) * A.rand(20, 70),
        size: A.rand(1.2, 2.6), color: p.colors.accent,
        life: 0.3, maxLife: 0.3
      });
    } else if (ab.id === 'wingboost') {
      // Every stroke pushes water off a wing tip and throws it back and out, so
      // the glide leaves two diagonal streaks instead of one tail jet.
      const side = Math.random() < 0.5 ? 1 : -1;
      const wa = p.angle + side * 1.35;
      const wd = p.radius * A.rand(0.9, 1.7);
      addParticle({
        type: 'bubble',
        x: p.x + Math.cos(wa) * wd, y: p.y + Math.sin(wa) * wd,
        vx: Math.cos(back) * A.rand(50, 150) + Math.cos(wa) * A.rand(20, 70),
        vy: Math.sin(back) * A.rand(50, 150) + Math.sin(wa) * A.rand(20, 70) - 16,
        size: A.rand(2.2, 5) + p.radius * 0.05,
        life: 0.6, maxLife: 0.6
      });
      addParticle({
        type: 'spark', x: bx, y: by,
        vx: Math.cos(back) * A.rand(70, 190), vy: Math.sin(back) * A.rand(70, 190),
        size: A.rand(1.3, 2.8), color: p.colors.accent,
        life: 0.32, maxLife: 0.32
      });
    } else if (ab.id === 'dash') {
      // A jet off the tail plus spray thrown forward along the saw's lane.
      addParticle({
        type: 'bubble', x: bx, y: by,
        vx: Math.cos(back) * A.rand(60, 180), vy: Math.sin(back) * A.rand(60, 180) - 20,
        size: A.rand(2.2, 5.5) + p.radius * 0.05,
        life: 0.6, maxLife: 0.6
      });
      const fa = p.angle + A.rand(-0.5, 0.5);
      const fd = p.radius * A.rand(1.1, ab.slash);
      addParticle({
        type: 'spark',
        x: p.x + Math.cos(fa) * fd, y: p.y + Math.sin(fa) * fd,
        vx: Math.cos(fa) * A.rand(120, 320), vy: Math.sin(fa) * A.rand(120, 320),
        size: A.rand(1.4, 3), color: '#eafcff',
        life: 0.22, maxLife: 0.22
      });
    } else if (ab.id === 'breach') {
      // White water thrown off the flanks as the body ploughs through.
      const side = p.angle + (Math.random() < 0.5 ? 1 : -1) * A.rand(0.7, 1.35);
      addParticle({
        type: 'bubble', x: bx, y: by,
        vx: Math.cos(side) * A.rand(40, 150), vy: Math.sin(side) * A.rand(40, 150) - 30,
        size: A.rand(3, 7) + p.radius * 0.05,
        life: 0.8, maxLife: 0.8
      });
      addParticle({
        type: 'spark',
        x: p.x + Math.cos(p.angle) * p.radius * 0.8, y: p.y + Math.sin(p.angle) * p.radius * 0.8,
        vx: Math.cos(p.angle) * A.rand(60, 200), vy: Math.sin(p.angle) * A.rand(60, 200),
        size: A.rand(1.6, 3.4), color: '#eafcff',
        life: 0.26, maxLife: 0.26
      });
    } else if (ab.id === 'terror') {
      // Cavitated water blown straight out of the open mouth, so the roar has
      // a direction you can see even though it hits everything around you.
      A.Audio.terrorPulse(0.85);
      const fa = p.angle + A.rand(-0.6, 0.6);
      const fd = p.radius * A.rand(0.8, 1.45);
      addParticle({
        type: 'bubble',
        x: p.x + Math.cos(fa) * fd, y: p.y + Math.sin(fa) * fd,
        vx: Math.cos(fa) * A.rand(90, 250), vy: Math.sin(fa) * A.rand(90, 250) - 24,
        size: A.rand(2.5, 6.5) + p.radius * 0.05,
        life: 0.7, maxLife: 0.7
      });
      addParticle({
        type: 'streak',
        x: p.x + Math.cos(fa) * fd, y: p.y + Math.sin(fa) * fd,
        vx: Math.cos(fa) * A.rand(180, 420), vy: Math.sin(fa) * A.rand(180, 420),
        size: p.radius * 0.1, color: p.colors.glow,
        life: 0.28, maxLife: 0.28
      });
      addParticle({
        type: 'spark', x: bx, y: by,
        vx: Math.cos(back) * A.rand(40, 130), vy: Math.sin(back) * A.rand(40, 130),
        size: A.rand(1.4, 3), color: p.colors.accent,
        life: 0.34, maxLife: 0.34
      });
    } else if (ab.id === 'lure') {
      // Motes of plankton drawn in from ahead, so the light visibly pulls.
      const a = p.angle + A.rand(-0.85, 0.85);
      const d = p.radius * A.rand(2.2, 5.2);
      const mx = p.x + Math.cos(a) * d;
      const my = p.y + Math.sin(a) * d;
      addParticle({
        type: 'spark', x: mx, y: my,
        vx: (p.x - mx) * 0.9, vy: (p.y - my) * 0.9,
        size: A.rand(1.2, 2.6), color: p.colors.glow,
        life: 0.55, maxLife: 0.55
      });
    } else if (ab.id === 'ink') {
      // A trickle keeps feeding the cloud while the ability holds, and the
      // jet that comes with it blows backwards out of the siphon.
      if (Math.random() < 0.6) {
        const a = p.angle + Math.PI + A.rand(-0.45, 0.45);
        addParticle({
          type: 'spark',
          x: p.x + Math.cos(a) * p.radius * 0.55, y: p.y + Math.sin(a) * p.radius * 0.55,
          vx: Math.cos(a) * A.rand(30, 130), vy: Math.sin(a) * A.rand(30, 130),
          size: A.rand(2, 4.6), color: '#221528',
          life: A.rand(0.4, 0.8), maxLife: 0.8
        });
      }
    } else if (ab.id === 'surge') {
      addParticle({
        type: 'streak', x: p.x + A.rand(-6, 6), y: p.y + A.rand(-6, 6),
        vx: Math.cos(back) * 70, vy: Math.sin(back) * 70,
        size: p.radius * 0.12, color: p.colors.accent,
        life: 0.32, maxLife: 0.32
      });
    } else if (ab.id === 'frenzy') {
      if (Math.random() < 0.45) {
        const fx = p.x + Math.cos(p.angle) * p.radius * 0.95;
        const fy = p.y + Math.sin(p.angle) * p.radius * 0.95;
        addParticle({
          type: 'spark', x: fx, y: fy,
          vx: A.rand(-30, 30), vy: A.rand(-30, 30),
          size: A.rand(1.5, 3), color: p.colors.fin,
          life: 0.32, maxLife: 0.32
        });
      }
    } else if (ab.id === 'shield') {
      if (Math.random() < 0.25) {
        spawnRing(p.x, p.y, 'rgba(255,190,214,0.5)', p.radius * 1.4, p.radius * 1.6, 0.5, 2);
      }
    }
  }

  function updateVitals(dt) {
    const p = G.player;
    if (!p) return;
    p.hunger = Math.max(0, p.hunger - dt * 0.5);
    if (p.hunger <= 0) {
      p.health -= dt * 4;
      if (p.health <= 0) {
        p.health = 0;
        die(null);
        return;
      }
    } else if (p.health < p.maxHealth && p.hunger > 42 && G.sim - p.lastDamage > 4) {
      p.health = Math.min(p.maxHealth, p.health + dt * 1.7);
    }
  }

  function checkEvolution() {
    const p = G.player;
    if (!p) return;
    const next = A.STAGES[p.stageIndex + 1];
    if (next && p.xp >= next.xpReq && G.sim >= p.evolveReadyAt) {
      evolvePlayer();
    }
  }

  function evolvePlayer() {
    const p = G.player;
    if (!p) return;
    p.stageIndex++;
    const stage = A.STAGES[p.stageIndex];
    p.art = stage.art;
    p.colors = stage.palette;
    p.radius = stage.radius;
    p.baseRadius = stage.radius;
    p.speed = stage.speed;
    p.ability = stage.ability;
    if (A.Quests) A.Quests.evolve(stage);
    p.health = Math.min(p.maxHealth, p.health + 22);
    p.hunger = Math.min(p.maxHunger, p.hunger + 18);
    p.invulnUntil = G.sim + 2.0;
    p.evolveReadyAt = G.sim + 1.6;
    p.abilityReadyAt = G.sim;
    p.abilityActiveUntil = 0;
    p.hitFlash = 0;

    G.evolveFlash = 1;
    G.camera.shake = Math.max(G.camera.shake, 0.65);
    A.Audio.evolve();

    spawnRing(p.x, p.y, 'rgba(255,226,150,0.7)', p.radius * 0.6, p.radius * 7, 0.8, 3);
    spawnRing(p.x, p.y, 'rgba(140,245,255,0.6)', p.radius * 0.3, p.radius * 5, 0.7, 2);
    spawnSparks(p.x, p.y, [p.colors.body, p.colors.accent, p.colors.fin, '#ffe6a3'], 28, 220, 3.4);
    for (let i = 0; i < 10; i++) {
      const a = A.rand(0, TAU);
      addParticle({
        type: 'bubble', x: p.x + Math.cos(a) * p.radius, y: p.y + Math.sin(a) * p.radius,
        vx: Math.cos(a) * 40, vy: A.rand(-60, -20),
        size: A.rand(2.5, 5.5), life: 0.9, maxLife: 0.9
      });
    }

    if (A.Collection) A.Collection.onEvolve(p);

    showBanner(stage.name.toUpperCase(), 'EVOLUTION ' + (p.stageIndex + 1) + ' / ' + A.STAGES.length + ' - ' + stage.ability.name.toUpperCase() + ' UNLOCKED', 2800);
    updateHUD(true);
    updateAbilityUI(true);
    drawPortrait();
  }

  function damagePlayer(amount, source) {
    const p = G.player;
    if (!p || G.state !== 'playing') return;
    if (G.sim < p.invulnUntil) return;

    const shieldActive = p.ability.id === 'shield' && G.sim < p.abilityActiveUntil;
    if (shieldActive) amount *= 1 - p.ability.shield;

    p.health -= amount;
    p.lastDamage = G.sim;
    p.invulnUntil = G.sim + 0.75;
    p.hitFlash = 0.3;

    const ang = source ? Math.atan2(p.y - source.y, p.x - source.x) : A.rand(0, TAU);
    p.knockX += Math.cos(ang) * 360;
    p.knockY += Math.sin(ang) * 360;
    if (source && source.isPlayer === false) {
      source.x -= Math.cos(ang) * 14;
      source.y -= Math.sin(ang) * 14;
      source.speedSmooth *= 0.35;
      source.recoilUntil = G.sim + 0.5;
    }

    G.flash = Math.min(1, G.flash + 0.75);
    G.camera.shake = Math.min(1.2, G.camera.shake + 0.4);
    A.Audio.hurt();
    spawnSparks(p.x, p.y, ['#ff6d7f', '#ffb0a0', '#ffffff'], 8, 130, 2.6);

    if (shieldActive && Math.random() < 0.4) {
      spawnRing(p.x, p.y, 'rgba(255,190,214,0.6)', p.radius * 1.5, 80, 0.4, 2);
    }

    if (p.health <= 0) {
      p.health = 0;
      die(source);
    }
  }

  function die(killer) {
    const p = G.player;
    if (!p) return;
    const score = Math.floor(p.xp) + G.eaten * 15;
    // The cut is taken from this run's own XP, never from the lifetime bank,
    // and the reef lets anything at or below the fast fish keep everything.
    p.died = true;
    p.penalized = p.stageIndex > (A.stageByKey ? A.stageByKey('fast') : 2);
    const mirrored = saveBest(p);
    G.deathCam.x = G.camera.x;
    G.deathCam.y = G.camera.y;
    deathBurst(p);
    p.dead = true;
    G.player = null;

    A.Audio.death();
    setState('dead');
    dom.damageFlash.style.opacity = '0';
    G.flash = 0;

    dom.deathStage.textContent = A.STAGES[p.stageIndex].name + ' (Stage ' + (p.stageIndex + 1) + ')';
    dom.deathScore.textContent = A.formatNumber(score);
    dom.deathEaten.textContent = G.eaten;
    dom.deathTime.textContent = A.formatTime(G.runTime);
    if (killer) {
      let by = killer.name || '';
      if (!by && killer.stageIndex >= 0 && A.STAGES[killer.stageIndex]) by = A.STAGES[killer.stageIndex].name;
      dom.deathSub.textContent = 'You have been killed by "' + (by || 'something in the dark') + '".';
    } else {
      dom.deathSub.textContent = 'Starvation pulled you down into the dark.';
    }
    dom.deathPenalty.classList.add('hidden');
    dom.deathPenalty.classList.remove('safe');
    dom.deathPenalty.textContent = '';
    if (mirrored && mirrored.then) {
      mirrored.then(function (res) {
        if (!res) return;
        const paid = res.lost > 0;
        dom.deathPenalty.classList.toggle('safe', !paid);
        dom.deathPenalty.textContent = paid
          ? '\u2212' + A.formatNumber(res.lost) + ' XP LOST \u00b7 ONE THIRD OF THIS RUN'
          : 'NO XP LOST \u00b7 THE SMALL ONES KEEP EVERYTHING';
        dom.deathPenalty.classList.remove('hidden');
      });
    }
    G.orcaHunter = null;
    G.fishHunter = null;
    G.fishChaseReadyAt = 0;
    const best = getBest();
    dom.deathBest.textContent = best ? 'Best run - ' + A.formatNumber(best.xp) + ' XP' : '';
    updateBestUI();

    G.deathTimer = setTimeout(function () {
      dom.deathMenu.classList.remove('hidden');
      G.deathTimer = 0;
    }, 850);
  }

  function deathBurst(p) {
    spawnRing(p.x, p.y, 'rgba(255,140,160,0.6)', p.radius * 0.8, p.radius * 8, 0.9, 3);
    for (let i = 0; i < 24; i++) {
      const a = A.rand(0, TAU);
      const sp = A.rand(40, 180);
      addParticle({
        type: 'scale',
        x: p.x, y: p.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        rot: A.rand(0, TAU), vr: A.rand(-6, 6),
        size: A.rand(3, 7),
        color: A.pick([p.colors.body, p.colors.fin, p.colors.accent]),
        life: A.rand(0.6, 1.2), maxLife: 1.2
      });
    }
    for (let i = 0; i < 8; i++) {
      const a = A.rand(0, TAU);
      addParticle({
        type: 'bubble', x: p.x, y: p.y,
        vx: Math.cos(a) * A.rand(20, 60), vy: A.rand(-70, -20),
        size: A.rand(2, 6), life: 1, maxLife: 1
      });
    }
  }

  // ------------------------------------------------------------------
  // AI
  // ------------------------------------------------------------------
  // Ordinary fish are not orcas: only one may press the player at a time, and
  // only for a handful of seconds. Without the cap a line of bigger fish forms
  // behind an evolved player and never peels off.
  function canHuntPlayer(ai) {
    const h = G.fishHunter;
    if (h === ai) return true;
    if (G.sim < (G.fishChaseReadyAt || 0)) return false;
    if (!h || h.dead || h.mode !== 'huntPlayer' || G.sim >= (h.playerChaseUntil || 0)) {
      G.fishHunter = ai;
      return true;
    }
    return false;
  }

  function giveUpPlayerChase(ai, p) {
    const B = A.FISH_BEHAVIOR;
    ai.mode = 'wander';
    ai.playerChaseUntil = 0;
    ai.ignorePlayerUntil = G.sim + A.rand(B.chaseRest[0], B.chaseRest[1]);
    ai.prey = null;
    ai.foodRef = null;
    ai.wanderUntil = 0;
    ai.speedMul = 0.55;
    ai.think = A.rand(0.4, 0.8);
    if (p) ai.targetAngle = Math.atan2(ai.y - p.y, ai.x - p.x) + A.rand(-0.65, 0.65);
    if (G.fishHunter === ai) {
      G.fishHunter = null;
      // Water between hunts: no other fish may take up the chase the instant
      // this one peels off, so an evolved player gets room to breathe.
      G.fishChaseReadyAt = G.sim + A.rand(2.5, 5);
    }
  }

  function aiThink(ai) {
    const B = A.FISH_BEHAVIOR;
    ai.think = A.rand(0.28, 0.5);
    const p = (G.state === 'playing') ? G.player : null;

    // Leaving the hunt for any reason releases the single-hunter slot.
    if (ai.mode !== 'huntPlayer' && G.fishHunter === ai) G.fishHunter = null;

    // Ink in the gills: the fish stops hunting, stops fearing and drifts until
    // the water clears. It still reacts to a body bumping into it, which is
    // what the movement layer below reads, so it never teleports or freezes.
    if (G.sim < (ai.smokedUntil || 0)) {
      ai.mode = 'smoked';
      if (G.fishHunter === ai) G.fishHunter = null;
      ai.prey = null;
      ai.threat = null;
      ai.foodRef = null;
      ai.targetAngle = ai.angle + A.rand(-0.55, 0.55);
      ai.speedMul = 0.34;
      return;
    }

    let threat = null;
    let threatD = Infinity;

    if (p && p.radius > ai.radius * 1.04) {
      const d = A.dist2(ai.x, ai.y, p.x, p.y);
      if (d < 320 * 320) { threat = p; threatD = d; }
    }
    // Predators read as threats to everything smaller, which is what sends
    // schools bolting for the shallows when an orca comes through.
    const threatCand = gridQuery(fishGrid, ai.x, ai.y, 290);
    for (let i = 0; i < threatCand.length; i++) {
      const o = threatCand[i];
      if (o === ai || o.dead) continue;
      if (o.radius > ai.radius * 1.08) {
        const d = A.dist2(ai.x, ai.y, o.x, o.y);
        if (d < 290 * 290 && d < threatD) { threat = o; threatD = d; }
      }
    }

    if (threat) {
      // A fish does not turn on a dime the instant it notices you. The first
      // beat is a startled hesitation, and that is the window a hunter lives in.
      if (ai.threat !== threat) {
        ai.panicAt = G.sim + A.rand(B.startle[0], B.startle[1]);
      }
      ai.threat = threat;
      ai.prey = null;
      ai.foodRef = null;
      if (G.fishHunter === ai) G.fishHunter = null;

      if (G.sim < ai.panicAt) {
        ai.mode = 'startled';
        ai.targetAngle = ai.angle + A.rand(-0.5, 0.5);
        ai.speedMul = 0.42;
        // Re-think exactly when the startle ends instead of holding the
        // hesitation for a whole extra think cycle.
        ai.think = Math.max(0.06, Math.min(ai.think, ai.panicAt - G.sim + 0.02));
        return;
      }

      if (ai.mode !== 'flee') ai.fleeSince = G.sim;
      // Panic has a shelf life: the sprint fades after a couple of seconds so
      // a patient hunter can run the fish down instead of chasing forever.
      const tired = G.sim - (ai.fleeSince || G.sim) > B.fleeExhaustAfter;
      // The escape heading is a guess, not a solution. A wide panic error (and
      // the occasional wrong turn) lets a hunter cut a fleeing fish off.
      let away = Math.atan2(ai.y - threat.y, ai.x - threat.x);
      away += A.rand(-B.fleeError, B.fleeError);
      if (Math.random() < 0.15) away += A.rand(-0.85, 0.85);
      ai.mode = 'flee';
      ai.targetAngle = away;
      ai.speedMul = tired ? B.fleeExhaustSpeed : B.fleeSpeed;
      return;
    }
    ai.threat = null;

    const canChase = p && ai.radius > p.radius * 1.12 && G.sim > (ai.ignorePlayerUntil || 0);
    if (canChase) {
      const d = A.dist2(ai.x, ai.y, p.x, p.y);
      const inRange = d < B.senseRadius * B.senseRadius;
      if (ai.mode === 'huntPlayer') {
        // A committed chase runs to its deadline or until the player breaks
        // the sense radius; it is never re-rolled.
        if (inRange && G.sim < ai.playerChaseUntil) {
          ai.targetX = p.x;
          ai.targetY = p.y;
          ai.targetAngle = Math.atan2(p.y - ai.y, p.x - ai.x);
          ai.speedMul = 1.08;
          ai.prey = null;
          ai.foodRef = null;
          return;
        }
        giveUpPlayerChase(ai, p);
        return;
      }
      // Even a bigger fish hesitates: it takes a hungry or aggressive animal
      // to commit, so entering their water is not an instant lock-on.
      const willing = ai.hunger < 40 || Math.random() < ai.aggression * 0.55;
      if (inRange && willing && canHuntPlayer(ai)) {
        ai.playerChaseUntil = G.sim + B.playerChaseTime;
        ai.mode = 'huntPlayer';
        ai.targetX = p.x;
        ai.targetY = p.y;
        ai.targetAngle = Math.atan2(p.y - ai.y, p.x - ai.x);
        ai.speedMul = 1.08;
        ai.prey = null;
        ai.foodRef = null;
        return;
      }
    }
    if (ai.mode === 'huntPlayer') {
      giveUpPlayerChase(ai, p);
      return;
    }

    let prey = null;
    let preyScore = -Infinity;
    const wantsPrey = ai.tier >= 3 || Math.random() < ai.aggression * 0.55 || ai.hunger < 45;
    if (wantsPrey) {
      const preyCand = gridQuery(fishGrid, ai.x, ai.y, 340);
      for (let i = 0; i < preyCand.length; i++) {
        const o = preyCand[i];
        if (o === ai || o.dead || o.predator || o.hazard) continue;
        if (o.radius > ai.radius * 0.82) continue;
        const d = A.dist2(ai.x, ai.y, o.x, o.y);
        if (d < 340 * 340) {
          const score = (ai.radius - o.radius) * 8 + (340 * 340 - d) * 0.001;
          if (score > preyScore) { prey = o; preyScore = score; }
        }
      }
    }

    let food = null;
    let foodD = Infinity;
    if (ai.hunger < 96 || !prey) {
      const foodCand = gridQuery(foodGrid, ai.x, ai.y, 370);
      for (let i = 0; i < foodCand.length; i++) {
        const f = foodCand[i];
        if (f.dead) continue;
        const d = A.dist2(ai.x, ai.y, f.x, f.y);
        if (d < 370 * 370 && d < foodD) { food = f; foodD = d; }
      }
    }

    if (prey && (ai.hunger < 82 || ai.tier >= 3 || Math.random() < 0.35)) {
      ai.mode = 'huntPrey';
      ai.prey = prey;
      ai.foodRef = null;
      ai.targetAngle = Math.atan2(prey.y - ai.y, prey.x - ai.x);
      ai.speedMul = 1.12;
      return;
    }

    if (food && ai.hunger < 88) {
      ai.mode = 'seekFood';
      ai.foodRef = food;
      ai.prey = null;
      ai.targetAngle = Math.atan2(food.y - ai.y, food.x - ai.x);
      ai.speedMul = 0.78;
      return;
    }

    ai.mode = 'wander';
    ai.prey = null;
    ai.foodRef = null;
    if (!ai.wanderUntil || G.sim > ai.wanderUntil || A.dist2(ai.x, ai.y, ai.targetX, ai.targetY) < 100 * 100) {
      if (ai.stageIndex === A.SHARK_TIER || ai.stageIndex === A.SAW_TIER) {
        // Apex sharks and sawsharks patrol expansive oceanic paths with
        // deliberate cruising headings. The sawshark covers more ground.
        const isSaw = ai.stageIndex === A.SAW_TIER;
        const patrolDist = A.rand(isSaw ? 900 : 700, isSaw ? 1500 : 1200);
        const patrolAngle = ai.angle + A.rand(-0.75, 0.75);
        ai.targetX = A.clamp(ai.x + Math.cos(patrolAngle) * patrolDist, 280, W.w - 280);
        ai.targetY = A.clamp(ai.y + Math.sin(patrolAngle) * patrolDist, 280, Math.min(W.h - 280, floorTop(ai.x) - 120));
        ai.wanderUntil = G.sim + A.rand(4.5, 8.5);
      } else {
        ai.targetX = A.clamp(ai.x + A.rand(-480, 480), 220, W.w - 220);
        ai.targetY = bandY(TIER_BANDS[ai.stageIndex]);
        ai.wanderUntil = G.sim + A.rand(2, 5);
      }
    }
    ai.targetAngle = Math.atan2(ai.targetY - ai.y, ai.targetX - ai.x);
    ai.speedMul = ai.stageIndex === A.SAW_TIER ? 0.8 : ai.stageIndex === A.MANTA_TIER ? 0.7 : ai.stageIndex === A.SHARK_TIER ? 0.62 : 0.5;
  }

  // ------------------------------------------------------------------
  // Orca
  // ------------------------------------------------------------------
  // patrol -> chase -> burst -> feed, with a retreat branch when a chase
  // fails. Two fairness rules keep it threatening without being a sentence:
  // only one orca may hunt the player at a time, and an orca that loses a
  // chase ignores the player for a while afterwards.
  function orcaThink(o) {
    const B = A.ORCA_BEHAVIOR;
    const p = (G.state === 'playing') ? G.player : null;
    o.think = A.rand(0.3, 0.55);

    if (G.orcaHunter === o && o.mode !== 'chase' && o.mode !== 'burst') G.orcaHunter = null;

    if (G.sim < o.feedUntil) {
      o.mode = 'feed';
      o.speedMul = 0.34;
      o.prey = null;
      return;
    }
    if (o.mode === 'feed') {
      o.mode = 'patrol';
      o.restUntil = G.sim + B.restTime;
    }

    // Nothing makes an orca abandon a chase faster than a bigger tooth. A
    // Megalodon in the water is the one animal that turns the hunter around.
    if (p && p.art === 'megalodon' && G.state === 'playing') {
      const md = A.dist2(o.x, o.y, p.x, p.y);
      if (md < 1150 * 1150) {
        o.prey = null;
        o.threat = null;
        o.mode = 'retreat';
        o.retreatUntil = G.sim + A.rand(6, 9);
        o.speedMul = 1;
        if (G.orcaHunter === o) G.orcaHunter = null;
        return;
      }
    }

    if (o.mode === 'chase' || o.mode === 'burst') {
      const t = o.prey;
      const lost = !t || t.dead || G.sim > o.chaseUntil ||
        A.dist2(o.x, o.y, t.x, t.y) > B.giveUpRadius * B.giveUpRadius;
      if (lost) {
        const wasPlayer = !!p && t === p;
        o.prey = null;
        o.mode = 'retreat';
        o.retreatUntil = G.sim + A.rand(4, 7);
        if (wasPlayer) {
          o.ignorePlayerUntil = G.sim + A.rand(15, 24);
          if (G.orcaHunter === o) G.orcaHunter = null;
        }
      }
    }

    if (o.mode === 'retreat') {
      if (G.sim < o.retreatUntil) {
        const away = o.threat || p;
        o.targetAngle = away
          ? Math.atan2(o.y - away.y, o.x - away.x)
          : o.angle + A.rand(-0.35, 0.35);
        o.speedMul = 1;
        o.threat = null;
        return;
      }
      o.mode = 'patrol';
      o.restUntil = G.sim + B.restTime * 0.6;
    }

    // Prefer the largest animal it can actually swallow, so an orca working a
    // reef goes after sharks rather than drifting through a cloud of minnows.
    const sense = B.senseRadius;
    let best = null;
    let bestScore = -Infinity;
    const cand = gridQuery(fishGrid, o.x, o.y, sense);
    for (let i = 0; i < cand.length; i++) {
      const f = cand[i];
      if (f === o || f.dead || f.predator || f.hazard) continue;
      if (f.radius > o.radius * 0.62) continue;
      const d = A.dist2(o.x, o.y, f.x, f.y);
      if (d > sense * sense) continue;
      const score = f.radius * 14 - Math.sqrt(d);
      if (score > bestScore) { bestScore = score; best = f; }
    }

    let playerTarget = null;
    if (p && G.sim > o.ignorePlayerUntil && !G.orcaHunter && p.radius < o.radius * 0.55) {
      const d = A.dist2(o.x, o.y, p.x, p.y);
      if (d < sense * sense * 0.55) playerTarget = p;
    }

    if (playerTarget && (!best || best.radius < p.radius)) {
      o.prey = playerTarget;
      o.mode = 'chase';
      o.chaseUntil = G.sim + B.chaseTimeout;
      o.targetAngle = Math.atan2(p.y - o.y, p.x - o.x);
      o.speedMul = B.chaseSpeed;
      G.orcaHunter = o;
      return;
    }

    if (best) {
      o.prey = best;
      o.mode = 'chase';
      o.chaseUntil = G.sim + B.chaseTimeout;
      o.targetAngle = Math.atan2(best.y - o.y, best.x - o.x);
      o.speedMul = B.chaseSpeed;
      return;
    }

    o.mode = 'patrol';
    o.prey = null;
    if (!o.wanderUntil || G.sim > o.wanderUntil ||
      A.dist2(o.x, o.y, o.targetX, o.targetY) < 320 * 320) {
      const ang = o.angle + A.rand(-1.1, 1.1);
      const dist = A.rand(1600, 3400);
      o.targetX = A.clamp(o.x + Math.cos(ang) * dist, 400, W.w - 400);
      o.targetY = bandY([0.4, 0.96]);
      o.wanderUntil = G.sim + A.rand(10, 20);
    }
    o.targetAngle = Math.atan2(o.targetY - o.y, o.targetX - o.x);
    o.speedMul = G.sim < o.restUntil ? B.patrolSpeed * 0.72 : B.patrolSpeed;
  }

  function updateOrca(o, dt) {
    const B = A.ORCA_BEHAVIOR;
    const p = G.player;

    o.think -= dt;
    if (o.think <= 0) orcaThink(o);

    // Commit to a lunge only when the target is already close and ahead, so
    // the burst reads as an attack rather than random speed changes.
    if (o.mode === 'chase' && o.prey && !o.prey.dead) {
      const t = o.prey;
      const lungeR = o.radius * 2.7;
      if (A.dist2(o.x, o.y, t.x, t.y) < lungeR * lungeR) {
        const toT = Math.atan2(t.y - o.y, t.x - o.x);
        if (Math.cos(toT - o.angle) > 0.72) {
          o.mode = 'burst';
          o.burstUntil = G.sim + B.burstTime;
        }
      }
    } else if (o.mode === 'burst' && G.sim > o.burstUntil) {
      o.mode = 'chase';
    }

    const mul = o.mode === 'burst' ? B.burstSpeed : o.speedMul;
    o.speedSmooth = A.damp(o.speedSmooth, o.cruise * mul, o.mode === 'burst' ? 5 : 1.5, dt);

    const before = o.angle;
    o.targetAngle += Math.sin(G.sim * 0.7 + o.seed) * 0.04;
    o.angle = A.angleDamp(o.angle, o.targetAngle,
      o.turnRate * (o.mode === 'burst' ? 1.7 : 1), dt);
    // Bank into the turn: a 350px body does not pivot flat.
    const rate = A.angleDiff(before, o.angle) / Math.max(0.0001, dt);
    o.bank = A.damp(o.bank, A.clamp(rate * 0.4, -1, 1), 3, dt);

    o.x += Math.cos(o.angle) * o.speedSmooth * dt;
    o.y += Math.sin(o.angle) * o.speedSmooth * dt;
    const bm = W.margin + 70;
    if (o.x < bm || o.x > W.w - bm || o.y < bm || o.y > floorTop(o.x) - bm) {
      o.targetAngle = Math.atan2(W.h * 0.7 - o.y, W.w * 0.5 - o.x);
    }
    o.x = A.clamp(o.x, bm, W.w - bm);
    o.y = A.clamp(o.y, bm, ceilingAt(o.x, o.radius));

    o.swim = A.clamp(o.speedSmooth / Math.max(60, o.cruise), 0.18, 1.6);
    o.phase += dt * (1.15 + 2.7 * o.swim);
    if (o.bite > 0) o.bite = Math.max(0, o.bite - dt * 2.2);

    if (o.prey && !o.prey.isPlayer && o.prey.dead) o.prey = null;
    if (o.prey && !o.prey.isPlayer) {
      const t = o.prey;
      const reach = o.radius * 0.66 + t.radius * 0.5;
      if (A.dist2(o.x, o.y, t.x, t.y) < reach * reach) orcaEat(o, t);
    }

    // A Megalodon is not something an orca bites. It is something an orca
    // survives getting away from.
    if (p && G.state === 'playing' && p.art !== 'megalodon' &&
        G.sim >= o.attackAt && G.sim > p.invulnUntil) {
      const reach = o.radius * 0.6 + p.radius * 0.7;
      if (A.dist2(o.x, o.y, p.x, p.y) < reach * reach) {
        const toP = Math.atan2(p.y - o.y, p.x - o.x);
        if (Math.cos(toP - o.angle) > 0.2) {
          o.attackAt = G.sim + 2.2;
          o.threat = p;
          triggerBite(o, 1);
          damagePlayer(B.playerDamage, o);
          // One pass, then it arcs away instead of sitting on the player.
          if (o.prey === p) {
            o.prey = null;
            o.mode = 'retreat';
            o.retreatUntil = G.sim + A.rand(3.5, 6);
          }
        }
      }
    }

    // Orcas have to breathe. When the breath timer expires deep down, a
    // patrolling animal turns upward and surfaces - which is also how the
    // player hears about one before seeing it.
    if (G.sim >= o.breathAt) {
      if (o.y < 620) {
        o.breathAt = G.sim + A.rand(B.breathInterval * 0.7, B.breathInterval * 1.5);
        orcaSpout(o);
      } else if (o.mode === 'patrol') {
        o.targetX = A.clamp(o.x + A.rand(-400, 400), 400, W.w - 400);
        o.targetY = 250;
        o.wanderUntil = G.sim + 14;
        o.speedMul = B.patrolSpeed * 1.35;
        o.breathAt = G.sim + 4;
      } else {
        o.breathAt = G.sim + 3;
      }
    }
    o.fxTimer = (o.fxTimer || 0) - dt;
    if (o.fxTimer <= 0 && o.swim > 0.45) {
      o.fxTimer = 0.16;
      const back = o.angle + Math.PI;
      addParticle({
        type: 'bubble',
        x: o.x + Math.cos(back) * o.radius * 0.95 + A.rand(-8, 8),
        y: o.y + Math.sin(back) * o.radius * 0.95 + A.rand(-8, 8),
        vx: Math.cos(back) * A.rand(6, 26), vy: A.rand(-24, -6),
        size: A.rand(2.5, 6), life: 0.8, maxLife: 0.8
      });
    }
    if (G.sim - o.lastCall > A.rand(11, 19)) {
      o.lastCall = G.sim;
      const d = Math.sqrt(A.dist2(o.x, o.y, G.camera.x, G.camera.y));
      if (d < 2600) A.Audio.orcaCall(A.clamp(1 - d / 2600, 0, 1));
    }
  }

  function orcaSpout(o) {
    const vol = orcaSpoutVolume(o.x, o.y);
    if (vol <= 0) return;
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + A.rand(-0.5, 0.5);
      addParticle({
        type: 'spark', x: o.x + A.rand(-o.radius * 0.2, o.radius * 0.2), y: o.y - o.radius * 0.55,
        vx: Math.cos(a) * A.rand(30, 90), vy: Math.sin(a) * A.rand(60, 150),
        size: A.rand(1.6, 3.4), color: '#dff8ff', life: A.rand(0.5, 0.9), maxLife: 0.9
      });
    }
    spawnRing(o.x, o.y - o.radius * 0.5, 'rgba(210, 248, 255, 0.5)', o.radius * 0.3, 190, 0.7, 2);
    A.Audio.orcaBreath(vol);
  }

  function orcaEat(o, prey) {
    prey.dead = true;
    for (let i = 0; i < G.fishes.length; i++) {
      const other = G.fishes[i];
      if (other.prey === prey) other.prey = null;
      if (other.threat === prey) other.threat = null;
    }
    o.feedUntil = G.sim + A.ORCA_BEHAVIOR.feedTime;
    o.mode = 'feed';
    o.prey = null;
    o.think = 0;
    triggerBite(o, 1);

    const d2 = A.dist2(o.x, o.y, G.camera.x, G.camera.y);
    if (d2 < 1600 * 1600) {
      G.camera.shake = Math.min(1.2, G.camera.shake + 0.4);
      addPopup(prey.x, prey.y - 14, 'EATEN BY ORCA', '#ff8fa6', 1.15);
      spawnSparks(prey.x, prey.y, [prey.colors.body, '#ffffff'], 10, 150, 2.6);
      spawnRing(o.x, o.y, 'rgba(255,120,150,0.45)', o.radius * 0.8, o.radius * 1.6, 0.7, 3);
      A.Audio.orcaFeed(A.clamp(1 - Math.sqrt(d2) / 1600, 0.2, 1));
    }
  }

  function orcaSpoutVolume(x, y) {
    return A.clamp(1 - Math.sqrt(A.dist2(x, y, G.camera.x, G.camera.y)) / 2200, 0, 1);
  }

  // ------------------------------------------------------------------
  // Ink
  //
  // The octopus does not fight with a jaw, it fights with water you cannot
  // see through. A cloud is one object holding a dozen pre-baked puffs that
  // bloom outward on a cubic ease, shear on their own slow currents and then
  // thin until the sea clears. Damage lands on a fixed tick and every creature
  // is struck once per cloud, which is what makes an 11 second cooldown honest
  // against anything that has a health pool.
  //
  // The victim lookup goes through the shared fish grid, so it does not care
  // what kind of entity it finds: reef fish, the orca pod, and any player
  // record the net layer pushes into the same grid all take the same hit.
  // ------------------------------------------------------------------
  const INK_PUFFS = [];

  // Four variants, baked once. The density is built from overlapping soft
  // discs, then eroded at the border so the edge is filamentary instead of a
  // soft ball - that ragged margin is what reads as ink rather than smoke.
  function bakeInkPuffs() {
    for (let v = 0; v < 4; v++) {
      const S = 168;
      const cv = document.createElement('canvas');
      cv.width = S;
      cv.height = S;
      const g = cv.getContext('2d');
      const R = S * 0.5;
      g.translate(R, R);

      for (let i = 0; i < 44; i++) {
        const a = A.rand(0, TAU);
        const d = Math.pow(Math.random(), 0.6) * R * 0.56;
        const px = Math.cos(a) * d;
        const py = Math.sin(a) * d;
        const rr = R * A.rand(0.15, 0.44);
        const g2 = g.createRadialGradient(px, py, 0, px, py, rr);
        g2.addColorStop(0, 'rgba(11,10,20,0.09)');
        g2.addColorStop(0.6, 'rgba(9,7,17,0.05)');
        g2.addColorStop(1, 'rgba(9,7,17,0)');
        g.fillStyle = g2;
        g.beginPath();
        g.arc(px, py, rr, 0, TAU);
        g.fill();
      }

      const core = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.5);
      core.addColorStop(0, 'rgba(5,4,11,0.52)');
      core.addColorStop(0.55, 'rgba(9,6,17,0.24)');
      core.addColorStop(1, 'rgba(9,6,17,0)');
      g.fillStyle = core;
      g.beginPath();
      g.arc(0, 0, R * 0.5, 0, TAU);
      g.fill();

      // Sepia fringe: ink is not pure black, it is burnt umber in weak solution.
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 12; i++) {
        const a = A.rand(0, TAU);
        const d = R * A.rand(0.3, 0.72);
        const px = Math.cos(a) * d;
        const py = Math.sin(a) * d;
        const rr = R * A.rand(0.1, 0.26);
        const g2 = g.createRadialGradient(px, py, 0, px, py, rr);
        g2.addColorStop(0, 'rgba(52,34,58,0.055)');
        g2.addColorStop(1, 'rgba(52,34,58,0)');
        g.fillStyle = g2;
        g.beginPath();
        g.arc(px, py, rr, 0, TAU);
        g.fill();
      }

      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 20; i++) {
        const a = A.rand(0, TAU);
        const d = R * A.rand(0.4, 0.92);
        const px = Math.cos(a) * d;
        const py = Math.sin(a) * d;
        const rr = R * A.rand(0.09, 0.3);
        const g2 = g.createRadialGradient(px, py, 0, px, py, rr);
        g2.addColorStop(0, 'rgba(0,0,0,0.52)');
        g2.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = g2;
        g.beginPath();
        g.arc(px, py, rr, 0, TAU);
        g.fill();
      }
      // Streaks torn out of the mass as it spreads.
      g.strokeStyle = 'rgba(0,0,0,0.3)';
      g.lineWidth = R * 0.055;
      for (let i = 0; i < 6; i++) {
        const a = A.rand(0, TAU);
        g.beginPath();
        g.arc(Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2,
          R * A.rand(0.42, 0.78), a, a + A.rand(0.5, 1.5));
        g.stroke();
      }
      g.globalCompositeOperation = 'source-over';

      INK_PUFFS.push(cv);
    }
  }

  function inkPuff(i) {
    if (!INK_PUFFS.length) bakeInkPuffs();
    return INK_PUFFS[i % INK_PUFFS.length];
  }

  function castInk(p, ab) {
    const reach = p.radius * ab.ink;
    const c = {
      x: p.x,
      y: p.y,
      reach: reach,
      r: reach * 0.3,
      alpha: 0,
      owner: p,
      uid: ++G.inkUid,
      age: 0,
      life: A.INK.bloom + A.INK.life,
      tick: 0,
      hit: 0,
      shear: A.rand(-0.22, 0.22),
      puffs: []
    };
    for (let i = 0; i < A.INK.tendrils; i++) {
      c.puffs.push({
        a: A.rand(0, TAU),
        dist: A.rand(0.06, 0.5),
        grow: A.rand(0.55, 1.2),
        size: A.rand(0.36, 0.74),
        spin: A.rand(-0.45, 0.45),
        rot: A.rand(0, TAU),
        sway: A.rand(0.4, 1.3),
        wob: A.rand(0, TAU),
        puff: i % 4
      });
    }
    G.ink.push(c);
    // Oldest cloud goes first; the cap is what keeps the draw cost flat when
    // somebody spams the button on a low cooldown build.
    if (G.ink.length > 5) G.ink.shift();

    p.inkFlush = 1;
    A.Audio.inkBlast(reach);
    spawnRing(p.x, p.y, 'rgba(126,84,140,0.5)', p.radius * 0.5, reach * 0.95, 0.55, 3.4);
    spawnRing(p.x, p.y, 'rgba(20,12,28,0.4)', p.radius * 0.3, reach * 0.55, 0.4, 4);
    for (let i = 0; i < 14; i++) {
      const a = A.rand(0, TAU);
      const sp = A.rand(40, 190);
      addParticle({
        type: 'spark',
        x: p.x + Math.cos(a) * p.radius * 0.4, y: p.y + Math.sin(a) * p.radius * 0.4,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        size: A.rand(2, 5), color: '#241428',
        life: A.rand(0.35, 0.7), maxLife: 0.7
      });
    }
    showBanner('INK CLOUD', 'The water goes black around you', 1500);
    return c;
  }

  function updateInk(dt) {
    const p = G.player;
    if (p && p.inkFlush > 0) p.inkFlush = Math.max(0, p.inkFlush - dt * 0.45);

    for (let i = G.ink.length - 1; i >= 0; i--) {
      const c = G.ink[i];
      c.age += dt;
      if (c.age >= c.life) {
        G.ink.splice(i, 1);
        continue;
      }
      // Bloom fast, then keep creeping: ink does not stop the moment it is
      // fired, it keeps pushing outward on its own momentum.
      const b = Math.min(1, c.age / A.INK.bloom);
      const bloomEase = 1 - Math.pow(1 - b, 3);
      const creep = c.age > A.INK.bloom
        ? (c.age - A.INK.bloom) / A.INK.life
        : 0;
      c.r = c.reach * (0.3 + 0.7 * bloomEase) * (1 + creep * A.INK.spread);
      c.alpha = bloomEase * (1 - Math.pow(creep, 1.5));

      c.tick -= dt;
      if (c.tick <= 0) {
        c.tick = 0.3;
        inkStrike(c);
      }
    }
  }

  function inkStrike(c) {
    const reach = c.r * 0.8;
    const list = gridQuery(fishGrid, c.x, c.y, reach + 90);
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (f === c.owner || f.dead || f.hazard || f.inkHit === c.uid) continue;
      const rr = reach + f.radius * 0.7;
      if (A.dist2(f.x, f.y, c.x, c.y) > rr * rr) continue;
      f.inkHit = c.uid;
      applyInkDamage(f, c);
    }
    // The local player is not in the grid; a networked one, when there is a
    // net layer, arrives through the same victim path as everything else.
    const p = G.player;
    if (p && p !== c.owner && !p.dead && p.inkHit !== c.uid) {
      const rr = reach + p.radius * 0.7;
      if (A.dist2(p.x, p.y, c.x, c.y) < rr * rr) {
        p.inkHit = c.uid;
        applyInkDamage(p, c);
      }
    }
  }

  // The one place ink damage is applied. Anything with a health pool can be a
  // victim: a reef animal, an orca, the local player or a remote one, and the
  // percentage is always of that entity's own maximum.
  function applyInkDamage(victim, c) {
    const ab = c.owner && c.owner.ability ? c.owner.ability : A.ABILITIES.ink;
    const maxHp = victim.maxHealth || A.BASE_HEALTH;
    const amount = maxHp * (ab.sting || 0.2);
    const blind = ab.blind || 3.4;

    // Only the local player has a health bar, an i-frame clock and a screen to
    // flash. A remote player is a record in the fish list and takes the damage
    // exactly the way a reef animal does, so the copy on its own machine is the
    // thing that decides what that means.
    if (victim === G.player) {
      damagePlayer(amount, c.owner);
      addPopup(c.x, c.y - c.r * 0.4, '-20% HP', '#c9a6ff', 1.2);
      return;
    }

    victim.health = Math.max(0, (victim.health == null ? maxHp : victim.health) - amount);
    victim.smokedUntil = G.sim + blind;
    const wasHuntingPlayer = victim.prey === G.player;
    victim.prey = null;
    victim.threat = null;
    victim.foodRef = null;
    victim.think = 0;
    c.hit++;

    addPopup(victim.x, victim.y - victim.radius - 10, '-20% HP', '#c9a6ff', 1.1);
    spawnSparks(victim.x, victim.y, ['#2a1730', '#4b2a52', '#0d0713'], 9, 110, 2.4);
    A.Audio.inkHit(victim.radius);

    if (victim.predator) {
      // A smoked orca abandons the hunt it can no longer see, and gives the
      // water a wide berth until the sting leaves its eyes.
      if (G.orcaHunter === victim) G.orcaHunter = null;
      victim.mode = 'retreat';
      victim.retreatUntil = G.sim + blind;
      if (wasHuntingPlayer) victim.ignorePlayerUntil = G.sim + blind;
    }

    if (victim.health <= 0) inkKill(victim);
  }

  function inkKill(f) {
    f.dead = true;
    if (G.orcaHunter === f) G.orcaHunter = null;
    if (G.fishHunter === f) G.fishHunter = null;
    for (let i = 0; i < G.fishes.length; i++) {
      const other = G.fishes[i];
      if (other.prey === f) other.prey = null;
      if (other.threat === f) other.threat = null;
    }
    addPopup(f.x, f.y - f.radius - 12, 'DOUSED', '#8f5fa8', 1.25);
    spawnSparks(f.x, f.y, ['#1b0f22', '#3a2140', '#0a0710'], 16, 140, 3);
    spawnRing(f.x, f.y, 'rgba(40,22,46,0.5)', f.radius * 0.6, f.radius * 3.4, 0.5, 2.6);
    // The reef gets the meal: ink does not hand you XP, it hands you prey.
    const drops = f.tier >= 5 ? 3 : 2;
    for (let i = 0; i < drops; i++) {
      spawnFoodAt(f.x + A.rand(-f.radius, f.radius), f.y + A.rand(-f.radius * 0.7, f.radius * 0.7));
    }
  }

  // ------------------------------------------------------------------
  // The trident: what leaves the mouth, and what comes back
  // ------------------------------------------------------------------
  // A cast is one record in one pool, exactly like an ink cloud. It flies, it
  // hits once, it turns around and it is swallowed again by the jaws it came
  // from, and the two-second cooldown starts at the cast rather than at the
  // return, so the flight always finishes inside the wait.
  //
  // The victim path is shared: anything with a health pool can be hit - a reef
  // animal, an orca, the local player, or a remote player record that the net
  // layer pushed into fishGrid with its own `weapon` and health. Nothing here
  // knows or cares which.
  function syncWeapon() {
    const p = G.player;
    if (!p) return;
    const stage = A.STAGES[p.stageIndex];
    // Every evolution past the anglerfish grows its own shuriken; the angler
    // itself does not have one. It is not bought, so no shop state can take
    // it away, but a bought trident still wins the jaws when one is equipped.
    const anglerAt = A.stageByKey ? A.stageByKey('angler') : 4;
    const innate = p.stageIndex > anglerAt ? 'abyss_shuriken' : null;
    const bought = A.Shop ? A.Shop.heldFor(stage && stage.key) : null;
    const held = bought || innate;
    if (p.weapon !== held) p.weapon = held;
    const skin = A.Shop && A.Shop.activeSlot ? A.Shop.activeSlot('skin') : null;
    if (p.weaponSkin !== skin) p.weaponSkin = skin;
  }

  // The nearest animal roughly ahead of the nose. Aiming is deliberately
  // generous: a cast that always flew at whatever you were swimming towards is
  // more fun than one that needs a crosshair, and the trident is a jaw weapon,
  // not a sniper.
  function shotTarget(p) {
    const reach = A.SHOT.reach + p.radius;
    const list = gridQuery(fishGrid, p.x, p.y, reach);
    let best = null, bestScore = Infinity;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (f === p || f.dead || f.hazard) continue;
      const dx = f.x - p.x, dy = f.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > reach * reach) continue;
      const off = Math.abs(A.angleDiff(p.angle, Math.atan2(dy, dx)));
      if (off > A.SHOT.aim) continue;
      const score = d2 * (1 + off * 1.8);
      if (score < bestScore) { bestScore = score; best = f; }
    }
    return best;
  }

  // Poseidon in the jaws. The spear never leaves the mouth: the animal throws
  // itself forward behind it, and whatever the tines touch dies. Returns false
  // only when there is no trident, so SPACE can still trigger the species
  // ability while a shuriken is equipped (the shuriken uses E instead).
  function tridentCharge() {
    const p = G.player;
    if (!p || p.dead || G.state !== 'playing' || !p.weapon || p.weapon === 'abyss_shuriken') return false;
    // On cooldown the key still belongs to the weapon; it just does nothing.
    if (G.sim < G.chargeReadyAt) return true;

    const ch = A.TRIDENT_CHARGE;
    p.chargeUntil = G.sim + ch.duration;
    p.chargeUid = (p.chargeUid || 0) + 1;
    p.chargeFxTimer = 0;
    p.bite = Math.max(p.bite || 0, 0.8);
    // The ram must not be a trade. Through the surge and a hair past it, the
    // animal cannot be hurt, so an orca gets skewered instead of biting first.
    p.invulnUntil = Math.max(p.invulnUntil || 0, p.chargeUntil + 0.12);
    G.chargeReadyAt = G.sim + ch.cooldown;

    const from = A.Weapons.mouthPoint(p);
    G.camera.shake = Math.min(1, G.camera.shake + 0.22);
    spawnSparks(from.x, from.y, ['#7ff0d8', '#bfe9ff', '#ffffff'], 10, 160, 2.2);
    spawnRing(from.x, from.y, 'rgba(127,240,216,0.55)', p.radius * 0.3, p.radius * 3.4, 0.3, 2.2);
    if (A.Audio && A.Audio.dash) A.Audio.dash();
    return true;
  }

  function castShot() {
    const p = G.player;
    if (!p || p.dead || G.state !== 'playing' || !p.weapon) return false;
    if (G.sim < G.shotReadyAt) return false;

    const target = shotTarget(p);
    const from = A.Weapons.mouthPoint(p);
    const angle = target ? Math.atan2(target.y - from.y, target.x - from.x) : p.angle;
    G.shots.push({
      uid: ++G.shotUid,
      key: p.weapon,
      owner: p,
      target: target,
      x: from.x, y: from.y,
      angle: angle,
      age: 0,
      hit: 0,
      phase: 'out',
      radius: Math.max(10, p.radius * 0.44),
      trail: 0
    });
    G.shotReadyAt = G.sim + A.SHOT.cooldown;
    triggerBite(p, 1);
    G.camera.shake = Math.min(1, G.camera.shake + 0.22);
    spawnSparks(from.x, from.y, ['#7ff0d8', '#bfe9ff', '#ffffff'], 10, 190, 2.2);
    spawnRing(from.x, from.y, 'rgba(127,240,216,0.55)', p.radius * 0.3, p.radius * 4.6, 0.34, 2.2);
    if (A.Audio && A.Audio.tridentCast) A.Audio.tridentCast(p.radius);
    return true;
  }

  function updateShots(dt) {
    for (let i = G.shots.length - 1; i >= 0; i--) {
      const s = G.shots[i];
      const p = s.owner;
      s.age += dt;

      // An owner lost to the reef takes its weapon to the bottom with it.
      if (!p || p.dead || G.state !== 'playing') { G.shots.splice(i, 1); continue; }

      if (s.phase === 'out') {
        // Keep tracking while the target is still there, so a cast at a fish
        // that darts sideways still connects, then fly straight once it is not.
        if (s.target && !s.target.dead) {
          const want = Math.atan2(s.target.y - s.y, s.target.x - s.x);
          s.angle = A.angleLerp(s.angle, want, Math.min(1, dt * 5.5));
        }
        s.x += Math.cos(s.angle) * A.SHOT.speed * dt;
        s.y += Math.sin(s.angle) * A.SHOT.speed * dt;
        if (shotStrike(s) || s.age >= A.SHOT.life) s.phase = 'back';
      } else {
        const mouth = A.Weapons.mouthPoint(p);
        const dx = mouth.x - s.x, dy = mouth.y - s.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < Math.max(10, p.radius * 0.22) || s.age > A.SHOT.life + 1.6) {
          // Back in the jaws: snap them shut on it.
          p.bite = Math.max(p.bite || 0, 0.55);
          spawnSparks(mouth.x, mouth.y, ['#7ff0d8', '#cfeaf5'], 5, 90, 1.8);
          G.shots.splice(i, 1);
          continue;
        }
        const sp = A.SHOT.speed * 1.2;
        s.angle = Math.atan2(dy, dx);
        s.x += dx / d * sp * dt;
        s.y += dy / d * sp * dt;
      }

      // A short wake, capped by the pool's own particle budget.
      s.trail -= dt;
      if (s.trail <= 0 && G.quality >= 0.5) {
        s.trail = 0.045;
        addParticle({
          type: 'scale', x: s.x, y: s.y,
          vx: A.rand(-14, 14), vy: A.rand(-14, 14),
          rot: s.angle, vr: A.rand(-2, 2),
          size: A.rand(1.6, 3.4), color: '#7ff0d8',
          life: A.rand(0.22, 0.4), maxLife: 0.4
        });
      }
    }
  }

  // One hit per cast, and the uid guard is what makes it one: an animal already
  // struck by this exact trident cannot be struck by it again on the way back.
  function shotStrike(s) {
    const reach = s.radius * 1.15;
    const list = gridQuery(fishGrid, s.x, s.y, reach + 70);
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (f === s.owner || f.dead || f.hazard || f.shotHit === s.uid) continue;
      const rr = reach + f.radius * 0.8;
      if (A.dist2(f.x, f.y, s.x, s.y) > rr * rr) continue;
      f.shotHit = s.uid;
      applyShotDamage(f, s);
      return true;
    }
    const p = G.player;
    if (p && p !== s.owner && !p.dead && p.shotHit !== s.uid) {
      const rr = reach + p.radius * 0.8;
      if (A.dist2(p.x, p.y, s.x, s.y) < rr * rr) {
        p.shotHit = s.uid;
        applyShotDamage(p, s);
        return true;
      }
    }
    return false;
  }

  // The one place trident damage is applied, and the shape is the ink cloud's:
  // the percentage is always of the victim's own maximum, and only the local
  // player has a health bar, i-frames and a screen to flash.
  function applyShotDamage(victim, s, fraction) {
    const maxHp = victim.maxHealth || A.BASE_HEALTH;
    const amount = fraction != null
      ? Math.max(10, maxHp * fraction)
      : Math.max(A.SHOT.floor, maxHp * A.SHOT.pierce);
    s.hit++;

    if (victim === G.player) {
      damagePlayer(amount, s.owner);
      addPopup(s.x, s.y - 16, '-' + Math.round(amount), '#ff8f6a', 1.25);
      impactShot(s);
      return;
    }

    victim.health = Math.max(0, (victim.health == null ? maxHp : victim.health) - amount);
    victim.stunnedUntil = Math.max(victim.stunnedUntil || 0, G.sim + A.SHOT.stun);
    victim.prey = null;
    victim.threat = null;
    victim.foodRef = null;
    victim.think = 0;

    addPopup(victim.x, victim.y - victim.radius - 10, '-' + Math.round(amount), '#ffd08a', 1.15);
    impactShot(s);
    if (victim.predator) {
      if (G.orcaHunter === victim) G.orcaHunter = null;
      victim.mode = 'retreat';
      victim.retreatUntil = G.sim + A.SHOT.stun * 2;
    }
    if (victim.health <= 0) shotKill(victim, s);
  }

  function impactShot(s) {
    G.camera.shake = Math.min(1.2, G.camera.shake + 0.3);
    spawnSparks(s.x, s.y, ['#7ff0d8', '#ffd08a', '#ffffff'], 14, 210, 2.8);
    spawnRing(s.x, s.y, 'rgba(127,240,216,0.7)', s.radius * 0.5, s.radius * 6.5, 0.36, 2.6);
    if (A.Audio && A.Audio.tridentHit) A.Audio.tridentHit(s.radius);
  }

  // A predator carries the XP it has hunted up for itself, and killing one
  // pays a third of that - the same cut a death takes out of a run - with the
  // old flat bounty as the floor so a fresh spawn is never worthless. The
  // payment lands in run XP, which is what the leaderboard reads and what the
  // account banks when the dive ends.
  function predatorBounty(f) {
    return Math.max(A.PREDATOR_XP, Math.floor((f.xp | 0) / 3));
  }

  // A trident kill is a kill: the animal is gone, the reef gets the meal, and
  // the thrower is paid on the same curve a bite would have used.
  function shotKill(f, s) {
    f.dead = true;
    if (G.orcaHunter === f) G.orcaHunter = null;
    if (G.fishHunter === f) G.fishHunter = null;
    for (let i = 0; i < G.fishes.length; i++) {
      const other = G.fishes[i];
      if (other.prey === f) other.prey = null;
      if (other.threat === f) other.threat = null;
    }
    const p = s.owner;
    if (p && p.isPlayer) {
      const baseGain = f.predator ? predatorBounty(f) : Math.round(18 + f.tier * 16 + f.radius * 0.35);
      const gain = baseGain * (p.stageIndex < A.ANGLER_TIER ? 4 : 1);
      p.xp += gain;
      G.eaten++;
      if (A.Quests) A.Quests.eatFish(f);
      addPopup(f.x, f.y - f.radius - 14,
        (f.predator ? (f.name || 'PREDATOR').toUpperCase() + ' SLAIN' : 'IMPALED') + ' +' + gain + ' XP',
        f.predator ? '#ff7a7a' : '#ffe08a', f.predator ? 1.6 : 1.35);
    } else {
      addPopup(f.x, f.y - f.radius - 14, 'IMPALED', '#ffd08a', 1.2);
    }
    spawnSparks(f.x, f.y, [f.colors ? f.colors.body : '#2a3f4d', '#7ff0d8', '#ffffff'], 16, 220, 3.2);
    spawnRing(f.x, f.y, 'rgba(255,208,138,0.55)', f.radius * 0.5, f.radius * 7, 0.42, 2.4);
    const drops = f.tier >= 5 ? 3 : 2;
    for (let i = 0; i < drops; i++) {
      spawnFoodAt(f.x + A.rand(-f.radius, f.radius), f.y + A.rand(-f.radius * 0.7, f.radius * 0.7));
    }
  }

  function drawShots(ctx, view) {
    if (!G.shots.length || !A.Weapons) return;
    const cheap = G.quality < 0.9;
    for (let i = 0; i < G.shots.length; i++) {
      const s = G.shots[i];
      if (!inView(s.x, s.y, s.radius * 4, view)) continue;
      const def = A.Weapons.get(s.key) || A.Weapons.TRIDENT;

      // The wake: one stretched streak rather than a particle storm, because
      // the read you need is direction, not sparkle.
      ctx.save();
      ctx.globalAlpha = 0.24;
      ctx.strokeStyle = '#7ff0d8';
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.5, s.radius * 0.22);
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(s.angle) * s.radius * 3.4, s.y - Math.sin(s.angle) * s.radius * 3.4);
      ctx.lineTo(s.x - Math.cos(s.angle) * s.radius * 0.4, s.y - Math.sin(s.angle) * s.radius * 0.4);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      if (Math.cos(s.angle) < 0) ctx.scale(1, -1);
      ctx.scale(s.radius, s.radius);
      // Balance the weapon on its own midpoint so the point leads the flight.
      ctx.translate(-0.22, 0);
      A.Weapons.painter(s.key)(ctx, { colors: def.palette, pulse: s.uid }, G.sim, cheap);
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------
  // The Abyss Shuriken (shark and every evolution above it)
  // ------------------------------------------------------------------
  // Thrown up out of the jaws, it spins, and it takes a third of whatever it
  // touches. The victim path is the trident's own, so a reef animal, an orca
  // or a remote player record all take the same percentage of their maximum.
  const SHURIKEN = {
    cooldown: 0.9,
    speed: 980,
    lift: 130,
    gravity: 420,
    life: 1.3,
    spin: 17,
    damage: 1 / 3
  };

  function throwShuriken() {
    const p = G.player;
    if (!p || p.dead || G.state !== 'playing' || p.weapon !== 'abyss_shuriken') return false;
    // On cooldown the key still belongs to the weapon.
    if (G.sim < G.shurikenReadyAt) return true;

    const from = A.Weapons.mouthPoint(p);
    G.shuriken.push({
      uid: ++G.shurikenUid,
      owner: p,
      x: from.x,
      y: from.y,
      vx: Math.cos(p.angle) * SHURIKEN.lift,
      vy: -SHURIKEN.speed,
      spin: 0,
      age: 0,
      hit: 0,
      radius: Math.max(9, p.radius * 0.34)
    });
    G.shurikenReadyAt = G.sim + SHURIKEN.cooldown;
    triggerBite(p, 0.7);
    G.camera.shake = Math.min(1, G.camera.shake + 0.14);
    spawnSparks(from.x, from.y, ['#7ff0d8', '#d8fff9', '#ffffff'], 9, 170, 2.0);
    spawnRing(from.x, from.y, 'rgba(127,240,216,0.5)', p.radius * 0.2, p.radius * 3.0, 0.3, 2.0);
    if (A.Audio && A.Audio.tridentCast) A.Audio.tridentCast(p.radius * 0.7);
    return true;
  }

  function updateShuriken(dt) {
    if (!G.shuriken.length) return;
    for (let i = G.shuriken.length - 1; i >= 0; i--) {
      const s = G.shuriken[i];
      s.age += dt;
      if (!s.owner || s.owner.dead || G.state !== 'playing') {
        G.shuriken.splice(i, 1);
        continue;
      }
      s.vy += SHURIKEN.gravity * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.spin += SHURIKEN.spin * dt;

      if (G.quality >= 0.5 && (s.age * 60 | 0) % 3 === 0) {
        addParticle({
          type: 'scale', x: s.x, y: s.y,
          vx: A.rand(-20, 20), vy: A.rand(-10, 30),
          rot: s.spin, vr: A.rand(-3, 3),
          size: A.rand(1.4, 2.8), color: '#8ff2e0',
          life: A.rand(0.16, 0.3), maxLife: 0.3
        });
      }

      if (shurikenStrike(s) || s.age >= SHURIKEN.life) {
        G.shuriken.splice(i, 1);
      }
    }
  }

  function shurikenStrike(s) {
    const reach = s.radius;
    const list = gridQuery(fishGrid, s.x, s.y, reach + 90);
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (f === s.owner || f.dead || f.hazard || f.shurikenHit === s.uid) continue;
      const rr = reach + f.radius * 0.85;
      if (A.dist2(f.x, f.y, s.x, s.y) > rr * rr) continue;
      f.shurikenHit = s.uid;
      applyShotDamage(f, s, SHURIKEN.damage);
      return true;
    }
    return false;
  }

  function drawShuriken(ctx, view) {
    if (!G.shuriken.length || !A.Weapons) return;
    const paint = A.Weapons.painter ? A.Weapons.painter('abyss_shuriken') : null;
    const def = A.Weapons.get ? A.Weapons.get('abyss_shuriken') : null;
    if (!paint || !def) return;
    const cheap = G.quality < 0.9;
    for (let i = 0; i < G.shuriken.length; i++) {
      const s = G.shuriken[i];
      if (!inView(s.x, s.y, s.radius * 3, view)) continue;

      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = '#7ff0d8';
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.4, s.radius * 0.24);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y + s.radius * 3.2);
      ctx.lineTo(s.x, s.y + s.radius * 0.4);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.spin);
      // The painter's blades reach 0.215 of its own unit, so the visual scale
      // is that inverse: the star on screen is about as wide as its hit box.
      ctx.scale(s.radius * 4.4, s.radius * 4.4);
      paint(ctx, { colors: def.palette, pulse: s.uid }, G.sim, cheap);
      ctx.restore();
    }
  }

  function drawInk(ctx, view) {
    if (!G.ink.length) return;
    if (!INK_PUFFS.length) bakeInkPuffs();
    const cheap = G.quality < 0.9;

    // Multiply is what makes this read as ink instead of grey smoke: the
    // cloud removes light from the water behind it rather than sitting on top.
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    for (let i = 0; i < G.ink.length; i++) {
      const c = G.ink[i];
      if (c.x + c.r < view.x || c.x - c.r > view.x + view.w ||
        c.y + c.r < view.y || c.y - c.r > view.y + view.h) continue;
      const n = cheap ? 6 : c.puffs.length;
      for (let k = 0; k < n; k++) {
        const pf = c.puffs[k];
        const drift = pf.dist + (c.age / c.life) * A.INK.spread * pf.grow;
        const a = pf.a + c.shear * (c.age / c.life) * pf.sway +
          Math.sin(G.sim * 0.5 + pf.wob) * 0.08;
        const x = c.x + Math.cos(a) * c.r * drift;
        const y = c.y + Math.sin(a) * c.r * drift * 0.82;
        const s = c.r * pf.size * 2 * (1 + c.age / c.life * 0.45);
        ctx.globalAlpha = Math.min(1, c.alpha * (0.72 + 0.28 * pf.grow));
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(pf.rot + c.age * pf.spin);
        ctx.drawImage(inkPuff(pf.puff), -s * 0.5, -s * 0.5, s, s);
        ctx.restore();
      }
    }
    ctx.restore();

    // The bruised rim where the ink meets clear water.
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < G.ink.length; i++) {
      const c = G.ink[i];
      if (c.alpha < 0.12) continue;
      if (c.x + c.r < view.x || c.x - c.r > view.x + view.w ||
        c.y + c.r < view.y || c.y - c.r > view.y + view.h) continue;
      ctx.globalAlpha = c.alpha * A.INK.residue * 0.5;
      ctx.strokeStyle = 'rgba(96,58,110,0.9)';
      ctx.lineWidth = Math.max(1.5, c.r * 0.03);
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.r, c.r * 0.86, Math.sin(G.sim * 0.3 + c.uid) * 0.2, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // A dosed animal wears the ink: three or four blobs riding its flank until
  // the cloud clears, so you can see which animals you have already marked.
  function drawSmokedMarks(ctx, f) {
    const remain = (f.smokedUntil || 0) - G.sim;
    if (remain <= 0) return;
    const a = A.clamp(remain / 1.2, 0, 1) * 0.55;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#150c1c';
    for (let i = 0; i < 4; i++) {
      const t = i / 4 * TAU + f.seed;
      ctx.beginPath();
      ctx.ellipse(f.x + Math.cos(t) * f.radius * 0.55,
        f.y + Math.sin(t) * f.radius * 0.45,
        f.radius * (0.2 + 0.06 * i), f.radius * 0.14, t, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function updateAI(dt) {
    const fishes = G.fishes;
    const cx = G.camera.x;
    const cy = G.camera.y;

    for (let i = 0; i < fishes.length; i++) {
      const ai = fishes[i];
      if (ai.dead) continue;
      ai._near = A.dist2(ai.x, ai.y, cx, cy) < G.activeR2;

      // A medusa does not think, hunt, flee, feed or get stunned. It pulses,
      // and the pulse is the only thing that moves it: contract, lurch up,
      // relax, sink a little, and let the current carry it sideways. Net
      // vertical travel over a beat is close to zero, so they stay in band.
      if (ai.hazard) {
        ai.phase += dt * ai.pulseRate;
        const beat = Math.max(0, Math.sin(ai.phase));
        ai.speedSmooth = ai.cruise * (0.25 + beat * 0.85);
        ai.swim = 0.3 + beat * 0.7;
        ai.y -= (beat - 0.33) * ai.cruise * 1.7 * dt;
        ai.x += ai.driftX * dt;
        ai.angle = A.angleDamp(ai.angle, ai.driftX > 0 ? 0 : Math.PI, 0.5, dt);
        ai.x = A.clamp(ai.x, W.margin + 60, W.w - W.margin - 60);
        ai.y = A.clamp(ai.y, 300, floorTop(ai.x) - 70);
        if (G.sim > ai.turnAt) {
          ai.driftX = A.rand(-15, 15);
          ai.turnAt = G.sim + A.rand(8, 21);
        }
        continue;
      }

      if (ai.predator) {
        if (ai._near) updateOrca(ai, dt);
        else orcaIdle(ai, dt);
        continue;
      }

      // Off-screen fish still swim, but they do not scan for threats, chase,
      // or get pushed by separation. On a 14000x9600 map most fish are
      // always off-screen, and that is what keeps the bigger ocean cheap.
      if (!ai._near) {
        ai.angle = A.angleDamp(ai.angle, ai.targetAngle, ai.turnRate, dt);
        ai.speedSmooth = A.damp(ai.speedSmooth, ai.cruise * ai.speedMul, 3.2, dt);
        ai.x += Math.cos(ai.angle) * ai.speedSmooth * dt;
        ai.y += Math.sin(ai.angle) * ai.speedSmooth * dt;
        ai.x = A.clamp(ai.x, W.margin, W.w - W.margin);
        ai.y = A.clamp(ai.y, W.margin, ceilingAt(ai.x, ai.radius));
        ai.swim = A.clamp(ai.speedSmooth / Math.max(40, ai.cruise), 0, 1.4);
        ai.phase += dt * (2.6 + 6 * ai.swim);
        ai.hunger = Math.max(0, ai.hunger - dt * 0.22);
        if (ai.think <= -6) { ai.think = A.rand(0.4, 1.6); aiThinkFar(ai); }
        else ai.think -= dt;
        continue;
      }

      // Apex Terror: a fish caught in the roar holds station. It still sinks
      // a little, still flicks its tail in a panic, and still gets shoved by
      // separation, but it stops thinking, fleeing, hunting and feeding.
      if (G.sim < (ai.stunnedUntil || 0)) {
        ai.speedSmooth = A.damp(ai.speedSmooth, ai.cruise * 0.05, 6, dt);
        ai.x += Math.cos(ai.angle) * ai.speedSmooth * dt;
        ai.y += Math.sin(ai.angle) * ai.speedSmooth * dt + Math.sin(G.sim * 2.4 + ai.seed) * 7 * dt;
        ai.x = A.clamp(ai.x, W.margin, W.w - W.margin);
        ai.y = A.clamp(ai.y, W.margin, ceilingAt(ai.x, ai.radius));
        ai.swim = 0.05;
        ai.phase += dt * 11;
        if (ai.bite > 0) ai.bite = Math.max(0, ai.bite - dt * 3.6);
        ai.hunger = Math.max(0, ai.hunger - dt * 0.22);
        continue;
      }

      ai.think -= dt;
      if (ai.think <= 0) aiThink(ai);

      let targetAngle = ai.targetAngle;
      const p = G.player;
      // Hard cap: even a fish that has not run a think cycle since the clock
      // ran out cannot keep steering at the player. The five seconds are a
      // contract, not a suggestion.
      if (ai.mode === 'huntPlayer' && p && G.state === 'playing' &&
        (G.sim >= (ai.playerChaseUntil || 0) ||
          A.dist2(ai.x, ai.y, p.x, p.y) > A.FISH_BEHAVIOR.chaseGiveUp * A.FISH_BEHAVIOR.chaseGiveUp)) {
        giveUpPlayerChase(ai, p);
      }
      const recoiling = G.sim < (ai.recoilUntil || 0);
      if (ai.mode === 'huntPlayer' && p && G.state === 'playing') {
        targetAngle = recoiling
          ? Math.atan2(ai.y - p.y, ai.x - p.x)
          : Math.atan2(p.y - ai.y, p.x - ai.x);
      } else if (ai.mode === 'huntPrey' && ai.prey && !ai.prey.dead) {
        targetAngle = Math.atan2(ai.prey.y - ai.y, ai.prey.x - ai.x);
      } else if (ai.mode === 'seekFood' && ai.foodRef && !ai.foodRef.dead) {
        targetAngle = Math.atan2(ai.foodRef.y - ai.y, ai.foodRef.x - ai.x);
      }
      targetAngle += Math.sin(G.sim * 1.6 + ai.seed) * 0.16;

      const m = W.margin + 40;
      if (ai.x < m || ai.x > W.w - m || ai.y < m || ai.y > floorTop(ai.x) - m) {
        targetAngle = Math.atan2(W.h / 2 - ai.y, W.w / 2 - ai.x) + Math.sin(G.sim * 2 + ai.seed) * 0.3;
      }

      ai.angle = A.angleDamp(ai.angle, targetAngle, ai.turnRate, dt);
      let desired = ai.cruise * ai.speedMul * (1 + Math.sin(G.sim * 2.2 + ai.seed) * 0.05);
      if (ai.mode === 'huntPlayer' && p && !recoiling) {
        desired = Math.min(desired, p.speed * 0.88);
      }
      ai.speedSmooth = A.damp(ai.speedSmooth, desired, 3.2, dt);

      ai.x += Math.cos(ai.angle) * ai.speedSmooth * dt;
      ai.y += Math.sin(ai.angle) * ai.speedSmooth * dt;
      ai.x = A.clamp(ai.x, W.margin, W.w - W.margin);
      ai.y = A.clamp(ai.y, W.margin, ceilingAt(ai.x, ai.radius));

      ai.swim = A.clamp(ai.speedSmooth / Math.max(40, ai.cruise), 0, 1.4);
      // Big ambush predators swing a slow, heavy tail; everything else flicks.
      // A manta flies on two deep strokes, so it keeps the slow clock too.
      const slowBeat = ai.stageIndex === A.SHARK_TIER || ai.stageIndex === A.ANGLER_TIER ||
        ai.stageIndex === A.MANTA_TIER;
      ai.phase += dt * (slowBeat ? 1.8 + 4.2 * ai.swim : 2.6 + 6 * ai.swim);
      if (ai.bite > 0) ai.bite = Math.max(0, ai.bite - dt * 3.6);
      ai.hunger = Math.max(0, ai.hunger - dt * 0.22);

      if (ai.foodRef) {
        const f = ai.foodRef;
        if (f.dead) {
          ai.foodRef = null;
          ai.think = 0;
        } else {
          const reach = ai.radius * 0.7 + f.r + 7;
          if (A.dist2(ai.x, ai.y, f.x, f.y) < reach * reach) consumeFoodAI(ai, f);
        }
      }

      if (ai.prey) {
        const prey = ai.prey;
        if (prey.dead) {
          ai.prey = null;
        } else if (prey.radius < ai.radius * 0.88) {
          const reach = ai.radius * 0.72 + prey.radius * 0.5;
          if (A.dist2(ai.x, ai.y, prey.x, prey.y) < reach * reach) eatPreyAI(ai, prey);
        } else {
          ai.prey = null;
        }
      }

      if (p && G.state === 'playing' && ai.radius > p.radius * 1.12 &&
        G.sim >= ai.attackAt && G.sim > p.invulnUntil) {
        const reach = ai.radius * 0.55 + p.radius * 0.62;
        if (A.dist2(ai.x, ai.y, p.x, p.y) < reach * reach) {
          const toPlayer = Math.atan2(p.y - ai.y, p.x - ai.x);
          if (Math.cos(toPlayer - ai.angle) > 0.05) {
            ai.attackAt = G.sim + A.rand(1.15, 1.5);
            damagePlayer(6 + ai.tier * 4 + ai.radius * 0.12, ai);
          }
        }
      }
    }

    separateFish();
  }

  // An orca far from the camera keeps cruising without running its state
  // machine, so a third predator costs almost nothing until it comes near.
  function orcaIdle(o, dt) {
    o.think -= dt;
    if (o.think <= -3) {
      o.think = A.rand(0.6, 1.4);
      if (!o.wanderUntil || G.sim > o.wanderUntil) {
        o.targetX = A.clamp(o.x + A.rand(-2600, 2600), 400, W.w - 400);
        o.targetY = bandY([0.4, 0.96]);
        o.wanderUntil = G.sim + A.rand(10, 20);
      }
      o.targetAngle = Math.atan2(o.targetY - o.y, o.targetX - o.x);
    }
    o.angle = A.angleDamp(o.angle, o.targetAngle, o.turnRate * 0.7, dt);
    o.speedSmooth = A.damp(o.speedSmooth, o.cruise * A.ORCA_BEHAVIOR.patrolSpeed, 1.2, dt);
    o.x += Math.cos(o.angle) * o.speedSmooth * dt;
    o.y += Math.sin(o.angle) * o.speedSmooth * dt;
    const bm = W.margin + 70;
    o.x = A.clamp(o.x, bm, W.w - bm);
    o.y = A.clamp(o.y, bm, ceilingAt(o.x, o.radius));
    o.swim = A.clamp(o.speedSmooth / Math.max(60, o.cruise), 0.18, 1.6);
    o.phase += dt * (1.15 + 2.7 * o.swim);
    if (o.bite > 0) o.bite = Math.max(0, o.bite - dt * 2.2);
    o.bank = A.damp(o.bank, 0, 2, dt);
  }

  // Cheap re-target for fish the player will not see this second: drift toward
  // a new point in their depth band instead of running a full threat scan.
  function aiThinkFar(ai) {
    if (ai.mode === 'huntPlayer' || ai.mode === 'huntPrey') {
      if (G.fishHunter === ai) G.fishHunter = null;
      ai.prey = null;
      ai.mode = 'wander';
    }
    if (!ai.wanderUntil || G.sim > ai.wanderUntil ||
      A.dist2(ai.x, ai.y, ai.targetX, ai.targetY) < 120 * 120) {
      ai.targetX = A.clamp(ai.x + A.rand(-900, 900), 220, W.w - 220);
      ai.targetY = bandY(TIER_BANDS[ai.stageIndex]);
      ai.wanderUntil = G.sim + A.rand(4, 10);
      ai.speedMul = ai.stageIndex === A.SAW_TIER ? 0.8 : ai.stageIndex === A.MANTA_TIER ? 0.7 : ai.stageIndex === A.SHARK_TIER ? 0.62 : 0.5;
    }
    ai.targetAngle = Math.atan2(ai.targetY - ai.y, ai.targetX - ai.x);
  }

  function separateFish() {
    const list = G.fishes;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.dead || !a._near) continue;
      const cand = gridQuery(fishGrid, a.x, a.y, a.radius + 60);
      for (let k = 0; k < cand.length; k++) {
        const b = cand[k];
        if (b === a || b.dead || !b._near) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = (a.radius + b.radius) * 0.7;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.001 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const push = (min - d) * 0.25;
          const nx = dx / d;
          const ny = dy / d;
          // Mass follows size, so a reef fish swimming into an orca's flank
          // deflects itself and not the whale.
          const ma = a.radius * a.radius;
          const mb = b.radius * b.radius;
          const share = ma / (ma + mb);
          a.x -= nx * push * (1 - share) * 2;
          a.y -= ny * push * (1 - share) * 2;
          b.x += nx * push * share * 2;
          b.y += ny * push * share * 2;
        }
      }
    }
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (f.dead) continue;
      f.x = A.clamp(f.x, W.margin, W.w - W.margin);
      f.y = A.clamp(f.y, W.margin, ceilingAt(f.x, f.radius));
    }
  }

  // Removal is deferred: entities flag themselves dead and the arrays are
  // compacted once per frame. Splicing mid-iteration used to shift an index
  // the loop had not reached yet, which integrated one fish twice.
  function compactArrays() {
    let w = 0;
    for (let i = 0; i < G.fishes.length; i++) {
      if (!G.fishes[i].dead) G.fishes[w++] = G.fishes[i];
    }
    G.fishes.length = w;

    w = 0;
    for (let i = 0; i < G.foods.length; i++) {
      if (!G.foods[i].dead) G.foods[w++] = G.foods[i];
    }
    G.foods.length = w;
  }

  function consumeFoodAI(ai, f) {
    f.dead = true;
    ai.hunger = Math.min(100, ai.hunger + 8);
    ai.xp += Math.round(f.xp * 0.6);
    ai.foodRef = null;
    ai.think = 0;
    triggerBite(ai, 0.6);
    spawnSparks(f.x, f.y, [A.FOOD[f.kind].color, '#ffffff'], 3, 50, 1.6);
  }

  function eatPreyAI(ai, prey) {
    prey.dead = true;
    for (let i = 0; i < G.fishes.length; i++) {
      if (G.fishes[i].prey === prey) G.fishes[i].prey = null;
    }
    ai.hunger = Math.min(100, ai.hunger + 16);
    ai.xp += 30 + prey.tier * 22;
    ai.radius = Math.min(ai.baseRadius * 1.35, ai.radius * 1.02);
    ai.prey = null;
    ai.think = 0;
    triggerBite(ai, 1);
    spawnSparks(prey.x, prey.y, [prey.colors.body, prey.colors.fin, '#ffffff'], 8, 100, 2.2);
  }

  // ------------------------------------------------------------------
  // Player interactions with food and fish
  // ------------------------------------------------------------------
  function handlePlayerFood(dt) {
    const p = G.player;
    if (!p) return;
    const magnetR = p.radius * 3.6;
    const eatR = p.radius * 1.05 + 12;
    const list = gridQuery(foodGrid, p.x, p.y, magnetR + eatR);
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (f.dead) continue;
      const dx = p.x - f.x;
      const dy = p.y - f.y;
      const d2 = dx * dx + dy * dy;

      if (d2 < magnetR * magnetR) {
        const d = Math.sqrt(d2) || 0.001;
        const pull = (170 * (1 - d / magnetR) + 60) * dt;
        f.x += (dx / d) * pull;
        f.y += (dy / d) * pull;
      }

      const reach = p.radius * 1.05 + f.r * 1.6;
      if (d2 < reach * reach) eatFood(f);
    }
  }

  // A bite is a 1 -> 0 countdown that fish.js turns into the jaw envelope.
  // It is set on the same frame the chomp sound fires, so the snap you see and
  // the snap you hear are the same event.
  function triggerBite(f, strength) {
    if (f) f.bite = Math.max(f.bite || 0, strength == null ? 1 : strength);
  }

  function eatFood(f) {
    f.dead = true;
    const p = G.player;
    if (!p) return;
    const type = A.FOOD[f.kind];
    const foodXp = f.xp * (p.stageIndex < A.ANGLER_TIER ? 4 : 1);
    p.xp += foodXp;
    p.hunger = Math.min(p.maxHunger, p.hunger + (f.kind === 0 ? 1.6 : f.kind === 1 ? 3.2 : 6));
    if (A.Quests) A.Quests.eatFood(type, f.xp);
    triggerBite(p, type.skins ? 0.95 : 0.72);
    addPopup(f.x, f.y - 10, '+' + foodXp + ' XP', type.color, f.kind === 2 ? 1.25 : 0.95);
    if (type.skins) {
      // A starfish is the one snack with a crunch: the gape opens wider, the
      // existing chomp fires on the same frame, and the broken arms come apart
      // in a shower of bubbles and grit.
      A.Audio.chomp();
      spawnRing(f.x, f.y, 'rgba(255,176,120,0.5)', f.r * 0.9, f.r * 7, 0.36, 1.8);
      spawnSparks(f.x, f.y, [type.core, type.color, '#ffe0bd'], 11, 105, 3);
      for (let i = 0; i < 4; i++) {
        addParticle({
          type: 'bubble', x: f.x + A.rand(-f.r, f.r), y: f.y,
          vx: A.rand(-14, 14), vy: A.rand(-52, -22),
          size: A.rand(1.4, 3.2), life: 0.7, maxLife: 0.7
        });
      }
    } else {
      spawnSparks(f.x, f.y, [type.core, type.color, '#ffffff'], 5 + f.kind * 2, 70, 2 + f.kind);
      A.Audio.pop(f.kind * 140);
    }
  }

  function playerPreyThreshold(p) {
    let threshold = p.radius * 0.86;
    if (G.sim < p.abilityActiveUntil) {
      if (p.ability.id === 'frenzy') threshold = p.radius * 0.98;
      else if (p.ability.id === 'lure') threshold = p.radius * 1.0;
      else if (p.ability.id === 'chomp') threshold = p.radius * 1.02;
      else if (p.ability.id === 'wingboost') threshold = p.radius * 0.94;
      else if (p.ability.id === 'dash') threshold = p.radius * 0.95;
      else if (p.ability.id === 'breach') threshold = p.radius * 1.05;
      else if (p.ability.id === 'terror') threshold = p.radius * 1.0;
    }
    return threshold;
  }

  function handlePlayerFish(dt) {
    const p = G.player;
    if (!p) return;
    const active = G.sim < p.abilityActiveUntil;
    const ab = p.ability;
    const charging = G.sim < (p.chargeUntil || 0);
    const threshold = playerPreyThreshold(p);
    // Bite reach comes straight from the ability's own `eat` multiplier so the
    // number shown in the config is the number the player actually feels.
    let reachMul = 1;
    if (active && ab.eat) reachMul = ab.eat;

    const pushR = (p.radius + 240) * 0.54 + 8;
    const eatR = (p.radius * 0.9 + threshold * 0.6) * reachMul + 8;
    const shockR = active && ab.shock ? p.radius * ab.shock : 0;
    const shockR2 = shockR * shockR;
    const pullR = active && ab.pull ? p.radius * 5.5 : 0;
    const pullR2 = pullR * pullR;
    // Rip Dash opens a lane in front of the fish: wider than the jaw, and it
    // skewers prey the mouth alone would have had to pass over.
    const slashR = active && ab.slash ? p.radius * ab.slash : 0;
    const slashR2 = slashR * slashR;
    const skewerR = threshold * 1.3;
    // Apex Terror reaches much farther than the jaws ever could, so the roar
    // is what makes the grid query expensive for one moment every 13 seconds.
    const fearR = active && ab.fear ? p.radius * ab.fear : 0;
    const fearR2 = fearR * fearR;
    // The Megalodon is the only animal on the ladder that puts a hunting orca
    // on the menu, and even it needs to outweigh one properly.
    const eatPredator = p.art === 'megalodon' && p.radius > A.ORCA.radius * 1.4;
    // The surge reaches as far as the biggest animal it could ram, so a
    // megalodon is never missed just because the grid cell is small.
    const chargeR = charging ? p.radius + 220 : 0;
    const list = gridQuery(fishGrid, p.x, p.y, Math.max(pushR, eatR, shockR, pullR, slashR, fearR, chargeR));
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (f.dead) continue;
      const dx = p.x - f.x;
      const dy = p.y - f.y;
      const d2 = dx * dx + dy * dy;

      // Medusas are not on the menu, cannot be stunned and are not shoved.
      // Touching one is the entire interaction: it fires, and most of a health
      // bar goes with it. Each animal then needs a moment to reload its
      // nematocysts, and the player's own invulnerability window applies.
      if (f.hazard) {
        const touch = p.radius * 0.78 + f.radius * 0.92;
        if (d2 < touch * touch && G.sim > p.invulnUntil && G.sim >= (f.stingUntil || 0)) {
          f.stingUntil = G.sim + 2.4;
          A.Audio.jellySting();
          addPopup(f.x, f.y - f.radius - 12, 'STUNG', '#ff8fd0', 1.3);
          damagePlayer(p.maxHealth * A.JELLY_STING, f);
        }
        continue;
      }

      // Poseidon's surge. The trident is still in the mouth; the animal is the
      // weapon. Whatever the tines touch dies and pays its XP, orca included,
      // with no size or predator check.
      if (charging && f.chargeHit !== p.chargeUid) {
        const ram = p.radius * 1.02 + f.radius * 0.92;
        if (d2 < ram * ram) {
          f.chargeHit = p.chargeUid;
          eatFish(f);
          continue;
        }
      }

      const toFish = slashR2 > 0 ? Math.atan2(-dy, -dx) : 0;
      const inLane = slashR2 > 0 && d2 < slashR2 && Math.abs(A.angleDiff(p.angle, toFish)) < 0.8;

      if ((!f.predator || eatPredator) &&
          (f.predator || f.radius <= threshold || (inLane && f.radius <= skewerR))) {
        const reach = (p.radius * 0.9 + f.radius * 0.6) * reachMul * (inLane ? 1.45 : 1);
        if (d2 < reach * reach) {
          eatFish(f);
          continue;
        }
      }

      // Apex Terror: anything the jaws could already swallow stops where it
      // swims for as long as the roar still holds, and the shockwave only
      // touches the animals below. Fish already caught stay frozen while the
      // player keeps circling, which is the whole point of the ability.
      if (fearR2 > 0 && !f.predator && f.radius <= threshold && d2 < fearR2) {
        if (!(f.stunnedUntil > G.sim)) {
          spawnSparks(f.x, f.y, ['#dff4ff', p.colors.glow], 3, 85, 1.7);
        }
        f.stunnedUntil = G.sim + ab.stun;
      }

      // Fish the blade cannot swallow still feel it: the saw cuts them off the
      // lane, so a dash through a school leaves a hole behind it.
      if (inLane && (f.predator || f.radius > skewerR)) {
        const d = Math.sqrt(d2) || 1;
        const fall = 1 - d / slashR;
        f.x += Math.cos(toFish) * fall * p.radius * 0.85;
        f.y += Math.sin(toFish) * fall * p.radius * 0.85;
        f.x = A.clamp(f.x, W.margin, W.w - W.margin);
        f.y = A.clamp(f.y, W.margin, ceilingAt(f.x, f.radius));
        if (Math.random() < 0.3) spawnSparks(f.x, f.y, ['#eafcff', p.colors.accent], 3, 150, 2.2);
        A.Audio.sawSlash();
      }

      // Lure Flash: the light hauls edible prey in while the jaws widen, so
      // the anglerfish can feed without chasing anything.
      if (pullR2 > 0 && d2 > 1 && d2 < pullR2 && !f.predator && f.radius <= threshold) {
        const d = Math.sqrt(d2);
        const fall = 1 - d / pullR;
        f.x += (dx / d) * ab.pull * fall * dt;
        f.y += (dy / d) * ab.pull * fall * dt;
      }

      // Breach: anything the mouth did not take gets shoved clear by the
      // bow wave, including fish too big to swallow and hunting orcas.
      if (shockR2 > 0 && d2 > 0.001 && d2 < shockR2 && (f.predator || f.radius > threshold)) {
        const d = Math.sqrt(d2);
        const fall = 1 - d / shockR;
        f.x -= (dx / d) * fall * p.radius * 0.55;
        f.y -= (dy / d) * fall * p.radius * 0.55;
        f.x = A.clamp(f.x, W.margin, W.w - W.margin);
        f.y = A.clamp(f.y, W.margin, ceilingAt(f.x, f.radius));
      }

      if (f.radius > p.radius * 0.86) {
        const min = (p.radius + f.radius) * 0.54;
        if (d2 > 0.001 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const nx = dx / d;
          const ny = dy / d;
          const push = min - d;
          p.x += nx * push * 0.62;
          p.y += ny * push * 0.62;
          f.x -= nx * push * 0.3;
          f.y -= ny * push * 0.3;
          p.x = A.clamp(p.x, W.margin, W.w - W.margin);
          p.y = A.clamp(p.y, W.margin, ceilingAt(p.x, p.radius));
          f.x = A.clamp(f.x, W.margin, W.w - W.margin);
          f.y = A.clamp(f.y, W.margin, ceilingAt(f.x, f.radius));
        }
      }
    }
  }

  function eatFish(f) {
    const p = G.player;
    if (!p) return;
    f.dead = true;
    if (G.orcaHunter === f) G.orcaHunter = null;
    if (G.fishHunter === f) G.fishHunter = null;
    for (let i = 0; i < G.fishes.length; i++) {
      const other = G.fishes[i];
      if (other.prey === f) other.prey = null;
      if (other.threat === f) other.threat = null;
    }

    // A predator has no tier and would score absurdly on the normal curve, so
    // its XP is its own: a third of everything it has hunted, never below the
    // old flat bounty.
    const baseGain = f.predator ? predatorBounty(f) : Math.round(18 + f.tier * 16 + f.radius * 0.35);
    // Give 4x XP from eaten fish until the player reaches Anglerfish.
    const gain = baseGain * (p.stageIndex < A.ANGLER_TIER ? 4 : 1);
    p.xp += gain;
    p.hunger = Math.min(p.maxHunger, p.hunger + (f.predator ? 60 : 12));
    G.eaten++;
    if (A.Quests) A.Quests.eatFish(f);
    G.camera.shake = Math.min(1, G.camera.shake + (f.predator ? 1 : 0.28));

    triggerBite(p, 1);
    if (p.art === 'sawshark') A.Audio.sawBite(f.radius);
    else if (p.art === 'megalodon') A.Audio.megaBite(f.radius);
    else A.Audio.bite(f.radius);
    if (A.Collection) A.Collection.onKill(f);
    addPopup(f.x, f.y - (f.radius + 8),
      f.predator ? (f.name || 'PREDATOR').toUpperCase() + ' EATEN  +' + gain + ' XP' : '+' + gain + ' XP',
      f.predator ? '#ff7a7a' : '#ffe08a', f.predator ? 1.6 : 1.1);
    spawnSparks(f.x, f.y, [f.colors.body, f.colors.fin, f.colors.accent, '#ffffff'], 12, 160, 3);
    spawnRing(f.x, f.y, 'rgba(255,226,150,0.65)', f.radius * 0.5, f.radius * 7, 0.4, 2.5);
    for (let i = 0; i < 4; i++) {
      const a = A.rand(0, TAU);
      const sp = A.rand(30, 110);
      addParticle({
        type: 'scale', x: f.x, y: f.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        rot: A.rand(0, TAU), vr: A.rand(-5, 5),
        size: A.rand(2, 4.5), color: f.colors.fin,
        life: A.rand(0.4, 0.7), maxLife: 0.7
      });
    }

    // An anglerfish is a bag of spines and leather and it bites back on the
    // way down. Only the two apex animals swallow one without paying for it.
    if (f.art === 'angler' && p.art !== 'megalodon' && p.art !== 'orca') {
      damagePlayer(p.maxHealth * A.ANGLER_BITE, f);
    }
  }

  // ------------------------------------------------------------------
  // Maintenance
  // ------------------------------------------------------------------
  function maintainPopulation(dt) {
    G.popTimer -= dt;
    if (G.popTimer > 0) return;
    G.popTimer = 0.6;
    const counts = new Array(A.TIER_TARGETS.length).fill(0);
    let orcas = 0;
    for (let i = 0; i < G.fishes.length; i++) {
      const f = G.fishes[i];
      if (f.dead) continue;
      if (f.predator) { orcas++; continue; }
      if (f.stageIndex >= 0 && f.stageIndex < counts.length) counts[f.stageIndex]++;
    }
    for (let tier = 0; tier < A.TIER_TARGETS.length; tier++) {
      // Refill at most a few at a time; a 267-fish reef regenerates smoothly
      // instead of popping in as one expensive frame.
      const missing = A.TIER_TARGETS[tier] - counts[tier];
      const toSpawn = Math.min(3, Math.max(0, missing));
      for (let i = 0; i < toSpawn; i++) spawnAI(tier, {});
    }
    if (orcas < A.ORCA_TARGET && G.sim > (G.orcaReadyAt || 0)) {
      G.orcaReadyAt = G.sim + 14;
      spawnOrca();
    }
  }

  function maintainFood(dt) {
    G.foodTimer -= dt;
    if (G.foodTimer > 0) return;
    G.foodTimer = 0.28;
    const need = FOOD_TARGET - G.foods.length;
    const n = Math.min(5, Math.max(0, need));
    for (let i = 0; i < n; i++) spawnFoodRandom(400);
  }

  // ------------------------------------------------------------------
  // Particles
  // ------------------------------------------------------------------
  function addParticle(p) {
    const cap = G.quality < 0.9 ? 130 : 240;
    if (G.particles.length >= cap) G.particles.shift();
    G.particles.push(p);
  }

  function spawnSurfaceSplash(x, y, radius) {
    const scale = A.clamp(radius / 46, 0.5, 2.25);
    spawnRing(x, y, 'rgba(226,250,255,0.92)', radius * 0.72, radius * 9.5, 0.52, Math.max(2, radius * 0.075));
    spawnRing(x, y, 'rgba(92,205,232,0.72)', radius * 0.9, radius * 12, 0.68, Math.max(1.5, radius * 0.045));
    const droplets = Math.min(34, Math.round(17 * scale));
    for (let i = 0; i < droplets; i++) {
      const angle = -Math.PI + A.rand(0.08, 0.92) * Math.PI;
      const speed = A.rand(105, 255) * scale;
      const life = A.rand(0.34, 0.72);
      addParticle({
        type: 'spark',
        x: x + A.rand(-radius * 0.45, radius * 0.45),
        y: y + A.rand(-2, 5),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - A.rand(20, 85) * scale,
        size: A.rand(2.2, 5.2) * scale,
        color: i % 3 ? '#d8f8ff' : '#75dff4',
        life: life,
        maxLife: life
      });
    }
    A.Audio.splash(radius);
  }

  function spawnSparks(x, y, colors, count, speed, size) {
    for (let i = 0; i < count; i++) {
      const a = A.rand(0, TAU);
      const sp = A.rand(0.3, 1) * speed;
      const life = A.rand(0.3, 0.7);
      addParticle({
        type: 'spark',
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        size: size * A.rand(0.5, 1),
        color: A.pick(colors),
        life: life, maxLife: life
      });
    }
  }

  function spawnRing(x, y, color, r, vr, life, width) {
    addParticle({
      type: 'ring', x: x, y: y, r: r, vr: vr,
      color: color, life: life, maxLife: life, width: width || 2
    });
  }

  function updateParticles(dt) {
    const list = G.particles;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) {
        list.splice(i, 1);
        continue;
      }
      if (p.type === 'ring') {
        p.r += p.vr * dt;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.type === 'spark' || p.type === 'streak') {
          p.vx *= (1 - 2.2 * dt);
          p.vy *= (1 - 2.2 * dt);
        } else if (p.type === 'scale') {
          p.vx *= (1 - 1.2 * dt);
          p.vy *= (1 - 1.2 * dt);
          p.rot += p.vr * dt;
        } else if (p.type === 'bubble') {
          p.vx *= (1 - 0.8 * dt);
        }
      }
    }
  }

  function drawParticles(ctx, view) {
    const list = G.particles;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!inView(p.x, p.y, 30, view)) continue;
      const t = Math.max(0, p.life / p.maxLife);
      if (p.type === 'spark') {
        ctx.globalAlpha = t;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * t, 0, TAU);
        ctx.fill();
      } else if (p.type === 'bubble') {
        ctx.globalAlpha = t * 0.7;
        const size = p.size * 4;
        ctx.drawImage(A.bubbleSprite, p.x - size / 2, p.y - size / 2, size, size);
      } else if (p.type === 'ring') {
        ctx.globalAlpha = t * 0.9;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.width * Math.max(0.2, t);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, TAU);
        ctx.stroke();
      } else if (p.type === 'scale') {
        ctx.globalAlpha = t;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(-p.size, p.size * 0.5);
        ctx.lineTo(0, -p.size);
        ctx.lineTo(p.size, p.size * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'streak') {
        ctx.globalAlpha = t * 0.8;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, p.size * t);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.09, p.y - p.vy * 0.09);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function updatePopups(dt) {
    const list = G.popups;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      p.y += p.vy * dt;
      p.vy *= (1 - 1.4 * dt);
      if (p.life <= 0) list.splice(i, 1);
    }
  }

  function addPopup(x, y, text, color, scale) {
    if (G.popups.length > 24) G.popups.shift();
    G.popups.push({
      x: x, y: y, text: text, color: color,
      scale: scale || 1,
      life: 0.95, maxLife: 0.95, vy: -34
    });
  }

  function drawPopups(ctx) {
    if (!G.popups.length) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (let i = 0; i < G.popups.length; i++) {
      const p = G.popups[i];
      const t = Math.max(0, p.life / p.maxLife);
      const appear = Math.min(1, (1 - t) * 8 + 0.4);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale((1 / G.camera.zoom) * (0.7 + appear * 0.3), (1 / G.camera.zoom) * (0.7 + appear * 0.3));
      ctx.globalAlpha = Math.min(1, t * 1.8);
      ctx.font = '800 ' + Math.round(16 * p.scale) + 'px "Trebuchet MS", sans-serif';
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(2, 12, 20, 0.66)';
      ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // The tag rides above the fish at a constant screen size, the way score
  // popups do, so it stays readable at any zoom and in any stage. The level
  // rides with it as `Vuxa[12]`, and its colour changes every five levels.
  function playerLevel() {
    const prof = A.Account && A.Account.profile ? A.Account.profile() : null;
    const xp = prof ? (prof.xp | 0) : 0;
    if (G.nameLevelXp !== xp) {
      G.nameLevelXp = xp;
      G.nameLevel = A.Levels ? A.Levels.forXp(xp).level : 0;
    }
    return G.nameLevel | 0;
  }

  function drawNameTag(ctx) {
    const p = G.player;
    const name = G.playerName;
    if (!p || !name || p.dead) return;
    const level = playerLevel();
    const tag = '[' + level + ']';
    const k = 1 / Math.max(0.35, G.camera.zoom);
    ctx.save();
    ctx.translate(p.x, p.y - p.radius * 1.3 - 26 * k);
    ctx.scale(k, k);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.font = '800 15px "Trebuchet MS", sans-serif';
    const gap = 5;
    const nameW = ctx.measureText(name).width;
    const tagW = ctx.measureText(tag).width;
    const x = -(nameW + gap + tagW) / 2;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(2, 12, 20, 0.72)';
    ctx.strokeText(name, x, 0);
    ctx.strokeText(tag, x + nameW + gap, 0);
    ctx.fillStyle = '#a9f0ff';
    ctx.fillText(name, x, 0);
    ctx.fillStyle = A.Levels && A.Levels.colorFor ? A.Levels.colorFor(level) : '#a9f0ff';
    ctx.fillText(tag, x + nameW + gap, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function updateMotes(dt) {
    const w = G.w;
    const h = G.h;
    for (let i = 0; i < G.motes.length; i++) {
      const m = G.motes[i];
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.y < -6) { m.y = h + 6; m.x = A.rand(0, w); }
      if (m.x < -6) m.x = w + 6;
      if (m.x > w + 6) m.x = -6;
      if (m.y > h + 6) m.y = -6;
    }
  }

  function drawMotes(ctx) {
    ctx.fillStyle = '#c7f7ff';
    for (let i = 0; i < G.motes.length; i++) {
      const m = G.motes[i];
      ctx.globalAlpha = m.a;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------
  function inView(x, y, r, view) {
    return x + r + 60 > view.x && x - r - 60 < view.x + view.w &&
      y + r + 60 > view.y && y - r - 60 < view.y + view.h;
  }

  // ------------------------------------------------------------------
  // Starfish sprites
  // ------------------------------------------------------------------
  // A starfish is the one snack that is drawn as an animal rather than a
  // pickup, and it is on screen in large numbers. So each skin and arm shape
  // is baked once into an offscreen canvas at 2x and blitted after that: the
  // dorsal pattern costs one drawImage per frame instead of a hundred paths.
  const starCache = {};

  // The three silhouettes are built off different proportions rather than off
  // one star with different jitter: a classic spread, a long-armed lean one,
  // and a short webbed cushion. `len` is how far the arm reaches, `fat` its
  // half-width at the root, `web` how deep the webbing cuts between arms.
  const STAR_SHAPES = [
    { len: 0.97, fat: 0.36, web: 0.50 },
    { len: 1.09, fat: 0.26, web: 0.41 },
    { len: 0.84, fat: 0.48, web: 0.70 }
  ];

  function starArms(r, seed, shape) {
    const base = STAR_SHAPES[shape % STAR_SHAPES.length];
    const ang = [];
    const len = [];
    const web = [];
    const fat = [];
    const bend = [];
    for (let k = 0; k < 5; k++) {
      ang[k] = (k / 5) * TAU - Math.PI / 2 + Math.sin(k * 2.3 + seed) * 0.07;
      len[k] = r * (base.len + Math.sin(k * 1.7 + seed * 2.1) * 0.09);
      web[k] = base.web + Math.sin(k * 3.1 + seed * 1.3) * 0.06;
      fat[k] = base.fat + Math.sin(k * 1.1 + seed * 0.7) * 0.05;
      bend[k] = Math.sin(k * 2.7 + seed * 1.9) * 0.08;
    }
    return { ang: ang, len: len, web: web, fat: fat, bend: bend };
  }

  // Five tapering arms sweeping out of a thick pentagonal disc. Every arm ends
  // exactly where the next begins, so the whole body is one closed path. The
  // tip gets its own short curve: real arms finish blunt and rounded, not
  // needle-sharp.
  function starBodyPath(g, arms, scale) {
    const half = TAU / 10;
    g.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = arms.ang[k];
      const L = arms.len[k] * scale;
      const w = arms.fat[k];
      const b = arms.bend[k];
      const web = arms.web[k] * scale;
      const X = function (d, rad) { return Math.cos(a + d + b * rad) * L * rad; };
      const Y = function (d, rad) { return Math.sin(a + d + b * rad) * L * rad; };
      if (k === 0) g.moveTo(X(-half, web), Y(-half, web));
      g.quadraticCurveTo(X(-w, 0.44), Y(-w, 0.44), X(-w * 0.96, 0.72), Y(-w * 0.96, 0.72));
      g.quadraticCurveTo(X(-w * 0.66, 0.93), Y(-w * 0.66, 0.93), X(-w * 0.34, 1.02), Y(-w * 0.34, 1.02));
      g.quadraticCurveTo(X(0, 1.09), Y(0, 1.09), X(w * 0.34, 1.02), Y(w * 0.34, 1.02));
      g.quadraticCurveTo(X(w * 0.66, 0.93), Y(w * 0.66, 0.93), X(w * 0.96, 0.72), Y(w * 0.96, 0.72));
      g.quadraticCurveTo(X(w, 0.44), Y(w, 0.44), X(half, web), Y(half, web));
    }
    g.closePath();
  }

  function dot(g, x, y, r) {
    g.moveTo(x + r, y);
    g.arc(x, y, r, 0, TAU);
  }

  function starSprite(kind, skinIndex, shape, ss) {
    // `ss` is the bake's pixel density. World food bakes at 2x (sprites are
    // drawn near 1:1), but a card blows the same animal up several times, so
    // it asks for a bake big enough to stay sharp.
    ss = ss || 2;
    const key = kind + '|' + skinIndex + '|' + shape + '|' + ss;
    let c = starCache[key];
    if (c) return c;
    const type = A.FOOD[kind];
    const skin = (type.skins && type.skins[skinIndex % type.skins.length]) ||
      { body: type.color, dark: 'rgba(86, 27, 14, 1)', light: type.core };
    const r = type.radius;
    const size = Math.ceil(r * 2.7 * ss);
    c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    c.sw = r * 2.7;
    const g = c.getContext('2d');
    g.translate(size / 2, size / 2);
    g.scale(ss, ss);
    const arms = starArms(r, shape * 1.9 + 0.4, shape);
    const rng = A.seedRand(4000 + skinIndex * 131 + shape * 77);

    starBodyPath(g, arms, 1);
    g.fillStyle = skin.body;
    g.fill();

    g.save();
    starBodyPath(g, arms, 1.02);
    g.clip();

    // Light falls on the upper-left of the dome and the far side sinks.
    const grad = g.createLinearGradient(-r, -r, r * 0.7, r);
    grad.addColorStop(0, skin.light);
    grad.addColorStop(0.45, skin.body);
    grad.addColorStop(1, skin.dark);
    g.globalAlpha = 0.5;
    g.fillStyle = grad;
    g.fillRect(-r * 1.4, -r * 1.4, r * 2.8, r * 2.8);

    // The central disc is the thickest part of the animal, so it catches most
    // of the light.
    const disc = g.createRadialGradient(-r * 0.1, -r * 0.12, r * 0.04, 0, 0, r * 0.62);
    disc.addColorStop(0, skin.light);
    disc.addColorStop(1, skin.body);
    g.globalAlpha = 0.4;
    g.fillStyle = disc;
    g.beginPath();
    g.arc(0, 0, r * 0.62, 0, TAU);
    g.fill();

    // Dorsal ossicle rows. They follow the arm's own curl, narrow toward the
    // tip and jitter, which is what separates a starfish from a sticker.
    g.globalAlpha = 0.5;
    g.fillStyle = skin.light;
    g.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = arms.ang[k];
      const L = arms.len[k];
      const w = arms.fat[k];
      const b = arms.bend[k];
      for (let j = 0; j < 5; j++) {
        const t = 0.3 + j * 0.16;
        const spread = w * (1 - t * 0.62);
        for (let s = -1; s <= 1; s++) {
          const off = s * spread + (s ? (rng() - 0.5) * 0.05 : 0);
          const rad = r * (0.032 + rng() * 0.03);
          dot(g, Math.cos(a + off + b * t) * L * t, Math.sin(a + off + b * t) * L * t, rad);
        }
      }
      const ring = a + TAU / 10;
      dot(g, Math.cos(ring) * r * 0.42, Math.sin(ring) * r * 0.42, r * 0.05);
    }
    g.fill();

    // Marginal plates: a darker bead down each side of every arm, half a pixel
    // off the lit row so the surface reads as bumpy rather than painted.
    g.globalAlpha = 0.42;
    g.fillStyle = skin.dark;
    g.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = arms.ang[k];
      const L = arms.len[k];
      const w = arms.fat[k];
      const b = arms.bend[k];
      for (let j = 0; j < 5; j++) {
        const t = 0.28 + j * 0.16;
        const spread = w * (1 - t * 0.62) * 1.04;
        for (let s = -1; s <= 1; s += 2) {
          dot(g, Math.cos(a + s * spread + b * t) * L * t, Math.sin(a + s * spread + b * t) * L * t, r * 0.03);
        }
      }
    }
    g.fill();

    // The madreporite - the pale sieve plate, always off to one side.
    g.globalAlpha = 0.9;
    g.fillStyle = skin.light;
    g.beginPath();
    g.arc(r * 0.24, -r * 0.3, r * 0.13, 0, TAU);
    g.fill();
    g.globalAlpha = 0.55;
    g.strokeStyle = skin.dark;
    g.lineWidth = 1;
    g.stroke();
    g.restore();

    // A dark rim keeps the silhouette against dark water.
    g.globalAlpha = 0.7;
    g.strokeStyle = skin.dark;
    g.lineWidth = 1.2;
    starBodyPath(g, arms, 1);
    g.stroke();
    g.globalAlpha = 1;

    starCache[key] = c;
    return c;
  }

  function drawFoods(ctx, view) {
    const t = G.sim;
    for (let i = 0; i < G.foods.length; i++) {
      const f = G.foods[i];
      if (f.dead || !inView(f.x, f.y, f.r * 5, view)) continue;
      const type = A.FOOD[f.kind];
      // A starfish is heavy and waterlogged, so it rolls slowly on a long
      // swell instead of skittering like the plankton around it.
      const bob = type.skins
        ? Math.sin(t * 1.15 + f.phase) * 3.6
        : Math.sin(t * 2 + f.phase) * 1.6;
      const y = f.y + bob;
      const pulse = 0.9 + Math.sin(t * 2.6 + f.phase) * 0.1;
      if (G.quality >= 0.9 || f.kind !== 0) {
        // A starfish is an animal, not a lantern. It keeps just enough glow to
        // be found in a dark trench and no more.
        const gs = f.r * (type.skins ? 4.2 : f.kind === 2 ? 6.2 : 5.1) * pulse;
        ctx.globalAlpha = type.skins ? 0.24 : f.kind === 2 ? 0.7 : 0.48;
        ctx.drawImage(A.glowSprite(type.glow), f.x - gs / 2, y - gs / 2, gs, gs);
        ctx.globalAlpha = 1;
      }

      ctx.save();
      ctx.translate(f.x, y);
      foodBody(ctx, f.kind, f);
      ctx.restore();
    }
  }

  // Every pickup's own body, drawn around the origin at the food's radius.
  // drawFoods translates into place and A.foodPreview calls the same thing, so
  // a mission card can never show an animal that is not in the ocean.
  function foodBody(ctx, kind, f) {
    const type = A.FOOD[kind];
    const t = G.sim;
    const r = f.r;
    if (kind === 0) {
      ctx.save();
      ctx.rotate(t * 0.8 + f.phase);
      ctx.fillStyle = type.core;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, 0, TAU);
      ctx.fill();
      ctx.fillStyle = type.color;
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * TAU;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85, r * 0.33, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    } else if (kind === 1) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fillStyle = type.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(90, 30, 50, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = type.core;
      ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.35, r * 0.34, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#5fd6a0';
      ctx.beginPath();
      ctx.ellipse(r * 0.75, -r * 0.85, r * 0.52, r * 0.24, -0.6, 0, TAU);
      ctx.fill();
    } else if (kind === 2) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fillStyle = '#fff8e6';
      ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.7, 0, TAU);
      ctx.fillStyle = type.color;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(-r * 0.24, -r * 0.3, r * 0.28, 0, TAU);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.globalAlpha = 0.45 + Math.sin(t * 4 + f.phase) * 0.35;
      ctx.strokeStyle = '#fff4c2';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(r * 1.4, 0);
      ctx.lineTo(r * 2.05, 0);
      ctx.moveTo(r * 1.72, -r * 0.32);
      ctx.lineTo(r * 1.72, r * 0.32);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      // The starfish. Its heading was picked where it spawned and only ever
      // sways away from there, so the animal is one blit of a baked sprite and
      // the whole live cost is a translate and a rotate.
      const sp = starSprite(kind, f.skin | 0, f.shape | 0, f.ss);
      // A high-density bake draws at its own pixel size; the world's 2x bake
      // keeps the old CSS-width bookkeeping.
      const w = f.ss ? sp.width : sp.sw * (r / type.radius);
      ctx.save();
      ctx.rotate((f.spin || 0) + Math.sin(t * 0.7 + f.phase) * 0.22);
      ctx.drawImage(sp, -w / 2, -w / 2, w, w);
      ctx.restore();
    }
  }

  // The mission board's picture of a pickup, built from the same body the
  // world draws. `name` is an A.FOOD name, so a card asks for 'Starfish'.
  A.foodPreview = function (canvas, name) {
    let kind = -1;
    for (let i = 0; i < A.FOOD.length; i++) {
      if (A.FOOD[i].name === name) { kind = i; break; }
    }
    if (kind < 0) return false;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const type = A.FOOD[kind];
    const r = Math.min(w, h) * (type.skins ? 0.33 : 0.26);
    const gs = r * (type.skins ? 3.4 : kind === 2 ? 6.2 : 5.1);
    ctx.globalAlpha = type.skins ? 0.22 : kind === 2 ? 0.6 : 0.42;
    ctx.drawImage(A.glowSprite(type.glow), w / 2 - gs / 2, h / 2 - gs / 2, gs, gs);
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(w / 2, h / 2 + 1);
    foodBody(ctx, kind, {
      r: r, phase: 0.9, spin: type.skins ? -0.4 : 0, skin: 1, shape: 0,
      // Bake the animal at card resolution instead of upscaling its 2x sprite.
      ss: type.skins ? A.clamp(r / type.radius, 2, 6) : undefined
    });
    ctx.restore();
    return true;
  };

  function drawPlayerHalo(ctx, p) {
    const g = A.glowSprite(p.colors.accent);
    const size = p.radius * 4.8;
    ctx.save();
    ctx.globalAlpha = 0.22 + Math.sin(G.sim * 2.6) * 0.04;
    ctx.drawImage(g, p.x - size / 2, p.y - size / 2, size, size);
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = p.colors.accent;
    ctx.lineWidth = Math.max(2, p.radius * 0.06);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * 1.6, 0, TAU);
    ctx.stroke();

    const bob = Math.sin(G.sim * 2.2) * 2.2;
    const cx = p.x;
    const cy = p.y - p.radius * 2.05 + bob;
    const w = Math.max(6, p.radius * 0.42);
    ctx.globalAlpha = 0.82;
    ctx.lineWidth = Math.max(2, p.radius * 0.08);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - w, cy - w * 0.45);
    ctx.lineTo(cx, cy + w * 0.35);
    ctx.lineTo(cx + w, cy - w * 0.45);
    ctx.stroke();
    ctx.restore();
  }

  function drawRelationRing(ctx, f, preyThreshold) {
    const p = G.player;
    if (!p) return;
    let rgb;
    // A medusa is never food, so it wears the threat ring regardless of how
    // small it is - the one piece of UI that says "do not touch this".
    if (f.hazard) rgb = '255, 86, 108';
    else if (f.radius > p.radius * 1.12) rgb = '255, 86, 108';
    else if (f.radius <= preyThreshold) rgb = '96, 255, 172';
    else return;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.hazard ? 0 : f.angle);
    ctx.beginPath();
    ctx.ellipse(0, -f.radius * 0.04, f.radius * 1.55, f.radius * 1.02, 0, 0, TAU);
    ctx.strokeStyle = 'rgba(' + rgb + ', 0.15)';
    ctx.lineWidth = Math.max(6, f.radius * 0.16);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(' + rgb + ', 0.72)';
    ctx.lineWidth = Math.max(1.4, f.radius * 0.035);
    ctx.stroke();
    ctx.restore();
  }

  const drawScratch = [];

  // Prey frozen by Apex Terror carry two small ripples over the head, so the
  // roar reads as a state you can see instead of one you have to infer from
  // a fish that has stopped swimming.
  function drawStunMarks(ctx, f) {
    const x = f.x - Math.cos(f.angle) * f.radius * 0.6;
    const y = f.y - Math.sin(f.angle) * f.radius * 0.6 - f.radius * 1.3;
    ctx.save();
    ctx.strokeStyle = '#e2f8ff';
    ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const ph = ((G.sim * 3.2 + f.seed * 0.37 + i * 0.5) % 1);
      ctx.globalAlpha = (1 - ph) * 0.7;
      ctx.lineWidth = Math.max(1.1, f.radius * 0.1);
      ctx.beginPath();
      ctx.arc(x, y, f.radius * (0.18 + ph * 0.4), 0.15 * TAU, 0.85 * TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFishLayer(ctx, view) {
    const list = drawScratch;
    list.length = 0;
    for (let i = 0; i < G.fishes.length; i++) {
      const f = G.fishes[i];
      if (f.dead || !inView(f.x, f.y, f.radius * 3, view)) continue;
      list.push(f);
    }
    if (G.player) list.push(G.player);
    for (let i = 0; i < G.remotePlayers.length; i++) list.push(G.remotePlayers[i]);

    list.sort(function (a, b) { return a.y - b.y; });

    const preyThreshold = G.player ? playerPreyThreshold(G.player) : 0;
    const cheap = G.quality < 0.9;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (!f.isPlayer && G.player && (!cheap || A.dist2(f.x, f.y, G.player.x, G.player.y) < 620 * 620)) {
        drawRelationRing(ctx, f, preyThreshold);
      }
      if (!f.isPlayer && G.sim < (f.stunnedUntil || 0)) drawStunMarks(ctx, f);
      if (!f.isPlayer && G.sim < (f.smokedUntil || 0)) drawSmokedMarks(ctx, f);
      if (f.isPlayer) drawPlayerHalo(ctx, f);
      if (f.isPlayer && G.sim < f.invulnUntil) {
        ctx.globalAlpha = 0.68 + 0.32 * Math.abs(Math.sin(G.sim * 14));
      }
      A.FishArt.draw(ctx, f, G.sim, cheap);
      if (f.isPlayer) {
        const playerLabel = f.remote ? (f.name || 'Guest') : (G.playerName || 'Guest');
        const country = f.remote ? (f.showFlag ? f.countryCode : '') :
          (A.Online && A.Online.showFlag && A.Online.showFlag() ? A.Online.countryCode() : '');
        ctx.save();
        ctx.globalAlpha = 0.94;
        ctx.font = '600 ' + Math.max(11, f.radius * 0.48) + 'px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#eafaff';
        ctx.shadowColor = 'rgba(0, 12, 28, 0.9)';
        ctx.shadowBlur = 5;
        const labelY = f.y - f.radius * 1.18;
        if (country && /^[A-Z]{2}$/.test(country)) {
          const flag = String.fromCodePoint(country.charCodeAt(0) + 127397, country.charCodeAt(1) + 127397);
          ctx.font = '11px system-ui, sans-serif';
          const flagWidth = ctx.measureText(flag).width;
          const nameWidth = ctx.measureText(playerLabel).width;
          const gap = 4;
          const startX = f.x - (flagWidth + gap + nameWidth) / 2;
          ctx.fillText(flag, startX + flagWidth / 2, labelY);
          ctx.font = '600 ' + Math.max(11, f.radius * 0.48) + 'px system-ui, sans-serif';
          ctx.fillText(playerLabel, startX + flagWidth + gap + nameWidth / 2, labelY);
        } else {
          ctx.fillText(playerLabel, f.x, labelY);
        }
        ctx.restore();
      }
      // Carried equipment rides the same transform as the animal that owns it,
      // and it goes on top: the rod crossing the head is what reads as a grip.
      // Any record with a `weapon` key gets one, so a remote player pushed into
      // fishGrid by the net layer is drawn with exactly this line.
      if (f.weapon && A.Weapons) A.Weapons.drawHeld(ctx, f, G.sim, cheap);
      ctx.globalAlpha = 1;
    }

    if (G.player) drawPlayerFx(ctx);
  }

  function drawPlayerFx(ctx) {
    const p = G.player;
    if (!p) return;
    const active = G.sim < p.abilityActiveUntil;
    if (!active) return;
    const ab = p.ability;

    if (ab.id === 'shield') {
      const r = p.radius * (1.65 + Math.sin(G.sim * 4) * 0.04);
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = '#ffb6cb';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = '#ffd2df';
      ctx.lineWidth = Math.max(1.5, p.radius * 0.045);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#ffe9ef';
      for (let i = 0; i < 4; i++) {
        const a = G.sim * 1.6 + (i / 4) * TAU;
        ctx.globalAlpha = 0.55 + Math.sin(G.sim * 5 + i) * 0.3;
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, Math.max(1.4, p.radius * 0.05), 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    } else if (ab.id === 'frenzy') {
      const g = A.glowSprite('#ff8fd0');
      ctx.save();
      ctx.globalAlpha = 0.4 + Math.sin(G.sim * 8) * 0.12;
      ctx.drawImage(g, p.x - p.radius * 1.4, p.y - p.radius * 1.4, p.radius * 2.8, p.radius * 2.8);
      ctx.restore();
    } else if (ab.id === 'lure') {
      // A breathing halo of light around the head, offset forward onto the esca.
      const pulse = 0.5 + Math.sin(G.sim * 6.5) * 0.5;
      const hx = p.x + Math.cos(p.angle) * p.radius * 0.5;
      const hy = p.y + Math.sin(p.angle) * p.radius * 0.5 - p.radius * 0.35;
      const r = p.radius * (1.35 + pulse * 0.55);
      const g = A.glowSprite(p.colors.glow);
      ctx.save();
      ctx.globalAlpha = 0.26 + pulse * 0.2;
      ctx.drawImage(g, hx - r, hy - r, r * 2, r * 2);
      ctx.restore();
    } else if (ab.id === 'chomp') {
      const g = A.glowSprite(p.colors.accent);
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.drawImage(g, p.x - p.radius * 1.8, p.y - p.radius * 1.8, p.radius * 3.6, p.radius * 3.6);
      ctx.restore();
    } else if (ab.id === 'wingboost') {
      // The wake of a stroke: sheets of water thrown back off both wing tips,
      // brightest on the downstroke and letting go as the glide runs out. Both
      // read p.phase, so the wash and the wing beat land together.
      const beat = 0.5 + Math.sin(p.phase * 0.85 - 1.1) * 0.5;
      const fade = A.clamp((p.abilityActiveUntil - G.sim) / 0.6, 0, 1);
      const r = p.radius * (1.45 + beat * 0.45);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.strokeStyle = '#dff4ff';
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.4, p.radius * 0.032);
      ctx.globalAlpha = (0.12 + beat * 0.22) * fade;
      ctx.beginPath();
      ctx.arc(0, 0, r, 1.05, 2.25);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r, -2.25, -1.05);
      ctx.stroke();
      ctx.restore();
      const g = A.glowSprite(p.colors.glow);
      const gr = p.radius * 2.3;
      ctx.save();
      ctx.globalAlpha = 0.15 * fade;
      ctx.drawImage(g, p.x - gr, p.y - gr, gr * 2, gr * 2);
      ctx.restore();
    } else if (ab.id === 'dash') {
      // The saw's lane drawn straight into the world: a spear of disturbed
      // water thrown ahead of the rostrum that widens as the dash runs out.
      const t = A.clamp(1 - (p.abilityActiveUntil - G.sim) / ab.duration, 0, 1);
      const fade = 1 - t * t;
      const reach = p.radius * (1.3 + (ab.slash - 1.3) * t);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.strokeStyle = '#eafcff';
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.5 * fade;
      ctx.lineWidth = Math.max(1.8, p.radius * 0.06);
      ctx.beginPath();
      ctx.moveTo(p.radius * 0.8, 0);
      ctx.lineTo(reach, 0);
      ctx.stroke();
      ctx.globalAlpha = 0.3 * fade;
      ctx.lineWidth = Math.max(1.2, p.radius * 0.035);
      ctx.beginPath();
      ctx.arc(0, 0, reach, -0.72, -0.16);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, reach, 0.16, 0.72);
      ctx.stroke();
      ctx.restore();
      const gs = A.glowSprite(p.colors.glow);
      const gr = p.radius * 1.9;
      ctx.save();
      ctx.globalAlpha = 0.32 * fade;
      ctx.drawImage(gs, p.x - gr, p.y - gr, gr * 2, gr * 2);
      ctx.restore();
    } else if (ab.id === 'terror') {
      // The fear aura made visible: three wavefronts running out to the edge of
      // the roar, plus a cold fill so you can see exactly who is inside it.
      const life = p.abilityActiveUntil - G.sim;
      const fade = A.clamp(life / 0.7, 0, 1);
      const hx = p.x + Math.cos(p.angle) * p.radius * 0.35;
      const hy = p.y + Math.sin(p.angle) * p.radius * 0.35;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.075 * fade;
      ctx.fillStyle = p.colors.glow;
      ctx.beginPath();
      ctx.arc(hx, hy, p.radius * ab.fear, 0, TAU);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        const ph = ((G.sim * 1.3 + i / 3) % 1);
        ctx.globalAlpha = (1 - ph) * 0.45 * fade;
        ctx.strokeStyle = i === 1 ? '#c3e4dd' : '#e2f8ff';
        ctx.lineWidth = Math.max(1.6, p.radius * (0.075 - ph * 0.05));
        ctx.beginPath();
        ctx.arc(hx, hy, p.radius * (0.7 + ph * (ab.fear - 0.7)), 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
      const g = A.glowSprite('#dff4ff');
      const gr = p.radius * 2.1;
      ctx.save();
      ctx.globalAlpha = 0.3 * fade;
      ctx.drawImage(g, p.x - gr, p.y - gr, gr * 2, gr * 2);
      ctx.restore();
    } else if (ab.id === 'breach') {
      // Two expanding crescents of white water riding out ahead of the body.
      const t = A.clamp(1 - (p.abilityActiveUntil - G.sim) / ab.duration, 0, 1);
      const fade = 1 - t;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.strokeStyle = '#eafcff';
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.5 * fade;
      ctx.lineWidth = Math.max(2, p.radius * 0.085);
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * (0.95 + t * (ab.shock - 0.95)), -1.05, 1.05);
      ctx.stroke();
      ctx.globalAlpha = 0.24 * fade;
      ctx.lineWidth = Math.max(1.5, p.radius * 0.05);
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * (0.6 + t * (ab.shock - 0.6)), -1.45, 1.45);
      ctx.stroke();
      ctx.restore();
    }
  }

  function render() {
    if (A.Monsters && A.Monsters.active()) {
      A.Monsters.render(ctx);
      return;
    }
    const w = G.w;
    const h = G.h;
    const zoom = G.camera.zoom;
    ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    const lowDetail = G.quality < 0.9;
    G.world.drawBackground(ctx, w, h, G.camera, zoom, G.sim, lowDetail);

    const shake = G.camera.shake;
    const sx = shake > 0 ? A.rand(-1, 1) * shake * 15 : 0;
    const sy = shake > 0 ? A.rand(-1, 1) * shake * 12 : 0;

    const view = {
      x: G.camera.x - w / (2 * zoom),
      y: G.camera.y - h / (2 * zoom),
      w: w / zoom,
      h: h / zoom
    };

    ctx.save();
    ctx.translate(w / 2 + sx, h / 2 + sy);
    ctx.scale(zoom, zoom);
    ctx.translate(-G.camera.x, -G.camera.y);

    G.world.drawStatic(ctx, view, G.sim, lowDetail);
    if (A.Monsters) A.Monsters.drawEntrance(ctx, view, G.sim);
    drawFoods(ctx, view);
    drawFishLayer(ctx, view);
    if (A.Collection) A.Collection.drawWorld(ctx, G.sim);
    drawInk(ctx, view);
    drawShots(ctx, view);
    drawShuriken(ctx, view);
    G.world.drawBubbles(ctx, view);
    drawParticles(ctx, view);
    drawPopups(ctx);
    drawNameTag(ctx);

    ctx.restore();

    drawMotes(ctx);

    if (G.evolveFlash > 0) {
      ctx.globalAlpha = G.evolveFlash * 0.3;
      ctx.fillStyle = '#c8fbff';
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------------
  // HUD & panels
  // ------------------------------------------------------------------
  function tickHUD(dt) {
    G.hudTimer -= dt;
    if (G.hudTimer <= 0) {
      G.hudTimer = 0.1;
      updateHUD();
      updateAbilityUI();
      updateShotUI();
      updateHudFade();
      updateExploration();
    }
    G.boardTimer -= dt;
    if (G.boardTimer <= 0) {
      G.boardTimer = 0.55;
      drawLeaderboard();
    }
    G.mapTimer -= dt;
    if (G.mapTimer <= 0) {
      G.mapTimer = 0.12;
      drawMinimap();
    }
    G.portraitTimer -= dt;
    if (G.portraitTimer <= 0) {
      G.portraitTimer = 0.14;
      drawPortrait();
    }
  }

  function updateHUD() {
    const p = G.player;
    if (!p) return;
    const stage = A.STAGES[p.stageIndex];
    const next = A.STAGES[p.stageIndex + 1];

    dom.stageTag.textContent = 'STAGE ' + (p.stageIndex + 1);
    dom.fishRole.textContent = stage.role;
    dom.fishName.textContent = stage.name;

    const hp = Math.max(0, p.health);
    dom.healthText.textContent = Math.ceil(hp);
    dom.healthFill.style.width = A.clamp((hp / p.maxHealth) * 100, 0, 100) + '%';

    const hunger = Math.max(0, p.hunger);
    dom.hungerText.textContent = Math.ceil(hunger);
    dom.hungerFill.style.width = A.clamp((hunger / p.maxHunger) * 100, 0, 100) + '%';

    if (next) {
      const base = stage.xpReq;
      const span = next.xpReq - base;
      const pct = A.clamp(((p.xp - base) / span) * 100, 0, 100);
      dom.xpFill.style.width = pct + '%';
      dom.xpText.textContent = Math.floor(p.xp) + ' / ' + next.xpReq;
    } else {
      dom.xpFill.style.width = '100%';
      dom.xpText.textContent = A.formatNumber(p.xp) + ' XP - APEX';
    }

    for (let i = 0; i < G.pipEls.length; i++) {
      const el = G.pipEls[i];
      el.classList.toggle('done', i <= p.stageIndex);
      el.classList.toggle('next', i === p.stageIndex + 1);
    }

    dom.scoreText.textContent = A.formatNumber(Math.floor(p.xp) + G.eaten * 15);
    dom.timeText.textContent = A.formatTime(G.runTime);
    dom.eatenText.textContent = G.eaten;
    dom.starvationWarn.classList.toggle('show', p.hunger <= 12 || p.health < 25);
  }

  function updateExploration() {
    const p = G.player;
    if (!p) return;

    const zone = A.zoneAt(p.y);
    if (zone.id !== G.zoneId) {
      G.zoneId = zone.id;
      if (A.Quests) A.Quests.zone(zone);
      dom.zoneName.textContent = zone.name;
      dom.zoneChip.classList.add('show');
      if (G.sim > (G.zoneBannerAt || 0)) {
        G.zoneBannerAt = G.sim + 7;
        showBanner(zone.name.toUpperCase(), zone.hazard > 1 ? 'DEEP WATER - BIG APPETITES' : 'DEPTH ' + Math.round(p.y / 10) + 'M', 2100);
        A.Audio.discover();
      }
    }

    const markers = G.world.mapMarkers;
    for (let i = 0; i < markers.length; i++) {
      const m = markers[i];
      if (m.seen) continue;
      const rr = m.r + 300;
      if (A.dist2(p.x, p.y, m.x, m.y) < rr * rr) {
        m.seen = true;
        G.poiFound++;
        if (A.Quests) A.Quests.site();
        dom.poiCount.textContent = G.poiFound + ' / ' + G.poiTotal + ' SITES';
        dom.zoneChip.classList.add('show');
        showBanner('SITE FOUND - ' + m.label.toUpperCase(),
          G.poiFound + ' of ' + G.poiTotal + ' landmarks charted', 2600);
        A.Audio.discover();
      }
    }

    // One telegraph per hunt: the ring and the call already do the rest.
    const warnR = A.ORCA_BEHAVIOR.warnRadius;
    for (let i = 0; i < G.fishes.length; i++) {
      const f = G.fishes[i];
      if (!f.predator || f.dead || f.mode === 'feed' || f.mode === 'retreat') continue;
      if (f.mode !== 'chase' && f.mode !== 'burst') continue;
      if (A.dist2(p.x, p.y, f.x, f.y) > warnR * warnR) continue;
      if (G.sim < G.orcaWarnAt) break;
      G.orcaWarnAt = G.sim + 11;
      showBanner('ORCA CLOSING', f === G.orcaHunter ? 'It has picked you out - break off and run' : 'A pod is working this water', 2400);
      break;
    }
  }

  // Below forty percent health the screen starts breathing red, the way every
  // action game says "you are one mistake from the end". The whole effect is a
  // single opacity write, and it only writes when the value actually moves.
  function updateDangerVeil() {
    if (!dom.dangerVignette) return;
    const p = G.player;
    let v = 0;
    if (p && G.state === 'playing') {
      const frac = p.health / p.maxHealth;
      if (frac < 0.4) {
        const t = 1 - frac / 0.4;
        const ph = (G.sim * (0.95 + t * 1.15)) % 1;
        const lub = Math.exp(-ph * 11) + 0.5 * Math.exp(-Math.pow((ph - 0.22) * 13, 2));
        v = 0.14 + t * (0.3 + 0.42 * Math.min(1, lub));
      }
    }
    if (Math.abs(v - G.danger) > 0.004) {
      G.danger = v;
      dom.dangerVignette.style.opacity = v.toFixed(3);
    }
  }

  function updateHudFade() {
    const p = G.player;
    if (!p || G.state !== 'playing') return;
    const panels = [dom.statusPanel, dom.rightHud, dom.abilityDock];
    G.rectTimer -= 0.1;   // this runs on the 10Hz HUD tick
    if (G.rectTimer <= 0 || !G.panelRects) {
      G.rectTimer = 0.9;
      if (!G.panelRects) G.panelRects = [null, null, null];
      for (let i = 0; i < panels.length; i++) {
        G.panelRects[i] = panels[i] ? panels[i].getBoundingClientRect() : null;
      }
    }
    const sx = G.w / 2 + (p.x - G.camera.x) * G.camera.zoom;
    const sy = G.h / 2 + (p.y - G.camera.y) * G.camera.zoom;
    const pad = p.radius * G.camera.zoom + 14;
    for (let i = 0; i < panels.length; i++) {
      const el = panels[i];
      if (!el) continue;
      const r = G.panelRects[i];
      if (!r) continue;
      const over = sx + pad > r.left && sx - pad < r.right && sy + pad > r.top && sy - pad < r.bottom;
      el.classList.toggle('hud-under', over);
    }
  }

  function updateAbilityUI(force) {
    const p = G.player;
    if (!p) return;
    const ab = p.ability;

    if (force || G.lastAbilityId !== ab.id) {
      G.lastAbilityId = ab.id;
      dom.abilityIcon.innerHTML = A.ABILITY_ICONS[ab.icon];
      dom.abilityName.textContent = ab.name;
      dom.abilityBtn.title = ab.name + ' - ' + ab.desc + ' (SPACE)';
    }

    const remain = Math.max(0, p.abilityReadyAt - G.sim);
    const active = G.sim < p.abilityActiveUntil;
    const cooling = remain > 0.05;

    dom.abilityBtn.classList.toggle('ready', !cooling);
    dom.abilityBtn.classList.toggle('cooling', cooling);
    dom.abilityBtn.classList.toggle('active', active);

    if (cooling) {
      const frac = A.clamp(remain / ab.cooldown, 0, 1);
      dom.cdOverlay.style.background = 'conic-gradient(rgba(1,13,23,0.84) ' + (frac * 360).toFixed(1) + 'deg, rgba(1,13,23,0) 0deg)';
      dom.cdOverlay.style.opacity = '1';
      dom.cdText.textContent = remain >= 9.95 ? String(Math.ceil(remain)) : remain.toFixed(1);
    } else {
      dom.cdOverlay.style.opacity = '0';
      dom.cdText.textContent = '';
    }

    document.body.classList.toggle('ability-live', active && G.state === 'playing');
  }

  // The trident dock. It only exists while you are carrying one, and its ring
  // counts the surge cooldown. The spear never leaves the jaws, so there is no
  // flight to wait on: the ring is purely the two seconds between rams.
  let lastShotKey = '';
  const SHOT_GLYPH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.4v13.2"/><path d="M7.2 3.2v5.2c0 2.4 2.1 3.9 4.8 3.9s4.8-1.5 4.8-3.9V3.2"/><path d="M7.2 5.6 5.4 3.4M16.8 5.6l1.8-2.2"/><path d="M9.6 15.6h4.8l-2.4 6z" fill="currentColor" stroke="none" opacity=".55"/></svg>';
  const SHURIKEN_GLYPH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.6 14 9.4 21 12l-7 2.6L12 21.4 10 14.6 3 12l7-2.6z"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>';

  function updateShotUI(force) {
    const dock = dom.shotDock;
    if (!dock || !A.Shop || !dom.shotBtn) return;
    const p = G.player;
    const held = G.state === 'playing' && p && p.weapon ? p.weapon : null;
    if (!held) {
      dock.classList.remove('live');
      lastShotKey = '';
      return;
    }
    const shuriken = held === 'abyss_shuriken';
    const item = A.Shop.item(held);
    if (force || lastShotKey !== held) {
      lastShotKey = held;
      dom.shotIcon.innerHTML = shuriken ? SHURIKEN_GLYPH : SHOT_GLYPH;
      dom.shotBtn.setAttribute('aria-label', shuriken ? 'Throw shuriken' : 'Poseidon charge');
      dom.shotBtn.title = shuriken
        ? 'Abyss Shuriken - throw it up out of the jaws (E)'
        : (item ? item.name : 'Trident') + ' - surge forward and ram anything (SPACE)';
    }
    dock.classList.add('live');

    const readyAt = shuriken ? G.shurikenReadyAt : G.chargeReadyAt;
    const span = shuriken ? SHURIKEN.cooldown : A.TRIDENT_CHARGE.cooldown;
    const remain = Math.max(0, readyAt - G.sim);
    const cooling = remain > 0.05;
    const surging = !shuriken && G.sim < (p.chargeUntil || 0);
    dom.shotBtn.classList.toggle('ready', !cooling && !surging);
    dom.shotBtn.classList.toggle('cooling', cooling);

    if (cooling) {
      const frac = A.clamp(remain / span, 0, 1);
      dom.shotCdOverlay.style.background = 'conic-gradient(rgba(1,13,23,0.84) ' + (frac * 360).toFixed(1) + 'deg, rgba(1,13,23,0) 0deg)';
      dom.shotCdOverlay.style.opacity = '1';
      dom.shotCdText.textContent = remain.toFixed(1);
    } else {
      dom.shotCdOverlay.style.opacity = '0';
      dom.shotCdText.textContent = '';
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function drawLeaderboard() {
    const p = G.player;
    if (!p) return;
    const live = !!(A.Online && A.Online.connected && A.Online.connected());
    const body = A.STAGES[p.stageIndex].palette.body;
    let rows;

    if (live) {
      // Online the board is people, not wildlife: active registered players
      // only, with their lifetime XP. Your own row is always present so a
      // lone player still sees their name.
      const acct = A.Account && A.Account.status ? A.Account.status() : null;
      const signedIn = !!(acct && acct.signedIn);
      const myName = (signedIn && A.Account.displayName()) || 'Guest';
      const myXp = signedIn && acct.profile ? (acct.profile.xp | 0) : 0;
      const players = A.Online.players();
      rows = [];
      let mine = false;
      for (let i = 0; i < players.length; i++) {
        const entry = players[i];
        const isMe = !mine && String(entry.name).toLowerCase() === myName.toLowerCase();
        if (isMe) mine = true;
        rows.push({
          name: String(entry.name || 'Guest'),
          xp: entry.xp | 0,
          color: isMe ? body : 'rgba(126, 216, 240, 0.9)',
          me: isMe
        });
      }
      if (!mine) rows.push({ name: myName, xp: myXp, color: body, me: true });
    } else {
      rows = [{
        name: 'YOU',
        xp: p.xp,
        color: body,
        me: true
      }];
      for (let i = 0; i < G.fishes.length; i++) {
        const f = G.fishes[i];
        if (f.dead || f.predator || f.hazard) continue;
        rows.push({ name: f.name, xp: f.xp, color: f.colors.body, me: false });
      }
    }

    rows.sort(function (a, b) { return b.xp - a.xp; });
    const top = rows.slice(0, 5);

    let html = '';
    for (let i = 0; i < top.length; i++) {
      const row = top[i];
      html += '<li class="' + (row.me ? 'me' : '') + '">' +
        '<span class="lb-rank">' + (i + 1) + '</span>' +
        '<span class="lb-dot" style="background:' + row.color + ';color:' + row.color + '"></span>' +
        '<span class="lb-name">' + escapeHtml(row.name) + '</span>' +
        '<span class="lb-xp">' + A.formatNumber(row.xp) + '</span>' +
        '</li>';
    }
    dom.leaderboard.innerHTML = html;
  }

  function drawMinimap() {
    const p = G.player;
    const c = dom.minimap;
    if (!c || !p) return;
    const mctx = c.getContext('2d');
    // The map is authored in a 168x120 logical box and backed by a 2x canvas,
    // so every dot and hairline keeps its designed weight while the backing
    // store stays sharp on a 4K panel.
    const mw = 168;
    const mh = 120;
    const ratio = c.width / mw;
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.clearRect(0, 0, c.width, c.height);
    mctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    mctx.fillStyle = 'rgba(5, 30, 47, 0.92)';
    mctx.fillRect(0, 0, mw, mh);
    mctx.strokeStyle = 'rgba(110, 225, 255, 0.18)';
    mctx.lineWidth = 2;
    mctx.strokeRect(1, 1, mw - 2, mh - 2);

    const sx = mw / W.w;
    const sy = mh / W.h;

    // Depth bands: the minimap doubles as a cross-section of the whole ocean.
    for (let i = 0; i < A.ZONES.length; i++) {
      const z = A.ZONES[i];
      mctx.fillStyle = z.tint;
      mctx.globalAlpha = 0.5;
      mctx.fillRect(2, 2 + z.y0 * (mh - 4), mw - 4, (z.y1 - z.y0) * (mh - 4) + 1);
    }
    mctx.globalAlpha = 1;

    for (let i = 0; i < G.world.caves.length; i++) {
      const cave = G.world.caves[i];
      mctx.fillStyle = 'rgba(1, 10, 17, 0.65)';
      mctx.beginPath();
      mctx.arc(cave.x * sx, cave.y * sy, Math.max(2.4, cave.r * sx * 1.3), 0, TAU);
      mctx.fill();
    }

    const preyThreshold = playerPreyThreshold(p);
    // Orcas pulse so they read as weather, not as another fish. Everything
    // that is neither a threat nor a meal is sampled: 267 dots on a 168px map
    // is noise, and each dot is a canvas path.
    const pulse = 0.45 + 0.55 * Math.abs(Math.sin(G.sim * 2.4));
    for (let i = 0; i < G.fishes.length; i++) {
      const f = G.fishes[i];
      if (f.dead) continue;
      if (f.predator) {
        const mx = f.x * sx;
        const my = f.y * sy;
        mctx.globalAlpha = pulse * 0.55;
        mctx.strokeStyle = '#ff4d68';
        mctx.lineWidth = 1.4;
        mctx.beginPath();
        mctx.arc(mx, my, 7 + pulse * 3, 0, TAU);
        mctx.stroke();
        mctx.globalAlpha = 1;
        mctx.fillStyle = '#ff5f7a';
        mctx.beginPath();
        mctx.arc(mx, my, 3.4, 0, TAU);
        mctx.fill();
        continue;
      }
      const danger = f.radius > p.radius * 1.12;
      const edible = f.radius <= preyThreshold;
      if (f.hazard) {
        mctx.globalAlpha = 0.8;
        mctx.fillStyle = '#ff8fd0';
        mctx.beginPath();
        mctx.arc(f.x * sx, f.y * sy, 2.4, 0, TAU);
        mctx.fill();
        continue;
      }
      if (!danger && !edible && (i & 3) !== 0) continue;
      mctx.fillStyle = danger ? '#ff6b7f' : edible ? '#60ffac' : f.colors.body;
      mctx.globalAlpha = danger || edible ? 0.95 : 0.7;
      mctx.beginPath();
      mctx.arc(f.x * sx, f.y * sy, danger || edible ? 2.6 : 1.8, 0, TAU);
      mctx.fill();
    }
    mctx.globalAlpha = 1;

    // Landmarks across the expanded ocean: spires, crash sites and vent fields.
    const lm = G.world.mapMarkers;
    if (lm) {
      for (let i = 0; i < lm.length; i++) {
        const m = lm[i];
        mctx.globalAlpha = m.seen ? 0.9 : 0.32;
        mctx.fillStyle = m.color;
        mctx.beginPath();
        mctx.moveTo(m.x * sx, m.y * sy - 3.2);
        mctx.lineTo(m.x * sx + 2.8, m.y * sy + 2.2);
        mctx.lineTo(m.x * sx - 2.8, m.y * sy + 2.2);
        mctx.closePath();
        mctx.fill();
      }
      mctx.globalAlpha = 1;
    }

    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.arc(p.x * sx, p.y * sy, 3.4, 0, TAU);
    mctx.fill();
    mctx.strokeStyle = 'rgba(190, 248, 255, 0.9)';
    mctx.lineWidth = 1.4;
    mctx.beginPath();
    mctx.arc(p.x * sx, p.y * sy, 6, 0, TAU);
    mctx.stroke();

    const vw = (G.w / G.camera.zoom) * sx;
    const vh = (G.h / G.camera.zoom) * sy;
    mctx.strokeStyle = 'rgba(200, 245, 255, 0.22)';
    mctx.lineWidth = 1;
    mctx.strokeRect(G.camera.x * sx - vw / 2, G.camera.y * sy - vh / 2, vw, vh);
  }

  function drawPortrait() {
    const p = G.player;
    if (!p) return;
    const c = dom.portrait;
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    g.save();
    g.translate(c.width / 2, c.height / 2 + c.height * 0.047);
    const fake = {
      x: 0, y: 0,
      angle: -0.1 + Math.sin(G.sim * 1.6) * 0.06,
      radius: c.height * 0.289,
      art: p.art,
      colors: p.colors,
      phase: G.sim * 3.6,
      swim: 0.4,
      noShadow: false
    };
    A.FishArt.draw(g, fake, G.sim);
    g.restore();
  }

  // ------------------------------------------------------------------
  // Update loop
  // ------------------------------------------------------------------
  function rebuildGrids() {
    // "Near" follows the visible span so a zoomed-out camera still gives every
    // onscreen fish a full think, while offscreen crowds drop to cheap cruise.
    const zoom = G.camera.zoom || 1;
    const span = Math.max(G.w / zoom, G.h / zoom);
    const r = span * 0.8 + 900;
    G.activeR2 = r * r;
    gridBuild(fishGrid, G.fishes);
    gridBuild(foodGrid, G.foods);
  }

  function updateRemotePlayers(dt) {
    const blend = 1 - Math.exp(-14 * dt);
    for (let i = 0; i < G.remotePlayers.length; i++) {
      const p = G.remotePlayers[i];
      p.x += (p.targetX - p.x) * blend;
      p.y += (p.targetY - p.y) * blend;
      let angleDelta = p.targetAngle - p.angle;
      angleDelta = Math.atan2(Math.sin(angleDelta), Math.cos(angleDelta));
      p.angle += angleDelta * blend;
      p.swim = Math.min(1, p.swim + dt * 2);
    }
  }

  function update(dt) {
    updateRemotePlayers(dt);
    // The secret arena owns its own simulation while the player is inside; the
    // reef keeps every fish, food and timer exactly where it was left.
    if (A.Monsters && A.Monsters.active()) {
      A.Monsters.update(dt);
      return;
    }
    G.world.update(dt, G.sim, G.camera);
    updateMotes(dt);
    updateInk(dt);
    syncWeapon();
    updateShots(dt);
    updateShuriken(dt);
    updateParticles(dt);
    if (A.Collection) A.Collection.update(dt);
    updatePopups(dt);

    if (G.flash > 0) {
      G.flash = Math.max(0, G.flash - dt * 2.6);
      dom.damageFlash.style.opacity = (G.flash * 0.9).toFixed(3);
    }
    updateDangerVeil();
    if (G.evolveFlash > 0) G.evolveFlash = Math.max(0, G.evolveFlash - dt * 1.8);
    if (G.camera.shake > 0) G.camera.shake = Math.max(0, G.camera.shake - dt * 2.4);

    if (G.state === 'playing') {
      rebuildGrids();
      updatePlayer(dt);
      updateAI(dt);
      if (G.state !== 'playing') { compactArrays(); return; }
      handlePlayerFood(dt);
      handlePlayerFish(dt);
      compactArrays();
      updateVitals(dt);
      if (G.state !== 'playing') return;
      checkEvolution();
      maintainPopulation(dt);
      maintainFood(dt);
      updateCamera(dt);
      G.runTime += dt;
      tickHUD(dt);
      if (A.Monsters) A.Monsters.tick();
    } else if (G.state === 'menu') {
      rebuildGrids();
      updateAI(dt);
      compactArrays();
      maintainPopulation(dt);
      maintainFood(dt);
      updateMenuCamera(dt);
    } else if (G.state === 'dead') {
      rebuildGrids();
      updateAI(dt);
      compactArrays();
      maintainPopulation(dt);
      maintainFood(dt);
      updateDeadCamera(dt);
    }
  }

  let lastTs = 0;
  function loop(ts) {
    if (!lastTs) lastTs = ts;
    let rawDt = (ts - lastTs) / 1000;
    let dt = rawDt;
    lastTs = ts;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;

    // Two-way adaptive resolution: shed pixels when the frame budget goes, and
    // buy them back once the ocean turns out to be cheaper than it looked.
    // Measuring at every quality level is what makes the recovery possible.
    if (G.state !== 'paused' && !document.hidden && rawDt > 0 && rawDt < 0.1) {
      G.perfAccum += rawDt;
      G.perfFrames++;
      if (G.perfAccum >= 2.4) {
        const avg = G.perfAccum / G.perfFrames;
        G.perfAccum = 0;
        G.perfFrames = 0;
        if (avg > 0.026) {
          G.goodWindows = 0;
          if (G.quality > 0.5) {
            G.quality = Math.max(0.5, Math.round((G.quality - 0.16) * 100) / 100);
            applyResolution();
          }
        } else if (avg < 0.0118 && G.quality < 1) {
          // Only spend detail back after two clean windows, or the DPR
          // oscillates on a machine that is sitting right on the edge.
          G.goodWindows++;
          if (G.goodWindows >= 2) {
            G.goodWindows = 0;
            G.quality = Math.min(1, Math.round((G.quality + 0.12) * 100) / 100);
            applyResolution();
          }
        } else {
          G.goodWindows = 0;
        }
      }
    } else {
      G.perfAccum = 0;
      G.perfFrames = 0;
    }

    // `frozen` is the mission panel's hold: the reef stops without the pause
    // menu opening over it, so browsing quests can never get you killed.
    if (G.state !== 'paused' && !G.frozen) {
      G.sim += dt;
      update(dt);
    }
    render();
    requestAnimationFrame(loop);
  }


  // Bridge for realtime players and server-confirmed PvP hits.
  A.GameNet = {
    applyPvPHit: function (hit) {
      const p = G.player;
      if (!p || G.state !== 'playing' || !hit) return;
      const amount = A.clamp(Number(hit.damage) || 18, 1, 30);
      const source = {
        isPlayer: true,
        name: String(hit.attackerName || 'Player').slice(0, 16),
        x: A.clamp(Number(hit.x) || p.x, 0, W.w),
        y: A.clamp(Number(hit.y) || p.y, 0, W.h)
      };
      damagePlayer(amount, source);
      addPopup(p.x, p.y - p.radius - 14, '-' + Math.round(amount), '#ff8f6a', 1.1);
    },
    snapshot: function () {
      const p = G.player;
      if (!p || G.state !== 'playing' || (A.Monsters && A.Monsters.active())) return null;
      return {
        name: G.playerName || 'Guest',
        x: p.x,
        y: p.y,
        angle: p.angle,
        stageIndex: p.stageIndex,
        xp: p.xp
      };
    },
    setRemotePlayers: function (players) {
      if (!Array.isArray(players)) players = [];
      const previous = new Map();
      for (let i = 0; i < G.remotePlayers.length; i++) {
        previous.set(G.remotePlayers[i].id, G.remotePlayers[i]);
      }
      const next = [];
      for (let i = 0; i < players.length; i++) {
        const entry = players[i];
        if (!entry || !entry.id) continue;
        const id = String(entry.id);
        const stageIndex = A.clamp(entry.stageIndex | 0, 0, A.STAGES.length - 1);
        const stage = A.STAGES[stageIndex];
        if (!stage) continue;
        const x = A.clamp(Number(entry.x) || 0, 0, W.w);
        const y = A.clamp(Number(entry.y) || 0, 0, W.h);
        const angle = Number(entry.angle) || 0;
        let remote = previous.get(id);
        if (remote) {
          remote.targetX = x;
          remote.targetY = y;
          remote.targetAngle = angle;
          remote.name = String(entry.name || 'Guest').slice(0, 16);
          remote.xp = Math.max(0, Number(entry.xp) || 0);
          if (remote.stageIndex !== stageIndex) {
            remote.stageIndex = stageIndex;
            remote.art = stage.art;
            remote.colors = stage.palette;
            remote.speed = stage.speed;
            remote.radius = stage.radius;
            remote.baseRadius = stage.radius;
          }
        } else {
          remote = {
            id: id,
            remote: true,
            isPlayer: true,
            dead: false,
            name: String(entry.name || 'Guest').slice(0, 16),
            x: x, y: y, angle: angle,
            targetX: x, targetY: y, targetAngle: angle,
            stageIndex: stageIndex,
            art: stage.art,
            colors: stage.palette,
            speed: stage.speed,
            radius: stage.radius,
            baseRadius: stage.radius,
            swim: 0.8,
            phase: G.sim * 3,
            xp: Math.max(0, Number(entry.xp) || 0),
            health: 100,
            maxHealth: 100,
            weapon: null
          };
        }
        next.push(remote);
      }
      G.remotePlayers = next;
    }
  };

  init();
})();
