(function () {
  'use strict';

  const A = window.ABYSS;
  const W = A.WORLD;
  const TAU = A.TAU;
  const FOOD_TARGET = 460;

  const $ = function (id) { return document.getElementById(id); };

  const dom = {
    canvas: $('game'),
    menu: $('menu'),
    playBtn: $('playBtn'),
    soundBtn: $('soundBtn'),
    evolutionPreview: $('evolutionPreview'),
    bestValue: $('bestValue'),
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
    starvationWarn: $('starvationWarn'),
    eventBanner: $('eventBanner'),
    eventBannerTitle: $('eventBannerTitle'),
    eventBannerSub: $('eventBannerSub'),
    toast: $('toast'),
    damageFlash: $('damageFlash'),
    cursor: $('cursor')
  };

  const ctx = dom.canvas.getContext('2d', { alpha: false });

  const G = {
    state: 'menu',
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
    fishes: [],
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
    evolveFlash: 0,
    eaten: 0,
    deathTimer: 0,
    bannerTimer: 0,
    toastTimer: 0,
    lastAbilityId: '',
    pipEls: []
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
    dom.abilityIcon.innerHTML = A.ABILITY_ICONS.boost;
    dom.abilityName.textContent = A.ABILITIES.boost.name;
    resetMenuScene();
    setState('menu');
    requestAnimationFrame(loop);
    A.game = G;
  }

  function resetMenuScene() {
    G.player = null;
    G.fishes.length = 0;
    G.foods.length = 0;
    G.particles.length = 0;
    G.popups.length = 0;
    spawnInitialPopulation(true);
    seedInitialFood();
    G.camera.x = W.w * 0.5;
    G.camera.y = W.h * 0.5;
    G.camera.zoom = A.clamp(G.h / 1150, 0.68, 0.92);
    G.camera.shake = 0;
  }

  function applyResolution() {
    G.dpr = Math.max(0.6, Math.min(window.devicePixelRatio || 1, 1.5) * G.quality);
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
    A.STAGES.forEach(function (stage, i) {
      const card = document.createElement('div');
      card.className = 'evo-card';
      card.style.setProperty('--glow', hexToRgba(stage.palette.body, 0.22));

      const canvas = document.createElement('canvas');
      canvas.width = 260;
      canvas.height = 170;
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
    const x = A.clamp(W.w / 2 + A.rand(-520, 520), W.margin + 60, W.w - W.margin - 60);
    const y = A.clamp(W.h / 2 + A.rand(-360, 360), W.margin + 60, W.h - W.margin - 60);
    G.player = {
      isPlayer: true,
      name: 'You',
      stageIndex: 0,
      art: stage.art,
      colors: stage.palette,
      x: x,
      y: y,
      angle: A.rand(0, TAU),
      speed: stage.speed,
      radius: stage.radius,
      baseRadius: stage.radius,
      speedSmooth: 0,
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
      noShadow: false
    };
  }

  function startRun() {
    A.Audio.init();
    A.Audio.click();
    clearOverlayTimers();
    G.fishes.length = 0;
    G.foods.length = 0;
    G.particles.length = 0;
    G.popups.length = 0;
    G.runTime = 0;
    G.eaten = 0;
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

    createPlayer();
    spawnInitialPopulation(false);
    const p = G.player;
    for (let i = 0; i < 7; i++) {
      spawnAI(0, { scale: A.rand(0.58, 0.8), near: p });
    }
    seedInitialFood();

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
    if (G.player && G.player.xp > 0) saveBest(G.player);
    G.player = null;
    dom.damageFlash.style.opacity = '0';
    setState('menu');
    updateBestUI();
    if (G.fishes.length < 24) {
      const missing = A.TIER_TARGETS[0] - G.fishes.filter(function (f) { return f.stageIndex === 0; }).length;
      for (let i = 0; i < Math.max(0, missing); i++) spawnAI(0, {});
    }
    if (G.foods.length < 120) {
      for (let i = G.foods.length; i < 200; i++) spawnFoodRandom(0);
    }
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
          time: Math.floor(G.runTime)
        }));
      } catch (e) { /* storage unavailable */ }
    }
  }

  function updateBestUI() {
    const b = getBest();
    if (!b) {
      dom.bestValue.textContent = 'No runs yet - the reef awaits.';
      return;
    }
    const stage = A.STAGES[A.clamp(b.stageIndex || 0, 0, A.STAGES.length - 1)];
    dom.bestValue.textContent = stage.name + ' - ' + A.formatNumber(b.xp) + ' XP - ' + A.formatTime(b.time || 0);
  }

  // ------------------------------------------------------------------
  // Spawning
  // ------------------------------------------------------------------
  function findSpawnSpot(minDist, point) {
    const m = 230;
    for (let i = 0; i < 40; i++) {
      const x = A.rand(m, W.w - m);
      const y = A.rand(m, W.h - m);
      if (point && minDist && A.dist2(x, y, point.x, point.y) < minDist * minDist) continue;
      return { x: x, y: y };
    }
    return { x: A.rand(m, W.w - m), y: A.rand(m, W.h - m) };
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
    } else if (tierIndex === 4) {
      // Natural spatial distribution for the 2-4 apex sharks across distinct territories
      const existingSharks = G.fishes.filter(function (f) { return !f.dead && f.stageIndex === 4; });
      const zoneIdx = existingSharks.length % 3;
      const zones = [
        { x: W.w * 0.28, y: W.h * 0.38 }, // North-west open reef
        { x: W.w * 0.76, y: W.h * 0.46 }, // East hunting grounds
        { x: W.w * 0.50, y: W.h * 0.80 }  // Deep southern trench
      ];
      const z = zones[zoneIdx];
      pos = {
        x: A.clamp(z.x + A.rand(-380, 380), 300, W.w - 300),
        y: A.clamp(z.y + A.rand(-260, 260), 300, W.h - 300)
      };
    } else {
      const p = G.player;
      let minD = 0;
      if (p) {
        minD = tierIndex === 0 ? 620 : tierIndex === 1 ? 760 : tierIndex === 2 ? 950 : 1180;
      }
      pos = findSpawnSpot(minD, p);
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
      dead: false
    };
    G.fishes.push(ai);
    return ai;
  }

  function spawnInitialPopulation(menu) {
    for (let tier = 0; tier < A.STAGES.length; tier++) {
      const count = A.TIER_TARGETS[tier];
      for (let i = 0; i < count; i++) {
        spawnAI(tier, menu ? { menu: true } : {});
      }
    }
  }

  function makeFood(x, y) {
    let kind = 0;
    const roll = Math.random();
    let acc = 0;
    for (let i = 0; i < A.FOOD.length; i++) {
      acc += A.FOOD[i].weight;
      if (roll <= acc) { kind = i; break; }
    }
    const type = A.FOOD[kind];
    return {
      x: x,
      y: y,
      r: type.radius,
      kind: kind,
      xp: type.xp,
      phase: A.rand(0, TAU),
      dead: false
    };
  }

  function spawnFoodAt(x, y) {
    G.foods.push(makeFood(
      A.clamp(x, 90, W.w - 90),
      A.clamp(y, 90, W.h - 90)
    ));
  }

  function spawnFoodRandom(minDistFromPlayer) {
    let x = A.rand(110, W.w - 110);
    let y = A.rand(110, W.h - 110);
    if (G.player && minDistFromPlayer) {
      for (let i = 0; i < 14; i++) {
        if (A.dist2(x, y, G.player.x, G.player.y) >= minDistFromPlayer * minDistFromPlayer) break;
        x = A.rand(110, W.w - 110);
        y = A.rand(110, W.h - 110);
      }
    }
    spawnFoodAt(x, y);
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

    if (ab.id === 'chomp' && G.mouse.active && !keyboardDir()) {
      const target = pointerWorld();
      p.angle = Math.atan2(target.y - p.y, target.x - p.x);
    }

    p.abilityActiveUntil = G.sim + ab.duration;
    p.abilityReadyAt = G.sim + ab.cooldown;
    p.fxTimer = 0;
    G.camera.shake = Math.min(1, G.camera.shake + 0.22);
    A.Audio.ability();
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

  function onKeyDown(e) {
    if (e.code === 'Space') {
      e.preventDefault();
      if (G.state === 'playing') useAbility();
      else if (G.state === 'menu') startRun();
      return;
    }
    if (MOVE_CODES[e.code]) {
      if (e.code.indexOf('Arrow') === 0) e.preventDefault();
      G.keys[e.code] = true;
      G.mouse.active = false;
      return;
    }
    const key = (e.key || '').toLowerCase();
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

    const kb = keyboardDir();
    let dist = 0;
    if (kb) {
      p.angle = A.angleDamp(p.angle, Math.atan2(kb.y, kb.x), 10, dt);
    } else if (G.mouse.active) {
      const target = pointerWorld();
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 16) {
        p.angle = A.angleDamp(p.angle, Math.atan2(dy, dx), 8, dt);
      }
    }

    const mult = active && ab.speed ? ab.speed : 1;
    let desired = 0;
    if (kb) {
      desired = p.speed * mult;
    } else if (G.mouse.active && dist > 16) {
      desired = p.speed * mult * A.clamp((dist - 12) / 130, 0, 1);
    }
    p.speedSmooth = A.damp(p.speedSmooth, desired, kb ? 9.5 : 7, dt);

    p.x += Math.cos(p.angle) * p.speedSmooth * dt + p.knockX * dt;
    p.y += Math.sin(p.angle) * p.speedSmooth * dt + p.knockY * dt;
    p.knockX = A.damp(p.knockX, 0, 7, dt);
    p.knockY = A.damp(p.knockY, 0, 7, dt);
    p.x = A.clamp(p.x, W.margin, W.w - W.margin);
    p.y = A.clamp(p.y, W.margin, W.h - W.margin);

    p.swim = A.clamp(p.speedSmooth / Math.max(1, p.speed), 0.22, 1.4);
    p.phase += dt * (3.2 + 6.5 * p.swim);
    p.hitFlash = Math.max(0, p.hitFlash - dt);

    if (active) {
      p.fxTimer -= dt;
      if (p.fxTimer <= 0) {
        p.fxTimer = ab.id === 'chomp' ? 0.025 : 0.055;
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

    showBanner(stage.name.toUpperCase(), 'EVOLUTION ' + (p.stageIndex + 1) + ' / 5 - ' + stage.ability.name.toUpperCase() + ' UNLOCKED', 2800);
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
    saveBest(p);
    G.deathCam.x = G.camera.x;
    G.deathCam.y = G.camera.y;
    deathBurst(p);
    G.player = null;

    A.Audio.death();
    setState('dead');
    dom.damageFlash.style.opacity = '0';
    G.flash = 0;

    dom.deathStage.textContent = A.STAGES[p.stageIndex].name + ' (Stage ' + (p.stageIndex + 1) + ')';
    dom.deathScore.textContent = A.formatNumber(score);
    dom.deathEaten.textContent = G.eaten;
    dom.deathTime.textContent = A.formatTime(G.runTime);
    dom.deathSub.textContent = killer
      ? killer.name + ' got the better of you.'
      : 'Starvation pulled you down into the dark.';
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
  function aiThink(ai) {
    ai.think = A.rand(0.28, 0.5);
    const p = (G.state === 'playing') ? G.player : null;

    let threat = null;
    let threatD = Infinity;

    if (p && p.radius > ai.radius * 1.04) {
      const d = A.dist2(ai.x, ai.y, p.x, p.y);
      if (d < 320 * 320) { threat = p; threatD = d; }
    }
    for (let i = 0; i < G.fishes.length; i++) {
      const o = G.fishes[i];
      if (o === ai || o.dead) continue;
      if (o.radius > ai.radius * 1.08) {
        const d = A.dist2(ai.x, ai.y, o.x, o.y);
        if (d < 290 * 290 && d < threatD) { threat = o; threatD = d; }
      }
    }

    if (threat) {
      ai.mode = 'flee';
      ai.threat = threat;
      ai.prey = null;
      ai.foodRef = null;
      ai.targetAngle = Math.atan2(ai.y - threat.y, ai.x - threat.x) + (ai.seed * 0.2 - 0.1);
      ai.speedMul = 1.45;
      return;
    }
    ai.threat = null;

    if (p && ai.radius > p.radius * 1.12) {
      const d = A.dist2(ai.x, ai.y, p.x, p.y);
      if (d < 450 * 450) {
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

    let prey = null;
    let preyScore = -Infinity;
    const wantsPrey = ai.tier >= 3 || Math.random() < ai.aggression * 0.55 || ai.hunger < 45;
    if (wantsPrey) {
      for (let i = 0; i < G.fishes.length; i++) {
        const o = G.fishes[i];
        if (o === ai || o.dead) continue;
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
      for (let i = 0; i < G.foods.length; i++) {
        const f = G.foods[i];
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
      if (ai.stageIndex === 4) {
        // Apex sharks patrol expansive oceanic paths with deliberate cruising headings
        const patrolDist = A.rand(700, 1200);
        const patrolAngle = ai.angle + A.rand(-0.75, 0.75);
        ai.targetX = A.clamp(ai.x + Math.cos(patrolAngle) * patrolDist, 280, W.w - 280);
        ai.targetY = A.clamp(ai.y + Math.sin(patrolAngle) * patrolDist, 280, W.h - 280);
        ai.wanderUntil = G.sim + A.rand(4.5, 8.5);
      } else {
        ai.targetX = A.clamp(ai.x + A.rand(-480, 480), 220, W.w - 220);
        ai.targetY = A.clamp(ai.y + A.rand(-480, 480), 220, W.h - 220);
        ai.wanderUntil = G.sim + A.rand(2, 5);
      }
    }
    ai.targetAngle = Math.atan2(ai.targetY - ai.y, ai.targetX - ai.x);
    ai.speedMul = ai.stageIndex === 4 ? 0.62 : 0.5;
  }

  function updateAI(dt) {
    const fishes = G.fishes;
    for (let i = fishes.length - 1; i >= 0; i--) {
      const ai = fishes[i];
      if (ai.dead) continue;

      ai.think -= dt;
      if (ai.think <= 0) aiThink(ai);

      let targetAngle = ai.targetAngle;
      const p = G.player;
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
      if (ai.x < m || ai.x > W.w - m || ai.y < m || ai.y > W.h - m) {
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
      ai.y = A.clamp(ai.y, W.margin, W.h - W.margin);

      ai.swim = A.clamp(ai.speedSmooth / Math.max(40, ai.cruise), 0, 1.4);
      const phaseRate = ai.stageIndex === 4 ? (1.8 + 4.2 * ai.swim) : (2.6 + 6 * ai.swim);
      ai.phase += dt * phaseRate;
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

  function separateFish() {
    const list = G.fishes;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.dead) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.dead) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = (a.radius + b.radius) * 0.7;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.001 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const push = (min - d) * 0.5;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
    for (let i = 0; i < list.length; i++) {
      list[i].x = A.clamp(list[i].x, W.margin, W.w - W.margin);
      list[i].y = A.clamp(list[i].y, W.margin, W.h - W.margin);
    }
  }

  function consumeFoodAI(ai, f) {
    f.dead = true;
    const idx = G.foods.indexOf(f);
    if (idx >= 0) G.foods.splice(idx, 1);
    ai.hunger = Math.min(100, ai.hunger + 8);
    ai.xp += Math.round(f.xp * 0.6);
    ai.foodRef = null;
    ai.think = 0;
    spawnSparks(f.x, f.y, [A.FOOD[f.kind].color, '#ffffff'], 3, 50, 1.6);
  }

  function eatPreyAI(ai, prey) {
    prey.dead = true;
    const idx = G.fishes.indexOf(prey);
    if (idx >= 0) G.fishes.splice(idx, 1);
    for (let i = 0; i < G.fishes.length; i++) {
      if (G.fishes[i].prey === prey) G.fishes[i].prey = null;
    }
    ai.hunger = Math.min(100, ai.hunger + 16);
    ai.xp += 30 + prey.tier * 22;
    ai.radius = Math.min(ai.baseRadius * 1.35, ai.radius * 1.02);
    ai.prey = null;
    ai.think = 0;
    spawnSparks(prey.x, prey.y, [prey.colors.body, prey.colors.fin, '#ffffff'], 8, 100, 2.2);
  }

  // ------------------------------------------------------------------
  // Player interactions with food and fish
  // ------------------------------------------------------------------
  function handlePlayerFood(dt) {
    const p = G.player;
    if (!p) return;
    const magnetR = p.radius * 3.6;
    const list = G.foods;
    for (let i = list.length - 1; i >= 0; i--) {
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

  function eatFood(f) {
    f.dead = true;
    const idx = G.foods.indexOf(f);
    if (idx >= 0) G.foods.splice(idx, 1);
    const p = G.player;
    if (!p) return;
    const type = A.FOOD[f.kind];
    p.xp += f.xp;
    p.hunger = Math.min(p.maxHunger, p.hunger + (f.kind === 0 ? 1.6 : f.kind === 1 ? 3.2 : 6));
    addPopup(f.x, f.y - 10, '+' + f.xp + ' XP', type.color, f.kind === 2 ? 1.25 : 0.95);
    spawnSparks(f.x, f.y, [type.core, type.color, '#ffffff'], 5 + f.kind * 2, 70, 2 + f.kind);
    A.Audio.pop(f.kind * 140);
  }

  function playerPreyThreshold(p) {
    let threshold = p.radius * 0.86;
    if (G.sim < p.abilityActiveUntil) {
      if (p.ability.id === 'frenzy') threshold = p.radius * 0.98;
      else if (p.ability.id === 'chomp') threshold = p.radius * 1.02;
    }
    return threshold;
  }

  function handlePlayerFish() {
    const p = G.player;
    if (!p) return;
    const active = G.sim < p.abilityActiveUntil;
    const ab = p.ability;
    const threshold = playerPreyThreshold(p);
    let reachMul = 1;
    if (active && ab.id === 'frenzy') reachMul = 1.5;
    if (active && ab.id === 'chomp') reachMul = 2.6;

    const list = G.fishes;
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i];
      if (f.dead) continue;
      const dx = p.x - f.x;
      const dy = p.y - f.y;
      const d2 = dx * dx + dy * dy;

      if (f.radius <= threshold) {
        const reach = (p.radius * 0.9 + f.radius * 0.6) * reachMul;
        if (d2 < reach * reach) {
          eatFish(f);
          continue;
        }
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
          p.y = A.clamp(p.y, W.margin, W.h - W.margin);
          f.x = A.clamp(f.x, W.margin, W.w - W.margin);
          f.y = A.clamp(f.y, W.margin, W.h - W.margin);
        }
      }
    }
  }

  function eatFish(f) {
    const p = G.player;
    if (!p) return;
    f.dead = true;
    const idx = G.fishes.indexOf(f);
    if (idx >= 0) G.fishes.splice(idx, 1);
    for (let i = 0; i < G.fishes.length; i++) {
      if (G.fishes[i].prey === f) G.fishes[i].prey = null;
    }

    const gain = Math.round(18 + f.tier * 16 + f.radius * 0.35);
    p.xp += gain;
    p.hunger = Math.min(p.maxHunger, p.hunger + 12);
    G.eaten++;
    G.camera.shake = Math.min(1, G.camera.shake + 0.28);

    A.Audio.chomp();
    addPopup(f.x, f.y - (f.radius + 8), '+' + gain + ' XP', '#ffe08a', 1.1);
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
  }

  // ------------------------------------------------------------------
  // Maintenance
  // ------------------------------------------------------------------
  function maintainPopulation(dt) {
    G.popTimer -= dt;
    if (G.popTimer > 0) return;
    G.popTimer = 0.6;
    const counts = [0, 0, 0, 0, 0];
    for (let i = 0; i < G.fishes.length; i++) {
      const f = G.fishes[i];
      if (!f.dead && f.stageIndex >= 0 && f.stageIndex < 5) counts[f.stageIndex]++;
    }
    for (let tier = 0; tier < A.STAGES.length; tier++) {
      if (counts[tier] < A.TIER_TARGETS[tier]) spawnAI(tier, {});
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
    if (G.particles.length >= 240) G.particles.shift();
    G.particles.push(p);
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

  function drawFoods(ctx, view) {
    const t = G.sim;
    for (let i = 0; i < G.foods.length; i++) {
      const f = G.foods[i];
      if (f.dead || !inView(f.x, f.y, f.r * 5, view)) continue;
      const type = A.FOOD[f.kind];
      const bob = Math.sin(t * 2 + f.phase) * 1.6;
      const y = f.y + bob;
      const pulse = 0.9 + Math.sin(t * 2.6 + f.phase) * 0.1;
      if (G.quality >= 0.9 || f.kind !== 0) {
        const gs = f.r * (f.kind === 2 ? 6.2 : 5.1) * pulse;
        ctx.globalAlpha = f.kind === 2 ? 0.7 : 0.48;
        ctx.drawImage(A.glowSprite(type.glow), f.x - gs / 2, y - gs / 2, gs, gs);
        ctx.globalAlpha = 1;
      }

      if (f.kind === 0) {
        ctx.save();
        ctx.translate(f.x, y);
        ctx.rotate(t * 0.8 + f.phase);
        ctx.fillStyle = type.core;
        ctx.beginPath();
        ctx.arc(0, 0, f.r * 0.55, 0, TAU);
        ctx.fill();
        ctx.fillStyle = type.color;
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * TAU;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * f.r * 0.85, Math.sin(a) * f.r * 0.85, f.r * 0.33, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      } else if (f.kind === 1) {
        ctx.beginPath();
        ctx.arc(f.x, y, f.r, 0, TAU);
        ctx.fillStyle = type.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(90, 30, 50, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = type.core;
        ctx.beginPath();
        ctx.arc(f.x - f.r * 0.3, y - f.r * 0.35, f.r * 0.34, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#5fd6a0';
        ctx.beginPath();
        ctx.ellipse(f.x + f.r * 0.75, y - f.r * 0.85, f.r * 0.52, f.r * 0.24, -0.6, 0, TAU);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(f.x, y, f.r, 0, TAU);
        ctx.fillStyle = '#fff8e6';
        ctx.fill();
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(f.x, y, f.r * 0.7, 0, TAU);
        ctx.fillStyle = type.color;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(f.x - f.r * 0.24, y - f.r * 0.3, f.r * 0.28, 0, TAU);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.globalAlpha = 0.45 + Math.sin(t * 4 + f.phase) * 0.35;
        ctx.strokeStyle = '#fff4c2';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(f.x + f.r * 1.4, y);
        ctx.lineTo(f.x + f.r * 2.05, y);
        ctx.moveTo(f.x + f.r * 1.72, y - f.r * 0.32);
        ctx.lineTo(f.x + f.r * 1.72, y + f.r * 0.32);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

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
    if (f.radius > p.radius * 1.12) rgb = '255, 86, 108';
    else if (f.radius <= preyThreshold) rgb = '96, 255, 172';
    else return;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.angle);
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

  function drawFishLayer(ctx, view) {
    const list = [];
    for (let i = 0; i < G.fishes.length; i++) {
      const f = G.fishes[i];
      if (f.dead || !inView(f.x, f.y, f.radius * 3, view)) continue;
      list.push(f);
    }
    if (G.player) list.push(G.player);

    list.sort(function (a, b) { return a.y - b.y; });

    const preyThreshold = G.player ? playerPreyThreshold(G.player) : 0;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (!f.isPlayer && G.player) drawRelationRing(ctx, f, preyThreshold);
      if (f.isPlayer) drawPlayerHalo(ctx, f);
      if (f.isPlayer && G.sim < f.invulnUntil) {
        ctx.globalAlpha = 0.68 + 0.32 * Math.abs(Math.sin(G.sim * 14));
      }
      A.FishArt.draw(ctx, f, G.sim);
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
    } else if (ab.id === 'chomp') {
      const g = A.glowSprite(p.colors.accent);
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.drawImage(g, p.x - p.radius * 1.8, p.y - p.radius * 1.8, p.radius * 3.6, p.radius * 3.6);
      ctx.restore();
    }
  }

  function render() {
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
    drawFoods(ctx, view);
    drawFishLayer(ctx, view);
    G.world.drawBubbles(ctx, view);
    drawParticles(ctx, view);
    drawPopups(ctx);

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
      updateHudFade();
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

  function updateHudFade() {
    const p = G.player;
    if (!p || G.state !== 'playing') return;
    const sx = G.w / 2 + (p.x - G.camera.x) * G.camera.zoom;
    const sy = G.h / 2 + (p.y - G.camera.y) * G.camera.zoom;
    const pad = p.radius * G.camera.zoom + 14;
    const panels = [dom.statusPanel, dom.rightHud, dom.abilityDock];
    for (let i = 0; i < panels.length; i++) {
      const el = panels[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
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

  function drawLeaderboard() {
    const p = G.player;
    if (!p) return;
    const rows = [{
      name: 'YOU',
      xp: p.xp,
      color: A.STAGES[p.stageIndex].palette.body,
      me: true
    }];
    for (let i = 0; i < G.fishes.length; i++) {
      const f = G.fishes[i];
      if (f.dead) continue;
      rows.push({ name: f.name, xp: f.xp, color: f.colors.body, me: false });
    }
    rows.sort(function (a, b) { return b.xp - a.xp; });
    const top = rows.slice(0, 5);

    let html = '';
    for (let i = 0; i < top.length; i++) {
      const row = top[i];
      html += '<li class="' + (row.me ? 'me' : '') + '">' +
        '<span class="lb-rank">' + (i + 1) + '</span>' +
        '<span class="lb-dot" style="background:' + row.color + ';color:' + row.color + '"></span>' +
        '<span class="lb-name">' + (row.me ? 'YOU' : row.name) + '</span>' +
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
    const mw = c.width;
    const mh = c.height;
    mctx.clearRect(0, 0, mw, mh);

    mctx.fillStyle = 'rgba(5, 30, 47, 0.92)';
    mctx.fillRect(0, 0, mw, mh);
    mctx.strokeStyle = 'rgba(110, 225, 255, 0.18)';
    mctx.lineWidth = 2;
    mctx.strokeRect(1, 1, mw - 2, mh - 2);

    const sx = mw / W.w;
    const sy = mh / W.h;

    for (let i = 0; i < G.world.caves.length; i++) {
      const cave = G.world.caves[i];
      mctx.fillStyle = 'rgba(1, 10, 17, 0.65)';
      mctx.beginPath();
      mctx.arc(cave.x * sx, cave.y * sy, Math.max(2.4, cave.r * sx * 1.3), 0, TAU);
      mctx.fill();
    }

    const preyThreshold = playerPreyThreshold(p);
    for (let i = 0; i < G.fishes.length; i++) {
      const f = G.fishes[i];
      if (f.dead) continue;
      const danger = f.radius > p.radius * 1.12;
      const edible = f.radius <= preyThreshold;
      mctx.fillStyle = danger ? '#ff6b7f' : edible ? '#60ffac' : f.colors.body;
      mctx.globalAlpha = danger || edible ? 0.95 : 0.7;
      mctx.beginPath();
      mctx.arc(f.x * sx, f.y * sy, danger || edible ? 2.6 : 1.8, 0, TAU);
      mctx.fill();
    }
    mctx.globalAlpha = 1;

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
    g.translate(c.width / 2, c.height / 2 + 6);
    const fake = {
      x: 0, y: 0,
      angle: -0.1 + Math.sin(G.sim * 1.6) * 0.06,
      radius: 37,
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
  function update(dt) {
    G.world.update(dt, G.sim);
    updateMotes(dt);
    updateParticles(dt);
    updatePopups(dt);

    if (G.flash > 0) {
      G.flash = Math.max(0, G.flash - dt * 2.6);
      dom.damageFlash.style.opacity = (G.flash * 0.9).toFixed(3);
    }
    if (G.evolveFlash > 0) G.evolveFlash = Math.max(0, G.evolveFlash - dt * 1.8);
    if (G.camera.shake > 0) G.camera.shake = Math.max(0, G.camera.shake - dt * 2.4);

    if (G.state === 'playing') {
      updatePlayer(dt);
      updateAI(dt);
      if (G.state !== 'playing') return;
      handlePlayerFood(dt);
      handlePlayerFish();
      updateVitals(dt);
      if (G.state !== 'playing') return;
      checkEvolution();
      maintainPopulation(dt);
      maintainFood(dt);
      updateCamera(dt);
      G.runTime += dt;
      tickHUD(dt);
    } else if (G.state === 'menu') {
      updateAI(dt);
      maintainPopulation(dt);
      maintainFood(dt);
      updateMenuCamera(dt);
    } else if (G.state === 'dead') {
      updateAI(dt);
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

    if (G.quality > 0.6 && G.state !== 'paused' && !document.hidden && rawDt > 0 && rawDt < 0.1) {
      G.perfAccum += rawDt;
      G.perfFrames++;
      if (G.perfAccum >= 2.4) {
        const avg = G.perfAccum / G.perfFrames;
        G.perfAccum = 0;
        G.perfFrames = 0;
        if (avg > 0.026) {
          G.quality = Math.max(0.6, Math.round((G.quality - 0.16) * 100) / 100);
          applyResolution();
        }
      }
    } else {
      G.perfAccum = 0;
      G.perfFrames = 0;
    }

    if (G.state !== 'paused') {
      G.sim += dt;
      update(dt);
    }
    render();
    requestAnimationFrame(loop);
  }

  init();
})();
