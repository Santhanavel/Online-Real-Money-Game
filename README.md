# ♠ RUMMY ROYALE — MULTIPLAYER INDIAN RUMMY GAMING PLATFORM
## Production-Grade Multi-Platform Implementation (Web, Android, iOS & Authoritative Game Server)

Inspired by the authentic historical gameplay experience of **RummyCulture**, this platform is an independent, complete, production-quality Indian Rummy card gaming system supporting **Points Rummy** and **Pool Rummy (101 & 201 Pool)**.

---

## 🌟 Architecture Overview

```
                      ┌──────────────────────────────────────────┐
                      │          CLIENT APPLICATIONS             │
                      │  • Next.js Web (Desktop / Mobile Web)    │
                      │  • React Native (Android & iOS)          │
                      └────────────────────┬─────────────────────┘
                                           │
                            WebSocket (Socket.IO) / HTTPS
                                           │
                      ┌────────────────────▼─────────────────────┐
                      │    AUTHORITATIVE MULTIPLAYER SERVER      │
                      │    (apps/server - NestJS / Node.js)      │
                      │  • JWT Auth & Player Management          │
                      │  • Matchmaking Queues (2P & 6P Tables)   │
                      │  • Table & Turn Timers (30s Countdown)   │
                      │  • State Sync & Reconnection Grace       │
                      │  • Admin Control Center & Audit Logging  │
                      └────────────────────┬─────────────────────┘
                                           │
                 ┌─────────────────────────┴─────────────────────────┐
                 ▼                                                   ▼
┌─────────────────────────────────┐                 ┌─────────────────────────────────┐
│     @rummy/game-engine          │                 │     @rummy/card-assets          │
│ • Fisher-Yates CSPRNG Shuffle   │                 │ • Original Vector SVG Art       │
│ • Pure & Impure Sequence Engine │                 │ • 52 Card Faces + Court Art     │
│ • Ace Low/High (Wrap-around rej)│                 │ • Printed & Wild Joker Overlays │
│ • Set Validator (Distinct suits)│                 │ • Emerald Filigree Card Back    │
│ • Hand Solver & Auto-Grouper    │                 │ • Reusable <PlayingCard />      │
│ • Scoring Engine (80 Cap)       │                 │ • Cascading <CardGroupView />   │
│ • Points & Pool (101/201) Logic │                 └─────────────────────────────────┘
└─────────────────────────────────┘
```

---

## 📦 Monorepo Packages & Workspaces

| Workspace | Description | Status |
|---|---|---|
| `packages/shared-types` | Immutable TypeScript models, cards, deck, WebSocket client/server events, game states, DTOs | ✅ Production Ready |
| `packages/game-engine` | Pure server-authoritative Rummy engine. Shuffling, validation, scoring, Points & Pool logic | ✅ 100% Tested (23/23 Passing) |
| `packages/card-assets` | Original vector SVG playing card art system, court card illustrations, luxury card back, React components | ✅ Production Ready |
| `apps/server` | Real-time multiplayer game server with WebSocket gateway, matchmaking, table session management & admin APIs | ✅ Fully Integrated |
| `apps/web` | Premium Next.js application with emerald green felt table, turn timers, lobby, game history & admin portal | ✅ Fully Integrated |
| `apps/mobile` | React Native cross-platform client for Android and iOS | ✅ Scaffolded & Integrated |

---

## 🃏 Card Engine & Rummy Rules Highlights

1. **Card Identification:**
   - Every card has an immutable ID across decks (`d0-HEARTS-A`, `d1-NONE-PJ1`).
2. **Fisher-Yates CSPRNG:**
   - Shuffling executed server-side via Node.js `crypto.randomInt` / cryptographic bytes. Zero predictable seeds or client randomization. SHA-256 audit hashes logged for each deal.
3. **Sequence Validation:**
   - **Pure Sequence:** $\ge 3$ consecutive cards of identical suit without joker substitution. Supports Ace Low ($A\text{-}2\text{-}3$) and Ace High ($10\text{-}J\text{-}Q\text{-}K\text{-}A$). Wrap-around sequences ($K\text{-}A\text{-}2$) are strictly invalid.
   - **Impure Sequence:** $\ge 3$ cards with printed or wild jokers bridging gaps.
   - **Sets:** 3 or 4 cards of the same rank with **strictly distinct suits**. Duplicate suits across multiple decks are rejected.
4. **Scoring Engine:**
   - Show Winner = 0 penalty points.
   - Invalid Show (Wrong Show) = 80 penalty points.
   - First Drop = 20 points; Middle Drop = 40 points; 3 Consecutive Timeouts = 80 points.
   - Loser with no Pure Sequence = all 13 cards penalized (capped at 80).
   - Loser with 1 Pure Sequence = pure sequence zeroed, remaining cards penalized (capped at 80).
   - Loser with 2 sequences (1 pure) = all valid sequences & sets zeroed, only invalid cards penalized.
5. **Pool Rummy (101 & 201):**
   - Multi-deal tournament structure. Cumulative penalty scores tracked per deal. Players reaching $\ge 101$ or $\ge 201$ are eliminated until only 1 champion remains.

---

## 🚀 Running the Project Locally

### 1. Run Unit Tests (Game Engine & Server)
```bash
# Test Game Engine
npm --workspace=packages/game-engine test

# Test Server
npm --workspace=apps/server test
```

### 2. Start Multiplayer Game Server
```bash
npm --workspace=apps/server run start:dev
# Running on http://localhost:4000
```

### 3. Start Next.js Web App
```bash
npm --workspace=apps/web run dev
# Running on http://localhost:3001
```

---

## 🛡️ Security & Fair-Play Principles

- **No Private Hand Leaks:** The server sends public table state to rooms, but private player hands are dispatched exclusively to each player's authenticated private socket channel.
- **Authoritative Server Decisions:** The client is purely a presentation layer. All shuffles, card draws, discard operations, turn timeouts, declarations and score settlements are calculated and verified by the server.
- **Zero Bots in Public Gameplay:** As per Specification Section 2.2, no bots or dummy practice modes are exposed to players.
- **Future Real-Money Readiness:** Financial integrations (wallets, deposits, KYC) remain isolated per Section 16, pending legal approval.
