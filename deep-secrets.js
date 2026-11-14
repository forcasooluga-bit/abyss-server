(function () {
  'use strict';

  const A = window.ABYSS;
  if (!A) return;

  const EVENTS = [
    {
      id: 'feeding',
      title: 'FEEDING FRENZY',
      description: 'The reef is overflowing with life. Eat 10 fish before the current fades.',
      target: 10,
      kind: 'fish',
      crystals: 30,
      xp: 70,
      reward: '30 CRYSTALS  +  70 XP'
    },
    {
      id: 'orca',
      title: 'ORCA HUNT',
      description: 'A dangerous predator is roaming these waters. Take down 1 orca before it escapes.',
      target: 1,
      kind: 'predator',
      crystals: 55,
      xp: 120,
      reward: '55 CRYSTALS  +  120 XP'
    }
  ];

  let card, toast, titleEl, descEl, countEl, timeEl, fillEl, rewardEl;
  let active = null;
  let progress = 0;
  let timeLeft = 0;
  let nextAt = 34;
  let hiddenForRun = false;
  let toastUntil = 0;

  function buildUI() {
    if (card) return;
    card = document.createElement('section');
    card.className = 'deep-event-card';
    card.setAttribute('aria-live', 'polite');
    card.innerHTML =
      '<div class="deep-event-kicker">ABYSSAL EVENT</div>' +
      '<h2 class="deep-event-title"></h2>' +
      '<p class="deep-event-desc"></p>' +
      '<div class="deep-event-meta"><span class="deep-event-count"></span><span class="deep-event-time"></span></div>' +
      '<div class="deep-event-track"><div class="deep-event-fill"></div></div>' +
      '<div class="deep-event-reward"></div>';
    toast = document.createElement('div');
    toast.className = 'deep-event-toast';
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(card);
    document.body.appendChild(toast);
    titleEl = card.querySelector('.deep-event-title');
    descEl = card.querySelector('.deep-event-desc');
    countEl = card.querySelector('.deep-event-count');
    timeEl = card.querySelector('.deep-event-time');
    fillEl = card.querySelector('.deep-event-fill');
    rewardEl = card.querySelector('.deep-event-reward');
  }

  function announce(message) {
    buildUI();
    toast.textContent = message;
    toast.classList.add('visible');
    toastUntil = Date.now() + 2800;
  }

  function renderCard() {
    if (!active) return;
    buildUI();
    titleEl.textContent = active.title;
    descEl.textContent = active.description;
    countEl.textContent = progress + ' / ' + active.target;
    timeEl.textContent = Math.ceil(timeLeft) + 's LEFT';
    fillEl.style.width = Math.min(100, progress / active.target * 100) + '%';
    rewardEl.textContent = active.reward;
    card.classList.add('visible');
  }

  function hideCard() {
    if (card) card.classList.remove('visible');
  }

  function queueReward(crystals, xp) {
    let pending = { crystals: 0, xp: 0 };
    try {
      pending = JSON.parse(localStorage.getItem('abyss.deepSecrets.pending') || '{"crystals":0,"xp":0}');
      if (!pending || typeof pending !== 'object') pending = { crystals: 0, xp: 0 };
    } catch (_) { pending = { crystals: 0, xp: 0 }; }
    pending.crystals = Math.max(0, pending.crystals | 0) + crystals;
    pending.xp = Math.max(0, pending.xp | 0) + xp;
    try { localStorage.setItem('abyss.deepSecrets.pending', JSON.stringify(pending)); } catch (_) {}
    deliverPending();
  }

  function deliverPending() {
    if (!A.Account || !A.Account.currentUser || !A.Account.currentUser()) return;
    let pending;
    try { pending = JSON.parse(localStorage.getItem('abyss.deepSecrets.pending') || 'null'); } catch (_) { pending = null; }
    if (!pending || (!pending.crystals && !pending.xp)) return;
    try { localStorage.removeItem('abyss.deepSecrets.pending'); } catch (_) {}
    if (pending.crystals && A.Account.addCrystals) A.Account.addCrystals(pending.crystals).catch(function () {});
    if (pending.xp && A.Account.addXp) A.Account.addXp(pending.xp).catch(function () {});
  }

  function finish(success) {
    if (!active) return;
    const completed = active;
    active = null;
    hideCard();
    if (success) {
      queueReward(completed.crystals, completed.xp);
      announce('EVENT COMPLETE  •  ' + completed.reward);
      if (A.Audio && A.Audio.discover) A.Audio.discover();
    } else {
      announce('EVENT OVER  •  THE OCEAN MOVES ON');
    }
    nextAt += 480;
  }

  function start() {
    if (hiddenForRun || active) return;
    active = EVENTS[Math.random() < 0.68 ? 0 : 1];
    progress = 0;
    timeLeft = 75;
    renderCard();
    announce('NEW ABYSSAL EVENT  •  ' + active.title);
    if (A.game && A.game.ui && A.game.ui.banner) {
      A.game.ui.banner(active.title, active.description, 3200);
    }
  }

  A.DeepSecrets = {
    update: function (dt) {
      buildUI();
      deliverPending();
      if (toast && Date.now() > toastUntil) toast.classList.remove('visible');
      const game = A.game;
      if (!game || game.state !== 'playing') {
        if (!active) hideCard();
        return;
      }
      if (!active && game.runTime >= nextAt && !hiddenForRun) start();
      if (active) {
        timeLeft -= dt;
        if (timeLeft <= 0) finish(false);
        else renderCard();
      }
    },
    onFishEaten: function (fish) {
      if (!active || !fish) return;
      if (active.kind === 'fish' || (active.kind === 'predator' && fish.predator)) {
        progress = Math.min(active.target, progress + 1);
        renderCard();
        if (progress >= active.target) finish(true);
      }
    }
  };
})();
