(function () {
  'use strict';

  const A = window.ABYSS;
  const TAU = A.TAU;
  const WORLD = A.WORLD;
  const SURFACE_H = 132;
  // The sandy floor is a world feature, not a band pinned to the viewport:
  // the baked sand sprite and every decoration that stands on the ground both
  // read this one line, so nothing can float above it or sink under it.
  const SEABED_W = 2000;
  const SEABED_H = 380;
  // Baked headroom above the sand line, so the kelp and coral that grow from
  // the floor are not cut off by the tile's own edge.
  const SEABED_HEAD = 280;
  const SEABED_EDGE = 62;
  const FLOOR_Y = WORLD.h - 340;
  // Nothing that needs sunlight grows this deep; decorations below the line
  // are drawn as dim silhouettes so the trench and vents read as their own
  // places instead of a brighter copy of the reef.
  const NO_LIGHT_Y = A.WORLD.h * 0.78;

  // ------------------------------------------------------------------
  // Color helpers
  // ------------------------------------------------------------------
  function hexRgb(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function mixHex(a, b, t) {
    const A1 = hexRgb(a);
    const B1 = hexRgb(b);
    const r = Math.round(A1.r + (B1.r - A1.r) * t);
    const g = Math.round(A1.g + (B1.g - A1.g) * t);
    const bl = Math.round(A1.b + (B1.b - A1.b) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  function rgba(hex, alpha) {
    const c = hexRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + alpha + ')';
  }

  // ------------------------------------------------------------------
  // Cached sprites
  // ------------------------------------------------------------------
  const glowCache = {};
  function glowSprite(color) {
    let c = glowCache[color];
    if (c) return c;
    c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 1, 64, 64, 64);
    grad.addColorStop(0, color);
    grad.addColorStop(0.28, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.55;
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    glowCache[color] = c;
    return c;
  }
  A.glowSprite = glowSprite;

  const BUBBLE_SPRITE = (function () {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d');
    g.strokeStyle = 'rgba(235, 254, 255, 0.9)';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(32, 32, 23, 0, TAU);
    g.stroke();
    g.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    g.lineWidth = 1.8;
    g.beginPath();
    g.arc(32, 32, 26.5, 0.2, 1.4);
    g.stroke();
    g.fillStyle = 'rgba(206, 251, 255, 0.22)';
    g.beginPath();
    g.arc(32, 32, 22, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255, 255, 255, 0.95)';
    g.beginPath();
    g.arc(23, 22, 5.5, 0, TAU);
    g.fill();
    return c;
  })();
  A.bubbleSprite = BUBBLE_SPRITE;

  const CAUSTIC_SPRITE = (function () {
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 320;
    const g = c.getContext('2d');
    g.globalCompositeOperation = 'lighter';
    const blobs = [
      [160, 160, 130, 'rgba(196, 255, 255, 0.34)'],
      [110, 130, 70, 'rgba(220, 255, 252, 0.26)'],
      [210, 190, 80, 'rgba(150, 240, 255, 0.22)']
    ];
    for (const b of blobs) {
      const grad = g.createRadialGradient(b[0], b[1], 2, b[0], b[1], b[2]);
      grad.addColorStop(0, b[3]);
      grad.addColorStop(0.5, b[3].replace(/[\d.]+\)$/, '0.1)'));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 320, 320);
    }
    return c;
  })();

  const RAY_SPRITE = (function () {
    const w = 260;
    const h = 950;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    const vg = g.createLinearGradient(0, 0, 0, h);
    vg.addColorStop(0, 'rgba(228, 255, 255, 0.68)');
    vg.addColorStop(0.22, 'rgba(190, 248, 255, 0.3)');
    vg.addColorStop(0.62, 'rgba(160, 238, 255, 0.09)');
    vg.addColorStop(1, 'rgba(160, 238, 255, 0)');
    g.fillStyle = vg;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-in';
    const hg = g.createLinearGradient(0, 0, w, 0);
    hg.addColorStop(0, 'rgba(255,255,255,0)');
    hg.addColorStop(0.35, 'rgba(255,255,255,0.65)');
    hg.addColorStop(0.5, 'rgba(255,255,255,1)');
    hg.addColorStop(0.65, 'rgba(255,255,255,0.65)');
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hg;
    g.fillRect(0, 0, w, h);
    return c;
  })();

  const EDGE_SPRITE = (function () {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 128, 0);
    grad.addColorStop(0, 'rgba(3, 42, 68, 0.72)');
    grad.addColorStop(0.45, 'rgba(4, 55, 84, 0.34)');
    grad.addColorStop(1, 'rgba(4, 55, 84, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return c;
  })();

  const SUN_SPRITE = (function () {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 2, 128, 128, 126);
    grad.addColorStop(0, 'rgba(255, 253, 222, 0.95)');
    grad.addColorStop(0.16, 'rgba(255, 249, 198, 0.72)');
    grad.addColorStop(0.42, 'rgba(255, 244, 180, 0.26)');
    grad.addColorStop(0.7, 'rgba(210, 250, 255, 0.1)');
    grad.addColorStop(1, 'rgba(210, 250, 255, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return c;
  })();

  // Three tints for the bioluminescent field. Cyan dominates, with a green and
  // a violet minority so a drifting bloom does not read as one flat colour.
  const BIO_SPRITES = (function () {
    const tints = [
      ['rgba(120, 240, 255, 0.95)', 'rgba(60, 200, 240, 0.28)'],
      ['rgba(150, 255, 210, 0.92)', 'rgba(70, 220, 170, 0.24)'],
      ['rgba(196, 176, 255, 0.9)', 'rgba(140, 120, 230, 0.22)']
    ];
    const out = [];
    for (let i = 0; i < tints.length; i++) {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 31);
      grad.addColorStop(0, tints[i][0]);
      grad.addColorStop(0.34, tints[i][1]);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      out.push(c);
    }
    return out;
  })();

  // Distant megafauna are baked at 440px and drawn 220-440px, so the silhouette
  // keeps its edges instead of turning into a smudge, and it still costs nothing
  // per frame. Kind 0 is a monster-sized shark, 1 a whale-shaped spindle,
  // 2 a broad finless glider.
  function leviathanSprite(kind, color) {
    const c = document.createElement('canvas');
    c.width = 424;
    c.height = 144;
    const g = c.getContext('2d');
    g.scale(2, 2);
    g.lineJoin = 'round';
    g.fillStyle = color;
    g.beginPath();
    if (kind === 0) {
      g.moveTo(2, 48);
      g.bezierCurveTo(10, 34, 30, 26, 52, 24);
      g.lineTo(62, 5);
      g.lineTo(88, 23);
      g.bezierCurveTo(112, 25, 140, 29, 160, 36);
      g.bezierCurveTo(176, 30, 190, 18, 199, 6);
      g.bezierCurveTo(196, 24, 190, 36, 186, 43);
      g.bezierCurveTo(192, 52, 197, 62, 199, 71);
      g.bezierCurveTo(188, 60, 174, 52, 160, 48);
      g.bezierCurveTo(128, 61, 88, 62, 58, 58);
      g.bezierCurveTo(32, 57, 11, 54, 2, 48);
    } else if (kind === 1) {
      g.moveTo(2, 46);
      g.bezierCurveTo(16, 28, 46, 19, 80, 20);
      g.bezierCurveTo(108, 21, 134, 26, 152, 33);
      g.lineTo(158, 21);
      g.lineTo(170, 34);
      g.lineTo(200, 14);
      g.lineTo(190, 44);
      g.lineTo(200, 68);
      g.lineTo(156, 51);
      g.bezierCurveTo(124, 61, 76, 63, 42, 58);
      g.bezierCurveTo(22, 55, 8, 52, 2, 46);
    } else {
      g.moveTo(8, 42);
      g.bezierCurveTo(44, 18, 100, 12, 152, 30);
      g.bezierCurveTo(172, 37, 196, 44, 212, 46);
      g.bezierCurveTo(186, 48, 158, 50, 132, 52);
      g.bezierCurveTo(92, 56, 44, 54, 8, 42);
    }
    g.closePath();
    g.fill();
    return c;
  }

  const LEVI_DARK = [
    leviathanSprite(0, 'rgba(1, 15, 27, 1)'),
    leviathanSprite(1, 'rgba(1, 15, 27, 1)'),
    leviathanSprite(2, 'rgba(2, 17, 29, 0.95)')
  ];
  const LEVI_LIGHT = [
    leviathanSprite(0, 'rgba(138, 212, 240, 1)'),
    leviathanSprite(1, 'rgba(126, 198, 236, 1)'),
    leviathanSprite(2, 'rgba(146, 222, 244, 0.95)')
  ];

  const ROCK_LIGHT = (function () {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(112, 92, 4, 112, 92, 160);
    grad.addColorStop(0, 'rgba(214, 251, 255, 0.5)');
    grad.addColorStop(0.45, 'rgba(140, 222, 238, 0.16)');
    grad.addColorStop(1, 'rgba(140, 222, 238, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return c;
  })();

  const ROCK_SHADE = (function () {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, 'rgba(214, 252, 255, 0.5)');
    grad.addColorStop(0.42, 'rgba(190, 240, 252, 0.04)');
    grad.addColorStop(1, 'rgba(2, 28, 44, 0.62)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return c;
  })();

  function makeCloudSprite(seed) {
    const rng = A.seedRand(seed);
    const c = document.createElement('canvas');
    c.width = 300;
    c.height = 140;
    const g = c.getContext('2d');
    const puffs = [];
    const n = 5 + ((rng() * 3) | 0);
    for (let i = 0; i < n; i++) {
      puffs.push({
        x: 46 + i * (200 / (n - 1)) + (rng() - 0.5) * 20,
        y: 88 - rng() * 30,
        r: 26 + rng() * 22
      });
    }
    g.beginPath();
    for (const p of puffs) {
      g.moveTo(p.x + p.r, p.y);
      g.arc(p.x, p.y, p.r, 0, TAU);
    }
    g.fillStyle = '#ffffff';
    g.fill();
    g.save();
    g.clip();
    const shade = g.createLinearGradient(0, 52, 0, 132);
    shade.addColorStop(0, 'rgba(255,255,255,0)');
    shade.addColorStop(0.62, 'rgba(223, 244, 252, 0.55)');
    shade.addColorStop(1, 'rgba(190, 228, 244, 0.85)');
    g.fillStyle = shade;
    g.fillRect(0, 0, 300, 140);
    g.restore();
    return c;
  }
  const CLOUD_SPRITES = [makeCloudSprite(31), makeCloudSprite(77)];

  function makeReefBand(seed, near) {
    const W = 1800;
    const H = 340;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const rng = A.seedRand(seed);
    const p1 = rng() * TAU;
    const p2 = rng() * TAU;
    const p3 = rng() * TAU;
    const base = near ? 226 : 204;
    const humps = [];
    const humpCount = 3 + ((rng() * 2) | 0);
    for (let i = 0; i < humpCount; i++) {
      humps.push({
        x: 180 + rng() * (W - 360),
        w: 130 + rng() * 190,
        h: 40 + rng() * 78
      });
    }
    const topAt = function (x) {
      let y = base +
        Math.sin((x / W) * TAU + p1) * 20 +
        Math.sin((x / W) * TAU * 3 + p2) * 9 +
        Math.sin((x / W) * TAU * 6 + p3) * 4;
      for (let i = 0; i < humps.length; i++) {
        const k = (x - humps[i].x) / humps[i].w;
        y -= humps[i].h * Math.exp(-k * k * 2.1);
      }
      return y;
    };
    const path = function () {
      g.beginPath();
      g.moveTo(0, topAt(0));
      for (let x = 8; x <= W; x += 8) g.lineTo(x, topAt(x));
      g.lineTo(W, H + 10);
      g.lineTo(0, H + 10);
      g.closePath();
    };
    path();
    const grad = g.createLinearGradient(0, base - 90, 0, H);
    if (near) {
      grad.addColorStop(0, 'rgba(10, 76, 110, 0.82)');
      grad.addColorStop(0.45, 'rgba(9, 64, 96, 0.56)');
      grad.addColorStop(1, 'rgba(7, 52, 80, 0.14)');
    } else {
      grad.addColorStop(0, 'rgba(34, 124, 158, 0.6)');
      grad.addColorStop(0.45, 'rgba(26, 106, 142, 0.4)');
      grad.addColorStop(1, 'rgba(20, 88, 122, 0.08)');
    }
    g.fillStyle = grad;
    g.fill();

    g.save();
    path();
    g.clip();
    for (let i = 0; i < humps.length; i++) {
      const hm = humps[i];
      const hy = topAt(hm.x);
      const gr = g.createRadialGradient(hm.x - hm.w * 0.2, hy + hm.h * 0.3, 4, hm.x, hy + hm.h * 0.4, hm.w * 0.9);
      gr.addColorStop(0, near ? 'rgba(30, 116, 150, 0.38)' : 'rgba(66, 160, 190, 0.28)');
      gr.addColorStop(1, 'rgba(8, 52, 80, 0)');
      g.fillStyle = gr;
      g.fillRect(hm.x - hm.w, hy - hm.h, hm.w * 2, hm.h * 3);
    }
    g.strokeStyle = near ? 'rgba(158, 236, 250, 0.13)' : 'rgba(190, 246, 255, 0.12)';
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(0, topAt(0) + 2);
    for (let x = 8; x <= W; x += 8) g.lineTo(x, topAt(x) + 2);
    g.stroke();
    g.restore();

    g.lineCap = 'round';
    for (let i = 0; i < (near ? 20 : 12); i++) {
      const x = 90 + rng() * (W - 180);
      const y = topAt(x) + 3;
      const hh = 16 + rng() * 40;
      const coral = rng() < 0.22;
      g.strokeStyle = coral
        ? (near ? 'rgba(214, 126, 170, 0.34)' : 'rgba(220, 150, 185, 0.26)')
        : (near ? 'rgba(8, 54, 78, 0.55)' : 'rgba(16, 76, 106, 0.4)');
      g.lineWidth = coral ? 2 : 2.2;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + (k - 1) * 7, y - hh * 0.55, x + (k - 1) * 13, y - hh * (0.7 + rng() * 0.3));
        g.stroke();
      }
    }
    return c;
  }
  const REEF_BANDS = [makeReefBand(101, false), makeReefBand(211, true)];

  function makeSchoolSprite(seed) {
    const rng = A.seedRand(seed);
    const c = document.createElement('canvas');
    c.width = 160;
    c.height = 90;
    const g = c.getContext('2d');
    for (let i = 0; i < 12; i++) {
      const x = 12 + rng() * 130;
      const y = 12 + rng() * 58;
      const s = 2.2 + rng() * 2.8;
      const dir = rng() < 0.85 ? 1 : -1;
      g.save();
      g.translate(x, y);
      g.scale(dir, 1);
      g.fillStyle = 'rgba(8, 62, 92, ' + (0.5 + rng() * 0.24).toFixed(2) + ')';
      g.beginPath();
      g.ellipse(0, 0, s * 1.5, s * 0.62, 0, 0, TAU);
      g.fill();
      g.beginPath();
      g.moveTo(-s * 1.2, 0);
      g.lineTo(-s * 2.4, -s * 0.85);
      g.lineTo(-s * 2.2, s * 0.85);
      g.closePath();
      g.fill();
      g.restore();
    }
    return c;
  }
  const SCHOOL_SPRITES = [makeSchoolSprite(5), makeSchoolSprite(17), makeSchoolSprite(43)];

  // ------------------------------------------------------------------
  // Geometry helpers
  // ------------------------------------------------------------------
  function blobPoints(rng, rx, ry, n, jitter) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU;
      const k = 1 + (rng() - 0.5) * jitter;
      pts.push({ x: Math.cos(ang) * rx * k, y: Math.sin(ang) * ry * k });
    }
    return pts;
  }

  function smoothPoly(ctx, pts) {
    const n = pts.length;
    if (n < 3) return;
    const mx = function (a, b) { return (a.x + b.x) / 2; };
    const my = function (a, b) { return (a.y + b.y) / 2; };
    ctx.beginPath();
    ctx.moveTo(mx(pts[n - 1], pts[0]), my(pts[n - 1], pts[0]));
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const next = pts[(i + 1) % n];
      ctx.quadraticCurveTo(p.x, p.y, mx(p, next), my(p, next));
    }
    ctx.closePath();
  }

  function visible(x, y, r, view, pad) {
    const p = pad || 0;
    return x + r + p > view.x && x - r - p < view.x + view.w &&
      y + r + p > view.y && y - r - p < view.y + view.h;
  }

  function visibleBox(x0, y0, x1, y1, view, pad) {
    const p = pad || 0;
    return x1 + p > view.x && x0 - p < view.x + view.w &&
      y1 + p > view.y && y0 - p < view.y + view.h;
  }

  // ------------------------------------------------------------------
  // Reef palettes
  // ------------------------------------------------------------------
  const CORAL_PALETTES = [
    { body: '#ff7fa2', dark: '#c94a72', accent: '#ffd9e4', fin: '#ffa6bd' },
    { body: '#ff9d5c', dark: '#cf6a32', accent: '#ffe4b8', fin: '#ffbe85' },
    { body: '#b483ff', dark: '#7b4fd0', accent: '#f0dcff', fin: '#cba8ff' },
    { body: '#42d9c4', dark: '#1f9e92', accent: '#d2fff7', fin: '#7cebdc' },
    { body: '#ffd45e', dark: '#c99a24', accent: '#fff3c2', fin: '#ffe491' }
  ];

  const WEED_COLORS = ['#1f9a5f', '#2fbd74', '#4fdc8b', '#177f52', '#6ce8a0', '#2aa96a'];
  const PLANT_COLORS = ['#ffadc4', '#ffcf8f', '#8aeed6', '#c7e9ff', '#ffd0dc'];
  const ROCK_COLORS = ['#2f7086', '#266277', '#3b8094', '#1f566b', '#478b9d'];

  function tintPalette(p, rng) {
    const shift = (rng() - 0.5) * 22;
    return {
      body: A.shiftColor(p.body, shift, 1, 1),
      dark: A.shiftColor(p.dark, shift, 1, 0.96),
      accent: A.shiftColor(p.accent, shift * 0.6, 1, 1),
      fin: A.shiftColor(p.fin, shift, 1, 1)
    };
  }

  // ------------------------------------------------------------------
  // Sandy seabed (a world-space floor: one line, baked and placed from it)
  // ------------------------------------------------------------------
  function seabedEdgeAt(u) {
    return SEABED_EDGE +
      Math.sin(u * TAU + 0.6) * 20 +
      Math.sin(u * TAU * 3 + 2.1) * 9 +
      Math.sin(u * TAU * 6 + 4.2) * 4;
  }

  // World y of the sand surface at world x. The sprite's baked top edge is the
  // same curve, so anything placed with this stands exactly on the ground.
  function floorAt(x) {
    const u = (((x % SEABED_W) + SEABED_W) % SEABED_W) / SEABED_W;
    return FLOOR_Y + seabedEdgeAt(u) - SEABED_EDGE;
  }

  // Sunlight dies out on the way down, but the deep floor keeps enough of its
  // colour to read as a place instead of vanishing into the basalt.
  function lightAt(y) {
    if (y <= NO_LIGHT_Y) return 1;
    return A.clamp(1 - (y - NO_LIGHT_Y) / (WORLD.h - NO_LIGHT_Y) * 0.66, 0.34, 1);
  }

  function drawStar(g, x, y, r, rot, color, outline) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fillStyle = color;
    g.fill();
    g.globalAlpha = 0.55;
    g.strokeStyle = outline;
    g.lineWidth = 1.2;
    g.stroke();
    g.globalAlpha = 1;
    g.restore();
  }

  function drawShell(g, x, y, r, rot, color, outline) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.beginPath();
    g.arc(0, 0, r, Math.PI, 0);
    g.closePath();
    g.fillStyle = color;
    g.fill();
    g.globalAlpha = 0.45;
    g.strokeStyle = outline;
    g.lineWidth = 1.2;
    g.stroke();
    g.globalAlpha = 0.5;
    g.lineWidth = 0.9;
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + ((i + 0.5) / 5) * Math.PI;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * r * 0.94, Math.sin(a) * r * 0.94);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.restore();
  }

  // ------------------------------------------------------------------
  // The sea floor
  //
  // Sand, baked once per world seed, so a frame still pays for exactly one
  // blit per visible tile. Everything in here is authored to tile: the dunes
  // and ripple combs use whole cycles across SEABED_W and the scattered detail
  // is repainted past whichever edge it leans on, so a tile handing over to
  // its neighbour never cuts a ripple in half or shows a bare seam.
  // ------------------------------------------------------------------
  function makeSeabedSprite(seed) {
    const W = SEABED_W;
    const H = SEABED_H;
    const HEAD = SEABED_HEAD;
    const BH = H + HEAD;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = BH;
    const g = c.getContext('2d');
    const rng = A.seedRand(seed);
    const topAt = function (x) {
      return seabedEdgeAt(x / W) + HEAD;
    };
    const path = function () {
      g.beginPath();
      g.moveTo(0, topAt(0));
      for (let x = 10; x <= W; x += 10) g.lineTo(x, topAt(x));
      g.lineTo(W, BH + 12);
      g.lineTo(0, BH + 12);
      g.closePath();
    };

    // Paint a detail, then again past the edge it leans on.
    const blob = function (x, y, r, draw) {
      draw(x, y);
      if (x < r * 2) draw(x + W, y);
      else if (x > W - r * 2) draw(x - W, y);
    };

    path();
    const sand = g.createLinearGradient(0, HEAD + 24, 0, BH);
    sand.addColorStop(0, '#fff3d2');
    sand.addColorStop(0.16, '#ffe6b4');
    sand.addColorStop(0.42, '#f2d59c');
    sand.addColorStop(0.72, '#dfbd84');
    sand.addColorStop(1, '#bd9a66');
    g.fillStyle = sand;
    g.fill();

    g.save();
    path();
    g.clip();

    // ── Patches of differently coloured sand ──
    // Blonde, ochre and pale grey all sit in the same bed; the current sorts it
    // into soft blotches the size of a room.
    for (let i = 0; i < 26; i++) {
      const x = 60 + rng() * (W - 120);
      const y = topAt(x) + 30 + rng() * 240;
      const r = 70 + rng() * 190;
      const gr = g.createRadialGradient(x, y, 2, x, y, r);
      const p = rng();
      const col = p < 0.34 ? '255, 252, 228' : p < 0.62 ? '226, 190, 128' :
        p < 0.84 ? '176, 148, 104' : '214, 214, 198';
      gr.addColorStop(0, 'rgba(' + col + ', ' + (0.10 + rng() * 0.13).toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(' + col + ', 0)');
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // ── Dunes ──
    // Three long, low swells. Each one catches light on its far shoulder and
    // drops a soft shadow into the trough behind it, which is what makes a sand
    // bed read as three-dimensional rather than flat painted.
    const dunes = [
      { y: HEAD + 116, amp: 15, cyc: 2, warm: 0.13, cool: 0.09 },
      { y: HEAD + 192, amp: 21, cyc: 3, warm: 0.12, cool: 0.10 },
      { y: HEAD + 274, amp: 27, cyc: 2, warm: 0.11, cool: 0.12 }
    ];
    for (let d = 0; d < dunes.length; d++) {
      const du = dunes[d];
      const ph = rng() * TAU;
      for (const side of [0, 1]) {
        g.beginPath();
        g.moveTo(-6, BH + 14);
        for (let x = -6; x <= W + 6; x += 12) {
          const t = (x / W) * TAU * du.cyc + ph;
          const yy = du.y + Math.sin(t) * du.amp + Math.sin(t * 2.7 + 1.1) * du.amp * 0.28;
          g.lineTo(x, yy + side * 34);
        }
        g.lineTo(W + 6, BH + 14);
        g.closePath();
        const gr = g.createLinearGradient(0, du.y - du.amp, 0, du.y + 96);
        if (side === 0) {
          gr.addColorStop(0, 'rgba(255, 248, 220, ' + du.warm + ')');
          gr.addColorStop(1, 'rgba(255, 248, 220, 0)');
        } else {
          gr.addColorStop(0, 'rgba(112, 84, 46, ' + du.cool + ')');
          gr.addColorStop(1, 'rgba(112, 84, 46, 0)');
        }
        g.fillStyle = gr;
        g.fill();
      }
    }

    // ── Ripple comb ──
    // The small crescents a current leaves behind. Rows tighten and shrink as
    // they recede up the band, each one draping over the terrain instead of
    // ignoring it, and each broken into runs so the bed looks disturbed rather
    // than stamped. A lit crest over a shadowed trough, twice per row.
    const rows = 34;
    for (let j = 0; j < rows; j++) {
      const t = j / (rows - 1);
      const near = Math.pow(t, 1.35);
      const yBase = HEAD + 20 + near * (H - 34);
      const wave = 22 + near * 30;
      const cyc = Math.max(6, Math.round(W / wave));
      const amp = 1.5 + near * 3.4;
      const lw = 1.1 + near * 2.1;
      const ph = rng() * TAU;
      const runs = 2 + ((rng() * 3) | 0);
      const span = W / runs;
      const seedOff = rng() * TAU;
      const lit = 0.16 + rng() * 0.14;
      const shad = 0.13 + rng() * 0.12;

      for (let r = 0; r < runs; r++) {
        const x0 = r * span + (seedOff * 13.7 + r * 37) % (span * 0.4);
        const len = span * (0.48 + ((Math.sin(seedOff + r * 2.1) * 0.5 + 0.5) * 0.45));
        for (const pass of [0, 1]) {
          g.beginPath();
          let open = false;
          for (let x = x0; x <= x0 + len; x += 6) {
            if (x > W) break;
            const u = (x / W) * TAU * cyc + ph;
            const y = yBase + Math.sin(u) * amp + (yBase - topAt(x)) * 0.03 +
              Math.sin(u * 3.3 + 2) * amp * 0.18 + (pass ? amp * 1.5 : 0);
            if (!open) { g.moveTo(x, y); open = true; }
            else g.lineTo(x, y);
          }
          g.lineWidth = pass ? lw * 1.5 : lw;
          g.strokeStyle = pass ? 'rgba(98, 72, 38, ' + shad + ')'
            : 'rgba(255, 250, 226, ' + lit + ')';
          g.stroke();
        }
      }
    }

    // ── Grain ──
    // Coarse carbonate sand is visible individual grains. Thousands, in two
    // tones, all drawn as rects because this bakes once and rects are cheap.
    for (let i = 0; i < 4200; i++) {
      const x = rng() * W;
      const y = topAt(x) + 3 + rng() * (BH - topAt(x) - 6);
      const p = rng();
      g.fillStyle = p < 0.42 ? 'rgba(255, 251, 226, 0.5)' :
        p < 0.74 ? 'rgba(198, 166, 112, 0.34)' : 'rgba(126, 100, 62, 0.3)';
      const s = 0.8 + rng() * 1.5;
      g.fillRect(x, y, s, s * 0.75);
    }
    for (let i = 0; i < 620; i++) {
      const x = rng() * W;
      const y = topAt(x) + 6 + rng() * 260;
      g.fillStyle = 'rgba(255, 255, 244, 0.72)';
      const s = 1.1 + rng() * 1.3;
      g.fillRect(x, y, s, s);
      g.fillStyle = 'rgba(255, 255, 240, 0.24)';
      g.fillRect(x - s * 1.6, y + s * 0.2, s * 4.2, s * 0.5);
    }

    // ── Scour streaks ──
    // Where the flow sped up it took the top grains away and left a darker
    // ribbon with a bright lip on the downstream side.
    for (let i = 0; i < 22; i++) {
      const x = 80 + rng() * (W - 160);
      const y = topAt(x) + 40 + rng() * 250;
      const len = 90 + rng() * 260;
      const tilt = (rng() - 0.5) * 0.16;
      g.save();
      g.translate(x, y);
      g.rotate(tilt);
      const gr = g.createLinearGradient(0, 0, len, 0);
      gr.addColorStop(0, 'rgba(120, 94, 56, 0)');
      gr.addColorStop(0.45, 'rgba(120, 94, 56, 0.2)');
      gr.addColorStop(1, 'rgba(120, 94, 56, 0)');
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(len * 0.5, 0, len * 0.5, 5 + rng() * 7, 0, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(255, 248, 222, 0.2)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(len * 0.1, 3);
      g.quadraticCurveTo(len * 0.5, 7, len * 0.92, 2);
      g.stroke();
      g.restore();
    }

    // ── Pebbles and grit shells ──
    for (let i = 0; i < 38; i++) {
      const x = 40 + rng() * (W - 80);
      const y = topAt(x) + 16 + rng() * 250;
      const rx = 3 + rng() * 7;
      blob(x, y, rx * 3, function (px, py) {
        // shadow it sits in, then the stone, then the sand piled against it
        g.fillStyle = 'rgba(72, 52, 28, 0.34)';
        g.beginPath();
        g.ellipse(px + rx * 0.5, py + rx * 0.5, rx * 1.5, rx * 0.62, 0, 0, TAU);
        g.fill();
        g.fillStyle = rng() < 0.5 ? '#aba08d' : '#8d7f6c';
        g.beginPath();
        g.ellipse(px, py, rx, rx * 0.68, rng() * TAU, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(255, 252, 232, 0.5)';
        g.beginPath();
        g.ellipse(px - rx * 0.24, py - rx * 0.24, rx * 0.5, rx * 0.24, 0, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(255, 240, 205, 0.5)';
        g.beginPath();
        g.ellipse(px, py + rx * 0.5, rx * 1.15, rx * 0.3, 0, 0, TAU);
        g.fill();
      });
    }

    // A cold film of deep water over the very bottom of the band, so the sand
    // compacts into shadow instead of staying the same blonde all the way down.
    const deep = g.createLinearGradient(0, BH - 190, 0, BH);
    deep.addColorStop(0, 'rgba(28, 40, 54, 0)');
    deep.addColorStop(1, 'rgba(28, 40, 54, 0.4)');
    g.fillStyle = deep;
    g.fillRect(-4, BH - 190, W + 8, 200);
    g.restore();

    // The skin of the sand: a bright rim where the water meets it, and a wet
    // cyan line just above it that catches whatever light is left.
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(255, 251, 226, 0.92)';
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(0, topAt(0));
    for (let x = 10; x <= W; x += 10) g.lineTo(x, topAt(x));
    g.stroke();

    g.strokeStyle = 'rgba(190, 250, 255, 0.4)';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(0, topAt(0) - 3);
    for (let x = 10; x <= W; x += 10) g.lineTo(x, topAt(x) - 3);
    g.stroke();

    g.save();
    g.beginPath();
    g.moveTo(0, topAt(0) + 12);
    for (let x = 10; x <= W; x += 10) g.lineTo(x, topAt(x) + 12);
    g.lineTo(W, topAt(W) + 12 + 16);
    g.moveTo(0, topAt(0) + 28);
    for (let x = W - 10; x >= 0; x -= 10) g.lineTo(x, topAt(x) + 28);
    g.closePath();
    g.fillStyle = 'rgba(255, 246, 210, 0.16)';
    g.fill();
    g.restore();

    // Baked kelp along the sand edge
    for (let i = 0; i < 11; i++) {
      const x = 90 + (i / 10) * (W - 180) + (rng() - 0.5) * 50;
      const y = topAt(x) + 5;
      const h = 70 + rng() * 120;
      const blades = 3 + ((rng() * 3) | 0);
      g.lineCap = 'round';
      for (let k = 0; k < blades; k++) {
        const ox = (k - (blades - 1) / 2) * 7;
        const tilt = (rng() - 0.5) * 0.5;
        const bh = h * (0.7 + rng() * 0.4);
        g.save();
        g.translate(x + ox, y);
        g.rotate(tilt);
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(-4, -bh * 0.5, (rng() - 0.5) * 8, -bh);
        g.quadraticCurveTo(6, -bh * 0.4, 5, 0);
        g.closePath();
        g.fillStyle = WEED_COLORS[(rng() * WEED_COLORS.length) | 0];
        // The plants rise above the sand line, so the deep-water wash in
        // drawSeabed never reaches them. They have to arrive already dim.
        g.globalAlpha = 0.5;
        g.fill();
        g.globalAlpha = 0.22;
        g.strokeStyle = '#0b4a36';
        g.lineWidth = 1;
        g.stroke();
        g.globalAlpha = 1;
        g.restore();
      }
    }

    // Small coral tufts on the edge, dimmed for the dark water above the bed
    g.globalAlpha = 0.55;
    for (let i = 0; i < 9; i++) {
      const x = 130 + rng() * (W - 260);
      const y = topAt(x) + 5;
      const pal = CORAL_PALETTES[(rng() * CORAL_PALETTES.length) | 0];
      const size = 10 + rng() * 22;
      g.strokeStyle = pal.dark;
      g.lineCap = 'round';
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k - 2) * 0.22;
        const len = size * (0.7 + rng() * 0.6);
        g.lineWidth = Math.max(1.4, size * 0.11) + 1.2;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        g.stroke();
      }
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k - 2) * 0.22;
        const len = size * (0.7 + rng() * 0.6);
        g.lineWidth = Math.max(1, size * 0.09);
        g.strokeStyle = pal.body;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        g.stroke();
      }
    }
    g.globalAlpha = 1;

    for (let i = 0; i < 4; i++) {
      const x = 140 + rng() * (W - 280);
      const y = topAt(x) + 22 + rng() * 80;
      drawStar(g, x, y, 5 + rng() * 4, rng() * TAU,
        rng() < 0.5 ? '#ff8fa6' : '#ffb066', '#9e4257');
    }
    for (let i = 0; i < 6; i++) {
      const x = 120 + rng() * (W - 240);
      const y = topAt(x) + 26 + rng() * 110;
      drawShell(g, x, y, 4 + rng() * 5, rng() * TAU, '#ffe9cf', '#c49a72');
    }

    return c;
  }

  // ------------------------------------------------------------------
  // Coral sprite painting
  // ------------------------------------------------------------------
  function paintCoral(g, c) {
    if (c.type === 0) {
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (const s of c.segments) {
        g.beginPath();
        g.moveTo(s.x1, s.y1);
        g.lineTo(s.x2, s.y2);
        g.strokeStyle = c.pal.dark;
        g.lineWidth = s.w + 2;
        g.stroke();
      }
      for (const s of c.segments) {
        g.beginPath();
        g.moveTo(s.x1, s.y1);
        g.lineTo(s.x2, s.y2);
        g.strokeStyle = c.pal.body;
        g.lineWidth = s.w;
        g.stroke();
        if (s.tip) {
          g.globalAlpha = 0.95;
          g.beginPath();
          g.arc(s.x2, s.y2, Math.max(1.6, s.w * 0.62), 0, TAU);
          g.fillStyle = c.pal.accent;
          g.fill();
          g.globalAlpha = 1;
        }
      }
    } else if (c.type === 1) {
      for (let i = 0; i < c.rings.length; i++) {
        const ring = c.rings[i];
        g.save();
        g.translate(0, ring.dy || 0);
        smoothPoly(g, ring.pts);
        g.fillStyle = ring.color;
        g.fill();
        g.globalAlpha = i === 0 ? 0.5 : 0.26;
        g.strokeStyle = c.pal.dark;
        g.lineWidth = i === 0 ? 2 : 1.2;
        g.stroke();
        g.restore();
      }
      const top = c.rings[c.rings.length - 1];
      g.globalAlpha = 0.4;
      g.fillStyle = c.pal.accent;
      g.beginPath();
      g.ellipse(-c.size * 0.14, (top.dy || 0) - c.size * 0.1, c.size * 0.34, c.size * 0.15, -0.25, 0, TAU);
      g.fill();
      g.globalAlpha = 1;
    } else if (c.type === 2) {
      for (const t of c.tubes) {
        g.save();
        g.translate(t.dx, 0);
        g.rotate(t.tilt);
        g.beginPath();
        g.moveTo(-t.w / 2, 0);
        g.lineTo(-t.w / 2, -t.h + t.w / 2);
        g.arc(0, -t.h + t.w / 2, t.w / 2, Math.PI, 0);
        g.lineTo(t.w / 2, 0);
        g.closePath();
        g.fillStyle = t.color;
        g.fill();
        g.strokeStyle = c.pal.dark;
        g.lineWidth = 1.6;
        g.stroke();
        g.beginPath();
        g.ellipse(0, -t.h + t.w / 2, t.w * 0.33, t.w * 0.19, 0, 0, TAU);
        g.fillStyle = c.pal.dark;
        g.fill();
        g.globalAlpha = 0.6;
        g.fillStyle = c.pal.accent;
        g.beginPath();
        g.ellipse(-t.w * 0.15, -t.h + t.w * 0.35, t.w * 0.09, t.w * 0.24, 0.2, 0, TAU);
        g.fill();
        g.globalAlpha = 1;
        g.restore();
      }
    } else {
      g.lineCap = 'round';
      g.lineJoin = 'round';
      const n = c.fan.length;
      for (let pass = 0; pass < 2; pass++) {
        g.strokeStyle = pass === 0 ? c.pal.dark : c.pal.body;
        for (let i = 0; i < n; i++) {
          const p = c.fan[i];
          const bend = (i - (n - 1) / 2) * c.size * 0.12;
          g.lineWidth = (pass === 0 ? 7 : 4) * (0.78 + 0.22 * Math.sin(i * 1.7 + 1));
          g.beginPath();
          g.moveTo(0, 0);
          g.quadraticCurveTo(p.x * 0.3 + bend * 0.35, p.y * 0.55, p.x, p.y);
          g.stroke();
          g.lineWidth = pass === 0 ? 4.6 : 2.5;
          g.beginPath();
          g.moveTo(p.x * 0.62, p.y * 0.62);
          g.quadraticCurveTo(p.x * 0.85 + c.size * 0.06, p.y * 0.9, p.x * 1.04 + c.size * 0.13, p.y * 1.08);
          g.stroke();
        }
      }
      g.strokeStyle = c.pal.dark;
      g.lineWidth = 6.6;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, -c.size * 0.3);
      g.stroke();
      g.strokeStyle = c.pal.body;
      g.lineWidth = 3.8;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, -c.size * 0.3);
      g.stroke();
      for (const p of c.fan) {
        g.beginPath();
        g.arc(p.x, p.y, 2.2, 0, TAU);
        g.fillStyle = c.pal.accent;
        g.fill();
      }
    }
  }

  // Decoration sprites are baked once into a shared library, then re-scaled
  // per instance. The expanded ocean wants ~350 corals and ~270 weed clusters,
  // and baking a private canvas for each would cost tens of megabytes on a
  // low-end machine. Reusing 36 coral and 12 weed sprites keeps that flat.
  const CORAL_LIB_SIZE = 34;
  const CORAL_VARIANTS = 9;
  const WEED_VARIANTS = 12;

  function buildCoralVariant(rng, type) {
    const size = CORAL_LIB_SIZE;
    const pal = tintPalette(CORAL_PALETTES[(rng() * CORAL_PALETTES.length) | 0], rng);
    const coral = { type: type, size: size, pal: pal };

    if (type === 0) {
      coral.segments = [];
      const grow = (bx, by, ang, len, wid, depth) => {
        const ex = bx + Math.cos(ang) * len;
        const ey = by + Math.sin(ang) * len;
        coral.segments.push({ x1: bx, y1: by, x2: ex, y2: ey, w: wid });
        if (depth <= 0) {
          coral.segments[coral.segments.length - 1].tip = true;
          return;
        }
        grow(ex, ey, ang - 0.42 - rng() * 0.2, len * 0.68, wid * 0.66, depth - 1);
        grow(ex, ey, ang + 0.3 + rng() * 0.25, len * 0.72, wid * 0.66, depth - 1);
        if (rng() < 0.4) grow(ex, ey, ang + (rng() - 0.5) * 0.2, len * 0.5, wid * 0.5, depth - 1);
      };
      grow(0, 0, -Math.PI / 2 + (rng() - 0.5) * 0.4, size * 0.62, size * 0.17, 2);
    } else if (type === 1) {
      coral.rings = [];
      for (let k = 0; k < 4; k++) {
        coral.rings.push({
          pts: blobPoints(rng, size * (0.95 - k * 0.19), size * (0.56 - k * 0.1), 8, 0.24),
          color: mixHex(pal.dark, pal.body, k / 3),
          dy: -k * size * 0.12,
          alpha: 1
        });
      }
    } else if (type === 2) {
      coral.tubes = [];
      const count = 3 + ((rng() * 3) | 0);
      for (let k = 0; k < count; k++) {
        coral.tubes.push({
          dx: (k - (count - 1) / 2) * size * 0.34 + (rng() - 0.5) * size * 0.12,
          h: size * (0.62 + rng() * 0.5),
          w: size * (0.17 + rng() * 0.09),
          tilt: (rng() - 0.5) * 0.25,
          color: k % 2 ? pal.body : pal.fin,
          rim: pal.dark
        });
      }
    } else {
      coral.fan = [];
      const spread = Math.PI * 0.78;
      const start = -Math.PI / 2 - spread / 2;
      const rays = 7;
      for (let k = 0; k < rays; k++) {
        const ang = start + (k / (rays - 1)) * spread;
        const rr = size * (0.86 + rng() * 0.18) * (1 - Math.abs(k / (rays - 1) - 0.5) * 0.22);
        coral.fan.push({ x: Math.cos(ang) * rr, y: Math.sin(ang) * rr });
      }
    }

    const w = Math.ceil(size * 3.4) + 20;
    const h = Math.ceil(size * 3.4) + 20;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.translate(w / 2, h * 0.86);
    paintCoral(g, coral);
    return { sprite: c, sw: w, sh: h, baseY: h * 0.86, cull: size * 1.8, glowColor: pal.body };
  }

  function buildCoralLibrary(rng) {
    const lib = [];
    for (let t = 0; t < 4; t++) {
      for (let v = 0; v < CORAL_VARIANTS; v++) lib.push(buildCoralVariant(rng, t));
    }
    return lib;
  }

  function buildWeedVariant(rng) {
    const size = 20;
    const cluster = { phase: rng() * TAU, blades: [] };
    const count = 4 + ((rng() * 3) | 0);
    for (let k = 0; k < count; k++) {
      cluster.blades.push({
        ox: (rng() - 0.5) * size * 2.2,
        h: 48 + rng() * 96,
        w: 5.5 + rng() * 6.5,
        tilt: (rng() - 0.5) * 0.3,
        lean: (rng() - 0.5) * 44,
        curve: (8 + rng() * 16) * (rng() < 0.5 ? -1 : 1),
        phase: rng() * TAU,
        color: WEED_COLORS[(rng() * WEED_COLORS.length) | 0]
      });
    }

    let minX = 0;
    let maxX = 0;
    let maxH = 20;
    for (const b of cluster.blades) {
      const lean = b.lean || 0;
      minX = Math.min(minX, b.ox - b.w, b.ox + lean - b.w);
      maxX = Math.max(maxX, b.ox + b.w, b.ox + lean + b.w);
      maxH = Math.max(maxH, b.h);
    }
    const pad = 18;
    const w = Math.ceil(maxX - minX + pad * 2);
    const h = Math.ceil(maxH + pad * 1.6);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    const baseX = -minX + pad;
    const baseY = h - pad * 0.6;

    for (const blade of cluster.blades) {
      const bakeSway = Math.sin(blade.phase) * 0.04;
      g.save();
      g.translate(baseX + blade.ox, baseY);
      g.rotate(blade.tilt + bakeSway);
      const bh = blade.h;
      const bw = blade.w;
      const lean = blade.lean || 0;
      const curve = blade.curve || 0;
      const segs = 8;
      const pts = [];
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        pts.push({
          x: Math.sin(t * 2.4 + blade.phase) * curve * 0.4 + t * t * lean,
          y: -bh * t,
          w: bw * (1 - 0.84 * t) + 0.7
        });
      }
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < segs; i++) {
          g.beginPath();
          g.moveTo(pts[i].x, pts[i].y);
          g.lineTo(pts[i + 1].x, pts[i + 1].y);
          if (pass === 0) {
            g.strokeStyle = 'rgba(7, 62, 47, 0.5)';
            g.lineWidth = pts[i].w + 2.2;
          } else {
            g.strokeStyle = blade.color;
            g.lineWidth = pts[i].w;
          }
          g.stroke();
        }
      }
      g.globalAlpha = 0.34;
      g.strokeStyle = 'rgba(226, 255, 235, 0.9)';
      g.lineWidth = 1.1;
      g.beginPath();
      g.moveTo(pts[0].x - bw * 0.2, -2);
      for (let i = 1; i <= segs; i++) g.lineTo(pts[i].x - pts[i].w * 0.2, pts[i].y);
      g.stroke();
      g.globalAlpha = 1;
      g.restore();
    }

    return { sprite: c, sw: w, sh: h, baseX: baseX, baseY: baseY, cull: Math.max(w, h) * 0.55 };
  }

  function buildWeedLibrary(rng) {
    const lib = [];
    for (let v = 0; v < WEED_VARIANTS; v++) lib.push(buildWeedVariant(rng));
    return lib;
  }

  // ------------------------------------------------------------------
  // Landmarks
  // ------------------------------------------------------------------
  // Sea stacks and vents stay as vector shapes instead of baked canvases: a
  // stack can be 3000px tall, so baking one sprite per stack would burn
  // several megabytes each. Only the wreck, which carries a lot of static
  // detail, is baked - and it is baked once and shared by every instance.
  function makeSeaStack(rng, x, baseY, height, width) {
    const steps = 7;
    const left = [];
    const right = [];
    const wobble = rng() * TAU;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = -height * t;
      const taper = 1 - t * 0.6 + Math.sin(t * 5.1 + wobble) * 0.08;
      const hw = Math.max(width * 0.09, width * 0.5 * taper);
      const jitter = (rng() - 0.5) * width * 0.07;
      left.push({ x: -hw + jitter, y: y });
      right.push({ x: hw + jitter, y: y });
    }
    const shelves = [];
    for (let i = 1; i < steps - 1; i++) {
      if (rng() < 0.6) shelves.push({ x: right[i].x, y: right[i].y, w: 44 + rng() * 96 });
      if (rng() < 0.45) shelves.push({ x: left[i].x, y: left[i].y, w: 40 + rng() * 80 });
    }
    return {
      kind: 'stack', x: x, baseY: baseY, height: height, width: width,
      left: left, right: right, shelves: shelves,
      color: ROCK_COLORS[(rng() * ROCK_COLORS.length) | 0],
      arch: null, cull: width
    };
  }

  function makeVent(rng, x, y, size) {
    const chimneys = [];
    const count = 3 + ((rng() * 3) | 0);
    const spread = size * (count - 1) * 0.39;
    for (let i = 0; i < count; i++) {
      chimneys.push({
        dx: (i - (count - 1) / 2) * size * 0.78 + (rng() - 0.5) * size * 0.3,
        h: size * (0.7 + rng() * 0.7),
        w: size * (0.4 + rng() * 0.32),
        tilt: (rng() - 0.5) * 0.22,
        hot: rng() < 0.7
      });
    }

    // A low hill of basalt the chimneys grow out of. Without it a chimney reads
    // as a pillar standing on its own, and the field looks dropped into water.
    const mounds = [];
    const moundCount = 3 + ((rng() * 3) | 0);
    for (let i = 0; i < moundCount; i++) {
      const mr = size * (0.8 + rng() * 0.85);
      const mry = mr * (0.34 + rng() * 0.2);
      const mdx = (rng() - 0.5) * (spread * 2 + size * 1.6);
      mounds.push({
        dx: mdx,
        dy: mry * (0.34 + rng() * 0.26),
        rx: mr,
        ry: mry,
        pts: blobPoints(rng, mr, mry, 9, 0.3),
        color: i % 2 === 0 ? '#233440' : '#1a262e'
      });
    }
    mounds.sort(function (a, b) { return a.dy - b.dy; });

    return {
      kind: 'vent', x: x, y: y, size: size,
      chimneys: chimneys, mounds: mounds,
      reach: spread + size * 1.9,
      phase: rng() * TAU
    };
  }

  // ------------------------------------------------------------------
  // The crashed plane
  //
  // Not a tidy museum piece: a airliner that came in on the sand a decade ago,
  // snapped in two behind the wing, nose ploughed under, tail still standing.
  // Ten years of current has done the rest - paint flaked, barnacles on every
  // upward face, coral in the window rows, and a drift of sand piled against
  // everything the sea could not carry away. Baked once, shared by every wreck
  // site, so the cost is one blit per plane on screen.
  // ------------------------------------------------------------------
  function makePlaneWreckSprite(seed) {
    const rng = A.seedRand(seed);
    const w = 900;
    const h = 420;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');

    const MET = { lit: '#b3c0c8', body: '#7c8a95', dark: '#48555f', deep: '#232c34' };
    const BARE = '#9aa1a6';
    const PAINT = '#2e7377';
    const RUST = 'rgba(126, 78, 44, 0.5)';
    const yGround = 330;

    // A torn end of a tube: the jagged lip plus the dark hollow behind it.
    function tear(x, r, dir) {
      g.beginPath();
      g.moveTo(x, -r);
      const n = 7;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const yy = -r + t * r * 2;
        const bite = (i % 2 ? 1 : -1) * (6 + rng() * 12);
        g.lineTo(x + bite * dir, yy);
      }
      g.lineTo(x, r);
      g.closePath();
      g.fillStyle = MET.deep;
      g.fill();
      g.strokeStyle = MET.dark;
      g.lineWidth = 3;
      g.stroke();
      // bent frames still spanning the hole
      g.strokeStyle = 'rgba(150, 164, 174, 0.55)';
      g.lineWidth = 2.4;
      for (let i = 0; i < 4; i++) {
        const yy = -r * 0.7 + i * r * 0.45;
        g.beginPath();
        g.moveTo(x - dir * 4, yy);
        g.quadraticCurveTo(x + dir * 16, yy + 9, x + dir * 3, yy + r * 0.4);
        g.stroke();
      }
    }

    // A row of cabin windows, some of them gone dark, a few cracked open.
    function windows(x0, x1, y, step, r) {
      for (let x = x0; x < x1; x += step) {
        if (rng() < 0.12) continue;
        g.beginPath();
        g.ellipse(x, y, r * 0.72, r, 0, 0, TAU);
        g.fillStyle = 'rgba(8, 20, 28, 0.92)';
        g.fill();
        g.strokeStyle = 'rgba(196, 210, 218, 0.5)';
        g.lineWidth = 1.6;
        g.stroke();
        if (rng() < 0.18) {
          g.strokeStyle = 'rgba(226, 240, 246, 0.6)';
          g.lineWidth = 1.1;
          g.beginPath();
          g.moveTo(x - r * 0.5, y - r * 0.4);
          g.lineTo(x + r * 0.4, y + r * 0.5);
          g.stroke();
        }
      }
    }

    // Oxidised metal: light along the shoulder the current sweeps, dark below.
    function tubeGrad(r) {
      const gr = g.createLinearGradient(0, -r, 0, r);
      gr.addColorStop(0, MET.lit);
      gr.addColorStop(0.34, MET.body);
      gr.addColorStop(0.74, MET.dark);
      gr.addColorStop(1, MET.deep);
      return gr;
    }

    // Rust bleeding down from the window line, and the dents of the impact.
    function weather(x0, x1, r) {
      g.save();
      g.beginPath();
      g.rect(x0, -r, x1 - x0, r * 2);
      g.clip();
      for (let i = 0; i < 12; i++) {
        const x = x0 + rng() * (x1 - x0);
        const len = 8 + rng() * 26;
        g.strokeStyle = RUST;
        g.lineWidth = 1.4 + rng() * 2.2;
        g.beginPath();
        g.moveTo(x, -r * 0.2);
        g.quadraticCurveTo(x + 2, -r * 0.2 + len * 0.6, x - 1, -r * 0.2 + len);
        g.stroke();
      }
      for (let i = 0; i < 9; i++) {
        const x = x0 + rng() * (x1 - x0);
        const y = -r + rng() * r * 2;
        const rr = 7 + rng() * 20;
        const gr = g.createRadialGradient(x, y - rr * 0.3, 1, x, y, rr);
        gr.addColorStop(0, 'rgba(226, 238, 244, 0.2)');
        gr.addColorStop(0.6, 'rgba(38, 48, 56, 0.16)');
        gr.addColorStop(1, 'rgba(38, 48, 56, 0)');
        g.fillStyle = gr;
        g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      }
      g.restore();
    }

    // Sand piled against whatever the sea could not move. Drawn last so it
    // buries the bottoms of everything instead of sitting behind it.
    function drift(x, y, rx, ry) {
      g.save();
      g.beginPath();
      g.moveTo(x - rx, yGround + 40);
      g.quadraticCurveTo(x - rx * 0.6, y - ry * 1.5, x, y - ry);
      g.quadraticCurveTo(x + rx * 0.62, y - ry * 1.4, x + rx, yGround + 40);
      g.closePath();
      const gr = g.createLinearGradient(0, y - ry, 0, yGround + 30);
      gr.addColorStop(0, '#ffeec4');
      gr.addColorStop(0.5, '#e9cf9c');
      gr.addColorStop(1, '#c8a874');
      g.fillStyle = gr;
      g.fill();
      g.strokeStyle = 'rgba(255, 250, 224, 0.55)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x - rx * 0.92, yGround + 30);
      g.quadraticCurveTo(x - rx * 0.5, y - ry * 1.35, x, y - ry);
      g.stroke();
      // ripples on the drift
      g.strokeStyle = 'rgba(126, 100, 58, 0.16)';
      g.lineWidth = 1.6;
      for (let i = 1; i < 4; i++) {
        const k = i / 4;
        g.beginPath();
        g.moveTo(x - rx * (0.95 - k * 0.1), yGround + 26 - i * 9);
        g.quadraticCurveTo(x, yGround + 8 - i * 13, x + rx * (0.95 - k * 0.1), yGround + 26 - i * 9);
        g.stroke();
      }
      g.restore();
    }

    // --- what is left of the hull lies in the silt shadow it fell into ---
    g.globalAlpha = 0.32;
    g.fillStyle = '#0a2434';
    g.beginPath();
    g.ellipse(430, yGround + 16, 400, 26, 0, 0, TAU);
    g.fill();
    g.globalAlpha = 1;

    // --- debris field, half a wingspan of it ---
    for (let i = 0; i < 9; i++) {
      const x = 120 + rng() * 700;
      const y = yGround + 6 + rng() * 22;
      const s = 8 + rng() * 22;
      g.save();
      g.translate(x, y);
      g.rotate((rng() - 0.5) * 1.6);
      g.fillStyle = rng() < 0.4 ? BARE : MET.dark;
      g.beginPath();
      g.moveTo(-s, -s * 0.24);
      g.lineTo(s * 0.7, -s * 0.42);
      g.lineTo(s, s * 0.3);
      g.lineTo(-s * 0.4, s * 0.42);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(20, 28, 34, 0.6)';
      g.lineWidth = 1.6;
      g.stroke();
      g.restore();
    }

    // --- the wing: torn off, lying flat, and mostly buried already ---
    g.save();
    g.translate(398, 322);
    g.rotate(0.055);
    g.beginPath();
    g.moveTo(0, -14);
    g.lineTo(330, -5);
    g.quadraticCurveTo(352, 0, 330, 6);
    g.lineTo(0, 16);
    g.quadraticCurveTo(-14, 1, 0, -14);
    g.closePath();
    const wg = g.createLinearGradient(0, -14, 0, 16);
    wg.addColorStop(0, MET.lit);
    wg.addColorStop(0.5, MET.body);
    wg.addColorStop(1, MET.deep);
    g.fillStyle = wg;
    g.fill();
    g.strokeStyle = 'rgba(18, 26, 32, 0.7)';
    g.lineWidth = 3;
    g.stroke();
    // faded livery on the upper surface, flaking where the sun got at it
    g.fillStyle = 'rgba(46, 115, 119, 0.5)';
    for (let x = 30; x < 300; x += 46) {
      if (rng() < 0.35) continue;
      g.fillRect(x, -9, 34, 7);
    }
    g.strokeStyle = 'rgba(240, 248, 250, 0.24)';
    g.lineWidth = 1.4;
    for (let x = 20; x < 320; x += 26) {
      g.beginPath();
      g.moveTo(x, -12);
      g.lineTo(x + 10, 13);
      g.stroke();
    }
    g.restore();

    // --- engine: still on its pylon, sunk into the sand up to its belly ---
    g.save();
    g.translate(470, 296);
    g.rotate(0.07);
    g.beginPath();
    g.moveTo(0, -30);
    g.lineTo(112, -26);
    g.quadraticCurveTo(134, -2, 112, 24);
    g.lineTo(0, 28);
    g.quadraticCurveTo(-20, 0, 0, -30);
    g.closePath();
    const eg = g.createLinearGradient(0, -30, 0, 28);
    eg.addColorStop(0, MET.lit);
    eg.addColorStop(0.44, MET.body);
    eg.addColorStop(1, MET.deep);
    g.fillStyle = eg;
    g.fill();
    g.strokeStyle = 'rgba(16, 24, 30, 0.78)';
    g.lineWidth = 3.2;
    g.stroke();
    // intake, and the fan still inside it
    g.beginPath();
    g.ellipse(-2, 0, 13, 29, 0, 0, TAU);
    g.fillStyle = '#10181e';
    g.fill();
    g.strokeStyle = 'rgba(206, 220, 228, 0.7)';
    g.lineWidth = 4;
    g.stroke();
    g.strokeStyle = 'rgba(170, 186, 196, 0.4)';
    g.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const a = -1.2 + i * 0.36;
      g.beginPath();
      g.moveTo(-2, 0);
      g.lineTo(-2 + Math.cos(a) * 11, Math.sin(a) * 26);
      g.stroke();
    }
    // pylon back up to where the wing used to be
    g.fillStyle = MET.dark;
    g.beginPath();
    g.moveTo(30, -30);
    g.lineTo(58, -46);
    g.lineTo(84, -44);
    g.lineTo(66, -28);
    g.closePath();
    g.fill();
    g.restore();

    // --- bent main gear, wheel still on the axle ---
    g.strokeStyle = MET.dark;
    g.lineCap = 'round';
    g.lineWidth = 11;
    g.beginPath();
    g.moveTo(566, 300);
    g.lineTo(540, 340);
    g.lineTo(556, 360);
    g.stroke();
    g.fillStyle = '#2b3339';
    g.beginPath();
    g.ellipse(558, 366, 24, 21, 0.1, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(196, 210, 218, 0.42)';
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(558, 366, 24, 21, 0.1, 0, TAU);
    g.stroke();

    // --- forward fuselage: the part that hit first, nose under the sand ---
    g.save();
    g.translate(100, 320);
    g.rotate(-0.095);
    g.beginPath();
    g.moveTo(232, -46);
    g.lineTo(64, -44);
    g.bezierCurveTo(24, -42, -6, -26, -14, -2);
    g.bezierCurveTo(-6, 24, 26, 42, 66, 44);
    g.lineTo(232, 46);
    g.closePath();
    g.fillStyle = tubeGrad(46);
    g.fill();
    g.strokeStyle = 'rgba(14, 22, 28, 0.8)';
    g.lineWidth = 3.4;
    g.stroke();
    // cockpit glass, still in its frame
    g.fillStyle = 'rgba(10, 26, 36, 0.92)';
    for (let i = 0; i < 3; i++) {
      const x = 30 + i * 21;
      g.beginPath();
      g.moveTo(x, -30);
      g.lineTo(x + 17, -28);
      g.lineTo(x + 13, -14);
      g.lineTo(x - 3, -15);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(204, 222, 232, 0.5)';
      g.lineWidth = 1.6;
      g.stroke();
    }
    windows(84, 226, -12, 24, 7);
    g.fillStyle = 'rgba(46, 115, 119, 0.55)';
    g.fillRect(60, 12, 172, 11);
    weather(60, 232, 46);
    tear(232, 46, 1);
    g.restore();

    // --- aft fuselage + tail: what the sea could not take ---
    g.save();
    g.translate(352, 288);
    g.rotate(-0.114);

    // vertical fin, snapped most of the way up
    g.beginPath();
    g.moveTo(300, -36);
    g.lineTo(372, -176);
    g.lineTo(392, -150);
    g.lineTo(400, -166);
    g.lineTo(416, -138);
    g.lineTo(424, -152);
    g.lineTo(438, -40);
    g.closePath();
    const fg = g.createLinearGradient(300, -176, 438, -36);
    fg.addColorStop(0, MET.lit);
    fg.addColorStop(0.5, MET.body);
    fg.addColorStop(1, MET.dark);
    g.fillStyle = fg;
    g.fill();
    g.strokeStyle = 'rgba(14, 22, 28, 0.8)';
    g.lineWidth = 3.4;
    g.stroke();
    // what is left of the livery on the fin
    g.fillStyle = 'rgba(46, 115, 119, 0.6)';
    g.beginPath();
    g.moveTo(330, -104);
    g.lineTo(378, -108);
    g.lineTo(410, -60);
    g.lineTo(352, -58);
    g.closePath();
    g.fill();
    // ribs of the torn tip
    g.strokeStyle = 'rgba(198, 214, 224, 0.5)';
    g.lineWidth = 2.4;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(356 + i * 22, -146 + i * 22);
      g.lineTo(368 + i * 24, -172 + i * 26);
      g.stroke();
    }
    // horizontal stabiliser, one side of it gone
    g.beginPath();
    g.moveTo(404, -52);
    g.lineTo(492, -78);
    g.lineTo(504, -66);
    g.lineTo(420, -34);
    g.closePath();
    g.fillStyle = MET.body;
    g.fill();
    g.strokeStyle = 'rgba(14, 22, 28, 0.7)';
    g.lineWidth = 2.6;
    g.stroke();

    // the tube itself, tapering to the tail cone
    g.beginPath();
    g.moveTo(0, -46);
    g.lineTo(392, -44);
    g.quadraticCurveTo(452, -36, 470, -12);
    g.quadraticCurveTo(452, 24, 392, 40);
    g.lineTo(0, 46);
    g.closePath();
    g.fillStyle = tubeGrad(46);
    g.fill();
    g.strokeStyle = 'rgba(14, 22, 28, 0.82)';
    g.lineWidth = 3.6;
    g.stroke();
    tear(0, 46, -1);
    windows(56, 300, -14, 25, 7.5);
    g.fillStyle = 'rgba(46, 115, 119, 0.55)';
    g.fillRect(40, 8, 300, 12);
    // a gash the sand opened along the belly
    g.fillStyle = 'rgba(8, 14, 18, 0.85)';
    g.beginPath();
    g.moveTo(150, 34);
    g.lineTo(214, 26);
    g.lineTo(248, 40);
    g.lineTo(166, 44);
    g.closePath();
    g.fill();
    weather(40, 380, 46);
    g.restore();

    // --- ten years of growth on every face the light reaches ---
    for (let i = 0; i < 30; i++) {
      const x = 120 + rng() * 690;
      const y = 150 + rng() * 180;
      const pal = CORAL_PALETTES[(rng() * CORAL_PALETTES.length) | 0];
      g.strokeStyle = pal.body;
      g.lineCap = 'round';
      const n = 3 + ((rng() * 3) | 0);
      for (let k = 0; k < n; k++) {
        const hh = 9 + rng() * 24;
        g.lineWidth = 1.6 + rng() * 2;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + (k - n / 2) * 5, y - hh * 0.6, x + (k - n / 2) * 9, y - hh);
        g.stroke();
      }
    }
    // barnacles crowd the upward faces
    for (let i = 0; i < 130; i++) {
      const x = 100 + rng() * 700;
      const band = rng();
      const y = band < 0.5 ? 250 + rng() * 60 : 130 + rng() * 90;
      const r = 1.6 + rng() * 3.4;
      g.fillStyle = 'rgba(226, 234, 222, 0.62)';
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(116, 128, 124, 0.5)';
      g.beginPath();
      g.arc(x, y, r * 0.45, 0, TAU);
      g.fill();
    }
    // sponges and algae
    for (let i = 0; i < 8; i++) {
      const x = 150 + rng() * 620;
      const y = 240 + rng() * 70;
      const r = 8 + rng() * 14;
      g.fillStyle = rng() < 0.5 ? 'rgba(196, 108, 140, 0.55)' : 'rgba(214, 168, 88, 0.5)';
      g.beginPath();
      g.ellipse(x, y, r, r * 0.66, rng(), 0, TAU);
      g.fill();
    }
    g.fillStyle = 'rgba(64, 122, 96, 0.2)';
    for (let i = 0; i < 7; i++) {
      const x = 120 + rng() * 640;
      g.beginPath();
      g.ellipse(x, 232 + rng() * 90, 40 + rng() * 70, 8 + rng() * 9, 0, 0, TAU);
      g.fill();
    }

    // --- and the sand, taking it back ---
    drift(120, 318, 120, 26);
    drift(300, 300, 74, 16);
    drift(430, 300, 70, 14);
    drift(512, 318, 96, 22);
    drift(600, 316, 88, 18);
    drift(742, 300, 70, 14);
    drift(820, 292, 54, 12);

    // scattered grains on top of everything, so the wreck belongs to the bed
    for (let i = 0; i < 420; i++) {
      const x = 110 + rng() * 720;
      const y = 230 + rng() * 150;
      g.fillStyle = rng() < 0.5 ? 'rgba(255, 245, 214, 0.4)' : 'rgba(150, 122, 76, 0.3)';
      g.fillRect(x, y, 1.6, 1.3);
    }

    for (let i = 0; i < 6; i++) {
      const x = 140 + rng() * 640;
      const y = yGround + 18 + rng() * 26;
      drawShell(g, x, y, 4 + rng() * 5, rng() * TAU, '#ffe9cf', '#c49a72');
    }
    return c;
  }
  const WRECK_SPRITES = [makePlaneWreckSprite(1777), makePlaneWreckSprite(4211)];

  // ------------------------------------------------------------------
  // OceanWorld
  // ------------------------------------------------------------------
  class OceanWorld {
    constructor(seed) {
      this.seed = seed || (Math.random() * 1e9) | 0;
      this.generate(this.seed);
      this.bubbles = [];
      this.initBubbles();
      this.bgGrad = null;
      this.bgW = 0;
      this.bgH = 0;
      this.bgT = -1;
    }

    generate(seed) {
      const rng = A.seedRand(seed);
      this.rocks = [];
      this.anchors = [];
      this.corals = [];
      this.weeds = [];
      this.caves = [];
      this.details = [];
      this.plants = [];
      this.schools = [];
      this.stacks = [];
      this.vents = [];
      this.wrecks = [];
      this.ventSmoke = [];
      this.seabed = makeSeabedSprite((seed ^ 0x5f3a1) >>> 0);
      this.coralLib = buildCoralLibrary(rng);
      this.weedLib = buildWeedLibrary(rng);

      // Everything below is world-space decoration, so counts follow the
      // current world area instead of a fixed number. Resizing A.WORLD keeps
      // the reef equally dense without editing this file again.
      const areaK = (WORLD.w * WORLD.h) / (7200 * 5200);
      this.areaK = areaK;
      const count = function (base) { return Math.max(1, Math.round(base * areaK)); };

      this.clouds = [
        { sprite: 0, u: 0.07, y: 16, scale: 0.72 },
        { sprite: 1, u: 0.25, y: 44, scale: 0.5 },
        { sprite: 0, u: 0.45, y: 8, scale: 0.82 },
        { sprite: 1, u: 0.61, y: 52, scale: 0.54 },
        { sprite: 0, u: 0.91, y: 22, scale: 0.66 }
      ];

      this.seabirds = [
        { x: 0.15, y: 0.28, scale: 0.85, speed: 1.1, phase: 0.2 },
        { x: 0.42, y: 0.45, scale: 0.65, speed: 0.9, phase: 1.8 },
        { x: 0.78, y: 0.22, scale: 1.05, speed: 1.3, phase: 3.4 },
        { x: 0.88, y: 0.38, scale: 0.72, speed: 1.0, phase: 4.9 }
      ];

      this.snowMotes = [];
      for (let i = 0; i < 48; i++) {
        this.snowMotes.push({
          x: rng() * WORLD.w,
          y: rng() * WORLD.h,
          r: 1.0 + rng() * 1.8,
          speedY: 5 + rng() * 12,
          driftX: 3 + rng() * 6,
          phase: rng() * TAU,
          alpha: 0.22 + rng() * 0.38
        });
      }

      this.bioMotes = [];
      for (let i = 0; i < 44; i++) {
        this.bioMotes.push({
          x: rng() * WORLD.w,
          y: rng() * WORLD.h,
          r: 1.4 + rng() * 3.4,
          speedY: -(3 + rng() * 9),
          driftX: 2 + rng() * 5,
          phase: rng() * TAU,
          blink: 0.35 + rng() * 1.5,
          hue: rng() < 0.62 ? 0 : (rng() < 0.7 ? 1 : 2)
        });
      }

      // Distant megafauna: a handful of shapes on their own slow belts, far
      // behind the reef. They are only ever seen in the deep half of the map.
      this.leviathans = [
        { u: 0.10, band: 0.24, size: 1.15, speed: 11, dir: 1, kind: 0, phase: 0.4, alpha: 0.34 },
        { u: 0.54, band: 0.50, size: 0.78, speed: 8, dir: -1, kind: 1, phase: 2.1, alpha: 0.30 },
        { u: 0.82, band: 0.70, size: 0.96, speed: 13, dir: 1, kind: 2, phase: 4.2, alpha: 0.26 },
        { u: 0.31, band: 0.38, size: 0.58, speed: 16, dir: -1, kind: 0, phase: 5.6, alpha: 0.22 }
      ];

      for (let i = 0; i < count(52); i++) {
        const size = 30 + rng() * 66;
        const cx = 160 + rng() * (WORLD.w - 320);
        this.rocks.push(this.makeRockCluster(rng, cx, floorAt(cx) + 4, size));
      }

      const borderSpace = 340;
      for (let x = 120; x < WORLD.w - 80; x += borderSpace) {
        const bx = x + (rng() - 0.5) * 120;
        this.rocks.push(this.makeRockCluster(rng, bx, floorAt(bx) + 2, 80 + rng() * 70));
      }
      for (let y = WORLD.h * 0.55; y < FLOOR_Y - 160; y += borderSpace) {
        this.rocks.push(this.makeRockCluster(rng, 80 + rng() * 130, y + (rng() - 0.5) * 120, 80 + rng() * 70));
        this.rocks.push(this.makeRockCluster(rng, WORLD.w - 80 - rng() * 130, y + (rng() - 0.5) * 120, 80 + rng() * 70));
      }

      // ── Sea spires: tall rock columns rising out of the deep ──
      // They give the mid-water something to swim around, break the empty
      // horizontal stretch of the expanded map, and host coral on their
      // shoulders. Every third one is flagged as a point of interest.
      const stackCount = Math.max(6, Math.round(WORLD.w / 900));
      for (let i = 0; i < stackCount; i++) {
        const x = 700 + (i / stackCount) * (WORLD.w - 1400) + (rng() - 0.5) * 420;
        const baseY = floorAt(x) + 46;
        const height = 1300 + rng() * 2100;
        const width = 240 + rng() * 300;
        const stack = makeSeaStack(rng, x, baseY, height, width);
        // Spires rise out of the deep, where there is no sunlight left to
        // catch. Their palette is baked once here rather than shaded per frame.
        const lit = A.clamp(1 - (baseY / WORLD.h - 0.6) / 0.26, 0.1, 1);
        stack.lit = lit;
        stack.shade = mixHex(stack.color, '#03060c', 1 - lit);
        stack.shelfColor = mixHex(stack.color, '#a8ecff', 0.05 + 0.17 * lit);
        stack.poi = (i % 3 === 0) ? 'Sea Spire' : null;
        this.stacks.push(stack);
        if (stack.poi) this.caves.push({ x: x, y: baseY - height * 0.55, r: width * 1.5, label: stack.poi });
      }

      // ── Crashed planes resting on the deep sand ──
      const wreckCount = Math.max(2, Math.round(WORLD.w / 4200));
      for (let i = 0; i < wreckCount; i++) {
        const x = 900 + (i / wreckCount) * (WORLD.w - 1800) + (rng() - 0.5) * 700;
        const y = floorAt(x) + 26;
        const scale = 0.72 + rng() * 0.5;
        this.wrecks.push({
          x: x, y: y, scale: scale, flip: rng() < 0.5,
          sprite: WRECK_SPRITES[(rng() * WRECK_SPRITES.length) | 0],
          tilt: (rng() - 0.5) * 0.1
        });
        this.caves.push({ x: x, y: y - 150 * scale, r: 460 * scale, label: 'Crashed Plane' });
      }

      // ── Hydrothermal vent fields on the deep floor ──
      const ventCount = Math.max(4, Math.round(WORLD.w / 1300));
      for (let i = 0; i < ventCount; i++) {
        const x = 500 + (i / ventCount) * (WORLD.w - 1000) + (rng() - 0.5) * 500;
        this.vents.push(makeVent(rng, x, floorAt(x) + 10, 60 + rng() * 70));
      }
      for (let i = 0; i < Math.max(2, Math.round(ventCount / 3)); i++) {
        const v = this.vents[Math.floor((i / Math.max(2, Math.round(ventCount / 3))) * this.vents.length)];
        if (v) this.caves.push({ x: v.x, y: v.y, r: v.reach * 1.4, label: 'Vent Field' });
      }

      this.anchors = this.rocks.slice();
      for (const s of this.stacks) this.anchors.push({ x: s.x, y: s.baseY, cull: s.width * 1.4 });

      const anchorAt = () => this.anchors[(rng() * this.anchors.length) | 0];
      const pickLib = (lib) => lib[(rng() * lib.length) | 0];

      for (let i = 0; i < count(96); i++) {
        const a = anchorAt();
        const deep = a.y > WORLD.h * 0.84;
        const lib = pickLib(this.coralLib);
        const x = A.clamp(a.x + (rng() - 0.5) * a.cull * 1.7, 190, WORLD.w - 190);
        this.corals.push({
          x: x,
          y: floorAt(x) + 4 + rng() * 12,
          lib: lib,
          // Bioluminescent colonies only establish themselves in the dark.
          glow: deep && rng() < 0.55,
          scale: 0.62 + rng() * 1.15,
          phase: rng() * TAU,
          sway: 0.012 + rng() * 0.02
        });
      }

      for (let i = 0; i < count(76); i++) {
        const a = anchorAt();
        const lib = pickLib(this.weedLib);
        const x = A.clamp(a.x + (rng() - 0.5) * a.cull * 1.8, 180, WORLD.w - 180);
        this.weeds.push({
          x: x,
          y: floorAt(x) + 3 + rng() * 10,
          lib: lib,
          phase: rng() * TAU,
          scale: 0.7 + rng() * 1.3
        });
      }

      // ── Drift weed ──
      // The upper two thirds of the column is pelagic water, and without any
      // habitat in it the Sunlit Shallows and Kelp Forest read as empty blue.
      // Weed rafts drift there, the way sargassum does in the real ocean.
      for (let i = 0; i < count(30); i++) {
        const lib = pickLib(this.weedLib);
        this.weeds.push({
          x: 240 + rng() * (WORLD.w - 480),
          y: WORLD.h * (0.14 + rng() * 0.4),
          lib: lib,
          phase: rng() * TAU,
          scale: 0.5 + rng() * 0.85,
          drift: true
        });
      }

      for (let i = 0; i < count(44); i++) {
        const a = anchorAt();
        const pal = CORAL_PALETTES[(rng() * CORAL_PALETTES.length) | 0];
        const x = A.clamp(a.x + (rng() - 0.5) * a.cull * 1.9, 170, WORLD.w - 170);
        this.details.push({
          x: x,
          y: floorAt(x) + 2 + rng() * 8,
          type: rng() < 0.55 ? 0 : 1,
          r: 6 + rng() * 7,
          rot: rng() * TAU,
          color: rng() < 0.5 ? pal.body : pal.accent,
          dark: pal.dark
        });
      }

      for (let i = 0; i < count(7); i++) {
        this.schools.push({
          x: 300 + rng() * (WORLD.w - 600),
          y: 360 + rng() * (WORLD.h - 720),
          dir: rng() < 0.5 ? 1 : -1,
          speed: 7 + rng() * 9,
          scale: 0.7 + rng() * 0.8,
          sprite: SCHOOL_SPRITES[(rng() * SCHOOL_SPRITES.length) | 0],
          phase: rng() * TAU
        });
      }

      const MARKER_COLORS = {
        'Sea Spire': '#8fd8ff',
        'Crashed Plane': '#ffd27a',
        'Vent Field': '#ff8b6b'
      };
      this.mapMarkers = [];
      for (let i = 0; i < this.caves.length; i++) {
        const c = this.caves[i];
        if (!c.label) continue;
        this.mapMarkers.push({
          x: c.x, y: c.y, r: c.r, label: c.label,
          color: MARKER_COLORS[c.label] || '#bfe9ff',
          seen: false
        });
      }
    }

    makeRockCluster(rng, x, y, size) {
      const rocks = [];
      const count = 2 + ((rng() * 3) | 0);
      for (let i = 0; i < count; i++) {
        const rx = size * (0.42 + rng() * 0.56);
        const ry = rx * (0.52 + rng() * 0.34);
        const cx = (rng() - 0.5) * size * 1.0;
        rocks.push({
          cx: cx,
          // Sunk a little into the sand and following the sand line where the
          // cluster is wide, so a boulder never perches on nothing.
          cy: -ry * (0.16 + rng() * 0.3) + (floorAt(x + cx) - y),
          pts: blobPoints(rng, rx, ry, 8, 0.24),
          color: ROCK_COLORS[(rng() * ROCK_COLORS.length) | 0],
          moss: [{ a: rng() * TAU, d: 0.4 + rng() * 0.4 }],
          rx: rx,
          ry: ry
        });
      }
      rocks.sort(function (a, b) { return a.cy - b.cy; });
      return {
        x: x, y: y,
        cull: size * 1.5,
        rocks: rocks
      };
    }

    initBubbles() {
      this.bubbles.length = 0;
      const n = Math.round(96 * (this.areaK || 1));
      for (let i = 0; i < n; i++) {
        const b = {};
        this.spawnBubble(b);
        b.y = A.rand(0, WORLD.h);
        this.bubbles.push(b);
      }
    }

    spawnBubble(b) {
      b.x = A.rand(60, WORLD.w - 60);
      b.y = A.rand(0, WORLD.h);
      b.r = A.rand(1.8, 5.6);
      b.speed = A.rand(13, 34);
      b.phase = A.rand(0, TAU);
      b.wobbleSpeed = A.rand(0.5, 1.5);
      b.drift = A.rand(2, 8);
      b.alpha = A.rand(0.3, 0.68);
    }

    emitSmoke(x, y) {
      const sm = this.ventSmoke;
      if (sm.length >= 150) sm.shift();
      sm.push({
        x: x, y: y, r: 6 + Math.random() * 10,
        vy: 26 + Math.random() * 30,
        grow: 14 + Math.random() * 20,
        phase: Math.random() * TAU,
        life: 3.4, maxLife: 3.4
      });
    }

    update(dt, time, cam) {
      const bubbles = this.bubbles;
      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        b.y -= b.speed * dt;
        b.phase += dt * b.wobbleSpeed;
        b.x += Math.sin(b.phase) * b.drift * dt;
        if (b.y < -30) {
          this.spawnBubble(b);
          b.y = WORLD.h + A.rand(10, 200);
        }
      }
      for (const s of this.schools) {
        s.x += s.dir * s.speed * dt;
        if (s.x > WORLD.w + 180) s.x = -180;
        if (s.x < -180) s.x = WORLD.w + 180;
      }
      if (this.snowMotes) {
        for (let i = 0; i < this.snowMotes.length; i++) {
          const m = this.snowMotes[i];
          m.y += m.speedY * dt;
          m.x += Math.sin(time * 0.8 + m.phase) * m.driftX * dt;
          if (m.y > WORLD.h) m.y = 200;
          if (m.x > WORLD.w) m.x = 0;
          if (m.x < 0) m.x = WORLD.w;
        }
      }

      if (this.bioMotes) {
        for (let i = 0; i < this.bioMotes.length; i++) {
          const m = this.bioMotes[i];
          m.y += m.speedY * dt;
          m.x += Math.sin(time * 0.5 + m.phase) * m.driftX * dt;
          if (m.y < 200) m.y = WORLD.h - 60;
          if (m.x > WORLD.w) m.x = 0;
          if (m.x < 0) m.x = WORLD.w;
        }
      }

      // Vent plumes only tick while a vent is close enough to be seen.
      const sm = this.ventSmoke;
      for (let i = sm.length - 1; i >= 0; i--) {
        const p = sm[i];
        p.life -= dt;
        if (p.life <= 0) { sm.splice(i, 1); continue; }
        p.y -= p.vy * dt;
        p.x += Math.sin(p.life * 1.8 + p.phase) * 14 * dt;
        p.r += p.grow * dt;
      }
      if (cam && this.vents.length) {
        const near2 = 1500 * 1500;
        for (let i = 0; i < this.vents.length; i++) {
          const v = this.vents[i];
          if (A.dist2(v.x, v.y, cam.x, cam.y) > near2) continue;
          const chimneys = v.chimneys;
          for (let k = 0; k < chimneys.length; k++) {
            const ch = chimneys[k];
            if (!ch.hot) continue;
            if (Math.random() < dt * 7) this.emitSmoke(v.x + ch.dx, v.y - ch.h);
          }
        }
      }
    }

    drawSky(ctx, w, h, cam, time, lowDetail, surfScreenY) {
      if (surfScreenY <= 0) return;
      const skyH = Math.min(h, surfScreenY + 16);

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, skyH);
      ctx.clip();

      // Atmospheric Sky Gradient from deep zenith azure down to warm solar
      // horizon. Bucketed and cached: rebuilding it every frame was three
      // gradient allocations per frame for a value that only moves with zoom.
      const skyBucket = Math.max(8, Math.round(surfScreenY / 6) * 6);
      if (this._skyKey !== skyBucket + '|' + h) {
        this._skyKey = skyBucket + '|' + h;
        const sky = ctx.createLinearGradient(0, 0, 0, skyBucket);
        sky.addColorStop(0, '#037bb6');    // Deep zenith azure
        sky.addColorStop(0.38, '#26aee8'); // Luminous tropical sky
        sky.addColorStop(0.72, '#7ee0fa'); // Coastal cyan
        sky.addColorStop(0.92, '#cbf6ff'); // Horizon mist
        sky.addColorStop(1, '#fff5d8');    // Warm golden solar horizon glow
        this._skyGrad = sky;

        const haze = ctx.createLinearGradient(0, skyBucket - 30, 0, skyBucket);
        haze.addColorStop(0, 'rgba(255, 250, 235, 0)');
        haze.addColorStop(1, 'rgba(255, 250, 235, 0.45)');
        this._hazeGrad = haze;
      }
      ctx.fillStyle = this._skyGrad;
      ctx.fillRect(0, 0, w, skyH);

      // Distant Hazy Island / Mountain Ridge on the horizon
      ctx.fillStyle = 'rgba(64, 142, 178, 0.28)';
      ctx.beginPath();
      ctx.moveTo(0, surfScreenY);
      const ridgeW = 600;
      for (let x = 0; x <= w + 40; x += 30) {
        const ry = surfScreenY - 14 -
          Math.sin((x / ridgeW) * TAU + 0.5) * 8 -
          Math.sin((x / ridgeW) * TAU * 3 + 1.2) * 4;
        ctx.lineTo(x, ry);
      }
      ctx.lineTo(w, surfScreenY);
      ctx.closePath();
      ctx.fill();

      // Horizon atmospheric haze
      ctx.fillStyle = this._hazeGrad;
      ctx.fillRect(0, surfScreenY - 30, w, 30);

      // The Sun & Atmospheric Bloom
      const sunX = w * 0.73 - (cam.x - WORLD.w * 0.5) * 0.02;
      const sunY = surfScreenY * 0.36 + Math.sin(time * 0.12) * 2;

      // Outer corona glow
      const coronaSize = Math.max(180, surfScreenY * 1.5);
      ctx.drawImage(SUN_SPRITE, sunX - coronaSize / 2, sunY - coronaSize / 2, coronaSize, coronaSize);

      // White-hot solar core
      ctx.fillStyle = '#fffde6';
      ctx.beginPath();
      ctx.arc(sunX, sunY, 22, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sunX - 3, sunY - 4, 13, 0, TAU);
      ctx.fill();

      // Drifting Volumetric Clouds
      const cloudCount = lowDetail ? 2 : this.clouds.length;
      for (let i = 0; i < cloudCount; i++) {
        const cl = this.clouds[i];
        const span = w + 360;
        const cx = ((cl.u * w - cam.x * 0.035 + time * (2.2 + cl.u * 3)) % span + span) % span - 180;
        const cy = cl.y * (surfScreenY / 180);
        const sprite = CLOUD_SPRITES[cl.sprite];
        const scale = cl.scale * Math.min(1.2, Math.max(0.65, surfScreenY / 150));
        ctx.globalAlpha = 0.92;
        ctx.drawImage(sprite, cx - (sprite.width * scale) / 2, cy, sprite.width * scale, sprite.height * scale);
      }

      // Soaring Seabirds (Gulls) in the sky
      if (!lowDetail && this.seabirds) {
        ctx.fillStyle = 'rgba(25, 60, 80, 0.65)';
        for (let b = 0; b < this.seabirds.length; b++) {
          const bird = this.seabirds[b];
          const span = w + 200;
          const bx = ((bird.x * w + time * (16 * bird.speed) - cam.x * 0.02) % span + span) % span - 100;
          const by = surfScreenY * (0.2 + bird.y * 0.5) + Math.sin(time * 0.8 + bird.phase) * 6;
          const flap = Math.sin(time * (4 * bird.speed) + bird.phase);
          const wingSpan = 14 * bird.scale;
          const wingY = flap * 4.5 * bird.scale;

          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.quadraticCurveTo(bx - wingSpan * 0.5, by - wingY - 2, bx - wingSpan, by - wingY);
          ctx.quadraticCurveTo(bx - wingSpan * 0.5, by - wingY + 1, bx, by + 1.5);
          ctx.quadraticCurveTo(bx + wingSpan * 0.5, by - wingY + 1, bx + wingSpan, by - wingY);
          ctx.quadraticCurveTo(bx + wingSpan * 0.5, by - wingY - 2, bx, by);
          ctx.closePath();
          ctx.fill();
        }
      }

      ctx.restore();
    }

    drawSurface(ctx, w, h, cam, time, lowDetail, surfScreenY) {
      if (surfScreenY < -50 || surfScreenY > h + 50) return;

      const waveY = function (x) {
        return surfScreenY +
          Math.sin(x * 0.0072 + time * 1.35 + cam.x * 0.0035) * 5.6 +
          Math.sin(x * 0.0185 - time * 1.75 + 1.25) * 3.1 +
          Math.sin(x * 0.046 + time * 2.35 + 2.6) * 1.3;
      };

      // 1. Water surface body slice (from wave line down to ~56px below)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, waveY(0));
      for (let x = 8; x <= w; x += 8) ctx.lineTo(x, waveY(x));
      ctx.lineTo(w, surfScreenY + 65);
      ctx.lineTo(0, surfScreenY + 65);
      ctx.closePath();
      const surfBucket = Math.round(surfScreenY / 6) * 6;
      if (this._surfKey !== surfBucket) {
        this._surfKey = surfBucket;
        const surfGrad = ctx.createLinearGradient(0, surfBucket - 8, 0, surfBucket + 65);
        surfGrad.addColorStop(0, 'rgba(215, 252, 255, 0.95)');
        surfGrad.addColorStop(0.25, 'rgba(90, 230, 255, 0.65)');
        surfGrad.addColorStop(0.65, 'rgba(10, 165, 225, 0.28)');
        surfGrad.addColorStop(1, 'rgba(4, 120, 180, 0)');
        this._surfGrad = surfGrad;
      }
      ctx.fillStyle = this._surfGrad;
      ctx.fill();

      // 2. Wave crest specular shimmer
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(0, waveY(0) + 0.8);
      for (let x = 8; x <= w; x += 8) ctx.lineTo(x, waveY(x) + 0.8);
      ctx.stroke();

      // Secondary luminous meniscus line
      ctx.strokeStyle = 'rgba(175, 246, 255, 0.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, waveY(0) + 4.5);
      for (let x = 8; x <= w; x += 8) ctx.lineTo(x, waveY(x) + 4.5);
      ctx.stroke();

      // 3. Solar Glint (Sun Glitter Path on water surface)
      const sunX = w * 0.73 - (cam.x - WORLD.w * 0.5) * 0.02;
      const glintCount = lowDetail ? 10 : 22;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < glintCount; i++) {
        const spread = (i - glintCount / 2) * (w * 0.016);
        const gx = sunX + spread + Math.sin(time * 3 + i * 1.7) * 12;
        if (gx < 0 || gx > w) continue;
        const gy = waveY(gx) + Math.sin(time * 4 + i * 2.3) * 2.2 + 1.2;
        const bright = Math.exp(-Math.pow((gx - sunX) / (w * 0.16), 2));
        if (bright > 0.05) {
          ctx.globalAlpha = bright * (0.4 + Math.sin(time * 5 + i * 1.5) * 0.35);
          ctx.beginPath();
          ctx.ellipse(gx, gy, 3.5 + bright * 4.5, 1.2 + bright * 0.8, 0, 0, TAU);
          ctx.fill();
        }
      }

      // 4. Sea foam & froth bubbles along wave crests
      if (!lowDetail) {
        for (let i = 0; i < 16; i++) {
          const fx = ((i * 187 + time * 32 + cam.x * 0.18) % (w + 100)) - 50;
          const fy = waveY(fx) + 3.5 + (i % 3) * 2;
          ctx.globalAlpha = 0.35 + (i % 4) * 0.14;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.ellipse(fx, fy, 2.5 + (i % 3), 1.2, 0, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    drawDistantReef(ctx, w, h, cam, lowDetail) {
      const vis = A.clamp((cam.y - 640) / 620, 0, 1) *
        A.clamp(1 - (cam.y / WORLD.h - 0.72) / 0.2, 0, 1);
      if (vis <= 0.02) return;
      const layers = lowDetail ? 1 : 2;
      for (let l = 0; l < layers; l++) {
        const band = REEF_BANDS[l];
        const scale = l === 0 ? 0.8 : 0.95;
        const bw = band.width * scale;
        const bh = band.height * scale;
        const baseY = h * (0.81 + l * 0.08) + 24;
        let off = -((cam.x * (0.12 + l * 0.09)) % bw);
        if (off > 0) off -= bw;
        ctx.globalAlpha = (l === 0 ? 0.42 : 0.55) * vis;
        for (let x = off; x < w; x += bw) {
          ctx.drawImage(band, x, baseY - bh, bw, bh);
        }
      }
      ctx.globalAlpha = 1;
    }

    // World y of the sand surface at x — the ground anything rests on.
    floorY(x) {
      return floorAt(x);
    }

    drawSeabed(ctx, view) {
      const sprite = this.seabed;
      const top = FLOOR_Y - SEABED_EDGE - SEABED_HEAD;
      if (top > view.y + view.h || top + sprite.height < view.y) return;
      // Where the sand itself begins: the strip above it is the headroom the
      // baked kelp and coral grow into.
      const y = top + SEABED_HEAD;

      ctx.save();
      const x0 = Math.floor(view.x / sprite.width) * sprite.width;
      for (let x = x0; x < view.x + view.w; x += sprite.width) {
        ctx.drawImage(sprite, x, top);
      }

      // Sunlit sand only exists where sunlight reaches. Down here the same
      // band is basalt, lit only by the vents and the glowing colonies.
      const x1 = view.x + view.w + sprite.width;
      const washH = sprite.height - SEABED_HEAD + 60;
      ctx.beginPath();
      ctx.rect(view.x - sprite.width, y, x1 - view.x + sprite.width, washH);
      ctx.clip();
      ctx.globalAlpha = 0.44;
      ctx.fillStyle = '#0a1620';
      ctx.fillRect(view.x - sprite.width, y, x1 - view.x + sprite.width, washH);
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#16303f';
      ctx.fillRect(view.x - sprite.width, y, x1 - view.x + sprite.width, 26);
      ctx.restore();
    }

    drawRays(ctx, w, h, cam, time, lowDetail, surfScreenY, depthT) {
      // Rays fade out as depth increases (deep twilight and midnight abyss receive no sunlight)
      const rayAlpha = A.clamp((1 - depthT * 1.35), 0, 1);
      if (rayAlpha <= 0.02) return;

      const topClip = Math.max(0, surfScreenY);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, topClip, w, h - topClip);
      ctx.clip();

      ctx.globalCompositeOperation = 'screen';
      const count = lowDetail ? 3 : 5;
      const slots = [0.14, 0.32, 0.52, 0.72, 0.88];
      const sunX = w * 0.73;

      for (let i = 0; i < count; i++) {
        // Rays emanate naturally from solar quadrant
        const slotX = w * slots[i];
        const sway = -0.16 + Math.sin(time * 0.11 + i * 1.5) * 0.035 + (slotX - sunX) * 0.00012;
        const rx = slotX + Math.sin(time * 0.07 + i * 1.8) * 35 - (cam.x - WORLD.w * 0.5) * 0.012;
        const ry = surfScreenY - 100;
        const rayW = 320 + i * 50;
        const rayH = h * 1.6 + 180;

        ctx.save();
        ctx.translate(rx, ry);
        ctx.rotate(sway);
        ctx.globalAlpha = rayAlpha * (0.28 + i * 0.04);
        ctx.drawImage(RAY_SPRITE, -rayW / 2, 0, rayW, rayH);
        ctx.restore();
      }
      ctx.restore();
    }

    // Something enormous, far away, and never close enough to count. Below
    // roughly half depth the shapes start crossing the frame.
    drawLeviathans(ctx, w, h, cam, zoom, time, lowDetail, depthT, surfScreenY) {
      const reveal = A.clamp((depthT - 0.10) / 0.22, 0, 1);
      if (reveal < 0.02) return;
      // In mid water a distant body is a dark hole in a bright sea; deep down
      // there is no light left to block, so the same animal becomes a faint
      // mass of water still catching something.
      const light = depthT > 0.55;
      const set = light ? LEVI_LIGHT : LEVI_DARK;
      const span = w + 520;
      ctx.save();
      if (light) ctx.globalCompositeOperation = 'screen';
      const n = lowDetail ? 2 : this.leviathans.length;
      for (let i = 0; i < n; i++) {
        const lv = this.leviathans[i];
        const raw = lv.u * span + time * lv.speed * lv.dir - cam.x * 0.04;
        const x = ((raw % span) + span) % span - 260;
        // Each shape owns a depth band and wanders inside it, so there is
        // always something enormous somewhere in frame.
        const y = lv.band * h + Math.sin(time * 0.09 + lv.phase + cam.y * 0.0007) * h * 0.26;
        if (y < surfScreenY - 60) continue;
        const bw = 380 * lv.size * A.clamp(zoom, 0.6, 1.5);
        const bh = bw * (set[0].height / set[0].width);
        ctx.save();
        ctx.translate(x, y);
        if (lv.dir < 0) ctx.scale(-1, 1);
        // A long, slow roll, so the shape is never a flat cut-out.
        ctx.rotate(Math.sin(time * 0.13 + lv.phase) * 0.06);
        ctx.globalAlpha = lv.alpha * reveal * (0.82 + Math.sin(time * 0.5 + lv.phase) * 0.18);
        ctx.drawImage(set[lv.kind % set.length], -bw / 2, -bh / 2, bw, bh);
        ctx.restore();
      }
      ctx.restore();
    }

    // Bioluminescent drift. The field is centred on the camera, so it reads as
    // living water that lights up around you and blows outward as you speed up.
    drawBiolum(ctx, w, h, cam, time, lowDetail, depthT, surfScreenY, wake) {
      const reveal = A.clamp((depthT - 0.38) / 0.3, 0, 1);
      if (reveal < 0.02) return;
      const n = lowDetail ? 18 : this.bioMotes.length;
      const cx = w / 2;
      const cy = h / 2;
      const reach = w * 0.55;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < n; i++) {
        const m = this.bioMotes[i];
        let sx = ((m.x - cam.x * 0.62) % w + w) % w;
        let sy = ((m.y - cam.y * 0.62) % h + h) % h;
        if (sy < surfScreenY) continue;
        const dx = sx - cx;
        const dy = sy - cy;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const near = A.clamp(1 - d / reach, 0, 1);
        if (wake > 0.01) {
          const push = near * near * wake * 54;
          sx += (dx / d) * push;
          sy += (dy / d) * push;
        }
        const pulse = 0.5 + Math.sin(time * m.blink + m.phase) * 0.5;
        const a = reveal * (0.1 + near * near * (0.34 + wake * 0.85)) * (0.32 + pulse * 0.68);
        if (a < 0.012) continue;
        const s = m.r * (1.9 + near * 3.1 + wake * 1.4);
        ctx.globalAlpha = a > 0.62 ? 0.62 : a;
        ctx.drawImage(BIO_SPRITES[m.hue], sx - s, sy - s, s * 2, s * 2);
      }
      ctx.restore();
    }

    // The frame sinks into the deep: corners close in and the bottom of the
    // screen goes darker than the water actually is.
    drawDepthGrade(ctx, w, h, depthT) {
      const bucket = Math.round(depthT * 40) / 40;
      if (!this._grade || this._gradeW !== w || this._gradeH !== h || this._gradeT !== bucket) {
        const vg = ctx.createRadialGradient(w * 0.5, h * 0.46, Math.min(w, h) * 0.34, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
        vg.addColorStop(0, 'rgba(0,4,12,0)');
        vg.addColorStop(0.6, rgba('#020814', 0.1 + bucket * 0.16));
        vg.addColorStop(1, rgba('#010611', 0.26 + bucket * 0.34));
        const bg = ctx.createLinearGradient(0, h * 0.5, 0, h);
        bg.addColorStop(0, 'rgba(0,3,10,0)');
        bg.addColorStop(1, rgba('#000409', 0.12 + bucket * 0.26));
        this._grade = { vg: vg, bg: bg };
        this._gradeW = w;
        this._gradeH = h;
        this._gradeT = bucket;
      }
      ctx.save();
      ctx.fillStyle = this._grade.vg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = this._grade.bg;
      ctx.fillRect(0, h * 0.5, w, h * 0.5);
      ctx.restore();
    }

    drawBackground(ctx, w, h, cam, zoom, time, lowDetail) {
      const SURFACE_WORLD_Y = 220;
      const surfScreenY = (SURFACE_WORLD_Y - cam.y) * zoom + h / 2;
      const depthT = A.clamp((cam.y - 200) / (WORLD.h - 600), 0, 1);

      // How fast the camera is moving, which is how fast you are moving, which
      // is how hard the bioluminescence is getting stirred up.
      let wake = 0;
      if (this._bgCam !== undefined) {
        const dx = cam.x - this._bgCam.x;
        const dy = cam.y - this._bgCam.y;
        wake = Math.sqrt(dx * dx + dy * dy);
      }
      this._bgCam = { x: cam.x, y: cam.y };
      this._wake = (this._wake || 0) + (A.clamp(wake / 9, 0, 1) - (this._wake || 0)) * 0.16;
      wake = this._wake;

      // 1. Underwater depth background gradient (below surface)
      const underTop = Math.max(0, surfScreenY);
      const underH = h - underTop;

      if (underH > 0) {
        if (!this.bgGrad || this.bgW !== w || this.bgH !== h || Math.abs(depthT - this.bgT) > 0.008) {
          const grad = ctx.createLinearGradient(0, 0, 0, h);
          // Realistic oceanic depth science:
          // Shallows (0-0.25): brilliant tropical turquoise `#00a8ce` to azure `#016f9a`
          // Mid-depth (0.25-0.65): deep sapphire `#014d7a` to ocean cobalt `#012f56`
          // Midnight Abyss (0.65-1.0): dark oceanic trench `#011933` to midnight black `#000611`
          grad.addColorStop(0, mixHex('#00a8ce', '#011933', depthT));
          grad.addColorStop(0.32, mixHex('#0184b5', '#011228', depthT));
          grad.addColorStop(0.68, mixHex('#015987', '#000c1e', depthT));
          grad.addColorStop(1, mixHex('#013a63', '#000611', depthT));
          this.bgGrad = grad;
          this.bgW = w;
          this.bgH = h;
          this.bgT = depthT;
        }
        ctx.fillStyle = this.bgGrad;
        ctx.fillRect(0, underTop, w, underH);

        // Each depth band carries its own water colour, so swimming from the
        // shallows into the trench reads as a place change and not just a
        // darker version of the same screen.
        const zone = A.zoneAt(cam.y);
        if (zone !== this._zone) {
          this._zone = zone;
          this._zoneWash = rgba(zone.tint, 0.13);
        }
        ctx.fillStyle = this._zoneWash;
        ctx.fillRect(0, underTop, w, underH);

        // Biome atmosphere is background-only: it never changes collision,
        // food, creatures, XP, or the existing depth-zone boundaries.
        this.drawBiomeAtmosphere(ctx, w, h, cam, time, zone, underTop, underH, lowDetail);
      }

      // 2. Upward Surface Skylight / Snell's Window Glow (When submerged near the surface)
      if (surfScreenY < 0 && surfScreenY > -750) {
        const glowFactor = (1 - (-surfScreenY) / 750) * (1 - depthT);
        if (glowFactor > 0.02) {
          const sg = ctx.createLinearGradient(0, 0, 0, Math.min(h, 240));
          sg.addColorStop(0, 'rgba(165, 245, 255, ' + (0.35 * glowFactor).toFixed(3) + ')');
          sg.addColorStop(0.5, 'rgba(80, 205, 245, ' + (0.15 * glowFactor).toFixed(3) + ')');
          sg.addColorStop(1, 'rgba(10, 140, 200, 0)');
          ctx.fillStyle = sg;
          ctx.fillRect(0, 0, w, Math.min(h, 240));
        }
      }

      // 3. Dynamic Caustic Light Patterns (Interference web in upper water column)
      if (depthT < 0.72) {
        const causticAlpha = (1 - depthT / 0.72) * 0.13;
        ctx.save();
        if (surfScreenY > 0) {
          ctx.beginPath();
          ctx.rect(0, surfScreenY, w, h - surfScreenY);
          ctx.clip();
        }
        ctx.globalCompositeOperation = 'screen';
        const spots = lowDetail ? 2 : 4;
        for (let i = 0; i < spots; i++) {
          const size = 360 + i * 110;
          const sp = 16 + i * 7;
          const cx = ((i * 419 + time * sp - (cam.x * 0.02)) % (w + 800) + (w + 800)) % (w + 800) - 400;
          const cy = Math.max(surfScreenY, 0) + ((i * 247 + time * 8 + i * 63) % (h + 300)) - 150;
          ctx.globalAlpha = causticAlpha * (0.8 + (i % 3) * 0.15);
          ctx.drawImage(CAUSTIC_SPRITE, cx, cy, size, size);
        }
        ctx.restore();
      }

      // 4. Parallax Distant Reef
      this.drawDistantReef(ctx, w, h, cam, lowDetail);

      // 4b. Far larger things, too distant to be a threat yet
      this.drawLeviathans(ctx, w, h, cam, zoom, time, lowDetail, depthT, surfScreenY);

      // 5. Crepuscular Sunbeams (God Rays)
      this.drawRays(ctx, w, h, cam, time, lowDetail, surfScreenY, depthT);

      // 6. Marine Snow / Drift motes in water column
      if (this.snowMotes && this.snowMotes.length) {
        ctx.save();
        ctx.fillStyle = '#c5f7ff';
        for (let m = 0; m < this.snowMotes.length; m++) {
          const mote = this.snowMotes[m];
          // Screen projection of marine snow
          const sx = ((mote.x - cam.x * 0.4) % w + w) % w;
          const sy = ((mote.y - cam.y * 0.4) % h + h) % h;
          if (sy > surfScreenY) {
            ctx.globalAlpha = mote.alpha * (0.35 + Math.sin(time * 1.2 + mote.phase) * 0.2);
            ctx.beginPath();
            ctx.arc(sx, sy, mote.r, 0, TAU);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      // 6b. Bioluminescent field, lit by your own wake
      this.drawBiolum(ctx, w, h, cam, time, lowDetail, depthT, surfScreenY, wake);

      // 7. Sky (Above the ocean surface)
      this.drawSky(ctx, w, h, cam, time, lowDetail, surfScreenY);

      // 8. Ocean Surface Line & Waves
      this.drawSurface(ctx, w, h, cam, time, lowDetail, surfScreenY);

      // 9. Depth grade and vignette, laid over the water but under everything
      // you can interact with, so the reef never dims an animal or a pickup.
      this.drawDepthGrade(ctx, w, h, depthT);
    }

    drawBiomeAtmosphere(ctx, w, h, cam, time, zone, underTop, underH, lowDetail) {
      if (!zone || underH <= 0) return;
      const count = lowDetail ? 5 : 9;
      const phase = (cam.x * 0.0007 + cam.y * 0.0003);

      ctx.save();

      if (zone.id === 'reef') {
        // Coral Kingdom: warm turquoise haze and distant coral silhouettes.
        ctx.fillStyle = 'rgba(28, 190, 177, 0.055)';
        ctx.fillRect(0, underTop, w, underH);
        const baseY = h - 12;
        for (let side = 0; side < 2; side++) {
          const x = side === 0 ? 0 : w;
          ctx.save();
          ctx.translate(x, baseY);
          ctx.scale(side === 0 ? 1 : -1, 1);
          ctx.globalAlpha = 0.22;
          ctx.fillStyle = '#087f83';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, -h * 0.16);
          ctx.quadraticCurveTo(18, -h * 0.22, 30, -h * 0.14);
          ctx.quadraticCurveTo(38, -h * 0.25, 52, -h * 0.2);
          ctx.lineTo(62, 0);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#42cbb0';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(18, -8);
          ctx.quadraticCurveTo(4, -h * 0.12, 22, -h * 0.17);
          ctx.moveTo(36, -8);
          ctx.quadraticCurveTo(58, -h * 0.12, 48, -h * 0.19);
          ctx.stroke();
          ctx.restore();
        }
      } else if (zone.id === 'trench') {
        // Frozen Abyss: cold blue cast and sparse drifting ice flecks.
        ctx.fillStyle = 'rgba(130, 205, 255, 0.075)';
        ctx.fillRect(0, underTop, w, underH);
        ctx.fillStyle = 'rgba(190, 232, 255, 0.12)';
        for (let i = 0; i < count; i++) {
          const x = ((i * 173 + cam.x * (0.08 + (i % 3) * 0.025)) % (w + 80) + w + 80) % (w + 80) - 40;
          const y = underTop + ((i * 97 + time * (5 + i % 4) + phase * 80) % Math.max(1, underH));
          const r = 2 + (i % 3) * 1.4;
          ctx.beginPath();
          ctx.moveTo(x, y - r * 1.8);
          ctx.lineTo(x + r, y);
          ctx.lineTo(x, y + r * 1.8);
          ctx.lineTo(x - r, y);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#b7eaff';
        ctx.beginPath();
        ctx.moveTo(0, underTop);
        ctx.lineTo(w * 0.12, underTop);
        ctx.lineTo(0, underTop + h * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(w, underTop);
        ctx.lineTo(w * 0.88, underTop);
        ctx.lineTo(w, underTop + h * 0.16);
        ctx.closePath();
        ctx.fill();
      } else if (zone.id === 'vents') {
        // Volcanic Trench: a restrained ember glow near the lower edge.
        ctx.fillStyle = 'rgba(111, 30, 25, 0.10)';
        ctx.fillRect(0, underTop, w, underH);
        const glow = ctx.createLinearGradient(0, h * 0.56, 0, h);
        glow.addColorStop(0, 'rgba(255, 95, 35, 0)');
        glow.addColorStop(1, 'rgba(255, 75, 24, 0.16)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, h * 0.56, w, h * 0.44);
        ctx.fillStyle = 'rgba(255, 165, 90, 0.22)';
        for (let i = 0; i < (lowDetail ? 3 : 6); i++) {
          const x = ((i * 211 + cam.x * 0.11) % (w + 50) + w + 50) % (w + 50) - 25;
          const y = h - ((i * 71 + time * (8 + i % 3) + phase * 30) % Math.max(1, h * 0.42));
          ctx.globalAlpha = 0.12 + (0.08 * (0.5 + 0.5 * Math.sin(time * 1.4 + i)));
          ctx.beginPath();
          ctx.arc(x, y, 2 + (i % 3), 0, TAU);
          ctx.fill();
        }
      } else if (zone.id === 'abyss') {
        // Bioluminescent Gardens: deep indigo water with distant glowing flora.
        ctx.fillStyle = 'rgba(67, 48, 145, 0.075)';
        ctx.fillRect(0, underTop, w, underH);
        const plantCount = lowDetail ? 3 : 6;
        for (let i = 0; i < plantCount; i++) {
          const side = i % 2;
          const x = side ? w - 24 - (i * 31) : 24 + (i * 31);
          const height = h * (0.16 + (i % 3) * 0.045);
          const sway = Math.sin(time * 0.45 + i * 1.7 + phase) * 12;
          ctx.globalAlpha = 0.15 + (0.04 * Math.sin(time + i));
          ctx.strokeStyle = i % 2 ? '#7b8cff' : '#55e6d1';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x, h);
          ctx.quadraticCurveTo(x + sway, h - height * 0.5, x - sway * 0.4, h - height);
          ctx.stroke();
          ctx.fillStyle = i % 2 ? '#9b8cff' : '#65f2d8';
          ctx.beginPath();
          ctx.arc(x - sway * 0.4, h - height, 4 + (i % 3), 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#8bdfff';
        for (let i = 0; i < count; i++) {
          const x = ((i * 149 + cam.x * 0.045) % (w + 30) + w + 30) % (w + 30) - 15;
          const y = underTop + ((i * 113 + time * (3 + i % 3) + phase * 40) % Math.max(1, underH));
          ctx.beginPath();
          ctx.arc(x, y, 1.5 + (i % 3), 0, TAU);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    drawStatic(ctx, view, time, lowDetail) {
      this.drawSeabed(ctx, view);

      for (const s of this.schools) {
        if (!visible(s.x, s.y, 90, view, 60)) continue;
        const bob = Math.sin(time * 0.7 + s.phase) * 6;
        ctx.save();
        ctx.translate(s.x, s.y + bob);
        ctx.scale(s.dir, 1);
        ctx.globalAlpha = 0.72;
        ctx.drawImage(s.sprite, -80 * s.scale, -45 * s.scale, 160 * s.scale, 90 * s.scale);
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      this.drawStacks(ctx, view, time, lowDetail);
      this.drawWrecks(ctx, view, lowDetail);
      this.drawVents(ctx, view, time, lowDetail);

      // All of the bed life now shares one strip of ground, so the deepest
      // view is far busier than it used to be. Low detail halves the crowd.
      for (let ri = 0; ri < this.rocks.length; ri++) {
        if (lowDetail && (ri & 1)) continue;
        const rc = this.rocks[ri];
        if (!visible(rc.x, rc.y, rc.cull, view, 60)) continue;
        ctx.save();
        ctx.translate(rc.x, rc.y);
        ctx.fillStyle = 'rgba(4, 48, 68, 0.08)';
        ctx.beginPath();
        ctx.ellipse(0, rc.cull * 0.2, rc.cull * 0.74, rc.cull * 0.2, 0, 0, TAU);
        ctx.fill();

        for (const rock of rc.rocks) {
          ctx.save();
          ctx.translate(rock.cx, rock.cy);
          smoothPoly(ctx, rock.pts);
          ctx.fillStyle = rock.color;
          ctx.fill();

          ctx.save();
          smoothPoly(ctx, rock.pts);
          ctx.clip();
          ctx.globalAlpha = 0.7;
          ctx.drawImage(ROCK_SHADE, -rock.rx, -rock.ry, rock.rx * 2, rock.ry * 2);
          ctx.globalAlpha = 1;
          ctx.globalAlpha = 0.42;
          ctx.drawImage(ROCK_LIGHT, -rock.rx * 0.9, -rock.ry * 1.25, rock.rx * 1.8, rock.ry * 1.7);
          ctx.globalAlpha = 0.16;
          ctx.fillStyle = '#063552';
          ctx.beginPath();
          ctx.ellipse(rock.rx * 0.32, rock.ry * 0.32, rock.rx * 0.52, rock.ry * 0.4, 0.35, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 0.12;
          ctx.fillStyle = '#d8fbff';
          ctx.beginPath();
          ctx.ellipse(-rock.rx * 0.36, -rock.ry * 0.22, rock.rx * 0.3, rock.ry * 0.2, -0.3, 0, TAU);
          ctx.fill();
          ctx.restore();

          smoothPoly(ctx, rock.pts);
          ctx.strokeStyle = 'rgba(6, 37, 51, 0.82)';
          ctx.lineWidth = 2.6;
          ctx.stroke();

          ctx.globalAlpha = 0.65;
          ctx.strokeStyle = 'rgba(220, 252, 255, 0.72)';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          let started = false;
          for (let i = 0; i < rock.pts.length; i++) {
            const p = rock.pts[i];
            if (p.y < -rock.ry * 0.1) {
              if (!started) { ctx.moveTo(p.x, p.y); started = true; }
              else ctx.lineTo(p.x, p.y);
            }
          }
          ctx.stroke();
          ctx.globalAlpha = 1;

          ctx.globalAlpha = 1;
          ctx.restore();
        }
        ctx.restore();
      }

      for (let wi = 0; wi < this.weeds.length; wi++) {
        if (lowDetail && (wi & 1)) continue;
        const w = this.weeds[wi];
        const lib = w.lib;
        const s = w.scale;
        if (!visible(w.x, w.y - lib.sh * s * 0.4, lib.cull * s, view, 50)) continue;
        const sway = Math.sin(time * 0.85 + w.phase) * (w.drift ? 0.05 : 0.028);
        ctx.save();
        ctx.translate(w.x, w.y);
        // A raft hangs downward; a bed grows up out of the sand.
        if (w.drift) ctx.scale(1, -1);
        ctx.rotate(sway);
        ctx.globalAlpha = w.drift ? 0.8 : lightAt(w.y);
        ctx.drawImage(lib.sprite, -lib.baseX * s, -lib.baseY * s, lib.sw * s, lib.sh * s);
        ctx.restore();
      }

      for (let ci = 0; ci < this.corals.length; ci++) {
        if (lowDetail && (ci & 1)) continue;
        const c = this.corals[ci];
        const lib = c.lib;
        const s = c.scale;
        const cull = lib.cull * s;
        if (!visible(c.x, c.y - cull * 0.5, cull, view, 60)) continue;
        if (c.glow) {
          const gs = cull * 3.4;
          ctx.globalAlpha = 0.3 + Math.sin(time * 1.4 + c.phase) * 0.12;
          ctx.drawImage(glowSprite(lib.glowColor || '#7cf7c8'), c.x - gs / 2, c.y - gs * 0.42, gs, gs);
          ctx.globalAlpha = 1;
        }
        const sway = Math.sin(time * 0.6 + c.phase) * c.sway;
        ctx.save();
        ctx.globalAlpha = lightAt(c.y);
        ctx.translate(c.x, c.y);
        ctx.rotate(sway);
        ctx.drawImage(lib.sprite, -lib.sw / 2 * s, -lib.baseY * s, lib.sw * s, lib.sh * s);
        ctx.restore();
      }

      for (let di = 0; di < this.details.length; di++) {
        if (lowDetail && (di & 1)) continue;
        const d = this.details[di];
        if (!visible(d.x, d.y, d.r * 2, view, 20)) continue;
        const dim = lightAt(d.y);
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.rot);
        if (d.type === 0) {
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const ang = (i / 10) * TAU - Math.PI / 2;
            const rr = i % 2 === 0 ? d.r : d.r * 0.42;
            const px = Math.cos(ang) * rr;
            const py = Math.sin(ang) * rr;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fillStyle = d.color;
          ctx.globalAlpha = 0.9 * dim;
          ctx.fill();
          ctx.globalAlpha = 0.45 * dim;
          ctx.strokeStyle = d.dark;
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, d.r, Math.PI, 0);
          ctx.closePath();
          ctx.fillStyle = d.color;
          ctx.globalAlpha = 0.85 * dim;
          ctx.fill();
          ctx.globalAlpha = 0.5 * dim;
          ctx.strokeStyle = d.dark;
          ctx.lineWidth = 1.2;
          for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(i * d.r * 0.22, -d.r * 0.9);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      this.drawVentSmoke(ctx);

      const band = 240;
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.drawImage(EDGE_SPRITE, 0, 0, band, WORLD.h);
      ctx.save();
      ctx.translate(WORLD.w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(EDGE_SPRITE, 0, 0, band, WORLD.h);
      ctx.restore();
      ctx.save();
      ctx.translate(0, WORLD.h);
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(EDGE_SPRITE, 0, 0, band, WORLD.w);
      ctx.restore();
      ctx.restore();
    }

    drawStacks(ctx, view, time, lowDetail) {
      for (let i = 0; i < this.stacks.length; i++) {
        const s = this.stacks[i];
        if (!visibleBox(s.x - s.width, s.baseY - s.height, s.x + s.width, s.baseY, view, 80)) continue;

        ctx.save();
        ctx.translate(s.x, s.baseY);

        ctx.beginPath();
        ctx.ellipse(0, 6, s.width * 0.9, s.width * 0.2, 0, 0, TAU);
        ctx.fillStyle = 'rgba(2, 26, 42, 0.3)';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(s.left[0].x, s.left[0].y);
        for (let k = 1; k < s.left.length; k++) ctx.lineTo(s.left[k].x, s.left[k].y);
        for (let k = s.right.length - 1; k >= 0; k--) ctx.lineTo(s.right[k].x, s.right[k].y);
        ctx.closePath();
        ctx.fillStyle = s.shade || s.color;
        ctx.fill();

        // Sunlit shoulder on the left flank, cold shadow on the right
        ctx.save();
        ctx.clip();
        ctx.globalAlpha = 0.3 * (s.lit === undefined ? 1 : s.lit);
        ctx.fillStyle = '#9ff0ff';
        ctx.beginPath();
        ctx.moveTo(s.left[0].x, 0);
        for (let k = 1; k < s.left.length; k++) ctx.lineTo(s.left[k].x, s.left[k].y);
        for (let k = 0; k < s.left.length; k++) {
          ctx.lineTo(s.left[k].x + s.width * 0.24, s.left[k].y + 40);
        }
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.42;
        ctx.fillStyle = '#01121e';
        ctx.fillRect(s.width * 0.06, -s.height, s.width, s.height);
        ctx.globalAlpha = 1;
        ctx.restore();

        ctx.strokeStyle = 'rgba(5, 34, 48, 0.85)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Shelves carry coral gardens, so they read as ledges at a distance
        for (let k = 0; k < s.shelves.length; k++) {
          const sh = s.shelves[k];
          ctx.beginPath();
          ctx.ellipse(sh.x, sh.y, sh.w * 0.5, sh.w * 0.16, 0, 0, TAU);
          ctx.fillStyle = s.shelfColor || mixHex(s.color, '#a8ecff', 0.22);
          ctx.fill();
          ctx.strokeStyle = 'rgba(5, 34, 48, 0.7)';
          ctx.lineWidth = 2;
          ctx.stroke();
          if (!lowDetail) {
            ctx.fillStyle = 'rgba(255, 143, 182, 0.5)';
            for (let d = 0; d < 3; d++) {
              ctx.beginPath();
              ctx.arc(sh.x + (d - 1) * sh.w * 0.22, sh.y - sh.w * 0.16, 2.6, 0, TAU);
              ctx.fill();
            }
          }
        }
        ctx.restore();
      }
    }

    drawWrecks(ctx, view, lowDetail) {
      for (let i = 0; i < this.wrecks.length; i++) {
        const wr = this.wrecks[i];
        const sw = wr.sprite.width * wr.scale;
        const sh = wr.sprite.height * wr.scale;
        if (!visibleBox(wr.x - sw * 0.55, wr.y - sh, wr.x + sw * 0.55, wr.y, view, 60)) continue;
        ctx.save();
        ctx.translate(wr.x, wr.y);
        ctx.rotate(wr.tilt);
        ctx.scale(wr.flip ? -1 : 1, 1);
        ctx.drawImage(wr.sprite, -sw / 2, -sh * 0.88, sw, sh);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    drawVents(ctx, view, time, lowDetail) {
      for (let i = 0; i < this.vents.length; i++) {
        const v = this.vents[i];
        if (!visible(v.x, v.y - v.size * 0.6, v.reach + v.size, view, 60)) continue;

        // Warm light pooled on the sand: the field owns its own patch of floor,
        // and down here nothing else lights it.
        const breathe = 0.5 + Math.sin(time * 0.9 + v.phase) * 0.14;
        const pool = v.reach * 2.1;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = breathe * 0.3;
        ctx.drawImage(glowSprite('#ff9a4a'), v.x - pool / 2, v.y - pool * 0.3, pool, pool * 0.6);
        ctx.restore();
        ctx.globalCompositeOperation = 'source-over';

        for (let k = 0; k < v.mounds.length; k++) {
          const m = v.mounds[k];
          ctx.save();
          ctx.translate(v.x + m.dx, v.y + m.dy);
          smoothPoly(ctx, m.pts);
          ctx.fillStyle = m.color;
          ctx.fill();

          if (!lowDetail) {
            ctx.save();
            smoothPoly(ctx, m.pts);
            ctx.clip();
            ctx.globalAlpha = 0.6;
            ctx.drawImage(ROCK_SHADE, -m.rx, -m.ry, m.rx * 2, m.ry * 2);
            ctx.globalAlpha = 0.28;
            ctx.drawImage(ROCK_LIGHT, -m.rx * 0.9, -m.ry * 1.6, m.rx * 1.8, m.ry * 2.6);
            ctx.restore();
          }

          smoothPoly(ctx, m.pts);
          ctx.strokeStyle = 'rgba(3, 18, 26, 0.85)';
          ctx.lineWidth = 2.2;
          ctx.stroke();
          ctx.restore();
        }

        for (let k = 0; k < v.chimneys.length; k++) {
          const ch = v.chimneys[k];
          const bx = v.x + ch.dx;
          const topY = v.y - ch.h;
          const hw = ch.w * 0.5;

          ctx.save();
          ctx.translate(bx, v.y);
          ctx.rotate(ch.tilt);

          ctx.fillStyle = '#20303c';
          ctx.beginPath();
          ctx.ellipse(0, -1, hw * 2.3, hw * 0.82, 0, 0, TAU);
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(-hw * 1.9, 0);
          ctx.lineTo(-hw, -ch.h);
          ctx.lineTo(hw, -ch.h);
          ctx.lineTo(hw * 1.9, 0);
          ctx.closePath();
          ctx.fillStyle = '#1b2830';
          ctx.fill();
          ctx.strokeStyle = 'rgba(3, 18, 26, 0.9)';
          ctx.lineWidth = 2.2;
          ctx.stroke();
          ctx.globalAlpha = 0.35;
          ctx.strokeStyle = '#8fd8ee';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-hw * 1.7, -2);
          ctx.lineTo(-hw * 0.9, -ch.h + 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.restore();

          if (ch.hot) {
            const pulse = 0.55 + Math.sin(time * 2.2 + v.phase + k) * 0.2;
            const gs = ch.w * 3.8;
            ctx.globalAlpha = pulse * 0.5;
            ctx.drawImage(glowSprite('#ff9a4a'), bx - gs / 2, topY - gs / 2, gs, gs);
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#ffd08a';
            ctx.beginPath();
            ctx.ellipse(bx, topY, hw * 0.88, hw * 0.32, 0, 0, TAU);
            ctx.fill();
          }
        }
      }
    }

    drawVentSmoke(ctx) {
      const sm = this.ventSmoke;
      if (!sm.length) return;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = '#cfe9f2';
      for (let i = 0; i < sm.length; i++) {
        const p = sm[i];
        const t = p.life / p.maxLife;
        ctx.globalAlpha = t * 0.15;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    drawBubbles(ctx, view) {
      ctx.save();
      for (const b of this.bubbles) {
        if (!visible(b.x, b.y, b.r * 2, view, 20)) continue;
        const size = b.r * 4.6;
        ctx.globalAlpha = b.alpha;
        ctx.drawImage(BUBBLE_SPRITE, b.x - size / 2, b.y - size / 2, size, size);
      }
      ctx.restore();
    }
  }

  A.OceanWorld = OceanWorld;
})();
