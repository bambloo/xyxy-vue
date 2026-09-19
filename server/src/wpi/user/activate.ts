import type { Request, Response } from 'express'
import { BamblooStatusCode } from '../../../../common/status'
import { user_manager } from '../../core/manager/user'
import { response } from '../../util/secretary'
import { mongo_helper } from '../../util/mongo-helper'
import { issue_session } from '../../util/session'
import { to_public_user } from '../../core/entity/public-user'

export const config = { access: 'public' as const }

export default function handler(params: { [key: string]: unknown }, req: Request, res: Response) {
  const tag = typeof params.tag === 'string' ? params.tag.trim() : ''
  const name = typeof params.name === 'string' ? params.name.trim() : ''
  if (!tag || !name) {
    return response(res, BamblooStatusCode.FormatError, 'Tag 和姓名不能为空')
  }

  const profile = {
    name,
    phone: typeof params.phone === 'string' ? params.phone.trim() : '',
    email: typeof params.email === 'string' ? params.email.trim() : '',
    birthday: typeof params.birthday === 'string' ? params.birthday.trim() : '',
    hobbies: typeof params.hobbies === 'string' ? params.hobbies.trim() : '',
    avatar: typeof params.avatar === 'string' ? params.avatar.trim() : '',
    isActive: true,
    updatedAt: new Date().toISOString(),
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
          const token = issue_session(req, res, user)
          return response(res, BamblooStatusCode.Success, 'Tag 激活成功', {
            ...to_public_user(user),
            token,
          })
        })
    })
    .catch(() => response(res, BamblooStatusCode.EntityNonexist, 'Tag 不存在或已激活'))
}
