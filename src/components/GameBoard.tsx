import React, { useCallback, useMemo, useRef, useState } from 'react'
import type { Cell, PlacedPiece, Puzzle, Rotation, SolutionPiece } from '../domain/types'
import { cellKey } from '../domain/placement'
import { getCoveredCells } from '../domain/pieces'

interface Props {
  puzzle: Puzzle
  placedPieces: PlacedPiece[]
  selectedShape: string | null
  selectedColor: string | null
  selectedRotation: Rotation
  isPeeking: boolean
  isRemoving: boolean
  onPlace: (origin: { row: number; col: number }) => void
  onRemove: (pieceId: string) => void
}

const CELL_SIZE = 16

/**
 * Computes a single SVG path that traces the outer boundary of a set of
 * grid cells. No internal dividers — the whole piece is one unified shape.
 */
function pieceOutlinePath(cells: Cell[], cs: number): string {
  const set = new Set(cells.map(c => `${c.row},${c.col}`))

  type Pt = [number, number]
  const edges: [Pt, Pt][] = []

  for (const { row, col } of cells) {
    const x = col * cs, y = row * cs
    const x2 = x + cs,  y2 = y + cs
    if (!set.has(`${row - 1},${col}`)) edges.push([[x,  y ],  [x2, y ]])
    if (!set.has(`${row},${col + 1}`)) edges.push([[x2, y ],  [x2, y2]])
    if (!set.has(`${row + 1},${col}`)) edges.push([[x2, y2],  [x,  y2]])
    if (!set.has(`${row},${col - 1}`)) edges.push([[x,  y2],  [x,  y ]])
  }

  if (edges.length === 0) return ''

  const startMap = new Map<string, number>()
  for (let i = 0; i < edges.length; i++)
    startMap.set(`${edges[i][0][0]},${edges[i][0][1]}`, i)

  const visited = new Set<number>()
  const paths: string[] = []

  for (let startIdx = 0; startIdx < edges.length; startIdx++) {
    if (visited.has(startIdx)) continue
    const pts: Pt[] = [edges[startIdx][0]]
    let cur = startIdx
    for (let guard = 0; guard < edges.length; guard++) {
      visited.add(cur)
      const end = edges[cur][1]
      pts.push(end)
      const next = startMap.get(`${end[0]},${end[1]}`)
      if (next === undefined || next === startIdx || visited.has(next)) break
      cur = next
    }
    paths.push(pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + ' Z')
  }

  return paths.join(' ')
}

export function GameBoard({
  puzzle,
  placedPieces,
  selectedShape,
  selectedColor,
  selectedRotation,
  isPeeking,
  isRemoving,
  onPlace,
  onRemove,
}: Props) {
  const [hoverCell, setHoverCell] = useState<Cell | null>(null)
  const [pointerDown, setPointerDown] = useState(false)
  const lastPlacedKey = useRef<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const colorMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of puzzle.palette) map.set(c.id, c.hex)
    return map
  }, [puzzle.palette])

  const targetMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const tc of puzzle.targetCells) map.set(cellKey(tc), tc.colorId)
    return map
  }, [puzzle.targetCells])

  const placedMap = useMemo(() => {
    const map = new Map<string, PlacedPiece>()
    for (const p of placedPieces)
      for (const cell of p.coveredCells) map.set(cellKey(cell), p)
    return map
  }, [placedPieces])

  // Pre-compute solution piece shapes for peek mode
  const peekPieces = useMemo((): Array<SolutionPiece & { coveredCells: Cell[] }> => {
    const sol = puzzle._solution
    if (sol && sol.length > 0) {
      return sol.map(p => ({
        ...p,
        coveredCells: getCoveredCells(p.origin, p.shape, p.rotation),
      }))
    }
    // Fallback: show each target cell as a single — at least colours are visible
    return puzzle.targetCells.map(tc => ({
      shape: 'single' as const,
      rotation: 0 as const,
      colorId: tc.colorId,
      origin: tc,
      coveredCells: [{ row: tc.row, col: tc.col }],
    }))
  }, [puzzle._solution, puzzle.targetCells])

  // All valid origin cells for the currently selected piece + rotation
  const validOrigins = useMemo(() => {
    if (!selectedShape || !selectedColor) return []
    const origins: Cell[] = []
    for (const tc of puzzle.targetCells) {
      if (tc.colorId !== selectedColor) continue
      if (placedMap.has(cellKey(tc))) continue
      const covered = getCoveredCells(tc, selectedShape as any, selectedRotation)
      const ok = covered.every(c =>
        c.row >= 0 && c.row < puzzle.gridHeight &&
        c.col >= 0 && c.col < puzzle.gridWidth &&
        !placedMap.has(cellKey(c)) &&
        targetMap.get(cellKey(c)) === selectedColor
      )
      if (ok) origins.push(tc)
    }
    return origins
  }, [selectedShape, selectedColor, selectedRotation, puzzle, placedMap, targetMap])

  const previewCells = useMemo(() => {
    if (!hoverCell || !selectedShape || !selectedColor) return []
    return getCoveredCells(hoverCell, selectedShape as any, selectedRotation)
  }, [hoverCell, selectedShape, selectedColor, selectedRotation])

  const previewValid = useMemo(() => {
    if (!previewCells.length) return false
    for (const cell of previewCells) {
      if (cell.row < 0 || cell.row >= puzzle.gridHeight || cell.col < 0 || cell.col >= puzzle.gridWidth) return false
      if (placedMap.has(cellKey(cell))) return false
      if (targetMap.get(cellKey(cell)) !== selectedColor) return false
    }
    return true
  }, [previewCells, puzzle, placedMap, targetMap, selectedColor])

  const getSvgCell = useCallback((e: React.MouseEvent<SVGSVGElement>): Cell | null => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    const scaleX = (puzzle.gridWidth * CELL_SIZE) / rect.width
    const scaleY = (puzzle.gridHeight * CELL_SIZE) / rect.height
    const col = Math.floor(((e.clientX - rect.left) * scaleX) / CELL_SIZE)
    const row = Math.floor(((e.clientY - rect.top) * scaleY) / CELL_SIZE)
    if (row < 0 || row >= puzzle.gridHeight || col < 0 || col >= puzzle.gridWidth) return null
    return { row, col }
  }, [puzzle])

  // Try to place at cell, skipping if same cell was just placed
  const tryPlace = useCallback((cell: Cell) => {
    const key = `${cell.row},${cell.col}`
    if (lastPlacedKey.current === key) return
    if (isRemoving) {
      const piece = placedMap.get(cellKey(cell))
      if (piece) { onRemove(piece.id); lastPlacedKey.current = key }
    } else if (selectedShape && selectedColor) {
      onPlace(cell)
      lastPlacedKey.current = key
    }
  }, [isRemoving, selectedShape, selectedColor, placedMap, onPlace, onRemove])

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const cell = getSvgCell(e)
    setHoverCell(cell)
    if (pointerDown && cell) tryPlace(cell)
  }, [getSvgCell, pointerDown, tryPlace])

  const handleMouseLeave = useCallback(() => setHoverCell(null), [])

  // Touch: update hover cell as finger moves (enables preview on touch)
  const handleTouchMove = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    const t = e.touches[0]
    if (!t) return
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const scaleX = (puzzle.gridWidth * CELL_SIZE) / rect.width
    const scaleY = (puzzle.gridHeight * CELL_SIZE) / rect.height
    const col = Math.floor(((t.clientX - rect.left) * scaleX) / CELL_SIZE)
    const row = Math.floor(((t.clientY - rect.top) * scaleY) / CELL_SIZE)
    if (row >= 0 && row < puzzle.gridHeight && col >= 0 && col < puzzle.gridWidth)
      setHoverCell({ row, col })
  }, [puzzle])

  const handleTouchEnd = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    // Use changedTouches for the lifted finger
    const t = e.changedTouches[0]
    if (!t) return
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const scaleX = (puzzle.gridWidth * CELL_SIZE) / rect.width
    const scaleY = (puzzle.gridHeight * CELL_SIZE) / rect.height
    const col = Math.floor(((t.clientX - rect.left) * scaleX) / CELL_SIZE)
    const row = Math.floor(((t.clientY - rect.top) * scaleY) / CELL_SIZE)
    if (row < 0 || row >= puzzle.gridHeight || col < 0 || col >= puzzle.gridWidth) return
    const cell = { row, col }
    if (isRemoving) {
      const piece = placedMap.get(cellKey(cell))
      if (piece) onRemove(piece.id)
    } else if (selectedShape && selectedColor) {
      onPlace(cell)
    }
    setHoverCell(null)
  }, [puzzle, isRemoving, selectedShape, selectedColor, placedMap, onPlace, onRemove])

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    setPointerDown(true)
    lastPlacedKey.current = null
    ;(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId)
  }, [])

  const handlePointerUp = useCallback(() => {
    setPointerDown(false)
    lastPlacedKey.current = null
  }, [])

  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const cell = getSvgCell(e)
    if (!cell) return
    tryPlace(cell)
  }, [getSvgCell, tryPlace])

  const handleContextMenu = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault()
    const cell = getSvgCell(e)
    if (!cell) return
    const piece = placedMap.get(cellKey(cell))
    if (piece) onRemove(piece.id)
  }, [getSvgCell, placedMap, onRemove])

  const boardW = puzzle.gridWidth * CELL_SIZE
  const boardH = puzzle.gridHeight * CELL_SIZE

  return (
    <div className="board-wrapper" data-testid="game-board">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${boardW} ${boardH}`}
        width="100%"
        style={{ maxWidth: boardW * 2, display: 'block', cursor: isRemoving ? 'pointer' : selectedShape ? 'crosshair' : 'default', touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <rect width={boardW} height={boardH} fill="#2a2a3e" />

        {/* Peek mode: render each solution piece as a distinct outlined shape */}
        {isPeeking && peekPieces.map((p, i) => {
          const fill = colorMap.get(p.colorId) ?? '#888'
          const d = pieceOutlinePath(p.coveredCells, CELL_SIZE)
          return (
            <g key={i}>
              <path d={d} fill={fill} />
              {/* Same raised-border style as placed pieces so it reads as a physical piece */}
              <path d={d} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={2} strokeLinejoin="round" />
              <path d={d} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth={1} strokeLinejoin="round" />
            </g>
          )
        })}

        {/* Empty target slots with a subtle centre dot showing the target colour */}
        {!isPeeking && puzzle.targetCells.map(tc => {
          if (placedMap.has(cellKey(tc))) return null
          const cx = tc.col * CELL_SIZE + CELL_SIZE / 2
          const cy = tc.row * CELL_SIZE + CELL_SIZE / 2
          const fill = colorMap.get(tc.colorId) ?? '#888'
          return (
            <g key={`t-${tc.row}-${tc.col}`}>
              <rect
                x={tc.col * CELL_SIZE} y={tc.row * CELL_SIZE}
                width={CELL_SIZE} height={CELL_SIZE}
                fill="#3a3a5e" stroke="#4a4a6e" strokeWidth={0.5}
              />
              <circle cx={cx} cy={cy} r={3.5} fill={fill} opacity={0.8} />
            </g>
          )
        })}

        {/* Valid placement hints — ghost outlines at every spot the selected piece fits */}
        {!isPeeking && validOrigins.map(origin => {
          const cells = getCoveredCells(origin, selectedShape as any, selectedRotation)
          // Don't show hint under the hover preview (already shown there)
          if (hoverCell && cells.some(c => c.row === hoverCell.row && c.col === hoverCell.col)) return null
          const d = pieceOutlinePath(cells, CELL_SIZE)
          const fill = selectedColor ? (colorMap.get(selectedColor) ?? '#fff') : '#fff'
          return (
            <path
              key={`hint-${origin.row}-${origin.col}`}
              d={d}
              fill={fill}
              fillOpacity={0.12}
              stroke={fill}
              strokeOpacity={0.5}
              strokeWidth={1}
              strokeDasharray="3 2"
              strokeLinejoin="round"
              style={{ pointerEvents: 'none' }}
            />
          )
        })}

        {/* Placed pieces — each as one unified shape */}
        {!isPeeking && placedPieces.map(piece => {
          const fill = colorMap.get(piece.colorId) ?? '#888'
          const d = pieceOutlinePath(piece.coveredCells, CELL_SIZE)
          return (
            <g key={piece.id} style={{ cursor: 'context-menu' }}>
              <path d={d} fill={fill} />
              <path d={d} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={2} strokeLinejoin="round" />
              <path d={d} fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth={1} strokeLinejoin="round" />
            </g>
          )
        })}

        {/* Placement preview — same style as a placed piece */}
        {!isPeeking && previewCells.length > 0 && (() => {
          const d = pieceOutlinePath(previewCells, CELL_SIZE)
          const fill = selectedColor ? (colorMap.get(selectedColor) ?? '#fff') : '#fff'
          return (
            <g opacity={previewValid ? 0.82 : 0.35}>
              <path d={d} fill={fill} />
              <path d={d} fill="none" stroke={previewValid ? 'rgba(255,255,255,0.7)' : 'rgba(255,60,60,0.8)'} strokeWidth={2} strokeLinejoin="round" />
            </g>
          )
        })()}

        {/* Subtle grid */}
        {Array.from({ length: puzzle.gridWidth + 1 }, (_, i) => (
          <line key={`vl-${i}`} x1={i * CELL_SIZE} y1={0} x2={i * CELL_SIZE} y2={boardH}
            stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
        ))}
        {Array.from({ length: puzzle.gridHeight + 1 }, (_, i) => (
          <line key={`hl-${i}`} x1={0} y1={i * CELL_SIZE} x2={boardW} y2={i * CELL_SIZE}
            stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
        ))}
      </svg>
    </div>
  )
}
