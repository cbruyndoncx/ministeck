import { useCallback, useEffect, useReducer } from 'react'
import type { InventoryEntry, PlacedPiece, PieceShape, Puzzle, Rotation } from '../domain/types'
import { deductInventory, isComplete, restoreInventory, validatePlacement } from '../domain/placement'
import { getCoveredCells } from '../domain/pieces'
import { getProgress, saveProgress, markCompleted } from '../storage/db'

interface GameState {
  puzzle: Puzzle | null
  placedPieces: PlacedPiece[]
  remainingInventory: InventoryEntry[]
  // Stack of piece IDs in placement order — enables simple undo
  placementHistory: string[]
  selectedShape: PieceShape | null
  selectedColor: string | null
  selectedRotation: Rotation
  isComplete: boolean
  lastError: string | null
  isLoading: boolean
}

type Action =
  | { type: 'LOAD_PUZZLE'; puzzle: Puzzle; placedPieces: PlacedPiece[]; remainingInventory: InventoryEntry[] }
  | { type: 'SELECT'; shape: PieceShape; colorId: string }
  | { type: 'ROTATE' }
  | { type: 'PLACE'; origin: { row: number; col: number } }
  | { type: 'REMOVE'; pieceId: string }
  | { type: 'UNDO' }
  | { type: 'RESET' }

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'LOAD_PUZZLE':
      return {
        ...state,
        puzzle: action.puzzle,
        placedPieces: action.placedPieces,
        remainingInventory: action.remainingInventory,
        placementHistory: action.placedPieces.map(p => p.id),
        isComplete: false,
        lastError: null,
        isLoading: false,
      }

    case 'SELECT':
      return {
        ...state,
        selectedShape: action.shape,
        selectedColor: action.colorId,
        selectedRotation: 0,
        lastError: null,
      }

    case 'ROTATE': {
      if (!state.selectedShape) return state
      const rotations: Rotation[] = [0, 90, 180, 270]
      const idx = rotations.indexOf(state.selectedRotation)
      return { ...state, selectedRotation: rotations[(idx + 1) % 4] }
    }

    case 'PLACE': {
      if (!state.puzzle || !state.selectedShape || !state.selectedColor) return state

      const result = validatePlacement(
        state.puzzle,
        action.origin,
        state.selectedShape,
        state.selectedRotation,
        state.selectedColor,
        state.placedPieces,
        state.remainingInventory,
      )

      if (!result.ok) return { ...state, lastError: result.error ?? 'invalid' }

      const piece: PlacedPiece = {
        id: `${Date.now()}-${Math.random()}`,
        shape: state.selectedShape,
        rotation: state.selectedRotation,
        colorId: state.selectedColor,
        origin: action.origin,
        coveredCells: result.coveredCells!,
      }

      const newPlaced = [...state.placedPieces, piece]
      const newInventory = deductInventory(state.remainingInventory, state.selectedShape, state.selectedColor)
      const complete = isComplete(state.puzzle, newPlaced)

      return {
        ...state,
        placedPieces: newPlaced,
        remainingInventory: newInventory,
        placementHistory: [...state.placementHistory, piece.id],
        isComplete: complete,
        lastError: null,
      }
    }

    case 'REMOVE': {
      const piece = state.placedPieces.find(p => p.id === action.pieceId)
      if (!piece) return state
      return {
        ...state,
        placedPieces: state.placedPieces.filter(p => p.id !== action.pieceId),
        remainingInventory: restoreInventory(state.remainingInventory, piece.shape, piece.colorId),
        placementHistory: state.placementHistory.filter(id => id !== action.pieceId),
        isComplete: false,
        lastError: null,
      }
    }

    case 'UNDO': {
      if (state.placementHistory.length === 0) return state
      const lastId = state.placementHistory[state.placementHistory.length - 1]
      const piece = state.placedPieces.find(p => p.id === lastId)
      if (!piece) return state
      return {
        ...state,
        placedPieces: state.placedPieces.filter(p => p.id !== lastId),
        remainingInventory: restoreInventory(state.remainingInventory, piece.shape, piece.colorId),
        placementHistory: state.placementHistory.slice(0, -1),
        isComplete: false,
        lastError: null,
      }
    }

    case 'RESET':
      if (!state.puzzle) return state
      return {
        ...state,
        placedPieces: [],
        remainingInventory: state.puzzle.inventory.map(e => ({ ...e })),
        placementHistory: [],
        isComplete: false,
        lastError: null,
      }

    default:
      return state
  }
}

const initialState: GameState = {
  puzzle: null,
  placedPieces: [],
  remainingInventory: [],
  placementHistory: [],
  selectedShape: null,
  selectedColor: null,
  selectedRotation: 0,
  isComplete: false,
  lastError: null,
  isLoading: true,
}

export function useGameState() {
  const [state, dispatch] = useReducer(reducer, initialState)

  const loadPuzzle = useCallback(async (puzzle: Puzzle) => {
    const saved = await getProgress(puzzle.date)
    if (saved) {
      dispatch({
        type: 'LOAD_PUZZLE',
        puzzle,
        placedPieces: saved.placedPieces,
        remainingInventory: saved.remainingInventory,
      })
    } else {
      dispatch({
        type: 'LOAD_PUZZLE',
        puzzle,
        placedPieces: [],
        remainingInventory: puzzle.inventory.map(e => ({ ...e })),
      })
    }
  }, [])

  useEffect(() => {
    if (!state.puzzle) return
    saveProgress({
      puzzleDate: state.puzzle.date,
      placedPieces: state.placedPieces,
      remainingInventory: state.remainingInventory,
      isComplete: state.isComplete,
      startedAt: Date.now(),
    })
    if (state.isComplete) markCompleted(state.puzzle.date)
  }, [state.placedPieces, state.isComplete, state.puzzle, state.remainingInventory])

  const select = useCallback((shape: PieceShape, colorId: string) => {
    dispatch({ type: 'SELECT', shape, colorId })
  }, [])
  const rotate = useCallback(() => dispatch({ type: 'ROTATE' }), [])
  const place  = useCallback((origin: { row: number; col: number }) => dispatch({ type: 'PLACE', origin }), [])
  const remove = useCallback((pieceId: string) => dispatch({ type: 'REMOVE', pieceId }), [])
  const undo   = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const reset  = useCallback(() => dispatch({ type: 'RESET' }), [])

  return {
    ...state,
    loadPuzzle,
    select,
    rotate,
    place,
    remove,
    undo,
    reset,
    canUndo: state.placementHistory.length > 0,
    getPreviewCells: (origin: { row: number; col: number }) => {
      if (!state.selectedShape) return []
      return getCoveredCells(origin, state.selectedShape, state.selectedRotation)
    },
  }
}
