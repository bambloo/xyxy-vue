import { Request, Response } from 'express'
import { BamblooError, BamblooStatusCode } from '../../../../common/status'
import { response } from '../../util/secretary'
import { refresh_session } from '../../util/session'
import { user_manager } from '../../core/manager/user'
import { to_public_user } from '../../core/entity/user'

export default function handler(
  params: { [key: string]: unknown },
  req: Request,
  res: Response,
  // next: NextFunction,
) {
  return refresh_session(req, res)
    .then((result) => {
      if (typeof params.tag === 'string' && params.tag !== result.payload.userTag) {
        return response(res, BamblooStatusCode.Unauthorized, '登录 Tag 不匹配')
      }

      return user_manager
        .instance()
        .then((manager) => manager.get({ tag: result.payload.userTag }))
        .then((user) =>
          response(res, BamblooStatusCode.Success, '会话有效', {
            ...to_public_user(user),
            token: result.token,
          }),
        )
        .catch(() => response(res, BamblooStatusCode.Unauthorized, '登录已失效'))
    })
    .catch((error: unknown) => {
      if (error instanceof BamblooError && error.code === BamblooStatusCode.Unauthorized) {
        return response(res, BamblooStatusCode.Unauthorized, '登录已失效')
      }
      throw error
    })
}
