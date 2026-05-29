#!/usr/bin/env node
/**
 * Generates a Ministeck puzzle from a real pixel-art PNG image.
 *
 * Usage:
 *   node generate-from-image.mjs <image.png> [cellSize] [maxColors]
 *
 * cellSize  – how many raw pixels make up one Ministeck cell (default: auto-detect)
 * maxColors – palette size limit (default: 16)
 */

import { createReadStream } from 'fs'
import { writeFileSync, mkdirSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { PNG } from '/home/cb/projects/dev/ministeck/node_modules/pngjs/lib/png.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Args ───────────────────────────────────────────────────────────────────
const [,, imagePath = '/tmp/hummingbird-source.png', cellSizeArg, maxColorsArg] = process.argv
const MAX_COLORS = parseInt(maxColorsArg ?? '16', 10)

// ── Palette (30 standard Ministeck colours) ───────────────────────────────
const PALETTE = [
  { id: 'white',        hex: '#FFFFFF' },
  { id: 'light-grey',   hex: '#C8C8C8' },
  { id: 'grey',         hex: '#8C8C8C' },
  { id: 'dark-grey',    hex: '#505050' },
  { id: 'black',        hex: '#1E1E1E' },
  { id: 'cream',        hex: '#FFF5DC' },
  { id: 'light-yellow', hex: '#FFE566' },
  { id: 'yellow',       hex: '#FFD700' },
  { id: 'orange',       hex: '#FF8C00' },
  { id: 'dark-orange',  hex: '#CC5500' },
  { id: 'light-red',    hex: '#FF6B6B' },
  { id: 'red',          hex: '#DC143C' },
  { id: 'dark-red',     hex: '#8B0000' },
  { id: 'pink',         hex: '#FF69B4' },
  { id: 'light-purple', hex: '#DDA0DD' },
  { id: 'purple',       hex: '#800080' },
  { id: 'dark-purple',  hex: '#4B0082' },
  { id: 'light-blue',   hex: '#87CEEB' },
  { id: 'sky-blue',     hex: '#4169E1' },
  { id: 'blue',         hex: '#0000CD' },
  { id: 'dark-blue',    hex: '#00008B' },
  { id: 'cyan',         hex: '#00CED1' },
  { id: 'teal',         hex: '#008080' },
  { id: 'light-green',  hex: '#90EE90' },
  { id: 'green',        hex: '#228B22' },
  { id: 'dark-green',   hex: '#006400' },
  { id: 'olive',        hex: '#808000' },
  { id: 'brown',        hex: '#8B4513' },
  { id: 'dark-brown',   hex: '#3D1C02' },
  { id: 'tan',          hex: '#D2B48C' },
]

function hexToRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)]
}

function colorDist(r1,g1,b1, r2,g2,b2) {
  // Perceptual weighting
  const dr=r1-r2, dg=g1-g2, db=b1-b2
  return 0.299*dr*dr + 0.587*dg*dg + 0.114*db*db
}

function nearestPaletteColor(r, g, b, palette) {
  let best = palette[0], bestD = Infinity
  for (const c of palette) {
    const [cr,cg,cb] = hexToRgb(c.hex)
    const d = colorDist(r,g,b, cr,cg,cb)
    if (d < bestD) { bestD = d; best = c }
  }
  return best
}

// ── Auto-detect cell size from uniform-colour blocks ──────────────────────
function detectCellSize(data, width, height) {
  // Sample the first row and find the run-length of the first colour
  // Pixel art will have consistent block sizes
  const r0 = data[0], g0 = data[1], b0 = data[2]
  let run = 1
  while (run < width) {
    const i = run * 4
    if (Math.abs(data[i]-r0)<8 && Math.abs(data[i+1]-g0)<8 && Math.abs(data[i+2]-b0)<8) run++
    else break
  }
  // Common Ministeck cell sizes: 4, 6, 8, 10, 12, 16
  const candidates = [4, 6, 8, 10, 12, 16]
  return candidates.reduce((best, c) => Math.abs(c - run) < Math.abs(best - run) ? c : best, 8)
}

// ── Read PNG and build puzzle ─────────────────────────────────────────────
function loadPng(path) {
  return new Promise((resolve, reject) => {
    const png = new PNG()
    createReadStream(path).pipe(png)
      .on('parsed', function() { resolve(this) })
      .on('error', reject)
  })
}

const png = await loadPng(imagePath)
const { width, height, data } = png

const cellSize = cellSizeArg ? parseInt(cellSizeArg, 10) : detectCellSize(data, width, height)
const gridW = Math.floor(width  / cellSize)
const gridH = Math.floor(height / cellSize)

console.log(`Image: ${width}×${height}  Cell size: ${cellSize}px  Grid: ${gridW}×${gridH}`)

// ── Sample each grid cell (average colour, skip transparent/near-white) ───
const rawCells = []   // {row, col, r, g, b}

for (let row = 0; row < gridH; row++) {
  for (let col = 0; col < gridW; col++) {
    let tR=0, tG=0, tB=0, tA=0, count=0
    for (let py = row*cellSize; py < (row+1)*cellSize && py < height; py++) {
      for (let px = col*cellSize; px < (col+1)*cellSize && px < width; px++) {
        const i = (py * width + px) * 4
        const a = data[i+3]
        tR += data[i  ] * a
        tG += data[i+1] * a
        tB += data[i+2] * a
        tA += a
        count++
      }
    }
    if (tA < count * 40) continue  // mostly transparent → background, skip

    const r = tR / tA, g = tG / tA, b = tB / tA

    // Skip near-white background cells
    if (r > 230 && g > 230 && b > 230) continue

    rawCells.push({ row, col, r, g, b })
  }
}

// ── Map to palette, limit to MAX_COLORS most-used ─────────────────────────
const mapped = rawCells.map(c => ({
  ...c,
  color: nearestPaletteColor(c.r, c.g, c.b, PALETTE),
}))

// Count usage, keep top MAX_COLORS
const usage = new Map()
for (const c of mapped) usage.set(c.color.id, (usage.get(c.color.id)??0) + 1)
const topIds = new Set([...usage.entries()].sort((a,b)=>b[1]-a[1]).slice(0, MAX_COLORS).map(([id])=>id))
const allowedPalette = PALETTE.filter(c => topIds.has(c.id))

// Remap cells outside top colours to nearest allowed
const targetCells = mapped.map(c => {
  if (topIds.has(c.color.id)) return { row: c.row, col: c.col, colorId: c.color.id }
  const near = nearestPaletteColor(c.r, c.g, c.b, allowedPalette)
  return { row: c.row, col: c.col, colorId: near.id }
})

// ── Greedy tiling per colour region ──────────────────────────────────────
function getCoveredOffsets(shape, rotation) {
  const bases = {
    single:         [[0,0]],
    domino:         [[0,0],[0,1]],
    triominoLine:   [[0,0],[0,1],[0,2]],
    triominoCorner: [[0,0],[0,1],[1,0]],
    square:         [[0,0],[0,1],[1,0],[1,1]],
  }
  let offsets = bases[shape].map(o=>[...o])
  for (let t = 0; t < rotation/90; t++) {
    offsets = offsets.map(([r,c]) => [c, -r])
    const minR = Math.min(...offsets.map(o=>o[0]))
    const minC = Math.min(...offsets.map(o=>o[1]))
    offsets = offsets.map(([r,c]) => [r-minR, c-minC])
  }
  return offsets
}

const CANDIDATES = [
  {shape:'square',         rotation:0  },
  {shape:'triominoLine',   rotation:0  },
  {shape:'triominoLine',   rotation:90 },
  {shape:'triominoCorner', rotation:0  },
  {shape:'triominoCorner', rotation:90 },
  {shape:'triominoCorner', rotation:180},
  {shape:'triominoCorner', rotation:270},
  {shape:'domino',         rotation:0  },
  {shape:'domino',         rotation:90 },
  {shape:'single',         rotation:0  },
]

function greedyTile(cells) {
  const cellSet = new Set(cells.map(c=>`${c.row},${c.col}`))
  const covered = new Set()
  const placements = []
  const sorted = [...cells].sort((a,b)=>a.row-b.row||a.col-b.col)

  for (const origin of sorted) {
    if (covered.has(`${origin.row},${origin.col}`)) continue
    for (const {shape, rotation} of CANDIDATES) {
      const offs = getCoveredOffsets(shape, rotation)
      const coveredCells = offs.map(([dr,dc])=>({row:origin.row+dr, col:origin.col+dc}))
      const keys = coveredCells.map(c=>`${c.row},${c.col}`)
      if (keys.every(k=>cellSet.has(k) && !covered.has(k))) {
        keys.forEach(k=>covered.add(k))
        placements.push({shape, rotation, colorId:null, origin, coveredCells})
        break
      }
    }
  }
  return placements
}

// Group cells by colour and tile
const byColor = new Map()
for (const tc of targetCells) {
  if (!byColor.has(tc.colorId)) byColor.set(tc.colorId, [])
  byColor.get(tc.colorId).push({row:tc.row, col:tc.col})
}

const inventoryMap = new Map()
const solution = []

for (const [colorId, cells] of byColor.entries()) {
  const placements = greedyTile(cells)
  for (const p of placements) {
    p.colorId = colorId
    solution.push(p)
    const k = `${colorId}:${p.shape}`
    inventoryMap.set(k, (inventoryMap.get(k)??0) + 1)
  }
}

const inventory = []
for (const [k, count] of inventoryMap.entries()) {
  const [colorId, shape] = k.split(':')
  inventory.push({shape, colorId, count})
}

// ── Crop to bounding box of target cells ─────────────────────────────────
const minRow = Math.min(...targetCells.map(c=>c.row))
const minCol = Math.min(...targetCells.map(c=>c.col))
const maxRow = Math.max(...targetCells.map(c=>c.row))
const maxCol = Math.max(...targetCells.map(c=>c.col))
const croppedCells = targetCells.map(c => ({row: c.row-minRow, col: c.col-minCol, colorId: c.colorId}))
const croppedSolution = solution.map(p => ({
  ...p,
  origin: {row: p.origin.row-minRow, col: p.origin.col-minCol},
  coveredCells: p.coveredCells.map(c => ({row: c.row-minRow, col: c.col-minCol})),
}))
const cropW = maxCol - minCol + 1
const cropH = maxRow - minRow + 1

// ── Output ────────────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0,10)
const puzzle = {
  date: today,
  title: 'Hummingbird',
  gridWidth: cropW,
  gridHeight: cropH,
  palette: allowedPalette.map(c => ({
    id: c.id, hex: c.hex,
    name: c.id.split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join(' ')
  })),
  targetCells: croppedCells,
  inventory,
  _solution: croppedSolution.map(({shape, rotation, colorId, origin}) => ({shape, rotation, colorId, origin})),
}

mkdirSync(join(__dirname, '../public/puzzles'), {recursive:true})
const outPath = join(__dirname, `../public/puzzles/${today}.json`)
writeFileSync(outPath, JSON.stringify(puzzle, null, 2))

// Copy source image to public for reference
copyFileSync(imagePath, join(__dirname, '../public/puzzles/hummingbird-source.png'))

const totalPieces = inventory.reduce((s,e)=>s+e.count, 0)
console.log(`Written: ${outPath}`)
console.log(`Grid: ${cropW}×${cropH}  Cells: ${croppedCells.length}  Pieces: ${totalPieces}  Colors: ${allowedPalette.length}`)
console.log('\nInventory:')
for (const e of inventory.sort((a,b)=>a.colorId.localeCompare(b.colorId)||a.shape.localeCompare(b.shape)))
  console.log(`  ${e.colorId.padEnd(15)} ${e.shape.padEnd(16)} × ${e.count}`)
