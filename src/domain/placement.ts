import type { Cell, InventoryEntry, PlacedPiece, PieceShape, Puzzle, Rotation, TargetCell } from './types'
import { getCoveredCells } from './pieces'

export type PlacementError =
  | 'out-of-bounds'
  | 'overlap'
  | 'wrong-color'
  | 'no-inventory'

export interface PlacementResult {
  ok: boolean
  error?: PlacementError
  coveredCells?: Cell[]
}

export function validatePlacement(
  puzzle: Puzzle,
  origin: Cell,
  shape: PieceShape,
  rotation: Rotation,
  colorId: string,
  placedPieces: PlacedPiece[],
  inventory: InventoryEntry[],
): PlacementResult {
  const covered = getCoveredCells(origin, shape, rotation)

  // Check bounds
  for (const cell of covered) {
    if (cell.row < 0 || cell.row >= puzzle.gridHeight || cell.col < 0 || cell.col >= puzzle.gridWidth) {
      return { ok: false, error: 'out-of-bounds' }
    }
  }

  // Build a fast lookup for placed cells
  const occupiedKey = new Set(placedPieces.flatMap(p => p.coveredCells.map(cellKey)))

  // Check overlap
  for (const cell of covered) {
    if (occupiedKey.has(cellKey(cell))) return { ok: false, error: 'overlap' }
  }

  // Check inventory
  const inv = inventory.find(e => e.shape === shape && e.colorId === colorId)
  if (!inv || inv.count <= 0) return { ok: false, error: 'no-inventory' }

  // Build target cell color map
  const targetMap = new Map<string, string>(
    puzzle.targetCells.map(tc => [cellKey(tc), tc.colorId])
  )

  // Check color match for every covered cell
  for (const cell of covered) {
    const expected = targetMap.get(cellKey(cell))
    if (expected !== colorId) return { ok: false, error: 'wrong-color' }
  }

  return { ok: true, coveredCells: covered }
}

export function cellKey(cell: Cell): string {
  return `${cell.row},${cell.col}`
}

export function isComplete(puzzle: Puzzle, placedPieces: PlacedPiece[]): boolean {
  const covered = new Set(placedPieces.flatMap(p => p.coveredCells.map(cellKey)))
  return puzzle.targetCells.every(tc => covered.has(cellKey(tc)))
}

export function deductInventory(inventory: InventoryEntry[], shape: PieceShape, colorId: string): InventoryEntry[] {
  return inventory.map(e =>
    e.shape === shape && e.colorId === colorId ? { ...e, count: e.count - 1 } : e
  )
}

export function restoreInventory(inventory: InventoryEntry[], shape: PieceShape, colorId: string): InventoryEntry[] {
  return inventory.map(e =>
    e.shape === shape && e.colorId === colorId ? { ...e, count: e.count + 1 } : e
  )
}

export function buildTargetMap(targetCells: TargetCell[]): Map<string, string> {
  return new Map(targetCells.map(tc => [cellKey(tc), tc.colorId]))
}
