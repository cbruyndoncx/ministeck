import React, { useState } from 'react'
import type { Puzzle } from './domain/types'
import { PuzzleList } from './components/PuzzleList'
import { GameScreen } from './components/GameScreen'
import { AdminBuilder } from './admin/AdminBuilder'
import './App.css'

type View = 'home' | 'game' | 'admin'

export default function App() {
  const [view, setView] = useState<View>('home')
  const [activePuzzle, setActivePuzzle] = useState<Puzzle | null>(null)

  const openPuzzle = (puzzle: Puzzle) => {
    setActivePuzzle(puzzle)
    setView('game')
  }

  if (view === 'game' && activePuzzle) {
    return <GameScreen puzzle={activePuzzle} onBack={() => setView('home')} />
  }

  if (view === 'admin') {
    return (
      <div className="app">
        <header className="app-header">
          <button className="btn-back" onClick={() => setView('home')}>← Back</button>
          <h1>Admin</h1>
        </header>
        <AdminBuilder onPublished={puzzle => { openPuzzle(puzzle) }} />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Ministeck Daily Puzzle</h1>
        <button className="btn-secondary" onClick={() => setView('admin')}>Admin</button>
      </header>
      <main className="app-main">
        <PuzzleList onSelect={openPuzzle} />
      </main>
    </div>
  )
}
