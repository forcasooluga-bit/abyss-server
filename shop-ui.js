/* ABYSS.IO — shop interface
   The five shelves, the buy/equip buttons and the purse. js/shop.js owns the
   numbers and the saves; this file only paints them and asks for actions.
   It borrows the mission board's furniture wholesale, because a player who
   knows one panel already knows the other. */
(function () {
  const A = window.ABYSS;
  if (!A || !A.Shop) return;

  const S = A.Shop;
  const $ = function (id) { return document.getElementById(id); };

  const el = {
    panel: $('shopPanel'),
    tabs: $('shopTabs'),
    pane: $('shopPane'),
    heading: $('shopHeading'),
    sub: $('shopSub'),
    cards: $('shopCards'),
    purse: $('shopPurse'),
    close: $('shopClose'),
    go: $('shopGo'),
    menuBtn: $('shopBtn'),
    chip: $('shopChip')
  };
  if (!el.panel) return;

  let cat = S.CATEGORIES[0].key;
  let tabButtons = [];
  let cardsFor = '';
  let frozenByPanel = false;
  let beat = 0;

  // ------------------------------------------------------------------
  // Small helpers
  // ------------------------------------------------------------------
  function num(n) {
    return A.formatNumber ? A.formatNumber(n | 0) : String(n | 0);
  }

  function say(text) {
    if (A.game && A.game.ui && A.game.ui.toast) A.game.ui.toast(text, 3400);
  }

  function click() {
    if (A.Audio && A.Audio.click) A.Audio.click();
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // A guest has no account to keep a purchase on, so the shelf reads only.
  const GUEST_LINE = 'Sign up or log in to buy things.';
  function isGuest() {
    return !(A.Account && A.Account.status && A.Account.status().signedIn);
  }

  // Which creature you are right now. Nothing is carried into the menu: the
  // trident lives in the jaws, so it only exists while a run is up.
  function playerStageKey() {
    const g = A.game;
    if (!g || g.state !== 'playing' || !g.player) return null;
    const st = A.STAGES ? A.STAGES[g.player.stageIndex] : null;
    return st ? st.key : null;
  }

  function category(key) {
    const list = S.CATEGORIES;
    for (let i = 0; i < list.length; i++) if (list[i].key === key) return list[i];
    return list[0];
  }

  // ------------------------------------------------------------------
  // Tabs
  // ------------------------------------------------------------------
  function buildTabs() {
    const frag = document.createDocumentFragment();
    tabButtons = [];
    for (let i = 0; i < S.CATEGORIES.length; i++) {
      const c = S.CATEGORIES[i];
      const b = document.createElement('button');
      b.className = 'quest-tab' + (c.key === cat ? ' active' : '');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('data-cat', c.key);
      b.textContent = c.name.toUpperCase();
      b.addEventListener('click', function () { setCat(this.getAttribute('data-cat')); });
      frag.appendChild(b);
      tabButtons.push(b);
    }
    // The purse and the close button are static markup that live at the right
    // end of the strip, so the new tabs go in front of them.
    const stale = el.tabs.querySelectorAll('.quest-tab');
    for (let i = 0; i < stale.length; i++) el.tabs.removeChild(stale[i]);
    el.tabs.insertBefore(frag, el.purse || el.close);
  }

  function setCat(key) {
    if (!S.CATEGORIES.some(function (c) { return c.key === key; })) return;
    cat = key;
    for (let i = 0; i < tabButtons.length; i++) {
      tabButtons[i].classList.toggle('active', tabButtons[i].getAttribute('data-cat') === cat);
    }
    click();
    render();
  }

  // ------------------------------------------------------------------
  // Cards
  // ------------------------------------------------------------------
  function emptyMarkup(c) {
    return '<div class="shop-empty">' +
      '<span class="shop-empty-glyph">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M3.6 9.4 12 4.2l8.4 5.2"/><path d="M5.4 9.4v9.2h13.2V9.4"/><path d="M9.4 18.6v-5.2h5.2v5.2"/>' +
        '</svg>' +
      '</span>' +
      '<p class="shop-empty-title">NOTHING ON THIS SHELF YET</p>' +
      '<p class="shop-empty-text">' + esc(c.hint) + ' These shelves are real but they are still empty - ' +
        'the items that will fill them have not been designed, and a placeholder would be a lie.</p>' +
    '</div>';
  }

  function cardMarkup(it) {
    const owned = S.isOwned(it.key);
    const equipped = S.isEquipped(it.key) || (S.isSlotEquipped ? S.isSlotEquipped(it.key) : false);
    const purse = S.crystals();
    const guest = isGuest();
    const innate = !!it.innate;
    const afford = !innate && !guest && purse >= it.price;
    const stage = playerStageKey();
    const carry = stage ? S.canCarry(it.key, stage) : true;
    const slot = S.slotOf ? S.slotOf(it.cat) : null;

    let act = 'buy', label = 'BUY · ' + num(it.price), cls = '';
    if (innate) { act = 'none'; label = 'SHARK & UP'; cls = ' poor'; }
    else if (equipped) { act = 'unequip'; label = slot ? 'UNEQUIP' : 'PUT DOWN'; cls = ' equipped'; }
    else if (owned) { act = 'equip'; label = 'EQUIP'; cls = ' owned'; }
    else if (guest) { cls = ' poor'; }
    else if (!afford) { cls = ' poor'; }

    let note = owned ? 'In your vault' : 'Needs ' + num(it.price) + ' crystals';
    if (it.minStage) note += ' · ' + esc(it.minStage) + ' class and stronger';
    else if (slot) note += ' · fits every evolution';
    if (it.cooldown) note += ' · ' + it.cooldown.toFixed(1) + 's cooldown';
    if (innate) note = 'Carried by the shark and every form above it — the angler has none.';
    else if (guest && !owned) note = GUEST_LINE;

    return '<article class="quest-card shop-card' + cls + '" data-key="' + it.key + '">' +
      '<span class="quest-card-tag">' + esc(it.rarity || 'Item').toUpperCase() + '</span>' +
      '<div class="quest-card-icon"><canvas class="quest-card-art shop-card-art" width="84" height="58"></canvas></div>' +
      '<p class="quest-card-text">' + esc(it.name) + '</p>' +
      '<p class="shop-card-desc">' + esc(it.desc) + '</p>' +
      '<div class="quest-card-reward"><span>' + (innate ? 'Source' : owned ? 'Paid' : 'Price') + ':</span><b>' +
        (innate ? 'Shark' : num(it.price)) + '</b></div>' +
      '<div class="shop-card-note">' + note + '</div>' +
      (equipped && !carry ? '<div class="shop-card-warn">Too small to hold this - evolve past it.</div>' : '') +
      '<button class="btn ghost shop-card-buy" type="button" data-act="' + act + '"' +
        (innate ? ' disabled' : (owned || equipped || afford ? '' : ' disabled')) + '>' + label + '</button>' +
    '</article>';
  }

  function signature(items) {
    const stage = playerStageKey();
    let flags = '';
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const worn = S.isEquipped(it.key) || (S.isSlotEquipped && S.isSlotEquipped(it.key));
      flags += (S.isOwned(it.key) ? (worn ? 'e' : 'o') : S.crystals() >= it.price ? 'a' : '-');
    }
    return cat + '|' + S.owned().join(',') + '|' + (S.equipped() || '') + '|' +
      (S.slots ? JSON.stringify(S.slots()) : '') + '|' + flags + '|' + (stage || 'menu') +
      '|' + (isGuest() ? 'guest' : 'member');
  }

  function build(c, items) {
    if (!items.length) {
      el.cards.innerHTML = emptyMarkup(c);
      cardsFor = signature(items);
      return;
    }
    let html = '';
    for (let i = 0; i < items.length; i++) html += cardMarkup(items[i]);
    el.cards.innerHTML = html;
    const nodes = el.cards.children;
    const scale = Math.max(2, Math.min(3, window.devicePixelRatio || 1));
    for (let i = 0; i < nodes.length; i++) {
      const canvas = nodes[i].querySelector('.shop-card-art');
      if (!canvas) continue;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(Math.max(84, rect.width || 132) * scale);
      canvas.height = Math.round(Math.max(58, rect.height || 91) * scale);
      const key = nodes[i].getAttribute('data-key');
      if (A.Collection && A.Collection.drawPreview(canvas, key)) continue;
      if (A.Weapons) A.Weapons.drawPreview(canvas, key);
    }
    cardsFor = signature(items);
  }

  // ------------------------------------------------------------------
  // Buy / equip
  // ------------------------------------------------------------------
  function equipLine(kind) {
    if (kind === 'pets') return 'is now swimming with you.';
    if (kind === 'evolution_effects') return 'equipped. Your next evolution will bloom.';
    if (kind === 'kill_effects') return 'equipped. Your kills will wake the sea.';
    if (kind === 'trident_skins') return 'is wrapped around the Ancient Trident.';
    return 'in your jaws. Press SPACE to charge and ram anything.';
  }

  function actFromEvent(ev) {
    const btn = ev.target.closest('.shop-card-buy');
    if (!btn || btn.disabled) return;
    const card = btn.closest('.shop-card');
    if (!card) return;
    const key = card.getAttribute('data-key');
    const act = btn.getAttribute('data-act');
    const item = S.item(key);
    const stage = playerStageKey();

    if (act === 'buy') {
      const res = S.buy(key);
      if (res.ok) {
        say(item.name + ' is yours - ' + num(res.crystals) + ' crystals left.');
        if (A.Audio && A.Audio.evolve) A.Audio.evolve();
      } else {
        say(res.error);
        click();
      }
    } else if (act === 'equip') {
      const res = S.equip(key, stage);
      if (res.ok) {
        say(item.name + ' ' + equipLine(item && item.cat));
        click();
      } else {
        say(res.error);
        click();
      }
    } else {
      S.unequip(key);
      say('You put the ' + item.name + ' back on your vault shelf.');
      click();
    }
    render();
  }

  // ------------------------------------------------------------------
  // Repaint
  // ------------------------------------------------------------------
  function render() {
    const c = category(cat);
    const items = S.itemsIn(cat);
    const guest = isGuest();
    el.heading.textContent = c.name.toUpperCase();
    el.sub.textContent = guest
      ? GUEST_LINE
      : items.length
        ? c.hint + ' Bought once, yours forever - everything you own stays in your vault.'
        : c.hint;
    if (el.purse) el.purse.textContent = num(S.crystals());
    if (signature(items) !== cardsFor) build(c, items);
    else {
      // The purse moves while the panel is open, so the numbers still need a
      // pass even when the shelf itself has not changed shape.
      const nodes = el.cards.querySelectorAll('.shop-card');
      for (let i = 0; i < nodes.length; i++) {
        const it = S.item(nodes[i].getAttribute('data-key'));
        if (!it) continue;
        const btn = nodes[i].querySelector('.shop-card-buy');
        const afford = !guest && S.crystals() >= it.price;
        if (btn && btn.getAttribute('data-act') === 'buy') {
          btn.disabled = !afford;
          nodes[i].classList.toggle('poor', !afford);
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // Open / close
  // ------------------------------------------------------------------
  function isOpen() {
    return !el.panel.classList.contains('hidden');
  }

  function open(key) {
    if (key) cat = key;
    if (A.QuestsUI && A.QuestsUI.isOpen()) A.QuestsUI.close();
    if (A.game && A.game.state === 'playing' && !A.game.frozen) {
      A.game.frozen = true;
      frozenByPanel = true;
    }
    el.panel.classList.remove('hidden');
    document.body.classList.add('shop-open');
    if (!tabButtons.length) buildTabs();
    setCat(cat);
    startBeat();
  }

  function close() {
    if (!isOpen()) return;
    el.panel.classList.add('hidden');
    document.body.classList.remove('shop-open');
    if (frozenByPanel && A.game) A.game.frozen = false;
    frozenByPanel = false;
    stopBeat();
  }

  function toggle() {
    if (isOpen()) close(); else open();
  }

  function startBeat() {
    if (beat) return;
    beat = setInterval(render, 1000);
  }

  function stopBeat() {
    if (!beat) return;
    clearInterval(beat);
    beat = 0;
  }

  // ------------------------------------------------------------------
  // Bindings
  // ------------------------------------------------------------------
  buildTabs();

  if (el.menuBtn) el.menuBtn.addEventListener('click', function () { open('tridents'); });
  if (el.chip) el.chip.addEventListener('click', function () { open(); });
  el.close.addEventListener('click', close);
  el.go.addEventListener('click', close);
  el.panel.addEventListener('mousedown', function (ev) {
    if (ev.target === el.panel) close();
  });
  el.cards.addEventListener('click', actFromEvent);

  document.addEventListener('keydown', function (ev) {
    if (!isOpen()) return;
    if (ev.key === 'Escape' || ev.key === 'b' || ev.key === 'B') {
      ev.preventDefault();
      close();
    }
  });

  // A purchase, a claim or a sign-in can all move the shelf; the panel follows
  // whichever one happened.
  S.onChange(function () { cardsFor = ''; if (isOpen()) render(); });
  if (A.Account && A.Account.onChange) {
    A.Account.onChange(function () { cardsFor = ''; if (isOpen()) render(); else renderPurse(); });
  }

  function renderPurse() {
    if (el.purse) el.purse.textContent = num(S.crystals());
  }

  A.ShopUI = { open: open, close: close, toggle: toggle, isOpen: isOpen, render: render };
})();
