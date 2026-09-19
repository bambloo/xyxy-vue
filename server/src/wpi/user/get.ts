import type { Request, Response } from 'express'
import { BamblooStatusCode } from '../../../../common/status'
import { user_manager } from '../../core/manager/user'
import { response } from '../../util/secretary'
import { to_public_user } from '../../core/entity/public-user'

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
        return response(res, BamblooStatusCode.Success, '获取用户信息成功', to_public_user(user))
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
