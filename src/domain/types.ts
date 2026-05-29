export type PieceShape = 'single' | 'domino' | 'triominoLine' | 'triominoCorner' | 'square'

export interface Color {
  id: string
  hex: string
  name: string
}

export interface Cell {
  row: number
  col: number
}

export interface TargetCell extends Cell {
  colorId: string
}

export interface InventoryEntry {
  shape: PieceShape
  colorId: string
  count: number
}

export interface SolutionPiece {
  shape: PieceShape
  rotation: Rotation
  colorId: string
  origin: Cell
}

export interface Puzzle {
  date: string // YYYY-MM-DD
  title: string
  gridWidth: number
  gridHeight: number
  palette: Color[]
  targetCells: TargetCell[]
  inventory: InventoryEntry[]
  thumbnail?: string
  _solution?: SolutionPiece[]
}

export type Rotation = 0 | 90 | 180 | 270

export interface PlacedPiece {
  id: string
  shape: PieceShape
  rotation: Rotation
  colorId: string
  origin: Cell
  coveredCells: Cell[]
}

export interface Progress {
  puzzleDate: string
  placedPieces: PlacedPiece[]
  remainingInventory: InventoryEntry[]
  isComplete: boolean
  startedAt: number
  completedAt?: number
}

export interface StreakData {
  currentStreak: number
  longestStreak: number
  completedDates: string[]
}
