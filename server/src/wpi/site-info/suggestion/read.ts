import { ObjectId } from 'mongodb'
import type { Response } from 'express'
import { BamblooStatusCode } from '../../../../../common/status'
import type { WpiRequest } from '../../../util/wpi-access'
import { mongo_helper } from '../../../util/mongo-helper'
import { response } from '../../../util/secretary'

export const config = { access: 'private' as const, permissions: ['site.manage'] }

export default async function handler(
  params: Record<string, unknown>,
  req: WpiRequest,
  res: Response,
) {
  const id = typeof params.id === 'string' ? params.id : ''
  if (!ObjectId.isValid(id)) {
    return response(res, BamblooStatusCode.FormatError, '建议编号格式错误')
  }

  try {
    const result = await mongo_helper.ddo((db) =>
      db.collection('site_suggestion').updateOne(
        { _id: new ObjectId(id) },
        { $set: { isRead: true } },
      ),
    )
    if (result.matchedCount !== 1) {
      return response(res, BamblooStatusCode.EntityNonexist, '建议不存在')
    }
    return response(res, BamblooStatusCode.Success, '建议已标记为已读', { id, isRead: true })
  } catch (error) {
    console.error(`管理员 ${req.user?.tag ?? 'unknown'} 标记建议 ${id} 已读失败`, error)
    return response(res, BamblooStatusCode.Uncategoried, '标记建议已读失败')
  }
}
