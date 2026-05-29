import React, { useMemo } from 'react'
import type { Color, InventoryEntry, PieceShape } from '../domain/types'

interface Props {
  inventory: InventoryEntry[]
  palette: Color[]
  selectedShape: PieceShape | null
  selectedColor: string | null
  onSelect: (shape: PieceShape, colorId: string) => void
}

const SHAPE_LABEL: Record<PieceShape, string> = {
  single: '1',
  domino: '1×2',
  triominoLine: '1×3',
  triominoCorner: 'L3',
  square: '2×2',
}

const SHAPE_ORDER: PieceShape[] = ['square', 'triominoCorner', 'triominoLine', 'domino', 'single']

export function PieceTray({ inventory, palette, selectedShape, selectedColor, onSelect }: Props) {
  const colorMap = useMemo(() => {
    const m = new Map<string, Color>()
    for (const c of palette) m.set(c.id, c)
    return m
  }, [palette])

  // Group by color, sorted by palette order
  const byColor = useMemo(() => {
    const grouped = new Map<string, InventoryEntry[]>()
    for (const e of inventory) {
      if (e.count <= 0) continue
      if (!grouped.has(e.colorId)) grouped.set(e.colorId, [])
      grouped.get(e.colorId)!.push(e)
    }
    // Sort entries within each color by shape order
    for (const entries of grouped.values()) {
      entries.sort((a, b) => SHAPE_ORDER.indexOf(a.shape) - SHAPE_ORDER.indexOf(b.shape))
    }
    // Sort colors by palette order
    const paletteOrder = palette.map(c => c.id)
    return [...grouped.entries()].sort(
      ([a], [b]) => paletteOrder.indexOf(a) - paletteOrder.indexOf(b)
    )
  }, [inventory, palette])

  const totalPieces = inventory.reduce((s, e) => s + e.count, 0)

  return (
    <div className="piece-tray" data-testid="piece-tray">
      <div className="tray-header">
        <span className="tray-title">Pieces</span>
        <span className="tray-count">{totalPieces} remaining</span>
      </div>
      <div className="tray-colors">
        {byColor.map(([colorId, entries]) => {
          const color = colorMap.get(colorId)
          if (!color) return null
          return (
            <div key={colorId} className="color-group">
              <div className="color-swatch" style={{ background: color.hex }} title={color.name} />
              <div className="color-pieces">
                {entries.map(entry => {
                  const isSelected = selectedShape === entry.shape && selectedColor === entry.colorId
                  return (
                    <button
                      key={`${colorId}-${entry.shape}`}
                      className={`piece-btn${isSelected ? ' selected' : ''}`}
                      onClick={() => onSelect(entry.shape, entry.colorId)}
                      data-testid={`piece-${entry.shape}-${entry.colorId}`}
                      style={{
                        borderColor: isSelected ? color.hex : 'transparent',
                        background: isSelected ? `${color.hex}33` : 'transparent',
                      }}
                    >
                      <PieceIcon shape={entry.shape} color={color.hex} />
                      <span className="piece-count">×{entry.count}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PieceIcon({ shape, color }: { shape: PieceShape; color: string }) {
  const size = 8
  const cells = getPieceIconCells(shape)
  const maxCol = Math.max(...cells.map(c => c.col))
  const maxRow = Math.max(...cells.map(c => c.row))
  const w = (maxCol + 1) * size
  const h = (maxRow + 1) * size
  return (
    <svg width={w + 2} height={h + 2} viewBox={`-1 -1 ${w + 2} ${h + 2}`} className="piece-icon">
      {cells.map((cell, i) => (
        <rect
          key={i}
          x={cell.col * size}
          y={cell.row * size}
          width={size - 1}
          height={size - 1}
          fill={color}
          rx={1}
        />
      ))}
    </svg>
  )
}

function getPieceIconCells(shape: PieceShape): { row: number; col: number }[] {
  switch (shape) {
    case 'single': return [{ row: 0, col: 0 }]
    case 'domino': return [{ row: 0, col: 0 }, { row: 0, col: 1 }]
    case 'triominoLine': return [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }]
    case 'triominoCorner': return [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }]
    case 'square': return [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 1 }]
  }
}
