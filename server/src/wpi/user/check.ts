import { Request, Response } from 'express'
import { BamblooStatusCode } from '../../../../common/status'
import { response } from '../../util/secretary'
import { refresh_session } from '../../util/session'
import { user_manager } from '../../core/manager/user'

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
    .then((manager) => manager.get({ id: result.payload.userId }))
    .then((user) => {
      const { passwordHash: _passwordHash, ...safeUser } = user
      return response(res, BamblooStatusCode.Success, '会话有效', {
        ...safeUser,
        token: result.token,
      })
    })
    .catch(() => response(res, BamblooStatusCode.Unauthorized, '登录已失效'))
}
