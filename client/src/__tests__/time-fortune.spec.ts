import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { timeFortuneOrder, timeFortuneRange } from '@/utils/time-fortune'
import {
  clearDailyFirstVisitCompleted,
  hasCompletedDailyFirstVisit,
  hasOpenedTimeFortune,
  markDailyFirstVisitCompleted,
  markTimeFortuneOpened,
} from '@/events/time-fortune'
import TimeFortuneHistory from '@/components/TimeFortuneHistory.vue'

describe('time fortune periods', () => {
  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('remembers whether each user has opened daily fortune', () => {
    localStorage.clear()

    expect(hasOpenedTimeFortune('user-a')).toBe(false)
    markTimeFortuneOpened('user-a')
    expect(hasOpenedTimeFortune('user-a')).toBe(true)
    expect(hasOpenedTimeFortune('user-b')).toBe(false)
  })

  it('resets the opened state on the next local day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 23, 23, 59))

    markTimeFortuneOpened('user-a')
    expect(hasOpenedTimeFortune('user-a')).toBe(true)

    vi.setSystemTime(new Date(2026, 9, 24, 0, 0))
    expect(hasOpenedTimeFortune('user-a')).toBe(false)
  })

  it('clears the daily first-visit marker after tag activation', () => {
    markDailyFirstVisitCompleted('user-a')
    expect(hasCompletedDailyFirstVisit('user-a')).toBe(true)

    clearDailyFirstVisitCompleted('user-a')
    expect(hasCompletedDailyFirstVisit('user-a')).toBe(false)
  })

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

  it('opens the newest daily fortune and last generated time fortune by default', () => {
    const wrapper = mount(TimeFortuneHistory, {
      props: {
        days: [
          {
            date: '2026-10-15',
            dailyFortune: '较早的一天',
            timeFortunes: [{ timeName: '亥时', message: '较早时辰' }],
          },
          {
            date: '2026-10-25',
            dailyFortune: '最新每日锦言',
            timeFortunes: [
              { timeName: '酉时', message: '较早时辰锦言' },
              { timeName: '戌时', message: '最后一条时辰锦言' },
            ],
          },
        ],
      },
    })

    const days = wrapper.findAll('.history-day')
    expect(days[0]!.element.open).toBe(true)
    expect(days[1]!.element.open).toBe(false)
    expect(days[0]!.find('.daily-history-entry').element.open).toBe(true)
    expect(days[0]!.find('.daily-history-entry p').text()).toBe('最新每日锦言')
    expect(days[0]!.findAll('.time-history-entry')[0]!.element.open).toBe(false)
    expect(days[0]!.findAll('.time-history-entry')[1]!.element.open).toBe(true)
    expect(days[0]!.findAll('.time-history-entry')[1]!.find('p').text()).toBe('最后一条时辰锦言')
  })

  it('toggles a fortune by clicking anywhere on its card', async () => {
    const wrapper = mount(TimeFortuneHistory, {
      props: {
        days: [
          {
            date: '2026-10-16',
            dailyFortune: '',
            timeFortunes: [
              { timeName: '丑时', message: '保持耐心。' },
              { timeName: '寅时', message: '继续向前。' },
            ],
          },
        ],
      },
    })
    const entry = wrapper.get('.history-entry')

    expect(entry.element.open).toBe(false)
    await entry.trigger('click')
    expect(entry.element.open).toBe(true)

    await entry.find('p').trigger('click')
    expect(entry.element.open).toBe(false)
  })
})
