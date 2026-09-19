import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'

export function hash_password(password: string) {
  const bytes = new TextEncoder().encode(password)
  return Promise.resolve(bytesToHex(sha256(bytes)))
}
