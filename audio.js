(function () {
  'use strict';

  const A = window.ABYSS;

  const Audio = {
    ctx: null,
    master: null,
    noiseBuffer: null,
    muted: false,
    ready: false,
    lastPop: 0,
    lastBite: 0,
    lastOrca: 0,
    lastRush: 0,
    lastSlash: 0,
    lastWing: 0,
    lastRoar: 0,
    lastTerror: 0,
    lastInk: 0,
    lastInkHit: 0,
    lastCast: 0,
    lastCastHit: 0,

    init: function () {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      try {
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.42;
        this.master.connect(this.ctx.destination);

        const len = Math.floor(this.ctx.sampleRate * 0.7);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this.noiseBuffer = buf;
        this.ready = true;
      } catch (e) {
        this.ready = false;
      }
    },

    setMuted: function (muted) {
      this.muted = !!muted;
      try { localStorage.setItem('abyss.muted', this.muted ? '1' : '0'); } catch (e) { /* ignore */ }
      if (this.master && this.ctx) {
        this.master.gain.cancelScheduledValues(this.ctx.currentTime);
        this.master.gain.setTargetAtTime(this.muted ? 0 : 0.42, this.ctx.currentTime, 0.04);
      }
    },

    toggleMute: function () {
      this.setMuted(!this.muted);
      return this.muted;
    },

    tone: function (opts) {
      if (!this.ready || this.muted) return;
      const ctx = this.ctx;
      const now = ctx.currentTime + (opts.delay || 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = opts.type || 'sine';
      osc.frequency.setValueAtTime(opts.freq, now);
      if (opts.freqEnd && opts.freqEnd !== opts.freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), now + (opts.dur || 0.2));
      }
      const peak = Math.max(0.0002, opts.gain || 0.06);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + (opts.attack || 0.008));
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (opts.dur || 0.2));
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + (opts.dur || 0.2) + 0.03);
    },

    noise: function (opts) {
      if (!this.ready || this.muted) return;
      const ctx = this.ctx;
      const now = ctx.currentTime + (opts.delay || 0);
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = opts.filter || 'lowpass';
      filter.frequency.setValueAtTime(opts.freq || 900, now);
      if (opts.freqEnd) filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.freqEnd), now + (opts.dur || 0.2));
      filter.Q.value = opts.q || 0.8;
      const gain = ctx.createGain();
      const peak = Math.max(0.0002, opts.gain || 0.05);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + (opts.attack || 0.01));
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (opts.dur || 0.2));
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(now);
      src.stop(now + (opts.dur || 0.2) + 0.03);
    },

    pop: function (pitch) {
      if (!this.ready || this.muted) return;
      const now = this.ctx.currentTime;
      if (now - this.lastPop < 0.035) return;
      this.lastPop = now;
      const base = 520 + Math.random() * 300 + (pitch || 0);
      this.tone({ freq: base, freqEnd: base * 1.7, type: 'sine', dur: 0.075, gain: 0.045, attack: 0.004 });
    },

    chomp: function () {
      this.noise({ freq: 1400, freqEnd: 220, filter: 'lowpass', dur: 0.16, gain: 0.11 });
      this.tone({ freq: 170, freqEnd: 52, type: 'square', dur: 0.16, gain: 0.035, attack: 0.004 });
    },

    // The eating sound, weighted by how big the prey is: the established jaw
    // snap plus a low gulp and a short wet tail. Fires on the same frame the
    // jaw animation opens, so sound and motion land together.
    bite: function (size) {
      if (!this.ready || this.muted) return;
      const now = this.ctx.currentTime;
      if (now - this.lastBite < 0.05) return;
      this.lastBite = now;
      const w = Math.max(0, Math.min(1, (size || 10) / 44));
      this.chomp();
      this.tone({ freq: 200 - 80 * w, freqEnd: 44, type: 'triangle', dur: 0.14 + 0.12 * w, gain: 0.045 + 0.05 * w, attack: 0.005 });
      this.noise({ freq: 700, freqEnd: 150, filter: 'lowpass', dur: 0.1 + 0.07 * w, gain: 0.045 + 0.03 * w, delay: 0.055 });
    },

    // Sawshark chomp: the shark's jaw snap with a metallic rasp dragged over
    // it, because the prey is coming away on the end of a toothed blade.
    // Shares the bite throttle, so it still lands on the exact frame the gape
    // animation swings open.
    sawBite: function (size) {
      if (!this.ready || this.muted) return;
      const now = this.ctx.currentTime;
      if (now - this.lastBite < 0.05) return;
      this.lastBite = now;
      const w = Math.max(0, Math.min(1, (size || 10) / 54));
      this.chomp();
      this.tone({ freq: 215 - 88 * w, freqEnd: 46, type: 'square', dur: 0.15 + 0.13 * w, gain: 0.05 + 0.055 * w, attack: 0.004 });
      this.noise({ freq: 3700, freqEnd: 620, filter: 'bandpass', q: 1.7, dur: 0.19 + 0.11 * w, gain: 0.052 + 0.036 * w, attack: 0.006 });
      this.noise({ freq: 840, freqEnd: 130, filter: 'lowpass', dur: 0.1 + 0.08 * w, gain: 0.045 + 0.03 * w, delay: 0.05 });
    },

    // The blade landing on something too big to swallow: a bright zip over a
    // low thunk. Throttled so a crowded lane does not turn into a wall of noise.
    sawSlash: function () {
      if (!this.ready || this.muted) return;
      const now = this.ctx.currentTime;
      if (now - this.lastSlash < 0.13) return;
      this.lastSlash = now;
      this.noise({ freq: 5200, freqEnd: 1100, filter: 'bandpass', q: 2.4, dur: 0.14, gain: 0.04, attack: 0.004 });
      this.tone({ freq: 260, freqEnd: 90, type: 'triangle', dur: 0.13, gain: 0.028, attack: 0.005 });
    },

    // Rip Dash: pressure building under the body, then releasing forward.
    dash: function () {
      if (!this.ready || this.muted) return;
      this.noise({ freq: 240, freqEnd: 3000, filter: 'bandpass', q: 0.85, dur: 0.34, gain: 0.075, attack: 0.02 });
      this.tone({ freq: 145, freqEnd: 640, type: 'sawtooth', dur: 0.26, gain: 0.045, attack: 0.012 });
      this.tone({ freq: 2350, freqEnd: 1150, type: 'triangle', dur: 0.22, gain: 0.022, delay: 0.08 });
      this.noise({ freq: 4200, freqEnd: 900, filter: 'highpass', dur: 0.5, gain: 0.028, delay: 0.14, attack: 0.05 });
    },

    // Hydrodynamic rush while a sawshark is really driving. Distance-free and
    // throttled, so hard swimming reads as speed rather than as a roar.
    sawRush: function (vol) {
      if (!this.ready || this.muted) return;
      const now = this.ctx.currentTime;
      if (now - this.lastRush < 0.3) return;
      this.lastRush = now;
      const v = Math.max(0.2, Math.min(1, vol == null ? 1 : vol));
      this.noise({ freq: 1500, freqEnd: 360, filter: 'bandpass', q: 0.8, dur: 0.44, gain: 0.024 * v, attack: 0.09 });
    },

    // Wing Boost: water filling both wings, then one long heavy downstroke.
    // Deliberately low and slow next to the shark abilities — a manta lifts, it
    // does not fire.
    wingBoost: function () {
      if (!this.ready || this.muted) return;
      this.noise({ freq: 170, freqEnd: 920, filter: 'bandpass', q: 0.9, dur: 0.58, gain: 0.05, attack: 0.2 });
      this.tone({ freq: 86, freqEnd: 152, type: 'sine', dur: 0.72, gain: 0.055, attack: 0.18 });
      this.tone({ freq: 300, freqEnd: 128, type: 'triangle', dur: 0.34, gain: 0.032, delay: 0.17 });
      this.noise({ freq: 1250, freqEnd: 300, filter: 'lowpass', dur: 0.3, gain: 0.04, delay: 0.19 });
    },

    // One stroke of the boost, fired from the beat and throttled to roughly the
    // stroke period, so the push you hear lands under the wing you see.
    wingThrust: function (vol) {
      if (!this.ready || this.muted) return;
      const now = this.ctx.currentTime;
      if (now - this.lastWing < 0.5) return;
      this.lastWing = now;
      const v = Math.max(0.2, Math.min(1, vol == null ? 1 : vol));
      this.noise({ freq: 720, freqEnd: 190, filter: 'bandpass', q: 0.8, dur: 0.42, gain: 0.05 * v, attack: 0.06 });
      this.tone({ freq: 118, freqEnd: 62, type: 'sine', dur: 0.5, gain: 0.048 * v, attack: 0.07 });
    },

    // A glassy swell for the anglerfish lure flaring bright.
    lureFlare: function () {
      if (!this.ready || this.muted) return;
      this.tone({ freq: 880, freqEnd: 1760, type: 'sine', dur: 1.1, gain: 0.032, attack: 0.22 });
      this.tone({ freq: 1320, freqEnd: 1980, type: 'sine', dur: 1.2, gain: 0.02, attack: 0.35, delay: 0.05 });
      this.noise({ freq: 2600, freqEnd: 5200, filter: 'bandpass', dur: 1.4, gain: 0.016, q: 3.2, attack: 0.4 });
    },

    // A Megalodon does not bite, it closes. Deep, wet and a beat longer than
    // any reef jaw, with the sub-bass still ringing under it.
    megaBite: function (size) {
      const s = Math.max(0.4, Math.min(1.4, (size || 40) / 46));
      this.noise({ freq: 900, freqEnd: 120, filter: 'lowpass', dur: 0.3, gain: 0.13, attack: 0.006 });
      this.tone({ freq: 120, freqEnd: 34, type: 'square', dur: 0.34, gain: 0.055 * s, attack: 0.005 });
      this.tone({ freq: 52, freqEnd: 30, type: 'sine', dur: 0.5, gain: 0.05, attack: 0.02, delay: 0.04 });
      this.tone({ freq: 1900, freqEnd: 700, type: 'triangle', dur: 0.1, gain: 0.02, attack: 0.004 });
    },

    // Apex Terror: the roar of the thing in the films. Sub-bass first, then a
    // grind of overtones rolling outward. No film monster ever sounded like a
    // synth blip, so this one lives almost entirely below 200Hz.
    terrorRoar: function () {
      if (!this.ready || this.muted) return;
      const now = this.ctx.currentTime;
      if (now - this.lastRoar < 0.6) return;
      this.lastRoar = now;
      this.tone({ freq: 44, freqEnd: 30, type: 'sine', dur: 2.1, gain: 0.1, attack: 0.05 });
      this.tone({ freq: 92, freqEnd: 54, type: 'sawtooth', dur: 1.5, gain: 0.05, attack: 0.03 });
      this.tone({ freq: 138, freqEnd: 78, type: 'triangle', dur: 1.1, gain: 0.032, attack: 0.09, delay: 0.06 });
      this.tone({ freq: 210, freqEnd: 96, type: 'square', dur: 0.5, gain: 0.014, attack: 0.02, delay: 0.02 });
      this.noise({ freq: 300, freqEnd: 70, filter: 'lowpass', dur: 1.9, gain: 0.06, attack: 0.07 });
      this.noise({ freq: 2400, freqEnd: 480, filter: 'bandpass', q: 1.4, dur: 0.7, gain: 0.022, attack: 0.03, delay: 0.05 });
    },

    // The pressure still in the water while the roar is running. Throttled to
    // about one pulse a second so a held ability never turns into a drone.
    terrorPulse: function (vol) {
      if (!this.ready || this.muted) return;
      const now = this.ctx.currentTime;
      if (now - this.lastTerror < 0.85) return;
      this.lastTerror = now;
      const v = Math.max(0.25, Math.min(1, vol == null ? 1 : vol));
      this.tone({ freq: 58, freqEnd: 38, type: 'sine', dur: 0.9, gain: 0.05 * v, attack: 0.09 });
      this.noise({ freq: 420, freqEnd: 130, filter: 'lowpass', dur: 0.75, gain: 0.026 * v, attack: 0.16 });
    },

    hurt: function () {
      this.tone({ freq: 180, freqEnd: 62, type: 'sawtooth', dur: 0.3, gain: 0.075, attack: 0.005 });
      this.noise({ freq: 500, freqEnd: 120, filter: 'lowpass', dur: 0.2, gain: 0.07 });
    },

    // Nematocysts firing: a bright static crackle over a sickly downward zap,
    // nothing like a jaw. Short, because it lands on top of hurt().
    jellySting: function () {
      this.noise({ freq: 3400, freqEnd: 1600, filter: 'bandpass', q: 2.4, dur: 0.22, gain: 0.05, attack: 0.004 });
      this.tone({ freq: 1450, freqEnd: 240, type: 'triangle', dur: 0.3, gain: 0.038, attack: 0.006 });
      this.tone({ freq: 96, freqEnd: 52, type: 'sine', dur: 0.42, gain: 0.045, attack: 0.05, delay: 0.03 });
    },

    // Ink release: a wet siphon jet that opens into a low, muffled bloom. The
    // jet is the bright part, the bloom is the cloud hitting the water, and the
    // size of the cloud decides how much of the low end comes through.
    inkBlast: function (reach) {
      if (!this.ready || this.muted) return;
      const now = this.ctx.currentTime;
      if (now - this.lastInk < 0.12) return;
      this.lastInk = now;
      const w = Math.max(0, Math.min(1, (reach || 200) / 420));
      this.noise({ freq: 2600, freqEnd: 700, filter: 'bandpass', q: 1.1, dur: 0.2, gain: 0.045, attack: 0.006 });
      this.tone({ freq: 240, freqEnd: 54, type: 'triangle', dur: 0.34, gain: 0.05 + 0.035 * w, attack: 0.01 });
      this.noise({ freq: 900, freqEnd: 130, filter: 'lowpass', dur: 0.55 + 0.35 * w, gain: 0.035 + 0.03 * w, attack: 0.14, delay: 0.05 });
      this.tone({ freq: 62, freqEnd: 34, type: 'sine', dur: 0.85, gain: 0.035 * (0.5 + w), attack: 0.2, delay: 0.08 });
    },

    // What ink feels like from the inside: sight gone, a dull pressure on the
    // eardrums. Kept quiet and throttled, because one cloud can catch a dozen
    // fish on the same frame.
    inkHit: function (radius) {
      if (!this.ready || this.muted) return;
      const now = this.ctx.currentTime;
      if (now - this.lastInkHit < 0.18) return;
      this.lastInkHit = now;
      const w = Math.max(0, Math.min(1, (radius || 30) / 120));
      this.noise({ freq: 420, freqEnd: 90, filter: 'lowpass', dur: 0.3, gain: 0.03 + 0.025 * w, attack: 0.03 });
      this.tone({ freq: 130 - 40 * w, freqEnd: 44, type: 'sine', dur: 0.26, gain: 0.028, attack: 0.02 });
    },

    // Casting the trident: the water closing where the spear was, and a short
    // metallic ring as the bronze leaves the jaws. The size of the animal
    // decides how low the ring sits.
    tridentCast: function (radius) {
      if (!this.ready || this.muted) return;
      const now = this.ctx.currentTime;
      if (now - this.lastCast < 0.1) return;
      this.lastCast = now;
      const w = Math.max(0, Math.min(1, (radius || 40) / 160));
      this.noise({ freq: 3200, freqEnd: 520, filter: 'bandpass', q: 0.9, dur: 0.26, gain: 0.05, attack: 0.005 });
      this.tone({ freq: 880 - 420 * w, freqEnd: 300 - 140 * w, type: 'triangle', dur: 0.3, gain: 0.035, attack: 0.008 });
      this.tone({ freq: 150, freqEnd: 52, type: 'sine', dur: 0.34, gain: 0.04 + 0.03 * w, attack: 0.012 });
    },

    // Bronze finding flesh: a bright strike over a dull thud, throttled hard
    // because one cast can cross a crowded reef in under a second.
    tridentHit: function (radius) {
      if (!this.ready || this.muted) return;
      const now = this.ctx.currentTime;
      if (now - this.lastCastHit < 0.14) return;
      this.lastCastHit = now;
      const w = Math.max(0, Math.min(1, (radius || 30) / 120));
      this.tone({ freq: 1420, freqEnd: 640, type: 'square', dur: 0.1, gain: 0.022, attack: 0.003 });
      this.noise({ freq: 2400, freqEnd: 380, filter: 'bandpass', q: 1.6, dur: 0.16, gain: 0.04, attack: 0.004 });
      this.tone({ freq: 120 - 44 * w, freqEnd: 40, type: 'sine', dur: 0.3, gain: 0.038, attack: 0.01 });
    },

    evolve: function () {
      const notes = [392, 523.25, 659.25, 783.99, 1046.5];
      for (let i = 0; i < notes.length; i++) {
        this.tone({ freq: notes[i], type: 'triangle', dur: 0.42, gain: 0.055, delay: i * 0.085, attack: 0.012 });
        this.tone({ freq: notes[i] * 2, type: 'sine', dur: 0.3, gain: 0.02, delay: i * 0.085 + 0.01 });
      }
      this.noise({ freq: 2200, freqEnd: 5200, filter: 'bandpass', dur: 0.9, gain: 0.035, delay: 0.1, q: 1.2 });
    },

    ability: function () {
      this.tone({ freq: 220, freqEnd: 900, type: 'sine', dur: 0.32, gain: 0.05 });
      this.noise({ freq: 700, freqEnd: 2600, filter: 'bandpass', dur: 0.34, gain: 0.045, q: 1.4 });
    },

    // Orca repertoire: loud, sweeping "blat" calls that carry across the ocean.
    // `vol` is the distance attenuation the caller computed (0..1).
    orcaCall: function (vol) {
      if (!this.ready || this.muted) return;
      const now = this.ctx.currentTime;
      if (now - this.lastOrca < 0.9) return;
      this.lastOrca = now;
      const v = Math.max(0.08, Math.min(1, vol == null ? 1 : vol));
      const root = 620 + Math.random() * 520;
      this.tone({ freq: root, freqEnd: root * 2.3, type: 'sawtooth', dur: 0.5, gain: 0.05 * v, attack: 0.02 });
      this.tone({ freq: root * 1.5, freqEnd: root * 0.7, type: 'sine', dur: 0.62, gain: 0.038 * v, attack: 0.03, delay: 0.06 });
      this.noise({ freq: 1500, freqEnd: 3400, filter: 'bandpass', dur: 0.42, gain: 0.03 * v, q: 2.2, delay: 0.02 });
      // Far calls get a slow low undertone so they feel massive.
      if (v < 0.55) this.tone({ freq: 96, freqEnd: 62, type: 'sine', dur: 0.9, gain: 0.05 * (0.55 - v), attack: 0.08 });
    },

    orcaFeed: function (vol) {
      if (!this.ready || this.muted) return;
      const v = Math.max(0.15, Math.min(1, vol == null ? 1 : vol));
      this.noise({ freq: 900, freqEnd: 90, filter: 'lowpass', dur: 0.34, gain: 0.13 * v });
      this.tone({ freq: 132, freqEnd: 38, type: 'square', dur: 0.36, gain: 0.05 * v, attack: 0.006 });
      this.tone({ freq: 760, freqEnd: 210, type: 'sawtooth', dur: 0.22, gain: 0.03 * v, delay: 0.04 });
    },

    // Surface blow: broadband spray that fades into the wind.
    orcaBreath: function (vol) {
      if (!this.ready || this.muted) return;
      const v = Math.max(0.1, Math.min(1, vol == null ? 1 : vol));
      this.noise({ freq: 600, freqEnd: 2600, filter: 'bandpass', dur: 0.55, gain: 0.05 * v, q: 0.7 });
    },

    // A full-bodied splash on a breach landing: a broad sheet of spray,
    // bright droplets and a low water-thump underneath.
    splash: function (size) {
      if (!this.ready || this.muted) return;
      const w = Math.max(0.45, Math.min(2.2, (size || 30) / 46));
      this.noise({ freq: 1850, freqEnd: 230, filter: 'lowpass', q: 0.8, dur: 0.48 + 0.12 * w, gain: 0.075 + 0.025 * w, attack: 0.003 });
      this.noise({ freq: 4600, freqEnd: 950, filter: 'bandpass', q: 0.7, dur: 0.3 + 0.08 * w, gain: 0.032 + 0.018 * w, delay: 0.025 });
      this.tone({ freq: 118 - 34 * w, freqEnd: 38, type: 'sine', dur: 0.4 + 0.08 * w, gain: 0.04 + 0.025 * w, attack: 0.004 });
    },

    discover: function () {
      if (!this.ready || this.muted) return;
      this.tone({ freq: 784, type: 'triangle', dur: 0.34, gain: 0.05, attack: 0.01 });
      this.tone({ freq: 1174.7, type: 'triangle', dur: 0.42, gain: 0.045, delay: 0.11, attack: 0.01 });
      this.noise({ freq: 3200, freqEnd: 6400, filter: 'bandpass', dur: 0.5, gain: 0.022, delay: 0.08, q: 1.6 });
    },

    click: function () {
      this.tone({ freq: 660, freqEnd: 880, type: 'triangle', dur: 0.06, gain: 0.03 });
    },

    death: function () {
      this.tone({ freq: 240, freqEnd: 48, type: 'sawtooth', dur: 1.1, gain: 0.08, attack: 0.01 });
      this.noise({ freq: 900, freqEnd: 90, filter: 'lowpass', dur: 0.9, gain: 0.06 });
    }
  };

  try {
    Audio.muted = localStorage.getItem('abyss.muted') === '1';
  } catch (e) {
    Audio.muted = false;
  }

  A.Audio = Audio;
})();
