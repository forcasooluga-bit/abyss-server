/* ABYSS.IO — shop
   Ownership and equipment for everything the shop sells. There is no server,
   so "validated server-side" is honoured in the only way available: the
   purchase path is one function, it re-reads the purse before it debits it, it
   refuses anything already owned, and it refuses anything the current
   evolution cannot carry. When a real backend exists this module is where the
   round-trip goes.

   Crystals come from the quest wallet, which already knows the difference
   between a signed-in purse and a guest purse. Ownership goes the same way:
   onto the profile when somebody is signed in, into a device blob when nobody
   is, and the guest blob is folded into the account once at sign-in. */
(function () {
  'use strict';

  const A = window.ABYSS;
  if (!A) return;

  const GUEST_STORE = 'abyss.shop.guest.v1';

  // ------------------------------------------------------------------
  // Catalog
  // ------------------------------------------------------------------
  // The shelves: weapons, cosmetics for them, companions, and the two effect
  // slots. Everything on them shares one ownership list, but only the weapon
  // uses the `equipped` slot; the rest have their own independent slots.
  const CATEGORIES = [
    { key: 'tridents', name: 'Tridents', hint: 'Weapons you hold in your jaws and drive with.' },
    { key: 'trident_skins', name: 'Trident Skins', hint: 'Finishes for Poseidon.' },
    { key: 'pets', name: 'Pets', hint: 'Companions that follow you through the water.' },
    { key: 'kill_effects', name: 'Kill Effects', hint: 'What bursts when you finish a kill.' },
    { key: 'evolution_effects', name: 'Evolution Effects', hint: 'A flourish when you evolve.' }
  ];

  const CATALOG = [
    {
      key: 'ancient_trident',
      cat: 'tridents',
      name: 'Ancient Trident',
      price: 2500,
      rarity: 'Legendary',
      minStage: 'shark',
      cooldown: 2.0,
      desc: "Poseidon's own spear, lifted off a wreck that has been on the floor for ten years. " +
            'Grip it in your jaws and press SPACE to surge forward behind it. ' +
            'Anything the tines touch dies and gives up its XP — orca included. ' +
            'Shark-class and stronger only — a minnow has no business holding this.',
      art: 'trident'
    },
    {
      key: 'abyss_shuriken',
      cat: 'tridents',
      name: 'Abyss Shuriken',
      price: 0,
      rarity: 'Innate',
      minStage: 'shark',
      innate: true,
      desc: 'Not for sale. Every evolution above the anglerfish grows this four-bladed star in ' +
            'its own jaws — the angler itself has none. With no other weapon equipped, SPACE ' +
            'throws it up through the water; it takes a third of the health of anything it touches.',
      art: 'abyss_shuriken'
    },
    {
      key: 'skin_tidewrought',
      cat: 'trident_skins',
      name: 'Tidewrought Poseidon',
      price: 1400,
      rarity: 'Mythic',
      minStage: 'shark',
      desc: 'Abyssal black steel, god-gold inlay and a living turquoise core. ' +
            'A cosmetic finish for Poseidon that leaves every stat and ability untouched.',
      art: 'skin_tidewrought'
    },
    {
      key: 'pet_lionfish',
      cat: 'pets',
      name: 'Lionfish',
      price: 1100,
      rarity: 'Epic',
      desc: 'A real reef lionfish, banded in vermilion and cream, with a fan of venomous spines. ' +
            'Every 14 seconds it flares that fan and rings the nearest hunter and the nearest food ' +
            'bloom for 4 seconds, so nothing big can close in unseen.',
      art: 'pet_lionfish'
    },
    {
      key: 'kill_poseidon_wake',
      cat: 'kill_effects',
      name: "Poseidon's Wake",
      price: 1600,
      rarity: 'Mythic',
      desc: 'A turquoise implosion, a rising school of motes and the fallen creature dissolving into ' +
            'the current. Plays once on every kill you make.',
      art: 'kill_poseidon_wake'
    },
    {
      key: 'evo_abyssal_bloom',
      cat: 'evolution_effects',
      name: 'Abyssal Bloom',
      price: 1200,
      rarity: 'Mythic',
      desc: 'Bioluminescent petals unfurl around the new body, pearls spiral upward and a crown of ' +
            'light closes over the change. Plays automatically on every evolution.',
      art: 'evo_abyssal_bloom'
    }
  ];

  // Catalog category -> the independent slot it occupies. Weapons are handled
  // by `equipped`; everything else can be worn at the same time as the rest.
  const SLOT_BY_CAT = {
    trident_skins: 'skin',
    pets: 'pet',
    kill_effects: 'kill',
    evolution_effects: 'evolution'
  };
  const SLOT_KEYS = ['skin', 'pet', 'kill', 'evolution'];

  function emptySlots() {
    return { skin: null, pet: null, kill: null, evolution: null };
  }

  // Keep only a key that we actually sell, that this player owns, and that
  // belongs in that exact slot. Old saves with no slots simply get empties.
  function sanitizeSlots(raw, owned) {
    const out = emptySlots();
    if (!raw || typeof raw !== 'object') return out;
    for (let i = 0; i < SLOT_KEYS.length; i++) {
      const slot = SLOT_KEYS[i];
      const key = raw[slot];
      const item = BY_KEY[key];
      if (!item || owned.indexOf(key) === -1) continue;
      if (SLOT_BY_CAT[item.cat] !== slot) continue;
      out[slot] = key;
    }
    return out;
  }


  const BY_KEY = {};
  for (let i = 0; i < CATALOG.length; i++) BY_KEY[CATALOG[i].key] = CATALOG[i];

  // The stage a creature has to reach before it can carry anything. Shark is
  // the first "shark and stronger" rung of A.STAGES. Items with no minStage
  // (pets, effects) are available to every stage.
  function stageIndex(key) {
    if (A.stageByKey) return A.stageByKey(key);
    const list = A.STAGES || [];
    for (let i = 0; i < list.length; i++) if (list[i].key === key || list[i].art === key) return i;
    return -1;
  }

  // ------------------------------------------------------------------
  // Where ownership lives
  // ------------------------------------------------------------------
  let state = { owned: [], equipped: null, slots: emptySlots() };
  // Cached so the render loop can ask every frame without touching storage.
  let equippedKey = null;

  function accountProfile() {
    return A.Account && A.Account.profile ? A.Account.profile() : null;
  }

  function signedIn() {
    return !!(A.Account && A.Account.status && A.Account.status().signedIn);
  }

  function fromProfile(p) {
    const owned = Array.isArray(p.weapons) ? p.weapons.slice() : [];
    const weapon = typeof p.equippedWeapon === 'string' ? p.equippedWeapon : null;
    return {
      owned: owned,
      equipped: BY_KEY[weapon] && BY_KEY[weapon].cat === 'tridents' ? weapon : null,
      slots: sanitizeSlots(p.shopSlots, owned)
    };
  }

  function readGuest() {
    try {
      const raw = localStorage.getItem(GUEST_STORE);
      if (!raw) return { owned: [], equipped: null, slots: emptySlots() };
      const o = JSON.parse(raw);
      const owned = Array.isArray(o.owned) ? o.owned.filter(function (k) { return !!BY_KEY[k]; }) : [];
      const weapon = BY_KEY[o.equipped] && BY_KEY[o.equipped].cat === 'tridents' ? o.equipped : null;
      return {
        owned: owned,
        equipped: owned.indexOf(weapon) === -1 ? null : weapon,
        slots: sanitizeSlots(o.slots, owned)
      };
    } catch (e) {
      return { owned: [], equipped: null, slots: emptySlots() };
    }
  }

  function writeGuest(s) {
    try {
      localStorage.setItem(GUEST_STORE, JSON.stringify({ owned: s.owned, equipped: s.equipped, slots: s.slots }));
    } catch (e) { /* a full disk must not stop the dive */ }
  }

  // The single write path. Signed in, ownership rides on the profile so a
  // future server sees it; as a guest it stays on the device.
  function commit(next) {
    // Drop anything that is not in the catalog, and never leave an unequipped
    // or unowned key pointing at nothing.
    next.owned = (next.owned || []).filter(function (k, i) {
      return BY_KEY[k] && next.owned.indexOf(k) === i;
    });
    if (next.equipped) {
      const w = BY_KEY[next.equipped];
      if (!w || w.cat !== 'tridents' || next.owned.indexOf(next.equipped) === -1) next.equipped = null;
    }
    next.slots = sanitizeSlots(next.slots, next.owned);
    state = next;
    equippedKey = state.equipped;
    if (signedIn()) {
      A.Account.patchProfile({
        weapons: state.owned,
        equippedWeapon: state.equipped,
        shopSlots: state.slots
      });
    } else {
      writeGuest(state);
    }
    emit();
    return state;
  }

  function load() {
    state = signedIn() ? fromProfile(accountProfile() || {}) : readGuest();
    if (!signedIn() && accountProfile()) {
      // Signed in but the profile has never seen a shop: adopt the guest
      // shelf once, then let the account own it.
      const guest = readGuest();
      if (guest.owned.length) {
        commit({ owned: guest.owned, equipped: guest.equipped, slots: guest.slots });
        writeGuest({ owned: [], equipped: null, slots: emptySlots() });
        return;
      }
    }
    if (signedIn()) {
      const p = accountProfile() || {};
      if (!Array.isArray(p.weapons) || p.equippedWeapon === undefined || !p.shopSlots) {
        A.Account.patchProfile({
          weapons: state.owned,
          equippedWeapon: state.equipped,
          shopSlots: state.slots
        });
      }
    }
    equippedKey = state.equipped;
  }

  // ------------------------------------------------------------------
  // Purse
  // ------------------------------------------------------------------
  function crystals() {
    if (A.Quests && A.Quests.crystals) return A.Quests.crystals() | 0;
    const p = accountProfile();
    return p ? (p.crystals | 0) : 0;
  }

  // A spend is a negative earn, but only if the wallet can cover it. Checking
  // first is what stops a double-click from buying the same trident twice on
  // the way down.
  function pay(n) {
    n = n | 0;
    if (n <= 0) return true;
    if (crystals() < n) return false;
    if (A.Quests && A.Quests.addCrystals) A.Quests.addCrystals(-n);
    else if (signedIn()) A.Account.addCrystals(-n);
    return true;
  }

  // ------------------------------------------------------------------
  // Purchase / equip
  // ------------------------------------------------------------------
  function buy(key) {
    // A guest has no account to keep a purchase on, so the shelf is closed
    // until they sign up or log in.
    if (!signedIn()) return { ok: false, error: 'Sign up or log in to buy things.' };
    const item = BY_KEY[key];
    if (!item) return { ok: false, error: 'Nothing on the shelf by that name.' };
    if (item.innate) return { ok: false, error: 'The anglerfish grows that in its own jaws — evolve into it.' };
    if (state.owned.indexOf(key) !== -1) return { ok: false, error: 'You already own that.' };
    if (!pay(item.price)) {
      return { ok: false, error: 'Not enough crystals — the mission board pays out.' };
    }
    const owned = state.owned.slice();
    owned.push(key);
    // Buying the first trident puts it in your jaws. Any other shelf fills its
    // own slot if that slot is still empty, so a new pet starts swimming at once
    // without disturbing the weapon or the other cosmetics.
    let equipped = state.equipped;
    const slots = { skin: state.slots.skin, pet: state.slots.pet, kill: state.slots.kill, evolution: state.slots.evolution };
    if (item.cat === 'tridents') {
      equipped = equipped || key;
    } else {
      const slot = SLOT_BY_CAT[item.cat];
      if (slot && !slots[slot]) slots[slot] = key;
    }
    commit({ owned: owned, equipped: equipped, slots: slots });
    return { ok: true, item: item, crystals: crystals() };
  }

  function canCarry(key, stageKey) {
    const item = BY_KEY[key];
    if (!item) return false;
    if (!item.minStage) return true;
    if (!stageKey) return true;
    return stageIndex(stageKey) >= stageIndex(item.minStage);
  }

  function equip(key, stageKey) {
    if (!BY_KEY[key]) return { ok: false, error: 'Nothing on the shelf by that name.' };
    if (state.owned.indexOf(key) === -1) return { ok: false, error: 'Buy it first.' };
    if (!canCarry(key, stageKey)) {
      return { ok: false, error: 'Only shark-class and stronger can carry that.' };
    }
    const item = BY_KEY[key];
    const slot = SLOT_BY_CAT[item.cat];
    if (slot) {
      const slots = { skin: state.slots.skin, pet: state.slots.pet, kill: state.slots.kill, evolution: state.slots.evolution };
      slots[slot] = key;
      commit({ owned: state.owned.slice(), equipped: state.equipped, slots: slots });
      return { ok: true, item: item, slot: slot };
    }
    commit({ owned: state.owned.slice(), equipped: key, slots: state.slots });
    return { ok: true, item: item };
  }

  // Unequipping knows which shelf the key came from: a cosmetic clears its own
  // slot, a weapon leaves the jaws.
  function unequip(key) {
    const item = key ? BY_KEY[key] : null;
    const slot = item ? SLOT_BY_CAT[item.cat] : null;
    if (slot) {
      const slots = { skin: state.slots.skin, pet: state.slots.pet, kill: state.slots.kill, evolution: state.slots.evolution };
      if (slots[slot] === key) slots[slot] = null;
      commit({ owned: state.owned.slice(), equipped: state.equipped, slots: slots });
      return { ok: true };
    }
    commit({ owned: state.owned.slice(), equipped: null, slots: state.slots });
    return { ok: true };
  }

  function slotOf(cat) {
    return SLOT_BY_CAT[cat] || null;
  }

  function activeSlot(slot) {
    return state.slots[slot] || null;
  }

  function isSlotEquipped(key) {
    for (let i = 0; i < SLOT_KEYS.length; i++) {
      if (state.slots[SLOT_KEYS[i]] === key) return true;
    }
    return false;
  }

  // What the render loop asks for, once per creature per frame. Returns a
  // catalog key or null; never touches storage and never allocates.
  function heldFor(stageKey) {
    if (!equippedKey) return null;
    if (stageKey && !canCarry(equippedKey, stageKey)) return null;
    return equippedKey;
  }

  // ------------------------------------------------------------------
  // Queries
  // ------------------------------------------------------------------
  function itemsIn(cat) {
    return CATALOG.filter(function (it) { return it.cat === cat; });
  }

  const listeners = [];
  function emit() {
    for (let i = 0; i < listeners.length; i++) {
      try { listeners[i](); } catch (e) { /* a broken panel must not stop the dive */ }
    }
  }

  A.Shop = {
    CATEGORIES: CATEGORIES,
    CATALOG: CATALOG,
    GATE_STAGE: 'shark',

    boot: function () {
      load();
      if (A.Account && A.Account.onChange) {
        // The session restore lands after boot, so the account can arrive
        // later than the shelf was first opened. Follow it.
        A.Account.onChange(function () { load(); emit(); });
      }
      try {
        window.addEventListener('storage', function (ev) {
          if (ev && ev.key === GUEST_STORE && !signedIn()) { load(); emit(); }
        });
      } catch (e) { /* nowhere to listen */ }
      return A.Shop;
    },

    item: function (key) { return BY_KEY[key] || null; },
    itemsIn: itemsIn,
    owned: function () { return state.owned; },
    isOwned: function (key) { return state.owned.indexOf(key) !== -1; },
    equipped: function () { return equippedKey; },
    isEquipped: function (key) { return equippedKey === key; },
    canCarry: canCarry,
    stageIndex: stageIndex,
    crystals: crystals,
    buy: buy,
    equip: equip,
    unequip: unequip,
    slotOf: slotOf,
    activeSlot: activeSlot,
    isSlotEquipped: isSlotEquipped,
    slots: function () { return state.slots; },
    heldFor: heldFor,
    onChange: function (cb) { if (typeof cb === 'function') listeners.push(cb); },
    refresh: function () { load(); emit(); }
  };

  // The shelf opens itself: game.js asks what is carried on the very first
  // frame, which is before any panel has been looked at.
  A.Shop.boot();
})();
