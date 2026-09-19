// import { NextFunction } from 'express'

import { Response } from 'express'
import { BamblooStatusCode } from '../../../../common/status'
import { user_manager } from '../../core/manager/user'
import { response } from '../../util/secretary'

export default function handler(
  params: { [key: string]: string },
  req: Request,
  res: Response,
  // next: NextFunction,
) {
  user_manager
    .instance()
    .then((manager) => {
      return manager.get({ id: params.id }).then((user) => {
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
