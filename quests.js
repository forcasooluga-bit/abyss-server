/* ABYSS.IO — quests and daily chests
   The mission board: a daily set of three goals, five chests that unlock as
   the day's XP comes in, and the crystal wallet that pays for them.

   Progress is device-local and, unlike the old device-wide store, it belongs
   to one player: the record is keyed by the signed-in account, or by 'guest'
   when nobody is. Two windows on one account share the same record and have to
   see each other's claims, which is what the merge in syncFromDisk is for.
   The legacy device-wide blob is imported once, for whoever is playing at the
   time, and then left alone as a backup. No network calls. */
(function () {
  const A = window.ABYSS;
  if (!A) return;

  const STORE_LEGACY = 'abyss.quests.v1';
  const STORE = 'abyss.quests.v2';
  const MIGRATED = 'abyss.quests.migrated.v2';
  const PURSE = 'abyss.purse.v1';
  const GUEST = 'guest';
  const PER_DAY = 3;

  // World units to metres. The depth readout already calls y/10 a metre, so
  // the mission board has to agree with it or "swim 1,500m" means two things.
  const UNIT_M = 0.1;

  const ICONS = {
    crystal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M7.4 3.4h9.2L21 9.1 12 20.8 3 9.1z"/><path d="M3 9.1h18M9.2 9.1L12 20.8l2.8-11.7M7.4 3.4l1.8 5.7M16.6 3.4l-1.8 5.7" opacity=".6"/></svg>',
    fish: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.6 12c3.2-4.4 7.6-6.4 11.4-6.4 3.6 0 6.4 2 7.4 6.4-1 4.4-3.8 6.4-7.4 6.4-3.8 0-8.2-2-11.4-6.4z"/><path d="M21.4 12c-1.4-2.6-3.6-4.2-5.8-4.6M21.4 12c-1.4 2.6-3.6 4.2-5.8 4.6" opacity=".7"/><circle cx="7.6" cy="10.6" r="1.1" fill="currentColor" stroke="none"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.6l2.5 6.1 6.6.5-5.1 4.3 1.6 6.4L12 16.4l-5.6 3.5 1.6-6.4-5.1-4.3 6.6-.5z"/><circle cx="12" cy="12" r="1.6" opacity=".55"/></svg>',
    wing: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21.6 6.4c-7.2-.8-13 2.4-16.4 8.4-1 1.8-2.6 2.6-4.2 2.4 4 2.2 9.4 1.2 12.8-1.6 3.4-2.9 6.2-5.4 7.8-9.2z"/><path d="M12.6 3.2c3.2-.4 6 .8 8 3" opacity=".6"/></svg>',
    compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.2"/><path d="M15.6 8.4l-2 5.2-5.2 2 2-5.2z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12.6" r="8.4"/><path d="M12 8.2v4.6l3.2 2.2"/><path d="M9 2.8h6" opacity=".6"/></svg>',
    depth: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13.4"/><path d="M7.2 12.6L12 17.6l4.8-5"/><path d="M3.4 21c2.6-1.4 5-1.4 7.6 0 2.6 1.4 5 1.4 7.6 0" opacity=".65"/></svg>',
    lure: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4.6 18.4c1.8-6.4 5.4-9.8 10.4-10.6"/><circle cx="17.4" cy="6.2" r="2.6"/><path d="M17.4 1.4v1.6M17.4 9.4V11M12.6 6.2h1.6M20.6 6.2h1.6" opacity=".6"/></svg>',
    bubble: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="9" cy="14.6" r="4.6"/><circle cx="17.2" cy="8.4" r="2.6"/><circle cx="14" cy="18.6" r="1.6" opacity=".7"/></svg>',
    dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.6 12h15.2"/><path d="M17.4 9.1l4.4 2.9-4.4 2.9"/><path d="M5.6 10.4l1.1-2.2 1.1 2.2M9.6 10.4l1.1-2.2 1.1 2.2M13.6 10.4l1.1-2.2 1.1 2.2" opacity=".8"/></svg>',
    chest: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.2 10.4c0-3.4 3.9-5.6 8.8-5.6s8.8 2.2 8.8 5.6v8.4H3.2z"/><path d="M3.2 12.6h17.6M12 12.6v5.8" opacity=".7"/><rect x="10.4" y="11.4" width="3.2" height="3.4" rx="1"/></svg>'
  };

  // ------------------------------------------------------------------
  // The pool. `mode` is 'day' (today's counter) or 'dive' (best single dive
  // today). `where` is the hint line, matching the reference board.
  //
  // `stage` and `food` are not gameplay data - they pick the picture. A card
  // that tells you to eat something shows that thing, drawn by the same code
  // that draws it in the ocean.
  // ------------------------------------------------------------------
  const POOL = [
    { id: 'reef_appetite', text: 'Eat 20 reef creatures', metric: 'fish.any', mode: 'day', target: 20, reward: 180, where: 'Any', icon: 'fish', stage: 'coral' },
    { id: 'reef_glutton', text: 'Eat 45 reef creatures', metric: 'fish.any', mode: 'day', target: 45, reward: 320, where: 'Any', icon: 'fish', stage: 'coral' },
    { id: 'shark_hunt', text: 'Eat any 15 Sharks', metric: 'fish.shark', mode: 'day', target: 15, reward: 600, where: 'Open Basin', icon: 'fish', stage: 'shark' },
    { id: 'saw_bill', text: 'Eat 8 Sawsharks', metric: 'fish.sawshark', mode: 'day', target: 8, reward: 640, where: 'Hydrothermal Vents', icon: 'fish', stage: 'sawshark' },
    { id: 'angler_snack', text: 'Eat 6 Anglerfish', metric: 'fish.angler', mode: 'day', target: 6, reward: 480, where: 'Midnight Abyss', icon: 'fish', stage: 'angler' },
    { id: 'octopus_catch', text: 'Eat 2 Octopuses', metric: 'fish.octopus', mode: 'day', target: 2, reward: 420, where: 'The Shelf', icon: 'fish', stage: 'octopus' },
    { id: 'ink_work', text: 'Cloud the water with INK 4 times', metric: 'ability.ink', mode: 'day', target: 4, reward: 300, where: 'The Shelf', icon: 'bubble' },
    { id: 'starfish_crunch', text: 'Crunch 10 starfish', metric: 'food.Starfish', mode: 'day', target: 10, reward: 240, where: 'In the deep', icon: 'star', food: 'Starfish' },
    { id: 'starfish_bed', text: 'Crunch 25 starfish', metric: 'food.Starfish', mode: 'day', target: 25, reward: 460, where: 'In the deep', icon: 'star', food: 'Starfish' },
    { id: 'starfish_harvest', text: 'Crunch 50 starfish', metric: 'food.Starfish', mode: 'day', target: 50, reward: 640, where: 'In the deep', icon: 'star', food: 'Starfish' },
    { id: 'long_swim', text: 'Swim 2,500m in one dive', metric: 'meters', mode: 'dive', target: 2500, reward: 260, where: 'Any', icon: 'wing' },
    { id: 'marathon', text: 'Swim 6,000m today', metric: 'meters', mode: 'day', target: 6000, reward: 340, where: 'Any', icon: 'compass' },
    { id: 'wing_work', text: 'Beat your wings 4 times', metric: 'ability.wingboost', mode: 'day', target: 4, reward: 240, where: 'Coral Gardens', icon: 'wing' },
    { id: 'wing_marathon', text: 'Beat your wings 12 times', metric: 'ability.wingboost', mode: 'day', target: 12, reward: 380, where: 'Open Basin', icon: 'wing' },
    { id: 'boost_train', text: 'Use BUBBLE BOOST 8 times', metric: 'ability.boost', mode: 'day', target: 8, reward: 260, where: 'Sunlit Shallows', icon: 'bubble' },
    { id: 'shield_train', text: 'Raise SHIELD 5 times', metric: 'ability.shield', mode: 'day', target: 5, reward: 280, where: 'Coral Gardens', icon: 'crystal' },
    { id: 'frenzy_train', text: 'Go into FRENZY 3 times', metric: 'ability.frenzy', mode: 'day', target: 3, reward: 320, where: 'Kelp Forest', icon: 'fish' },
    { id: 'chomp_train', text: 'Use BIG CHOMP 6 times', metric: 'ability.chomp', mode: 'day', target: 6, reward: 280, where: 'Coral Gardens', icon: 'fish' },
    { id: 'breach_train', text: 'Breach 4 times', metric: 'ability.breach', mode: 'day', target: 4, reward: 300, where: 'Sunlit Shallows', icon: 'depth' },
    { id: 'terror_train', text: 'Roar with APEX TERROR 3 times', metric: 'ability.terror', mode: 'day', target: 3, reward: 340, where: 'Any', icon: 'fish' },
    { id: 'site_chart', text: 'Chart 4 reef sites', metric: 'sites', mode: 'day', target: 4, reward: 200, where: 'Any', icon: 'compass' },
    { id: 'surveyor', text: 'Chart 9 reef sites', metric: 'sites', mode: 'day', target: 9, reward: 360, where: 'Any', icon: 'compass' },
    { id: 'abyss_dive', text: 'Reach the Midnight Abyss', metric: 'zone.abyss', mode: 'day', target: 1, reward: 300, where: 'Granite Trench', icon: 'depth' },
    { id: 'vent_trip', text: 'Swim through the Vents', metric: 'zone.vents', mode: 'day', target: 1, reward: 300, where: 'Hydrothermal Vents', icon: 'depth' },
    { id: 'kelp_patrol', text: 'Cross the Kelp Forest 3 times', metric: 'zone.kelp', mode: 'day', target: 3, reward: 240, where: 'Kelp Forest', icon: 'compass' },
    { id: 'surface_air', text: 'Visit the Sunlit Shallows 4 times', metric: 'zone.surface', mode: 'day', target: 4, reward: 200, where: 'Sunlit Shallows', icon: 'compass' },
    { id: 'evolve_two', text: 'Evolve twice', metric: 'evolve', mode: 'day', target: 2, reward: 340, where: 'Any', icon: 'fish', stage: 'coral' },
    { id: 'evolve_three', text: 'Evolve three times', metric: 'evolve', mode: 'day', target: 3, reward: 480, where: 'Any', icon: 'fish', stage: 'fast' },
    { id: 'xp_grind', text: 'Bank 1,200 XP today', metric: 'xp', mode: 'day', target: 1200, reward: 300, where: 'Any', icon: 'crystal' },
    { id: 'xp_hoard', text: 'Bank 3,000 XP today', metric: 'xp', mode: 'day', target: 3000, reward: 520, where: 'Any', icon: 'crystal' },
    { id: 'survivor', text: 'Survive 2:30 in one dive', metric: 'time', mode: 'dive', target: 150, reward: 280, where: 'Any', icon: 'clock' },
    { id: 'deep_endurance', text: 'Survive 4:00 in one dive', metric: 'time', mode: 'dive', target: 240, reward: 420, where: 'Any', icon: 'clock' },
    { id: 'plankton_graze', text: 'Graze 40 plankton', metric: 'food.Plankton', mode: 'day', target: 40, reward: 160, where: 'Sunlit Shallows', icon: 'bubble', food: 'Plankton' },
    { id: 'plankton_storm', text: 'Graze 90 plankton', metric: 'food.Plankton', mode: 'day', target: 90, reward: 300, where: 'Sunlit Shallows', icon: 'bubble', food: 'Plankton' },
    { id: 'lure_work', text: 'Flash your lure 5 times', metric: 'ability.lure', mode: 'day', target: 5, reward: 240, where: 'Granite Trench', icon: 'lure' },
    { id: 'dash_work', text: 'Use DASH 6 times', metric: 'ability.dash', mode: 'day', target: 6, reward: 240, where: 'Hydrothermal Vents', icon: 'dash' },
    { id: 'big_feast', text: 'Eat 12 creatures in one dive', metric: 'fish', mode: 'dive', target: 12, reward: 260, where: 'Any', icon: 'fish', stage: 'blue' },
    { id: 'one_dive_gorge', text: 'Eat 25 creatures in one dive', metric: 'fish', mode: 'dive', target: 25, reward: 460, where: 'Any', icon: 'fish', stage: 'blue' },
    { id: 'big_dive_xp', text: 'Score 700 XP in one dive', metric: 'xp', mode: 'dive', target: 700, reward: 340, where: 'Any', icon: 'crystal' },
    { id: 'berry_pick', text: 'Collect 15 Coral Berries', metric: 'food.Coral Berry', mode: 'day', target: 15, reward: 200, where: 'Coral Gardens', icon: 'bubble', food: 'Coral Berry' },
    { id: 'pearl_hunt', text: 'Find 12 Pearls', metric: 'food.Pearl', mode: 'day', target: 12, reward: 340, where: 'Granite Trench', icon: 'crystal', food: 'Pearl' },
    { id: 'manta_mirror', text: 'Glide as a Manta Ray', metric: 'stage.manta', mode: 'day', target: 1, reward: 320, where: 'Open Basin', icon: 'fish', stage: 'manta' },
    { id: 'sawshark_gear', text: 'Evolve into a Sawshark', metric: 'stage.sawshark', mode: 'day', target: 1, reward: 520, where: 'Hydrothermal Vents', icon: 'fish', stage: 'sawshark' },
    { id: 'megalodon_saga', text: 'Become the monster: evolve into a Megalodon', metric: 'stage.megalodon', mode: 'day', target: 1, reward: 720, where: 'Any', icon: 'fish', stage: 'megalodon' },
    { id: 'orca_throne', text: 'Rule the reef as an Orca', metric: 'stage.orca', mode: 'day', target: 1, reward: 900, where: 'Open Basin', icon: 'fish', stage: 'orca' }
  ];

  // Five chests, opened in order as the window's XP arrives. No single
  // payout in the mission board is worth more than 100 crystals.
  const CHESTS = [
    { xp: 300, crystals: 40 },
    { xp: 760, crystals: 60 },
    { xp: 1500, crystals: 80 },
    { xp: 2600, crystals: 100 },
    { xp: 4000, crystals: 100 }
  ];

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  function blank() {
    return {
      date: '',
      board: [],
      claimed: {},
      counters: {},
      diveBest: {},
      life: {},
      chests: 0,
      prefs: {}
    };
  }

  let S = blank();
  let owner = GUEST;

  function ownerKey(o) { return STORE + '#' + o; }

  // Whose record this is. The account layer is synchronous once it has
  // restored the session, and before that everybody is the guest.
  function currentOwner() {
    const st = A.Account && A.Account.status ? A.Account.status() : null;
    if (st && st.signedIn) {
      const u = String(st.username || '').toLowerCase();
      if (u) return u;
    }
    return GUEST;
  }

  function load(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const o = JSON.parse(raw);
      return o && typeof o === 'object' ? o : null;
    } catch (e) { return null; }
  }

  function save(o) {
    try { localStorage.setItem(ownerKey(owner), JSON.stringify(o)); return true; }
    catch (e) { return false; }
  }

  function snapshot() {
    return {
      version: 2,
      owner: owner,
      date: S.date,
      board: S.board,
      claimed: S.claimed,
      counters: S.counters,
      diveBest: S.diveBest,
      life: S.life,
      chests: S.chests,
      prefs: S.prefs
    };
  }

  function apply(o) {
    S = blank();
    S.date = String(o.date || '');
    S.board = Array.isArray(o.board) ? o.board.slice() : [];
    S.claimed = o.claimed || {};
    S.counters = o.counters || {};
    S.diveBest = o.diveBest || {};
    S.life = o.life || {};
    S.chests = o.chests | 0;
    S.prefs = o.prefs || {};
  }

  // The board today, identified by its date and its three mission ids. Two
  // copies of the same board can be merged; two different boards cannot.
  function stampOf(o) { return (o.date || '') + '|' + ((o.board || []).join(',')); }
  function stamp() { return stampOf(S); }

  // The old store was one device-wide blob, so a fresh account inherited the
  // previous player's finished missions. That stops here: the blob is handed
  // to whoever is playing at the moment of the upgrade and then ignored.
  function migrateLegacy() {
    try { if (localStorage.getItem(MIGRATED)) return null; } catch (e) { return null; }
    const legacy = load(STORE_LEGACY);
    try { localStorage.setItem(MIGRATED, '1'); } catch (e) { /* ignore */ }
    if (!legacy) return null;
    save(legacy);
    return legacy;
  }

  function read() {
    owner = currentOwner();
    let o = load(ownerKey(owner));
    if (!o) o = migrateLegacy();
    if (o) apply(o); else S = blank();
  }

  function write() { save(snapshot()); }

  // Take every number in `from` that is ahead of ours. Daily counters only
  // ever climb, so the higher copy is the honest one.
  function maxMap(into, from) {
    if (!from) return false;
    let changed = false;
    for (const k in from) {
      if (!Object.prototype.hasOwnProperty.call(from, k)) continue;
      const v = from[k] | 0;
      if (v > (into[k] | 0)) { into[k] = v; changed = true; }
    }
    return changed;
  }

  function unionInto(into, from) {
    if (!from) return false;
    let changed = false;
    for (const k in from) {
      if (!Object.prototype.hasOwnProperty.call(from, k) || !from[k] || into[k]) continue;
      into[k] = 1;
      changed = true;
    }
    return changed;
  }

  // Fold another window's copy of this record into ours. A second window on
  // the same account is the same player, so a reward it collected is collected
  // here too - and if it rolled a different board, that board wins outright,
  // because keeping our counters would undo the reroll.
  function mergeFrom(o) {
    if (!o) return false;
    if (stampOf(o) !== stamp()) {
      if ((o.date || '') < S.date) return false;
      apply(o);
      return true;
    }
    let changed = false;
    if (unionInto(S.claimed, o.claimed)) changed = true;
    if (maxMap(S.counters, o.counters)) changed = true;
    if (maxMap(S.diveBest, o.diveBest)) changed = true;
    if (maxMap(S.life, o.life)) changed = true;
    if ((o.chests | 0) > S.chests) { S.chests = o.chests | 0; changed = true; }
    return changed;
  }

  // The disk is the authority on what has already been paid out, so it is read
  // before any reward leaves this window.
  function syncFromDisk() {
    if (!mergeFrom(load(ownerKey(owner)))) return false;
    dirty = false;
    write();
    emit('sync');
    return true;
  }

  // Sign in, sign out, or a brand new signup: the record follows the player,
  // so the board is reloaded from that account's own key.
  function setOwner(next) {
    next = String(next || GUEST).toLowerCase() || GUEST;
    if (next === owner) return false;
    flush();
    write();
    owner = next;
    const o = load(ownerKey(owner));
    if (o) apply(o); else S = blank();
    ensureDay();
    write();
    emit('owner');
    return true;
  }

  function purse() {
    try { return Math.max(0, parseInt(localStorage.getItem(PURSE) || '0', 10) || 0); } catch (e) { return 0; }
  }

  function setPurse(n) {
    try { localStorage.setItem(PURSE, String(Math.max(0, n | 0))); } catch (e) { /* ignore */ }
  }

  // ------------------------------------------------------------------
  // Twelve-hour rotation
  // ------------------------------------------------------------------
  // A board lives for one slot: 00:00 to 12:00, then 12:00 to midnight. The
  // key is zero-padded so copies can still be compared as strings, and it
  // carries the slot so a saved board rolls at noon as well as at midnight.
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      '-' + (d.getHours() < 12 ? '0' : '1');
  }

  function msUntilReset() {
    const now = new Date();
    const next = new Date(
      now.getFullYear(), now.getMonth(), now.getDate(),
      now.getHours() < 12 ? 12 : 24, 0, 0, 0
    );
    return Math.max(0, next.getTime() - now.getTime());
  }

  function hash32(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // Same day, same three cards for everyone - and a stable roll if the page is
  // reloaded halfway through.
  function roll(date) {
    const out = [];
    const taken = {};
    let seed = hash32('abyss-' + date);
    let guard = 0;
    while (out.length < PER_DAY && guard++ < 200) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const q = POOL[seed % POOL.length];
      if (!q || taken[q.id]) continue;
      taken[q.id] = 1;
      out.push(q.id);
    }
    return out;
  }

  function byId(id) {
    for (let i = 0; i < POOL.length; i++) if (POOL[i].id === id) return POOL[i];
    return null;
  }

  function ensureDay() {
    const t = today();
    if (S.date === t && S.board.length) return false;
    S.date = t;
    S.claimed = {};
    S.counters = {};
    S.diveBest = {};
    S.chests = 0;
    S.board = roll(t);
    dive = null;
    write();
    emit('day');
    return true;
  }

  // ------------------------------------------------------------------
  // Counters
  // ------------------------------------------------------------------
  function bump(map, key, amount) {
    map[key] = (map[key] | 0) + amount;
  }

  function track(key, amount) {
    if (!amount) return;
    bump(S.counters, key, amount);
    bump(S.life, key, amount);
    markDirty();
  }

  function best(key, value) {
    if (!(value > (S.diveBest[key] | 0))) return;
    S.diveBest[key] = Math.floor(value);
    markDirty();
  }

  function value(q) {
    return q.mode === 'dive' ? (S.diveBest[q.metric] | 0) : (S.counters[q.metric] | 0);
  }

  let dirty = false;
  let saveTimer = 0;
  let pendingMirror = false;

  function markDirty() {
    dirty = true;
    if (saveTimer) return;
    saveTimer = setTimeout(function () { saveTimer = 0; flush(); }, 1400);
  }

  function flush() {
    if (!dirty && !pendingMirror) return;
    dirty = false;
    write();
    if (pendingMirror) { pendingMirror = false; mirror(); }
  }

  // ------------------------------------------------------------------
  // Game events
  // ------------------------------------------------------------------
  let dive = null;

  function diveStart() {
    dive = { xp: 0, fish: 0, meters: 0 };
  }

  function diveEnd(info) {
    if (!info) return;
    const xp = Math.max(0, info.xp | 0);
    track('xp', xp);
    track('dives', 1);
    best('xp', xp);
    best('fish', info.fish | 0);
    best('time', info.time | 0);
    best('meters', dive ? dive.meters : 0);
    // The dive's whole distance counts toward today's odometer quests.
    track('meters', dive ? dive.meters : 0);
    dive = null;
    flush();
    emit('dive');
  }

  function eatFish(f) {
    if (!f) return;
    track('fish.any', 1);
    const stage = A.STAGES[f.stageIndex];
    if (stage) track('fish.' + stage.key, 1);
    if (dive) {
      dive.fish++;
      dive.xp += Math.round(18 + (f.tier || 1) * 16 + (f.radius || 0) * 0.35);
    }
  }

  function eatFood(type, xp) {
    if (!type) return;
    track('food.any', 1);
    track('food.' + type.name, 1);
    if (dive) dive.xp += xp | 0;
  }

  function evolve(stage) {
    if (!stage) return;
    track('evolve', 1);
    track('stage.' + stage.key, 1);
  }

  function ability(ab) {
    if (!ab) return;
    track('ability.any', 1);
    track('ability.' + ab.id, 1);
  }

  function site() { track('sites', 1); }

  function zone(z) { if (z) track('zone.' + z.id, 1); }

  // Called every frame while swimming, so it must stay allocation-free.
  function swim(units) {
    if (dive && units > 0) dive.meters += units * UNIT_M;
  }

  // A live read of the dive so far, for the in-run quest ticker.
  function diveSoFar() {
    return dive;
  }

  // ------------------------------------------------------------------
  // Crystals
  // ------------------------------------------------------------------
  function account() {
    return A.Account && A.Account.currentUser ? A.Account.currentUser() : null;
  }

  // A guest earns into the device purse; signing in moves it onto the account
  // once, so nothing is lost or duplicated.
  function crystals() {
    const acc = account();
    if (acc) return acc.profile.crystals | 0;
    return purse();
  }

  function addCrystals(n) {
    n = n | 0;
    if (!n) return crystals();
    const acc = account();
    if (acc) A.Account.addCrystals(n);
    else setPurse(purse() + n);
    track('crystals', n);
    flush();
    emit('crystals');
    return crystals();
  }

  // Mission XP is paid straight into the lifetime bank. It is deliberately
  // not added to the window counters: a reward completing another mission
  // that then pays more XP would chain forever.
  function addXp(n) {
    n = Math.max(0, n | 0);
    if (!n) return 0;
    const acc = account();
    if (acc && A.Account.addXp) A.Account.addXp(n);
    flush();
    emit('xp');
    return n;
  }

  // What one mission pays: its XP, plus a gem bonus of at most 100.
  function payout(q) {
    const xp = Math.max(0, q.reward | 0);
    return { xp: xp, crystals: Math.min(100, Math.round(xp / 10)) };
  }

  // The purse is emptied before the credit, so a repeat sign-in cannot
  // double-count and a player can log out and earn again later.
  function migratePurse() {
    if (!account()) return;
    const held = purse();
    if (held <= 0) return;
    setPurse(0);
    A.Account.addCrystals(held);
    emit('crystals');
  }

  // ------------------------------------------------------------------
  // Board
  // ------------------------------------------------------------------
  function board() {
    const out = [];
    for (let i = 0; i < S.board.length; i++) {
      const q = byId(S.board[i]);
      if (!q) continue;
      const have = value(q);
      out.push({
        q: q,
        have: have,
        target: q.target,
        ratio: A.clamp(have / q.target, 0, 1),
        done: have >= q.target,
        claimed: !!S.claimed[q.id]
      });
    }
    return out;
  }

  function claim(id) {
    const q = byId(id);
    if (!q) return { ok: false, reason: 'No such mission.' };
    syncFromDisk();
    if (S.claimed[q.id]) return { ok: false, reason: 'Reward already collected.' };
    if (value(q) < q.target) return { ok: false, reason: 'Not finished yet.' };
    S.claimed[q.id] = 1;
    // Persist the claim before the rewards move, so a second window cannot
    // pay the same mission out while this one is still handing it over.
    write();
    const pay = payout(q);
    track('questsDone', 1);
    addCrystals(pay.crystals);
    addXp(pay.xp);
    flush();
    emit('claim');
    return { ok: true, crystals: pay.crystals, xp: pay.xp, text: q.text };
  }

  function chestList() {
    const xpToday = S.counters.xp | 0;
    const out = [];
    for (let i = 0; i < CHESTS.length; i++) {
      const c = CHESTS[i];
      out.push({
        index: i,
        need: c.xp,
        have: xpToday,
        crystals: c.crystals,
        claimed: i < S.chests,
        ready: i === S.chests && xpToday >= c.xp
      });
    }
    return out;
  }

  function claimChest() {
    syncFromDisk();
    const list = chestList();
    for (let i = 0; i < list.length; i++) {
      if (!list[i].ready) continue;
      S.chests = i + 1;
      write();
      track('chests', 1);
      addCrystals(list[i].crystals);
      flush();
      emit('chest');
      return { ok: true, index: i, crystals: list[i].crystals };
    }
    return {
      ok: false,
      reason: S.chests >= CHESTS.length
        ? 'All five chests are open. The board turns over every 12 hours.'
        : 'Earn ' + (list[S.chests].need - (S.counters.xp | 0)) + ' more XP this window to open the next chest.'
    };
  }

  // ------------------------------------------------------------------
  // Account mirror
  // ------------------------------------------------------------------
  function mirror() {
    const acc = account();
    if (!acc || !A.Account.patchProfile) return;
    A.Account.patchProfile({
      quests: {
        date: S.date,
        claimed: Object.keys(S.claimed),
        chests: S.chests,
        crystalsEarned: S.life.crystals | 0,
        lifetime: S.life
      }
    });
  }

  function requestMirror() {
    pendingMirror = true;
    dirty = true;
    markDirty();
  }

  // ------------------------------------------------------------------
  // Listeners
  // ------------------------------------------------------------------
  const listeners = [];

  function emit(why) {
    for (let i = 0; i < listeners.length; i++) {
      try { listeners[i](why); } catch (e) { /* a broken panel must not stop the dive */ }
    }
  }

  function onChange(cb) {
    if (typeof cb === 'function') listeners.push(cb);
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------
  A.Quests = {
    POOL: POOL,
    CHESTS: CHESTS,
    ICONS: ICONS,
    UNIT_M: UNIT_M,

    boot: function () {
      read();
      ensureDay();
      if (A.Account && A.Account.onChange) {
        A.Account.onChange(function (snap) {
          // The session restore lands after boot, so the account can arrive
          // later than the record was opened. Follow it.
          const whose = snap && snap.signedIn ? snap.username : GUEST;
          setOwner(whose);
          if (snap && snap.signedIn) { migratePurse(); requestMirror(); }
          emit('account');
        });
      }
      // localStorage writes from a second window on the same origin surface
      // here, which is what stops that window from re-paying a claim.
      try {
        window.addEventListener('storage', function (ev) {
          if (!ev || ev.key !== ownerKey(owner)) return;
          syncFromDisk();
        });
      } catch (e) { /* nowhere to listen */ }
      write();
      return A.Quests;
    },

    // Keeps the board rolling over in a session that never reloads.
    tick: function () {
      return S.date === today() ? false : ensureDay();
    },

    eatFish: eatFish,
    eatFood: eatFood,
    evolve: evolve,
    ability: ability,
    site: site,
    zone: zone,
    swim: swim,
    diveStart: diveStart,
    diveEnd: diveEnd,
    diveSoFar: diveSoFar,
    track: track,
    best: best,

    board: board,
    claim: claim,
    chests: chestList,
    claimChest: claimChest,
    crystals: crystals,
    addCrystals: addCrystals,
    addXp: addXp,
    payout: payout,
    value: value,
    quest: byId,
    date: today,
    timeLeft: msUntilReset,
    owner: function () { return owner; },
    sync: syncFromDisk,
    life: function () { return S.life; },
    counters: function () { return S.counters; },
    diveBest: function () { return S.diveBest; },
    pref: function (key, fallback) {
      const v = S.prefs[key];
      return v === undefined ? fallback : v;
    },
    setPref: function (key, value) {
      S.prefs[key] = value;
      write();
      emit('pref');
    },
    flush: flush,
    mirror: requestMirror,
    onChange: onChange,
    emit: emit
    // There is no reroll on purpose: the board belongs to the twelve-hour
    // window, so a player cannot redraw missions until the clock turns over.
  };
})();
