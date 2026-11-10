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

    hurt: function () {
      this.tone({ freq: 180, freqEnd: 62, type: 'sawtooth', dur: 0.3, gain: 0.075, attack: 0.005 });
      this.noise({ freq: 500, freqEnd: 120, filter: 'lowpass', dur: 0.2, gain: 0.07 });
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
