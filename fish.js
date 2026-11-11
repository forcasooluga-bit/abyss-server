(function () {
  'use strict';

  const A = window.ABYSS;
  const TAU = A.TAU;

  function dot(ctx, x, y, r, color) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function softDot(ctx, x, y, r, color, alpha) {
    ctx.globalAlpha = alpha;
    dot(ctx, x, y, r, color);
    ctx.globalAlpha = 1;
  }

  function eye(ctx, x, y, r, colors, opts) {
    const o = opts || {};
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = o.sclera || '#f5feff';
    ctx.fill();
    if (o.outline !== false) {
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = colors.outline;
      ctx.lineWidth = 0.028;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (o.iris) {
      dot(ctx, x, y, r * 0.64, o.iris);
    }
    dot(ctx, x + r * 0.16, y + r * 0.03, r * (o.pupilScale || 0.48), o.pupil || '#071f2a');
    dot(ctx, x + r * 0.4, y - r * 0.34, r * 0.17, 'rgba(255,255,255,0.95)');
  }

  function finStroke(ctx, colors, width, alpha) {
    ctx.globalAlpha = alpha == null ? 0.5 : alpha;
    ctx.strokeStyle = colors.outline;
    ctx.lineWidth = width || 0.045;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Blend two #rrggbb colours; t = 0 keeps the first. For the animals whose
  // skin has to sit between two palette entries rather than on one.
  function mixTone(a, b, t) {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const k = A.clamp(t, 0, 1);
    return 'rgb(' +
      Math.round(((pa >> 16) & 255) * (1 - k) + ((pb >> 16) & 255) * k) + ',' +
      Math.round(((pa >> 8) & 255) * (1 - k) + ((pb >> 8) & 255) * k) + ',' +
      Math.round((pa & 255) * (1 - k) + (pb & 255) * k) + ')';
  }

  // ---------------------------------------------------------------------
  // 1. Tiny Blue Fish — round, friendly, oversized eye, coral tail fan.
  // ---------------------------------------------------------------------
  function drawBlue(ctx, f) {
    const c = f.colors;
    const swim = Math.min(1.2, f.swim || 0.4);
    const wig = Math.sin(f.phase) * (0.14 + 0.2 * swim);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Tail fan
    ctx.save();
    ctx.translate(-0.93, 0.02);
    ctx.rotate(wig * 0.9);
    ctx.beginPath();
    ctx.moveTo(0.04, 0);
    ctx.bezierCurveTo(-0.2, -0.18, -0.55, -0.62, -0.94, -0.56);
    ctx.bezierCurveTo(-0.72, -0.24, -0.7, -0.07, -0.78, 0);
    ctx.bezierCurveTo(-0.7, 0.07, -0.72, 0.24, -0.94, 0.56);
    ctx.bezierCurveTo(-0.55, 0.62, -0.2, 0.18, 0.04, 0);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.04, 0.45);
    ctx.restore();

    // Dorsal fin
    ctx.beginPath();
    ctx.moveTo(0.3, -0.58);
    ctx.quadraticCurveTo(-0.02, -1.08, -0.52, -0.58);
    ctx.quadraticCurveTo(-0.18, -0.7, 0.3, -0.58);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.04, 0.4);

    const body = function () {
      ctx.beginPath();
      ctx.moveTo(1.24, 0.02);
      ctx.bezierCurveTo(1.15, -0.52, 0.62, -0.8, 0.02, -0.82);
      ctx.bezierCurveTo(-0.55, -0.83, -0.95, -0.5, -1.0, -0.02);
      ctx.bezierCurveTo(-0.96, 0.45, -0.52, 0.76, 0.05, 0.8);
      ctx.bezierCurveTo(0.62, 0.84, 1.08, 0.52, 1.24, 0.02);
      ctx.closePath();
    };

    body();
    ctx.fillStyle = c.body;
    ctx.fill();

    ctx.save();
    body();
    ctx.clip();

    // Back shading
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = c.dark;
    ctx.beginPath();
    ctx.ellipse(0.0, -0.64, 1.08, 0.4, 0, 0, TAU);
    ctx.fill();

    // Cream belly
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = c.belly;
    ctx.beginPath();
    ctx.moveTo(-0.95, 0.34);
    ctx.bezierCurveTo(-0.3, 0.6, 0.5, 0.72, 1.12, 0.12);
    ctx.lineTo(1.2, 0.98);
    ctx.lineTo(-1.05, 0.98);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Freckles
    softDot(ctx, 0.12, -0.22, 0.075, c.accent, 0.75);
    softDot(ctx, 0.36, -0.06, 0.055, c.accent, 0.65);
    softDot(ctx, -0.18, -0.16, 0.05, c.accent, 0.6);
    softDot(ctx, -0.05, 0.28, 0.05, c.accent, 0.45);

    // Top highlight
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.11;
    ctx.beginPath();
    ctx.moveTo(0.82, -0.4);
    ctx.bezierCurveTo(0.42, -0.65, -0.16, -0.68, -0.62, -0.48);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();

    body();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.055;
    ctx.stroke();

    // Pectoral fin
    ctx.save();
    ctx.translate(0.34, 0.3);
    ctx.rotate(0.42 + Math.sin(f.phase * 1.35) * 0.3);
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.3, 0.13, 0, 0, TAU);
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.035, 0.4);
    ctx.restore();

    // Gill line
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.moveTo(0.46, -0.22);
    ctx.quadraticCurveTo(0.35, 0.02, 0.46, 0.24);
    ctx.stroke();
    ctx.globalAlpha = 1;

    eye(ctx, 0.66, -0.24, 0.21, c, { pupil: '#082531', pupilScale: 0.5 });

    // Smile
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.05;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(1.03, 0.17);
    ctx.quadraticCurveTo(1.14, 0.26, 1.22, 0.13);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------------
  // 2. Coral Fish — tall body, cream wavy stripes, scalloped fan tail.
  // ---------------------------------------------------------------------
  function drawCoral(ctx, f) {
    const c = f.colors;
    const swim = Math.min(1.2, f.swim || 0.4);
    const wig = Math.sin(f.phase) * (0.12 + 0.16 * swim);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Big scalloped tail
    ctx.save();
    ctx.translate(-0.86, 0.02);
    ctx.rotate(wig * 0.8);
    ctx.beginPath();
    ctx.moveTo(0.04, 0);
    ctx.bezierCurveTo(-0.25, -0.4, -0.55, -0.9, -1.06, -0.8);
    ctx.quadraticCurveTo(-0.86, -0.52, -0.9, -0.3);
    ctx.quadraticCurveTo(-1.06, -0.12, -1.0, 0);
    ctx.quadraticCurveTo(-1.06, 0.12, -0.9, 0.3);
    ctx.quadraticCurveTo(-0.86, 0.52, -1.06, 0.8);
    ctx.bezierCurveTo(-0.55, 0.9, -0.25, 0.4, 0.04, 0);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.045, 0.5);

    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.03;
    ctx.beginPath();
    ctx.moveTo(-0.08, 0);
    ctx.lineTo(-0.82, -0.52);
    ctx.moveTo(-0.08, 0);
    ctx.lineTo(-0.88, 0);
    ctx.moveTo(-0.08, 0);
    ctx.lineTo(-0.82, 0.52);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();

    // Scalloped dorsal frill
    ctx.beginPath();
    ctx.moveTo(0.52, -0.52);
    ctx.quadraticCurveTo(0.46, -1.0, 0.14, -1.0);
    ctx.quadraticCurveTo(0.06, -0.8, -0.12, -0.9);
    ctx.quadraticCurveTo(-0.3, -1.04, -0.52, -0.6);
    ctx.quadraticCurveTo(-0.22, -0.7, 0.06, -0.68);
    ctx.quadraticCurveTo(0.34, -0.64, 0.52, -0.52);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.04, 0.45);
    softDot(ctx, 0.12, -0.92, 0.055, c.accent, 0.9);
    softDot(ctx, -0.16, -0.9, 0.05, c.accent, 0.9);
    softDot(ctx, -0.42, -0.82, 0.045, c.accent, 0.8);

    const body = function () {
      ctx.beginPath();
      ctx.moveTo(1.16, 0.03);
      ctx.bezierCurveTo(1.06, -0.58, 0.58, -0.92, 0.02, -0.92);
      ctx.bezierCurveTo(-0.55, -0.92, -0.92, -0.5, -0.98, 0.0);
      ctx.bezierCurveTo(-0.92, 0.52, -0.52, 0.9, 0.02, 0.9);
      ctx.bezierCurveTo(0.6, 0.9, 1.06, 0.58, 1.16, 0.03);
      ctx.closePath();
    };

    body();
    ctx.fillStyle = c.body;
    ctx.fill();

    ctx.save();
    body();
    ctx.clip();

    // Back shading
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = c.dark;
    ctx.beginPath();
    ctx.ellipse(0.0, -0.72, 0.98, 0.4, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Wavy cream stripes
    const stripeXs = [0.56, 0.04, -0.48];
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = c.belly;
    for (let i = 0; i < stripeXs.length; i++) {
      const sx = stripeXs[i];
      ctx.beginPath();
      ctx.moveTo(sx + 0.15, -1.05);
      ctx.bezierCurveTo(sx - 0.06, -0.3, sx + 0.1, 0.3, sx + 0.12, 1.05);
      ctx.lineTo(sx - 0.13, 1.05);
      ctx.bezierCurveTo(sx - 0.2, 0.3, sx - 0.18, -0.3, sx - 0.15, -1.05);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Yellow freckles on the dark back
    softDot(ctx, 0.34, -0.6, 0.06, c.accent, 0.85);
    softDot(ctx, 0.62, -0.44, 0.045, c.accent, 0.75);
    softDot(ctx, -0.2, -0.56, 0.05, c.accent, 0.6);

    // Cream belly
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = c.belly;
    ctx.beginPath();
    ctx.ellipse(0.05, 0.62, 0.72, 0.24, -0.04, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Highlight
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = '#fff8e8';
    ctx.lineWidth = 0.09;
    ctx.beginPath();
    ctx.moveTo(0.72, -0.46);
    ctx.bezierCurveTo(0.4, -0.7, -0.1, -0.76, -0.5, -0.58);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.restore();

    body();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.055;
    ctx.stroke();

    // Rounded pectoral fins
    ctx.save();
    ctx.translate(0.2, 0.42);
    ctx.rotate(0.5 + Math.sin(f.phase * 1.2) * 0.26);
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.26, 0.12, 0, 0, TAU);
    ctx.fillStyle = c.accent;
    ctx.fill();
    finStroke(ctx, c, 0.035, 0.4);
    ctx.restore();

    ctx.save();
    ctx.translate(-0.14, 0.46);
    ctx.rotate(0.55 - Math.sin(f.phase * 1.2) * 0.24);
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.22, 0.1, 0, 0, TAU);
    ctx.fillStyle = c.accent;
    ctx.fill();
    finStroke(ctx, c, 0.035, 0.4);
    ctx.restore();

    // Lips
    ctx.beginPath();
    ctx.ellipse(1.1, 0.12, 0.1, 0.065, 0.2, 0, TAU);
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.03, 0.5);

    eye(ctx, 0.56, -0.26, 0.21, c, { iris: c.accent, pupil: '#26130b', pupilScale: 0.38 });

    // Gill
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.moveTo(0.24, -0.35);
    ctx.quadraticCurveTo(0.1, 0.0, 0.24, 0.32);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------------
  // 3. Fast Fish — sleek dart, long forked streamers, racing stripes.
  // ---------------------------------------------------------------------
  function drawFast(ctx, f) {
    const c = f.colors;
    const swim = Math.min(1.2, f.swim || 0.5);
    const wig = Math.sin(f.phase) * (0.2 + 0.24 * swim);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Forked streamer tail
    ctx.save();
    ctx.translate(-0.98, 0.02);
    ctx.rotate(wig * 1.1);
    ctx.beginPath();
    ctx.moveTo(0.06, 0.02);
    ctx.bezierCurveTo(-0.32, -0.14, -0.9, -0.56, -1.34, -0.3);
    ctx.bezierCurveTo(-0.98, -0.1, -0.52, 0.0, 0.02, 0);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.04, 0.5);

    ctx.beginPath();
    ctx.moveTo(0.06, 0.0);
    ctx.bezierCurveTo(-0.32, 0.16, -0.9, 0.58, -1.34, 0.32);
    ctx.bezierCurveTo(-0.98, 0.12, -0.52, 0.0, 0.02, 0);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.04, 0.5);

    ctx.globalAlpha = 0.45;
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.moveTo(0.0, 0.0);
    ctx.lineTo(-0.5, -0.06);
    ctx.lineTo(-0.52, 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // Swept-back dorsal
    ctx.beginPath();
    ctx.moveTo(0.24, -0.46);
    ctx.quadraticCurveTo(0.02, -0.94, -0.54, -0.7);
    ctx.quadraticCurveTo(-0.24, -0.56, 0.1, -0.42);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.04, 0.45);

    // Anal fin
    ctx.beginPath();
    ctx.moveTo(-0.1, 0.44);
    ctx.quadraticCurveTo(-0.4, 0.76, -0.66, 0.5);
    ctx.quadraticCurveTo(-0.42, 0.42, -0.16, 0.36);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.035, 0.4);

    const body = function () {
      ctx.beginPath();
      ctx.moveTo(1.42, 0.01);
      ctx.bezierCurveTo(1.2, -0.28, 0.85, -0.48, 0.28, -0.53);
      ctx.bezierCurveTo(-0.35, -0.58, -0.85, -0.3, -1.04, -0.02);
      ctx.bezierCurveTo(-0.88, 0.26, -0.4, 0.46, 0.22, 0.5);
      ctx.bezierCurveTo(0.82, 0.53, 1.24, 0.3, 1.42, 0.01);
      ctx.closePath();
    };

    body();
    ctx.fillStyle = c.body;
    ctx.fill();

    ctx.save();
    body();
    ctx.clip();

    // Dark back
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = c.dark;
    ctx.beginPath();
    ctx.ellipse(-0.05, -0.48, 1.12, 0.24, -0.02, 0, TAU);
    ctx.fill();

    // Light belly
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = c.belly;
    ctx.beginPath();
    ctx.moveTo(-1.05, 0.16);
    ctx.bezierCurveTo(-0.4, 0.42, 0.4, 0.5, 1.3, 0.06);
    ctx.lineTo(1.3, 0.7);
    ctx.lineTo(-1.05, 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Racing stripes
    ctx.strokeStyle = c.accent;
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 0.045;
    ctx.beginPath();
    ctx.moveTo(1.16, -0.12);
    ctx.bezierCurveTo(0.6, -0.24, -0.2, -0.16, -0.86, -0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(1.16, 0.02);
    ctx.bezierCurveTo(0.6, -0.04, -0.2, 0.06, -0.92, 0.12);
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = c.dark;
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.moveTo(1.05, 0.22);
    ctx.bezierCurveTo(0.5, 0.24, -0.1, 0.26, -0.7, 0.3);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Highlight
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.07;
    ctx.beginPath();
    ctx.moveTo(1.0, -0.28);
    ctx.bezierCurveTo(0.6, -0.42, 0.05, -0.42, -0.35, -0.34);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.restore();

    body();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.05;
    ctx.stroke();

    // Rear finlets
    ctx.fillStyle = c.accent;
    for (let i = 0; i < 3; i++) {
      const x = -0.46 - i * 0.18;
      ctx.beginPath();
      ctx.moveTo(x, -0.28);
      ctx.lineTo(x - 0.12, -0.44 - i * 0.02);
      ctx.lineTo(x - 0.1, -0.24);
      ctx.closePath();
      ctx.fill();
    }

    // Slim pectoral fin
    ctx.save();
    ctx.translate(0.36, 0.26);
    ctx.rotate(0.55 + Math.sin(f.phase * 1.5) * 0.34);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(0.3, 0.02, 0.4, 0.24);
    ctx.quadraticCurveTo(0.18, 0.1, 0, 0.08);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.03, 0.4);
    ctx.restore();

    // Eye + focused brow
    eye(ctx, 0.95, -0.14, 0.125, c, { pupil: '#07231f', pupilScale: 0.52 });
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.035;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(0.78, -0.3);
    ctx.lineTo(1.06, -0.22);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Mouth
    ctx.beginPath();
    ctx.moveTo(1.3, 0.03);
    ctx.quadraticCurveTo(1.38, 0.07, 1.39, 0.0);
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.045;
    ctx.stroke();

    // Gill
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.035;
    ctx.beginPath();
    ctx.moveTo(0.62, -0.26);
    ctx.quadraticCurveTo(0.54, -0.04, 0.62, 0.2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------------
  // 4. Hunter Fish — angular indigo ambusher, jagged fin, glowing eye.
  // ---------------------------------------------------------------------
  function drawHunter(ctx, f) {
    const c = f.colors;
    const swim = Math.min(1.2, f.swim || 0.5);
    const wig = Math.sin(f.phase) * (0.18 + 0.2 * swim);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Sharp forked tail
    ctx.save();
    ctx.translate(-0.98, 0.0);
    ctx.rotate(wig);
    ctx.beginPath();
    ctx.moveTo(0.04, 0.02);
    ctx.bezierCurveTo(-0.28, -0.16, -0.82, -0.72, -1.3, -0.46);
    ctx.bezierCurveTo(-0.94, -0.24, -0.58, -0.04, -0.18, 0.0);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.04, 0.5);

    ctx.beginPath();
    ctx.moveTo(0.04, 0.0);
    ctx.bezierCurveTo(-0.28, 0.18, -0.82, 0.72, -1.3, 0.46);
    ctx.bezierCurveTo(-0.94, 0.24, -0.58, 0.04, -0.18, 0.0);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.04, 0.5);

    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.03;
    ctx.beginPath();
    ctx.moveTo(-0.1, 0);
    ctx.lineTo(-1.0, -0.34);
    ctx.moveTo(-0.1, 0);
    ctx.lineTo(-1.0, 0.34);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();

    // Jagged dorsal fin
    ctx.beginPath();
    ctx.moveTo(0.36, -0.48);
    ctx.lineTo(0.18, -1.0);
    ctx.lineTo(0.0, -0.72);
    ctx.lineTo(-0.2, -1.16);
    ctx.lineTo(-0.44, -0.76);
    ctx.lineTo(-0.68, -1.02);
    ctx.lineTo(-0.72, -0.4);
    ctx.quadraticCurveTo(-0.2, -0.58, 0.36, -0.48);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.045, 0.5);

    const body = function () {
      ctx.beginPath();
      ctx.moveTo(1.36, -0.08);
      ctx.bezierCurveTo(1.18, -0.4, 0.75, -0.55, 0.1, -0.55);
      ctx.bezierCurveTo(-0.5, -0.55, -0.92, -0.3, -1.02, -0.02);
      ctx.bezierCurveTo(-0.9, 0.34, -0.45, 0.58, 0.15, 0.55);
      ctx.bezierCurveTo(0.75, 0.52, 1.2, 0.3, 1.36, -0.08);
      ctx.closePath();
    };

    body();
    ctx.fillStyle = c.body;
    ctx.fill();

    ctx.save();
    body();
    ctx.clip();

    // Dark back
    ctx.globalAlpha = 0.38;
    ctx.fillStyle = c.dark;
    ctx.beginPath();
    ctx.ellipse(-0.02, -0.46, 1.05, 0.28, 0, 0, TAU);
    ctx.fill();

    // Pale flank
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = c.belly;
    ctx.beginPath();
    ctx.ellipse(0.06, 0.24, 0.78, 0.2, -0.03, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Armor ridges
    ctx.strokeStyle = c.dark;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 0.03;
    for (let i = 0; i < 3; i++) {
      const x = 0.55 - i * 0.26;
      ctx.beginPath();
      ctx.moveTo(x, -0.3);
      ctx.quadraticCurveTo(x - 0.06, 0.02, x - 0.02, 0.3);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Bioluminescent nodes
    const pulse = 0.55 + Math.sin(f.phase * 1.4) * 0.3;
    for (let i = 0; i < 4; i++) {
      const x = 0.52 - i * 0.26;
      softDot(ctx, x, 0.1 + Math.sin(i * 1.7) * 0.05, 0.085, c.accent, 0.22 * pulse);
      softDot(ctx, x, 0.1 + Math.sin(i * 1.7) * 0.05, 0.032, c.accent, 0.95);
    }

    // Highlight
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.moveTo(0.9, -0.32);
    ctx.bezierCurveTo(0.5, -0.46, 0.05, -0.5, -0.35, -0.38);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.restore();

    body();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.06;
    ctx.stroke();

    // Angular pectoral
    ctx.save();
    ctx.translate(0.3, 0.3);
    ctx.rotate(0.5 + Math.sin(f.phase * 1.6) * 0.3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(0.32, 0.06, 0.42, 0.3);
    ctx.quadraticCurveTo(0.18, 0.14, 0, 0.1);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.03, 0.45);
    ctx.restore();

    // Open mouth
    ctx.beginPath();
    ctx.moveTo(1.37, -0.09);
    ctx.lineTo(1.0, 0.0);
    ctx.lineTo(1.12, 0.17);
    ctx.closePath();
    ctx.fillStyle = '#2a1140';
    ctx.fill();
    finStroke(ctx, c, 0.035, 0.6);

    // Teeth
    ctx.fillStyle = '#f6fbff';
    for (let i = 0; i < 3; i++) {
      const tx = 1.28 - i * 0.1;
      ctx.beginPath();
      ctx.moveTo(tx, 0.03 + i * 0.035);
      ctx.lineTo(tx - 0.055, 0.03 + i * 0.035);
      ctx.lineTo(tx - 0.028, 0.12 + i * 0.03);
      ctx.closePath();
      ctx.fill();
    }

    // Glowing hunter eye
    softDot(ctx, 0.72, -0.2, 0.34, c.accent, 0.18 + Math.sin(f.phase * 2) * 0.05);
    ctx.beginPath();
    ctx.arc(0.72, -0.2, 0.17, 0, TAU);
    ctx.fillStyle = '#160d2e';
    ctx.fill();
    dot(ctx, 0.74, -0.2, 0.095, c.accent);
    dot(ctx, 0.77, -0.2, 0.045, '#230f34');
    dot(ctx, 0.78, -0.235, 0.03, '#ffffff');

    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.045;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(0.54, -0.36);
    ctx.lineTo(0.88, -0.28);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Gill slashes
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.035;
    for (let i = 0; i < 2; i++) {
      const x = 0.48 - i * 0.09;
      ctx.beginPath();
      ctx.moveTo(x, -0.28);
      ctx.quadraticCurveTo(x - 0.04, 0.0, x, 0.24);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------------
  // 5. Apex Shark — Sleek predatory hydrodynamic silhouette,
  //    authentic heterocercal tail, seamless swimming motion, counter-shading.
  // ---------------------------------------------------------------------
  function drawShark(ctx, f) {
    const c = f.colors;
    const swim = A.clamp(f.swim || 0.45, 0.2, 1.4);
    const wig = Math.sin(f.phase) * (0.16 + 0.18 * swim);
    const wig2 = Math.sin(f.phase - 0.4) * (0.08 + 0.1 * swim);

    // Shark sub-species variant based on individual seed (0: Great White, 1: Tiger Shark, 2: Blacktip Reef)
    const seedVal = Math.abs(Math.floor((f.seed || 1) * 100));
    const variant = seedVal % 3;

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // 1. Far Pectoral Fin (Underneath the body, trailing in the water)
    ctx.save();
    ctx.translate(0.42, -0.12);
    ctx.rotate(-0.28 - Math.sin(f.phase * 1.1) * 0.06);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-0.22, -0.32, -0.52, -0.48);
    ctx.quadraticCurveTo(-0.35, -0.22, -0.16, -0.06);
    ctx.closePath();
    ctx.fillStyle = c.dark;
    ctx.globalAlpha = 0.45;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // 2. Caudal Tail Assembly (Drawn UNDER the body, pivoting smoothly at -0.75)
    ctx.save();
    ctx.translate(-0.75, 0);
    ctx.rotate(wig * 0.85);

    // Caudal Peduncle base (tapers backward)
    ctx.beginPath();
    ctx.moveTo(0.1, -0.26);
    ctx.lineTo(-0.7, -0.08);
    ctx.lineTo(-0.7, 0.08);
    ctx.lineTo(0.1, 0.26);
    ctx.closePath();
    ctx.fillStyle = c.body;
    ctx.fill();

    // Peduncle counter-shading
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0.1, -0.26);
    ctx.lineTo(-0.7, -0.08);
    ctx.lineTo(-0.7, 0.08);
    ctx.lineTo(0.1, 0.26);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = c.belly;
    ctx.beginPath();
    ctx.moveTo(0.1, 0.02);
    ctx.lineTo(-0.7, 0.02);
    ctx.lineTo(-0.7, 0.15);
    ctx.lineTo(0.1, 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Secondary dorsal fin on peduncle
    ctx.beginPath();
    ctx.moveTo(-0.15, -0.2);
    ctx.lineTo(-0.32, -0.38);
    ctx.lineTo(-0.42, -0.14);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.03, 0.45);

    // Anal fin on peduncle
    ctx.beginPath();
    ctx.moveTo(-0.2, 0.18);
    ctx.lineTo(-0.34, 0.34);
    ctx.lineTo(-0.44, 0.12);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.03, 0.45);

    // Peduncle outline
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.045;
    ctx.beginPath();
    ctx.moveTo(0.1, -0.26);
    ctx.lineTo(-0.7, -0.08);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0.1, 0.26);
    ctx.lineTo(-0.7, 0.08);
    ctx.stroke();

    // Heterocercal caudal fin blade (attached to peduncle tip at x = -0.65)
    ctx.save();
    ctx.translate(-0.65, 0);
    ctx.rotate(wig2);

    ctx.beginPath();
    ctx.moveTo(0.04, 0);
    // Upper lobe (sweeping predatory dorsal lobe with subterminal notch)
    ctx.bezierCurveTo(-0.18, -0.16, -0.48, -0.62, -0.96, -0.82);
    ctx.bezierCurveTo(-0.86, -0.66, -0.78, -0.56, -0.86, -0.46); // Notch
    ctx.bezierCurveTo(-0.58, -0.2, -0.3, -0.08, -0.15, 0);       // Caudal fork
    // Lower lobe (stiff, muscular ventral lobe)
    ctx.bezierCurveTo(-0.32, 0.12, -0.52, 0.3, -0.76, 0.42);
    ctx.bezierCurveTo(-0.52, 0.32, -0.24, 0.16, 0.04, 0);
    ctx.closePath();
    ctx.fillStyle = c.dark;
    ctx.fill();
    finStroke(ctx, c, 0.042, 0.6);

    // Caudal fin ray highlights
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 0.026;
    ctx.beginPath();
    ctx.moveTo(-0.1, 0);
    ctx.lineTo(-0.76, -0.6);
    ctx.moveTo(-0.1, 0);
    ctx.lineTo(-0.62, 0.3);
    ctx.stroke();

    // Blacktip variant
    if (variant === 2) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#0a141c';
      ctx.beginPath();
      ctx.moveTo(-0.78, -0.66);
      ctx.lineTo(-0.96, -0.82);
      ctx.lineTo(-0.86, -0.46);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-0.62, 0.32);
      ctx.lineTo(-0.76, 0.42);
      ctx.lineTo(-0.55, 0.24);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore(); // caudal blade
    ctx.restore(); // tail assembly

    // 3. Iconic First Dorsal Fin
    ctx.beginPath();
    ctx.moveTo(0.32, -0.45);
    ctx.bezierCurveTo(0.18, -0.85, -0.02, -1.22, -0.18, -1.26);
    ctx.bezierCurveTo(-0.16, -1.02, -0.26, -0.78, -0.42, -0.64);
    ctx.lineTo(-0.56, -0.38);
    ctx.quadraticCurveTo(-0.12, -0.5, 0.32, -0.45);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.042, 0.55);

    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.032;
    ctx.beginPath();
    ctx.moveTo(0.26, -0.5);
    ctx.lineTo(-0.14, -1.22);
    ctx.stroke();

    if (variant === 2) {
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = '#09151e';
      ctx.beginPath();
      ctx.moveTo(-0.08, -1.05);
      ctx.lineTo(-0.18, -1.26);
      ctx.lineTo(-0.26, -0.96);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 4. Pelvic Fins
    ctx.beginPath();
    ctx.moveTo(-0.35, 0.28);
    ctx.lineTo(-0.52, 0.46);
    ctx.lineTo(-0.62, 0.24);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.028, 0.45);

    // 5. Sleek Torpedo Body (Tapers cleanly over the tail root to (-0.95, 0))
    const bodyPath = function () {
      ctx.beginPath();
      ctx.moveTo(2.15, -0.02);
      ctx.bezierCurveTo(1.75, -0.28, 1.25, -0.42, 0.55, -0.46);
      ctx.bezierCurveTo(-0.15, -0.48, -0.6, -0.35, -0.95, -0.12);
      ctx.quadraticCurveTo(-1.08, 0, -0.95, 0.12);
      ctx.bezierCurveTo(-0.6, 0.35, -0.15, 0.42, 0.55, 0.40);
      ctx.bezierCurveTo(1.22, 0.36, 1.72, 0.18, 2.15, -0.02);
      ctx.closePath();
    };

    // Fill body base
    bodyPath();
    ctx.fillStyle = c.body;
    ctx.fill();

    // Clip details inside body
    ctx.save();
    bodyPath();
    ctx.clip();

    // Dark dorsal counter-shading
    ctx.globalAlpha = 0.44;
    ctx.fillStyle = c.dark;
    ctx.beginPath();
    ctx.ellipse(0.3, -0.32, 1.55, 0.28, 0, 0, TAU);
    ctx.fill();

    // Crisp white/cream counter-shaded belly
    ctx.globalAlpha = 0.96;
    ctx.fillStyle = c.belly;
    ctx.beginPath();
    ctx.moveTo(-1.08, 0.02);
    // Smooth organic lateral counter-shading line along the flank
    ctx.bezierCurveTo(-0.45, 0.16, 0.25, 0.24, 1.05, 0.15);
    ctx.bezierCurveTo(1.45, 0.10, 1.85, 0.06, 2.15, -0.02);
    ctx.lineTo(2.2, 0.65);
    ctx.lineTo(-1.15, 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Lateral line sensory stripe
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 0.022;
    ctx.beginPath();
    ctx.moveTo(1.65, 0.01);
    ctx.bezierCurveTo(0.85, 0.03, -0.15, 0.01, -1.02, 0.01);
    ctx.stroke();

    // Variant 1: Tiger Shark vertical camouflage stripes along flank
    if (variant === 1) {
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = c.outline;
      ctx.lineWidth = 0.045;
      for (let s = 0; s < 8; s++) {
        const sx = 1.15 - s * 0.24;
        ctx.beginPath();
        ctx.moveTo(sx, -0.42);
        ctx.quadraticCurveTo(sx - 0.03, -0.16, sx + 0.02, 0.12);
        ctx.stroke();
      }
    }

    // Variant 0: Great White battle scars
    if (variant === 0) {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.028;
      ctx.beginPath();
      ctx.moveTo(0.55, -0.18);
      ctx.lineTo(0.32, -0.04);
      ctx.moveTo(0.78, -0.12);
      ctx.lineTo(0.62, 0.01);
      ctx.moveTo(-0.15, -0.22);
      ctx.lineTo(-0.28, -0.08);
      ctx.stroke();
    }

    // Dorsal muscular specular highlight
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.moveTo(1.45, -0.26);
    ctx.bezierCurveTo(0.85, -0.38, 0.15, -0.40, -0.55, -0.28);
    ctx.stroke();

    ctx.restore(); // restore from body clip

    // Body perimeter outline
    bodyPath();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.048;
    ctx.stroke();

    // 6. Ampullae of Lorenzini (sensory pore dots on rostrum)
    ctx.globalAlpha = 0.45;
    dot(ctx, 1.95, -0.06, 0.016, c.outline);
    dot(ctx, 1.88, -0.12, 0.015, c.outline);
    dot(ctx, 1.76, -0.04, 0.016, c.outline);
    dot(ctx, 1.92, 0.02, 0.015, c.outline);
    ctx.globalAlpha = 1;

    // 7. Five Realistic Curved Gill Slits (On the neck)
    ctx.globalAlpha = 0.52;
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.026;
    for (let i = 0; i < 5; i++) {
      const gx = 0.82 - i * 0.075;
      ctx.beginPath();
      ctx.moveTo(gx, -0.20);
      ctx.quadraticCurveTo(gx - 0.035, -0.02, gx + 0.01, 0.16);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 8. Under-slung Predatory Jaw & Serrated Teeth
    ctx.beginPath();
    ctx.moveTo(1.82, 0.04);
    ctx.quadraticCurveTo(1.52, 0.18, 1.18, 0.20);
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.038;
    ctx.stroke();

    // Sharp triangular white shark teeth
    ctx.fillStyle = '#ffffff';
    for (let t = 0; t < 6; t++) {
      const tx = 1.72 - t * 0.085;
      const ty = 0.07 + t * 0.02;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - 0.04, ty + 0.01);
      ctx.lineTo(tx - 0.02, ty + 0.065);
      ctx.closePath();
      ctx.fill();
    }

    // 9. Predatory Eye & Brow (Almond/oval fierce gaze)
    const eyeX = 1.35;
    const eyeY = -0.18;
    // Pale orbital ring
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY, 0.09, 0.075, 0.1, 0, TAU);
    ctx.fillStyle = '#ebf8ff';
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.024;
    ctx.stroke();
    // Deep black pupil
    dot(ctx, eyeX + 0.01, eyeY, 0.052, '#06121a');
    // Specular highlight
    dot(ctx, eyeX + 0.032, eyeY - 0.026, 0.02, '#ffffff');
    // Menacing brow ridge
    ctx.globalAlpha = 0.72;
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.032;
    ctx.beginPath();
    ctx.moveTo(eyeX - 0.14, eyeY - 0.08);
    ctx.lineTo(eyeX + 0.12, eyeY - 0.03);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 10. Near Pectoral Fin (Large falcate hydrofoil wing)
    ctx.save();
    ctx.translate(0.48, 0.16);
    const finFlex = 0.32 + Math.sin(f.phase * 1.1) * 0.12 * swim;
    ctx.rotate(finFlex);
    ctx.beginPath();
    ctx.moveTo(0.04, 0);
    // Swept curved leading edge down to wing tip
    ctx.bezierCurveTo(0.34, 0.16, 0.62, 0.52, 0.85, 0.88);
    // Trailing edge curved back to body
    ctx.bezierCurveTo(0.52, 0.68, 0.20, 0.38, -0.06, 0.18);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.04, 0.6);

    // Fin ray highlight
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.032;
    ctx.beginPath();
    ctx.moveTo(0.12, 0.04);
    ctx.lineTo(0.78, 0.84);
    ctx.stroke();

    // Blacktip variant: black fin tip
    if (variant === 2) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#09151e';
      ctx.beginPath();
      ctx.moveTo(0.68, 0.72);
      ctx.lineTo(0.85, 0.88);
      ctx.lineTo(0.62, 0.8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ---------------------------------------------------------------------
  // 6. Manta Ray — the ladder's glider, drawn from above: two enormous
  //    swept pectorals, a narrow trunk between them, a pair of cephalic
  //    fins at the front and a whip tail behind. The beat is a wave that
  //    runs out to the tips, so the wings bend instead of hinging, and the
  //    projected half-span shortens as they pass horizontal — that squeeze
  //    is what sells the stroke on a flat canvas.
  // ---------------------------------------------------------------------

  // One pectoral. `span` is the projected half-span, `aft` walks the tip
  // backwards on the upstroke. The tip sits well behind mid-body, the leading
  // edge is only gently convex and the trailing edge is scooped toward the
  // head, so the two wings leave a V notch at the tail — without that notch
  // the silhouette collapses into an almond.
  function mantaWing(ctx, dir, span, aft) {
    const tipX = -0.34 - aft;
    const tipY = dir * 1.45 * span;
    ctx.beginPath();
    ctx.moveTo(0.7, dir * 0.06);
    ctx.quadraticCurveTo(0.5, dir * 0.8 * span, tipX, tipY);
    ctx.quadraticCurveTo(-0.32, dir * 0.62 * span, -0.72, dir * 0.05);
    ctx.lineTo(0.7, dir * 0.06);
    ctx.closePath();
  }

  function mantaTrunk(ctx) {
    ctx.beginPath();
    ctx.moveTo(0.9, 0);
    ctx.bezierCurveTo(0.82, -0.16, 0.44, -0.26, 0.04, -0.26);
    ctx.bezierCurveTo(-0.34, -0.26, -0.6, -0.15, -0.7, 0);
    ctx.bezierCurveTo(-0.6, 0.15, -0.34, 0.26, 0.04, 0.26);
    ctx.bezierCurveTo(0.44, 0.26, 0.82, 0.16, 0.9, 0);
    ctx.closePath();
  }

  function drawManta(ctx, f) {
    const c = f.colors;
    const swim = A.clamp(f.swim || 0.5, 0.15, 1.6);
    const flap = A.clamp(f.flap || 0, 0, 1);
    const biting = A.clamp(biteOpen(f), 0, 1);
    let turn = f.bank || 0;
    if (!turn && f.targetAngle != null) turn = A.clamp(A.angleDiff(f.angle, f.targetAngle) * 1.3, -1, 1);
    const bank = A.clamp(turn, -1, 1);

    const beat = f.phase * 0.85;
    const wave = Math.sin(beat);
    const amp = 0.24 + 0.1 * swim + 0.26 * flap;
    const lift = wave * amp;
    const span = 1 - Math.abs(lift) * 0.4;
    const aft = 0.06 + Math.max(0, -wave) * amp * 0.55;

    // Rolling puts one wing over the other: the near blade lengthens, the far
    // one shortens and drops into shadow.
    const nearSpan = span * (1 + bank * 0.13);
    const farSpan = span * (0.88 - bank * 0.1);

    ctx.save();
    ctx.rotate(bank * 0.05);
    ctx.translate(0, -lift * 0.14);

    // 1. FAR WING — the underside of the ray seen edge-on, so it is painted
    //    flat dark and left unadorned.
    ctx.globalAlpha = 0.8;
    mantaWing(ctx, -1, farSpan, aft);
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.04, 0.4);
    ctx.globalAlpha = 1;

    // 2. TAIL — a whip, not a fish's fin. It lags the stroke by about a third
    //    of a beat, which makes the animal look driven from the front.
    const tw = Math.sin(beat - 2.1) * (0.05 + 0.05 * swim + 0.07 * flap);
    ctx.save();
    ctx.translate(-0.7, 0);
    ctx.rotate(tw);
    ctx.beginPath();
    ctx.moveTo(0.06, -0.07);
    ctx.quadraticCurveTo(-0.4, -0.028, -0.88, 0);
    ctx.quadraticCurveTo(-0.4, 0.028, 0.06, 0.07);
    ctx.closePath();
    ctx.fillStyle = c.dark;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-0.62, 0);
    ctx.lineTo(-0.88, -0.14);
    ctx.lineTo(-0.78, 0);
    ctx.lineTo(-0.88, 0.11);
    ctx.closePath();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.028, 0.35);
    ctx.globalAlpha = 1;
    ctx.restore();

    // 3. NEAR WING — the top surface: body colour, the aft half sunk into its
    //    own shadow, and the pale belly flashing along the trailing edge every
    //    time the wing comes up.
    mantaWing(ctx, 1, nearSpan, aft);
    ctx.fillStyle = c.body;
    ctx.fill();

    ctx.save();
    mantaWing(ctx, 1, nearSpan, aft);
    ctx.clip();

    ctx.globalAlpha = 0.26;
    ctx.fillStyle = c.dark;
    ctx.beginPath();
    ctx.ellipse(-0.4, 0.68 * nearSpan, 0.58, 0.5 * nearSpan, -0.5, 0, TAU);
    ctx.fill();

    ctx.globalAlpha = 0.13;
    ctx.strokeStyle = c.dark;
    ctx.lineWidth = 0.026;
    ctx.beginPath();
    for (let i = 1; i <= 4; i++) {
      const t = i / 5;
      ctx.moveTo(0.44 - t * 0.78, 0.13);
      ctx.lineTo(-0.42 - aft, (0.42 + t * 0.82) * nearSpan);
    }
    ctx.stroke();

    ctx.globalAlpha = 0.17;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.085;
    ctx.beginPath();
    ctx.moveTo(0.62, 0.08);
    ctx.quadraticCurveTo(0.46, 0.74 * nearSpan, -0.3 - aft, 1.36 * nearSpan);
    ctx.stroke();

    if (lift > 0.02) {
      ctx.globalAlpha = Math.min(0.5, lift * 1.5);
      ctx.strokeStyle = c.belly;
      ctx.lineWidth = 0.07;
      ctx.beginPath();
      ctx.moveTo(-0.72, 0.05);
      ctx.quadraticCurveTo(-0.32, 0.62 * nearSpan, -0.36 - aft, 1.38 * nearSpan);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    mantaWing(ctx, 1, nearSpan, aft);
    finStroke(ctx, c, 0.045, 0.6);

    // 4. TRUNK — the narrow body the wings grew out of.
    mantaTrunk(ctx);
    ctx.fillStyle = c.body;
    ctx.fill();

    ctx.save();
    mantaTrunk(ctx);
    ctx.clip();

    ctx.globalAlpha = 0.42;
    ctx.fillStyle = c.dark;
    ctx.fillRect(-1, -0.36, 2.2, 0.26);
    ctx.globalAlpha = 1;

    // The pale shoulder patches: the marking that makes a manta a manta.
    softDot(ctx, 0.42, -0.14, 0.09, c.accent, 0.5);
    softDot(ctx, 0.44, 0.15, 0.095, c.accent, 0.58);
    softDot(ctx, 0.74, 0, 0.14, c.accent, 0.18);

    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = c.dark;
    ctx.lineWidth = 0.022;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const x = 0.14 - i * 0.15;
      ctx.moveTo(x, -0.055);
      ctx.lineTo(x, 0.055);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();

    mantaTrunk(ctx);
    finStroke(ctx, c, 0.042, 0.65);

    // 5. CEPHALIC FINS — the horns. Folded forward into a hydrofoil while
    //    cruising, spread wide into a feeding funnel once the jaws are open.
    const horn = 0.13 + biting * 0.52 - flap * 0.04;
    for (let k = 0; k < 2; k++) {
      const dir = k ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(0.8, dir * 0.18);
      ctx.quadraticCurveTo(1.04, dir * (0.22 + horn * 0.45), 1.2, dir * (0.05 + horn));
      ctx.quadraticCurveTo(0.98, dir * (0.11 + horn * 0.18), 0.76, dir * 0.05);
      ctx.closePath();
      ctx.fillStyle = dir > 0 ? c.body : c.dark;
      ctx.fill();
      if (dir > 0) finStroke(ctx, c, 0.03, 0.5);
    }

    // 6. MOUTH — a transverse slit between the horns. Rays do not hinge a
    //    jaw, so this grows wider and further forward instead.
    const mh = 0.085 + biting * 0.21;
    ctx.beginPath();
    ctx.ellipse(0.88, 0, 0.055 + biting * 0.055, mh, 0, 0, TAU);
    ctx.fillStyle = biting > 0.05 ? '#061219' : 'rgba(6, 18, 25, 0.6)';
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 0.022;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 7. EYES set back at the wing roots. The far one is painted as a dim mark
    //    rather than alpha-dipped, because `eye` resets the alpha it is given.
    eye(ctx, 0.52, -0.24, 0.046, c, { outline: false, sclera: 'rgba(224,242,250,0.45)', pupil: '#0a222e' });
    eye(ctx, 0.52, 0.25, 0.064, c, { pupilScale: 0.55 });

    // 8. Under boost power the water is visibly slipping off both leading
    //    edges, so the stroke you hear has something on screen to match it.
    if (flap > 0.05) {
      ctx.globalAlpha = 0.28 * flap;
      ctx.strokeStyle = '#eafcff';
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.moveTo(0.62, -0.1);
      ctx.quadraticCurveTo(0.46, -0.74 * farSpan, -0.3 - aft, -1.36 * farSpan);
      ctx.moveTo(0.62, 0.1);
      ctx.quadraticCurveTo(0.46, 0.74 * nearSpan, -0.3 - aft, 1.36 * nearSpan);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------
  // 7. Sawshark — a real deep-water shark that happens to carry a blade.
  //    Nothing fantasy about the anatomy: two dorsal fins, heterocercal
  //    tail, five gill slits, eyes set back behind the rostrum, and a
  //    flattened saw armed with teeth along both edges plus a pair of
  //    barbels across the middle. The tail beats well above the apex
  //    shark's cadence, which is what earns the ladder's top speed.
  // ---------------------------------------------------------------------
  function drawSawshark(ctx, f) {
    const c = f.colors;
    const swim = A.clamp(f.swim || 0.5, 0.2, 1.5);
    // game.js ramps `saw` to 1 while Rip Dash is live.
    const dash = A.clamp(f.saw || 0, 0, 1);
    const biting = A.clamp(biteOpen(f), 0, 1);
    const beat = f.phase * (1.75 + dash * 0.5);
    const wig = Math.sin(beat) * (0.15 + 0.19 * swim);
    const wig2 = Math.sin(beat - 0.45) * (0.09 + 0.1 * swim);
    // The head lags the tail slightly, so the saw sweeps the water instead of
    // riding rigidly off the nose.
    const sway = Math.sin(beat - 0.9) * (0.022 + 0.045 * swim + 0.075 * dash + biting * 0.05);
    const variant = Math.abs(Math.floor((f.seed || 1) * 100)) % 3;

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // 1. Far pectoral trailing behind the body.
    ctx.save();
    ctx.translate(0.4, -0.1);
    ctx.rotate(-0.3 - Math.sin(beat * 0.62) * 0.05);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-0.24, -0.3, -0.56, -0.44);
    ctx.quadraticCurveTo(-0.34, -0.18, -0.14, -0.04);
    ctx.closePath();
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = c.dark;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // 2. Caudal peduncle and tail, pivoting at the narrow waist.
    ctx.save();
    ctx.translate(-0.72, 0);
    ctx.rotate(wig * 0.8);

    const ped = function () {
      ctx.beginPath();
      ctx.moveTo(0.12, -0.25);
      ctx.lineTo(-0.68, -0.08);
      ctx.lineTo(-0.68, 0.08);
      ctx.lineTo(0.12, 0.25);
      ctx.closePath();
    };
    ped();
    ctx.fillStyle = c.body;
    ctx.fill();

    ctx.save();
    ped();
    ctx.clip();
    ctx.fillStyle = c.belly;
    ctx.beginPath();
    ctx.moveTo(0.12, 0.02);
    ctx.lineTo(-0.68, 0.02);
    ctx.lineTo(-0.68, 0.15);
    ctx.lineTo(0.12, 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Second dorsal and anal fin riding on the peduncle.
    ctx.beginPath();
    ctx.moveTo(-0.18, -0.19);
    ctx.lineTo(-0.34, -0.36);
    ctx.lineTo(-0.44, -0.13);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.03, 0.45);

    ctx.beginPath();
    ctx.moveTo(-0.24, 0.17);
    ctx.lineTo(-0.38, 0.32);
    ctx.lineTo(-0.48, 0.11);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.03, 0.45);

    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.045;
    ctx.beginPath();
    ctx.moveTo(0.12, -0.25);
    ctx.lineTo(-0.68, -0.08);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0.12, 0.25);
    ctx.lineTo(-0.68, 0.08);
    ctx.stroke();

    // Tail blade: long upper lobe for drive, short stiff lower lobe.
    ctx.save();
    ctx.translate(-0.62, 0);
    ctx.rotate(wig2);
    ctx.beginPath();
    ctx.moveTo(0.04, 0);
    ctx.bezierCurveTo(-0.16, -0.2, -0.5, -0.72, -1.02, -0.94);
    ctx.bezierCurveTo(-0.9, -0.74, -0.8, -0.6, -0.9, -0.48);
    ctx.bezierCurveTo(-0.6, -0.2, -0.3, -0.07, -0.14, 0);
    ctx.bezierCurveTo(-0.3, 0.12, -0.5, 0.28, -0.72, 0.4);
    ctx.bezierCurveTo(-0.48, 0.3, -0.22, 0.15, 0.04, 0);
    ctx.closePath();
    ctx.fillStyle = c.dark;
    ctx.fill();
    finStroke(ctx, c, 0.042, 0.6);

    ctx.globalAlpha = 0.26;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 0.024;
    ctx.beginPath();
    ctx.moveTo(-0.1, 0);
    ctx.lineTo(-0.82, -0.68);
    ctx.moveTo(-0.1, 0);
    ctx.lineTo(-0.58, 0.28);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore(); // blade
    ctx.restore(); // tail assembly

    // 3. First dorsal, blunt-triangular and set over the pectorals.
    ctx.beginPath();
    ctx.moveTo(0.34, -0.42);
    ctx.bezierCurveTo(0.22, -0.78, 0.04, -1.1, -0.14, -1.14);
    ctx.bezierCurveTo(-0.12, -0.9, -0.24, -0.7, -0.4, -0.56);
    ctx.lineTo(-0.52, -0.34);
    ctx.quadraticCurveTo(-0.06, -0.44, 0.34, -0.42);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.042, 0.55);

    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.03;
    ctx.beginPath();
    ctx.moveTo(0.28, -0.48);
    ctx.lineTo(-0.1, -1.1);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 4. Pelvic fin.
    ctx.beginPath();
    ctx.moveTo(-0.32, 0.26);
    ctx.lineTo(-0.48, 0.44);
    ctx.lineTo(-0.58, 0.22);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.028, 0.45);

    // 5. Body: broader and flatter through the head than the apex shark.
    const bodyPath = function () {
      ctx.beginPath();
      ctx.moveTo(1.14, 0.03);
      ctx.bezierCurveTo(1.12, -0.2, 0.9, -0.38, 0.52, -0.45);
      ctx.bezierCurveTo(-0.12, -0.52, -0.58, -0.37, -0.98, -0.13);
      ctx.quadraticCurveTo(-1.1, 0, -0.98, 0.13);
      ctx.bezierCurveTo(-0.58, 0.36, -0.1, 0.46, 0.52, 0.44);
      ctx.bezierCurveTo(0.9, 0.42, 1.12, 0.28, 1.14, 0.03);
      ctx.closePath();
    };

    bodyPath();
    ctx.fillStyle = c.body;
    ctx.fill();

    ctx.save();
    bodyPath();
    ctx.clip();

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = c.dark;
    ctx.beginPath();
    ctx.ellipse(0.3, -0.34, 1.35, 0.3, 0, 0, TAU);
    ctx.fill();

    ctx.globalAlpha = 0.96;
    ctx.fillStyle = c.belly;
    ctx.beginPath();
    ctx.moveTo(-1.1, 0.02);
    ctx.bezierCurveTo(-0.45, 0.16, 0.25, 0.24, 0.9, 0.16);
    ctx.bezierCurveTo(1.04, 0.13, 1.14, 0.08, 1.2, 0.03);
    ctx.lineTo(1.2, 0.62);
    ctx.lineTo(-1.15, 0.62);
    ctx.closePath();
    ctx.fill();

    // Deep-water coat: a dusky wash or a scatter of pale spots.
    if (variant === 2) {
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#22303b';
      ctx.fillRect(-1.2, -0.62, 2.6, 1.24);
    } else if (variant === 1) {
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = c.outline;
      for (let s = 0; s < 7; s++) {
        dot(ctx, 0.75 - s * 0.18, -0.3 + Math.sin(s * 2.1) * 0.1,
          0.032 + (s % 3) * 0.008, c.outline);
      }
    }
    ctx.globalAlpha = 1;

    // Lateral line.
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.moveTo(0.95, 0);
    ctx.bezierCurveTo(0.3, 0.02, -0.4, 0, -1, 0.01);
    ctx.stroke();

    // Muscular specular down the back.
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.055;
    ctx.beginPath();
    ctx.moveTo(0.9, -0.26);
    ctx.bezierCurveTo(0.4, -0.36, -0.1, -0.38, -0.6, -0.26);
    ctx.stroke();
    ctx.restore();

    bodyPath();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.048;
    ctx.stroke();

    // 6. The rostrum. Teeth on both edges, barbels across the middle.
    ctx.save();
    ctx.translate(1.05, 0.02);
    ctx.rotate(sway);
    const tip = 1.5;

    const sawPath = function () {
      ctx.beginPath();
      ctx.moveTo(-0.06, -0.1);
      ctx.bezierCurveTo(0.5, -0.095, 1.05, -0.06, tip, 0);
      ctx.bezierCurveTo(1.05, 0.062, 0.5, 0.104, -0.06, 0.118);
      ctx.closePath();
    };

    sawPath();
    ctx.fillStyle = c.dark;
    ctx.fill();

    ctx.globalAlpha = 0.34;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 0.022;
    ctx.beginPath();
    ctx.moveTo(0, -0.088);
    ctx.bezierCurveTo(0.5, -0.082, 1, -0.048, tip - 0.06, -0.004);
    ctx.stroke();
    ctx.globalAlpha = 1;

    sawPath();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.036;
    ctx.stroke();

    // One path for all twenty teeth: a single fill and a single stroke.
    const TEETH = 10;
    ctx.beginPath();
    for (let i = 0; i < TEETH; i++) {
      const t = 0.06 + (i / (TEETH - 1)) * 0.82;
      const x = -0.05 + t * (tip + 0.05);
      const back = Math.pow(1 - t, 1.3);
      const hy = 0.012 + 0.095 * back;
      const ly = 0.014 + 0.106 * back;
      const L = 0.05 + 0.055 * Math.sin(Math.PI * (0.12 + t * 0.8));
      ctx.moveTo(x, -hy);
      ctx.lineTo(x + L * 0.75, -hy - L);
      ctx.lineTo(x - L * 0.28, -hy + 0.006);
      ctx.closePath();
      ctx.moveTo(x, ly);
      ctx.lineTo(x + L * 0.75, ly + L);
      ctx.lineTo(x - L * 0.28, ly - 0.006);
      ctx.closePath();
    }
    ctx.fillStyle = dash > 0.05 ? '#f0fbff' : '#dfeaf1';
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.012;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Barbels — the sensory pair that lets a sawshark find prey in the dark.
    const bw = Math.sin(beat * 0.8) * 0.02;
    ctx.globalAlpha = 0.78;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 0.017;
    ctx.beginPath();
    ctx.moveTo(0.62, 0.058);
    ctx.quadraticCurveTo(0.68 + bw, 0.17, 0.6 + bw, 0.26);
    ctx.moveTo(0.78, 0.06);
    ctx.quadraticCurveTo(0.84 - bw, 0.17, 0.76 - bw, 0.25);
    ctx.stroke();

    // Rip Dash heats the edge and smears the last sweep across the blade.
    if (dash > 0.04) {
      ctx.globalAlpha = 0.55 * dash;
      ctx.strokeStyle = '#eafcff';
      ctx.lineWidth = 0.028 + 0.03 * dash;
      ctx.beginPath();
      ctx.moveTo(0.02, -0.03);
      ctx.lineTo(tip - 0.02, 0);
      ctx.stroke();

      ctx.globalAlpha = 0.2 * dash;
      ctx.lineWidth = 0.02;
      ctx.beginPath();
      ctx.moveTo(0.1, -0.09);
      ctx.lineTo(tip - 0.05, -0.01);
      ctx.moveTo(0.1, 0.1);
      ctx.lineTo(tip - 0.05, 0.01);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore(); // rostrum

    // 7. Eyes set well back behind the saw, as they are on a real one.
    const eyeX = 0.88;
    const eyeY = -0.13;
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY, 0.075, 0.062, 0.12, 0, TAU);
    ctx.fillStyle = '#eaf8ff';
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.02;
    ctx.stroke();
    dot(ctx, eyeX + 0.008, eyeY, 0.045, '#06121a');
    dot(ctx, eyeX + 0.026, eyeY - 0.022, 0.016, '#ffffff');
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.028;
    ctx.beginPath();
    ctx.moveTo(eyeX - 0.12, eyeY - 0.07);
    ctx.lineTo(eyeX + 0.1, eyeY - 0.035);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 8. Five gill slits.
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.024;
    for (let i = 0; i < 5; i++) {
      const gx = 0.6 - i * 0.07;
      ctx.beginPath();
      ctx.moveTo(gx, -0.19);
      ctx.quadraticCurveTo(gx - 0.03, 0, gx + 0.008, 0.15);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 9. Transverse mouth under the root of the saw. It flexes open on its own
    //    as the bite envelope runs; drawGape turns the same hinge into a chomp.
    const mo = 0.05 + biting * 0.14;
    ctx.beginPath();
    ctx.moveTo(1.06, 0.12);
    ctx.quadraticCurveTo(0.84, 0.15 + mo * 0.5, 0.64, 0.13);
    ctx.quadraticCurveTo(0.84, 0.19 + mo, 1.06, 0.12);
    ctx.closePath();
    ctx.fillStyle = '#0d1a22';
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.026;
    ctx.stroke();

    // 10. Near pectoral — the low wing that steers the whole rush.
    ctx.save();
    ctx.translate(0.44, 0.14);
    ctx.rotate(0.3 + Math.sin(beat * 0.62) * (0.1 + 0.06 * swim) + dash * 0.16);
    ctx.beginPath();
    ctx.moveTo(0.04, 0);
    ctx.bezierCurveTo(0.3, 0.16, 0.56, 0.5, 0.78, 0.84);
    ctx.bezierCurveTo(0.48, 0.66, 0.18, 0.36, -0.06, 0.16);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.04, 0.55);

    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.03;
    ctx.beginPath();
    ctx.moveTo(0.1, 0.03);
    ctx.lineTo(0.72, 0.8);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ---------------------------------------------------------------------
  // 9. Megalodon — the monster in the films, drawn as a great white that has
  //    kept growing: a blockier head, a deeper body, a dorsal with a wide back
  //    and a tail whose upper lobe dominates. Everything that reads as "big"
  //    on a shark silhouette is pushed further here, and the eye stays small,
  //    which is the part that actually makes it look like a predator.
  // ---------------------------------------------------------------------
  // Otodus megalodon, built from what the fossils actually tell us rather than
  // from the poster: a heavily built lamnid with a short broad snout, five long
  // gill slits, a tall rounded-backed first dorsal followed by a small second
  // one, a near-symmetric lunate tail (not the upturned crescent of a mako),
  // small high-set eyes, and broad triangular teeth instead of needles.
  function drawMegalodon(ctx, f) {
    const c = f.colors;
    const swim = A.clamp(f.swim || 0.45, 0.15, 1.4);
    // A body this heavy cannot flick. Long, slow, deep tail beats.
    const wig = Math.sin(f.phase) * (0.11 + 0.13 * swim);
    const wig2 = Math.sin(f.phase - 0.42) * (0.06 + 0.08 * swim);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // 1. Far pectoral, mostly hidden behind the trunk and swept back ventrally.
    ctx.save();
    ctx.translate(0.62, 0.18);
    ctx.rotate(0.46 + Math.sin(f.phase * 0.9) * 0.04);
    ctx.beginPath();
    ctx.moveTo(0.05, 0);
    ctx.bezierCurveTo(0.02, 0.20, -0.14, 0.42, -0.32, 0.55);
    ctx.bezierCurveTo(-0.26, 0.34, -0.14, 0.14, -0.03, 0.02);
    ctx.closePath();
    ctx.fillStyle = c.dark;
    ctx.globalAlpha = 0.4;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // 2. Caudal assembly: the deep peduncle a lunate tail is hung from.
    ctx.save();
    ctx.translate(-1.06, 0);
    ctx.rotate(wig * 0.8);

    const peduncle = function () {
      ctx.beginPath();
      ctx.moveTo(0.20, -0.34);
      ctx.lineTo(-0.52, -0.15);
      ctx.lineTo(-0.52, 0.15);
      ctx.lineTo(0.20, 0.34);
      ctx.closePath();
    };
    peduncle();
    ctx.fillStyle = c.body;
    ctx.fill();

    ctx.save();
    peduncle();
    ctx.clip();
    ctx.fillStyle = c.belly;
    ctx.beginPath();
    ctx.moveTo(0.20, 0.04);
    ctx.lineTo(-0.56, 0.04);
    ctx.lineTo(-0.56, 0.22);
    ctx.lineTo(0.20, 0.40);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // The two lateral keels a lamnid tail is built on.
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = c.dark;
    ctx.lineWidth = 0.032;
    ctx.beginPath();
    ctx.moveTo(0.14, -0.26);
    ctx.lineTo(-0.48, -0.10);
    ctx.moveTo(0.14, 0.26);
    ctx.lineTo(-0.48, 0.10);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Dorsal keel fin, then the small anal under the belly line. Both sit on
    // the peduncle rather than floating above it.
    ctx.beginPath();
    ctx.moveTo(-0.08, -0.20);
    ctx.lineTo(-0.20, -0.40);
    ctx.lineTo(-0.34, -0.16);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.026, 0.45);

    ctx.beginPath();
    ctx.moveTo(-0.14, 0.20);
    ctx.lineTo(-0.26, 0.38);
    ctx.lineTo(-0.40, 0.16);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.026, 0.45);

    ctx.save();
    ctx.translate(-0.46, 0);
    ctx.rotate(wig2);

    // Lunate, and near-symmetric: the upper lobe only just outruns the lower.
    // The lobes are thick and the fork is shallow, so the whole fin is about as
    // tall as the animal is deep - which is what a real mackerel-shark tail is.
    ctx.beginPath();
    ctx.moveTo(0.06, -0.16);
    ctx.quadraticCurveTo(-0.02, -0.44, -0.30, -0.72);
    ctx.quadraticCurveTo(-0.24, -0.36, -0.12, 0);
    ctx.quadraticCurveTo(-0.20, 0.30, -0.26, 0.64);
    ctx.quadraticCurveTo(-0.06, 0.44, 0.06, 0.16);
    ctx.closePath();
    ctx.fillStyle = c.dark;
    ctx.fill();
    finStroke(ctx, c, 0.04, 0.6);

    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 0.022;
    ctx.beginPath();
    ctx.moveTo(0.02, -0.10);
    ctx.lineTo(-0.22, -0.60);
    ctx.moveTo(0.02, 0.10);
    ctx.lineTo(-0.19, 0.52);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore(); // blade
    ctx.restore(); // tail assembly

    // 3. First dorsal: tall, broad-based, rounded at the tip and hooked back.
    // Its base has to ride the spine, so it runs from over the pectorals back
    // to where the trunk starts to narrow.
    ctx.beginPath();
    ctx.moveTo(0.56, -0.62);
    ctx.bezierCurveTo(0.40, -0.94, 0.16, -1.22, -0.08, -1.34);
    ctx.bezierCurveTo(-0.18, -1.16, -0.28, -0.96, -0.40, -0.80);
    ctx.bezierCurveTo(-0.50, -0.68, -0.60, -0.60, -0.70, -0.52);
    ctx.quadraticCurveTo(-0.02, -0.64, 0.56, -0.62);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.042, 0.58);

    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.moveTo(0.44, -0.68);
    ctx.lineTo(-0.06, -1.28);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Second dorsal, small and set well back before the keel.
    ctx.beginPath();
    ctx.moveTo(-0.78, -0.44);
    ctx.lineTo(-0.90, -0.62);
    ctx.lineTo(-1.02, -0.36);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.024, 0.5);

    // 4. Pelvic fins, in front of the anal like a real lamnid's.
    ctx.beginPath();
    ctx.moveTo(-0.26, 0.42);
    ctx.lineTo(-0.44, 0.62);
    ctx.lineTo(-0.56, 0.34);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.026, 0.45);

    // 5. The trunk: deep through the shoulders, blunt and short in the face.
    const bodyPath = function () {
      ctx.beginPath();
      ctx.moveTo(2.00, 0.16);
      ctx.bezierCurveTo(2.12, 0.02, 2.10, -0.18, 1.92, -0.32);
      ctx.bezierCurveTo(1.62, -0.50, 1.12, -0.62, 0.54, -0.64);
      ctx.bezierCurveTo(-0.12, -0.66, -0.62, -0.56, -0.92, -0.36);
      ctx.bezierCurveTo(-1.06, -0.26, -1.14, -0.12, -1.14, 0.0);
      ctx.bezierCurveTo(-1.14, 0.14, -1.02, 0.30, -0.84, 0.40);
      ctx.bezierCurveTo(-0.38, 0.60, 0.36, 0.66, 1.02, 0.58);
      ctx.bezierCurveTo(1.54, 0.52, 1.88, 0.34, 2.00, 0.16);
      ctx.closePath();
    };

    bodyPath();
    ctx.fillStyle = c.body;
    ctx.fill();

    ctx.save();
    bodyPath();
    ctx.clip();

    // Counter-shading with a hard edge. The dark stops high on the flank, so
    // the pale belly runs deep - the look a great white has and a meg had more of.
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = c.dark;
    ctx.beginPath();
    ctx.ellipse(0.30, -0.44, 1.80, 0.36, 0, 0, TAU);
    ctx.fill();

    ctx.globalAlpha = 0.96;
    ctx.fillStyle = c.belly;
    ctx.beginPath();
    ctx.moveTo(-1.20, 0.06);
    ctx.bezierCurveTo(-0.44, 0.22, 0.34, 0.30, 1.10, 0.24);
    ctx.bezierCurveTo(1.54, 0.21, 1.88, 0.12, 2.06, 0.02);
    ctx.lineTo(2.15, 0.80);
    ctx.lineTo(-1.2, 0.80);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // The seam between the two colours, drawn rather than left to the fills.
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 0.026;
    ctx.beginPath();
    ctx.moveTo(1.94, 0.06);
    ctx.bezierCurveTo(1.2, 0.24, 0.2, 0.30, -0.9, 0.12);
    ctx.stroke();

    // Lateral line.
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.moveTo(1.5, -0.06);
    ctx.bezierCurveTo(0.7, -0.04, -0.3, -0.04, -1.06, 0.0);
    ctx.stroke();

    // The dark axillary arc behind the jaw that every lamnid has.
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = c.dark;
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.moveTo(1.16, 0.10);
    ctx.quadraticCurveTo(0.92, 0.26, 0.72, 0.42);
    ctx.stroke();

    // Old battle scars: the animal has finished every fight it was in.
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = '#f2fbff';
    ctx.lineWidth = 0.03;
    ctx.beginPath();
    ctx.moveTo(0.58, -0.30);
    ctx.lineTo(0.30, -0.10);
    ctx.moveTo(0.88, -0.16);
    ctx.lineTo(0.66, 0.02);
    ctx.moveTo(-0.12, -0.34);
    ctx.lineTo(-0.30, -0.14);
    ctx.moveTo(-0.50, 0.20);
    ctx.lineTo(-0.70, 0.04);
    ctx.stroke();

    // Cookiecutter wounds, the signature of the animal's own youth.
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#f6feff';
    ctx.beginPath();
    ctx.ellipse(0.14, 0.14, 0.11, 0.07, 0.3, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-0.60, -0.04, 0.09, 0.06, -0.2, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Dorsal muscle sheen.
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.07;
    ctx.beginPath();
    ctx.moveTo(1.34, -0.42);
    ctx.bezierCurveTo(0.74, -0.56, 0.02, -0.58, -0.66, -0.44);
    ctx.stroke();
    ctx.restore(); // body clip

    bodyPath();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.05;
    ctx.stroke();

    // 6. Five gill slits - five, because it is a lamnid - long and angled back
    // under the body between the eye and the pectoral.
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.03;
    for (let i = 0; i < 5; i++) {
      const gx = 1.24 - i * 0.10;
      const gh = 0.40 - Math.abs(i - 1.5) * 0.03;
      ctx.beginPath();
      ctx.moveTo(gx, -0.24);
      ctx.quadraticCurveTo(gx - 0.05, -0.24 + gh * 0.55, gx + 0.01, -0.24 + gh);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 7. The mouth: a long arc from under the nose back past the eye line.
    const jaw = function (t) {
      // t 0 = the front of the lip under the snout, 1 = the corner of the gape.
      const x = 1.98 - t * 0.82;
      const y = 0.10 + Math.sin(t * 1.5) * 0.14;
      return { x: x, y: y };
    };

    ctx.beginPath();
    ctx.moveTo(1.98, 0.10);
    ctx.bezierCurveTo(1.80, 0.26, 1.46, 0.30, 1.16, 0.24);
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.05;
    ctx.stroke();

    // The subocular line running back from the gape toward the gills.
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = c.dark;
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.moveTo(1.16, 0.22);
    ctx.quadraticCurveTo(1.24, 0.02, 1.34, -0.16);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Resting teeth: broad-based triangles, biggest at the front, poking past
    // the lower lip so the mouth looks armed while it is shut.
    for (let t = 0; t < 9; t++) {
      const tt = t / 8;
      const pt = jaw(tt);
      const w = 0.075 * (1 - tt * 0.42);
      const h = 0.115 * (1 - tt * 0.38);
      ctx.beginPath();
      ctx.moveTo(pt.x - w * 0.5, pt.y);
      ctx.lineTo(pt.x + w * 0.5, pt.y);
      ctx.lineTo(pt.x + w * 0.1, pt.y + h);
      ctx.closePath();
      ctx.fillStyle = '#f4fbff';
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = c.dark;
      ctx.lineWidth = 0.012;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Nostril, one per side, just above the front of the lip.
    ctx.globalAlpha = 0.55;
    dot(ctx, 1.90, -0.06, 0.026, c.outline);
    ctx.globalAlpha = 1;

    // 8. Small, high-set eye under a heavy brow. A meg did not hunt by sight.
    const eyeX = 1.42;
    const eyeY = -0.28;
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY, 0.062, 0.054, 0.1, 0, TAU);
    ctx.fillStyle = '#d8f2fb';
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.018;
    ctx.stroke();
    dot(ctx, eyeX + 0.006, eyeY, 0.04, '#040d14');
    dot(ctx, eyeX + 0.024, eyeY - 0.018, 0.013, '#ffffff');

    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.moveTo(eyeX - 0.15, eyeY - 0.09);
    ctx.quadraticCurveTo(eyeX, eyeY - 0.17, eyeX + 0.16, eyeY - 0.06);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 9. Near pectoral: long, broad and swept back, the way a white's is, but
    // it stays clear of the tail so the two never read as one spike.
    ctx.save();
    ctx.translate(0.70, 0.16);
    ctx.rotate(0.44 + Math.sin(f.phase * 0.9) * 0.08 * swim);
    ctx.beginPath();
    ctx.moveTo(0.05, 0);
    ctx.bezierCurveTo(0.05, 0.24, -0.10, 0.48, -0.30, 0.64);
    ctx.bezierCurveTo(-0.36, 0.42, -0.22, 0.16, -0.04, 0.02);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.04, 0.6);

    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.034;
    ctx.beginPath();
    ctx.moveTo(0.02, 0.05);
    ctx.lineTo(-0.24, 0.56);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ---------------------------------------------------------------------
  // 8. Orca (Killer Whale) — iconic black-and-white apex predator.
  //    Authentic saddle patch, eye patch, tall dorsal, horizontal flukes.
  // ---------------------------------------------------------------------
  function drawOrca(ctx, f) {
    const c = f.colors || A.ORCA.palette;
    const swim = A.clamp(f.swim || 0.45, 0.1, 1.4);
    // Turn rate arrives pre-computed from the AI: a 350px animal rolls into a
    // bend instead of pivoting flat like a reef fish.
    const bank = A.clamp(f.bank || 0, -1, 1);
    // Primary tail sweep — whole caudal assembly rotates at peduncle
    const wig = Math.sin(f.phase) * (0.17 + 0.23 * swim);
    // Secondary fluke blade flexes at tip, a half-beat behind
    const wig2 = Math.sin(f.phase - 0.55) * (0.10 + 0.13 * swim);
    // The skull is rigid, so the torso pitches as the tail drives: the head
    // lifts on the downstroke. Without it the whale looks like a sliding box.
    const pitch = Math.sin(f.phase - 0.9) * 0.03 * swim;

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.save();
    ctx.rotate(pitch);

    // ── 1. FAR PECTORAL FIN (broad rounded flipper, behind body) ──
    ctx.save();
    ctx.translate(0.28, 0.14);
    ctx.rotate(-0.32 - Math.sin(f.phase * 0.9) * 0.06 + bank * 0.10);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-0.16, -0.28, -0.48, -0.52, -0.74, -0.58);
    ctx.bezierCurveTo(-0.56, -0.32, -0.32, -0.14, -0.08, -0.04);
    ctx.closePath();
    ctx.fillStyle = c.dark;
    ctx.globalAlpha = 0.45;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // ── 2. CAUDAL TAIL ASSEMBLY (rotates at peduncle hinge -0.85) ──
    ctx.save();
    ctx.translate(-0.85, 0);
    ctx.rotate(wig);

    // Peduncle body (taper)
    const peduncle = function () {
      ctx.beginPath();
      ctx.moveTo(0.12, -0.28);
      ctx.lineTo(-0.72, -0.09);
      ctx.lineTo(-0.72, 0.09);
      ctx.lineTo(0.12, 0.28);
      ctx.closePath();
    };
    peduncle();
    ctx.fillStyle = c.body;
    ctx.fill();

    // Peduncle counter-shade belly strip
    ctx.save();
    peduncle();
    ctx.clip();
    ctx.fillStyle = c.belly;
    ctx.beginPath();
    ctx.moveTo(0.12, 0.04);
    ctx.bezierCurveTo(-0.3, 0.04, -0.65, 0.06, -0.72, 0.09);
    ctx.lineTo(-0.72, 0.18 + bank * 0.05);
    ctx.lineTo(0.12, 0.30);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Flukes. Real ones are horizontal, so in side view they read as two
    // blades that open and close as the animal rolls through a turn: banking
    // stretches the near lobe and hides the far one behind it.
    ctx.save();
    ctx.translate(-0.65, 0);
    ctx.rotate(wig2);

    // Far lobe — dimmed, compressed by roll
    const farTip = 0.50 * (1 - Math.abs(bank) * 0.42) * (1 + bank * 0.16);
    ctx.globalAlpha = 0.62;
    ctx.beginPath();
    ctx.moveTo(0.05, 0.02);
    ctx.bezierCurveTo(-0.26, 0.10, -0.50, 0.26, -0.76, farTip);
    ctx.bezierCurveTo(-0.56, 0.30, -0.30, 0.14, -0.08, 0.06);
    ctx.closePath();
    ctx.fillStyle = c.dark;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Near lobe — long, swept, notched where it meets the stock
    const nearTip = 0.92 * (1 + bank * 0.30);
    ctx.beginPath();
    ctx.moveTo(0.05, 0);
    ctx.bezierCurveTo(-0.14, -0.18, -0.44, -0.72, -0.88, -nearTip);
    ctx.bezierCurveTo(-0.76, -0.72, -0.68, -0.58, -0.74, -0.46); // notch
    ctx.bezierCurveTo(-0.52, -0.22, -0.26, -0.08, -0.1, 0);
    ctx.bezierCurveTo(-0.24, 0.06, -0.30, 0.12, -0.28, 0.18);
    ctx.bezierCurveTo(-0.16, 0.10, -0.02, 0.04, 0.05, 0);
    ctx.closePath();
    ctx.fillStyle = c.body;
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.028;
    ctx.stroke();

    ctx.restore(); // fluke blade
    ctx.restore(); // tail assembly

    // ── 3. TALL ICONIC DORSAL FIN ──
    // A mature male's dorsal is tall, straight and slightly falcate. The tip
    // leans into whichever way the animal is rolling.
    const tipX = -0.12 + bank * 0.40;
    const tipY = -1.68 * (1 - Math.abs(bank) * 0.08);
    ctx.beginPath();
    ctx.moveTo(0.18, -0.52);
    ctx.bezierCurveTo(0.10, -0.92, tipX * 0.30 - 0.02, tipY * 0.82, tipX, tipY);
    ctx.bezierCurveTo(tipX + 0.02, -1.30, -0.26, -1.05, -0.46, -0.72);
    ctx.lineTo(-0.54, -0.46);
    ctx.quadraticCurveTo(-0.16, -0.56, 0.18, -0.52);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.032;
    ctx.stroke();

    // Leading-edge specular line, following the new tip
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 0.028;
    ctx.beginPath();
    ctx.moveTo(0.14, -0.56);
    ctx.lineTo(tipX * 0.85, tipY * 0.90);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // ── 4. MAIN BODY (torpedo cylinder, tapers to nose & peduncle) ──
    const bodyPath = function () {
      ctx.beginPath();
      // Head/rostrum: blunt rounded snout
      ctx.moveTo(2.42, -0.04);
      ctx.bezierCurveTo(2.28, -0.32, 1.85, -0.54, 1.10, -0.62);
      ctx.bezierCurveTo(0.28, -0.70, -0.42, -0.56, -0.88, -0.26);
      ctx.quadraticCurveTo(-1.06, -0.12, -1.00, 0.05);
      ctx.bezierCurveTo(-0.60, 0.36, 0.14, 0.56, 0.96, 0.56);
      ctx.bezierCurveTo(1.74, 0.54, 2.24, 0.30, 2.42, -0.04);
      ctx.closePath();
    };

    bodyPath();
    ctx.fillStyle = c.body;
    ctx.fill();

    // Clip interior details inside body
    ctx.save();
    bodyPath();
    ctx.clip();

    // ── WHITE BELLY COUNTER-SHADING (the orca's white underside) ──
    // Extends from lower jaw throat all the way back under belly. Rolling
    // toward the camera shows more of it, rolling away hides it.
    const bs = bank * 0.07;
    ctx.fillStyle = c.belly;
    ctx.beginPath();
    ctx.moveTo(-1.02, 0.08 + bs);
    ctx.bezierCurveTo(-0.60, 0.20 + bs, 0.10, 0.36 + bs, 0.85, 0.34 + bs);
    ctx.bezierCurveTo(1.44, 0.32 + bs, 2.0, 0.18 + bs, 2.42, -0.04);
    ctx.lineTo(2.5, 0.80);
    ctx.lineTo(-1.10, 0.80);
    ctx.closePath();
    ctx.fill();

    // ── GREY SADDLE PATCH (behind dorsal fin) ──
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = c.belly;
    ctx.beginPath();
    // Saddle is a rounded pale patch just behind/below the dorsal base
    ctx.ellipse(-0.30, -0.40, 0.52, 0.26, 0.12, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    // ── DORSAL SURFACE HIGHLIGHT ──
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 0.07;
    ctx.beginPath();
    ctx.moveTo(1.80, -0.32);
    ctx.bezierCurveTo(1.10, -0.56, 0.30, -0.62, -0.50, -0.46);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // ── THROAT GROOVES (expand when the whale swallows) ──
    ctx.globalAlpha = 0.20;
    ctx.strokeStyle = c.dark;
    ctx.lineWidth = 0.022;
    for (let g = 0; g < 3; g++) {
      ctx.beginPath();
      ctx.moveTo(1.62 + g * 0.20, 0.24 + bs * 0.6);
      ctx.quadraticCurveTo(1.86 + g * 0.20, 0.40 + bs, 2.16 + g * 0.16, 0.30 + bs * 0.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.restore(); // body clip

    // Body perimeter outline
    bodyPath();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.052;
    ctx.stroke();

    // ── 5. NEAR PECTORAL FIN (large paddle-shaped flipper) ──
    // Orcas row with their flippers while manoeuvring, so the stroke is
    // phase-locked to the tail but a half-beat behind it.
    ctx.save();
    ctx.translate(0.38, 0.30);
    const flipFlex = 0.26 + Math.sin(f.phase * 0.8 + 0.5) * (0.09 + 0.15 * swim) - bank * 0.12;
    ctx.rotate(flipFlex);
    ctx.beginPath();
    ctx.moveTo(0.06, 0);
    // Long broad leading edge
    ctx.bezierCurveTo(0.26, 0.18, 0.52, 0.52, 0.66, 0.88);
    // Rounded paddle tip
    ctx.bezierCurveTo(0.42, 0.80, 0.14, 0.60, -0.04, 0.32);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.032;
    ctx.stroke();
    // Fibrous ridge along the leading edge
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 0.028;
    ctx.beginPath();
    ctx.moveTo(0.10, 0.04);
    ctx.lineTo(0.58, 0.82);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();

    // ── 6. WHITE EYE PATCH (distinctive orca marking) ──
    // Large white oval patch just behind and above the eye
    ctx.globalAlpha = 0.96;
    ctx.fillStyle = c.belly;
    ctx.beginPath();
    ctx.ellipse(1.38, -0.26 - bank * 0.02, 0.19, 0.13, 0.35 + bank * 0.10, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    // ── 7. EYE ──
    const eyeX = 1.58;
    const eyeY = -0.22;
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY, 0.085, 0.072, 0.1, 0, TAU);
    ctx.fillStyle = c.accent;
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.022;
    ctx.stroke();
    // The pupil drifts toward whatever the whale is looking at
    const look = A.clamp((f.targetAngle != null ? A.angleDiff(f.angle, f.targetAngle) : 0) * 0.6, -0.4, 0.4);
    dot(ctx, eyeX + 0.01 + look * 0.02, eyeY, 0.048, c.dark);
    dot(ctx, eyeX + 0.028, eyeY - 0.022, 0.018, '#ffffff');

    // ── 8. MOUTH LINE (subtle, near rounded rostrum tip) ──
    ctx.beginPath();
    ctx.moveTo(2.38, 0.04);
    ctx.quadraticCurveTo(2.1, 0.22 + bs * 0.5, 1.72, 0.24 + bs * 0.5);
    ctx.strokeStyle = c.dark;
    ctx.lineWidth = 0.038;
    ctx.stroke();

    // White lower jaw / chin patch
    ctx.globalAlpha = 0.90;
    ctx.fillStyle = c.belly;
    ctx.beginPath();
    ctx.ellipse(2.14, 0.18 + bs * 0.5, 0.28, 0.10 + Math.abs(bs) * 0.2, -0.1, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    // ── 9. BLOWHOLE ── low oval on the back, just ahead of the dorsal
    ctx.save();
    ctx.translate(1.06, -0.60);
    ctx.rotate(-0.18);
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.14, 0.05, 0, 0, TAU);
    ctx.fillStyle = c.dark;
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 0.022;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();

    ctx.restore(); // body pitch
  }

  // ---------------------------------------------------------------------
  // 9. Anglerfish — a ceratioid from the midnight zone. Almost all head: a
  //    jaw that takes up the front of the body, long recurved fangs, a small
  //    hard eye under a heavy brow, tattered pale fins, and a lure that throws
  //    real light onto the water around it.
  // ---------------------------------------------------------------------
  // The closed-jaw seam, as a quadratic from the lip at the snout back to the
  // hinge at the throat. The fangs sit on it so the tooth row and the dark
  // gash can never drift apart.
  const JAW = { x0: 1.0, y0: -0.2, cx: 0.6, cy: 0.44, x1: -0.02, y1: 0.68 };

  function jawPoint(t) {
    const u = 1 - t;
    return {
      x: u * u * JAW.x0 + 2 * u * t * JAW.cx + t * t * JAW.x1,
      y: u * u * JAW.y0 + 2 * u * t * JAW.cy + t * t * JAW.y1
    };
  }

  // Skin growths and the belly photophore row, in unit space.
  const WARTS = [
    [0.34, -0.66, 0.042], [0.02, -0.78, 0.05], [-0.3, -0.72, 0.038],
    [-0.58, -0.52, 0.046], [-0.78, -0.24, 0.034], [0.5, -0.5, 0.03],
    [-0.1, -0.52, 0.032], [-0.44, 0.62, 0.04], [-0.72, 0.36, 0.034],
    [0.16, 0.86, 0.036]
  ];
  const BELLY_LIGHTS = [
    [0.62, 0.86], [0.4, 1.0], [0.12, 1.06], [-0.16, 1.05],
    [-0.44, 0.96], [-0.68, 0.8], [-0.86, 0.54], [-0.96, 0.28]
  ];

  function drawAngler(ctx, f) {
    const c = f.colors;
    const swim = A.clamp(f.swim || 0.4, 0.1, 1.4);
    const wig = Math.sin(f.phase) * (0.09 + 0.15 * swim);
    // The rod is a fishing line, not bone: it lags a beat behind the body so
    // the esca swings over the mouth as the fish turns.
    const rod = Math.sin(f.phase - 0.75) * (0.05 + 0.1 * swim);
    const flare = A.clamp(f.lure || 0, 0, 1);
    const pulse = 0.58 + Math.sin(f.phase * 1.7) * 0.16 + flare * 0.42;

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // 1. Caudal fin — small, ragged, half-transparent. It is a rudder, not an
    //    engine; this animal waits.
    ctx.save();
    ctx.translate(-0.98, 0.14);
    ctx.rotate(wig);
    ctx.beginPath();
    ctx.moveTo(0.1, -0.12);
    ctx.bezierCurveTo(-0.16, -0.4, -0.5, -0.5, -0.66, -0.32);
    ctx.quadraticCurveTo(-0.5, -0.2, -0.58, -0.04);
    ctx.quadraticCurveTo(-0.44, 0.06, -0.56, 0.24);
    ctx.bezierCurveTo(-0.4, 0.48, -0.12, 0.42, 0.1, 0.12);
    ctx.closePath();
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = c.fin;
    ctx.fill();
    ctx.globalAlpha = 1;
    finStroke(ctx, c, 0.026, 0.35);
    ctx.globalAlpha = 0.26;
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.016;
    for (let i = 0; i < 4; i++) {
      const a = Math.PI + (-0.62 + i * 0.41);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 0.58, Math.sin(a) * 0.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // 2. Dorsal — a stubby spine-set sail pinned far back on the hump.
    ctx.beginPath();
    ctx.moveTo(-0.18, -0.8);
    ctx.quadraticCurveTo(-0.42, -1.08, -0.74, -0.74);
    ctx.quadraticCurveTo(-0.46, -0.8, -0.18, -0.8);
    ctx.closePath();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = c.fin;
    ctx.fill();
    ctx.globalAlpha = 1;
    finStroke(ctx, c, 0.024, 0.35);

    // 3. Far pectoral, held out behind the head.
    ctx.save();
    ctx.translate(-0.16, -0.2);
    ctx.rotate(-0.62 + Math.sin(f.phase * 1.2) * 0.14);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-0.24, -0.16, -0.46, -0.1, -0.56, 0.12);
    ctx.bezierCurveTo(-0.36, 0.16, -0.16, 0.12, 0, 0.06);
    ctx.closePath();
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = c.fin;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // The whole front of the animal is jaw. The outline drops almost straight
    // down from the top of the snout, so the head reads as a hook rather than
    // the nose of a normal fish.
    const body = function () {
      ctx.beginPath();
      ctx.moveTo(1.0, -0.2);
      ctx.bezierCurveTo(1.08, 0.1, 0.98, 0.5, 0.72, 0.78);
      ctx.bezierCurveTo(0.4, 1.1, -0.12, 1.14, -0.52, 0.96);
      ctx.bezierCurveTo(-0.84, 0.82, -1.02, 0.5, -1.04, 0.14);
      ctx.bezierCurveTo(-1.06, -0.26, -0.86, -0.62, -0.42, -0.8);
      ctx.bezierCurveTo(0.04, -0.98, 0.56, -0.9, 0.84, -0.62);
      ctx.bezierCurveTo(0.96, -0.5, 1.0, -0.36, 1.0, -0.2);
      ctx.closePath();
    };

    body();
    ctx.fillStyle = c.body;
    ctx.fill();

    ctx.save();
    body();
    ctx.clip();

    // Heavy mantle over the back, fading to nothing at the belly.
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = c.dark;
    ctx.beginPath();
    ctx.ellipse(-0.16, -0.86, 1.14, 0.44, 0.05, 0, TAU);
    ctx.fill();

    // The pale bone of the lower jaw, slabbed under the gape line.
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = c.belly;
    ctx.beginPath();
    ctx.moveTo(1.04, -0.1);
    ctx.quadraticCurveTo(0.6, 0.5, -0.02, 0.7);
    ctx.lineTo(-0.1, 1.2);
    ctx.lineTo(1.1, 1.2);
    ctx.closePath();
    ctx.fill();

    // Loose, baggy skin hanging off the hump.
    ctx.globalAlpha = 0.26;
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.03;
    for (let i = 0; i < 5; i++) {
      const x = 0.44 - i * 0.3;
      ctx.beginPath();
      ctx.moveTo(x, -0.66);
      ctx.quadraticCurveTo(x - 0.12, -0.12, x - 0.02, 0.42);
      ctx.stroke();
    }

    // Skin warts — the ceratioid signature, and the reason the hide looks
    // diseased rather than varnished.
    ctx.globalAlpha = 1;
    for (let i = 0; i < WARTS.length; i++) {
      const w = WARTS[i];
      ctx.beginPath();
      ctx.ellipse(w[0], w[1], w[2], w[2] * 0.82, 0, 0, TAU);
      ctx.fillStyle = c.dark;
      ctx.fill();
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(w[0] - w[2] * 0.3, w[1] - w[2] * 0.4, w[2] * 0.42, 0, TAU);
      ctx.fillStyle = c.belly;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Light from the lure falling across the top of the head.
    ctx.globalAlpha = 0.12 + pulse * 0.16;
    ctx.fillStyle = c.glow;
    ctx.beginPath();
    ctx.ellipse(0.56, -0.66, 0.52, 0.24, -0.42, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    body();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.05;
    ctx.stroke();

    // 4. Light organs along the belly — the family signature, dim and cold.
    for (let i = 0; i < BELLY_LIGHTS.length; i++) {
      const b = BELLY_LIGHTS[i];
      const g = 0.4 + Math.sin(f.phase * 2.1 + i * 1.3) * 0.3;
      softDot(ctx, b[0], b[1], 0.055, c.accent, 0.24 * g);
      softDot(ctx, b[0], b[1], 0.02, '#e9fffb', 0.75 * g);
    }

    // 5. The gash. Almost the entire front of the animal is mouth, and it is
    //    hinged at the throat well behind the eye.
    ctx.beginPath();
    ctx.moveTo(1.0, -0.2);
    ctx.quadraticCurveTo(0.6, 0.44, -0.02, 0.68);
    ctx.strokeStyle = '#010206';
    ctx.lineWidth = 0.085;
    ctx.stroke();

    // 6. Fangs. Long, sparse and recurved, with dark gaps between them — a
    //    cage, not a saw blade. They fade out while the shared gape overlay
    //    owns the jaw, so a chomp never shows two sets of teeth.
    const open = biteOpen(f);
    const toothFade = 1 - open * 0.92;
    if (toothFade > 0.02) {
      ctx.globalAlpha = toothFade;
      ctx.fillStyle = '#eaf6ff';
      for (let i = 0; i < 10; i++) {
        const t = (i + 0.5) / 10;
        const p = jawPoint(t);
        // Front fangs are the long ones; the row shrinks toward the throat.
        const L = (0.46 - Math.abs(t - 0.18) * 0.42) * (0.9 + 0.1 * Math.sin(i * 2.7));
        ctx.beginPath();
        ctx.moveTo(p.x + 0.042, p.y - 0.05);
        ctx.quadraticCurveTo(p.x + 0.03, p.y + L * 0.5, p.x - 0.075, p.y + L);
        ctx.quadraticCurveTo(p.x - 0.02, p.y + L * 0.42, p.x - 0.034, p.y - 0.05);
        ctx.closePath();
        ctx.fill();

        const q = jawPoint(t + 0.5 / 10);
        const Ll = L * 0.66;
        ctx.beginPath();
        ctx.moveTo(q.x - 0.036, q.y + 0.07);
        ctx.quadraticCurveTo(q.x - 0.026, q.y - Ll * 0.45, q.x + 0.062, q.y - Ll);
        ctx.quadraticCurveTo(q.x + 0.03, q.y - Ll * 0.35, q.x + 0.03, q.y + 0.07);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // 7. Eye — small, hard and buried in the socket. A pale gold disc with a
    //    slit pupil under a brow that eats the top third of it.
    ctx.beginPath();
    ctx.moveTo(0.26, -0.62);
    ctx.quadraticCurveTo(0.6, -0.72, 0.84, -0.48);
    ctx.quadraticCurveTo(0.62, -0.52, 0.26, -0.44);
    ctx.closePath();
    ctx.fillStyle = '#010205';
    ctx.fill();

    softDot(ctx, 0.56, -0.44, 0.26, c.accent, 0.1 + pulse * 0.08);
    ctx.beginPath();
    ctx.arc(0.56, -0.44, 0.115, 0, TAU);
    ctx.fillStyle = '#d8b84a';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0.56, -0.44, 0.115, 0, TAU);
    ctx.strokeStyle = '#0a0c10';
    ctx.lineWidth = 0.026;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0.56, -0.44, 0.062, 0, TAU);
    ctx.fillStyle = '#f0d97e';
    ctx.fill();
    // Slit pupil, so the eye reads as a predator rather than a cartoon.
    ctx.beginPath();
    ctx.ellipse(0.575, -0.44, 0.026, 0.088, 0.12, 0, TAU);
    ctx.fillStyle = '#04060a';
    ctx.fill();
    dot(ctx, 0.51, -0.49, 0.024, 'rgba(240,255,252,0.9)');

    // 8. Near pectoral — pale, frilled, paddling slowly. It sits behind the
    //    jaw hinge, because there is no shoulder in front of it.
    ctx.save();
    ctx.translate(0.02, 0.62);
    ctx.rotate(0.78 + Math.sin(f.phase * 1.15) * 0.24);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(0.24, -0.06, 0.44, 0.08, 0.52, 0.3);
    ctx.bezierCurveTo(0.32, 0.26, 0.12, 0.16, 0, 0.08);
    ctx.closePath();
    ctx.globalAlpha = 0.44;
    ctx.fillStyle = c.fin;
    ctx.fill();
    ctx.globalAlpha = 1;
    finStroke(ctx, c, 0.024, 0.4);
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.014;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0.02);
      ctx.lineTo(0.09 + i * 0.11, 0.09 + i * 0.055);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // 9. Iliac filaments — two loose rods trailing under the belly.
    ctx.strokeStyle = c.fin;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 0.026;
    for (let i = 0; i < 2; i++) {
      const bx = -0.3 - i * 0.2;
      const sway = Math.sin(f.phase * 1.1 + i * 1.4) * 0.12;
      ctx.beginPath();
      ctx.moveTo(bx, 0.92);
      ctx.quadraticCurveTo(bx - 0.12 + sway, 1.16, bx - 0.3 + sway * 1.7, 1.34);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 10. Illicium and esca — the rod, and the light that does the hunting.
    //     It hangs over the gape, so the only thing a small fish sees in the
    //     dark is the bulb, and then the teeth.
    ctx.save();
    ctx.translate(0.66, -0.74);
    ctx.rotate(rod);

    const tipX = 0.26;
    const tipY = -0.56;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(0.16, -0.22, 0.14, -0.44, tipX, tipY);
    ctx.strokeStyle = c.dark;
    ctx.lineWidth = 0.05;
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 0.018;
    ctx.stroke();
    ctx.globalAlpha = 1;

    const er = 0.12 + flare * 0.06;
    const halo = er * (7 + pulse * 5 + flare * 6);
    ctx.globalAlpha = 0.2 + pulse * 0.2 + flare * 0.32;
    ctx.drawImage(A.glowSprite('#c4fff6'), tipX - halo / 2, tipY - halo / 2, halo, halo);
    ctx.globalAlpha = 1;

    softDot(ctx, tipX, tipY, er * 2.4, '#7ef0e0', 0.26 + flare * 0.2);
    softDot(ctx, tipX, tipY, er * 1.3, '#eafffb', 0.7 + flare * 0.25);
    softDot(ctx, tipX, tipY, er * 0.78, '#ffffff', 0.95);
    dot(ctx, tipX, tipY, er * 0.4, '#ffffff');

    // The bulb throws off motes of light, like a spark coming adrift.
    ctx.fillStyle = '#d8fffa';
    for (let i = 0; i < 8; i++) {
      const a = f.phase * 0.7 + i * 0.79;
      const d = er * (1.6 + ((Math.sin(a * 1.7) + 1) * 1.5));
      ctx.globalAlpha = 0.18 + Math.max(0, Math.sin(a * 2.3)) * 0.55;
      ctx.beginPath();
      ctx.arc(tipX + Math.cos(a) * d, tipY + Math.sin(a * 1.3) * d * 0.85, 0.014 + (i % 4) * 0.009, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // A shallow cone of lure-light down into the open mouth.
    ctx.save();
    ctx.globalAlpha = 0.1 + pulse * 0.07 + flare * 0.12;
    ctx.fillStyle = c.glow;
    ctx.beginPath();
    ctx.moveTo(0.86, -1.24);
    ctx.lineTo(1.14, -0.16);
    ctx.lineTo(0.3, 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------------
  // 11. Octopus — soft-bodied cephalopod: a bulbous mantle trailing behind
  //     a blocky head, one stalked eye with a horizontal slit pupil, eight
  //     tapered arms with double rows of suckers, and a siphon for the jet.
  // ---------------------------------------------------------------------
  function drawOctopus(ctx, f) {
    const c = f.colors;
    const swim = A.clamp(f.swim || 0.45, 0.12, 1.4);
    const Q = Math.PI / 2;
    // The chromatophores empty during a discharge: the animal goes pale and
    // mottled white for as long as the cloud is still in the water.
    const flush = A.clamp(f.inkFlush || 0, 0, 1);
    const breathe = Math.sin(f.phase * 0.55) * 0.045;

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // One arm, sampled as a walking heading so the wave travels outward from
    // the crown the way it does on a real arm.
    const arm = function (bx, by, dir, len, wob, curl, w0, col, alpha, showSuckers) {
      const N = 9;
      const cs = [];
      let x = bx, y = by, a = dir;
      const step = len / N;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        cs.push({ x: x, y: y, a: a, w: w0 * (1 - t * 0.88) });
        a += (Math.sin(wob + i * 0.78) * (0.16 + 0.16 * swim) + curl) * t;
        x += Math.cos(a) * step;
        y += Math.sin(a) * step;
      }

      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const p = cs[i];
        const px = Math.cos(p.a + Q) * p.w;
        const py = Math.sin(p.a + Q) * p.w;
        if (i === 0) ctx.moveTo(p.x + px, p.y + py); else ctx.lineTo(p.x + px, p.y + py);
      }
      const tip = cs[N];
      ctx.lineTo(tip.x + Math.cos(tip.a) * w0 * 0.5, tip.y + Math.sin(tip.a) * w0 * 0.5);
      for (let i = N; i >= 0; i--) {
        const p = cs[i];
        ctx.lineTo(p.x - Math.cos(p.a + Q) * p.w, p.y - Math.sin(p.a + Q) * p.w);
      }
      ctx.closePath();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = col;
      ctx.fill();

      if (showSuckers) {
        for (let i = 2; i <= N; i++) {
          const p = cs[i];
          const r = Math.max(0.012, p.w * 0.3);
          const sx = Math.cos(p.a + Q) * p.w * 0.42;
          const sy = Math.sin(p.a + Q) * p.w * 0.42;
          dot(ctx, p.x + sx, p.y + sy, r, c.belly);
          dot(ctx, p.x - sx, p.y - sy, r * 0.82, c.belly);
        }
      }
      ctx.globalAlpha = 1;
    };

    // 1. The four far arms: shorter on screen, darker, no suckers readable.
    const farDirs = [-1.0, -0.3, 0.45, 1.15];
    const farLens = [1.18, 1.5, 1.62, 1.24];
    for (let i = 0; i < 4; i++) {
      arm(0.34 + i * 0.02, 0.14, farDirs[i], farLens[i],
        f.phase * 0.85 + i * 1.4, 0.16, 0.15, c.dark, 0.55, false);
    }

    // 2. The mantle: an egg with the wide end forward and a blunt tip back.
    const mantle = function () {
      ctx.beginPath();
      ctx.moveTo(0.3, -0.02);
      ctx.bezierCurveTo(0.26, -0.5, 0.02, -0.82, -0.5, -0.88 - breathe);
      ctx.bezierCurveTo(-1.06, -0.92, -1.52, -0.6, -1.68, -0.12);
      ctx.quadraticCurveTo(-1.74, 0.06, -1.6, 0.2);
      ctx.bezierCurveTo(-1.34, 0.5, -0.86, 0.66, -0.3, 0.64);
      ctx.bezierCurveTo(0.06, 0.62, 0.26, 0.38, 0.3, -0.02);
      ctx.closePath();
    };

    mantle();
    ctx.fillStyle = flush > 0.02 ? mixTone(c.body, '#cdd8e2', flush * 0.6) : c.body;
    ctx.fill();

    ctx.save();
    mantle();
    ctx.clip();

    // Countershading: pale along the belly line, dark down the back.
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = c.dark;
    ctx.beginPath();
    ctx.ellipse(-0.62, -0.62, 1.16, 0.42, -0.06, 0, TAU);
    ctx.fill();

    ctx.globalAlpha = 0.85;
    ctx.fillStyle = c.belly;
    ctx.beginPath();
    ctx.moveTo(-1.62, 0.18);
    ctx.quadraticCurveTo(-0.9, 0.62, -0.1, 0.58);
    ctx.lineTo(0.2, 0.86);
    ctx.lineTo(-1.7, 0.86);
    ctx.closePath();
    ctx.fill();

    // Chromatophore mottling: the skin is a mosaic, not a colour.
    ctx.globalAlpha = 0.26;
    ctx.fillStyle = c.dark;
    for (let i = 0; i < 26; i++) {
      const rx = -1.6 + ((i * 137) % 100) / 100 * 1.9;
      const ry = -0.72 + ((i * 71) % 100) / 100 * 1.28;
      const rr = 0.05 + ((i * 37) % 13) / 100;
      ctx.beginPath();
      ctx.ellipse(rx, ry + Math.sin(f.phase * 0.4 + i) * 0.012, rr, rr * 0.72, 0.3, 0, TAU);
      ctx.fill();
    }

    // Papillae: the little muscular bumps an octopus roughens its skin with.
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = c.fin;
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      dot(ctx, -1.44 + t * 1.62, -0.72 + Math.sin(t * 3.1) * 0.1, 0.05 + t * 0.02, c.fin);
    }

    // Ridge running the length of the mantle.
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.moveTo(-1.42, -0.3);
    ctx.bezierCurveTo(-0.9, -0.62, -0.1, -0.6, 0.24, -0.2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();

    mantle();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.045;
    ctx.stroke();

    // 3. The head: a hard block behind the arm crown, joined to the mantle.
    const head = function () {
      ctx.beginPath();
      ctx.moveTo(0.06, -0.56);
      ctx.bezierCurveTo(0.5, -0.6, 0.82, -0.4, 0.9, -0.06);
      ctx.quadraticCurveTo(0.94, 0.2, 0.72, 0.36);
      ctx.bezierCurveTo(0.5, 0.52, 0.2, 0.56, 0.04, 0.46);
      ctx.quadraticCurveTo(-0.1, 0.18, 0.06, -0.56);
      ctx.closePath();
    };
    head();
    ctx.fillStyle = mixTone(c.body, c.fin, 0.35);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.04;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 4. The web between the arm bases — a soft bell under the crown.
    ctx.beginPath();
    ctx.moveTo(0.26, 0.2);
    ctx.quadraticCurveTo(0.86, 0.62, 1.5, 0.86);
    ctx.quadraticCurveTo(0.9, 0.28, 0.26, 0.2);
    ctx.closePath();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = c.fin;
    ctx.fill();
    ctx.globalAlpha = 1;

    // 5. The four near arms, drawn over the body so they read as in front.
    const nearDirs = [-0.62, 0.12, 0.78, 1.42];
    const nearLens = [1.42, 1.78, 1.66, 1.3];
    for (let i = 0; i < 4; i++) {
      arm(0.42, 0.16 + i * 0.03, nearDirs[i], nearLens[i],
        f.phase * 0.85 + i * 1.4 + 0.7, 0.2, 0.17,
        mixTone(c.body, c.fin, 0.15), 0.97, true);
    }

    // 6. The siphon: the tube the jet and the ink both come out of.
    ctx.save();
    ctx.translate(0.62, -0.16);
    ctx.rotate(-0.5 + Math.sin(f.phase * 0.5) * 0.06);
    ctx.beginPath();
    ctx.moveTo(-0.04, -0.1);
    ctx.quadraticCurveTo(0.22, -0.13, 0.34, -0.03);
    ctx.quadraticCurveTo(0.22, 0.09, -0.04, 0.08);
    ctx.closePath();
    ctx.fillStyle = c.fin;
    ctx.fill();
    finStroke(ctx, c, 0.03, 0.55);
    if (flush > 0.02) {
      ctx.globalAlpha = flush * 0.7;
      dot(ctx, 0.32, 0.01, 0.05 + flush * 0.05, c.glow);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // 7. The eye on its stalk: a pale ring, a horizontal slit, a heavy brow.
    const eyeX = 0.44;
    const eyeY = -0.3;
    ctx.beginPath();
    ctx.ellipse(eyeX - 0.02, eyeY + 0.04, 0.24, 0.2, 0.1, 0, TAU);
    ctx.fillStyle = c.dark;
    ctx.globalAlpha = 0.5;
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY, 0.2, 0.17, 0.08, 0, TAU);
    ctx.fillStyle = '#eef9ff';
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.028;
    ctx.stroke();

    // Horizontal pupil - the tell that this is a cephalopod, not a fish.
    ctx.beginPath();
    ctx.ellipse(eyeX + 0.006, eyeY, 0.145, 0.05, 0.08, 0, TAU);
    ctx.fillStyle = '#0a0710';
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = c.glow;
    ctx.beginPath();
    ctx.ellipse(eyeX + 0.006, eyeY + 0.008, 0.145, 0.026, 0.08, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    dot(ctx, eyeX - 0.06, eyeY - 0.06, 0.032, '#ffffff');

    // Brow ridge over the eye.
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.moveTo(eyeX - 0.24, eyeY - 0.12);
    ctx.quadraticCurveTo(eyeX, eyeY - 0.26, eyeX + 0.24, eyeY - 0.08);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 8. The beak, tucked at the centre of the arm crown.
    ctx.beginPath();
    ctx.moveTo(0.5, 0.24);
    ctx.quadraticCurveTo(0.62, 0.16, 0.72, 0.26);
    ctx.quadraticCurveTo(0.62, 0.36, 0.5, 0.24);
    ctx.closePath();
    ctx.fillStyle = c.outline;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------------
  // Shared biting overlay.
  //
  // Every species draws its own closed mouth; this is what turns it into a
  // chomp. `f.bite` is a 1 -> 0 countdown set by game.js on the same frame the
  // eating sound fires, so the jaws are already wide when you hear the snap and
  // ease shut over the rest of the envelope.
  //
  // The hinge sits at the back corner of the jaw and the mouth opens toward the
  // snout; `rot` tilts the whole gape so species whose mouths point upward
  // still snap along their own jaw line.
  // ---------------------------------------------------------------------
  const MOUTHS = {
    blue: { x: 0.98, y: 0.06, len: 0.28, gape: 0.26, rot: -0.06, teeth: 0, cavity: '#3d1524' },
    coral: { x: 0.92, y: 0.1, len: 0.26, gape: 0.24, rot: 0.02, teeth: 0, cavity: '#4a1424' },
    fast: { x: 1.12, y: 0.02, len: 0.28, gape: 0.22, rot: -0.06, teeth: 0, cavity: '#331436' },
    hunter: { x: 1.0, y: 0.0, len: 0.38, gape: 0.3, rot: -0.24, teeth: 4, cavity: '#2a1140' },
    angler: { x: -0.02, y: 0.68, len: 1.35, gape: 0.62, rot: -0.37, teeth: 10, cavity: '#0d0716' },
    shark: { x: 1.18, y: 0.2, len: 0.66, gape: 0.34, rot: -0.24, teeth: 7, cavity: '#0b1720' },
    // The meg's mouth opens further than its own head is tall, and its teeth
    // are broad triangles rather than the needles every other shark gets.
    megalodon: { x: 1.16, y: 0.22, len: 0.84, gape: 0.62, rot: -0.14, teeth: 11, wide: true, cavity: '#0a1219' },
    sawshark: { x: 0.64, y: 0.13, len: 0.44, gape: 0.28, rot: -0.06, teeth: 6, cavity: '#0b1720' },
    orca: { x: 1.72, y: 0.24, len: 0.69, gape: 0.24, rot: -0.29, teeth: 6, cavity: '#05080c', pitch: true },
    // The beak is hidden at the centre of the arm crown, so the gape is small
    // and points down into the web rather than forward like a fish's.
    octopus: { x: 0.52, y: 0.3, len: 0.3, gape: 0.24, rot: 0.42, teeth: 0, cavity: '#25091c' }
  };

  // `bite` is a 1 -> 0 countdown. It snaps wide over the first fifth — that is
  // the frame the chomp sound lands on — then eases shut over the rest.
  function biteOpen(f) {
    const b = f.bite || 0;
    if (b <= 0) return 0;
    return b > 0.8 ? (1 - b) * 5 : b / 0.8;
  }

  function drawGape(ctx, f) {
    const m = MOUTHS[f.art];
    if (!m || !f.bite || f.bite <= 0) return;
    const open = biteOpen(f);
    if (open <= 0.02) return;

    const c = f.colors || {};
    const L = m.len;
    const drop = m.gape * open;

    ctx.save();
    // drawOrca draws inside a body-pitch rotation that is gone by the time it
    // returns, so the overlay has to sit back inside it.
    if (m.pitch) {
      ctx.rotate(Math.sin(f.phase - 0.9) * 0.03 * A.clamp(f.swim || 0.45, 0.1, 1.4));
    }
    ctx.translate(m.x, m.y);
    ctx.rotate(m.rot);
    ctx.lineJoin = 'round';

    // The cavity between the two jaws.
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(L * 0.5, -m.gape * 0.3, L, -m.gape * 0.12);
    ctx.lineTo(L, drop * 0.5);
    ctx.quadraticCurveTo(L * 0.5, drop, 0, 0);
    ctx.closePath();
    ctx.fillStyle = m.cavity;
    ctx.fill();

    // Tongue on the floor of the jaw.
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#5e2a44';
    ctx.beginPath();
    ctx.ellipse(L * 0.42, drop * 0.6, L * 0.26, drop * 0.16, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Lips: the upper jaw holds, the lower one swings down.
    ctx.strokeStyle = c.outline || '#08131c';
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(L * 0.5, -m.gape * 0.3, L, -m.gape * 0.12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(L * 0.5, drop, L, drop * 0.5);
    ctx.stroke();

    // Fangs riding each jaw. Along these curves x is exactly L * t.
    if (m.teeth) {
      ctx.fillStyle = '#e8f6ff';
      for (let i = 0; i < m.teeth; i++) {
        const t = (i + 0.5) / m.teeth;
        const x = L * t;
        const uy = -m.gape * (0.6 * t * (1 - t) + 0.12 * t * t);
        const ly = drop * (2 * t * (1 - t) + 0.5 * t * t);
        const len = m.gape * (m.wide ? 0.42 : 0.3) * (m.wide ? 1 - t * 0.34 : 1);
        const tw = m.wide ? 0.08 : 0.035;
        const th = m.wide ? 0.095 : 0.045;
        ctx.beginPath();
        ctx.moveTo(x, uy);
        ctx.lineTo(x + tw, uy);
        ctx.quadraticCurveTo(x, uy + len * 0.6, x - th, uy + len);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x, ly);
        ctx.lineTo(x - tw, ly);
        ctx.quadraticCurveTo(x, ly - len * 0.6, x + th, ly - len);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------
  // 12. Moon Jelly (Aurelia) — a bell, not a fish. Four gonads visible
  //     through a translucent dome, scalloped rim, fringe of marginal
  //     tentacles and four frilly oral arms. It pulses; it does not swim.
  // ---------------------------------------------------------------------
  function drawJellyfish(ctx, f) {
    const c = f.colors;

    // A jelly hangs mouth-downward under the water no matter which way the
    // current takes it, so undo the heading the dispatcher applied and keep
    // only the uniform radius scale.
    if (Math.cos(f.angle || 0) < 0) ctx.scale(1, -1);
    ctx.rotate(-(f.angle || 0));

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // The contraction flattens and widens the bell; the recovery rounds it up.
    const pulse = Math.sin(f.phase || 0);
    const bw = 0.86 * (1 + pulse * 0.13);
    const bh = 0.60 * (1 - pulse * 0.19);
    const rim = 0.12;

    // 1. Cold haze, so the animal warns you before it touches you.
    ctx.save();
    ctx.globalAlpha = 0.2;
    const haze = ctx.createRadialGradient(0, rim - bh * 0.3, 0.04, 0, rim - bh * 0.3, bw * 1.7);
    haze.addColorStop(0, c.glow);
    haze.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = haze;
    ctx.beginPath();
    ctx.arc(0, rim - bh * 0.3, bw * 1.7, 0, TAU);
    ctx.fill();
    ctx.restore();

    // 2. The bell: a shallow dome closing on a scalloped rim.
    const scallops = 8;
    const bell = function () {
      ctx.beginPath();
      ctx.moveTo(-bw, rim);
      ctx.bezierCurveTo(-bw * 1.02, rim - bh * 0.72, -bw * 0.6, rim - bh, 0, rim - bh);
      ctx.bezierCurveTo(bw * 0.6, rim - bh, bw * 1.02, rim - bh * 0.72, bw, rim);
      for (let i = 0; i < scallops; i++) {
        const t1 = 1 - i / scallops;
        const t2 = 1 - (i + 1) / scallops;
        const x1 = bw * (t1 * 2 - 1);
        const x2 = bw * (t2 * 2 - 1);
        const sag = 0.075 * (0.6 + 0.4 * Math.sin((i + 0.5) * 1.9));
        ctx.quadraticCurveTo((x1 + x2) * 0.5, rim + sag, x2, rim);
      }
      ctx.closePath();
    };

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = c.body;
    bell();
    ctx.fill();

    // Glassy dome highlight riding the upper left of the bell.
    ctx.save();
    bell();
    ctx.clip();
    ctx.globalAlpha = 0.55;
    const sheen = ctx.createLinearGradient(-bw * 0.5, rim - bh, bw * 0.4, rim);
    sheen.addColorStop(0, c.belly);
    sheen.addColorStop(0.55, 'rgba(255,255,255,0)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(-bw * 1.2, rim - bh * 1.2, bw * 2.4, bh * 1.6);
    ctx.restore();

    // 3. The four gonads - the clover that makes a moon jelly identifiable.
    ctx.globalAlpha = 0.62;
    ctx.fillStyle = c.fin;
    const gr = 0.14 * (1 - pulse * 0.08);
    for (let i = 0; i < 4; i++) {
      const a = i * (TAU / 4) + 0.785;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 0.24, rim - bh * 0.46 + Math.sin(a) * 0.19,
        gr, gr * 0.82, 0, 0, TAU);
      ctx.fill();
    }
    dot(ctx, 0, rim - bh * 0.46, 0.05, c.fin);

    // 4. Radial canals from the stomach to the margin.
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 0.016;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const ox = Math.cos(a) * bw * 0.94;
      const oy = rim - bh * 0.46 + Math.sin(a) * bh * 0.4;
      ctx.moveTo(Math.cos(a) * 0.1, rim - bh * 0.46 + Math.sin(a) * 0.08);
      ctx.quadraticCurveTo(ox * 0.55, (rim - bh * 0.46 + oy) * 0.5, ox, oy);
    }
    ctx.stroke();

    // 5. Rim outline and the mesoglea ring just inside it.
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 0.026;
    bell();
    ctx.stroke();

    ctx.globalAlpha = 0.34;
    ctx.strokeStyle = c.dark;
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.ellipse(0, rim - bh * 0.1, bw * 0.86, bh * 0.34, 0, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 6. Marginal tentacles: a fine fringe, each one waving on its own beat.
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 0.013;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    const fringe = 22;
    for (let i = 0; i < fringe; i++) {
      const t = i / (fringe - 1);
      const x = -bw * 0.98 + t * bw * 1.96;
      const len = (0.42 + 0.3 * Math.sin(t * 7 + f.phase * 0.4)) * (1 - Math.pow(Math.abs(t - 0.5) * 2, 3) * 0.45);
      const sway = Math.sin(f.phase * 0.6 + i * 0.8) * 0.09;
      ctx.moveTo(x, rim + 0.01);
      ctx.quadraticCurveTo(x + sway * 0.5, rim + len * 0.55, x + sway, rim + len);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 7. The four oral arms: frilly ribbons that trail from the mouth.
    for (let a2 = 0; a2 < 4; a2++) {
      const base = (a2 - 1.5) * 0.2;
      const wav = Math.sin(f.phase * 0.55 + a2 * 1.6);
      const drift = base + wav * 0.14;
      const drop = 1.05 + 0.22 * Math.sin(a2 * 2.1);

      ctx.beginPath();
      ctx.moveTo(base - 0.085, rim);
      ctx.quadraticCurveTo(drift - 0.12, rim + drop * 0.52, drift - 0.05 + wav * 0.08, rim + drop);
      ctx.quadraticCurveTo(drift + 0.03, rim + drop * 0.55, base + 0.085, rim);
      ctx.closePath();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = c.body;
      ctx.fill();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = c.accent;
      ctx.lineWidth = 0.014;
      ctx.stroke();

      // The ruffled edge real oral arms are made of.
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      for (let k = 1; k <= 4; k++) {
        const tk = k / 5;
        ctx.moveTo(base - 0.06 + drift * tk * 0.4, rim + drop * tk);
        ctx.lineTo(base + 0.06 + drift * tk * 0.4, rim + drop * tk + 0.03);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }


  const drawers = {
    blue: drawBlue,
    coral: drawCoral,
    fast: drawFast,
    hunter: drawHunter,
    shark: drawShark,
    manta: drawManta,
    sawshark: drawSawshark,
    megalodon: drawMegalodon,
    orca: drawOrca,
    octopus: drawOctopus,
    angler: drawAngler,
    jellyfish: drawJellyfish
  };

  const FishArt = {
    // `cheap` skips the ground-shadow pass; on low detail the ocean still reads
    // without ~60 extra save/scale/fill sequences per frame.
    draw: function (ctx, fish, time, cheap) {
      if (!fish || fish.radius <= 0.5) return;
      const r = fish.radius;
      const angle = fish.angle || 0;

      if (!fish.noShadow && !cheap) {
        ctx.save();
        ctx.translate(fish.x, fish.y + r * 0.42);
        ctx.scale(1, 0.34);
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#001018';
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.05, 0, TAU);
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(fish.x, fish.y);
      const facingLeft = Math.cos(angle) < 0;
      ctx.rotate(angle);
      if (facingLeft) ctx.scale(1, -1);
      ctx.scale(r, r);
      const fn = drawers[fish.art] || drawers.blue;
      fn(ctx, fish, time, cheap);
      drawGape(ctx, fish);
      ctx.restore();
    },

    drawPreview: function (canvas, stageIndex) {
      const stage = A.STAGES[stageIndex] || A.STAGES[0];
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const glow = ctx.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, w * 0.44);
      glow.addColorStop(0, 'rgba(120, 235, 255, 0.16)');
      glow.addColorStop(0.55, 'rgba(70, 160, 210, 0.07)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // Fit the animal to the card instead of drawing it at a fixed 30px:
      // the art is vector, so the bigger radius keeps every gill, tooth and
      // fin ray resolved at the card's real pixel density. The nose points
      // right and most tails hang left, so the centre shifts a hair right.
      const fish = {
        x: w / 2 + w * 0.015, y: h / 2 + h * 0.015, angle: -0.12,
        radius: Math.min(w * 0.26, h * 0.38),
        art: stage.art, colors: stage.palette,
        phase: 1.2, swim: 0.5, noShadow: false
      };
      this.draw(ctx, fish, 0);

      ctx.fillStyle = 'rgba(160, 235, 255, 0.18)';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(w * (0.2 + i * 0.29), h * (0.24 + (i % 2) * 0.5), 1.6 + i * 0.5, 0, TAU);
        ctx.fill();
      }
    }
  };

  A.FishArt = FishArt;
})();
