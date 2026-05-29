import { describe, it, expect } from 'vitest'
import { computeStreak } from '../domain/streak'

describe('computeStreak', () => {
  it('returns zeros for empty list', () => {
    expect(computeStreak([])).toEqual({ currentStreak: 0, longestStreak: 0, completedDates: [] })
  })

  it('handles consecutive days', () => {
    const result = computeStreak(['2026-01-01', '2026-01-02', '2026-01-03'])
    expect(result.longestStreak).toBe(3)
  })

  it('handles gap in streak', () => {
    const result = computeStreak(['2026-01-01', '2026-01-02', '2026-01-05', '2026-01-06'])
    expect(result.longestStreak).toBe(2)
  })

  it('deduplicates dates', () => {
    const result = computeStreak(['2026-01-01', '2026-01-01', '2026-01-02'])
    expect(result.longestStreak).toBe(2)
    expect(result.completedDates).toHaveLength(2)
  })
})
