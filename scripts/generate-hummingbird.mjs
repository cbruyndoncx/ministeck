#!/usr/bin/env node
/**
 * Generates a 32x32 hummingbird puzzle using programmatic geometry,
 * then tiles each color region greedily with the largest pieces that fit.
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SIZE = 32

// ── Palette ────────────────────────────────────────────────────────────────
const PALETTE_DEF = {
  green:      '#228B22',
  'dark-green': '#006400',
  teal:       '#008080',
  blue:       '#0000CD',
  'sky-blue': '#4169E1',
  red:        '#DC143C',
  yellow:     '#FFD700',
  white:      '#FFFFFF',
  'dark-grey':'#505050',
  purple:     '#800080',
}

// ── Drawing helpers ────────────────────────────────────────────────────────
const G = Array.from({ length: SIZE }, () => Array(SIZE).fill(' '))

function put(r, c, ch) {
  if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) G[r][c] = ch
}

function ellipse(cR, cC, rR, rC, ch) {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if ((r - cR) ** 2 / rR ** 2 + (c - cC) ** 2 / rC ** 2 <= 1)
        put(r, c, ch)
}

function circle(cR, cC, radius, ch) { ellipse(cR, cC, radius, radius, ch) }

function rect(r1, c1, r2, c2, ch) {
  for (let r = r1; r <= r2; r++)
    for (let c = c1; c <= c2; c++)
      put(r, c, ch)
}

// ── Draw hummingbird (back → front) ────────────────────────────────────────
// Wing (blue, behind body)
ellipse(11, 8, 9, 11, 'B')
// Body (green, covers wing center)
ellipse(17, 16, 8, 10, 'G')
// Head (green)
circle(8, 23, 5, 'G')
// Crown (purple)
circle(5, 23, 3, 'P')
// Chest/iridescent (teal, front of body)
ellipse(15, 20, 6, 6, 'T')
// Gorget / throat (red, below head)
ellipse(14, 26, 5, 5, 'R')
// Belly (white, lower body)
ellipse(22, 14, 4, 7, 'W')
// Tail (yellow, extends left)
ellipse(25, 3, 6, 6, 'Y')
// Bill (dark-grey, far right)
rect(12, 27, 13, 31, 'K')
// Eye
put(7, 24, 'K')

// ── Build target cells ─────────────────────────────────────────────────────
const COLOR_MAP = {
  G: 'green', T: 'teal', B: 'blue', R: 'red',
  Y: 'yellow', W: 'white', K: 'dark-grey', P: 'purple',
}

const targetCells = []
for (let row = 0; row < SIZE; row++)
  for (let col = 0; col < SIZE; col++)
    if (G[row][col] !== ' ')
      targetCells.push({ row, col, colorId: COLOR_MAP[G[row][col]] })

// ── Piece rotation logic (matches src/domain/pieces.ts) ───────────────────
function getBaseOffsets(shape) {
  switch (shape) {
    case 'single':        return [[0,0]]
    case 'domino':        return [[0,0],[0,1]]
    case 'triominoLine':  return [[0,0],[0,1],[0,2]]
    case 'triominoCorner':return [[0,0],[0,1],[1,0]]
    case 'square':        return [[0,0],[0,1],[1,0],[1,1]]
  }
}

function rotateOffsets(offsets, rotation) {
  let result = offsets.map(([r, c]) => [r, c])
  const times = rotation / 90
  for (let i = 0; i < times; i++) {
    result = result.map(([r, c]) => [c, -r])
    const minR = Math.min(...result.map(o => o[0]))
    const minC = Math.min(...result.map(o => o[1]))
    result = result.map(([r, c]) => [r - minR, c - minC])
  }
  return result
}

function getCoveredOffsets(shape, rotation) {
  return rotateOffsets(getBaseOffsets(shape), rotation)
}

// All piece candidates, largest first, all useful rotations
const PIECE_CANDIDATES = [
  { shape: 'square',         rotation: 0   },
  { shape: 'triominoLine',   rotation: 0   },
  { shape: 'triominoLine',   rotation: 90  },
  { shape: 'triominoCorner', rotation: 0   },
  { shape: 'triominoCorner', rotation: 90  },
  { shape: 'triominoCorner', rotation: 180 },
  { shape: 'triominoCorner', rotation: 270 },
  { shape: 'domino',         rotation: 0   },
  { shape: 'domino',         rotation: 90  },
  { shape: 'single',         rotation: 0   },
]

// ── Greedy tiling per color region ────────────────────────────────────────
function greedyTile(cells) {
  const cellSet = new Set(cells.map(({ row, col }) => `${row},${col}`))
  const covered = new Set()
  const placements = []

  // Row-major order ensures deterministic top-left-first processing
  const sorted = [...cells].sort((a, b) => a.row - b.row || a.col - b.col)

  for (const origin of sorted) {
    const key = `${origin.row},${origin.col}`
    if (covered.has(key)) continue

    for (const { shape, rotation } of PIECE_CANDIDATES) {
      const offsets = getCoveredOffsets(shape, rotation)
      const coveredCells = offsets.map(([dr, dc]) => ({
        row: origin.row + dr,
        col: origin.col + dc,
      }))
      const coveredKeys = coveredCells.map(c => `${c.row},${c.col}`)

      if (coveredKeys.every(k => cellSet.has(k) && !covered.has(k))) {
        coveredKeys.forEach(k => covered.add(k))
        placements.push({ shape, rotation, colorId: null, origin, coveredCells })
        break
      }
    }
  }

  return placements
}

// ── Run tiling per color and build inventory + solution ───────────────────
const byColor = new Map()
for (const tc of targetCells) {
  if (!byColor.has(tc.colorId)) byColor.set(tc.colorId, [])
  byColor.get(tc.colorId).push({ row: tc.row, col: tc.col })
}

const inventoryMap = new Map() // `colorId:shape` → count
const solution = []

for (const [colorId, cells] of byColor.entries()) {
  const placements = greedyTile(cells)
  for (const p of placements) {
    p.colorId = colorId
    solution.push(p)
    const k = `${colorId}:${p.shape}`
    inventoryMap.set(k, (inventoryMap.get(k) ?? 0) + 1)
  }
}

const inventory = []
for (const [k, count] of inventoryMap.entries()) {
  const [colorId, shape] = k.split(':')
  inventory.push({ shape, colorId, count })
}

// ── Palette (used colors only) ─────────────────────────────────────────────
const usedColorIds = new Set(targetCells.map(tc => tc.colorId))
const palette = Object.entries(PALETTE_DEF)
  .filter(([id]) => usedColorIds.has(id))
  .map(([id, hex]) => ({
    id,
    hex,
    name: id.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
  }))

// ── Output ────────────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10)

const puzzle = {
  date: today,
  title: 'Hummingbird',
  gridWidth: SIZE,
  gridHeight: SIZE,
  palette,
  targetCells,
  inventory,
  // Solution is stored for e2e testing only — the game ignores this field
  _solution: solution.map(({ shape, rotation, colorId, origin }) => ({
    shape, rotation, colorId, origin,
  })),
}

mkdirSync(join(__dirname, '../public/puzzles'), { recursive: true })
const outPath = join(__dirname, `../public/puzzles/${today}.json`)
writeFileSync(outPath, JSON.stringify(puzzle, null, 2))

const totalPieces = inventory.reduce((s, e) => s + e.count, 0)
console.log(`Generated: ${outPath}`)
console.log(`Grid: ${SIZE}×${SIZE}  |  Target cells: ${targetCells.length}  |  Total pieces: ${totalPieces}`)
console.log('\nInventory:')
for (const e of inventory.sort((a, b) => a.colorId.localeCompare(b.colorId) || a.shape.localeCompare(b.shape)))
  console.log(`  ${e.colorId.padEnd(14)} ${e.shape.padEnd(16)} × ${e.count}`)

// Print a small ASCII preview
console.log('\nPreview (first 32 rows):')
for (const row of G) console.log(row.join(''))
