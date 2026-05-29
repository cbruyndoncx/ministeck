import type { Puzzle } from '../domain/types'
import { getPuzzle, savePuzzle, getAllPuzzles } from './db'

export async function loadTodayPuzzle(date: string): Promise<Puzzle | null> {
  const base = import.meta.env.BASE_URL

  // Always try network first so published updates are picked up immediately.
  // Fall back to IndexedDB when offline.
  try {
    const res = await fetch(`${base}puzzles/${date}.json`, { cache: 'no-cache' })
    if (res.ok) {
      const puzzle: Puzzle = await res.json()
      await savePuzzle(puzzle)  // refresh cache
      return puzzle
    }
  } catch {
    // offline — fall through to cache
  }

  return getPuzzle(date)
}

export async function loadAllAvailablePuzzles(): Promise<Puzzle[]> {
  // Return what's in IndexedDB
  return getAllPuzzles()
}
