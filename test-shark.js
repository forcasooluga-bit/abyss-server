/* ABYSS.IO — test entry (test_shark.html only).
   The normal game is untouched: this page starts the player as an Apex Shark
   and hands them Poseidon (the Ancient Trident weapon) so the shop, the mouth
   mount, the SPACE charge and the two-second cooldown can be tried without
   grinding the whole ladder first. */
(function () {
  'use strict';

  const A = window.ABYSS;
  if (!A || !A.Shop) return;

  const POSEIDON = 'ancient_trident';
  const S = A.Shop;
  const panel = document.getElementById('testPanel');
  const statusEl = document.getElementById('testStatus');
  let run = null;
  let lastStatus = 0;

  function status(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function toast(text) {
    if (A.game && A.game.ui && A.game.ui.toast) A.game.ui.toast(text, 3600);
  }

  function currentStageKey() {
    const g = A.game;
    if (!g || g.state !== 'playing' || !g.player) return null;
    const st = A.STAGES[g.player.stageIndex];
    return st ? st.key : null;
  }

  // Poseidon owns the same catalogue entry as the Ancient Trident. Grant the
  // exact price if the test purse cannot cover it, then buy and equip through
  // the real shop path so ownership still lands in the normal save.
  function ensurePoseidon(stageKey) {
    const item = S.item(POSEIDON);
    if (!item) return false;

    if (!S.isOwned(POSEIDON)) {
      let missing = (item.price | 0) - S.crystals();
      if (missing > 0) {
        if (A.Quests && A.Quests.addCrystals) A.Quests.addCrystals(missing);
        else if (A.Account && A.Account.addCrystals) A.Account.addCrystals(missing);
        missing = (item.price | 0) - S.crystals();
      }
      if (missing > 0) {
        status('could not grant enough crystals');
        return false;
      }
      const bought = S.buy(POSEIDON);
      if (!bought.ok) {
        toast('Poseidon buy failed: ' + bought.error);
        return false;
      }
    }

    if (!S.isEquipped(POSEIDON)) {
      const res = S.equip(POSEIDON, stageKey || 'shark');
      if (!res.ok) {
        toast('Poseidon equip failed: ' + res.error);
        return false;
      }
    }
    return true;
  }

  function forceStage(key) {
    const g = A.game;
    if (!g || g.state !== 'playing' || !g.player) {
      toast('Start a dive first.');
      return;
    }
    const idx = A.stageByKey(key);
    const stage = A.STAGES[idx];
    if (!stage) return;

    const p = g.player;
    p.stageIndex = idx;
    p.art = stage.art;
    p.colors = stage.palette;
    p.radius = stage.radius;
    p.baseRadius = stage.radius;
    p.speed = stage.speed;
    p.ability = stage.ability;
    p.abilityActiveUntil = 0;
    p.abilityReadyAt = g.sim;
    p.xp = 0;
    p.invulnUntil = g.sim + 2;
    p.health = p.maxHealth;
    p.hunger = p.maxHunger;

    if (ensurePoseidon(stage.key)) p.weapon = POSEIDON;

    if (g.ui && g.ui.banner) {
      g.ui.banner(stage.name.toUpperCase(), 'TEST BUILD — POSEIDON READY (SPACE: CHARGE)', 2600);
    }
    status('stage: ' + stage.name + ' · Poseidon equipped');
  }

  function refreshStatus() {
    const g = A.game;
    if (!g) return;
    if (g.state !== 'playing' || !g.player) {
      status('menu — click DIVE IN, you will spawn as Apex Shark');
      return;
    }
    const st = A.STAGES[g.player.stageIndex];
    const held = S.isEquipped(POSEIDON);
    status((st ? st.name : '?') + ' · Poseidon ' + (held ? 'equipped' : 'not equipped') +
      ' · ' + S.crystals() + ' crystals');
  }

  // A fresh dive gets shark + Poseidon automatically. Restarts and deaths
  // create a new player record, so this runs again without being asked.
  function tick() {
    const now = performance.now();
    const g = A.game;
    if (g && g.state === 'playing' && g.player) {
      if (run !== g.player) {
        run = g.player;
        forceStage('shark');
        toast('TEST BUILD — Apex Shark · Poseidon equipped');
      }
    } else {
      run = null;
    }
    if (!lastStatus || now - lastStatus > 400) {
      lastStatus = now;
      refreshStatus();
    }
  }

  if (panel) {
    panel.addEventListener('click', function (ev) {
      const btn = ev.target.closest ? ev.target.closest('button') : null;
      if (!btn) return;
      if (btn.getAttribute('data-stage')) {
        forceStage(btn.getAttribute('data-stage'));
        return;
      }
      if (btn.id === 'testPoseidon') {
        const ok = ensurePoseidon(currentStageKey());
        toast(ok ? 'Poseidon equipped. SPACE charges through anything.' : 'Could not equip Poseidon.');
        refreshStatus();
        return;
      }
      if (btn.id === 'testShop' && A.ShopUI) A.ShopUI.open('tridents');
    });
  }

  // The shop is ready before the game is, so give the item once on load as
  // well; the per-dive pass above covers account restores and fresh profiles.
  setTimeout(function () {
    if (!S.isOwned(POSEIDON)) ensurePoseidon('shark');
    refreshStatus();
  }, 900);

  // A timer, not rAF: the release build can sit in a background tab while the
  // harness or the player alt-tabs, and the spawn still has to happen.
  setInterval(tick, 200);
  tick();
})();
