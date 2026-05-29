import type { StreakData } from './types'

export function computeStreak(completedDates: string[]): StreakData {
  const sorted = [...new Set(completedDates)].sort()
  if (sorted.length === 0) {
    return { currentStreak: 0, longestStreak: 0, completedDates: [] }
  }

  let longestStreak = 1
  let currentRun = 1

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1])
    const curr = new Date(sorted[i])
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays === 1) {
      currentRun++
      longestStreak = Math.max(longestStreak, currentRun)
    } else {
      currentRun = 1
    }
  }

  // Current streak: is today or yesterday in the completed list?
  const todayStr = utcDateString(new Date())
  const yesterdayStr = utcDateString(new Date(Date.now() - 86400000))
  const last = sorted[sorted.length - 1]

  let currentStreak = 0
  if (last === todayStr || last === yesterdayStr) {
    // Walk back from last
    currentStreak = 1
    for (let i = sorted.length - 2; i >= 0; i--) {
      const curr = new Date(sorted[i + 1])
      const prev = new Date(sorted[i])
      const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
      if (diffDays === 1) currentStreak++
      else break
    }
  }

  return { currentStreak, longestStreak: Math.max(longestStreak, currentStreak), completedDates: sorted }
}

export function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function todayKey(): string {
  return utcDateString(new Date())
}
