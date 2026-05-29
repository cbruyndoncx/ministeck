import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const TODAY = new Date().toISOString().slice(0, 10)
const puzzleJson = JSON.parse(
  fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), `../public/puzzles/${TODAY}.json`),
    'utf-8',
  ),
)

type SolutionPiece = {
  shape: string
  rotation: number
  colorId: string
  origin: { row: number; col: number }
}

const solution: SolutionPiece[] = puzzleJson._solution

test.describe('Hummingbird daily puzzle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="puzzle-list"], .empty-state', { timeout: 10000 })
  })

  test('puzzle list shows today puzzle', async ({ page }) => {
    await expect(page.locator(`[data-testid="puzzle-${TODAY}"]`)).toBeVisible()
  })

  test('opens hummingbird puzzle and shows board', async ({ page }) => {
    await page.click(`[data-testid="puzzle-${TODAY}"]`)
    await expect(page.locator('[data-testid="game-board"]')).toBeVisible()
    await expect(page.locator('[data-testid="piece-tray"]')).toBeVisible()
  })

  test('piece tray shows expected piece shapes and colors', async ({ page }) => {
    await page.click(`[data-testid="puzzle-${TODAY}"]`)
    await page.waitForSelector('[data-testid="piece-tray"]')
    // Spot-check: each inventory entry has a button
    for (const entry of puzzleJson.inventory) {
      const btn = page.locator(`[data-testid="piece-${entry.shape}-${entry.colorId}"]`)
      await expect(btn).toBeVisible()
    }
  })

  test('spacebar peek shows target image; release hides it', async ({ page }) => {
    await page.click(`[data-testid="puzzle-${TODAY}"]`)
    await page.waitForSelector('[data-testid="game-board"]')

    await expect(page.locator('.peek-banner')).not.toBeVisible()
    await page.keyboard.down('Space')
    await expect(page.locator('.peek-banner')).toBeVisible()
    await page.keyboard.up('Space')
    await expect(page.locator('.peek-banner')).not.toBeVisible()
  })

  test('solves the hummingbird puzzle using all correct pieces', async ({ page }) => {
    test.setTimeout(300000)

    await page.click(`[data-testid="puzzle-${TODAY}"]`)
    await page.waitForSelector('[data-testid="game-board"]')

    const boardEl = page.locator('[data-testid="game-board"] svg')
    const box = await boardEl.boundingBox()
    if (!box) throw new Error('Board not visible')

    const cellW = box.width / puzzleJson.gridWidth
    const cellH = box.height / puzzleJson.gridHeight

    for (const piece of solution) {
      // Always re-select: guarantees rotation resets to 0 before each piece
      const btn = page.locator(`[data-testid="piece-${piece.shape}-${piece.colorId}"]`)
      await btn.click()

      // Rotate exactly the right number of times
      const presses = piece.rotation / 90
      for (let i = 0; i < presses; i++) {
        await page.keyboard.press('r')
      }

      // Place at origin
      const x = box.x + (piece.origin.col + 0.5) * cellW
      const y = box.y + (piece.origin.row + 0.5) * cellH
      await page.mouse.click(x, y)
      await page.waitForTimeout(20)
    }

    // Completion modal must appear
    await expect(page.locator('.modal-box')).toBeVisible({ timeout: 20000 })
    await expect(page.locator('.modal-box h2')).toContainText('Complete')
    await expect(page.locator('.progress-label')).toContainText('100%')
  })
})
