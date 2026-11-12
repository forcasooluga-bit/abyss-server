# ABYSS.IO realtime multiplayer test

This branch adds the first realtime presence layer without replacing the existing
single-player simulation.

## What this pass does
- Adds a WebSocket endpoint at `/ws` using the `ws` package.
- Relays validated player snapshots to everyone connected to the same Railway
  process.
- Draws other connected players in the existing ocean and exposes the online
  roster to the existing leaderboard.
- Keeps the existing single-player AI, food, combat, account, shop and save
  systems unchanged. Remote players are visual-only in this first pass.

## Deploy/test
1. Review and merge this branch only when ready.
2. Railway should install the new `ws` dependency from `package.json` and run
   the existing `npm start` command.
3. Open the game in two separate browsers/devices and start a dive in both.
4. Confirm both players appear and move in the same world.

## Current limitations
- This is a first presence/synchronization milestone, not authoritative
  multiplayer combat. Eating, damage, abilities, monster arena state and
  progression are still simulated locally.
- Players share one global room on one server process. Multiple Railway
  replicas would need shared room state (for example Redis or a dedicated
  realtime room service).
- No account credentials or passwords are sent over the WebSocket.
