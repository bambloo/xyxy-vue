const timeNames = [
  '早子时',
  '丑时',
  '寅时',
  '卯时',
  '辰时',
  '巳时',
  '午时',
  '未时',
  '申时',
  '酉时',
  '戌时',
  '亥时',
  '晚子时',
]

export function currentTimeFortuneName(date = new Date()) {
  const hour = date.getHours()
  const index = hour === 23 ? 12 : Math.floor(((hour + 1) % 24) / 2)
  return timeNames[index]!
}

export function timeFortuneOrder(timeName: string) {
  const index = timeNames.indexOf(timeName)
  return index < 0 ? timeNames.length : index
}

export function timeFortuneRange(timeName: string) {
  const index = timeFortuneOrder(timeName)
  if (index >= timeNames.length) return ''
  if (timeName === '早子时') return '00:00-01:00'
  if (timeName === '晚子时') return '23:00-24:00'
  const startHour = 1 + (index - 1) * 2
  const endHour = startHour + 2
  const formatHour = (hour: number) => `${String(hour).padStart(2, '0')}:00`
  return `${formatHour(startHour)}-${formatHour(endHour)}`
}
