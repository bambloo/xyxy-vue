export function is_valid_phone(phone: string) {
  return /^\d{11}$/.test(phone.trim())
}

export function is_at_least_five_years_old(birthday: string, today = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday)
  if (!match) return false

  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const date = new Date(year, month - 1, day)
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return false
  }

  const cutoff = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate())
  return date <= cutoff
}
