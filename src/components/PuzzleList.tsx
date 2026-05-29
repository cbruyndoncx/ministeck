import React, { useEffect, useState } from 'react'
import type { Puzzle } from '../domain/types'
import { loadTodayPuzzle, loadAllAvailablePuzzles } from '../storage/puzzleLoader'
import { todayKey } from '../domain/streak'

interface Props {
  onSelect: (puzzle: Puzzle) => void
}

export function PuzzleList({ onSelect }: Props) {
  const [puzzles, setPuzzles] = useState<Puzzle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      // Try to load today's puzzle from static JSON
      await loadTodayPuzzle(todayKey())
      const all = await loadAllAvailablePuzzles()
      const sorted = all.sort((a, b) => b.date.localeCompare(a.date))
      setPuzzles(sorted)
      setLoading(false)
    }
    init()
  }, [])

  const today = todayKey()

  if (loading) return <div className="loading">Loading puzzles…</div>

  if (puzzles.length === 0) {
    return (
      <div className="empty-state">
        <p>No puzzles available yet.</p>
        <p>Go to the <strong>Admin</strong> panel to create one.</p>
      </div>
    )
  }

  return (
    <div className="puzzle-list" data-testid="puzzle-list">
      {puzzles.map(p => (
        <button
          key={p.date}
          className={`puzzle-card${p.date === today ? ' today' : ''}`}
          onClick={() => onSelect(p)}
          data-testid={`puzzle-${p.date}`}
        >
          <span className="puzzle-card-date">{p.date === today ? 'Today' : p.date}</span>
          <span className="puzzle-card-title">{p.title}</span>
          <span className="puzzle-card-meta">{p.gridWidth}×{p.gridHeight}</span>
        </button>
      ))}
    </div>
  )
}
