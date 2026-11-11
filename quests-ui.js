/* ABYSS.IO — mission board interface
   Draws the MISSIONS / MAP / OPTIONS panel, the crystal chip and the daily
   chest strip. All numbers come from js/quests.js; this file only renders and
   asks for claims. */
(function () {
  const A = window.ABYSS;
  if (!A || !A.Quests) return;

  const Q = A.Quests;
  const $ = function (id) { return document.getElementById(id); };

  const el = {
    panel: $('questPanel'),
    tabs: document.querySelectorAll('.quest-tab'),
    panes: {
      missions: $('questPaneMissions'),
      map: $('questPaneMap'),
      options: $('questPaneOptions')
    },
    cards: $('questCards'),
    chestRow: $('chestRow'),
    chestTimer: $('chestTimer'),
    chestCount: $('chestCount'),
    chip: $('questChip'),
    chipCrystals: $('chipCrystals'),
    badge: $('questBadge'),
    menuBtn: $('questBtn'),
    close: $('questClose'),
    go: $('questGo'),
    map: $('questMap'),
    zoneList: $('zoneList'),
    optSound: $('optSound'),
    optAlerts: $('optAlerts'),
    optMotion: $('optMotion'),
    optStats: $('optStats'),
    optAccount: $('optAccount')
  };

  let tab = 'missions';
  let tick = 0;
  let beat = 0;
  let cardsFor = '';
  let doneSeen = {};
  let frozenByPanel = false;

  // ------------------------------------------------------------------
  // Small helpers
  // ------------------------------------------------------------------
  function num(n) {
    return A.formatNumber ? A.formatNumber(n | 0) : String(n | 0);
  }

  function clock(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  function say(text) {
    if (A.game && A.game.ui && A.game.ui.toast) A.game.ui.toast(text, 3400);
  }

  function alertOn() {
    return Q.pref('alerts', true) !== false;
  }

  function motionOn() {
    return Q.pref('motion', true) !== false;
  }

  // ------------------------------------------------------------------
  // Quest cards
  // ------------------------------------------------------------------
  function iconMarkup(q) {
    if (q.stage || q.food) return '<canvas class="quest-card-art" width="84" height="58"></canvas>';
    return '<span class="quest-card-glyph">' + (Q.ICONS[q.icon] || Q.ICONS.crystal) + '</span>';
  }

  // The card picture is the ocean's own art: the creature renderer for a
  // species, the pickup renderer for food. Nothing here is drawn twice.
  function drawCardArt(canvas, q) {
    // Size the backing store from the box the card actually got, so the same
    // markup stays sharp on a phone and on a 4K desktop instead of capping at
    // 84x58 device pixels.
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(84, Math.round(rect.width) || 84);
    const cssH = Math.max(58, Math.round(rect.height) || 58);
    const scale = Math.max(2, Math.min(3, window.devicePixelRatio || 1));
    canvas.width = Math.round(cssW * scale);
    canvas.height = Math.round(cssH * scale);
    if (q.stage) {
      const idx = A.stageByKey ? A.stageByKey(q.stage) : 0;
      A.FishArt.drawPreview(canvas, idx);
    } else if (q.food && A.foodPreview) {
      A.foodPreview(canvas, q.food);
    }
  }

  function buildCards() {
    const list = Q.board();
    let html = '';
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      const q = it.q;
      html +=
        '<article class="quest-card" data-id="' + q.id + '">' +
          '<span class="quest-card-tag">' + (q.mode === 'dive' ? 'SINGLE DIVE' : '12H') + '</span>' +
          '<div class="quest-card-icon">' + iconMarkup(q) + '</div>' +
          '<p class="quest-card-text">' + q.text + '</p>' +
          '<div class="quest-card-reward"><span>Reward:</span><b>' + num(Q.payout(q).crystals) + '</b>' +
            '<em class="quest-xp">+' + num(Q.payout(q).xp) + ' XP</em></div>' +
          '<div class="quest-card-bar"><i></i><em>0%</em></div>' +
          '<div class="quest-card-where"><span>Where:</span><b>' + q.where + '</b></div>' +
          '<button class="btn ghost quest-card-claim" type="button">' +
            (it.claimed ? 'COLLECTED' : it.done ? 'COLLECT' : 'IN PROGRESS') +
          '</button>' +
        '</article>';
    }
    el.cards.innerHTML = html;

    const cards = el.cards.children;
    for (let i = 0; i < cards.length; i++) {
      const art = cards[i].querySelector('.quest-card-art');
      if (art) drawCardArt(art, list[i].q);
      // Seeding here keeps a mission that was already finished from shouting
      // "ready" again every time the board is rebuilt.
      doneSeen[list[i].q.id] = list[i].done;
    }
    cardsFor = list.map(function (it) { return it.q.id + (it.claimed ? '!' : ''); }).join(',');
    tickCards();
  }

  // One pass that both repaints and shouts. Missions can finish while the
  // board is shut, so the alert has to come from the counters, not the DOM.
  function scanDone() {
    const list = Q.board();
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      const wasDone = doneSeen[it.q.id];
      doneSeen[it.q.id] = it.done;
      if (it.done && !wasDone && !it.claimed) {
        if (alertOn()) say('Mission ready: ' + it.q.text);
        if (A.Audio && A.Audio.discover) A.Audio.discover();
      }
    }
    return list;
  }

  function tickCards() {
    const list = scanDone();
    const cards = el.cards.children;
    for (let i = 0; i < cards.length; i++) {
      const it = list[i];
      if (!it) continue;
      const card = cards[i];
      const pct = Math.round(it.ratio * 100);
      const bar = card.querySelector('.quest-card-bar i');
      const label = card.querySelector('.quest-card-bar em');
      if (bar) bar.style.width = pct + '%';
      if (label) label.textContent = pct >= 100 ? 'DONE' : pct + '%';
      card.classList.toggle('ready', it.done && !it.claimed);
      card.classList.toggle('claimed', it.claimed);
    }
  }

  function claimFromEvent(ev) {
    const btn = ev.target.closest('.quest-card-claim');
    if (!btn) return;
    const card = btn.closest('.quest-card');
    if (!card) return;
    const res = Q.claim(card.getAttribute('data-id'));
    if (res.ok) {
      btn.textContent = 'COLLECTED';
      say('+' + num(res.xp) + ' XP · +' + num(res.crystals) + ' crystals - ' + res.text);
      if (A.Audio && A.Audio.evolve) A.Audio.evolve();
    } else if (res.reason) {
      say(res.reason);
    }
    render();
  }

  // ------------------------------------------------------------------
  // Daily chests
  // ------------------------------------------------------------------
  function buildChests() {
    const list = Q.chests();
    let html = '';
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      html +=
        '<button class="chest-cell' + (c.claimed ? ' opened' : c.ready ? ' ready' : '') + '"' +
          ' data-index="' + c.index + '" type="button"' +
          ' title="' + (c.claimed ? 'Opened' : 'Needs ' + num(c.need) + ' XP this window') + '">' +
          '<span class="chest-glyph">' + Q.ICONS.chest + '</span>' +
          '<span class="chest-pay">' + num(c.crystals) + '</span>' +
          '<span class="chest-need">' + num(c.need) + ' XP</span>' +
        '</button>';
    }
    el.chestRow.innerHTML = html;
  }

  function tickChests() {
    const list = Q.chests();
    const cells = el.chestRow.children;
    for (let i = 0; i < cells.length; i++) {
      const c = list[i];
      if (!c) continue;
      cells[i].classList.toggle('opened', c.claimed);
      cells[i].classList.toggle('ready', c.ready);
      // How far today's XP has run through this chest's own slice of the ladder.
      const prev = i > 0 ? list[i - 1].need : 0;
      const p = c.claimed ? 1 : Math.max(0, Math.min(1, (c.have - prev) / Math.max(1, c.need - prev)));
      cells[i].style.setProperty('--p', Math.round(p * 100) + '%');
    }
    el.chestCount.textContent = (Q.CHESTS.length - list.filter(function (c) { return !c.claimed; }).length) + '/' + Q.CHESTS.length;
    el.chestTimer.textContent = clock(Q.timeLeft());
  }

  function openChest(index) {
    const list = Q.chests();
    const c = list[index];
    if (!c) return;
    if (!c.ready) {
      say(c.claimed ? 'That chest is already open.' : 'Earn ' + num(c.need - c.have) + ' more XP today to open it.');
      return;
    }
    const res = Q.claimChest();
    if (res.ok) {
      say('Chest ' + (res.index + 1) + ' opened - +' + num(res.crystals) + ' crystals');
      if (A.Audio && A.Audio.evolve) A.Audio.evolve();
    } else if (res.reason) say(res.reason);
    render();
  }

  // ------------------------------------------------------------------
  // Chip
  // ------------------------------------------------------------------
  function renderChip() {
    if (el.chipCrystals) el.chipCrystals.textContent = num(Q.crystals());
    const list = Q.board();
    let ready = 0;
    for (let i = 0; i < list.length; i++) if (list[i].done && !list[i].claimed) ready++;
    const chests = Q.chests();
    for (let i = 0; i < chests.length; i++) if (chests[i].ready) ready++;
    if (el.badge) {
      el.badge.hidden = ready === 0;
      el.badge.textContent = ready > 9 ? '9+' : String(ready);
    }
  }

  // ------------------------------------------------------------------
  // Map
  // ------------------------------------------------------------------
  function renderMap() {
    if (!el.map) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = el.map.clientWidth || 640;
    const cssH = 300;
    if (el.map.width !== Math.round(cssW * dpr)) {
      el.map.width = Math.round(cssW * dpr);
      el.map.height = Math.round(cssH * dpr);
      el.map.style.height = cssH + 'px';
    }
    const ctx = el.map.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const zones = A.ZONES;
    const bandH = cssH / zones.length;
    const board = Q.board();
    const where = {};
    for (let i = 0; i < board.length; i++) {
      if (!board[i].claimed) where[board[i].q.where] = (where[board[i].q.where] || 0) + 1;
    }

    for (let i = 0; i < zones.length; i++) {
      const z = zones[i];
      const y = i * bandH;
      const g = ctx.createLinearGradient(0, y, 0, y + bandH);
      g.addColorStop(0, z.tint);
      g.addColorStop(1, i === zones.length - 1 ? '#05060d' : zones[i + 1].tint);
      // Multiply keeps the chart plate showing through, so the depth bands
      // read as cold stains on a glass map rather than neon stripes.
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = g;
      ctx.fillRect(0, y, cssW, bandH + 1);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

      ctx.fillStyle = 'rgba(214, 247, 255, 0.92)';
      ctx.font = '700 11px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(z.name.toUpperCase(), 12, y + bandH * 0.5 + 4);

      ctx.fillStyle = 'rgba(150, 206, 224, 0.75)';
      ctx.font = '600 10px "Segoe UI", system-ui, sans-serif';
      const depth = Math.round(z.y0 * A.WORLD.h / 10);
      ctx.fillText(depth + 'm', cssW - 52, y + bandH * 0.5 + 4);

      if (where[z.name]) {
        ctx.fillStyle = 'rgba(255, 214, 140, 0.95)';
        ctx.font = '700 10px "Segoe UI", system-ui, sans-serif';
        ctx.fillText('MISSION x' + where[z.name], cssW * 0.42, y + bandH * 0.5 + 4);
      }
      ctx.strokeStyle = 'rgba(120, 220, 245, 0.24)';
      ctx.beginPath();
      ctx.moveTo(0, y + bandH);
      ctx.lineTo(cssW, y + bandH);
      ctx.stroke();
    }

    const world = A.game && A.game.world;
    if (world && world.mapMarkers) {
      const ms = world.mapMarkers;
      for (let i = 0; i < ms.length; i++) {
        const m = ms[i];
        const x = (m.x / A.WORLD.w) * cssW;
        const y = (m.y / A.WORLD.h) * cssH;
        ctx.beginPath();
        ctx.arc(x, y, m.seen ? 3.4 : 2.2, 0, Math.PI * 2);
        ctx.fillStyle = m.seen ? 'rgba(190, 244, 255, 0.95)' : 'rgba(140, 200, 220, 0.35)';
        ctx.fill();
      }
    }

    const p = A.game && A.game.player;
    if (p) {
      const x = (p.x / A.WORLD.w) * cssW;
      const y = (p.y / A.WORLD.h) * cssH;
      ctx.beginPath();
      ctx.arc(x, y, 4.6, 0, Math.PI * 2);
      ctx.fillStyle = '#8ff0ff';
      ctx.fill();
      ctx.strokeStyle = 'rgba(2, 16, 26, 0.9)';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    const counters = Q.counters();
    const life = Q.life();
    let html = '';
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i];
      const seen = life['zone.' + z.id] | 0;
      html +=
        '<li class="' + (seen ? 'visited' : '') + '">' +
          '<i style="background:' + z.tint + '"></i>' +
          '<span>' + z.name + '</span>' +
          '<b>' + (z.hazard ? 'DANGER ' + z.hazard : 'SAFE') + '</b>' +
          '<em>' + (seen ? 'visited today' : 'not yet today') + '</em>' +
        '</li>';
    }
    html += '<li class="tally"><span> Sites charted this window</span><b>' + num(counters.sites | 0) + '</b></li>';
    html += '<li class="tally"><span> Metres swum this window</span><b>' + num(Q.diveBest().meters | 0) + '</b></li>';
    el.zoneList.innerHTML = html;
  }

  // ------------------------------------------------------------------
  // Options
  // ------------------------------------------------------------------
  function renderOptions() {
    if (el.optSound) {
      const muted = A.Audio ? !!A.Audio.muted : false;
      el.optSound.textContent = muted ? 'OFF' : 'ON';
    }
    if (el.optAlerts) el.optAlerts.textContent = alertOn() ? 'ON' : 'OFF';
    if (el.optMotion) el.optMotion.textContent = motionOn() ? 'ON' : 'OFF';
    if (el.optAccount) {
      const s = A.Account ? A.Account.status() : { signedIn: false };
      el.optAccount.textContent = s.signedIn
        ? 'Local test account: ' + s.username
        : 'Guest - this device only';
    }
    const life = Q.life();
    const best = Q.diveBest();
    const rows = [
      ['XP banked (lifetime)', num(life.xp | 0)],
      ['Creatures eaten', num(life['fish.any'] | 0)],
      ['Starfish crunched', num(life['food.Starfish'] | 0)],
      ['Dives', num(life.dives | 0)],
      ['Sites charted', num(life.sites | 0)],
      ['Missions collected', num(life.questsDone | 0)],
      ['Chests opened', num(life.chests | 0)],
      ['Crystals earned', num(life.crystals | 0)],
      ['Best dive this window', num(best.xp | 0) + ' XP'],
      ['Longest dive this window', A.formatTime ? A.formatTime(best.time | 0) : (best.time | 0) + 's'],
      ['Furthest dive this window', num(best.meters | 0) + ' m']
    ];
    let html = '';
    for (let i = 0; i < rows.length; i++) {
      html += '<div class="opt-stat"><span>' + rows[i][0] + '</span><b>' + rows[i][1] + '</b></div>';
    }
    el.optStats.innerHTML = html;
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  function render() {
    Q.tick();
    renderChip();
    if (!isOpen()) return;
    const ids = Q.board().map(function (it) { return it.q.id + (it.claimed ? '!' : ''); }).join(',');
    if (ids !== cardsFor) buildCards(); else tickCards();
    if (!el.chestRow.children.length) buildChests();
    tickChests();
    if (tab === 'map') renderMap();
    if (tab === 'options') renderOptions();
  }

  A.QuestsUI = {
    render: render,
    isOpen: isOpen,
    open: open,
    close: close
  };

  // Rare, coarse events (day roll, dive close, claims, crystal moves, another
  // window's claims, a new account). Repaint straight away instead of waiting
  // out the beat.
  Q.onChange(function (why) {
    // A different player's record just took over the board: forget what this
    // one had already seen, or the new board inherits those alerts.
    if (why === 'owner' || why === 'reset') { doneSeen = {}; cardsFor = ''; }
    if (isOpen()) render();
    else renderChip();
  });

  // ------------------------------------------------------------------
  // Open / close
  // ------------------------------------------------------------------
  function isOpen() {
    return !!el.panel && !el.panel.classList.contains('hidden');
  }

  function setTab(name) {
    tab = name;
    for (let i = 0; i < el.tabs.length; i++) {
      el.tabs[i].classList.toggle('active', el.tabs[i].getAttribute('data-tab') === name);
    }
    for (const k in el.panes) {
      if (el.panes[k]) el.panes[k].classList.toggle('active', k === name);
    }
    if (A.Audio && A.Audio.click) A.Audio.click();
    render();
  }

  function open(name) {
    if (!el.panel) return;
    // One dialog at a time, or both claim to have frozen the run and the
    // second one to close leaves the game stuck still.
    if (A.ShopUI && A.ShopUI.isOpen()) A.ShopUI.close();
    if (A.game && A.game.state === 'playing' && !A.game.frozen) {
      A.game.frozen = true;
      frozenByPanel = true;
    }
    el.panel.classList.remove('hidden');
    document.body.classList.add('quests-open');
    setTab(name || tab);
    startBeat();
  }

  function close() {
    if (!isOpen()) return;
    el.panel.classList.add('hidden');
    document.body.classList.remove('quests-open');
    if (frozenByPanel && A.game) A.game.frozen = false;
    frozenByPanel = false;
    Q.flush();
    stopBeat();
  }

  function startBeat() {
    if (beat) return;
    beat = setInterval(function () {
      tick++;
      if (tick % 30 === 0) Q.tick();
      render();
    }, 1000);
  }

  function stopBeat() {
    if (!beat) return;
    clearInterval(beat);
    beat = 0;
    tick = 0;
  }

  // ------------------------------------------------------------------
  // Bindings
  // ------------------------------------------------------------------
  function bind() {
    if (!el.panel) return;
    if (el.chip) el.chip.addEventListener('click', function () { open('missions'); });
    if (el.menuBtn) el.menuBtn.addEventListener('click', function () { open('missions'); });
    el.close.addEventListener('click', close);
    el.go.addEventListener('click', close);
    el.panel.addEventListener('mousedown', function (ev) {
      if (ev.target === el.panel) close();
    });
    for (let i = 0; i < el.tabs.length; i++) {
      el.tabs[i].addEventListener('click', function () {
        setTab(this.getAttribute('data-tab'));
      });
    }
    el.cards.addEventListener('click', claimFromEvent);
    el.chestRow.addEventListener('click', function (ev) {
      const cell = ev.target.closest('.chest-cell');
      if (!cell) return;
      openChest(parseInt(cell.getAttribute('data-index'), 10));
    });

    if (el.optSound) {
      el.optSound.addEventListener('click', function () {
        if (A.game && A.game.ui) A.game.ui.sound();
        else if (A.Audio) { A.Audio.init(); A.Audio.toggleMute(); }
        renderOptions();
      });
    }
    if (el.optAlerts) {
      el.optAlerts.addEventListener('click', function () {
        Q.setPref('alerts', !alertOn());
        renderOptions();
      });
    }
    if (el.optMotion) {
      el.optMotion.addEventListener('click', function () {
        Q.setPref('motion', !motionOn());
        document.body.classList.toggle('quests-still', !motionOn());
        renderOptions();
      });
    }
    document.addEventListener('keydown', function (ev) {
      if (!isOpen()) return;
      if (ev.key === 'Escape') {
        ev.preventDefault();
        close();
      } else if (ev.key === 'q' || ev.key === 'Q') {
        ev.preventDefault();
        close();
      }
    });

    document.body.classList.toggle('quests-still', !motionOn());
  }

  // A slow heartbeat for the chip badge while the panel is shut, so a finished
  // mission lights up the tab without repainting the world.
  setInterval(function () {
    if (isOpen()) return;
    Q.tick();
    scanDone();
    renderChip();
  }, 4000);

  Q.boot();
  bind();
  renderChip();
  if (A.Account && A.Account.onChange) A.Account.onChange(renderChip);
})();
