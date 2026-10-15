const timeNames = ['子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时']

export function timeFortuneOrder(timeName: string) {
  const index = timeNames.indexOf(timeName)
  return index < 0 ? timeNames.length : index
}

export function timeFortuneRange(timeName: string) {
  const index = timeFortuneOrder(timeName)
  if (index >= timeNames.length) return ''
  const startHour = (23 + index * 2) % 24
  const endHour = (startHour + 2) % 24
  const formatHour = (hour: number) => `${String(hour).padStart(2, '0')}:00`
  return `${formatHour(startHour)}-${formatHour(endHour)}`
}
