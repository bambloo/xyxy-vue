export function hash_password(password: string) {
  const bytes = new TextEncoder().encode(password)
  return crypto.subtle.digest('SHA-256', bytes).then((digest) => {
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  })
}
