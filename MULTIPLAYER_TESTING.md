# ABYSS.IO realtime multiplayer test

This branch adds realtime player presence and an initial server-checked PvP bite
system while leaving the existing single-player simulation intact.

## What this pass does
- Adds a WebSocket endpoint at `/ws` using the `ws` package.
- Relays validated player snapshots to everyone connected to the same Railway
  process.
- Draws other connected players in the existing ocean and exposes the online
  roster to the existing leaderboard.
- Adds close-range PvP bites: the server checks relative evolution size,
  distance and facing direction, then sends damage to the victim.
- Applies incoming PvP damage through the existing player health, shield,
  invulnerability and death logic.

## Deploy/test
1. Review and merge this branch only when ready.
2. Railway should install the new `ws` dependency from `package.json` and run
   the existing `npm start` command.
3. Open the game in two separate browsers/devices and start a dive in both.
4. Bring the larger animal close to the smaller player's front and test bites.
5. Confirm the victim loses health and the attacker receives a hit confirmation.

## Current limitations
- PvP currently supports close-range bites only. Trident, ink, charge, monster
  arena combat, kill rewards and authoritative progression are not synchronized
  between players yet.
- The server validates bite eligibility and cooldown, but player movement and
  client-side health remain client-reported/client-applied in this milestone.
- Players share one global room on one server process. Multiple Railway
  replicas would need shared room state (for example Redis or a dedicated
  realtime room service).
- No account credentials or passwords are sent over the WebSocket.
