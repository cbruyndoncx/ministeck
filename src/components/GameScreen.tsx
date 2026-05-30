import React, { useEffect, useRef, useState } from 'react'
import type { Puzzle } from '../domain/types'
import { useGameState } from '../hooks/useGameState'
import { GameBoard } from './GameBoard'
import { PieceTray } from './PieceTray'

interface Props {
  puzzle: Puzzle
  onBack: () => void
}

const ZOOM_MIN = 0.5
const ZOOM_MAX = 6
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))

export function GameScreen({ puzzle, onBack }: Props) {
  const game = useGameState()
  const [isPeeking, setIsPeeking] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [zoom, setZoom] = useState(1)
  const layoutRef = useRef<HTMLDivElement>(null)
  const pinchRef = useRef<number | null>(null)

  useEffect(() => { game.loadPuzzle(puzzle) }, [puzzle])
  useEffect(() => { if (game.isComplete) setShowComplete(true) }, [game.isComplete])

  // Keyboard shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); setIsPeeking(true) }
      if (e.code === 'KeyR') game.rotate()
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); game.undo() }
      if (e.code === 'Equal' || e.code === 'NumpadAdd') setZoom(z => clampZoom(z * 1.2))
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') setZoom(z => clampZoom(z / 1.2))
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); setIsPeeking(false) }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [game.rotate, game.undo])

  // Mouse wheel zoom on the layout area
  useEffect(() => {
    const el = layoutRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return  // only zoom when Ctrl held (to allow normal scroll)
      e.preventDefault()
      setZoom(z => clampZoom(z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Pinch-to-zoom on touch
  useEffect(() => {
    const el = layoutRef.current
    if (!el) return
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        pinchRef.current = Math.hypot(dx, dy)
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current !== null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.hypot(dx, dy)
        setZoom(z => clampZoom(z * (dist / pinchRef.current!)))
        pinchRef.current = dist
        e.preventDefault()
      }
    }
    const onTouchEnd = () => { pinchRef.current = null }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

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
          <button className="btn-icon" onClick={() => setZoom(z => clampZoom(z * 1.3))} title="Zoom in (+)">＋</button>
          <button className="btn-icon" onClick={() => setZoom(1)} title="Reset zoom" style={{ fontSize: 11 }}>{Math.round(zoom * 100)}%</button>
          <button className="btn-icon" onClick={() => setZoom(z => clampZoom(z / 1.3))} title="Zoom out (-)">－</button>
          <button className="btn-icon" onClick={game.rotate} title="Rotate (R)">↻</button>
          <button
            className={`btn-icon${isRemoving ? ' active-mode' : ''}`}
            onClick={() => setIsRemoving(r => !r)}
            title="Remove mode"
          >✕</button>
          <button className="btn-icon" onClick={game.undo} disabled={!game.canUndo}
            title="Undo (Ctrl+Z)" style={{ opacity: game.canUndo ? 1 : 0.3 }}>↩</button>
          <button className="btn-icon" onClick={game.reset} title="Reset">⟳</button>
        </div>
      </header>

      {isPeeking && <div className="peek-banner">👁 Peeking…</div>}

      <div className="game-layout" ref={layoutRef}>
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
              zoom={zoom}
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
