import { Request, Response } from 'express'
import { BamblooStatusCode } from '../../../../common/status'
import { response } from '../../util/secretary'
import { refresh_session } from '../../util/session'
import { user_manager } from '../../core/manager/user'
import { to_public_user } from '../../core/entity/public-user'

export default function handler(
  _params: { [key: string]: unknown },
  req: Request,
  res: Response,
  // next: NextFunction,
) {
  const result = refresh_session(req, res)
  if (!result) return response(res, BamblooStatusCode.Unauthorized, '登录已失效')

  return user_manager
    .instance()
    .then((manager) => manager.get({ tag: result.payload.userTag }))
    .then((user) => {
      return response(res, BamblooStatusCode.Success, '会话有效', {
        ...to_public_user(user),
        token: result.token,
      })
    })
    .catch(() => response(res, BamblooStatusCode.Unauthorized, '登录已失效'))
}
