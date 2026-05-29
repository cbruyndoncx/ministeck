import type { Puzzle } from '../domain/types'
import { getPuzzle, savePuzzle, getAllPuzzles } from './db'

export async function loadTodayPuzzle(date: string): Promise<Puzzle | null> {
  // Check IndexedDB first
  const cached = await getPuzzle(date)
  if (cached) return cached

  // Try fetching from static JSON
  try {
    const base = import.meta.env.BASE_URL
    const res = await fetch(`${base}puzzles/${date}.json`)
    if (res.ok) {
      const puzzle: Puzzle = await res.json()
      await savePuzzle(puzzle)
      return puzzle
    }
  } catch {
    // offline or not found
  }

  return null
}

export async function loadAllAvailablePuzzles(): Promise<Puzzle[]> {
  // Return what's in IndexedDB
  return getAllPuzzles()
}
