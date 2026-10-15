import type { NextFunction, Request, Response } from 'express'
import { BamblooError, BamblooStatusCode } from '../../../common/status'
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
    userTag: string
    account: string
    ip: string
    salt: string
    issuedAt: number
    lastSeenAt: number
  }
}

export function authorize_wpi(
  config: WpiConfig,
  req: WpiRequest,
  res: Response,
): Promise<boolean> {
  if (config.access !== 'protected' && config.access !== 'private') return Promise.resolve(true)

  return refresh_session(req, res)
    .then((session) => {
      req.auth = session.payload
      if (config.access !== 'private' || !config.permissions?.length) return true

      return user_manager.instance().then((manager) =>
        manager.get({ tag: session.payload.userTag }).then((user) => {
          const hasPermission =
            user.isAdmin ||
            config.permissions!.every((permission) => user.permissions?.includes(permission))
          if (!hasPermission) {
            response(res, BamblooStatusCode.Unauthorized, '没有访问权限')
            return false
          }
          return true
        }),
      )
    })
    .catch((error: unknown) => {
      if (error instanceof BamblooError && error.code === BamblooStatusCode.Unauthorized) {
        response(res, BamblooStatusCode.Unauthorized, '需要登录后访问')
        return false
      }
      throw error
    })
}

export type WpiHandler = (
  params: Record<string, unknown>,
  req: WpiRequest,
  res: Response,
  next: NextFunction,
) => unknown
