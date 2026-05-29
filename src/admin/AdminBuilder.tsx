import React, { useCallback, useRef, useState } from 'react'
import type { Puzzle } from '../domain/types'
import { MINISTECK_PALETTE, quantizeImageData } from '../domain/quantize'
import { savePuzzle } from '../storage/db'
import { todayKey } from '../domain/streak'

const GRID_PRESETS = [
  { label: '24×24', w: 24, h: 24 },
  { label: '32×32', w: 32, h: 32 },
  { label: '48×48', w: 48, h: 48 },
]
const PALETTE_PRESETS = [12, 18, 30]

interface Props {
  onPublished: (puzzle: Puzzle) => void
}

export function AdminBuilder({ onPublished }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageData, setImageData] = useState<ImageData | null>(null)
  const [grid, setGrid] = useState({ w: 24, h: 24 })
  const [paletteSize, setPaletteSize] = useState(12)
  const [date, setDate] = useState(todayKey())
  const [title, setTitle] = useState('Daily Puzzle')
  const [preview, setPreview] = useState<Puzzle | null>(null)
  const [status, setStatus] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    const img = new Image()
    img.onload = () => {
      const canvas = canvasRef.current!
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      setImageData(ctx.getImageData(0, 0, canvas.width, canvas.height))
    }
    img.src = url
  }, [])

  const handleGenerate = useCallback(() => {
    if (!imageData) return
    const result = quantizeImageData(imageData, grid.w, grid.h, MINISTECK_PALETTE, paletteSize)
    const puzzle: Puzzle = {
      date,
      title,
      gridWidth: grid.w,
      gridHeight: grid.h,
      palette: result.usedPalette,
      targetCells: result.targetCells,
      inventory: result.inventory,
    }
    setPreview(puzzle)
    setStatus('')
  }, [imageData, grid, paletteSize, date, title])

  const handlePublish = useCallback(async () => {
    if (!preview) return
    await savePuzzle(preview)

    // Also save as static JSON in public/puzzles/
    const json = JSON.stringify(preview, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${preview.date}.json`
    a.click()

    setStatus(`Published! Puzzle for ${preview.date} saved.`)
    onPublished(preview)
  }, [preview, onPublished])

  return (
    <div className="admin-builder" data-testid="admin-builder">
      <h2>Admin Puzzle Builder</h2>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className="admin-form">
        <div className="form-row">
          <label>Image</label>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} data-testid="image-upload" />
          {imageUrl && <img src={imageUrl} alt="Source" style={{ maxHeight: 120, marginTop: 8 }} />}
        </div>

        <div className="form-row">
          <label>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        <div className="form-row">
          <label>Title</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} />
        </div>

        <div className="form-row">
          <label>Grid size</label>
          <div className="btn-group">
            {GRID_PRESETS.map(p => (
              <button
                key={p.label}
                className={`btn-preset${grid.w === p.w ? ' active' : ''}`}
                onClick={() => setGrid({ w: p.w, h: p.h })}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <label>Palette size</label>
          <div className="btn-group">
            {PALETTE_PRESETS.map(p => (
              <button
                key={p}
                className={`btn-preset${paletteSize === p ? ' active' : ''}`}
                onClick={() => setPaletteSize(p)}
              >
                {p} colors
              </button>
            ))}
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={handleGenerate}
          disabled={!imageData}
          data-testid="generate-btn"
        >
          Generate Preview
        </button>
      </div>

      {preview && (
        <div className="admin-preview">
          <h3>Preview — {preview.gridWidth}×{preview.gridHeight}, {preview.palette.length} colors</h3>
          <MiniGrid puzzle={preview} />
          <p>{preview.targetCells.length} target cells · {preview.inventory.reduce((s, e) => s + e.count, 0)} pieces</p>
          <button className="btn-primary" onClick={handlePublish} data-testid="publish-btn">
            Publish {preview.date}
          </button>
          {status && <p className="status-msg">{status}</p>}
        </div>
      )}
    </div>
  )
}

function MiniGrid({ puzzle }: { puzzle: Puzzle }) {
  const colorMap = new Map(puzzle.palette.map(c => [c.id, c.hex]))
  const targetMap = new Map(puzzle.targetCells.map(tc => [`${tc.row},${tc.col}`, tc.colorId]))
  const cellSize = 6
  const w = puzzle.gridWidth * cellSize
  const h = puzzle.gridHeight * cellSize
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ maxWidth: '100%', border: '1px solid #444' }}
      data-testid="mini-grid"
    >
      {puzzle.targetCells.map(tc => (
        <rect
          key={`${tc.row}-${tc.col}`}
          x={tc.col * cellSize}
          y={tc.row * cellSize}
          width={cellSize}
          height={cellSize}
          fill={colorMap.get(tc.colorId) ?? '#888'}
        />
      ))}
    </svg>
  )
}
