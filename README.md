# Cryptopoly

A crypto-themed Monopoly-style board game with **real-time multiplayer** over WebRTC. Built with Next.js, React Three Fiber, and a deterministic game engine.

**P2P by default**: No central server required. Create and join use **copy-paste signaling** (host and guest exchange connection strings in the lobby). All game traffic is peer-to-peer over WebRTC. An optional HTTP signaling API is available for dev or when you prefer a server relay.

![Cryptopoly gameplay](public/screenshot.png)

---

## Table of contents

- [Quick start](#quick-start)
- [Architecture overview](#architecture-overview)
- [Dependencies](#dependencies)
- [How it works](#how-it-works)
- [Game mechanics](#game-mechanics)
- [Implementation tricks](#implementation-tricks)
- [Project structure](#project-structure)
- [Contributing](#contributing)
- [Deploy](#deploy)

---

## Quick start

```bash
pnpm install   # or: npm install
pnpm dev       # or: npm run dev
```

Open [http://localhost:3000](http://localhost:3000). **Create** a game and go to the lobby. **Host** copies the **join link** and shares it (e.g. messaging app). The other player **opens that link** (or pastes it on the home page under “I have a join link”) and enters their name. In the lobby, **guest** copies the **complete link** and sends it to the host; **host** opens that link to finish the connection. Once connected, pick tokens and start the game. No server and no room codes — just the links.

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Next.js App (App Router)                                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────────┐ │
│  │ Home        │  │ Lobby       │  │ Game /game/[roomId]              │ │
│  │ Create/Join │→ │ Token pick  │→ │ 3D board + dice + actions        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
        │                    │                          │
        ▼                    ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  GameConnectionProvider (layout)                                         │
│  When roomId + localPlayerId exist: creates PeerManager, attaches to     │
│  signaling room, wires broadcast/sendToHost → store.applyActionFromNetwork │
│  and STATE_UPDATE → store.applyStateUpdate                               │
└─────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
│  Signaling         │     │  PeerManager       │     │  Game store        │
│  (pluggable)       │◄───►│  (WebRTC)          │◄───►│  (Zustand + Immer) │
│  Default: paste    │     │  Host creates      │     │  gameState +       │
│  (no server);      │     │  offers; guests    │     │  actions → engine  │
│  optional: HTTP API│     │  answer            │     │  applyAction()     │
└───────────────────┘     └───────────────────┘     └───────────────────┘
                                                              │
                                                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Game engine (pure, deterministic)                                      │
│  applyAction(state, action) → newState                                  │
│  Board data: TILES, Chance, Community Chest, movement, rent, validation  │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Host is authority**: The host applies all actions and broadcasts them; guests send `ACTION_REQUEST` to the host. The host applies the action, then sends `STATE_UPDATE` back to the sender (and broadcasts the action to others) so everyone ends up with the same state.
- **Single source of truth**: Game state lives in the Zustand store; the engine is a pure reducer. No duplicate game logic on the server (the API only does signaling).

### Layers (top to bottom)

| Layer | Location | Responsibility |
|-------|----------|----------------|
| **UI / Routes** | `app/`, `components/` | Pages (home, lobby, game), 3D scene (Board, Dice, PlayerTokens), panels (ActionPanel, PlayerPanel, PropertyCard). No game logic. |
| **Connection** | `GameConnectionProvider`, `lib/networking/` | Pluggable signaling: **PasteSignalingClient** (default, no server — copy-paste SDP in lobby) or **HttpSignalingClient** (optional `/api/signaling`). `PeerManager` establishes WebRTC and routes `ACTION_REQUEST` / `STATE_UPDATE` to the store. |
| **State & actions** | `lib/stores/game-store/` | Zustand + Immer. Holds `roomId`, `localPlayerId`, `gameState`, and action creators (lobby, game, trade, sync, UI). All mutations go through the engine via `applyAction`. |
| **Game engine** | `lib/game/engine/` | Pure reducer: `applyAction(state, action) → newState`. Handles movement, rent, dice, tiles, validation. No I/O, no React. |
| **Game data** | `lib/game/board-data/`, `lib/game/constants.ts`, `lib/game/types.ts` | Tiles, Chance/Community Chest cards, display names, board dimensions. Engine and UI both read from here. |

Data flow: **User → Store action → (if host) apply in engine and broadcast; (if guest) sendToHost → host applies → STATE_UPDATE → store merges state.** The engine is the only place that computes new game state.

---

## Dependencies

| Package | Purpose |
|--------|---------|
| **Next.js 16** | App router, API routes (`/api/signaling`), SSR/CSR |
| **React 19** | UI components |
| **Zustand** | Global game store (room, player, gameState, actions) |
| **Immer** | Mutable-looking updates in the store (`draft.gameState = ...`) |
| **React Three Fiber** | React renderer for Three.js (Canvas, useFrame, etc.) |
| **@react-three/drei** | Helpers (Text, RoundedBox, OrbitControls, Environment, Stars) |
| **@react-three/rapier** | Physics (RigidBody, CuboidCollider) for dice |
| **Three.js** | 3D board, tokens, dice meshes, quaternions for face value |
| **nanoid** | Player IDs; internal room id for join URL path |
| **Tailwind CSS 4** | Styling |
| **Framer Motion** | Animations (e.g. modals) |
| **Radix UI** | Accessible primitives (Dialog, Slot) |
| **lucide-react** | Icons |

### Signaling: no server by default

- **Default (paste mode)**: Create uses **createRoomOffline**; join is by **link only**. Host shares a **join link** (`/join/[id]#<offer>`); guest opens it (or pastes it on the home page) and enters their name, then gets a **complete link** to send back; host opens that link to finish. No server and no room codes; once connected, all traffic is P2P over WebRTC.
- **Optional (server mode)**: Use **createRoom** / **joinRoom** to hit `/api/signaling` (HTTP polling). The API creates/joins rooms and relays SDP/ICE. Useful for dev or when you want a central relay; game logic still runs only on clients.

Signaling is **pluggable** (`ISignalingClient`): `PasteSignalingClient` (no server), `HttpSignalingClient` (optional API). `PeerManager` accepts either.

---

## How it works

### 1. Rooms and signaling

- **Default — no server (paste mode)**: Create room → host goes to lobby and copies the **join link** (`/join/[id]#<offer>`). Guest opens that link (or pastes it on the home page under “I have a join link”), enters name, and joins the lobby. Guest copies the **complete link** (`/connect#<answer>`) and sends it to the host; host opens that link to complete the connection. WebRTC connection is established; game messages go over the data channel. No server, no room codes.
- **Optional — server**: POST `/api/signaling` with `create-room` or `join-room`; API generates/returns room code and relays SDP/ICE via polling. Same WebRTC data channel once connected.
- **GameConnectionProvider**: When `roomId` and `localPlayerId` are set, it creates `PeerManager` with the right signaling client (paste or HTTP). PeerManager establishes WebRTC; game messages (`ACTION_REQUEST`, `STATE_UPDATE`) go over RTC data channels.

### 2. Host vs guest

- **Host**: On `ACTION_REQUEST` from any peer, applies the action with `applyActionFromNetwork(action)`, broadcasts the action to all *other* peers, and sends a **STATE_UPDATE** to the *sender* so their UI (e.g. token choice) updates immediately.
- **Guest**: Sends `ACTION_REQUEST` to the host; does not apply locally until the host sends back a STATE_UPDATE (or the host’s broadcast is received; in this design the host explicitly sends state to the sender).

So every mutation flows: **guest → host → apply → STATE_UPDATE to sender + broadcast action to others**.

### 3. State sync and safety

- **JOIN_GAME**: When a guest joins, they send `JOIN_GAME`; the host applies it and can send state. Guests retry sending `JOIN_GAME` every 2s until they see at least 2 players (handles lost or reordered messages). `JOIN_GAME` in the engine is idempotent so retries don’t overwrite existing player data.
- **STATE_UPDATE merge**: When applying an incoming `STATE_UPDATE`, if the local player is missing from the incoming state (e.g. host sent state before our JOIN was applied), we merge the local player from current state so we never “lose” ourselves.

### 4. Game flow

- **Lobby**: Players see each other via `gameState.players` (synced by JOIN_GAME and STATE_UPDATE). Everyone picks a token (crypto icon); host can **Start game** when there are 2–6 players. `START_GAME` sends an authoritative `turnOrder` (host shuffles player IDs) so all clients have the same turn order. Phase goes from `lobby` to `playing`.
- **Playing**: Turn phases are `pre-roll` → (roll) → `action` or `end-turn`. Current player clicks **Roll** → store sets `isRolling = true`. Dice run a **physics roll** (see below). When both dice settle, we call `applyDiceResult(result, seed)` which dispatches `ROLL_DICE` with the seed; host applies it and broadcasts. Others receive state with `currentDiceRoll`, `lastDiceRollId`, `lastDiceRollSeed` and run a **display roll** with the same seed so the animation matches. After the roll, the engine moves the player, applies landing (buy/rent/tax/card/jail/free-parking), and sets `pendingAction` when the player must choose (buy vs auction, pay rent, pay tax, draw card, execute card). When the player has nothing left to do, they click **End turn**; turn advances and `turnPhase` resets to `pre-roll`.

### 5. Dice (deterministic animation)

- **Physics roll (roller)**: A random seed is generated; both dice use a **seeded RNG** (mulberry32) for initial rotation, impulse, and torque. When they settle, we read the face from the rigid body quaternion and call `onRollComplete(result, seed)`. That triggers `applyDiceResult(result, seed)` → `ROLL_DICE` is sent with the seed.
- **Display roll (other clients)**: They receive `currentDiceRoll`, `lastDiceRollId`, and `lastDiceRollSeed`. They create the same RNG from `lastDiceRollSeed` and run the same physics (same impulses/torques). So the dice tumble identically on every screen. We **do not** snap the dice to a “correct” face after landing; we rely on deterministic physics so the final orientation is already correct.
- **Face value**: We map the rigid body’s quaternion to the top face by transforming local face normals to world space and picking the one most aligned with +Y (no Euler heuristics).

---

## Implementation tricks

1. **Seeded RNG (mulberry32)**  
   One seed per roll; same seed ⇒ same sequence of numbers ⇒ same initial rotation/impulse/torque on all clients. Stored in `GameState.lastDiceRollSeed` and passed into the Dice component as `diceRollSeed`.

2. **Roll trigger by `rollId`**  
   `lastDiceRollId` increments only when `ROLL_DICE` is applied. The Dice component triggers the display animation when `rollId` (from state) changes and we have `targetResult` + `diceRollSeed`, and uses a ref so the animation runs exactly once per roll.

3. **Only roller reports result**  
   When the display roll (on the guest) settles, `onRollComplete` still fires. We guard: only call `applyDiceResult` if the current player is the local player. That prevents the guest from sending a second `ROLL_DICE` and moving twice.

4. **Idempotent ROLL_DICE**  
   In the engine, if `currentDiceRoll` already equals the action result and the current player has already rolled, we skip applying again (avoids double movement from any duplicate message).

5. **Refs for RNG in Dice**  
   SingleDie gets `getNextRandom` from a ref so the same RNG instance is used for both dice in order (first 9 values for die1, next 9 for die2) without dependency churn.

6. **Roll in useFrame**  
   The actual “roll” (set position, rotation, apply impulse/torque) runs inside `useFrame` so the rigid body ref and physics world are ready; a single `requestAnimationFrame` in an effect was not reliable.

7. **queueMicrotask for onRollComplete**  
   Reporting the roll result updates the store; we defer with `queueMicrotask` so we don’t update React state during the physics `useFrame` callback and avoid “Cannot update while rendering” issues.

8. **Enclosed dice pit**  
   Dice spawn at y=8 inside an invisible box (floor, four walls, ceiling) so they never leave the pit regardless of bounces.

9. **Board layout**  
   `BOARD_SIZE = 40` (tiles). The 3D board uses a 10-unit square with tile positions computed per side (e.g. `getTilePosition` in `board-data/tiles.ts`) so the classic Monopoly loop (4 sides, 10 tiles each) fits without overlap.

10. **Split engine and store**  
    The engine is in `src/lib/game/engine/` (apply-action, movement, rent, tiles, etc.) and is pure. The store composes actions (lobby, game, trade, sync, UI) and calls `applyAction`; networking is unaware of game rules.

---

## Game mechanics

Cryptopoly follows classic Monopoly rules on a **40-tile** crypto-themed board. All values are in **USDT**.

### Board and tiles

- **Go** (0): Pass or land → collect **200 USDT**.
- **Properties**: 22 spaces in color groups (Meme, Layer 2, DeFi, Smart Contracts, Oracle, Rising Stars, Layer 1, Elite). Each has a price, base rent, and rent tiers for 1–4 houses and hotel. **Railroads** (4 tiles, “Exchanges”): rent depends on how many railroads the owner holds (25 / 50 / 100 / 200). **Utilities** (2 tiles, “Mining & Staking”): rent = dice total × 4 (one owned) or × 10 (both owned).
- **Chance** (“Market Volatility”) and **Community Chest** (“Airdrop”): draw a card; some cards move you, pay/collect money, go to jail, or give Get Out of Jail Free.
- **Tax** (Gas Fees, Capital Gains Tax): pay the amount to **Free Parking**.
- **Jail** (10): “Just visiting” or in jail (see below).
- **Go to Jail** (30): move to Jail, do not collect Go, turn ends.
- **Free Parking** (20): if the pool has money (from tax/card), you collect it; otherwise nothing.

### Economy and turn flow

- **Starting money**: 1,500 USDT per player.
- **Turn**: Current player is in `pre-roll`. They **Roll** (two dice). If they’re in jail, they must pay fine, use a Get Out of Jail Free card, or roll for doubles; after 3 failed attempts they must pay the **50 USDT** fine. **Three doubles in a row** (in one turn) sends the player to Jail.
- After the roll: move that many spaces (0–39, wrap at Go and collect 200 if passing). **Landing** triggers:
  - **Unowned property/railroad/utility**: pending **buy or auction**. Player can **Buy** at list price or **Auction** (all non-bankrupt players bid in turn; high bidder wins, others pass).
  - **Owned by another** (not mortgaged): **Pay rent** (see below).
  - **Chance / Community Chest**: **Draw card** → then **Execute card** (some cards set a new pending action, e.g. pay rent if “advance to railroad” and it’s owned).
  - **Tax**: **Pay tax** (money goes to Free Parking).
  - **Go to Jail**: move to Jail, turn ends.
  - **Free Parking**: collect pool if any.
- When the player has resolved the landing (and any card), they can optionally **build houses**, **sell houses**, **mortgage** or **unmortgage** (unmortgage = mortgage × 1.1).
- **Doubles**: If the roll was a double (and didn’t send the player to jail), after resolving the landing they **Roll Again** as the same player instead of ending the turn — `doublesCount` carries over so a 3rd consecutive double still sends them to Jail. A non-doubles roll ends with **End turn** → next player, `turnPhase` back to `pre-roll`. (Rolling doubles to *leave* jail does not grant an extra roll.)

### Rent and property rules

- **Property**: Base rent; if the owner has a **monopoly** (all of that color), unimproved rent is **double**. With 1–4 houses or a hotel, rent comes from the tile’s rent table. You must build **evenly** (no more than one house ahead of others in the same group).
- **Railroads**: Rent is 25 / 50 / 100 / 200 for 1 / 2 / 3 / 4 owned.
- **Utilities**: Dice total × 4 (one) or × 10 (both).
- **Mortgage**: Pays owner half of the “mortgage value” on the tile; no rent while mortgaged. Must unmortgage at 110% of mortgage value. No building on mortgaged properties; must sell houses to mortgage.

### Jail

- **In jail**: You don’t move. Each turn you may **Pay 50 USDT**, **Use Get Out of Jail Free**, or **Roll**. Doubles → get out, move the rolled total. Otherwise jail turn counter increases; after **3 turns** you must pay the 50 to get out, then move.
- **Get Out of Jail Free**: From Chance or Community Chest; use when in jail to leave without paying (no move that turn when using the card). Card can be kept or traded.

### Trades, bankruptcy, winning

- **Trading**: Players can propose trades (properties + USDT). The other player can **Accept** or **Reject**. On accept, money and properties swap; the engine updates ownership and balances.
- **Bankruptcy**: If you owe more than you can pay (rent, tax, etc.), you **Declare bankruptcy** to the creditor (player or bank). Your cash and properties (and Get Out of Jail Free cards) go to the creditor; you’re out. If you go bankrupt to the bank, your properties are returned to the bank (unowned).
- **Winner**: When only one player is left non-bankrupt, the game ends (`phase: 'finished'`, `winnerId` set).

### Summary of engine behavior

- **Pure reducer**: `applyAction(state, action) → newState`. All moves, rent, jail, cards, trades, and bankruptcy are implemented in `lib/game/engine/` (e.g. `apply-action.ts`, `apply-action-roll.ts`, `tiles.ts`, `rent.ts`, `movement.ts`). The UI and network layer only dispatch actions and display state; they do not duplicate game rules.

---

## Project structure

```
src/
├── app/
│   ├── api/signaling/route.ts    # HTTP polling signaling (create/join room, SDP/ICE)
│   ├── page.tsx                  # Home: create game or paste join link
│   ├── join/[roomId]/page.tsx    # Join page: open/paste join link, enter name
│   ├── connect/page.tsx          # Host opens guest's complete link → redirect to lobby
│   ├── lobby/page.tsx            # Lobby: token pick, copy join/complete links
│   ├── game/[roomId]/page.tsx    # Game: 3D scene + panels + dice handler
│   ├── layout.tsx                # GameConnectionProvider wraps app
│   └── globals.css
├── components/
│   ├── GameConnectionProvider.tsx # Creates PeerManager when in room, wires messages → store
│   ├── game/                     # ActionPanel, PlayerPanel, PropertyCard
│   └── three/                    # Board, Dice, PlayerTokens, Scene (Canvas + Physics)
└── lib/
    ├── game/
    │   ├── types.ts              # GameState, GameAction, tiles, tokens, PropertyGroup, etc.
    │   ├── constants.ts          # GAME_NAME, TILE_NAMES, board dimensions, branding
    │   ├── engine/               # Pure reducer + helpers
    │   │   ├── index.ts          # Public API (applyAction, movePlayer, calculateRent, …)
    │   │   ├── apply-action.ts   # Main reducer; delegates to apply-action-roll for ROLL_DICE
    │   │   ├── state.ts, dice.ts, movement.ts, rent.ts, players.ts, tiles.ts, validation.ts
    │   │   └── constants.ts      # STARTING_MONEY, GO_SALARY, JAIL_*, etc.
    │   └── board-data/           # Static game data
    │       ├── index.ts          # TILES, getTilePosition, shuffleArray
    │       ├── tiles.ts          # Tile definitions (property groups, prices, rent)
    │       ├── chance-cards.ts, community-chest-cards.ts, helpers.ts
    ├── networking/
    │   ├── signaling-interface.ts # ISignalingClient (pluggable signaling)
    │   ├── paste-signaling.ts     # Copy-paste SDP/ICE (no server) — default
    │   ├── http-signaling.ts     # Optional polling client for /api/signaling
    │   ├── peer-manager.ts       # WebRTC: create offer/answer, data channel, send/broadcast
    │   └── signaling.ts          # Optional WebSocket signaling client (not used by default)
    └── stores/
        └── game-store/
            ├── index.ts          # useGameStore (Zustand + Immer), selectTile
            ├── types.ts          # GameStore type
            └── actions/          # Lobby, game, trade, sync, UI action creators
                ├── lobby.ts, game.ts, trade.ts, sync.ts, ui.ts
```

---

## Contributing

We welcome contributions. Here’s how to get started and where to touch the codebase.

### Setup

- **Node**: Use a current LTS version (e.g. Node 20+).
- **Package manager**: The project uses **pnpm**. Install dependencies with `pnpm install` (or `npm install` if you don’t use pnpm).
- **Run locally**: `pnpm dev` (or `npm run dev`), then open [http://localhost:3000](http://localhost:3000).
- **Lint**: `pnpm lint` (or `npm run lint`). Fix any reported issues before submitting.

### Where to change what

| Goal | Where to look |
|------|----------------|
| **New game rule or action** | `lib/game/engine/`: add or extend action handling in `apply-action.ts` (and `apply-action-roll.ts` for dice). Keep the engine pure (no side effects). |
| **New tile type or card** | `lib/game/board-data/` (tiles, chance-cards, community-chest-cards). Update `lib/game/types.ts` if you add new tile/card shapes. |
| **Display names, branding, board size** | `lib/game/constants.ts` (TILE_NAMES, GAME_NAME, etc.) and `lib/game/board-data/helpers.ts` for layout. |
| **UI / panels / 3D board** | `components/game/` (ActionPanel, PlayerPanel, PropertyCard), `components/three/` (Board, Dice, PlayerTokens, Scene). |
| **Lobby, create/join room, connection** | `lib/stores/game-store/actions/lobby.ts`, `GameConnectionProvider.tsx`, `lib/networking/` (paste-signaling, http-signaling, peer-manager). |
| **Trade, sync, or other store actions** | `lib/stores/game-store/actions/` (trade, sync, game, ui). |
| **Signaling (no server vs server)** | Default: `lib/networking/paste-signaling.ts` (copy-paste SDP/ICE). Optional: `app/api/signaling/route.ts` (HTTP polling); `lib/networking/http-signaling.ts`. `lib/networking/signaling-interface.ts` defines the pluggable interface. |

### Conventions

- **Engine purity**: The game engine (`lib/game/engine/`) must remain deterministic and free of I/O. All mutable state lives in the Zustand store; the engine only computes the next state from the current state and action.
- **Types**: Use the shared types in `lib/game/types.ts` for `GameState`, `GameAction`, tiles, and cards. For store shape, use `lib/stores/game-store/types.ts`.
- **Styling**: Tailwind CSS. Prefer utility classes and existing patterns in `app/globals.css`.
- **Commits**: Prefer clear, short messages (e.g. “Add rent calculation for utilities”, “Fix dice roll sync for guests”).

### Pull requests

1. Branch from `main`, make your changes, and run `pnpm lint` and a quick manual test (create room, join, roll, move).
2. Open a PR with a short description of what changed and why.
3. Keep PRs focused; split large features into smaller steps when possible.

---

## Deploy

The app is a standard Next.js app. **By default no server is needed** for signaling (copy-paste in the lobby). If you use the optional `/api/signaling` route, it uses in-memory storage; rooms are lost on restart. For production with server-based signaling you’d replace it with a persistent backend (e.g. WebSockets or a hosted service); the client-side architecture and P2P game traffic stay the same.
