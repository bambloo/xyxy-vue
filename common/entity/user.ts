export interface UserLocation {
  countryCode: string
  country: string
  region: string
  city: string
  custom: string
}

export const MAX_USER_HOBBIES_LENGTH = 500

export function parse_user_hobbies(value: string): string[] {
  const unique = new Set<string>()
  return value
    .split(/[\s,，、;；.。!！?？:：/|]+/u)
    .map((hobby) => hobby.trim())
    .filter((hobby) => {
      if (!hobby) return false
      const key = hobby.toLocaleLowerCase()
      if (unique.has(key)) return false
      unique.add(key)
      return true
    })
}

export function normalize_user_hobbies(value: string): string {
  return parse_user_hobbies(value).join('、')
}

export function format_user_location(location?: UserLocation) {
  return location
    ? [location.country, location.region, location.city, location.custom]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(' · ')
    : ''
}

export function parse_user_location(value: unknown): UserLocation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  const countryCode = source.countryCode
  const country = source.country
  const region = source.region
  const city = source.city
  const custom = source.custom
  if (
    typeof countryCode !== 'string' ||
    typeof country !== 'string' ||
    typeof region !== 'string' ||
    typeof city !== 'string' ||
    typeof custom !== 'string'
  ) {
    return null
  }

  const location: UserLocation = {
    countryCode: countryCode.trim(),
    country: country.trim(),
    region: region.trim(),
    city: city.trim(),
    custom: custom.trim(),
  }
  if (
    location.countryCode.length > 120 ||
    location.country.length > 120 ||
    location.region.length > 120 ||
    location.city.length > 120 ||
    location.custom.length > 120
  ) {
    return null
  }
  if (location.countryCode && !/^[A-Z]{2}$/.test(location.countryCode)) return null
  if (location.countryCode && !location.country) return null
  if (!location.countryCode && (location.country || location.region || location.city)) return null
  if (location.region && !location.countryCode) return null
  if (location.city && !location.region) return null
  return location
}

export interface UserPublicProfile {
  tag: string
  account: string
  name: string
  phone?: string
  birthday?: string
  hobbies?: string
  isActive?: boolean
  loginStreak?: number
  isAdmin?: boolean
  permissions?: string[]
  email?: string
  city?: string
  location?: UserLocation
  avatar?: string
  createdAt?: string
  updatedAt?: string
}

export interface UserQuery {
  tag?: string
  account?: string
  name?: string
  phone?: string
}
