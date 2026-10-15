import { describe, expect, it } from 'vitest'
import { build_time_prompt, current_time_index, current_time_name } from './daily-prompt-template'

describe('time fortune periods', () => {
  it('uses separate indices for early and late zi hours', () => {
    const earlyZi = new Date(2026, 9, 15, 0)
    const lateZi = new Date(2026, 9, 15, 23)

    expect(current_time_index(earlyZi)).toBe(0)
    expect(current_time_name(earlyZi)).toBe('早子时')
    expect(current_time_index(lateZi)).toBe(12)
    expect(current_time_name(lateZi)).toBe('晚子时')
  })

  it('uses the requested one-hour range in each zi-hour prompt', () => {
    const earlyPrompt = build_time_prompt({ tag: 'test' }, '2026-10-15', 0)
    const latePrompt = build_time_prompt({ tag: 'test' }, '2026-10-15', 12)

    expect(earlyPrompt).toContain('早子时（00:00-01:00）')
    expect(latePrompt).toContain('晚子时（23:00-24:00）')
  })
})
