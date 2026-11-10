(function () {
  'use strict';

  const A = window.ABYSS;
  const TAU = A.TAU;
  const WORLD = A.WORLD;
  const SURFACE_H = 132;

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
  // Sandy seabed backdrop (drawn in screen space)
  // ------------------------------------------------------------------
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

  function makeSeabedSprite(seed) {
    const W = 2000;
    const H = 380;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const rng = A.seedRand(seed);
    const topAt = function (x) {
      return 62 +
        Math.sin((x / W) * TAU + 0.6) * 20 +
        Math.sin((x / W) * TAU * 3 + 2.1) * 9 +
        Math.sin((x / W) * TAU * 6 + 4.2) * 4;
    };
    const path = function () {
      g.beginPath();
      g.moveTo(0, topAt(0));
      for (let x = 10; x <= W; x += 10) g.lineTo(x, topAt(x));
      g.lineTo(W, H + 12);
      g.lineTo(0, H + 12);
      g.closePath();
    };

    path();
    const sand = g.createLinearGradient(0, 44, 0, H);
    sand.addColorStop(0, '#ffefbe');
    sand.addColorStop(0.28, '#f6e0ab');
    sand.addColorStop(0.66, '#e7ca91');
    sand.addColorStop(1, '#cfae77');
    g.fillStyle = sand;
    g.fill();

    g.save();
    path();
    g.clip();

    for (let i = 0; i < 14; i++) {
      const x = 80 + rng() * (W - 160);
      const y = topAt(x) + 26 + rng() * 200;
      const r = 60 + rng() * 140;
      const gr = g.createRadialGradient(x, y, 2, x, y, r);
      const light = rng() < 0.55;
      gr.addColorStop(0, light ? 'rgba(255, 250, 214, 0.2)' : 'rgba(140, 112, 68, 0.14)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    for (let i = 0; i < 320; i++) {
      const x = rng() * W;
      const y = topAt(x) + 4 + rng() * (H - topAt(x) - 6);
      const light = rng() < 0.58;
      g.fillStyle = light ? 'rgba(255, 249, 219, 0.4)' : 'rgba(150, 122, 78, 0.28)';
      g.beginPath();
      g.ellipse(x, y, 0.7 + rng() * 1.5, 0.6 + rng() * 1.1, 0, 0, TAU);
      g.fill();
    }

    for (let i = 0; i < 34; i++) {
      const x = 40 + rng() * (W - 80);
      const y = topAt(x) + 14 + rng() * 240;
      const rx = 3 + rng() * 7;
      g.fillStyle = rng() < 0.5 ? 'rgba(171, 150, 112, 0.85)' : 'rgba(137, 121, 92, 0.8)';
      g.beginPath();
      g.ellipse(x, y, rx, rx * 0.62, rng() * TAU, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(255, 246, 214, 0.4)';
      g.beginPath();
      g.ellipse(x - rx * 0.2, y - rx * 0.22, rx * 0.5, rx * 0.26, 0, 0, TAU);
      g.fill();
    }

    for (let i = 0; i < 9; i++) {
      const x = 120 + rng() * (W - 240);
      const y = topAt(x) + 40 + rng() * 170;
      const r = 50 + rng() * 80;
      const gr = g.createRadialGradient(x, y, 4, x, y, r);
      gr.addColorStop(0, 'rgba(205, 255, 250, 0.24)');
      gr.addColorStop(1, 'rgba(205, 255, 250, 0)');
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.restore();

    g.strokeStyle = 'rgba(255, 250, 220, 0.9)';
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
        g.globalAlpha = 0.92;
        g.fill();
        g.globalAlpha = 0.4;
        g.strokeStyle = '#0b4a36';
        g.lineWidth = 1;
        g.stroke();
        g.globalAlpha = 1;
        g.restore();
      }
    }

    // Small coral tufts on the edge
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

  function makeCoralSprite(coral) {
    const w = Math.ceil(coral.size * 3.4) + 20;
    const h = Math.ceil(coral.size * 3.4) + 20;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.translate(w / 2, h * 0.86);
    paintCoral(g, coral);
    coral.sprite = c;
    coral.sw = w;
    coral.sh = h;
    coral.baseY = h * 0.86;
    coral.cull = coral.size * 1.8;
  }

  // ------------------------------------------------------------------
  // Seaweed sprite painting
  // ------------------------------------------------------------------
  function makeWeedSprite(cluster) {
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

    cluster.sprite = c;
    cluster.sw = w;
    cluster.sh = h;
    cluster.baseX = baseX;
    cluster.baseY = baseY;
    cluster.cull = Math.max(w, h) * 0.55;
  }

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
      this.seabed = makeSeabedSprite((seed ^ 0x5f3a1) >>> 0);
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

      // Rocks and all anchored decorations (corals, weeds) only appear near the seabed.
      // WORLD.h is the full world height; the bottom 30% is the seabed zone.
      const seabedTop = WORLD.h * 0.70;

      for (let i = 0; i < 52; i++) {
        const size = 30 + rng() * 66;
        const cx = 160 + rng() * (WORLD.w - 320);
        // Cluster rocks in the lower 30% of the world (seabed zone)
        const cy = seabedTop + rng() * (WORLD.h - seabedTop - 120);
        this.rocks.push(this.makeRockCluster(rng, cx, cy, size));
      }

      // Border rocks only along the bottom edge (not the sides mid-water)
      const borderSpace = 340;
      for (let x = 120; x < WORLD.w - 80; x += borderSpace) {
        this.rocks.push(this.makeRockCluster(rng, x + (rng() - 0.5) * 120, WORLD.h - 80 - rng() * 130, 80 + rng() * 70));
      }
      // Side border rocks only in the bottom half of the world sides
      for (let y = WORLD.h * 0.55; y < WORLD.h - 200; y += borderSpace) {
        this.rocks.push(this.makeRockCluster(rng, 80 + rng() * 130, y + (rng() - 0.5) * 120, 80 + rng() * 70));
        this.rocks.push(this.makeRockCluster(rng, WORLD.w - 80 - rng() * 130, y + (rng() - 0.5) * 120, 80 + rng() * 70));
      }

      this.anchors = this.rocks.slice();

      const anchorAt = () => this.anchors[(rng() * this.anchors.length) | 0];

      for (let i = 0; i < 96; i++) {
        const type = (rng() * 4) | 0;
        const size = 24 + rng() * 40;
        const a = anchorAt();
        const x = A.clamp(a.x + (rng() - 0.5) * a.cull * 1.7, 190, WORLD.w - 190);
        const y = A.clamp(a.y + a.cull * (0.12 + rng() * 0.34), seabedTop + 40, WORLD.h - 80);
        const pal = tintPalette(CORAL_PALETTES[(rng() * CORAL_PALETTES.length) | 0], rng);
        const coral = {
          x: x, y: y, type: type, size: size,
          pal: pal,
          phase: rng() * TAU,
          sway: 0.012 + rng() * 0.02
        };
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
        makeCoralSprite(coral);
        this.corals.push(coral);
      }

      for (let i = 0; i < 76; i++) {
        const size = 16 + rng() * 26;
        const a = anchorAt();
        const cluster = {
          x: A.clamp(a.x + (rng() - 0.5) * a.cull * 1.8, 180, WORLD.w - 180),
          y: A.clamp(a.y + a.cull * (0.1 + rng() * 0.32), seabedTop + 30, WORLD.h - 80),
          phase: rng() * TAU,
          blades: []
        };
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
        makeWeedSprite(cluster);
        this.weeds.push(cluster);
      }

      for (let i = 0; i < 44; i++) {
        const a = anchorAt();
        const pal = CORAL_PALETTES[(rng() * CORAL_PALETTES.length) | 0];
        this.details.push({
          x: A.clamp(a.x + (rng() - 0.5) * a.cull * 1.9, 170, WORLD.w - 170),
          y: A.clamp(a.y + a.cull * (0.2 + rng() * 0.4), seabedTop + 20, WORLD.h - 60),
          type: rng() < 0.55 ? 0 : 1,
          r: 6 + rng() * 7,
          rot: rng() * TAU,
          color: rng() < 0.5 ? pal.body : pal.accent,
          dark: pal.dark
        });
      }

      for (let i = 0; i < 7; i++) {
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
    }

    makeRockCluster(rng, x, y, size) {
      const rocks = [];
      const count = 2 + ((rng() * 3) | 0);
      for (let i = 0; i < count; i++) {
        const rx = size * (0.42 + rng() * 0.56);
        const ry = rx * (0.52 + rng() * 0.34);
        rocks.push({
          cx: (rng() - 0.5) * size * 1.0,
          cy: (rng() - 0.5) * size * 0.34,
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
      for (let i = 0; i < 96; i++) {
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

    update(dt, time) {
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
    }

    drawSky(ctx, w, h, cam, time, lowDetail, surfScreenY) {
      if (surfScreenY <= 0) return;
      const skyH = Math.min(h, surfScreenY + 16);

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, skyH);
      ctx.clip();

      // Atmospheric Sky Gradient from deep zenith azure down to warm solar horizon
      const sky = ctx.createLinearGradient(0, 0, 0, surfScreenY);
      sky.addColorStop(0, '#037bb6');    // Deep zenith azure
      sky.addColorStop(0.38, '#26aee8'); // Luminous tropical sky
      sky.addColorStop(0.72, '#7ee0fa'); // Coastal cyan
      sky.addColorStop(0.92, '#cbf6ff'); // Horizon mist
      sky.addColorStop(1, '#fff5d8');    // Warm golden solar horizon glow
      ctx.fillStyle = sky;
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
      const haze = ctx.createLinearGradient(0, surfScreenY - 30, 0, surfScreenY);
      haze.addColorStop(0, 'rgba(255, 250, 235, 0)');
      haze.addColorStop(1, 'rgba(255, 250, 235, 0.45)');
      ctx.fillStyle = haze;
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
      const surfGrad = ctx.createLinearGradient(0, surfScreenY - 8, 0, surfScreenY + 65);
      surfGrad.addColorStop(0, 'rgba(215, 252, 255, 0.95)');
      surfGrad.addColorStop(0.25, 'rgba(90, 230, 255, 0.65)');
      surfGrad.addColorStop(0.65, 'rgba(10, 165, 225, 0.28)');
      surfGrad.addColorStop(1, 'rgba(4, 120, 180, 0)');
      ctx.fillStyle = surfGrad;
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
      const vis = A.clamp((cam.y - 640) / 620, 0, 1);
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

    drawSeabed(ctx, w, h, cam, time, lowDetail) {
      const d = A.clamp((cam.y - WORLD.h * 0.55) / (WORLD.h * 0.36), 0, 1);
      if (d <= 0.02) return;
      const H = this.seabed.height;
      const y = h - H + (1 - d) * H * 0.85 + 14;
      ctx.save();
      ctx.globalAlpha = A.clamp(d * 1.8, 0, 1);
      let off = -((cam.x * 0.55) % this.seabed.width);
      if (off > 0) off -= this.seabed.width;
      for (let x = off; x < w; x += this.seabed.width) {
        ctx.drawImage(this.seabed, x, y);
      }
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

    drawBackground(ctx, w, h, cam, zoom, time, lowDetail) {
      const SURFACE_WORLD_Y = 220;
      const surfScreenY = (SURFACE_WORLD_Y - cam.y) * zoom + h / 2;
      const depthT = A.clamp((cam.y - 200) / (WORLD.h - 600), 0, 1);

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

      // 4. Parallax Distant Reef & Seabed
      this.drawDistantReef(ctx, w, h, cam, lowDetail);
      this.drawSeabed(ctx, w, h, cam, time, lowDetail);

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

      // 7. Sky (Above the ocean surface)
      this.drawSky(ctx, w, h, cam, time, lowDetail, surfScreenY);

      // 8. Ocean Surface Line & Waves
      this.drawSurface(ctx, w, h, cam, time, lowDetail, surfScreenY);
    }

    drawStatic(ctx, view, time, lowDetail) {
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

      for (const rc of this.rocks) {
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

      for (const cluster of this.weeds) {
        if (!visible(cluster.x, cluster.y - cluster.sh * 0.4, cluster.cull, view, 50)) continue;
        const sway = Math.sin(time * 0.85 + cluster.phase) * 0.028;
        ctx.save();
        ctx.translate(cluster.x, cluster.y);
        ctx.rotate(sway);
        ctx.drawImage(cluster.sprite, -cluster.baseX, -cluster.baseY);
        ctx.restore();
      }

      for (const c of this.corals) {
        if (!visible(c.x, c.y - c.size * 0.5, c.cull, view, 60)) continue;
        const sway = Math.sin(time * 0.6 + c.phase) * c.sway;
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(sway);
        ctx.drawImage(c.sprite, -c.sw / 2, -c.baseY);
        ctx.restore();
      }

      for (const d of this.details) {
        if (!visible(d.x, d.y, d.r * 2, view, 20)) continue;
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
          ctx.globalAlpha = 0.9;
          ctx.fill();
          ctx.globalAlpha = 0.45;
          ctx.strokeStyle = d.dark;
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, d.r, Math.PI, 0);
          ctx.closePath();
          ctx.fillStyle = d.color;
          ctx.globalAlpha = 0.85;
          ctx.fill();
          ctx.globalAlpha = 0.5;
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
