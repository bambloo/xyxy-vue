import { timingSafeEqual } from 'node:crypto'
import type { Request, Response } from 'express'
import { BamblooStatusCode } from '../../../../common/status'
import { user_manager } from '../../core/manager/user'
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

export default async function handler(
  params: { [key: string]: unknown },
  req: Request,
  res: Response,
) {
  const auth = (req as WpiRequest).auth
  const currentPasswordHash =
    typeof params.currentPasswordHash === 'string' ? params.currentPasswordHash : ''
  const newPasswordHash = typeof params.newPasswordHash === 'string' ? params.newPasswordHash : ''

  if (
    !auth ||
    !/^[a-f0-9]{64}$/i.test(currentPasswordHash) ||
    !/^[a-f0-9]{64}$/i.test(newPasswordHash)
  ) {
    return response(res, BamblooStatusCode.BadRequest, '密码格式错误')
  }

  try {
    const manager = await user_manager.instance()
    const user = await manager.get({ tag: auth.userTag })
    if (!same_hash(currentPasswordHash, user.passwordHash)) {
      return response(res, BamblooStatusCode.AuthenticationFail, '当前密码错误')
    }

    await manager.updatePassword(auth.userTag, newPasswordHash)
    return response(res, BamblooStatusCode.Success, '密码已更新')
  } catch {
    return response(res, BamblooStatusCode.Uncategoried, '密码更新失败')
  }
}
