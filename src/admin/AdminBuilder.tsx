import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { Puzzle } from '../domain/types'
import { MINISTECK_PALETTE, findNearestColor } from '../domain/quantize'
import { savePuzzle } from '../storage/db'
import { todayKey } from '../domain/streak'

const PALETTE_PRESETS = [12, 16, 20, 30]

interface LibraryEntry { file: string; label: string; cellSize: number }

interface Props {
  onPublished: (puzzle: Puzzle) => void
}

export function AdminBuilder({ onPublished }: Props) {
  const [library, setLibrary] = useState<LibraryEntry[]>([])
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageLabel, setImageLabel] = useState('')
  const [cellSize, setCellSize] = useState(8)
  const [paletteSize, setPaletteSize] = useState(16)
  const [date, setDate] = useState(todayKey())
  const [title, setTitle] = useState('')
  const [preview, setPreview] = useState<Puzzle | null>(null)
  const [status, setStatus] = useState('')
  const [generating, setGenerating] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const base = import.meta.env.BASE_URL

  useEffect(() => {
    fetch(`${base}images/index.json`).then(r => r.json()).then(setLibrary).catch(() => {})
  }, [base])

  const loadImageUrl = useCallback((url: string, label: string, cs: number) => {
    setImageUrl(url)
    setImageLabel(label)
    setCellSize(cs)
    setTitle(label)
    setPreview(null)
    setStatus('')
  }, [])

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    loadImageUrl(URL.createObjectURL(file), file.name.replace(/\.[^.]+$/, ''), 8)
  }, [loadImageUrl])

  const handleGenerate = useCallback(async () => {
    if (!imageUrl) return
    setGenerating(true)

    // Draw image to hidden canvas
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>(res => { img.onload = () => res(); img.src = imageUrl })

    const canvas = canvasRef.current!
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)

    const gridW = Math.floor(width  / cellSize)
    const gridH = Math.floor(height / cellSize)

    // Sample each cell by averaging pixel colours
    const rawCells: { row: number; col: number; r: number; g: number; b: number }[] = []
    for (let row = 0; row < gridH; row++) {
      for (let col = 0; col < gridW; col++) {
        let tR = 0, tG = 0, tB = 0, tA = 0
        for (let py = row * cellSize; py < (row + 1) * cellSize && py < height; py++) {
          for (let px = col * cellSize; px < (col + 1) * cellSize && px < width; px++) {
            const i = (py * width + px) * 4
            const a = data[i + 3]
            tR += data[i] * a; tG += data[i + 1] * a; tB += data[i + 2] * a; tA += a
          }
        }
        if (tA < cellSize * cellSize * 40) continue  // mostly transparent
        const r = tR / tA, g = tG / tA, b = tB / tA
        if (r > 230 && g > 230 && b > 230) continue  // near-white background
        rawCells.push({ row, col, r, g, b })
      }
    }

    // Map to palette, keep top N colours
    const mapped = rawCells.map(c => ({
      ...c, color: findNearestColor(c.r, c.g, c.b, MINISTECK_PALETTE),
    }))
    const usage = new Map<string, number>()
    for (const c of mapped) usage.set(c.color.id, (usage.get(c.color.id) ?? 0) + 1)
    const topIds = new Set([...usage.entries()].sort((a, b) => b[1] - a[1]).slice(0, paletteSize).map(([id]) => id))
    const allowedPalette = MINISTECK_PALETTE.filter(c => topIds.has(c.id))

    const targetCells = mapped.map(c => {
      const colorId = topIds.has(c.color.id)
        ? c.color.id
        : findNearestColor(c.r, c.g, c.b, allowedPalette).id
      return { row: c.row, col: c.col, colorId }
    })

    // Crop to bounding box
    const minRow = Math.min(...targetCells.map(c => c.row))
    const minCol = Math.min(...targetCells.map(c => c.col))
    const maxRow = Math.max(...targetCells.map(c => c.row))
    const maxCol = Math.max(...targetCells.map(c => c.col))
    const cropped = targetCells.map(c => ({ row: c.row - minRow, col: c.col - minCol, colorId: c.colorId }))
    const cropW = maxCol - minCol + 1
    const cropH = maxRow - minRow + 1

    // Build inventory (one single per cell — simple, always solvable any way)
    const counts = new Map<string, number>()
    for (const c of cropped) counts.set(c.colorId, (counts.get(c.colorId) ?? 0) + 1)
    const inventory = [...counts.entries()].map(([colorId, count]) => ({ shape: 'single' as const, colorId, count }))

    const puzzle: Puzzle = {
      date,
      title: title || imageLabel,
      gridWidth: cropW,
      gridHeight: cropH,
      palette: allowedPalette,
      targetCells: cropped,
      inventory,
    }

    setPreview(puzzle)
    setStatus('')
    setGenerating(false)
  }, [imageUrl, cellSize, paletteSize, date, title, imageLabel])

  const handlePublish = useCallback(async () => {
    if (!preview) return
    await savePuzzle(preview)
    const blob = new Blob([JSON.stringify(preview, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${preview.date}.json`
    a.click()
    setStatus(`Saved! Play it now or commit the downloaded JSON to share it.`)
    onPublished(preview)
  }, [preview, onPublished])

  return (
    <div className="admin-builder" data-testid="admin-builder">
      <h2>Puzzle Builder</h2>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Image library */}
      {library.length > 0 && (
        <div className="form-row">
          <label>Image library</label>
          <div className="image-library">
            {library.map(entry => (
              <button
                key={entry.file}
                className={`lib-thumb${imageLabel === entry.label ? ' selected' : ''}`}
                onClick={() => loadImageUrl(`${base}images/${entry.file}`, entry.label, entry.cellSize)}
              >
                <img src={`${base}images/${entry.file}`} alt={entry.label} />
                <span>{entry.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="admin-form">
        <div className="form-row">
          <label>Or upload your own image</label>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} data-testid="image-upload" />
          {imageUrl && imageLabel && (
            <img src={imageUrl} alt="Source" style={{ maxHeight: 100, marginTop: 8, imageRendering: 'pixelated' }} />
          )}
        </div>

        <div className="form-row">
          <label>Cell size (px per Ministeck cell)</label>
          <div className="btn-group">
            {[4, 6, 8, 10, 16].map(s => (
              <button key={s} className={`btn-preset${cellSize === s ? ' active' : ''}`} onClick={() => setCellSize(s)}>{s}px</button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <label>Palette size</label>
          <div className="btn-group">
            {PALETTE_PRESETS.map(p => (
              <button key={p} className={`btn-preset${paletteSize === p ? ' active' : ''}`} onClick={() => setPaletteSize(p)}>{p} colors</button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <label>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        <div className="form-row">
          <label>Title</label>
          <input type="text" value={title || imageLabel} onChange={e => setTitle(e.target.value)} />
        </div>

        <button className="btn-primary" onClick={handleGenerate} disabled={!imageUrl || generating} data-testid="generate-btn">
          {generating ? 'Generating…' : 'Generate Preview'}
        </button>
      </div>

      {preview && (
        <div className="admin-preview">
          <h3>Preview — {preview.gridWidth}×{preview.gridHeight}, {preview.palette.length} colors, {preview.targetCells.length} cells</h3>
          <MiniGrid puzzle={preview} />
          <button className="btn-primary" onClick={handlePublish} data-testid="publish-btn">
            ▶ Play now &amp; download JSON
          </button>
          {status && <p className="status-msg">{status}</p>}
        </div>
      )}
    </div>
  )
}

function MiniGrid({ puzzle }: { puzzle: Puzzle }) {
  const colorMap = new Map(puzzle.palette.map(c => [c.id, c.hex]))
  const cs = Math.max(2, Math.min(8, Math.floor(400 / Math.max(puzzle.gridWidth, puzzle.gridHeight))))
  const w = puzzle.gridWidth * cs, h = puzzle.gridHeight * cs
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ maxWidth: '100%', border: '1px solid #444' }} data-testid="mini-grid">
      {puzzle.targetCells.map(tc => (
        <rect key={`${tc.row}-${tc.col}`} x={tc.col * cs} y={tc.row * cs} width={cs} height={cs} fill={colorMap.get(tc.colorId) ?? '#888'} />
      ))}
    </svg>
  )
}
