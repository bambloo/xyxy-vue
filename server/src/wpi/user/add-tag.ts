import type { Request, Response } from 'express'
import { BamblooStatusCode } from '../../../../common/status'
import { user_manager } from '../../core/manager/user'
import { response } from '../../util/secretary'

export const config = { access: 'private' as const, permissions: ['users.import'] }

export default function handler(params: { [key: string]: unknown }, _req: Request, res: Response) {
  const tag = typeof params.tag === 'string' ? params.tag.trim() : ''
  if (!tag) return response(res, BamblooStatusCode.FormatError, '请输入用户 Tag')

  return user_manager
    .instance()
    .then((manager) => manager.importInactiveTags([tag]))
    .then(([user]) => {
      const { passwordHash: _passwordHash, ...safeUser } = user
      return response(res, BamblooStatusCode.Success, 'Tag 添加成功', safeUser)
    })
    .catch(() => response(res, BamblooStatusCode.BadRequest, 'Tag 添加失败'))
}
