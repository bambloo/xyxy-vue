import type { Response } from 'express'
import {
  MAX_USER_HOBBIES_LENGTH,
  normalize_user_hobbies,
  parse_user_location,
} from '../../../../common/entity/user'
import { BamblooError, BamblooStatusCode } from '../../../../common/status'
import { to_public_user } from '../../core/entity/user'
import { response } from '../../util/secretary'
import type { WpiRequest } from '../../util/wpi-access'

export const config = { access: 'protected' as const }

export default async function handler(
  params: Record<string, unknown>,
  req: WpiRequest,
  res: Response,
) {
  const user = req.user
  const name = typeof params.name === 'string' ? params.name.trim() : ''
  const phone = typeof params.phone === 'string' ? params.phone.trim() : ''
  const email = typeof params.email === 'string' ? params.email.trim() : ''
  const birthday = typeof params.birthday === 'string' ? params.birthday.trim() : ''
  const hobbies = typeof params.hobbies === 'string' ? normalize_user_hobbies(params.hobbies) : ''
  const city = typeof params.city === 'string' ? params.city.trim() : ''
  const location =
    params.location === undefined ? undefined : parse_user_location(params.location)

  if (
    !user ||
    !name ||
    !/^\d{11}$/.test(phone) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(birthday) ||
    (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
    hobbies.length > MAX_USER_HOBBIES_LENGTH ||
    city.length > 500 ||
    (params.location !== undefined && !location)
  ) {
    return response(res, BamblooStatusCode.FormatError, '个人资料格式错误')
  }

  try {
    await user.updateProfile({
      name,
      phone,
      email,
      birthday,
      hobbies,
      city,
      ...(location ? { location } : {}),
    })
    return response(res, BamblooStatusCode.Success, '个人资料已更新', to_public_user(user))
  } catch (error) {
    if (error instanceof BamblooError) {
      return response(res, error.code, error.msg)
    }
    console.error('更新个人资料失败', error)
    return response(res, BamblooStatusCode.Uncategoried, '个人资料更新失败')
  }
}
