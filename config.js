(function () {
  'use strict';

  const A = window.ABYSS = window.ABYSS || {};

  A.WORLD = { w: 14000, h: 9600, margin: 150 };
  A.TAU = Math.PI * 2;
  A.PI = Math.PI;

  // --- Depth bands ---------------------------------------------------------
  // One shared vocabulary for "where am I". world.js tunes its visuals and
  // game.js raises a banner when the player crosses from one band into the
  // next, so both layers stay in step when the world grows.
  A.ZONES = [
    { id: 'surface', name: 'Sunlit Shallows', y0: 0.00, y1: 0.18, tint: '#0d9ec4', hazard: 0 },
    { id: 'reef', name: 'Coral Gardens', y0: 0.18, y1: 0.36, tint: '#0a86ad', hazard: 0 },
    { id: 'kelp', name: 'Kelp Forest', y0: 0.36, y1: 0.52, tint: '#076b91', hazard: 0 },
    { id: 'basin', name: 'Open Basin', y0: 0.52, y1: 0.68, tint: '#044f72', hazard: 1 },
    { id: 'trench', name: 'Granite Trench', y0: 0.68, y1: 0.82, tint: '#023454', hazard: 2 },
    { id: 'abyss', name: 'Midnight Abyss', y0: 0.82, y1: 0.93, tint: '#01182e', hazard: 3 },
    { id: 'vents', name: 'Hydrothermal Vents', y0: 0.93, y1: 1.00, tint: '#0a0a16', hazard: 4 }
  ];

  A.zoneAt = function (y) {
    const t = A.clamp(y / A.WORLD.h, 0, 1);
    for (let i = A.ZONES.length - 1; i >= 0; i--) {
      if (t >= A.ZONES[i].y0) return A.ZONES[i];
    }
    return A.ZONES[0];
  };

  A.clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
  A.lerp = function (a, b, t) { return a + (b - a) * t; };
  A.damp = function (a, b, rate, dt) { return A.lerp(a, b, 1 - Math.exp(-rate * dt)); };
  A.rand = function (lo, hi) { return lo + Math.random() * (hi - lo); };
  A.randInt = function (lo, hi) { return Math.floor(lo + Math.random() * (hi - lo + 1)); };
  A.pick = function (arr) { return arr[(Math.random() * arr.length) | 0]; };
  A.dist2 = function (ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
  A.len = function (x, y) { return Math.sqrt(x * x + y * y); };

  A.angleDiff = function (a, b) {
    let d = (b - a) % A.TAU;
    if (d > A.PI) d -= A.TAU;
    if (d < -A.PI) d += A.TAU;
    return d;
  };
  A.angleLerp = function (a, b, t) { return a + A.angleDiff(a, b) * t; };
  A.angleDamp = function (a, b, rate, dt) { return A.angleLerp(a, b, 1 - Math.exp(-rate * dt)); };

  A.seedRand = function (seed) {
    let s = seed >>> 0;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // --- Color helpers -------------------------------------------------------
  function hexToRgb(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHex(r, g, b) {
    const f = function (v) { return A.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'); };
    return '#' + f(r) + f(g) + f(b);
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4;
      }
      h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    s = A.clamp(s, 0, 100) / 100;
    l = A.clamp(l, 0, 100) / 100;
    if (s === 0) {
      const v = Math.round(l * 255);
      return { r: v, g: v, b: v };
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue = function (t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return { r: hue(h + 1 / 3) * 255, g: hue(h) * 255, b: hue(h - 1 / 3) * 255 };
  }

  A.shiftColor = function (hex, dh, satMul, lightMul) {
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    hsl.h += dh;
    hsl.s = A.clamp(hsl.s * (satMul || 1), 4, 100);
    hsl.l = A.clamp(hsl.l * (lightMul || 1), 6, 96);
    const out = hslToRgb(hsl.h, hsl.s, hsl.l);
    return rgbToHex(out.r, out.g, out.b);
  };

  A.makeAIPalette = function (base, shift) {
    return {
      body: A.shiftColor(base.body, shift, 1, 1),
      dark: A.shiftColor(base.dark, shift, 1, 0.98),
      belly: base.belly,
      fin: A.shiftColor(base.fin, shift * 1.1, 1.02, 1.02),
      accent: A.shiftColor(base.accent, shift * 0.8, 1, 1),
      outline: base.outline,
      glow: A.shiftColor(base.glow, shift, 1, 1)
    };
  };

  // --- Abilities -----------------------------------------------------------
  A.ABILITIES = {
    boost: {
      id: 'boost', name: 'Bubble Boost', icon: 'boost',
      cooldown: 6, duration: 0.7, speed: 2.35,
      desc: 'Jet forward on a burst of bubbles.'
    },
    shield: {
      id: 'shield', name: 'Coral Shield', icon: 'shield',
      cooldown: 12, duration: 4, shield: 0.65,
      desc: 'Living coral armor absorbs 65% of incoming damage.'
    },
    surge: {
      id: 'surge', name: 'Current Surge', icon: 'surge',
      cooldown: 10, duration: 2.4, speed: 1.9,
      desc: 'Ride a hidden current at blistering speed.'
    },
    frenzy: {
      id: 'frenzy', name: 'Frenzy Bite', icon: 'frenzy',
      cooldown: 14, duration: 5, speed: 1.18, eat: 1.75,
      desc: 'Widen your bite and strike faster for five seconds.'
    },
    chomp: {
      id: 'chomp', name: 'Apex Chomp', icon: 'chomp',
      cooldown: 9, duration: 0.55, speed: 3.0, eat: 3.2,
      desc: 'Lunge ahead and devour every smaller fish in your path.'
    },
    // The manta's own move: `flap` tells fish.js to beat both wings hard
    // while the boost is carrying (game.js ramps p.flap from it).
    wingboost: {
      id: 'wingboost', name: 'Wing Boost', icon: 'wingboost',
      cooldown: 8, duration: 3.0, speed: 1.9, eat: 1.15, flap: 1,
      desc: 'Beat both wings hard and carry on a long, fast glide.'
    },
    // The sawshark's own move: a blade-first rush. `slash` is how far forward,
    // in body radii, the rostrum lane reaches and skewers (game.js).
    dash: {
      id: 'dash', name: 'Rip Dash', icon: 'dash',
      cooldown: 7, duration: 0.8, speed: 3.3, eat: 1.9, slash: 3.4,
      desc: 'Kick into a blur and run the saw through everything in your lane.'
    },
    breach: {
      id: 'breach', name: 'Tidal Breach', icon: 'breach',
      cooldown: 11, duration: 0.9, speed: 2.85, eat: 4.2, shock: 3.1,
      desc: 'Throw your whole body forward — swallow all you reach and blast everything else clear.'
    },
    // The megalodon's own move. `fear` is the roar's radius in body radii and
    // `stun` how long the small fish inside it hold still (game.js); `shock`
    // shoves the animals too big to eat clear of the jaws.
    terror: {
      id: 'terror', name: 'Apex Terror', icon: 'terror',
      cooldown: 13, duration: 3.2, speed: 1.45, eat: 2.5, fear: 6.2, stun: 2.4, shock: 2.6,
      desc: 'Roar. Everything small enough to eat freezes where it swims, your gape doubles, and the bigger animals are shoved clear.'
    },
    lure: {
      id: 'lure', name: 'Lure Flash', icon: 'lure',
      cooldown: 10, duration: 2.6, speed: 0.8, eat: 2.1, pull: 300,
      desc: 'Flare the lure and hold still: small fish drift into the light and your gape widens.'
    },
    // The octopus's own move. `ink` is the cloud's reach in body radii,
    // `sting` the share of a victim's maximum health the first touch of a
    // cloud takes, and `blind` how long the ink stays in their face
    // (see castInk / applyInkDamage in game.js).
    ink: {
      id: 'ink', name: 'Ink Cloud', icon: 'ink',
      cooldown: 11, duration: 4.2, speed: 1.55, ink: 4.4, sting: 0.2, blind: 3.4,
      desc: 'Fire a black cloud of ink that blooms around you. Everything it touches loses 20% of its health and loses track of its prey.'
    }
  };

  // --- Playable evolution stages ------------------------------------------
  A.SPECIES = [
    {
      key: 'blue', art: 'blue', name: 'Tiny Blue Fish', role: 'Reef Sprout',
      radius: 13, speed: 180, aiSpeed: 112, aggression: 0.25,
      palette: {
        body: '#3fc9f2', dark: '#1a94c1', belly: '#eafcff', fin: '#ff9fb4',
        accent: '#b9f8ff', outline: '#073f56', glow: '#bdf7ff'
      }
    },
    {
      key: 'coral', art: 'coral', name: 'Coral Fish', role: 'Coral Warden',
      radius: 19, speed: 162, aiSpeed: 100, aggression: 0.35,
      palette: {
        body: '#ff8a5f', dark: '#dd5f3f', belly: '#fff0d9', fin: '#ff5f91',
        accent: '#ffd75e', outline: '#5c1f2b', glow: '#ffd0a0'
      }
    },
    {
      key: 'fast', art: 'fast', name: 'Fast Fish', role: 'Rip Current',
      radius: 25.5, speed: 214, aiSpeed: 156, aggression: 0.5,
      palette: {
        body: '#75e6a2', dark: '#2fa77c', belly: '#edfff4', fin: '#24b4a8',
        accent: '#d4ff9c', outline: '#0a473f', glow: '#c9ffe6'
      }
    },
    {
      key: 'hunter', art: 'hunter', name: 'Hunter Fish', role: 'Deep Stalker',
      radius: 34, speed: 196, aiSpeed: 138, aggression: 0.8,
      palette: {
        body: '#9179f6', dark: '#5a41c7', belly: '#d9cfff', fin: '#ff5c9f',
        accent: '#ffd3f7', outline: '#1d1145', glow: '#ff7ad9'
      }
    },
    {
      key: 'angler', art: 'angler', name: 'Anglerfish', role: 'Deep Lurker',
      radius: 40, speed: 176, aiSpeed: 96, aggression: 0.85,
      palette: {
        body: '#101527', dark: '#04060e', belly: '#1c2540', fin: '#8fb7d6',
        accent: '#7ff0d8', outline: '#01030a', glow: '#c4fff6'
      }
    },
    {
      key: 'shark', art: 'shark', name: 'Apex Shark', role: 'Apex of the Reef',
      radius: 46, speed: 224, aiSpeed: 150, aggression: 0.9,
      palette: {
        body: '#607f99', dark: '#374e61', belly: '#f4f9fd', fin: '#4b677d',
        accent: '#bcd7ea', outline: '#152431', glow: '#a2d6f9'
      }
    },
    {
      key: 'manta', art: 'manta', name: 'Manta Ray', role: 'Glider of the Blue',
      radius: 50, speed: 240, aiSpeed: 158, aggression: 0.58,
      palette: {
        body: '#3f5570', dark: '#1d2a3b', belly: '#eef4f9', fin: '#54708c',
        accent: '#b7d3e6', outline: '#0b121d', glow: '#9fe0ff'
      }
    },
    {
      key: 'sawshark', art: 'sawshark', name: 'Sawshark', role: 'Razormaw of the Deep',
      radius: 54, speed: 252, aiSpeed: 176, aggression: 0.92,
      palette: {
        body: '#8ea3b2', dark: '#4c5f70', belly: '#eef5f9', fin: '#63798c',
        accent: '#d6e8f3', outline: '#16232e', glow: '#a8e6ff'
      }
    },
    {
      key: 'megalodon', art: 'megalodon', name: 'Megalodon', role: 'King of the Ocean',
      radius: 156, speed: 272, aiSpeed: 190, aggression: 0.97,
      palette: {
        body: '#46606f', dark: '#1e2f3a', belly: '#f0f6f4', fin: '#2f4654',
        accent: '#c3e4dd', outline: '#081420', glow: '#8fd9e8'
      }
    },
    {
      key: 'orca', art: 'orca', name: 'Orca', role: 'Apex of the Deep',
      radius: 104, speed: 268, aiSpeed: 186, aggression: 0.95,
      palette: {
        body: '#0d1117', dark: '#060a0e', belly: '#f5f8fa', fin: '#0a0f14',
        accent: '#e8f4f8', outline: '#000000', glow: '#b8e8f8'
      }
    },
    // A soft body, eight arms and no defence but the cloud it can print. The
    // palette is a common octopus in alarm: rust over aufous with a pale
    // belly, and the violet reserved for the chromatophore flush.
    {
      key: 'octopus', art: 'octopus', name: 'Octopus', role: 'Ink Weaver',
      radius: 74, speed: 222, aiSpeed: 132, aggression: 0.78,
      palette: {
        body: '#96505f', dark: '#3c1f2f', belly: '#efdcd4', fin: '#6a3450',
        accent: '#ffb0d4', outline: '#1a0c16', glow: '#c48aff'
      }
    },
    // Not an evolution - a hazard that lives in the fish list. It is last in
    // SPECIES on purpose so the eleven ladder entries above keep their indexes.
    {
      key: 'jellyfish', art: 'jellyfish', name: 'Moon Jelly', role: 'Drifting Stinger',
      radius: 34, speed: 0, aiSpeed: 16, aggression: 0,
      palette: {
        body: '#9fd9ff', dark: '#3f7fa8', belly: '#eafcff', fin: '#c8a6ff',
        accent: '#ff8fd0', outline: '#0a2436', glow: '#bfe9ff'
      }
    }
  ];

  // Stage order is the evolution ladder. The wild population mirrors it:
  // tier N spawns A.STAGES[N], and only the tiers listed in TIER_WEIGHTS are
  // seeded. The orca and the megalodon sit outside that table on purpose - the
  // orca is summoned by its own predator logic, and the megalodon is something
  // the reef has never seen before you become one.
  A.STAGES = [
    { ...A.SPECIES[0], xpReq: 0, ability: A.ABILITIES.boost },
    { ...A.SPECIES[1], xpReq: 80, ability: A.ABILITIES.shield },
    { ...A.SPECIES[2], xpReq: 230, ability: A.ABILITIES.surge },
    { ...A.SPECIES[3], xpReq: 500, ability: A.ABILITIES.frenzy },
    { ...A.SPECIES[4], xpReq: 700, ability: A.ABILITIES.lure },
    { ...A.SPECIES[5], xpReq: 960, ability: A.ABILITIES.chomp },
    // The manta is the wide blue between the shark and the blade: a long
    // glide of a climb, but still short of the sawshark's doubled cost.
    { ...A.SPECIES[6], xpReq: 5600, ability: A.ABILITIES.wingboost },
    // The octopus is the step the reef forgets you took: soft, slower than a
    // shark, and the first animal an orca stops bothering to hunt.
    { ...A.SPECIES[10], xpReq: 6600, ability: A.ABILITIES.ink },
    // The sawshark is the long climb of the ladder: double the shark's
    // requirement, so reaching the blade takes a patient hunt.
    { ...A.SPECIES[7], xpReq: 7680, ability: A.ABILITIES.dash },
    // The orca is now the second apex: you reach it, and it is still the animal
    // the reef fears - until you take the last step.
    { ...A.SPECIES[9], xpReq: 10240, ability: A.ABILITIES.breach },
    // The megalodon is the top of the ladder and one and a half times the orca,
    // so the climb from the orca costs as much as the whole climb to it.
    { ...A.SPECIES[8], xpReq: 16000, ability: A.ABILITIES.terror }
  ];

  A.stageByKey = function (key) {
    for (let i = 0; i < A.STAGES.length; i++) {
      if (A.STAGES[i].key === key) return i;
    }
    return 0;
  };

  // Apex shark tier index, used by the patrol and territory logic in game.js.
  A.SHARK_TIER = A.stageByKey('shark');
  A.ANGLER_TIER = A.stageByKey('angler');
  A.SAW_TIER = A.stageByKey('sawshark');
  A.MANTA_TIER = A.stageByKey('manta');

  // The wild orcas the ocean hunts with are this same animal; only their
  // behaviour tuning lives apart, in ORCA_BEHAVIOR below.
  A.ORCA = { ...A.SPECIES[A.stageByKey('orca')] };

  // Immortal jellyfish live in the fish list so the grid, the art pipeline and
  // the draw pass come free, but they sit outside the tier pyramid: they cannot
  // be eaten, cannot be stunned, and their only interaction is the sting.
  A.JELLY = { ...A.SPECIES[A.SPECIES.length - 1] };
  A.JELLY_COUNT = 30;
  A.JELLY_STING = 0.7;
  // An anglerfish is all spike and leather. Anything short of the two biggest
  // animals pays for swallowing one.
  A.ANGLER_BITE = 0.05;

  // An orca has no tier, so the normal XP curve would either pay nothing or
  // pay thousands. A predator therefore pays a third of the XP it has hunted
  // up for itself (see predatorBounty in game.js); this value is only the
  // floor, so a freshly spawned predator still pays the old flat bounty.
  A.PREDATOR_XP = 420;

  // Every creature carries a health pool purely so that ink has something to
  // spend. Nothing else in the game reads it, and because ink damage is a
  // percentage, 100 is the same number for a minnow and for a whale.
  A.BASE_HEALTH = 100;

  // The shape of an ink cloud. Each cloud is a handful of pre-baked puffs
  // scattered around the cast point that bloom outward, shear on the current
  // and dissolve - see inkSprite / updateInk in game.js.
  A.INK = {
    tendrils: 12,      // puffs per cloud
    bloom: 0.55,       // seconds to reach the full stated radius
    life: 4.4,         // seconds of visible ink after the bloom
    spread: 0.5,       // how far a puff keeps drifting, in cloud radii
    residue: 0.35      // share of a cloud that lingers as faint wisps
  };

  // The Ancient Trident, once it leaves the jaws. The cooldown is the spec's
  // two seconds and it starts at the cast, so a held trident can never be
  // spammed; the flight budget is what keeps a missed cast coming back before
  // the next one is ready rather than after it.
  A.SHOT = {
    cooldown: 2.0,     // seconds before the next cast
    speed: 1180,       // world units per second, out and back
    reach: 900,        // how far it will fly before giving up
    life: 1.35,        // seconds of outward flight
    pierce: 0.18,      // share of the victim's own maximum health
    floor: 14,         // the least a cast can ever do
    stun: 0.9,        // seconds a struck animal stops thinking
    aim: 0.85          // radians either side of the nose a target may sit in
  };

  // Poseidon, carried rather than cast: the trident stays in the jaws and the
  // animal surges forward behind it. Anything it touches while surging dies,
  // however big, which is the whole reason a shark wants the spear.
  A.TRIDENT_CHARGE = {
    cooldown: 2.0,     // seconds between surges, counted from the launch
    duration: 0.72,    // seconds of drive
    speed: 2.7         // movement multiplier while the surge holds
  };

  // Tuning for the orca's own state machine (see orcaThink in game.js).
  // Kept out of A.ORCA because the rest of that object is art/species data.
  A.ORCA_TARGET = 3;
  A.ORCA_BEHAVIOR = {
    senseRadius: 1650,        // how far an orca can smell prey
    giveUpRadius: 2900,       // chase is dropped beyond this
    chaseTimeout: 13,         // seconds before it loses interest
    feedTime: 3.4,            // sated window after a kill
    restTime: 5,              // calm cruising between hunts
    patrolSpeed: 0.52,        // fraction of cruise while searching
    chaseSpeed: 1.18,
    burstSpeed: 1.7,          // short lunge at the end of a chase
    burstTime: 1.6,
    turnRate: 1.05,           // slow to swing a 350px body
    playerDamage: 32,
    warnRadius: 1500,         // HUD/minimap threat telegraph range
    breathInterval: 9         // surfaces for a spout while cruising
  };

  // Fairness limits for ordinary fish (see aiThink in game.js). A predator may
  // only press a chase on the player for a moment, and only one at a time;
  // prey panic is deliberately imperfect so a determined hunter can close.
  A.FISH_BEHAVIOR = {
    playerChaseTime: 5,       // seconds a fish may pursue the player
    chaseGiveUp: 820,         // drop the chase once the gap opens past this
    chaseRest: [7, 12],       // seconds the player is forgotten after a chase
    senseRadius: 450,         // how far a bigger fish notices the player
    fleeSpeed: 1.3,           // panic sprint, down from a perfect 1.45
    fleeExhaustSpeed: 1.02,   // what the sprint fades to once the fish tires
    fleeExhaustAfter: 2.2,    // seconds of sprinting before the fade
    fleeError: 0.42,          // radians of panic error in the escape heading
    startle: [0.18, 0.5]      // reaction delay before a fish bolts
  };

  // Population scales with world area so the expanded ocean stays populated
  // rather than empty. Ratios follow the original tier pyramid; tier N is
  // A.STAGES[N], and the orca and megalodon are deliberately outside this list.
  // The octopus swam in at tier 7, one step below the sawshark's blade.
  A.TIER_WEIGHTS = [0.26, 0.19, 0.15, 0.11, 0.10, 0.09, 0.04, 0.04, 0.02];
  A.TIER_TARGETS = [92, 64, 44, 28, 17, 14, 4, 4, 5];
  // Weights are read as a cumulative roll, so they must sum to 1: the last
  // entry only ever gets whatever probability mass is left over.
  A.FOOD_TARGET = 1730;

  A.FOOD = [
    { name: 'Plankton', xp: 8, radius: 4.4, weight: 0.55, color: '#7cf7c8', glow: '#7cf7c8', core: '#d9fff4' },
    { name: 'Coral Berry', xp: 18, radius: 5.6, weight: 0.26, color: '#ff8fb1', glow: '#ff7fa8', core: '#ffe1ec' },
    { name: 'Pearl', xp: 46, radius: 7.4, weight: 0.07, color: '#ffe0a0', glow: '#ffcf6b', core: '#fffbe8' },
    // The animal snack: it drifts in the deep water column rather than gripping
    // the sand, and the reward for going down there is open to every stage that
    // dares. Size never gates food, so even a tiny blue can crunch one.
    {
      name: 'Starfish', xp: 30, radius: 10.4, weight: 0.12,
      color: '#ef6a3a', glow: '#c9682f', core: '#ffd39a',
      // Real asteroidians come in a handful of reef colours. Each animal keeps
      // the one it was spawned with, so the population reads as varied.
      skins: [
        { body: '#ef6a3a', dark: '#8f3517', light: '#ffd39a' },
        { body: '#df4b46', dark: '#82202a', light: '#ffc0aa' },
        { body: '#d8842f', dark: '#84500f', light: '#ffe4ac' },
        { body: '#c2568e', dark: '#6f2350', light: '#f7bcd9' },
        { body: '#8f6fc0', dark: '#452a6e', light: '#e2d1ff' }
      ]
    }
  ];

  A.FISH_NAMES = [
    'Finneus', 'Bubbles', 'Reefy', 'Kelpster', 'Nibbles', 'Tidal', 'Splashy', 'Marlin',
    'Puddle', 'Drift', 'Coralline', 'Gillbert', 'Snappy', 'Murky', 'Wavelength', 'Glint',
    'Pebble', 'Fathom', 'Sardine', 'Tango', 'Glooper', 'Shellby', 'Ripple', 'Zephyr',
    'Mako Jr', 'Noodle', 'Sprat', 'Cinder', 'Lumen', 'Brine', 'Sandy', 'Squib',
    'Lantern', 'Snagtooth', 'Gulper', 'Wisp', 'Lamprey Jr', 'Duskjaw', 'Emberfin', 'Hollow'
  ];

  A.ABILITY_ICONS = {
    boost: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12h9.5"/><path d="M8 7.5l5.5 4.5L8 16.5"/><circle cx="18.5" cy="7" r="2.1"/><circle cx="21" cy="12.5" r="1.2"/><circle cx="18" cy="17.5" r="1.6"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.8l7.6 3.1v5.5c0 4.4-3.1 7.7-7.6 9.8-4.5-2.1-7.6-5.4-7.6-9.8V5.9z"/><path d="M12 8.2v8M8.6 11.6h6.8" opacity=".65"/></svg>',
    surge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13.6 2.4L4.8 13.6h5.6L9.2 21.6 19.2 9.9h-5.9z"/><path d="M4 20.5h5" opacity=".5"/></svg>',
    frenzy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.4c3.8-2.8 13.2-2.8 17 0"/><path d="M5 9.4l1.4 2.8 1.7-3 1.7 3 1.7-3 1.7 3 1.7-3 1.4 2.8"/><path d="M4.5 16.6c3.4 2.6 11.6 2.6 15 0" opacity=".7"/></svg>',
    chomp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.8 12c2.4-6 16-6 18.4 0-2.4 5.6-16 5.6-18.4 0z"/><path d="M6.4 10.8l1.2 2.4 1.5-2.7 1.5 2.7 1.6-2.7 1.6 2.7 1.5-2.7 1.2 2.4"/></svg>',
    wingboost: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21.6 7.9c-6.7-1.2-12.2 1.6-15.6 6.3-1.4 2-3.2 2.6-4.8 2.3 3.8 1.7 8.7 1 11.9-1.5 3.4-2.7 6.4-4.8 8.5-5.2z"/><path d="M13.4 4.3c2.9-.6 5.6.3 8 2.1" opacity=".65"/><path d="M2.4 12.2c1.2-1.5 2.8-2.7 4.5-3.4" opacity=".5"/><path d="M1.6 19h5.6M4 21.8h4.6" opacity=".45"/></svg>',
    dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.6 12h15.2"/><path d="M17.4 9.1l4.4 2.9-4.4 2.9"/><path d="M5.6 10.4l1.1-2.2 1.1 2.2M9.6 10.4l1.1-2.2 1.1 2.2M13.6 10.4l1.1-2.2 1.1 2.2" opacity=".8"/><path d="M3.8 16.6h6.4M2.2 19.6h4.2" opacity=".5"/></svg>',
    breach: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.4 17.8c2.6-5 8.8-6.6 12.6-3.4 2.5 2 2.9 5 1.4 7.6"/><path d="M6.6 10.2c1.4-2.8 4.6-3.8 6.9-2.4"/><path d="M13.8 4.4c.9 1.2 2.4 1.6 3.6 1"/><path d="M19.2 2.6c.6 1.1.2 2.3-.8 3"/><path d="M3 21.8h18" opacity=".5"/></svg>',
    lure: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10.9 12.9c.5-4.1 3-6.9 6.3-7.7"/><circle cx="18.1" cy="4.6" r="2.2"/><path d="M18.1 1.6V.5M21.2 4.6h1.1M20.3 2.4l.8-.8" opacity=".5"/><path d="M2.6 17.9c1.6-3.9 4.9-5.9 9.2-5.6 3.7.3 6.4 2.2 7.8 4.9"/><path d="M5.6 17.6l1.3 2.6 1.5-2.8 1.5 2.8 1.4-2.7 1.5 2.7 1.4-2.7 1.5 2.7 1.3-2.5"/></svg>',
    terror: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.4 9.2c3.5-1.3 6.8-.6 8.9 1.5-2.1 2.7-5.4 3.7-8.9 2.9z"/><path d="M4.4 10.1l.9 1.8 1-1.9 1 1.9 1-1.9.9 1.8" opacity=".9"/><path d="M14 6.6c3.1 2.4 3.1 8.4 0 10.8" opacity=".85"/><path d="M17.6 4c4.4 3.4 4.4 12.6 0 16" opacity=".6"/><path d="M20.8 1.6c2.6 2.2 2.6 18.6 0 20.8" opacity=".35"/></svg>',
    ink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9.1 6.1c2.9-2 6.6-1.1 8.1 1.6 2.5.6 3.5 3.3 2.2 5.3 1.1 2.3-.8 4.9-3.5 4.9-1.2 2-4.3 2.2-5.8.3-2.8.5-5.1-1.6-4.9-4.2-2.1-1.1-2.2-4-.1-5.1-.2-2 1.7-3.5 4-2.8z"/><circle cx="12.7" cy="12.2" r="1.6" opacity=".85"/><path d="M4.6 2.9c1.6-.3 2.9.3 3.8 1.4" opacity=".55"/><path d="M20.3 3c-1.3-.4-2.5-.1-3.5.7" opacity=".55"/><path d="M2.2 12.2c-1 .6-1.5 1.6-1.4 2.7" opacity=".45"/></svg>'
  };

  A.formatTime = function (seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m + ':' + String(s).padStart(2, '0');
  };

  A.formatNumber = function (n) {
    return Math.floor(n).toLocaleString('en-US');
  };
})();
