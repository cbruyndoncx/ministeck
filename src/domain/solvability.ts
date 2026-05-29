import type { Cell, InventoryEntry, PieceShape, PlacedPiece, Puzzle, Rotation } from './types'
import { getCoveredCells } from './pieces'
import { cellKey } from './placement'

const CANDIDATES: { shape: PieceShape; rotation: Rotation }[] = [
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

// Greedy tiling: returns how many of each shape the remaining cells NEED
function greedyNeeded(cells: Cell[]): Map<PieceShape, number> {
  const cellSet = new Set(cells.map(cellKey))
  const covered = new Set<string>()
  const counts = new Map<PieceShape, number>()

  const sorted = [...cells].sort((a, b) => a.row - b.row || a.col - b.col)

  for (const origin of sorted) {
    if (covered.has(cellKey(origin))) continue
    for (const { shape, rotation } of CANDIDATES) {
      const coveredCells = getCoveredCells(origin, shape, rotation)
      const keys = coveredCells.map(cellKey)
      if (keys.every(k => cellSet.has(k) && !covered.has(k))) {
        keys.forEach(k => covered.add(k))
        counts.set(shape, (counts.get(shape) ?? 0) + 1)
        break
      }
    }
  }

  return counts
}

/**
 * Returns IDs of placed pieces that make completion impossible.
 * For each color region, greedily tile the remaining cells and check whether
 * the required piece types are still available in inventory. If a color region
 * can't be solved with what's left, the most-recently-placed piece of that
 * color is flagged.
 */
export function findProblematicPieces(
  puzzle: Puzzle,
  placedPieces: PlacedPiece[],
  inventory: InventoryEntry[],
): Set<string> {
  const problematic = new Set<string>()
  if (placedPieces.length === 0) return problematic

  const covered = new Set(placedPieces.flatMap(p => p.coveredCells.map(cellKey)))

  const byColor = new Map<string, Cell[]>()
  for (const tc of puzzle.targetCells) {
    if (!byColor.has(tc.colorId)) byColor.set(tc.colorId, [])
    byColor.get(tc.colorId)!.push({ row: tc.row, col: tc.col })
  }

  for (const [colorId, allCells] of byColor.entries()) {
    const remaining = allCells.filter(c => !covered.has(cellKey(c)))
    if (remaining.length === 0) continue

    const needed = greedyNeeded(remaining)
    const have = new Map<PieceShape, number>()
    for (const e of inventory) {
      if (e.colorId === colorId) have.set(e.shape, e.count)
    }

    let canSolve = true
    for (const [shape, count] of needed) {
      if (count > (have.get(shape) ?? 0)) { canSolve = false; break }
    }

    if (!canSolve) {
      // Flag the most recently placed piece of this color
      for (let i = placedPieces.length - 1; i >= 0; i--) {
        if (placedPieces[i].colorId === colorId) {
          problematic.add(placedPieces[i].id)
          break
        }
      }
    }
  }

  return problematic
}
