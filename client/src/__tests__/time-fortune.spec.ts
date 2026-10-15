import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { timeFortuneOrder, timeFortuneRange } from '@/utils/time-fortune'
import TimeFortuneHistory from '@/components/TimeFortuneHistory.vue'

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

  it('toggles a fortune by clicking anywhere on its card', async () => {
    const wrapper = mount(TimeFortuneHistory, {
      props: {
        days: [
          {
            date: '2026-10-16',
            dailyFortune: '',
            timeFortunes: [{ timeName: '丑时', message: '保持耐心。' }],
          },
        ],
      },
    })
    const entry = wrapper.get('.history-entry')

    expect(entry.element.open).toBe(false)
    await entry.trigger('click')
    expect(entry.element.open).toBe(true)

    await wrapper.get('.history-entry p').trigger('click')
    expect(entry.element.open).toBe(false)
  })
})
