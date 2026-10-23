import { timingSafeEqual } from 'node:crypto'
import type { Response } from 'express'
import { BamblooStatusCode } from '../../../../common/status'
import { response } from '../../util/secretary'
import type { WpiRequest } from '../../util/wpi-access'

function same_hash(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual, 'hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  )
}

export const config = { access: 'protected' as const }

export default function handler(
  params: { [key: string]: unknown },
  req: WpiRequest,
  res: Response,
) {
  const user = req.user
  const currentPasswordHash =
    typeof params.currentPasswordHash === 'string' ? params.currentPasswordHash : ''
  const newPasswordHash = typeof params.newPasswordHash === 'string' ? params.newPasswordHash : ''

  if (
    !user ||
    !/^[a-f0-9]{64}$/i.test(currentPasswordHash) ||
    !/^[a-f0-9]{64}$/i.test(newPasswordHash)
  ) {
    return response(res, BamblooStatusCode.BadRequest, '密码格式错误')
  }

  if (!same_hash(currentPasswordHash, user.passwordHash)) {
    return response(res, BamblooStatusCode.AuthenticationFail, '当前密码错误')
  }
  return user
    .updatePassword(newPasswordHash)
    .then(() => response(res, BamblooStatusCode.Success, '密码已更新'))
    .catch(() => response(res, BamblooStatusCode.Uncategoried, '密码更新失败'))
}
