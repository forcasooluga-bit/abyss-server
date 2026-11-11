/* ABYSS.IO — weapons.
   Equipment art is painted the same way the animals are: normalised units
   inside a scale(radius, radius) transform, flat palette fills, one dark
   outline pass, and glow reserved for the enchanted bits. That keeps a trident
   held by a minnow and a trident held by a megalodon the same drawing, and it
   costs no image decode on a low-end PC. */
(function () {
  'use strict';

  const A = window.ABYSS;
  const TAU = A.TAU;

  // ------------------------------------------------------------------
  // The Ancient Trident
  // ------------------------------------------------------------------
  // A shaft runs along +x from the butt at -1.10 up to the guard at +0.54, and
  // three blades leave the guard, the centre one for +1.54. The centre blade is
  // both longer and wider than its siblings; that asymmetry is what makes a
  // trident read as a trident instead of a pitchfork or a fan. The finish is
  // forged bronze rather than steel, with the same teal enchantment running
  // through it as the rest of the reef's magic.
  const TRIDENT = {
    key: 'ancient_trident',
    name: 'Ancient Trident',
    butt: -1.10,
    reach: 1.54,
    // Where the jaws close on the rod, in weapon-local units. Just behind the
    // guard, so the blades stand clear of the face and the rod lies along the
    // head rather than sticking out of the animal's back.
    grip: 0.14,
    palette: {
      steel: '#b08346',
      steelDark: '#5d3f1c',
      tine: '#c49a52',
      tineTop: '#f2d99a',
      sheen: '#fff6d8',
      bronze: '#e6bd6a',
      bronzeDark: '#7a541f',
      accent: '#5ff0d8',
      glow: '#4fe0d0',
      outline: '#180f05'
    }
  };

  // Cosmetic finishes for the same forged shape. A skin swaps the palette and
  // adds its own inlay pass; it never changes the tines, the reach or the grip,
  // so a skin cannot quietly become a better weapon.
  const SKINS = {
    skin_tidewrought: {
      name: 'Tidewrought Poseidon',
      palette: {
        steel: '#1b2a33',
        steelDark: '#050a0e',
        tine: '#2a3c46',
        tineTop: '#6f939b',
        sheen: '#e8feff',
        bronze: '#e9c86a',
        bronzeDark: '#8a6a1e',
        accent: '#4ff2d8',
        glow: '#2fe0c0',
        outline: '#000000'
      }
    }
  };

  function outlinePass(ctx, p, width, alpha) {
    ctx.globalAlpha = alpha == null ? 0.7 : alpha;
    ctx.strokeStyle = p.outline;
    ctx.lineWidth = width || 0.05;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // The centre blade: a long leaf that swells just past the guard and then
  // draws itself out to a needle point. Two facets meet on a raised ridge, so
  // the blade catches light along its length instead of reading as a flat gold
  // lozenge.
  function centreBlade(ctx, p, cheap) {
    ctx.beginPath();
    ctx.moveTo(0.54, -0.062);
    ctx.quadraticCurveTo(0.80, -0.108, 1.06, -0.082);
    ctx.quadraticCurveTo(1.32, -0.050, TRIDENT.reach, 0);
    ctx.quadraticCurveTo(1.32, 0.050, 1.06, 0.082);
    ctx.quadraticCurveTo(0.80, 0.108, 0.54, 0.062);
    ctx.quadraticCurveTo(0.46, 0, 0.54, -0.062);
    ctx.closePath();
    ctx.fillStyle = p.tine;
    ctx.fill();
    outlinePass(ctx, p, 0.028, 0.85);

    if (cheap) return;

    // Raised ridge.
    ctx.beginPath();
    ctx.moveTo(0.58, -0.004);
    ctx.quadraticCurveTo(1.06, -0.014, 1.47, 0);
    ctx.strokeStyle = p.sheen;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 0.014;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Shadowed lower facet, so the blade has a front and a back.
    ctx.beginPath();
    ctx.moveTo(0.62, 0.044);
    ctx.quadraticCurveTo(1.04, 0.050, 1.34, 0.020);
    ctx.strokeStyle = p.bronzeDark;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 0.020;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Enchantment runs the cutting edge, quietly.
    ctx.beginPath();
    ctx.moveTo(0.60, -0.058);
    ctx.quadraticCurveTo(1.02, -0.078, 1.42, -0.014);
    ctx.strokeStyle = p.glow;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 0.016;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // An outer blade hooks away from the guard, widens into a leaf, then curls
  // back to its point. The barb near the shoulder is the film-prop cue: it
  // makes the blade look like something forged for hunting rather than drawn.
  function outerBlade(ctx, s, p, cheap) {
    ctx.save();
    ctx.scale(1, s);
    ctx.beginPath();
    ctx.moveTo(0.56, 0.116);
    ctx.quadraticCurveTo(0.68, 0.244, 0.94, 0.276);
    ctx.quadraticCurveTo(1.12, 0.296, 1.30, 0.302);
    ctx.quadraticCurveTo(1.40, 0.304, 1.47, 0.286);
    ctx.quadraticCurveTo(1.34, 0.262, 1.16, 0.232);
    ctx.quadraticCurveTo(0.92, 0.196, 0.74, 0.140);
    ctx.quadraticCurveTo(0.62, 0.100, 0.56, 0.072);
    ctx.quadraticCurveTo(0.51, 0.094, 0.56, 0.116);
    ctx.closePath();
    ctx.fillStyle = p.tine;
    ctx.fill();
    outlinePass(ctx, p, 0.026, 0.85);

    // Barb.
    ctx.beginPath();
    ctx.moveTo(1.12, 0.290);
    ctx.quadraticCurveTo(1.19, 0.352, 1.06, 0.372);
    ctx.quadraticCurveTo(1.06, 0.330, 0.98, 0.292);
    ctx.closePath();
    ctx.fillStyle = p.bronze;
    ctx.fill();
    outlinePass(ctx, p, 0.022, 0.75);

    if (!cheap) {
      // Lit spine down the blade.
      ctx.beginPath();
      ctx.moveTo(0.62, 0.150);
      ctx.quadraticCurveTo(0.96, 0.226, 1.38, 0.272);
      ctx.strokeStyle = p.tineTop;
      ctx.globalAlpha = 0.72;
      ctx.lineWidth = 0.020;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Shadow along the cutting edge.
      ctx.beginPath();
      ctx.moveTo(0.60, 0.098);
      ctx.quadraticCurveTo(0.90, 0.190, 1.38, 0.268);
      ctx.strokeStyle = p.bronzeDark;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 0.016;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // The crossguard: a pair of swept wings that carry the outer blades, two
  // flukes hooking back toward the grip, and a diamond boss with the jewel.
  function crossguard(ctx, p, pulse, cheap) {
    for (let s = -1; s <= 1; s += 2) {
      // Rear fluke.
      ctx.save();
      ctx.scale(1, s);
      ctx.beginPath();
      ctx.moveTo(0.345, 0.056);
      ctx.quadraticCurveTo(0.245, 0.118, 0.268, 0.180);
      ctx.quadraticCurveTo(0.305, 0.150, 0.326, 0.118);
      ctx.quadraticCurveTo(0.348, 0.086, 0.370, 0.060);
      ctx.closePath();
      ctx.fillStyle = p.bronzeDark;
      ctx.fill();
      outlinePass(ctx, p, 0.020, 0.7);

      // Wing.
      ctx.beginPath();
      ctx.moveTo(0.335, 0.058);
      ctx.quadraticCurveTo(0.375, 0.185, 0.500, 0.196);
      ctx.quadraticCurveTo(0.585, 0.196, 0.602, 0.126);
      ctx.quadraticCurveTo(0.565, 0.108, 0.520, 0.078);
      ctx.quadraticCurveTo(0.440, 0.042, 0.335, 0.058);
      ctx.closePath();
      ctx.fillStyle = p.bronze;
      ctx.fill();
      outlinePass(ctx, p, 0.024, 0.8);

      if (!cheap) {
        ctx.beginPath();
        ctx.moveTo(0.385, 0.086);
        ctx.quadraticCurveTo(0.440, 0.160, 0.545, 0.165);
        ctx.strokeStyle = p.sheen;
        ctx.globalAlpha = 0.42;
        ctx.lineWidth = 0.014;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    // Boss.
    ctx.beginPath();
    ctx.moveTo(0.455, -0.086);
    ctx.quadraticCurveTo(0.548, -0.056, 0.566, 0);
    ctx.quadraticCurveTo(0.548, 0.056, 0.455, 0.086);
    ctx.quadraticCurveTo(0.362, 0.056, 0.344, 0);
    ctx.quadraticCurveTo(0.362, -0.056, 0.455, -0.086);
    ctx.closePath();
    ctx.fillStyle = p.bronze;
    ctx.fill();
    outlinePass(ctx, p, 0.026, 0.85);

    if (!cheap) {
      ctx.beginPath();
      ctx.moveTo(0.410, -0.052);
      ctx.quadraticCurveTo(0.470, -0.066, 0.512, -0.030);
      ctx.strokeStyle = p.sheen;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 0.014;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // The jewel sits in the boss and breathes with the enchantment.
    const gem = 0.034 + 0.006 * pulse;
    ctx.beginPath();
    ctx.arc(0.455, 0, gem, 0, TAU);
    ctx.fillStyle = p.glow;
    ctx.fill();
    if (!cheap) {
      ctx.beginPath();
      ctx.arc(0.455, -gem * 0.18, gem * 0.40, 0, TAU);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.5 + 0.3 * pulse;
      ctx.fill();
      ctx.globalAlpha = 0.22 + 0.12 * pulse;
      ctx.beginPath();
      ctx.arc(0.455, 0, gem * 2.3, 0, TAU);
      ctx.fillStyle = p.accent;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function tridentPainter(ctx, f, time, cheap) {
    const p = f.colors || TRIDENT.palette;
    const pulse = 0.55 + 0.45 * Math.sin((time || 0) * 2.1 + (f.pulse || 0));
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // 1. Butt spike, behind the rod.
    ctx.beginPath();
    ctx.moveTo(-1.055, -0.044);
    ctx.lineTo(-1.215, -0.016);
    ctx.lineTo(-1.275, 0);
    ctx.lineTo(-1.215, 0.016);
    ctx.lineTo(-1.055, 0.044);
    ctx.closePath();
    ctx.fillStyle = p.bronzeDark;
    ctx.fill();
    outlinePass(ctx, p, 0.026, 0.8);

    // 2. The rod, tapering gently toward the head.
    ctx.beginPath();
    ctx.moveTo(-1.045, -0.058);
    ctx.quadraticCurveTo(-0.30, -0.050, 0.52, -0.044);
    ctx.lineTo(0.52, 0.044);
    ctx.quadraticCurveTo(-0.30, 0.050, -1.045, 0.058);
    ctx.closePath();
    ctx.fillStyle = p.steelDark;
    ctx.fill();
    outlinePass(ctx, p, 0.032, 0.8);

    // Counter-shade: the upper half catches the light, so the rod reads round.
    if (!cheap) {
      ctx.save();
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(-1.06, -0.12);
      ctx.lineTo(0.56, -0.10);
      ctx.lineTo(0.56, -0.010);
      ctx.lineTo(-1.06, -0.020);
      ctx.closePath();
      const sg = ctx.createLinearGradient(0, -0.06, 0, -0.008);
      sg.addColorStop(0, p.steel);
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.globalAlpha = 0.9;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Engraved wave running the length of the rod.
      ctx.beginPath();
      for (let x = -0.86; x <= 0.04; x += 0.02) {
        const y = Math.sin((x + 0.86) * 24) * 0.016;
        if (x === -0.86) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = p.bronzeDark;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 0.013;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();

      // Hairline highlight on the top edge.
      ctx.beginPath();
      ctx.moveTo(-1.02, -0.050);
      ctx.quadraticCurveTo(-0.30, -0.043, 0.50, -0.037);
      ctx.strokeStyle = p.sheen;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 0.011;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 3. Forged collars down the rod.
    const bands = [
      { x: -0.90, hw: 0.074, w: 0.050 },
      { x: -0.58, hw: 0.070, w: 0.044 },
      { x: -0.26, hw: 0.066, w: 0.044 },
      { x: 0.10, hw: 0.070, w: 0.058 }
    ];
    for (let i = 0; i < bands.length; i++) {
      const b = bands[i];
      ctx.beginPath();
      ctx.moveTo(b.x - b.w / 2, -b.hw);
      ctx.lineTo(b.x + b.w / 2, -b.hw * 0.94);
      ctx.lineTo(b.x + b.w / 2, b.hw * 0.94);
      ctx.lineTo(b.x - b.w / 2, b.hw);
      ctx.closePath();
      ctx.fillStyle = p.bronze;
      ctx.fill();
      outlinePass(ctx, p, 0.022, 0.65);
      if (!cheap) {
        ctx.beginPath();
        ctx.moveTo(b.x - b.w / 2 + 0.008, -b.hw * 0.55);
        ctx.lineTo(b.x + b.w / 2 - 0.008, -b.hw * 0.5);
        ctx.strokeStyle = p.sheen;
        ctx.globalAlpha = 0.42;
        ctx.lineWidth = 0.011;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // 4. Pommel ball and collar.
    ctx.beginPath();
    ctx.moveTo(-1.02, -0.068);
    ctx.lineTo(-0.975, -0.068);
    ctx.lineTo(-0.975, 0.068);
    ctx.lineTo(-1.02, 0.068);
    ctx.closePath();
    ctx.fillStyle = p.bronze;
    ctx.fill();
    outlinePass(ctx, p, 0.022, 0.65);

    ctx.beginPath();
    ctx.arc(-1.105, 0, 0.055, 0, TAU);
    ctx.fillStyle = p.bronze;
    ctx.fill();
    outlinePass(ctx, p, 0.024, 0.8);
    if (!cheap) {
      ctx.beginPath();
      ctx.arc(-1.118, -0.018, 0.020, 0, TAU);
      ctx.fillStyle = p.sheen;
      ctx.globalAlpha = 0.6;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 5. Blades behind the guard, then the guard on top of their roots.
    outerBlade(ctx, -1, p, cheap);
    outerBlade(ctx, 1, p, cheap);
    centreBlade(ctx, p, cheap);
    crossguard(ctx, p, pulse, cheap);

    // 6. Runes on the rod, lit by the same pulse as the jewel.
    if (!cheap) {
      const runes = [-0.74, -0.42, 0.22];
      ctx.globalAlpha = 0.30 + 0.42 * pulse;
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 0.024;
      for (let i = 0; i < runes.length; i++) {
        const rx = runes[i];
        ctx.beginPath();
        ctx.moveTo(rx - 0.044, -0.026);
        ctx.lineTo(rx + 0.014, 0.028);
        ctx.lineTo(rx + 0.054, -0.024);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // 6b. Skin work: god-gold filigree down the rod and a turquoise core set
    // in the yoke. The core breathes with the same pulse as the crown, so the
    // whole weapon lights up as one object.
    if (f.skin) {
      ctx.save();
      ctx.strokeStyle = p.bronze;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 0.018;
      ctx.beginPath();
      ctx.moveTo(-0.86, -0.034);
      ctx.quadraticCurveTo(-0.40, -0.008, 0.02, -0.022);
      ctx.quadraticCurveTo(0.22, -0.030, 0.30, -0.028);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-0.62, 0.040);
      ctx.quadraticCurveTo(-0.18, 0.052, 0.24, 0.040);
      ctx.stroke();
      ctx.globalAlpha = 1;

      const gem = 0.042 + 0.007 * pulse;
      ctx.beginPath();
      ctx.arc(0.455, 0, gem, 0, TAU);
      ctx.fillStyle = p.glow;
      ctx.fill();
      ctx.globalAlpha = 0.55 + 0.35 * pulse;
      ctx.beginPath();
      ctx.arc(0.455, -gem * 0.2, gem * 0.44, 0, TAU);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.globalAlpha = 0.26 + 0.14 * pulse;
      ctx.beginPath();
      ctx.arc(0.455, 0, gem * 2.4, 0, TAU);
      ctx.fillStyle = p.accent;
      ctx.fill();
      ctx.restore();
    }

    // 7. Enchantment: a soft crown behind the points and a hot core on the
    // centre tip. Kept low-alpha so the bronze stays the read.
    const gr = 0.32 + 0.05 * pulse;
    const g = ctx.createRadialGradient(1.34, 0, 0.02, 1.34, 0, gr);
    g.addColorStop(0, 'rgba(79,224,208,' + (0.13 + 0.07 * pulse).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(79,224,208,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(1.34, 0, gr, 0, TAU);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(1.44, -0.024);
    ctx.lineTo(TRIDENT.reach + 0.03, 0);
    ctx.lineTo(1.44, 0.024);
    ctx.closePath();
    ctx.fillStyle = p.accent;
    ctx.globalAlpha = 0.5 + 0.4 * pulse;
    ctx.fill();
    ctx.globalAlpha = 1;

    if (!cheap) {
      ctx.fillStyle = p.glow;
      ctx.globalAlpha = 0.32 + 0.22 * pulse;
      for (let s = -1; s <= 1; s += 2) {
        ctx.beginPath();
        ctx.arc(1.445, s * 0.286, 0.022, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------------
  // The Abyss Shuriken
  // ------------------------------------------------------------------
  // Grown once the animal evolves past the anglerfish — the angler itself has
  // none: a four-bladed star cut from the same abyssal steel as Poseidon, with
  // a lure-bright core. It is not a shop item, so it only ever appears in the
  // jaws of those forms and leaves the hand when SPACE is pressed.
  const SHURIKEN = {
    key: 'abyss_shuriken',
    name: 'Abyss Shuriken',
    grip: 0,
    preview: { x0: -0.27, x1: 0.27, y: 0.28 },
    palette: {
      steel: '#7adfd8',
      steelDark: '#1d5c65',
      edge: '#d8fff9',
      core: '#4ff2d8',
      glow: '#2fe0c0',
      outline: '#04161a'
    }
  };

  function shurikenPainter(ctx, o, time, cheap) {
    const p = o.colors || SHURIKEN.palette;
    const pulse = 0.5 + 0.5 * Math.sin((time || 0) * 3.4);

    // Four swept blades. Each one starts at the hub, swells, and tapers to a
    // needle, which is what keeps the silhouette reading as a star and not a
    // four-pointed cross.
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 2 + 0.12);
      ctx.beginPath();
      ctx.moveTo(0.035, -0.012);
      ctx.quadraticCurveTo(0.10, -0.075, 0.205, -0.055);
      ctx.quadraticCurveTo(0.185, -0.012, 0.215, 0.012);
      ctx.quadraticCurveTo(0.12, 0.050, 0.038, 0.016);
      ctx.closePath();
      ctx.fillStyle = p.steel;
      ctx.fill();
      outlinePass(ctx, p, 0.014, 0.85);

      if (!cheap) {
        ctx.beginPath();
        ctx.moveTo(0.055, -0.006);
        ctx.quadraticCurveTo(0.13, -0.030, 0.195, -0.038);
        ctx.strokeStyle = p.edge;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 0.009;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    // Hub: a dark ring with a lure-bright core.
    ctx.beginPath();
    ctx.arc(0, 0, 0.046, 0, TAU);
    ctx.fillStyle = p.steelDark;
    ctx.fill();
    outlinePass(ctx, p, 0.014, 0.9);
    ctx.beginPath();
    ctx.arc(0, 0, 0.024 + 0.004 * pulse, 0, TAU);
    ctx.fillStyle = p.core;
    ctx.fill();

    if (!cheap) {
      const g = ctx.createRadialGradient(0, 0, 0.01, 0, 0, 0.13);
      g.addColorStop(0, 'rgba(79,242,216,0.5)');
      g.addColorStop(1, 'rgba(79,242,216,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 0.13, 0, TAU);
      ctx.fill();
    }
  }

  // ------------------------------------------------------------------
  // Where a creature holds it
  // ------------------------------------------------------------------
  // Anchors are the same normalised body units as MOUTHS in fish.js, which is
  // what lets one drawing fit a 13px minnow and a 156px megalodon. The grip
  // point lands on the jaw line. The scale is what sells the grip: a trident
  // the size of a toothpick next to a megalodon looks stuck on, while one as
  // long as the front half of the body looks carried.
  const HOLD = {
    default: { x: 1.06, y: 0.24, rot: -0.06, scale: 0.80 },
    blue: { x: 0.98, y: 0.12, rot: -0.04, scale: 0.62 },
    coral: { x: 0.92, y: 0.16, rot: 0.02, scale: 0.64 },
    fast: { x: 1.12, y: 0.08, rot: -0.04, scale: 0.64 },
    hunter: { x: 1.00, y: 0.10, rot: -0.10, scale: 0.68 },
    angler: { x: 0.66, y: 0.44, rot: -0.18, scale: 0.80 },
    shark: { x: 1.18, y: 0.28, rot: -0.09, scale: 0.86 },
    manta: { x: 0.95, y: 0.32, rot: -0.04, scale: 0.80 },
    octopus: { x: 0.82, y: 0.44, rot: 0.06, scale: 0.78 },
    sawshark: { x: 1.24, y: 0.22, rot: -0.03, scale: 0.86 },
    orca: { x: 1.72, y: 0.34, rot: -0.11, scale: 0.96 },
    megalodon: { x: 1.52, y: 0.34, rot: -0.09, scale: 1.06 }
  };

  function holdFor(art) {
    return HOLD[art] || HOLD.default;
  }

  // The exact transform FishArt.draw applies before it calls a painter, so a
  // prop attached here lands on the animal instead of drifting off it when the
  // creature turns and the canvas flips to keep it upright.
  function bodyTransform(ctx, f) {
    ctx.translate(f.x, f.y);
    ctx.rotate(f.angle);
    if (Math.cos(f.angle) < 0) ctx.scale(1, -1);
    ctx.scale(f.radius, f.radius);
  }

  function keyOf(weapon) {
    return typeof weapon === 'string' ? weapon
      : (weapon && weapon.key) || TRIDENT.key;
  }

  // The world position of the grip point, for anything that has to leave the
  // mouth and come back to it. It replays bodyTransform in arithmetic, so it
  // agrees with drawHeld to the pixel without touching a canvas.
  function mouthPoint(f) {
    const h = holdFor(f.art);
    const flip = Math.cos(f.angle) < 0 ? -1 : 1;
    const c = Math.cos(f.angle), s = Math.sin(f.angle);
    const lx = h.x * f.radius, ly = h.y * flip * f.radius;
    return { x: f.x + lx * c - ly * s, y: f.y + lx * s + ly * c };
  }

  // The weapon goes on top of the animal: the rod crossing the head is what
  // sells the grip, and behind the head it simply disappears.
  function drawHeld(ctx, f, time, cheap) {
    const key = keyOf(f.weapon);
    const paint = registry[key] || tridentPainter;
    const def = WEAPONS[key] || TRIDENT;
    const skin = SKINS[f.weaponSkin] ? f.weaponSkin : null;
    const colors = skin ? SKINS[skin].palette : def.palette;
    const h = holdFor(f.art);
    // A biting jaw dips the weapon with it; a swimming body rolls it a degree.
    const bite = A.clamp(f.bite || 0, 0, 1);
    const bob = Math.sin((f.phase || 0) * 0.9) * 0.016;
    ctx.save();
    bodyTransform(ctx, f);
    ctx.translate(h.x, h.y + bite * 0.05);
    ctx.rotate(h.rot + bob - bite * 0.08);
    ctx.scale(h.scale, h.scale);
    // The star is a compact prop in the same units as the spear, so it needs
    // its own multiplier to keep the same visual weight in the jaws.
    if (key === SHURIKEN.key) ctx.scale(2.1, 2.1);
    ctx.translate(-def.grip, 0);
    paint(ctx, { colors: colors, pulse: f.pulse, skin: skin }, time, cheap);
    ctx.restore();
  }

  // ------------------------------------------------------------------
  // Registry & previews
  // ------------------------------------------------------------------
  const WEAPONS = {};
  WEAPONS[TRIDENT.key] = TRIDENT;
  WEAPONS[SHURIKEN.key] = SHURIKEN;

  const registry = {};
  registry[TRIDENT.key] = tridentPainter;
  registry[SHURIKEN.key] = shurikenPainter;

  // The weapon's box in local units, so a preview can fit it exactly.
  const BOX = { x0: TRIDENT.butt - 0.19, x1: TRIDENT.reach + 0.06, y: 0.42 };

  function drawPreview(canvas, key) {
    const w = canvas.width, h = canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const g = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w * 0.46);
    g.addColorStop(0, 'rgba(79,224,208,0.16)');
    g.addColorStop(0.6, 'rgba(60,150,190,0.06)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    paintFlat(ctx, key, w, h, performance.now() / 1000, -0.17);
  }

  // Shared by the shop preview and the card art: fit the box to the canvas,
  // tilt it so it does not read as a flat icon, and draw it.
  function paintFlat(ctx, key, w, h, time, tilt, skin) {
    const paint = registry[key] || tridentPainter;
    const def = WEAPONS[key] || TRIDENT;
    const sk = SKINS[skin] ? skin : null;
    // A def may bring its own bounding box; the shuriken is a compact star,
    // so fitting it into the trident's long box would shrink it to a dot.
    const box = def.preview || BOX;
    const span = box.x1 - box.x0;
    const s = Math.min(w / (span + 0.10), h / (box.y * 2.05));
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(tilt == null ? -0.17 : tilt);
    ctx.scale(s, s);
    ctx.translate(-(box.x0 + span / 2), 0);
    paint(ctx, { colors: sk ? SKINS[sk].palette : def.palette, pulse: 0.4, skin: sk }, time, false);
    ctx.restore();
  }

  A.Weapons = {
    TRIDENT: TRIDENT,
    HOLD: HOLD,
    BOX: BOX,
    keyOf: keyOf,
    list: function () { return [TRIDENT]; },
    get: function (key) { return WEAPONS[key] || null; },
    painter: function (key) { return registry[key] || null; },
    holdFor: holdFor,
    bodyTransform: bodyTransform,
    mouthPoint: mouthPoint,
    drawHeld: drawHeld,
    paintFlat: paintFlat,
    drawPreview: drawPreview
  };
})();
