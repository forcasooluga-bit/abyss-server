(function () {
  'use strict';

  const A = window.ABYSS = window.ABYSS || {};

  A.WORLD = { w: 4400, h: 3100, margin: 150 };
  A.TAU = Math.PI * 2;
  A.PI = Math.PI;

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
      key: 'shark', art: 'shark', name: 'Apex Shark', role: 'Apex of the Reef',
      radius: 46, speed: 224, aiSpeed: 150, aggression: 0.9,
      palette: {
        body: '#607f99', dark: '#374e61', belly: '#f4f9fd', fin: '#4b677d',
        accent: '#bcd7ea', outline: '#152431', glow: '#a2d6f9'
      }
    }
  ];

  A.STAGES = [
    { ...A.SPECIES[0], xpReq: 0, ability: A.ABILITIES.boost },
    { ...A.SPECIES[1], xpReq: 80, ability: A.ABILITIES.shield },
    { ...A.SPECIES[2], xpReq: 230, ability: A.ABILITIES.surge },
    { ...A.SPECIES[3], xpReq: 500, ability: A.ABILITIES.frenzy },
    { ...A.SPECIES[4], xpReq: 880, ability: A.ABILITIES.chomp }
  ];

  A.TIER_WEIGHTS = [0.34, 0.26, 0.2, 0.13, 0.07];
  A.TIER_TARGETS = [22, 15, 10, 6, 3];

  A.FOOD = [
    { name: 'Plankton', xp: 8, radius: 4.4, weight: 0.62, color: '#7cf7c8', glow: '#7cf7c8', core: '#d9fff4' },
    { name: 'Coral Berry', xp: 18, radius: 5.6, weight: 0.30, color: '#ff8fb1', glow: '#ff7fa8', core: '#ffe1ec' },
    { name: 'Pearl', xp: 46, radius: 7.4, weight: 0.08, color: '#ffe0a0', glow: '#ffcf6b', core: '#fffbe8' }
  ];

  A.FISH_NAMES = [
    'Finneus', 'Bubbles', 'Reefy', 'Kelpster', 'Nibbles', 'Tidal', 'Splashy', 'Marlin',
    'Puddle', 'Drift', 'Coralline', 'Gillbert', 'Snappy', 'Murky', 'Wavelength', 'Glint',
    'Pebble', 'Fathom', 'Sardine', 'Tango', 'Glooper', 'Shellby', 'Ripple', 'Zephyr',
    'Mako Jr', 'Noodle', 'Sprat', 'Cinder', 'Lumen', 'Brine', 'Sandy', 'Squib'
  ];

  A.ABILITY_ICONS = {
    boost: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12h9.5"/><path d="M8 7.5l5.5 4.5L8 16.5"/><circle cx="18.5" cy="7" r="2.1"/><circle cx="21" cy="12.5" r="1.2"/><circle cx="18" cy="17.5" r="1.6"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.8l7.6 3.1v5.5c0 4.4-3.1 7.7-7.6 9.8-4.5-2.1-7.6-5.4-7.6-9.8V5.9z"/><path d="M12 8.2v8M8.6 11.6h6.8" opacity=".65"/></svg>',
    surge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13.6 2.4L4.8 13.6h5.6L9.2 21.6 19.2 9.9h-5.9z"/><path d="M4 20.5h5" opacity=".5"/></svg>',
    frenzy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.4c3.8-2.8 13.2-2.8 17 0"/><path d="M5 9.4l1.4 2.8 1.7-3 1.7 3 1.7-3 1.7 3 1.7-3 1.4 2.8"/><path d="M4.5 16.6c3.4 2.6 11.6 2.6 15 0" opacity=".7"/></svg>',
    chomp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.8 12c2.4-6 16-6 18.4 0-2.4 5.6-16 5.6-18.4 0z"/><path d="M6.4 10.8l1.2 2.4 1.5-2.7 1.5 2.7 1.6-2.7 1.6 2.7 1.5-2.7 1.2 2.4"/></svg>'
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
