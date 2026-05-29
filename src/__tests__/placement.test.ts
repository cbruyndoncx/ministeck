import { describe, it, expect } from 'vitest'
import { validatePlacement, deductInventory, restoreInventory, isComplete } from '../domain/placement'
import type { InventoryEntry, PlacedPiece, Puzzle } from '../domain/types'

const basePuzzle: Puzzle = {
  date: '2026-05-29',
  title: 'Test',
  gridWidth: 4,
  gridHeight: 4,
  palette: [
    { id: 'red', hex: '#FF0000', name: 'Red' },
    { id: 'blue', hex: '#0000FF', name: 'Blue' },
  ],
  targetCells: [
    { row: 0, col: 0, colorId: 'red' },
    { row: 0, col: 1, colorId: 'red' },
    { row: 1, col: 0, colorId: 'blue' },
  ],
  inventory: [
    { shape: 'domino', colorId: 'red', count: 1 },
    { shape: 'single', colorId: 'blue', count: 1 },
  ],
}

const inventory: InventoryEntry[] = [
  { shape: 'domino', colorId: 'red', count: 1 },
  { shape: 'single', colorId: 'blue', count: 1 },
]

describe('validatePlacement', () => {
  it('accepts valid domino placement', () => {
    const result = validatePlacement(basePuzzle, { row: 0, col: 0 }, 'domino', 0, 'red', [], inventory)
    expect(result.ok).toBe(true)
    expect(result.coveredCells).toHaveLength(2)
  })

  it('rejects out-of-bounds', () => {
    const result = validatePlacement(basePuzzle, { row: 3, col: 3 }, 'domino', 0, 'red', [], inventory)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('out-of-bounds')
  })

  it('rejects overlap', () => {
    const placed: PlacedPiece = {
      id: '1',
      shape: 'domino',
      rotation: 0,
      colorId: 'red',
      origin: { row: 0, col: 0 },
      coveredCells: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
    }
    const result = validatePlacement(basePuzzle, { row: 0, col: 0 }, 'single', 0, 'red', [placed], inventory)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('overlap')
  })

  it('rejects wrong color', () => {
    const result = validatePlacement(basePuzzle, { row: 0, col: 0 }, 'single', 0, 'blue', [], inventory)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('wrong-color')
  })

  it('rejects exhausted inventory', () => {
    const emptyInv: InventoryEntry[] = [
      { shape: 'domino', colorId: 'red', count: 0 },
      { shape: 'single', colorId: 'blue', count: 1 },
    ]
    const result = validatePlacement(basePuzzle, { row: 0, col: 0 }, 'domino', 0, 'red', [], emptyInv)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('no-inventory')
  })
})

describe('deductInventory', () => {
  it('decrements count', () => {
    const result = deductInventory(inventory, 'domino', 'red')
    expect(result.find(e => e.shape === 'domino' && e.colorId === 'red')!.count).toBe(0)
  })

  it('does not affect other entries', () => {
    const result = deductInventory(inventory, 'domino', 'red')
    expect(result.find(e => e.shape === 'single' && e.colorId === 'blue')!.count).toBe(1)
  })
})

describe('restoreInventory', () => {
  it('restores exactly', () => {
    const deducted = deductInventory(inventory, 'domino', 'red')
    const restored = restoreInventory(deducted, 'domino', 'red')
    expect(restored.find(e => e.shape === 'domino' && e.colorId === 'red')!.count).toBe(1)
  })
})

describe('isComplete', () => {
  it('returns true when all target cells are covered', () => {
    const placed: PlacedPiece[] = [
      {
        id: '1', shape: 'domino', rotation: 0, colorId: 'red',
        origin: { row: 0, col: 0 },
        coveredCells: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
      },
      {
        id: '2', shape: 'single', rotation: 0, colorId: 'blue',
        origin: { row: 1, col: 0 },
        coveredCells: [{ row: 1, col: 0 }],
      },
    ]
    expect(isComplete(basePuzzle, placed)).toBe(true)
  })

  it('returns false when cells are missing', () => {
    const placed: PlacedPiece[] = [
      {
        id: '1', shape: 'domino', rotation: 0, colorId: 'red',
        origin: { row: 0, col: 0 },
        coveredCells: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
      },
    ]
    expect(isComplete(basePuzzle, placed)).toBe(false)
  })
})
