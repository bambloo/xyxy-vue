import { timingSafeEqual } from 'node:crypto'
import { Request, Response } from 'express'
import { BamblooStatusCode } from '../../../../common/status'
import { user_manager } from '../../core/manager/user'
import { response } from '../../util/secretary'
import { issue_session } from '../../util/session'

function same_hash(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual, 'hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  )
}

export default function handler(params: { [key: string]: unknown }, req: Request, res: Response) {
  const account = typeof params.account === 'string' ? params.account.trim() : ''
  const passwordHash = typeof params.passwordHash === 'string' ? params.passwordHash : ''

  if (!account || !/^[a-f0-9]{64}$/i.test(passwordHash)) {
    return response(res, BamblooStatusCode.AuthenticationFail, '账号或密码错误')
  }

  return user_manager
    .instance()
    .then((manager) => manager.get({ account }).catch(() => manager.get({ phone: account })))
    .then((user) => {
      if (typeof user.passwordHash !== 'string' || !same_hash(passwordHash, user.passwordHash)) {
        return response(res, BamblooStatusCode.AuthenticationFail, '账号或密码错误')
      }

      const token = issue_session(req, res, user)
      const { passwordHash: _passwordHash, ...safeUser } = user
      return response(res, BamblooStatusCode.Success, '登录成功', { ...safeUser, token })
    })
    .catch(() => response(res, BamblooStatusCode.AuthenticationFail, '账号或密码错误'))
}
