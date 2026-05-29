import React, { useEffect, useState } from 'react'
import type { Puzzle } from '../domain/types'
import { useGameState } from '../hooks/useGameState'
import { GameBoard } from './GameBoard'
import { PieceTray } from './PieceTray'

interface Props {
  puzzle: Puzzle
  onBack: () => void
}

export function GameScreen({ puzzle, onBack }: Props) {
  const game = useGameState()
  const [isPeeking, setIsPeeking] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [showComplete, setShowComplete] = useState(false)

  useEffect(() => { game.loadPuzzle(puzzle) }, [puzzle])
  useEffect(() => { if (game.isComplete) setShowComplete(true) }, [game.isComplete])

  // Keyboard shortcuts (desktop)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); setIsPeeking(true) }
      if (e.code === 'KeyR') game.rotate()
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); game.undo() }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); setIsPeeking(false) }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [game.rotate, game.undo])

  const totalCells = puzzle.targetCells.length
  const placedCount = game.placedPieces.reduce((s, p) => s + p.coveredCells.length, 0)
  const progress = totalCells > 0 ? Math.round((placedCount / totalCells) * 100) : 0

  return (
    <div className="game-screen">
      <header className="game-header">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <div className="game-title">
          <h2>{puzzle.title}</h2>
          <span className="puzzle-date">{puzzle.date}</span>
        </div>
        <div className="game-actions">
          <button className="btn-icon" onClick={game.rotate} title="Rotate (R)">↻</button>
          <button
            className={`btn-icon${isRemoving ? ' active-mode' : ''}`}
            onClick={() => setIsRemoving(r => !r)}
            title="Remove mode — tap a placed piece to remove it"
          >
            ✕
          </button>
          <button className="btn-icon" onClick={game.undo} disabled={!game.canUndo}
            title="Undo (Ctrl+Z)" style={{ opacity: game.canUndo ? 1 : 0.3 }}>↩</button>
          <button className="btn-icon" onClick={game.reset} title="Reset">⟳</button>
        </div>
      </header>

      {isPeeking && (
        <div className="peek-banner">👁 Peeking…</div>
      )}

      <div className="game-layout">
        <aside className="game-sidebar">
          {!game.isLoading && (
            <PieceTray
              inventory={game.remainingInventory}
              palette={puzzle.palette}
              selectedShape={game.selectedShape}
              selectedColor={game.selectedColor}
              onSelect={(shape, color) => { setIsRemoving(false); game.select(shape, color) }}
            />
          )}
        </aside>

        <main className="game-main">
          {game.lastError && <div className="error-toast">{errorMessage(game.lastError)}</div>}
          {!game.isLoading && game.puzzle && (
            <GameBoard
              puzzle={game.puzzle}
              placedPieces={game.placedPieces}
              selectedShape={isRemoving ? null : game.selectedShape}
              selectedColor={isRemoving ? null : game.selectedColor}
              selectedRotation={game.selectedRotation}
              isPeeking={isPeeking}
              isRemoving={isRemoving}
              onPlace={game.place}
              onRemove={game.remove}
            />
          )}
        </main>
      </div>

      <footer className="game-footer">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="progress-label">{progress}%</span>
        {/* Peek button — works for both touch hold and mouse */}
        <button
          className="btn-peek"
          onPointerDown={() => setIsPeeking(true)}
          onPointerUp={() => setIsPeeking(false)}
          onPointerLeave={() => setIsPeeking(false)}
        >
          👁 Peek
        </button>
      </footer>

      {showComplete && (
        <div className="modal-overlay" onClick={() => setShowComplete(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h2>🎉 Puzzle Complete!</h2>
            <p>{puzzle.title} — {puzzle.date}</p>
            <p>All {totalCells} cells filled correctly.</p>
            <button className="btn-primary" onClick={() => setShowComplete(false)}>Close</button>
            <button className="btn-secondary" onClick={onBack}>Back to puzzles</button>
          </div>
        </div>
      )}
    </div>
  )
}

function errorMessage(error: string): string {
  switch (error) {
    case 'out-of-bounds': return 'Outside the board'
    case 'overlap':       return 'Already filled'
    case 'wrong-color':   return 'Wrong color here'
    case 'no-inventory':  return 'No more of that piece'
    default:              return 'Invalid placement'
  }
}
