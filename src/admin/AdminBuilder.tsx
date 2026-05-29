import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { InventoryEntry, Puzzle, PieceShape, Rotation, SolutionPiece } from '../domain/types'
import { MINISTECK_PALETTE, findNearestColor } from '../domain/quantize'
import { getCoveredCells } from '../domain/pieces'
import { savePuzzle } from '../storage/db'
import { todayKey } from '../domain/streak'

const PALETTE_PRESETS = [12, 16, 20, 30]

const PIECE_CANDIDATES: { shape: PieceShape; rotation: Rotation }[] = [
  { shape: 'square',         rotation: 0   },
  { shape: 'triominoLine',   rotation: 0   },
  { shape: 'triominoLine',   rotation: 90  },
  { shape: 'triominoCorner', rotation: 0   },
  { shape: 'triominoCorner', rotation: 90  },
  { shape: 'triominoCorner', rotation: 180 },
  { shape: 'triominoCorner', rotation: 270 },
  { shape: 'domino',         rotation: 0   },
  { shape: 'domino',         rotation: 90  },
  { shape: 'single',         rotation: 0   },
]

function greedyTile(cells: { row: number; col: number }[]): SolutionPiece[] {
  const cellSet = new Set(cells.map(c => `${c.row},${c.col}`))
  const covered = new Set<string>()
  const placements: SolutionPiece[] = []
  const sorted = [...cells].sort((a, b) => a.row - b.row || a.col - b.col)
  for (const origin of sorted) {
    const key = `${origin.row},${origin.col}`
    if (covered.has(key)) continue
    for (const { shape, rotation } of PIECE_CANDIDATES) {
      const coveredCells = getCoveredCells(origin, shape, rotation)
      const keys = coveredCells.map(c => `${c.row},${c.col}`)
      if (keys.every(k => cellSet.has(k) && !covered.has(k))) {
        keys.forEach(k => covered.add(k))
        placements.push({ shape, rotation, colorId: '', origin })
        break
      }
    }
  }
  return placements
}

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
    setImageUrl(url); setImageLabel(label); setCellSize(cs)
    setTitle(label); setPreview(null); setStatus('')
  }, [])

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    loadImageUrl(URL.createObjectURL(file), file.name.replace(/\.[^.]+$/, ''), 8)
  }, [loadImageUrl])

  const handleGenerate = useCallback(async () => {
    if (!imageUrl) return
    setGenerating(true)

    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>(res => { img.onload = () => res(); img.src = imageUrl })

    const canvas = canvasRef.current!
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)

    const gridW = Math.floor(width  / cellSize)
    const gridH = Math.floor(height / cellSize)

    // Sample each cell by averaging pixel colours
    const rawCells: { row: number; col: number; r: number; g: number; b: number; a: number }[] = []
    for (let row = 0; row < gridH; row++) {
      for (let col = 0; col < gridW; col++) {
        let tR = 0, tG = 0, tB = 0, tA = 0, count = 0
        for (let py = row * cellSize; py < (row + 1) * cellSize && py < height; py++) {
          for (let px = col * cellSize; px < (col + 1) * cellSize && px < width; px++) {
            const i = (py * width + px) * 4
            const a = data[i + 3]
            tR += data[i] * a; tG += data[i + 1] * a; tB += data[i + 2] * a; tA += a; count++
          }
        }
        if (tA === 0) continue  // fully transparent
        rawCells.push({ row, col, r: tR / tA, g: tG / tA, b: tB / tA, a: tA / count })
      }
    }

    // Auto-detect background: most common edge colour
    const edgeCells = rawCells.filter(c =>
      c.row === 0 || c.col === 0 || c.row === gridH - 1 || c.col === gridW - 1
    )
    let bgR = 255, bgG = 255, bgB = 255
    if (edgeCells.length > 0) {
      bgR = edgeCells.reduce((s, c) => s + c.r, 0) / edgeCells.length
      bgG = edgeCells.reduce((s, c) => s + c.g, 0) / edgeCells.length
      bgB = edgeCells.reduce((s, c) => s + c.b, 0) / edgeCells.length
    }

    // Filter out cells that are close to background or near-transparent
    const contentCells = rawCells.filter(c => {
      if (c.a < 40) return false  // transparent
      const distToBg = (c.r - bgR) ** 2 + (c.g - bgG) ** 2 + (c.b - bgB) ** 2
      return distToBg > 1200  // must differ from background by threshold
    })

    if (contentCells.length === 0) {
      setStatus('No content found — try a smaller cell size or different image.')
      setGenerating(false)
      return
    }

    // Map to palette, keep top N colours
    const mapped = contentCells.map(c => ({
      ...c, color: findNearestColor(c.r, c.g, c.b, MINISTECK_PALETTE),
    }))
    const usage = new Map<string, number>()
    for (const c of mapped) usage.set(c.color.id, (usage.get(c.color.id) ?? 0) + 1)
    const topIds = new Set([...usage.entries()].sort((a, b) => b[1] - a[1]).slice(0, paletteSize).map(([id]) => id))
    const allowedPalette = MINISTECK_PALETTE.filter(c => topIds.has(c.id))

    const targetCells = mapped.map(c => ({
      row: c.row, col: c.col,
      colorId: topIds.has(c.color.id) ? c.color.id : findNearestColor(c.r, c.g, c.b, allowedPalette).id,
    }))

    // Crop to bounding box
    const minRow = Math.min(...targetCells.map(c => c.row))
    const minCol = Math.min(...targetCells.map(c => c.col))
    const maxRow = Math.max(...targetCells.map(c => c.row))
    const maxCol = Math.max(...targetCells.map(c => c.col))
    const cropped = targetCells.map(c => ({ row: c.row - minRow, col: c.col - minCol, colorId: c.colorId }))
    const cropW = maxCol - minCol + 1
    const cropH = maxRow - minRow + 1

    // Greedy tiling per colour — gives proper mixed pieces + solution
    const byColor = new Map<string, { row: number; col: number }[]>()
    for (const c of cropped) {
      if (!byColor.has(c.colorId)) byColor.set(c.colorId, [])
      byColor.get(c.colorId)!.push({ row: c.row, col: c.col })
    }

    const inventoryMap = new Map<string, number>()
    const solution: SolutionPiece[] = []

    for (const [colorId, cells] of byColor.entries()) {
      const placements = greedyTile(cells)
      for (const p of placements) {
        p.colorId = colorId
        solution.push(p)
        const k = `${colorId}:${p.shape}`
        inventoryMap.set(k, (inventoryMap.get(k) ?? 0) + 1)
      }
    }

    const inventory: InventoryEntry[] = []
    for (const [k, count] of inventoryMap.entries()) {
      const [colorId, shape] = k.split(':')
      inventory.push({ shape: shape as PieceShape, colorId, count })
    }

    const puzzle: Puzzle = {
      date,
      title: title || imageLabel,
      gridWidth: cropW,
      gridHeight: cropH,
      palette: allowedPalette,
      targetCells: cropped,
      inventory,
      _solution: solution,
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
    setStatus('Saved! Play it now or commit the downloaded JSON to share it.')
    onPublished(preview)
  }, [preview, onPublished])

  return (
    <div className="admin-builder" data-testid="admin-builder">
      <h2>Puzzle Builder</h2>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

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
          {imageUrl && <img src={imageUrl} alt="Source" style={{ maxHeight: 100, marginTop: 8, imageRendering: 'pixelated' }} />}
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
          <h3>Preview — {preview.gridWidth}×{preview.gridHeight}, {preview.palette.length} colors, {preview.inventory.reduce((s,e)=>s+e.count,0)} pieces</h3>
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
