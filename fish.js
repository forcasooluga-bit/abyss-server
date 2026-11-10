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

  const drawers = {
    blue: drawBlue,
    coral: drawCoral,
    fast: drawFast,
    hunter: drawHunter,
    shark: drawShark
  };

  const FishArt = {
    draw: function (ctx, fish, time) {
      if (!fish || fish.radius <= 0.5) return;
      const r = fish.radius;
      const angle = fish.angle || 0;

      if (!fish.noShadow) {
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
      fn(ctx, fish, time);
      ctx.restore();
    },

    drawPreview: function (canvas, stageIndex) {
      const stage = A.STAGES[stageIndex] || A.STAGES[0];
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const glow = ctx.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, w * 0.44);
      glow.addColorStop(0, 'rgba(120, 235, 255, 0.16)');
      glow.addColorStop(0.55, 'rgba(70, 160, 210, 0.07)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      const fish = {
        x: w / 2, y: h / 2 + 2, angle: -0.12,
        radius: Math.min(w * 0.24, 30),
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
