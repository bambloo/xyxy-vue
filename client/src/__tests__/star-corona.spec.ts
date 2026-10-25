import { describe, expect, it } from 'vitest'
import {
  getMoonIllumination,
  getMoonPhase,
} from '@/scripts/core/galaxy/StarCoronaEffect'

const synodicMonthDays = 29.53058867

describe('main button moon phase', () => {
  it('calculates phase and illumination using the reference lunar cycle', () => {
    const newMoon = new Date(Date.UTC(2000, 0, 6, 18, 14))
    const firstQuarter = new Date(newMoon.getTime() + (synodicMonthDays * 86400000) / 4)
    const fullMoon = new Date(newMoon.getTime() + (synodicMonthDays * 86400000) / 2)
    const lastQuarter = new Date(newMoon.getTime() + (synodicMonthDays * 86400000 * 3) / 4)

    expect(getMoonPhase(newMoon)).toBeCloseTo(0, 8)
    expect(getMoonPhase(firstQuarter)).toBeCloseTo(0.25, 8)
    expect(getMoonPhase(fullMoon)).toBeCloseTo(0.5, 8)
    expect(getMoonPhase(lastQuarter)).toBeCloseTo(0.75, 8)
    expect(getMoonIllumination(getMoonPhase(newMoon))).toBeCloseTo(0, 8)
    expect(getMoonIllumination(getMoonPhase(firstQuarter))).toBeCloseTo(0.5, 8)
    expect(getMoonIllumination(getMoonPhase(fullMoon))).toBeCloseTo(1, 8)
    expect(getMoonIllumination(getMoonPhase(lastQuarter))).toBeCloseTo(0.5, 8)
  })
})
