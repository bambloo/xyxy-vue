import { describe, expect, it } from 'vitest'
import { timeFortuneOrder, timeFortuneRange } from '@/utils/time-fortune'

describe('time fortune periods', () => {
  it('splits zi hour into early and late periods', () => {
    expect(timeFortuneRange('早子时')).toBe('00:00-01:00')
    expect(timeFortuneRange('晚子时')).toBe('23:00-24:00')
    expect(timeFortuneRange('子时')).toBe('')
  })

  it('keeps the remaining two-hour periods in chronological order', () => {
    expect(timeFortuneRange('丑时')).toBe('01:00-03:00')
    expect(timeFortuneRange('亥时')).toBe('21:00-23:00')
    expect(timeFortuneOrder('早子时')).toBeLessThan(timeFortuneOrder('丑时'))
    expect(timeFortuneOrder('亥时')).toBeLessThan(timeFortuneOrder('晚子时'))
  })
})
