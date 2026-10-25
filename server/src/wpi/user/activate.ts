import type { Request, Response } from 'express'
import {
  MAX_USER_HOBBIES_LENGTH,
  normalize_user_hobbies,
} from '../../../../common/entity/user'
import { BamblooStatusCode } from '../../../../common/status'
import { user_manager } from '../../core/manager/user'
import { daily_session_manager } from '../../core/manager/daily-session'
import { response } from '../../util/secretary'
import { mongo_helper } from '../../util/mongo-helper'
import { issue_session } from '../../util/session'
import { to_public_user } from '../../core/entity/user'
import { format_timestamp } from '../../util/date-time'

export const config = { access: 'public' as const }

export default function handler(params: { [key: string]: unknown }, req: Request, res: Response) {
  const tag = typeof params.tag === 'string' ? params.tag.trim() : ''
  const name = typeof params.name === 'string' ? params.name.trim() : ''
  const passwordHash = typeof params.passwordHash === 'string' ? params.passwordHash.trim() : ''
  const hobbies = typeof params.hobbies === 'string' ? normalize_user_hobbies(params.hobbies) : ''
  if (hobbies.length > MAX_USER_HOBBIES_LENGTH) {
    return response(res, BamblooStatusCode.FormatError, '兴趣爱好总长度不能超过 500 个字符')
  }
  if (
    !tag ||
    !name ||
    !/^[a-f0-9]{64}$/i.test(passwordHash)
  ) {
    return response(res, BamblooStatusCode.FormatError, 'Tag、姓名和密码格式错误')
  }

  const profile = {
    account: tag,
    name,
    passwordHash,
    phone: typeof params.phone === 'string' ? params.phone.trim() : '',
    email: typeof params.email === 'string' ? params.email.trim() : '',
    birthday: typeof params.birthday === 'string' ? params.birthday.trim() : '',
    hobbies,
    city: typeof params.city === 'string' ? params.city.trim() : '',
    avatar: typeof params.avatar === 'string' ? params.avatar.trim() : '',
    isActive: true,
    updatedAt: format_timestamp(new Date()),
  }

  return user_manager
    .instance()
    .then((manager) => manager.get({ tag }))
    .then(() =>
      mongo_helper.ddo((db) =>
        db.collection('user').updateOne({ tag, isActive: { $ne: true } }, { $set: profile }),
      ),
    )
    .then((result) => {
      if (!result.matchedCount) {
        return response(res, BamblooStatusCode.EntityExists, 'Tag 已激活')
      }
      return user_manager
        .instance()
        .then((manager) => manager.get({ tag }))
        .then((user) => {
          return daily_session_manager
            .recordLogin(user.tag)
            .then(() => daily_session_manager.getConsecutiveLoginDays(user.tag))
            .then((loginStreak) => {
              const token = issue_session(req, res, user)
              return response(res, BamblooStatusCode.Success, 'Tag 激活成功', {
                ...to_public_user(user),
                loginStreak,
                token,
              })
            })
        })
    })
    .catch(() => response(res, BamblooStatusCode.EntityNonexist, 'Tag 不存在或已激活'))
}
