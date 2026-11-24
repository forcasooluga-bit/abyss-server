/* ABYSS.IO — collection runtime.
   The cosmetic and companion half of the shop. Everything here is additive:
   it watches the slots js/shop.js owns, and when one of them has something in
   it, it paints that thing. Nothing in this file moves the player, changes a
   stat or touches the reef's arrays; the companion only ever highlights.

   Effects live in their own small particle list rather than the game's, so a
   kill flourish can never push a real bubble out of the simulation. */
(function () {
  'use strict';

  const A = window.ABYSS;
  if (!A) return;
  const TAU = A.TAU;

  const EVO_KEY = 'evo_abyssal_bloom';
  const KILL_KEY = 'kill_poseidon_wake';
  const LION_KEY = 'pet_lionfish';
  const TANG_KEY = 'pet_blue_tang';
  const VORTEX_KEY = 'evo_nebula_vortex';
  const RIFT_KEY = 'kill_rift_collapse';

  // ------------------------------------------------------------------
  // Small helpers
  // ------------------------------------------------------------------
  function qualityLow() {
    const g = A.game;
    return !!(g && g.quality < 0.9);
  }

  function activeSlot(name) {
    const shop = A.Shop;
    return shop && shop.activeSlot ? shop.activeSlot(name) : null;
  }

  const parts = [];
  const CAP = 170;

  function add(p) {
    if (parts.length >= CAP) parts.shift();
    parts.push(p);
  }

  // ------------------------------------------------------------------
  // Evolution effect — Abyssal Bloom
  // ------------------------------------------------------------------
  // A ring of bioluminescent petals unfurls around the new body, pearls drift
  // up out of the light and a crown of glow closes over it. Everything is
  // sized off the creature's new radius, so the same flourish frames a minnow
  // and a megalodon without ever filling the screen.
  function bloom(x, y, r) {
    const low = qualityLow();
    add({ k: 'flare', x: x, y: y, size: r * 0.9, grow: r * 3.4, color: '#8ef7e6', life: 1.0, maxLife: 1.0 });
    add({
      k: 'ring', x: x, y: y, r: r * 0.45, vr: r * 4.4,
      w: Math.max(1.6, r * 0.05), color: 'rgba(127,240,216,0.9)', life: 0.85, maxLife: 0.85
    });
    add({
      k: 'ring', x: x, y: y, r: r * 0.28, vr: r * 3.2,
      w: Math.max(1.2, r * 0.035), color: 'rgba(255,230,163,0.85)', life: 1.05, maxLife: 1.05
    });

    const petals = low ? 11 : 18;
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * TAU + A.rand(-0.12, 0.12);
      const sp = r * A.rand(1.1, 2.2);
      const life = A.rand(0.95, 1.5);
      add({
        k: 'petal',
        x: x + Math.cos(a) * r * 0.38,
        y: y + Math.sin(a) * r * 0.38,
        vx: Math.cos(a) * sp - Math.sin(a) * sp * 0.55,
        vy: Math.sin(a) * sp + Math.cos(a) * sp * 0.55 - r * 0.15,
        rot: a,
        vr: A.rand(-2.4, 2.4),
        size: r * A.rand(0.17, 0.30),
        color: i % 3 === 0 ? '#ffe6a3' : (i % 3 === 1 ? '#8ef7e6' : '#b48cff'),
        life: life, maxLife: life
      });
    }

    add({ k: 'crown', x: x, y: y, r: r * 1.25, rot: A.rand(0, TAU), life: 1.25, maxLife: 1.25 });

    const pearls = low ? 5 : 8;
    for (let i = 0; i < pearls; i++) {
      const a = A.rand(0, TAU);
      const d = r * A.rand(0.5, 1.5);
      const life = A.rand(0.9, 1.5);
      add({
        k: 'mote',
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d * 0.6,
        vx: Math.cos(a) * r * 0.18,
        vy: -r * A.rand(0.5, 1.0),
        seed: A.rand(0, TAU),
        size: r * A.rand(0.10, 0.18),
        color: '#eafffb',
        life: life, maxLife: life
      });
    }

    for (let i = 0; i < (low ? 4 : 7); i++) {
      add({
        k: 'bubble', x: x + A.rand(-r, r), y: y + A.rand(-r * 0.6, r * 0.6),
        vx: A.rand(-r * 0.2, r * 0.2), vy: -A.rand(r * 0.5, r * 1.3),
        size: A.rand(1.6, r * 0.09), seed: A.rand(0, TAU),
        life: A.rand(0.8, 1.3), maxLife: 1.3
      });
    }
  }

  // Nebula Vortex evolution flourish: paired orbital rings and tangential
  // particles spiral out around the new form.
  function nebulaVortex(x,y,r) {
    const low=qualityLow();
    add({k:'flare',x,y,size:r*.42,grow:r*2.7,color:'#a78bfa',life:.55,maxLife:.55});
    add({k:'ring',x,y,r:r*.28,vr:r*3.7,w:Math.max(1.5,r*.045),color:'rgba(167,139,250,.95)',life:.8,maxLife:.8});
    add({k:'ring',x,y,r:r*.62,vr:-r*1.7,w:Math.max(1.3,r*.035),color:'rgba(103,232,249,.9)',life:.95,maxLife:.95});
    const n=low?9:15;
    for(let i=0;i<n;i++){const a=i*TAU/n+A.rand(-.12,.12),d=r*A.rand(.55,1.25),sp=r*A.rand(.48,.9),life=A.rand(.65,1.05);
      add({k:'mote',x:x+Math.cos(a)*d,y:y+Math.sin(a)*d,vx:-Math.sin(a)*sp,vy:Math.cos(a)*sp-r*.22,seed:a,size:r*A.rand(.08,.13),color:i%2?'#67e8f9':'#d8ccff',life,maxLife:life});}
  }

  // ------------------------------------------------------------------
  // Kill effect — Poseidon's Wake
  // ------------------------------------------------------------------
  // The creature is captured as it dies and redrawn as a fading ghost that
  // keeps its own art, palette and heading. Around it: a turquoise implosion,
  // a shockwave, rising motes and bubbles. One call per kill, no loop.
  function wake(f) {
    if (!f) return;
    const low = qualityLow();
    const r = Math.max(8, f.radius || 10);
    const x = f.x, y = f.y;

    add({ k: 'flare', x: x, y: y, size: r * 0.5, grow: r * 3.2, color: '#8ff8ff', life: 0.32, maxLife: 0.32 });
    add({
      k: 'ring', x: x, y: y, r: r * 2.7, vr: -r * 6.4,
      w: Math.max(1.4, r * 0.045), color: 'rgba(127,240,216,0.95)', life: 0.34, maxLife: 0.34
    });
    add({
      k: 'ring', x: x, y: y, r: r * 0.7, vr: r * 6.2,
      w: Math.max(1.4, r * 0.05), color: 'rgba(120,235,255,0.8)', life: 0.55, maxLife: 0.55
    });
    add({
      k: 'ring', x: x, y: y, r: r * 0.4, vr: r * 4.0,
      w: Math.max(1.1, r * 0.03), color: 'rgba(220,255,255,0.6)', life: 0.75, maxLife: 0.75
    });

    const motes = low ? 7 : 12;
    for (let i = 0; i < motes; i++) {
      const a = A.rand(0, TAU);
      const sp = r * A.rand(0.3, 1.1);
      const life = A.rand(0.6, 1.1);
      add({
        k: 'mote',
        x: x + Math.cos(a) * r * 0.5,
        y: y + Math.sin(a) * r * 0.5,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - r * 0.7,
        seed: A.rand(0, TAU),
        size: r * A.rand(0.08, 0.15),
        color: i % 3 === 0 ? '#b8f7ff' : (i % 3 === 1 ? '#4fe0d0' : '#dffcff'),
        life: life, maxLife: life
      });
    }
    for (let i = 0; i < (low ? 4 : 7); i++) {
      add({
        k: 'bubble', x: x + A.rand(-r * 0.7, r * 0.7), y: y + A.rand(-r * 0.5, r * 0.5),
        vx: A.rand(-r * 0.25, r * 0.25), vy: -A.rand(r * 0.6, r * 1.5),
        size: A.rand(1.8, r * 0.10), seed: A.rand(0, TAU),
        life: A.rand(0.7, 1.2), maxLife: 1.2
      });
    }

    // The ghost is a snapshot, not a reference: the reef compacts the dead fish
    // out of its array on the very next frame.
    add({
      k: 'ghost', art: f.art, colors: f.colors, angle: f.angle || 0,
      radius: r, phase: f.phase || 0, swim: f.swim || 0,
      x: x, y: y, vy: -r * 0.6, wisp: 0, life: 0.95, maxLife: 0.95
    });
  }

  // Rift Collapse kill flourish: inward-folding rings and a brief starburst.
  function riftCollapse(f) {
    if(!f)return;const low=qualityLow(),r=Math.max(8,f.radius||10),x=f.x,y=f.y;
    add({k:'flare',x,y,size:r*.38,grow:r*2.8,color:'#a78bfa',life:.38,maxLife:.38});
    add({k:'ring',x,y,r:r*2.9,vr:-r*7.5,w:Math.max(1.6,r*.055),color:'rgba(167,139,250,.98)',life:.42,maxLife:.42});
    add({k:'ring',x,y,r:r*1.9,vr:-r*4.6,w:Math.max(1.4,r*.045),color:'rgba(103,232,249,.95)',life:.58,maxLife:.58});
    add({k:'ring',x,y,r:r*.45,vr:r*3,w:Math.max(1.2,r*.035),color:'rgba(232,224,255,.9)',life:.7,maxLife:.7});
    const n=low?7:12;
    for(let i=0;i<n;i++){const a=i*TAU/n+A.rand(-.1,.1),sp=r*A.rand(.7,1.35),life=A.rand(.45,.85);
      add({k:'mote',x:x+Math.cos(a)*r*.35,y:y+Math.sin(a)*r*.35,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,seed:a,size:r*A.rand(.07,.12),color:i%2?'#67e8f9':'#cbbaff',life,maxLife:life});}
    add({k:'ghost',art:f.art,colors:f.colors,angle:f.angle||0,radius:r,phase:f.phase||0,swim:f.swim||0,x,y,vy:-r*.25,wisp:0,life:.48,maxLife:.48});
  }

  // ------------------------------------------------------------------
  // Pets
  // ------------------------------------------------------------------
  // Where the companion swims relative to the owner, in body radii. It sits
  // behind and to one side, so it can never cover the mouth or the nose.
  const PET_HOLD = {
    lionfish: { back: 2.60, side: 2.10, lag: 4.2 },
    blue_tang: { back: 2.25, side: -2.35, lag: 4.6 }
  };

  const PETS = {
    blue_tang: {
      kind: 'blue_tang', x: 0, y: 0, px: 0, py: 0, angle: 0, active: false,
      vx: 0, vy: 0, speed: 0, bank: 0, trail: 0, phase: 4.1
    },
    lionfish: {
      kind: 'lionfish', x: 0, y: 0, px: 0, py: 0, angle: 0, active: false,
      vx: 0, vy: 0, speed: 0, bank: 0, trail: 0, phase: 2.2,
      nextAt: 0, marks: null
    }
  };

  function placePet(pet, p, backDist, sideDist) {
    const back = p.angle + Math.PI;
    const side = p.angle + Math.PI / 2;
    pet.x = pet.px = p.x + Math.cos(back) * p.radius * backDist + Math.cos(side) * p.radius * sideDist;
    pet.y = pet.py = p.y + Math.sin(back) * p.radius * backDist + Math.sin(side) * p.radius * sideDist;
    pet.angle = p.angle;
  }

  // A pet is hidden (not deleted) while it is on the shelf, so swapping one in
  // mid-dive has to place it at your shoulder instead of letting it swim in
  // from the world origin.
  function resetPets(p) {
    const tang = PETS.blue_tang;
    tang.owner = p;
    tang.active = false;
    if (p) placePet(tang, p, PET_HOLD.blue_tang.back, PET_HOLD.blue_tang.side);
    tang.vx = tang.vy = tang.speed = tang.bank = 0;
    tang.trail = 0;
    const lion = PETS.lionfish;
    lion.owner = p;
    lion.active = false;
    if (p) {
      placePet(lion, p, PET_HOLD.lionfish.back, PET_HOLD.lionfish.side);
    }
    const g = A.game;
    const sim = g ? g.sim : 0;
    lion.vx = lion.vy = lion.speed = lion.bank = 0;
    lion.nextAt = sim + 14;
    lion.marks = null;
  }

  // A light spring rather than a teleport: the pet overshoots a little when
  // you turn and settles back in the wake, which is what makes a follower look
  // alive instead of welded to the shoulder. Its velocity is kept so the art
  // can switch from a hover to a full tail-beat when you actually move.
  function follow(pet, tx, ty, dt, lag) {
    const k = 1 - Math.exp(-dt * lag);
    pet.px = pet.x;
    pet.py = pet.y;
    const dx = tx - pet.x, dy = ty - pet.y;
    // A charge, a death and a portal all move the owner far enough that a
    // spring alone would leave the pet swimming in from another screen. Any
    // gap this large is a displacement, not a swim, so the pet catches up.
    if (dx * dx + dy * dy > 1100 * 1100) {
      pet.x = tx;
      pet.y = ty;
      pet.vx = pet.vy = pet.speed = 0;
      pet.bank *= 0.5;
      return;
    }
    pet.x += dx * k;
    pet.y += dy * k;
    const vx = pet.x - pet.px, vy = pet.y - pet.py;
    pet.vx = vx;
    pet.vy = vy;
    const inv = 1 / Math.max(0.001, dt);
    const inst = Math.sqrt(vx * vx + vy * vy) * inv;
    pet.speed += (inst - pet.speed) * Math.min(1, dt * 8);
    if (vx * vx + vy * vy > 0.8) {
      const want = Math.atan2(vy, vx);
      const turn = A.angleDiff(want, pet.angle);
      pet.angle += turn * Math.min(1, dt * 6);
      const lean = A.clamp(turn * 0.55, -0.30, 0.30);
      pet.bank += (lean - pet.bank) * Math.min(1, dt * 5);
    } else {
      pet.bank += (0 - pet.bank) * Math.min(1, dt * 3);
    }
  }

  function nearestHunter(g, p) {
    let best = null, bestD = 1400 * 1400;
    const list = g.fishes;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (f.dead || f.hazard || f === p) continue;
      if (!(f.predator || (f.aggression >= 0.72 && f.radius > p.radius * 0.85))) continue;
      const d2 = A.dist2(p.x, p.y, f.x, f.y);
      if (d2 < bestD) { bestD = d2; best = f; }
    }
    return best;
  }

  function nearestFood(g, p) {
    let best = null, bestD = 1600 * 1600;
    const list = g.foods;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (f.dead) continue;
      const d2 = A.dist2(p.x, p.y, f.x, f.y);
      if (d2 < bestD) { bestD = d2; best = f; }
    }
    return best;
  }

  function emitWake(pet, dt) {
    if (pet.speed < 46) { pet.trail = 0; return; }
    pet.trail -= dt;
    if (pet.trail > 0) return;
    pet.trail = A.rand(0.15, 0.3) / (0.6 + Math.min(1.4, pet.speed / 240));
    const back = pet.angle + Math.PI + A.rand(-0.35, 0.35);
    const d = petWorldScale(pet.owner) * 0.78;
    add({
      k: 'bubble',
      x: pet.x + Math.cos(back) * d,
      y: pet.y + Math.sin(back) * d * 0.6,
      vx: Math.cos(back) * 14, vy: -A.rand(6, 22),
      size: A.rand(0.7, 1.8), seed: A.rand(0, TAU),
      life: A.rand(0.45, 0.85), maxLife: 0.85
    });
  }

  function updatePets(g, dt) {
    const p = g.player;
    const petSlot = activeSlot('pet');
    const lion = PETS.lionfish;

    if (lion.owner !== p) resetPets(p);

    const sim = g.sim;
    const back = p.angle + Math.PI;
    const side = p.angle + Math.PI / 2;
    // A slow lateral wander so a parked pet keeps swimming its little circle
    // instead of freezing beside a player who is not moving.
    const wander = Math.sin(sim * 1.45 + 0.7);

    const tang = PETS.blue_tang;
    const tangOn = petSlot === TANG_KEY;
    if (tangOn && !tang.active) {
      tang.active = true;
      placePet(tang, p, PET_HOLD.blue_tang.back, PET_HOLD.blue_tang.side);
    } else if (!tangOn) {
      tang.active = false;
    }
    if (tang.active) {
      const h = PET_HOLD.blue_tang;
      const sway = Math.sin(sim * 1.25 + 1.7) * p.radius * 0.12;
      const lift = Math.sin(sim * 1.8 + 4.1) * p.radius * 0.10;
      const tx = p.x + Math.cos(back) * p.radius * h.back + Math.cos(side - 0.30) * (p.radius * h.side + sway);
      const ty = p.y + Math.sin(back) * p.radius * h.back + Math.sin(side - 0.30) * (p.radius * h.side + sway) + lift;
      follow(tang, tx, ty, dt, h.lag);
      emitWake(tang, dt);
    }

    const lionOn = petSlot === LION_KEY;
    if (lionOn && !lion.active) {
      lion.active = true;
      placePet(lion, p, PET_HOLD.lionfish.back, PET_HOLD.lionfish.side);
      lion.nextAt = sim + 14;
    } else if (!lionOn) {
      lion.active = false;
      lion.marks = null;
    }

    if (lion.active) {
      const h = PET_HOLD.lionfish;
      const sway = wander * p.radius * 0.15;
      const lift = Math.sin(sim * 1.95 + 2.2) * p.radius * 0.13;
      const tx = p.x + Math.cos(back) * p.radius * h.back + Math.cos(side + 0.35) * (p.radius * h.side + sway);
      const ty = p.y + Math.sin(back) * p.radius * h.back + Math.sin(side + 0.35) * (p.radius * h.side + sway) + lift;
      follow(lion, tx, ty, dt, h.lag);
      emitWake(lion, dt);

      if (!lion.nextAt) lion.nextAt = sim + 14;
      if (sim >= lion.nextAt) {
        lion.nextAt = sim + 14;
        lion.marks = {
          predator: nearestHunter(g, p),
          food: nearestFood(g, p),
          until: sim + 4
        };
      }
      if (lion.marks) {
        if (sim >= lion.marks.until) lion.marks = null;
        else {
          if (lion.marks.predator && lion.marks.predator.dead) lion.marks.predator = null;
          if (lion.marks.food && lion.marks.food.dead) lion.marks.food = null;
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // Particle motion
  // ------------------------------------------------------------------
  function updateParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        parts.splice(i, 1);
        continue;
      }
      if (p.k === 'ring') {
        p.r += p.vr * dt;
        p.vr *= 1 - Math.min(0.9, dt * 1.1);
      } else if (p.k === 'flare') {
        p.size = Math.min(p.size + p.grow * dt, p.grow * 1.6);
      } else if (p.k === 'petal') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const damp = 1 - Math.min(0.9, dt * 1.9);
        p.vx *= damp;
        p.vy = p.vy * damp - 9 * dt;
        p.rot += p.vr * dt;
        p.vr *= 1 - Math.min(0.9, dt * 1.4);
      } else if (p.k === 'crown') {
        p.r += p.r * 0.32 * dt;
        p.rot += dt * 0.55;
      } else if (p.k === 'mote') {
        p.x += (p.vx + Math.sin(p.life * 2.2 + p.seed) * 8) * dt;
        p.y += p.vy * dt;
        p.vx *= 1 - Math.min(0.9, dt * 1.2);
        p.vy *= 1 - Math.min(0.9, dt * 0.6);
      } else if (p.k === 'bubble') {
        p.x += (p.vx + Math.sin(p.life * 3.1 + p.seed) * 12) * dt;
        p.y += p.vy * dt;
      } else if (p.k === 'ghost') {
        p.y += p.vy * dt;
        p.vy *= 1 - Math.min(0.9, dt * 1.2);
        // The soul comes apart as it rises: a turquoise wisp every tenth of a
        // second, so the body is visibly dissolving rather than simply fading.
        p.wisp -= dt;
        if (p.wisp <= 0 && p.life > 0.2) {
          p.wisp = 0.10;
          const wl = A.rand(0.35, 0.6);
          add({
            k: 'mote',
            x: p.x + A.rand(-p.radius * 0.45, p.radius * 0.45),
            y: p.y + A.rand(-p.radius * 0.3, p.radius * 0.3),
            vx: A.rand(-10, 10), vy: -A.rand(22, 48),
            seed: A.rand(0, TAU), size: Math.max(1.5, p.radius * 0.07),
            color: '#7ff0e6', life: wl, maxLife: wl
          });
        }
      } else if (p.k === 'text') {
        p.y -= 26 * dt;
      }
    }
  }

  // ------------------------------------------------------------------
  // World drawing
  // ------------------------------------------------------------------
  function drawParts(ctx, sim) {
    // Ghosts first: the fallen creature belongs under its own farewell.
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.k !== 'ghost') continue;
      const t = 1 - p.life / p.maxLife;
      const fade = 1 - t;
      // Turquoise soul-light under the body, then the body, then a faint
      // additive second impression that separates as it rises.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade * 0.12;
      const gs = p.radius * 2.6;
      ctx.drawImage(A.glowSprite('#7ff0e6'), p.x - gs / 2, p.y - gs / 2, gs, gs);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = fade;
      A.FishArt.draw(ctx, {
        x: p.x, y: p.y, angle: p.angle,
        radius: p.radius * (1 + 0.2 * t),
        art: p.art, colors: p.colors,
        phase: p.phase + t * 4, swim: p.swim,
        bite: 0, noShadow: true
      }, sim, true);
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade * 0.14;
      A.FishArt.draw(ctx, {
        x: p.x + 5, y: p.y - 9 * t, angle: p.angle,
        radius: p.radius * (1 + 0.26 * t),
        art: p.art, colors: p.colors,
        phase: p.phase + t * 4, swim: p.swim,
        bite: 0, noShadow: true
      }, sim, true);
      ctx.restore();
    }

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const fade = A.clamp(p.life / p.maxLife, 0, 1);
      if (p.k === 'ghost') continue;

      if (p.k === 'flare') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = fade * 0.5;
        const s = p.size * 2;
        ctx.drawImage(A.glowSprite(p.color), p.x - s / 2, p.y - s / 2, s, s);
        ctx.restore();
      } else if (p.k === 'ring') {
        if (p.r <= 0.4) continue;
        ctx.save();
        ctx.globalAlpha = fade * 0.85;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.w * (0.35 + 0.65 * fade);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, TAU);
        ctx.stroke();
        ctx.restore();
      } else if (p.k === 'petal') {
        // A pointed leaf with a lit vein, not an oval: at this size the shape
        // is the whole read, and an ellipse looks like confetti.
        const s = p.size;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = fade * 0.9;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(-s, 0);
        ctx.quadraticCurveTo(0, -s * 0.62, s, 0);
        ctx.quadraticCurveTo(0, s * 0.62, -s, 0);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = fade * 0.55;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(0.6, s * 0.10);
        ctx.beginPath();
        ctx.moveTo(-s * 0.72, 0);
        ctx.quadraticCurveTo(0, -s * 0.12, s * 0.78, 0);
        ctx.stroke();
        ctx.globalAlpha = fade * 0.85;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(s * 0.72, 0, Math.max(0.5, s * 0.10), 0, TAU);
        ctx.fill();
        ctx.restore();
      } else if (p.k === 'crown') {
        ctx.save();
        ctx.globalAlpha = fade * 0.5;
        ctx.strokeStyle = '#ffe6a3';
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(1.4, p.r * 0.026);
        for (let i = 0; i < 6; i++) {
          const a = p.rot + i * (TAU / 6);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, a, a + 0.30);
          ctx.stroke();
        }
        ctx.restore();
      } else if (p.k === 'mote') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = fade * 0.8;
        const s = Math.max(4, p.size * 6);
        ctx.drawImage(A.glowSprite(p.color), p.x - s / 2, p.y - s / 2, s, s);
        ctx.globalAlpha = fade;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.7, p.size * 0.5), 0, TAU);
        ctx.fill();
        ctx.restore();
      } else if (p.k === 'bubble') {
        ctx.save();
        ctx.globalAlpha = fade * 0.7;
        ctx.strokeStyle = 'rgba(224,252,255,0.9)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = fade * 0.9;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, Math.max(0.6, p.size * 0.22), 0, TAU);
        ctx.fill();
        ctx.restore();
      } else if (p.k === 'text') {
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.color;
        ctx.font = '600 ' + p.size.toFixed(1) + 'px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y);
        ctx.restore();
      }
    }
  }

  // ------------------------------------------------------------------
  // Pet art
  // ------------------------------------------------------------------
  // A lionfish is banded, not tinted: vermilion flesh, cream hoops, a pale
  // feather of spines and an almost black outline to hold it on open water.
  const LION = {
    body: '#cf4528', bodyDark: '#8e2416', band: '#f7e6c9', bandEdge: '#b8795a',
    fin: 'rgba(247,214,178,0.62)', finDark: 'rgba(187,84,52,0.55)',
    spine: '#f3dcc0', eye: '#fff0bd', pupil: '#2a0e08',
    outline: '#3a120a', glow: '#ff9a63'
  };

  // A lionfish: banded flanks, a crown of venomous dorsal spines and two fans
  // of pectoral rays that sweep like slow wings. Every joint is tied to the
  // swim value, so it drifts at rest and beats hard when it chases the player.
  function paintLionfish(ctx, t, swim) {
    swim = swim || 0;
    const fanPhase = t * (2.1 + swim * 2.6);
    const wag = Math.sin(t * (3.2 + swim * 3.8));

    function bodyPath() {
      ctx.beginPath();
      ctx.moveTo(0.98, 0.00);
      ctx.quadraticCurveTo(0.88, -0.15, 0.64, -0.25);
      ctx.quadraticCurveTo(0.34, -0.33, 0.04, -0.29);
      ctx.quadraticCurveTo(-0.28, -0.25, -0.58, -0.11);
      ctx.lineTo(-0.66, 0);
      ctx.quadraticCurveTo(-0.28, 0.26, 0.04, 0.30);
      ctx.quadraticCurveTo(0.36, 0.32, 0.64, 0.23);
      ctx.quadraticCurveTo(0.88, 0.14, 0.98, 0.02);
      ctx.closePath();
    }

    function fan(ax, ay, ang, len, spread, rays, alpha, phase) {
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang + Math.sin(phase) * 0.10);
      ctx.globalAlpha = alpha;
      const tips = [];
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let i = 0; i <= rays; i++) {
        const k = i / rays;
        const a = -spread / 2 + spread * k;
        const wob = Math.sin(phase * 1.35 + i * 0.62) * 0.075;
        const l = len * (0.58 + 0.42 * Math.sin(Math.PI * k));
        const tx = Math.cos(a + wob) * l;
        const ty = Math.sin(a + wob) * l;
        tips.push([tx, ty]);
        ctx.lineTo(tx, ty);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,124,72,0.32)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,28,16,0.45)';
      ctx.lineWidth = 0.014;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(250,224,192,0.92)';
      ctx.lineCap = 'round';
      ctx.lineWidth = 0.018;
      for (let i = 0; i < tips.length; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(tips[i][0], tips[i][1]);
        ctx.stroke();
      }
      // Short ribs between neighbouring rays read as a banded fan without
      // painting a pale disc across the whole silhouette.
      for (let r = 1; r <= 2; r++) {
        const f = r === 1 ? 0.52 : 0.82;
        ctx.strokeStyle = r === 1 ? 'rgba(187,84,52,0.5)' : 'rgba(250,224,192,0.7)';
        ctx.lineWidth = 0.012;
        for (let i = 0; i < tips.length - 1; i++) {
          ctx.beginPath();
          ctx.moveTo(tips[i][0] * f, tips[i][1] * f);
          ctx.lineTo(tips[i + 1][0] * f, tips[i + 1][1] * f);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // The far-side pectoral fan sits behind the body.
    fan(0.30, 0.02, Math.PI - 0.22, 0.95, 1.55, 8, 0.42, fanPhase + 1.4);

    // Tail fan, banded, beating behind the body.
    ctx.save();
    ctx.translate(-0.64, 0);
    ctx.rotate(wag * (0.16 + swim * 0.24));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-0.26, -0.28, -0.42, -0.16);
    ctx.quadraticCurveTo(-0.34, 0, -0.44, 0.17);
    ctx.quadraticCurveTo(-0.26, 0.28, 0, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(250,214,172,0.85)';
    ctx.fill();
    ctx.strokeStyle = LION.outline;
    ctx.lineWidth = 0.02;
    ctx.stroke();
    ctx.strokeStyle = LION.finDark;
    ctx.lineWidth = 0.014;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-0.03, 0);
      ctx.quadraticCurveTo(-0.2, -0.14 + i * 0.14, -0.38, -0.12 + i * 0.12);
      ctx.stroke();
    }
    ctx.restore();

    // Dorsal crown: staggered spines over a low membrane.
    ctx.save();
    ctx.fillStyle = 'rgba(247,214,178,0.34)';
    ctx.beginPath();
    ctx.moveTo(0.56, -0.24);
    for (let i = 0; i <= 8; i++) {
      const x = 0.56 - i * 0.118;
      const sway = Math.sin(t * 3.1 + i * 0.8) * (0.02 + swim * 0.05);
      const len = 0.26 + Math.sin((i / 8) * Math.PI) * 0.18;
      ctx.lineTo(x - 0.20 + sway, -0.26 - len * 0.55);
    }
    ctx.lineTo(-0.42, -0.20);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = LION.outline;
    ctx.lineWidth = 0.02;
    ctx.stroke();

    ctx.strokeStyle = LION.spine;
    ctx.lineCap = 'round';
    for (let i = 0; i <= 8; i++) {
      const x = 0.56 - i * 0.118;
      const sway = Math.sin(t * 3.1 + i * 0.8) * (0.02 + swim * 0.05);
      const len = 0.30 + Math.sin((i / 8) * Math.PI) * 0.20;
      ctx.lineWidth = 0.021;
      ctx.beginPath();
      ctx.moveTo(x, -0.24);
      ctx.quadraticCurveTo(x - 0.03, -0.24 - len * 0.6, x - 0.20 + sway, -0.26 - len);
      ctx.stroke();
    }
    ctx.restore();

    // Anal spines under the belly.
    ctx.save();
    ctx.strokeStyle = LION.spine;
    ctx.lineCap = 'round';
    const abases = [0.20, 0.04, -0.12, -0.28, -0.42];
    for (let i = 0; i < abases.length; i++) {
      const x = abases[i];
      const sway = Math.sin(t * 2.7 + i * 0.9) * (0.015 + swim * 0.04);
      const len = 0.20 + Math.sin((i / (abases.length - 1)) * Math.PI) * 0.12;
      ctx.lineWidth = 0.017;
      ctx.beginPath();
      ctx.moveTo(x, 0.27);
      ctx.quadraticCurveTo(x - 0.02, 0.27 + len * 0.6, x - 0.08 + sway, 0.28 + len);
      ctx.stroke();
    }
    ctx.restore();

    // Pelvic fin under the chest.
    ctx.save();
    ctx.translate(0.46, 0.22);
    ctx.rotate(0.9 + Math.sin(t * 3.6) * (0.08 + swim * 0.08));
    ctx.fillStyle = 'rgba(247,214,178,0.6)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-0.02, 0.22, -0.14, 0.34);
    ctx.quadraticCurveTo(-0.06, 0.16, -0.10, 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = LION.outline;
    ctx.lineWidth = 0.016;
    ctx.stroke();
    ctx.restore();

    // Banded body.
    bodyPath();
    ctx.fillStyle = LION.body;
    ctx.fill();

    ctx.save();
    bodyPath();
    ctx.clip();
    for (let i = 0; i < 5; i++) {
      const bx = 0.84 - i * 0.24;
      ctx.beginPath();
      ctx.moveTo(bx - 0.05, -0.45);
      ctx.quadraticCurveTo(bx + 0.05, 0, bx - 0.035, 0.45);
      ctx.lineTo(bx + 0.075, 0.45);
      ctx.quadraticCurveTo(bx + 0.155, 0, bx + 0.075, -0.45);
      ctx.closePath();
      ctx.fillStyle = LION.band;
      ctx.fill();
      ctx.strokeStyle = 'rgba(184,121,90,0.55)';
      ctx.lineWidth = 0.014;
      ctx.stroke();
    }
    // Top light and a shadowed keel, so the barrel has a top and a bottom.
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#3a0f08';
    ctx.beginPath();
    ctx.ellipse(0.0, 0.20, 0.70, 0.14, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#ffd9b0';
    ctx.beginPath();
    ctx.ellipse(0.22, -0.14, 0.42, 0.10, -0.2, 0, TAU);
    ctx.fill();
    ctx.restore();

    bodyPath();
    ctx.strokeStyle = LION.outline;
    ctx.lineWidth = 0.035;
    ctx.stroke();

    // The near pectoral fan lies over the flank.
    fan(0.38, 0.10, Math.PI - 0.05, 0.78, 1.35, 7, 0.36, fanPhase);

    // Eye, with the band running behind it.
    ctx.beginPath();
    ctx.arc(0.74, -0.10, 0.082, 0, TAU);
    ctx.fillStyle = LION.eye;
    ctx.fill();
    ctx.strokeStyle = LION.outline;
    ctx.lineWidth = 0.02;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0.755, -0.10, 0.040, 0, TAU);
    ctx.fillStyle = LION.pupil;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0.768, -0.114, 0.014, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Supraorbital tentacle, drifting with the water.
    ctx.save();
    ctx.strokeStyle = LION.spine;
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.018;
    ctx.beginPath();
    ctx.moveTo(0.73, -0.19);
    ctx.quadraticCurveTo(0.68, -0.34, 0.62 + Math.sin(t * 2.3) * 0.02, -0.40);
    ctx.stroke();
    ctx.restore();

    // Mouth and the cheek spine under the eye.
    ctx.strokeStyle = LION.outline;
    ctx.lineWidth = 0.022;
    ctx.beginPath();
    ctx.moveTo(0.97, 0.03);
    ctx.quadraticCurveTo(0.88, 0.10, 0.78, 0.08);
    ctx.stroke();

    ctx.fillStyle = LION.spine;
    ctx.beginPath();
    ctx.moveTo(0.66, 0.14);
    ctx.lineTo(0.60, 0.24);
    ctx.lineTo(0.58, 0.12);
    ctx.closePath();
    ctx.fill();
  }

  function petWorldScale(p) {
    // The companion reads at twice the old size so its detailing survives at
    // gameplay zoom. It still orbits behind the shoulder, so nothing covers
    // the owner's mouth or the direction it is swimming.
    return A.clamp(p.radius * 0.86, 30, 96);
  }

  function drawPet(ctx, pet, sim, p) {
    const size = petWorldScale(p);
    const swim = A.clamp((pet.speed || 0) / 240, 0, 1);
    const phase = sim * (2.4 + swim * 2.8) + (pet.phase || 0);
    const bob = Math.sin(phase * 0.72) * size * (0.10 - swim * 0.04);
    // A ripple travelling along the body's normal, so even a straight chase
    // reads as a stroke instead of a sprite sliding across the screen.
    const ripple = Math.sin(phase) * size * (0.025 + swim * 0.045);
    const nx = Math.cos(pet.angle + Math.PI / 2);
    const ny = Math.sin(pet.angle + Math.PI / 2);
    const dx = pet.x + nx * ripple;
    const dy = pet.y + bob + ny * ripple;

    const gs = size * 5.0;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.13;
    ctx.drawImage(A.glowSprite(LION.glow), dx - gs / 2, dy - gs / 2, gs, gs);
    ctx.restore();

    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(pet.angle + (pet.bank || 0));
    if (Math.cos(pet.angle) < 0) ctx.scale(1, -1);
    const breath = 1 + Math.sin(phase * 1.1) * 0.02;
    ctx.scale(size * breath, size * (2 - breath));
    paintLionfish(ctx, sim, swim);
    ctx.restore();
  }

  // Blue tang (Paracanthurus hepatus): cobalt body, dark palette markings,
  // yellow fins and the distinctive bright yellow tail.
  function paintBlueTang(ctx,t,swim) {
    const wag=Math.sin(t*(3.1+swim*3.2));
    ctx.save();ctx.translate(-0.63,0);ctx.rotate(wag*(0.13+swim*0.18));
    ctx.fillStyle='#f2d84a';ctx.strokeStyle='#102044';ctx.lineWidth=.035;
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-.42,-.30);ctx.quadraticCurveTo(-.34,0,-.42,.30);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
    ctx.beginPath();ctx.moveTo(.93,0);ctx.quadraticCurveTo(.75,-.36,.25,-.38);
    ctx.quadraticCurveTo(-.34,-.35,-.63,-.10);ctx.quadraticCurveTo(-.72,0,-.63,.10);
    ctx.quadraticCurveTo(-.34,.35,.25,.38);ctx.quadraticCurveTo(.75,.36,.93,0);ctx.closePath();
    ctx.fillStyle='#1766c7';ctx.fill();ctx.strokeStyle='#081b43';ctx.lineWidth=.04;ctx.stroke();
    ctx.save();ctx.clip();ctx.fillStyle='#082b73';ctx.beginPath();ctx.moveTo(.55,-.39);
    ctx.quadraticCurveTo(.25,0,.54,.39);ctx.lineTo(.82,.34);ctx.lineTo(.82,-.34);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(7,19,58,.9)';ctx.lineWidth=.045;ctx.beginPath();ctx.moveTo(.38,-.34);
    ctx.quadraticCurveTo(.18,0,.40,.34);ctx.stroke();ctx.restore();
    ctx.fillStyle='#e6c83e';ctx.beginPath();ctx.moveTo(-.38,-.26);ctx.quadraticCurveTo(-.12,-.56,.40,-.34);
    ctx.lineTo(.18,-.27);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(-.30,.27);ctx.quadraticCurveTo(.02,.52,.43,.34);ctx.lineTo(.18,.28);ctx.closePath();ctx.fill();
    ctx.fillStyle='#fff2d2';ctx.beginPath();ctx.arc(.72,-.12,.075,0,TAU);ctx.fill();
    ctx.fillStyle='#07152c';ctx.beginPath();ctx.arc(.74,-.12,.039,0,TAU);ctx.fill();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(.755,-.14,.014,0,TAU);ctx.fill();
    ctx.strokeStyle='#07152c';ctx.lineWidth=.025;ctx.beginPath();ctx.moveTo(.91,.035);ctx.quadraticCurveTo(.82,.10,.72,.075);ctx.stroke();
  }
  function drawBlueTang(ctx,pet,sim,p) {
    const size=petWorldScale(p)*.82,swim=A.clamp((pet.speed||0)/240,0,1);
    const phase=sim*(2.5+swim*2.5)+pet.phase,bob=Math.sin(phase*.7)*size*.07;
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.10;
    const glow=size*3.6;ctx.drawImage(A.glowSprite('#348dff'),pet.x-glow/2,pet.y-glow/2,glow,glow);ctx.restore();
    ctx.save();ctx.translate(pet.x,pet.y+bob);ctx.rotate(pet.angle+(pet.bank||0));
    if(Math.cos(pet.angle)<0)ctx.scale(1,-1);ctx.scale(size,size);paintBlueTang(ctx,sim,swim);ctx.restore();
  }

  function drawMarks(ctx, sim) {
    const marks = PETS.lionfish.marks;
    if (!marks) return;
    const left = marks.until - sim;
    if (left <= 0) return;
    const fade = Math.min(1, left / 0.5);

    if (marks.predator) {
      const f = marks.predator;
      const r = f.radius + Math.max(14, f.radius * 0.35) + Math.sin(sim * 5) * 2;
      ctx.save();
      ctx.globalAlpha = 0.7 * fade;
      ctx.strokeStyle = '#ff7a9c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.5 * fade;
      ctx.setLineDash([6, 9]);
      ctx.beginPath();
      ctx.arc(f.x, f.y, r + 9, sim * 0.8, sim * 0.8 + TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      const my = f.y - r - 14;
      ctx.globalAlpha = 0.9 * fade;
      ctx.fillStyle = '#ff8fae';
      ctx.beginPath();
      ctx.moveTo(f.x, my - 7);
      ctx.lineTo(f.x + 6.5, my);
      ctx.lineTo(f.x, my + 7);
      ctx.lineTo(f.x - 6.5, my);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    if (marks.food) {
      const f = marks.food;
      const r = f.r * 2.1 + Math.sin(sim * 4.5) * 2;
      ctx.save();
      ctx.globalAlpha = 0.6 * fade;
      ctx.strokeStyle = '#8ef7d8';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.35 * fade;
      ctx.fillStyle = '#bfffe9';
      ctx.beginPath();
      ctx.arc(f.x, f.y, r * 0.42, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------
  // Card art
  // ------------------------------------------------------------------
  function backdrop(ctx, w, h, color) {
    const g = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w * 0.46);
    g.addColorStop(0, color || 'rgba(79,224,208,0.16)');
    g.addColorStop(0.6, 'rgba(60,150,190,0.06)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function previewPet(ctx, w, h) {
    const size = Math.min(w * 0.38, h * 0.50);
    ctx.save();
    ctx.translate(w / 2, h / 2 + 1);
    ctx.rotate(-0.10);
    ctx.scale(size, size);
    paintLionfish(ctx, 1.2, 0.4);
    ctx.restore();
  }

  function previewBloom(ctx, w, h) {
    const cx = w / 2, cy = h / 2;
    const time = 1.1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    const gs = h * 0.9;
    ctx.drawImage(A.glowSprite('#8ef7e6'), cx - gs / 2, cy - gs / 2, gs, gs);
    ctx.restore();

    const petals = 10;
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * TAU + 0.2;
      const d = h * 0.20;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.74);
      ctx.rotate(a);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = i % 3 === 0 ? '#ffe6a3' : (i % 3 === 1 ? '#8ef7e6' : '#b48cff');
      ctx.beginPath();
      ctx.ellipse(0, 0, h * 0.13, h * 0.055, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-h * 0.03, 0, h * 0.05, h * 0.018, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = 'rgba(255,230,163,0.9)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.34, h * 0.34, 0, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(127,240,216,0.8)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.24, h * 0.30, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();

    // Pearls drifting up out of the heart of the bloom.
    for (let i = 0; i < 4; i++) {
      const px = cx + Math.sin(i * 2.1 + time) * w * 0.13;
      const py = cy + h * (0.10 - i * 0.07);
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#eafffb';
      ctx.beginPath();
      ctx.arc(px, py, 1.6 + (i % 2) * 0.6, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function previewWake(ctx, w, h) {
    const cx = w / 2, cy = h / 2;

    // The fallen creature, half dissolved.
    if (A.FishArt && A.STAGES) {
      const stage = A.STAGES[0];
      ctx.save();
      ctx.globalAlpha = 0.55;
      A.FishArt.draw(ctx, {
        x: cx, y: cy, angle: -0.12, radius: Math.min(w * 0.16, h * 0.20),
        art: stage.art, colors: stage.palette, phase: 1.1, swim: 0.4, noShadow: true
      }, 0.8);
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55;
    const gs = h * 0.95;
    ctx.drawImage(A.glowSprite('#3fd0ff'), cx - gs / 2, cy - gs / 2, gs, gs);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(127,240,216,0.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.33, h * 0.32, 0, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = 'rgba(120,235,255,0.8)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.24, h * 0.23, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();

    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + 0.4;
      const d = w * (0.28 + (i % 3) * 0.05);
      const px = cx + Math.cos(a) * d;
      const py = cy + Math.sin(a) * d * 0.62;
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = i % 2 ? '#b8f7ff' : '#dffcff';
      ctx.beginPath();
      ctx.arc(px, py, 1.4 + (i % 3) * 0.4, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPreview(canvas, key) {
    if (!canvas) return false;
    const w = canvas.width, h = canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (key === LION_KEY) {
      backdrop(ctx, w, h, 'rgba(255,150,90,0.16)');
      previewPet(ctx, w, h);
      return true;
    }
    if (key === TANG_KEY) {
      backdrop(ctx,w,h,'rgba(45,120,255,0.20)');
      ctx.save();ctx.translate(w/2,h/2);ctx.rotate(-.10);
      const size=Math.min(w*.34,h*.48);ctx.scale(size,size);paintBlueTang(ctx,1.2,.4);ctx.restore();return true;
    }
    if (key === EVO_KEY) {
      backdrop(ctx, w, h, 'rgba(140,200,255,0.14)');
      previewBloom(ctx, w, h);
      return true;
    }
    if (key === VORTEX_KEY) {
      backdrop(ctx,w,h,'rgba(139,110,255,0.22)');
      const cx=w/2,cy=h/2;ctx.save();ctx.translate(cx,cy);
      for(let j=0;j<2;j++){ctx.beginPath();ctx.ellipse(0,0,w*(.30-j*.055),h*(.31-j*.045),j*.5,0,TAU);ctx.strokeStyle=j?'rgba(103,232,249,.9)':'rgba(167,139,250,.95)';ctx.lineWidth=2.2;ctx.stroke();}
      for(let i=0;i<9;i++){const a=i*TAU/9+.5,d=h*(.12+i*.012);ctx.fillStyle=i%2?'#67e8f9':'#d8ccff';ctx.beginPath();ctx.arc(Math.cos(a)*d,Math.sin(a)*d*.7,2.1,0,TAU);ctx.fill();}
      ctx.restore();return true;
    }
    if (key === KILL_KEY) {
      backdrop(ctx, w, h, 'rgba(60,190,220,0.16)');
      previewWake(ctx, w, h);
      return true;
    }
    if (key === RIFT_KEY) {
      backdrop(ctx,w,h,'rgba(139,110,255,0.22)');const cx=w/2,cy=h/2;
      ctx.save();ctx.globalCompositeOperation='lighter';
      for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(cx,cy,w*(.33-i*.07),h*(.31-i*.06),i*.28,0,TAU);ctx.strokeStyle=i===1?'rgba(103,232,249,.95)':'rgba(167,139,250,.9)';ctx.lineWidth=2.2;ctx.stroke();}
      ctx.restore();for(let i=0;i<8;i++){const a=i*TAU/8,d=w*.34;ctx.fillStyle='#e8e0ff';ctx.beginPath();ctx.arc(cx+Math.cos(a)*d,cy+Math.sin(a)*d*.55,1.7,0,TAU);ctx.fill();}return true;
    }
    if (key === 'skin_tidewrought' || key === 'skin_abyssal_crown') {
      backdrop(ctx,w,h,key==='skin_tidewrought'?'rgba(230,193,90,0.14)':'rgba(139,110,255,0.20)');
      if(A.Weapons)A.Weapons.paintFlat(ctx,'ancient_trident',w,h,performance.now()/1000,-.17,key);
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------
  // Public hooks
  // ------------------------------------------------------------------
  function playRemoteEffect(kind, key, f) {
    if (!f) return;
    if (kind === 'evolution') {
      if (key === EVO_KEY) bloom(f.x, f.y, f.radius || 20);
      else if (key === VORTEX_KEY) nebulaVortex(f.x, f.y, f.radius || 20);
    } else if (kind === 'kill') {
      if (key === KILL_KEY) wake(f);
      else if (key === RIFT_KEY) riftCollapse(f);
    }
  }

  function onEvolve(p) {
    if (!p) return;
    const key = activeSlot('evolution');
    playRemoteEffect('evolution', key, p);
    if (key && A.Online && A.Online.emitCosmetic) {
      A.Online.emitCosmetic('evolution', key, p);
    }
  }
  function onKill(f) {
    if (!f) return;
    const key = activeSlot('kill');
    playRemoteEffect('kill', key, f);
    if (key && A.Online && A.Online.emitCosmetic) {
      A.Online.emitCosmetic('kill', key, f);
    }
  }

  function update(dt) {
    updateParts(dt);
    const g = A.game;
    if (!g) return;
    if (g.state === 'playing' && g.player) updatePets(g, dt);
    else {
      PETS.blue_tang.active = false;
      PETS.blue_tang.owner = null;
      PETS.lionfish.active = false;
      PETS.lionfish.owner = null;
    }
  }

  function drawWorld(ctx, sim) {
    const g = A.game;
    if (!g) return;
    const playing = g.state === 'playing' && g.player;
    const p = g.player;

    if (parts.length) drawParts(ctx, sim);
    if (!playing) return;

    drawMarks(ctx, sim);
    if (PETS.blue_tang.active) drawBlueTang(ctx, PETS.blue_tang, sim, p);
    if (PETS.lionfish.active) drawPet(ctx, PETS.lionfish, sim, p);

    // Remote companions are derived from the smoothed remote fish position,
    // never from a stale world-space pet coordinate. This prevents pets
    // snapping to the origin or lagging far behind after turns/teleports.
    const remotes = g.remotePlayers || [];
    for (let i = 0; i < remotes.length; i++) {
      const owner = remotes[i];
      const key = owner.petKey;
      if (key !== TANG_KEY && key !== LION_KEY) continue;
      const back = owner.angle + Math.PI;
      const side = owner.angle + Math.PI / 2;
      const hold = key === TANG_KEY ? PET_HOLD.blue_tang : PET_HOLD.lionfish;
      const phase = sim * 1.4 + (owner.phase || 0);
      const sway = Math.sin(phase) * owner.radius * 0.10;
      const pet = {
        x: owner.x + Math.cos(back) * owner.radius * hold.back +
          Math.cos(side) * (owner.radius * hold.side + sway),
        y: owner.y + Math.sin(back) * owner.radius * hold.back +
          Math.sin(side) * (owner.radius * hold.side + sway),
        angle: owner.angle, bank: 0, speed: 35,
        phase: owner.phase || 0, radius: owner.radius
      };
      if (key === TANG_KEY) drawBlueTang(ctx, pet, sim, owner);
      else drawPet(ctx, pet, sim, owner);
    }
  }

  function reset() {
    parts.length = 0;
    PETS.blue_tang.owner = null;
    PETS.blue_tang.active = false;
    PETS.lionfish.owner = null;
    PETS.lionfish.active = false;
    PETS.lionfish.marks = null;
  }

  A.Collection = {
    EVO_KEY: EVO_KEY,
    KILL_KEY: KILL_KEY,
    LION_KEY: LION_KEY,
    skinKey: 'skin_tidewrought',
    onEvolve: onEvolve,
    onKill: onKill,
    playRemoteEffect: playRemoteEffect,
    update: update,
    drawWorld: drawWorld,
    drawPreview: drawPreview,
    reset: reset,
    count: function () { return parts.length; },
    pets: PETS
  };
})();
