import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Progress, Puzzle } from '../domain/types'

interface MinisteckDB extends DBSchema {
  puzzles: {
    key: string
    value: Puzzle
  }
  progress: {
    key: string
    value: Progress
  }
  completedDates: {
    key: string
    value: { date: string }
  }
}

let _db: IDBPDatabase<MinisteckDB> | null = null

async function getDb(): Promise<IDBPDatabase<MinisteckDB>> {
  if (!_db) {
    _db = await openDB<MinisteckDB>('ministeck', 1, {
      upgrade(db) {
        db.createObjectStore('puzzles', { keyPath: 'date' })
        db.createObjectStore('progress', { keyPath: 'puzzleDate' })
        db.createObjectStore('completedDates', { keyPath: 'date' })
      },
    })
  }
  return _db
}

export async function savePuzzle(puzzle: Puzzle): Promise<void> {
  const db = await getDb()
  await db.put('puzzles', puzzle)
}

export async function getPuzzle(date: string): Promise<Puzzle | undefined> {
  const db = await getDb()
  return db.get('puzzles', date)
}

export async function getAllPuzzles(): Promise<Puzzle[]> {
  const db = await getDb()
  return db.getAll('puzzles')
}

export async function saveProgress(progress: Progress): Promise<void> {
  const db = await getDb()
  await db.put('progress', progress)
}

export async function getProgress(date: string): Promise<Progress | undefined> {
  const db = await getDb()
  return db.get('progress', date)
}

export async function markCompleted(date: string): Promise<void> {
  const db = await getDb()
  await db.put('completedDates', { date })
}

export async function getCompletedDates(): Promise<string[]> {
  const db = await getDb()
  const all = await db.getAll('completedDates')
  return all.map(r => r.date)
}
