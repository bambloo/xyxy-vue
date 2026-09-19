import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'
import type { Request, Response } from 'express'
import type { UserProfile } from '../core/entity/user'

const SESSION_COOKIE = 'bambloo_session'
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000
const sessionSecret = createHash('sha256')
  .update(process.env.BAMBLOO_SESSION_SECRET || randomBytes(32))
  .digest()
const sessionSalt = randomBytes(32).toString('base64url')

interface SessionPayload {
  userId: string
  account: string
  ip: string
  salt: string
  issuedAt: number
  lastSeenAt: number
}

function clientIp(req: Request) {
  return req.ip || req.socket.remoteAddress || ''
}

function encode(payload: SessionPayload) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', sessionSecret, iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  return [
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.')
}

function decode(token: string, req: Request): SessionPayload | null {
  try {
    const [ivText, tagText, encryptedText] = token.split('.')
    if (!ivText || !tagText || !encryptedText) return null

    const decipher = createDecipheriv(
      'aes-256-gcm',
      sessionSecret,
      Buffer.from(ivText, 'base64url'),
    )
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'))
    const payload = JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(encryptedText, 'base64url')),
        decipher.final(),
      ]).toString('utf8'),
    ) as SessionPayload
    const currentIp = clientIp(req)
    const account = typeof payload.account === 'string' ? payload.account : ''
    const ip = typeof payload.ip === 'string' ? payload.ip : ''
    const salt = typeof payload.salt === 'string' ? payload.salt : ''
    const expectedSalt = Buffer.from(sessionSalt)
    if (
      !payload.userId ||
      !account ||
      !ip ||
      Buffer.byteLength(salt) !== expectedSalt.length ||
      !timingSafeEqual(Buffer.from(salt), expectedSalt) ||
      !Number.isFinite(payload.lastSeenAt) ||
      Date.now() - payload.lastSeenAt > SESSION_TTL ||
      Buffer.byteLength(ip) !== Buffer.byteLength(currentIp) ||
      !timingSafeEqual(Buffer.from(ip), Buffer.from(currentIp))
    ) {
      return null
    }
    return payload
  } catch {
    return null
  }
}

export function issue_session(req: Request, res: Response, user: UserProfile) {
  const now = Date.now()
  const token = encode({
    userId: user.id,
    account: user.account,
    ip: clientIp(req),
    salt: sessionSalt,
    issuedAt: now,
    lastSeenAt: now,
  })
  set_session_cookie(res, req, token)
  return token
}

function set_session_cookie(res: Response, req: Request, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: SESSION_TTL,
    path: '/',
  })
}

export function refresh_session(req: Request, res: Response) {
  const token = read_token(req)
  if (!token) return null
  const payload = decode(token, req)
  if (!payload) {
    clear_session(res)
    return null
  }
  const refreshed = encode({ ...payload, lastSeenAt: Date.now() })
  set_session_cookie(res, req, refreshed)
  return { payload, token: refreshed }
}

export function clear_session(res: Response) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', path: '/' })
}

function read_cookie(req: Request, name: string) {
  const prefix = `${name}=`
  const value = (req.headers.cookie || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
  return value ? decodeURIComponent(value.slice(prefix.length)) : null
}

function read_token(req: Request) {
  const authorization = req.headers.authorization
  if (authorization?.startsWith('Bearer ')) return authorization.slice('Bearer '.length)
  return read_cookie(req, SESSION_COOKIE)
}
