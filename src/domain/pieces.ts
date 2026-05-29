import type { Cell, PieceShape, Rotation } from './types'

// Returns cell offsets relative to origin for a given shape + rotation
export function getCoveredOffsets(shape: PieceShape, rotation: Rotation): Cell[] {
  const base = getBaseOffsets(shape)
  return rotateOffsets(base, rotation)
}

function getBaseOffsets(shape: PieceShape): Cell[] {
  switch (shape) {
    case 'single':
      return [{ row: 0, col: 0 }]
    case 'domino':
      return [{ row: 0, col: 0 }, { row: 0, col: 1 }]
    case 'triominoLine':
      return [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }]
    case 'triominoCorner':
      return [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }]
    case 'square':
      return [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 1 }]
  }
}

function rotateOffsets(offsets: Cell[], rotation: Rotation): Cell[] {
  if (rotation === 0) return offsets

  let result = offsets
  const times = rotation / 90

  for (let i = 0; i < times; i++) {
    result = result.map(({ row, col }) => ({ row: col, col: -row }))
    // Normalize so min row and col are 0
    const minRow = Math.min(...result.map(c => c.row))
    const minCol = Math.min(...result.map(c => c.col))
    result = result.map(c => ({ row: c.row - minRow, col: c.col - minCol }))
  }

  return result
}

export function getCoveredCells(origin: Cell, shape: PieceShape, rotation: Rotation): Cell[] {
  return getCoveredOffsets(shape, rotation).map(offset => ({
    row: origin.row + offset.row,
    col: origin.col + offset.col,
  }))
}

export function canRotate(shape: PieceShape): boolean {
  return shape !== 'single' && shape !== 'square'
}

export const ROTATIONS: Rotation[] = [0, 90, 180, 270]

export function nextRotation(current: Rotation, shape: PieceShape): Rotation {
  if (!canRotate(shape)) return 0
  const idx = ROTATIONS.indexOf(current)
  return ROTATIONS[(idx + 1) % ROTATIONS.length]
}
