import type { Color, InventoryEntry, PieceShape, TargetCell } from './types'

// Standard 30-color Ministeck-style palette
export const MINISTECK_PALETTE: Color[] = [
  { id: 'white', hex: '#FFFFFF', name: 'White' },
  { id: 'light-grey', hex: '#C8C8C8', name: 'Light Grey' },
  { id: 'grey', hex: '#8C8C8C', name: 'Grey' },
  { id: 'dark-grey', hex: '#505050', name: 'Dark Grey' },
  { id: 'black', hex: '#1E1E1E', name: 'Black' },
  { id: 'cream', hex: '#FFF5DC', name: 'Cream' },
  { id: 'light-yellow', hex: '#FFE566', name: 'Light Yellow' },
  { id: 'yellow', hex: '#FFD700', name: 'Yellow' },
  { id: 'orange', hex: '#FF8C00', name: 'Orange' },
  { id: 'dark-orange', hex: '#CC5500', name: 'Dark Orange' },
  { id: 'light-red', hex: '#FF6B6B', name: 'Light Red' },
  { id: 'red', hex: '#DC143C', name: 'Red' },
  { id: 'dark-red', hex: '#8B0000', name: 'Dark Red' },
  { id: 'pink', hex: '#FF69B4', name: 'Pink' },
  { id: 'light-purple', hex: '#DDA0DD', name: 'Light Purple' },
  { id: 'purple', hex: '#800080', name: 'Purple' },
  { id: 'dark-purple', hex: '#4B0082', name: 'Dark Purple' },
  { id: 'light-blue', hex: '#87CEEB', name: 'Light Blue' },
  { id: 'sky-blue', hex: '#4169E1', name: 'Sky Blue' },
  { id: 'blue', hex: '#0000CD', name: 'Blue' },
  { id: 'dark-blue', hex: '#00008B', name: 'Dark Blue' },
  { id: 'cyan', hex: '#00CED1', name: 'Cyan' },
  { id: 'teal', hex: '#008080', name: 'Teal' },
  { id: 'light-green', hex: '#90EE90', name: 'Light Green' },
  { id: 'green', hex: '#228B22', name: 'Green' },
  { id: 'dark-green', hex: '#006400', name: 'Dark Green' },
  { id: 'olive', hex: '#808000', name: 'Olive' },
  { id: 'brown', hex: '#8B4513', name: 'Brown' },
  { id: 'dark-brown', hex: '#3D1C02', name: 'Dark Brown' },
  { id: 'tan', hex: '#D2B48C', name: 'Tan' },
]

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  // Perceptual weights
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2
  return 0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db
}

export function findNearestColor(r: number, g: number, b: number, palette: Color[]): Color {
  let best = palette[0]
  let bestDist = Infinity
  for (const color of palette) {
    const [cr, cg, cb] = hexToRgb(color.hex)
    const dist = colorDistance(r, g, b, cr, cg, cb)
    if (dist < bestDist) {
      bestDist = dist
      best = color
    }
  }
  return best
}

export interface QuantizeResult {
  targetCells: TargetCell[]
  usedPalette: Color[]
  inventory: InventoryEntry[]
}

export function quantizeImageData(
  imageData: ImageData,
  gridWidth: number,
  gridHeight: number,
  palette: Color[],
  maxColors: number,
): QuantizeResult {
  const { width, height, data } = imageData
  const cellW = width / gridWidth
  const cellH = height / gridHeight

  // Sample each grid cell by averaging pixels
  const targetCells: TargetCell[] = []
  const colorUsage = new Map<string, number>()

  for (let row = 0; row < gridHeight; row++) {
    for (let col = 0; col < gridWidth; col++) {
      const x0 = Math.floor(col * cellW)
      const y0 = Math.floor(row * cellH)
      const x1 = Math.min(Math.floor((col + 1) * cellW), width)
      const y1 = Math.min(Math.floor((row + 1) * cellH), height)

      let totalR = 0, totalG = 0, totalB = 0, totalA = 0, count = 0
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * width + x) * 4
          const a = data[idx + 3]
          totalR += data[idx] * a
          totalG += data[idx + 1] * a
          totalB += data[idx + 2] * a
          totalA += a
          count++
        }
      }

      if (totalA === 0) continue

      const avgR = totalR / totalA
      const avgG = totalG / totalA
      const avgB = totalB / totalA

      const color = findNearestColor(avgR, avgG, avgB, palette)
      targetCells.push({ row, col, colorId: color.id })
      colorUsage.set(color.id, (colorUsage.get(color.id) ?? 0) + 1)
    }
  }

  // Limit to maxColors most-used colors, remap others to nearest allowed
  const sorted = [...colorUsage.entries()].sort((a, b) => b[1] - a[1])
  const allowedIds = new Set(sorted.slice(0, maxColors).map(([id]) => id))
  const allowedPalette = palette.filter(c => allowedIds.has(c.id))

  const finalCells: TargetCell[] = targetCells.map(tc => {
    if (allowedIds.has(tc.colorId)) return tc
    const [r, g, b] = hexToRgb(palette.find(c => c.id === tc.colorId)!.hex)
    const nearest = findNearestColor(r, g, b, allowedPalette)
    return { ...tc, colorId: nearest.id }
  })

  const inventory = buildInventory(finalCells)

  return {
    targetCells: finalCells,
    usedPalette: allowedPalette,
    inventory,
  }
}

// Each target cell requires exactly one single piece — the inventory is exactly the needed pieces
export function buildInventory(targetCells: TargetCell[]): InventoryEntry[] {
  const counts = new Map<string, number>()
  for (const tc of targetCells) {
    counts.set(tc.colorId, (counts.get(tc.colorId) ?? 0) + 1)
  }

  const entries: InventoryEntry[] = []
  for (const [colorId, total] of counts.entries()) {
    // Greedily assign larger pieces first to minimize piece count
    let remaining = total
    const shapes: PieceShape[] = ['square', 'triominoCorner', 'triominoLine', 'domino', 'single']
    const cellsPerShape: Record<PieceShape, number> = {
      square: 4,
      triominoCorner: 3,
      triominoLine: 3,
      domino: 2,
      single: 1,
    }
    for (const shape of shapes) {
      const cells = cellsPerShape[shape]
      const count = Math.floor(remaining / cells)
      if (count > 0) {
        entries.push({ shape, colorId, count })
        remaining -= count * cells
      }
    }
  }

  return entries
}

export function buildInventoryExact(targetCells: TargetCell[]): InventoryEntry[] {
  // One single piece per cell — exact minimum
  const counts = new Map<string, number>()
  for (const tc of targetCells) {
    counts.set(tc.colorId, (counts.get(tc.colorId) ?? 0) + 1)
  }
  const entries: InventoryEntry[] = []
  for (const [colorId, count] of counts.entries()) {
    entries.push({ shape: 'single', colorId, count })
  }
  return entries
}
