# Daily Puzzle PRD + Implementation Plan

## Summary

Build a greenfield React + Vite PWA feature for a Ministeck-style Daily Puzzle. Each UTC day has one admin-published puzzle generated from an uploaded image. Players solve it locally using a finite inventory of authentic Ministeck piece shapes: `1`, `1x2`, `1x3`, `L3`, and `2x2`.

V1 is offline-first and local-device only: no accounts, no cloud sync, no public uploads, no leaderboard. Success means a player can install/open the PWA, load today's puzzle, place limited pieces, resume progress later, complete the puzzle, and see streak/completion history on that device.

## Product Behavior

- Daily reset uses global UTC day. Puzzle key format: `YYYY-MM-DD`.
- Admin/editor uploads an image, chooses crop, grid size, and palette size, then publishes it as a daily puzzle.
- The image conversion flow maps pixels to the official Ministeck-style palette and produces a target grid plus required piece inventory.
- Gameplay:
  - Player selects color + piece shape from remaining inventory.
  - Player can rotate non-square shapes.
  - Placement must fit the board, not overlap existing pieces, and match the target grid color for every covered cell.
  - Wrong placements are rejected with lightweight feedback; no timer scoring in v1.
  - Player can remove placed pieces, restoring inventory.
  - Completion occurs when all target cells are correctly covered.
- Local progress:
  - Save board state, remaining inventory, completed dates, and streaks in IndexedDB.
  - The app works offline for already cached published puzzles.
  - If no puzzle is available for today, show the most recent cached puzzle list and a clear empty state.

## Implementation Changes

- Scaffold a React + Vite + TypeScript PWA with service worker, install manifest, responsive game layout, and IndexedDB storage.
- Core domain model:
  - `Puzzle`: date, title, grid dimensions, palette, target cells, inventory, thumbnail, publish metadata.
  - `PieceShape`: `single`, `domino`, `triominoLine`, `triominoCorner`, `square`.
  - `PlacedPiece`: id, shape, rotation, colorId, origin cell, covered cells.
  - `Progress`: puzzle date, placed pieces, remaining inventory, completion status, timestamps.
- Admin puzzle builder:
  - Image upload.
  - Crop/position controls.
  - Grid size selector with v1 presets: `24x24`, `32x32`, `48x48`.
  - Palette size selector with v1 presets: `12`, `18`, `30`.
  - Preview of converted target grid.
  - Generated inventory preview.
  - Export/publish as static puzzle JSON for a UTC date.
- Game screen:
  - Board with zoom/pan suitable for desktop and mobile touch.
  - Piece tray grouped by color and shape with remaining counts.
  - Rotate, undo, remove-piece, reset-puzzle controls.
  - Progress percentage and completion modal.
  - Daily history/streak panel.
- PWA caching:
  - Cache app shell and puzzle JSON assets.
  - Cache today's puzzle and recent puzzle metadata.
  - Persist player progress locally independent of network state.

## Test Plan

- Unit tests:
  - Image-to-grid quantization maps every cell to a valid palette color.
  - Piece rotations produce correct covered cells.
  - Placement validation rejects out-of-bounds, overlap, wrong-color, and exhausted-inventory placements.
  - Removing a piece restores inventory exactly.
  - UTC date selection returns the correct puzzle key.
  - Streak calculation handles completed days, missed days, and repeat opens.
- Integration tests:
  - Start daily puzzle, place pieces, reload app, progress resumes.
  - Complete a puzzle and verify completion history/streak updates.
  - Offline reload still opens cached puzzle and saved progress.
  - Admin flow exports a valid puzzle JSON consumed by the game.
- Manual acceptance:
  - Works on mobile and desktop.
  - Board interactions feel responsive for at least `48x48`.
  - App can be installed as a PWA.
  - No text or controls overlap at common mobile widths.

## Assumptions

- The workspace is currently greenfield, so the implementation should create the app from scratch.
- V1 uses local static puzzle JSON rather than a backend database.
- Admin/editor publishing can be a local/admin-only route or tool inside the app; authentication is out of scope for v1.
- Public player image uploads, cloud sync, accounts, leaderboards, and social sharing are deferred.
- The official-style palette starts with 30 standard Ministeck colors, with special metallic/glow colors deferred.
