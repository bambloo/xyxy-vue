import type { NextFunction, Request, Response } from 'express'
import { BamblooStatusCode } from '../../../common/status'
import { user_manager } from '../core/manager/user'
import { refresh_session } from './session'
import { response } from './secretary'

export type WpiAccess = 'public' | 'protected' | 'private'

export interface WpiConfig {
  access?: WpiAccess
  permissions?: string[]
}

export interface WpiRequest extends Request {
  auth?: {
    userId: string
    account: string
    ip: string
    salt: string
    issuedAt: number
    lastSeenAt: number
  }
}

export async function authorize_wpi(
  config: WpiConfig,
  req: WpiRequest,
  res: Response,
): Promise<boolean> {
  if (config.access !== 'protected' && config.access !== 'private') return true

  const session = refresh_session(req, res)
  if (!session) {
    response(res, BamblooStatusCode.Unauthorized as unknown as BamblooStatusCode, '需要登录后访问')
    return false
  }

  req.auth = session.payload
  if (config.access !== 'private' || !config.permissions?.length) return true

  const user = await user_manager.instance().then((manager) => {
    return manager.get({ id: session.payload.userId })
  })
  const hasPermission =
    user.isAdmin || config.permissions.every((permission) => user.permissions?.includes(permission))
  if (!hasPermission) {
    response(res, BamblooStatusCode.Unauthorized as unknown as BamblooStatusCode, '没有访问权限')
    return false
  }

  return true
}

export type WpiHandler = (
  params: Record<string, unknown>,
  req: WpiRequest,
  res: Response,
  next: NextFunction,
) => unknown
