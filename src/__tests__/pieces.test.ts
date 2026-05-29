import { describe, it, expect } from 'vitest'
import { getCoveredOffsets, getCoveredCells, canRotate, nextRotation } from '../domain/pieces'
import type { PieceShape } from '../domain/types'

describe('getCoveredOffsets', () => {
  it('single always returns origin', () => {
    expect(getCoveredOffsets('single', 0)).toEqual([{ row: 0, col: 0 }])
    expect(getCoveredOffsets('single', 90)).toEqual([{ row: 0, col: 0 }])
  })

  it('domino at 0 is horizontal', () => {
    expect(getCoveredOffsets('domino', 0)).toEqual([{ row: 0, col: 0 }, { row: 0, col: 1 }])
  })

  it('domino at 90 is vertical', () => {
    const cells = getCoveredOffsets('domino', 90)
    expect(cells).toContainEqual({ row: 0, col: 0 })
    expect(cells).toContainEqual({ row: 1, col: 0 })
    expect(cells.length).toBe(2)
  })

  it('triominoLine at 0 is 3 horizontal cells', () => {
    expect(getCoveredOffsets('triominoLine', 0)).toEqual([
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }
    ])
  })

  it('triominoLine at 90 is 3 vertical cells', () => {
    const cells = getCoveredOffsets('triominoLine', 90)
    expect(cells.length).toBe(3)
    expect(cells.every(c => c.col === 0)).toBe(true)
  })

  it('triominoCorner at 0 is L shape', () => {
    const cells = getCoveredOffsets('triominoCorner', 0)
    expect(cells.length).toBe(3)
    expect(cells).toContainEqual({ row: 0, col: 0 })
    expect(cells).toContainEqual({ row: 0, col: 1 })
    expect(cells).toContainEqual({ row: 1, col: 0 })
  })

  it('all rotations of triominoCorner have 3 cells and min row/col = 0', () => {
    for (const rot of [0, 90, 180, 270] as const) {
      const cells = getCoveredOffsets('triominoCorner', rot)
      expect(cells.length).toBe(3)
      expect(Math.min(...cells.map(c => c.row))).toBe(0)
      expect(Math.min(...cells.map(c => c.col))).toBe(0)
    }
  })

  it('square is always 2x2', () => {
    for (const rot of [0, 90, 180, 270] as const) {
      const cells = getCoveredOffsets('square', rot)
      expect(cells.length).toBe(4)
      expect(cells).toContainEqual({ row: 0, col: 0 })
      expect(cells).toContainEqual({ row: 0, col: 1 })
      expect(cells).toContainEqual({ row: 1, col: 0 })
      expect(cells).toContainEqual({ row: 1, col: 1 })
    }
  })
})

describe('getCoveredCells', () => {
  it('applies origin offset', () => {
    const cells = getCoveredCells({ row: 3, col: 5 }, 'domino', 0)
    expect(cells).toContainEqual({ row: 3, col: 5 })
    expect(cells).toContainEqual({ row: 3, col: 6 })
  })
})

describe('canRotate', () => {
  it('single and square cannot rotate', () => {
    expect(canRotate('single')).toBe(false)
    expect(canRotate('square')).toBe(false)
  })
  it('domino, triominos can rotate', () => {
    expect(canRotate('domino')).toBe(true)
    expect(canRotate('triominoLine')).toBe(true)
    expect(canRotate('triominoCorner')).toBe(true)
  })
})

describe('nextRotation', () => {
  it('cycles through rotations', () => {
    expect(nextRotation(0, 'domino')).toBe(90)
    expect(nextRotation(90, 'domino')).toBe(180)
    expect(nextRotation(270, 'domino')).toBe(0)
  })
  it('stays at 0 for non-rotatable', () => {
    expect(nextRotation(0, 'single')).toBe(0)
    expect(nextRotation(0, 'square')).toBe(0)
  })
})
