import type { Response } from 'express'
import { BamblooStatusCode } from '../../../../common/status'
import type { WpiRequest } from '../../util/wpi-access'
import { format_timestamp } from '../../util/date-time'
import { mongo_helper } from '../../util/mongo-helper'
import { response } from '../../util/secretary'

export const config = { access: 'protected' as const }

const MAX_SUGGESTION_LENGTH = 5000

export default function handler(
  params: Record<string, unknown>,
  req: WpiRequest,
  res: Response,
) {
  const content = typeof params.content === 'string' ? params.content.trim() : ''
  if (!req.user || !content || content.length > MAX_SUGGESTION_LENGTH) {
    return response(res, BamblooStatusCode.FormatError, '建议内容不能为空且不能超过 5000 个字符')
  }

  const createdAt = format_timestamp(new Date())
  return mongo_helper
    .ddo((db) =>
      db.collection('site_suggestion').insertOne({
        userTag: req.user!.tag,
        content,
        createdAt,
      }),
    )
    .then(() => response(res, BamblooStatusCode.Success, '建议已提交'))
    .catch((error: unknown) => {
      console.error(`保存用户 ${req.user!.tag} 的建议失败`, error)
      return response(res, BamblooStatusCode.Uncategoried, '建议提交失败')
    })
}
