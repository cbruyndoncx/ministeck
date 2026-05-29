# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Ministeck Daily Puzzle — a React + Vite + TypeScript PWA where players solve a daily pixel-art puzzle by placing Ministeck-style pieces on a grid. The full product spec is in `docs/daily-puzzle-prd.md`.

## Stack

- **React + Vite + TypeScript** with a PWA service worker and install manifest
- **IndexedDB** for all local persistence (progress, streaks, cached puzzles)
- **Static puzzle JSON** — no backend; admin publishes puzzle files consumed directly by the game

## Commands

Once scaffolded, standard commands will be:

```bash
npm run dev        # local dev server
npm run build      # production build
npm run preview    # preview production build
npm run test       # run unit/integration tests
npm run lint       # lint
```

## Architecture

### Domain Model

| Type | Key fields |
|------|-----------|
| `Puzzle` | `date` (YYYY-MM-DD), `gridWidth`, `gridHeight`, `palette`, `targetCells[]`, `inventory`, `thumbnail` |
| `PieceShape` | `single` \| `domino` \| `triominoLine` \| `triominoCorner` \| `square` |
| `PlacedPiece` | `id`, `shape`, `rotation`, `colorId`, `origin`, `coveredCells[]` |
| `Progress` | `puzzleDate`, `placedPieces[]`, `remainingInventory`, `isComplete`, `timestamps` |

### Key Invariants

- Puzzle key is always `YYYY-MM-DD` in UTC — no timezone conversion on the client.
- Placement is valid only when: within bounds, no cell overlap, every covered cell matches the target color, and inventory is not exhausted.
- Removing a placed piece must restore its inventory slots exactly.
- Completion triggers only when all target cells are correctly covered.

### Piece Shapes & Rotations

Five authentic Ministeck shapes: `1` (single), `1x2` (domino), `1x3` (triominoLine), `L3` (triominoCorner), `2x2` (square). Non-square shapes support rotation. Rotation logic produces covered-cell offsets; unit tests must cover all rotations.

### Admin Flow

Admin route (no auth in v1) uploads an image → crop/position → choose grid size (`24×24`, `32×32`, `48×48`) and palette size (`12`, `18`, `30`) → preview quantized target grid and generated inventory → export as static puzzle JSON for a UTC date.

### PWA Caching

Service worker caches: app shell, today's puzzle JSON, recent puzzle metadata. Player progress persists in IndexedDB independent of network state. If no puzzle is available for today, display the most recent cached puzzle list.

## Test Coverage Required

- Image-to-grid quantization maps every pixel to a valid palette color
- All piece rotation variants produce correct covered-cell offsets
- Placement validation rejects: out-of-bounds, overlap, wrong color, exhausted inventory
- Piece removal restores inventory exactly
- UTC date → puzzle key mapping
- Streak calculation for: consecutive days, missed days, repeat opens
- Integration: place pieces → reload → progress resumes
- Integration: complete puzzle → history/streak updates
- Integration: offline reload opens cached puzzle with saved progress
