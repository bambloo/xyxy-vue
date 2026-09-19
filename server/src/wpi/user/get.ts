import type { Request, Response } from 'express'
import { BamblooStatusCode } from '../../../../common/status'
import { user_manager } from '../../core/manager/user'
import { response } from '../../util/secretary'

export const config = { access: 'private' as const }

export default function handler(
  params: { [key: string]: string },
  _req: Request,
  res: Response,
  // next: NextFunction,
) {
  user_manager
    .instance()
    .then((manager) => {
      const query = params.tag
        ? { tag: params.tag }
        : params.account
          ? { account: params.account }
          : params.phone
            ? { phone: params.phone }
            : null
      if (!query) {
        return Promise.reject({
          code: BamblooStatusCode.BadRequest,
          msg: '请输入 tag、account 或 phone',
        })
      }

      return manager.get(query).then((user) => {
        const { passwordHash: _passwordHash, ...safeUser } = user
        return response(res, BamblooStatusCode.Success, '获取用户信息成功', safeUser)
      })
    })
    .catch((err) => {
      return response(
        res,
        err.code || BamblooStatusCode.EntityNonexist,
        err.msg || '获取用户信息失败',
      )
    })
}
