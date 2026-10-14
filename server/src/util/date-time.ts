function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function now(): Date {
  return new Date()
}

export function format_local_day(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = pad2(date.getMonth() + 1)
  const day = pad2(date.getDate())
  return `${year}-${month}-${day}`
}

export function format_timestamp(date: Date): string {
  const localDay = format_local_day(date)
  const hours = pad2(date.getHours())
  const minutes = pad2(date.getMinutes())
  const seconds = pad2(date.getSeconds())
  return `${localDay} ${hours}:${minutes}:${seconds}`
}
