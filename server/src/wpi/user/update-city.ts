import type { Response } from 'express'
import { parse_user_location } from '../../../../common/entity/user'
import { BamblooError, BamblooStatusCode } from '../../../../common/status'
import { user_manager } from '../../core/manager/user'
import { to_public_user } from '../../core/entity/user'
import { response } from '../../util/secretary'
import type { WpiRequest } from '../../util/wpi-access'

export const config = { access: 'private' as const, permissions: ['users.import'] }

export default function handler(
  params: Record<string, unknown>,
  _req: WpiRequest,
  res: Response,
) {
  const tag = typeof params.tag === 'string' ? params.tag.trim() : ''
  const city = typeof params.city === 'string' ? params.city.trim() : ''
  const location =
    params.location === undefined ? undefined : parse_user_location(params.location)
  if (!tag || city.length > 500 || (params.location !== undefined && !location)) {
    return response(res, BamblooStatusCode.FormatError, '用户 Tag 或城市格式错误')
  }

  return user_manager
    .instance()
    .then((manager) => manager.get({ tag }))
    .then((user) => user.updateProfile({ city, ...(location ? { location } : {}) }).then(() => user))
    .then((user) => response(res, BamblooStatusCode.Success, '城市已更新', to_public_user(user)))
    .catch((error: unknown) => {
      if (error instanceof BamblooError) {
        return response(res, error.code, error.msg)
      }
      console.error(`更新用户 ${tag} 的城市失败`, error)
      return response(res, BamblooStatusCode.Uncategoried, '城市更新失败')
    })
}
