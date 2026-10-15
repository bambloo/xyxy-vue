import type { Response } from 'express'
import {
  isSiteDeclarationId,
  type SiteDeclaration,
} from '../../../../common/entity/site-info'
import { BamblooStatusCode } from '../../../../common/status'
import type { WpiRequest } from '../../util/wpi-access'
import { format_timestamp } from '../../util/date-time'
import { mongo_helper } from '../../util/mongo-helper'
import { response } from '../../util/secretary'

export const config = { access: 'private' as const, permissions: ['site.manage'] }

const MAX_DECLARATION_LENGTH = 20000

interface DeclarationRecord {
  _id: string
  content: string
  updatedAt: string
  updatedBy: string
}

export default async function handler(
  params: Record<string, unknown>,
  req: WpiRequest,
  res: Response,
) {
  const id = typeof params.id === 'string' ? params.id : ''
  const content = typeof params.content === 'string' ? params.content : undefined
  if (
    !req.user ||
    !isSiteDeclarationId(id) ||
    content === undefined ||
    content.length > MAX_DECLARATION_LENGTH
  ) {
    return response(res, BamblooStatusCode.FormatError, '声明项目或正文格式错误')
  }

  try {
    const updatedAt = format_timestamp(new Date())
    await mongo_helper.ddo((db) =>
      db.collection<DeclarationRecord>('site_declaration').updateOne(
        { _id: id },
        { $set: { content, updatedAt, updatedBy: req.user!.tag } },
        { upsert: true },
      ),
    )
    const declaration: SiteDeclaration = { id, content, updatedAt }
    return response(res, BamblooStatusCode.Success, '声明已更新', declaration)
  } catch (error) {
    console.error(`管理员 ${req.user.tag} 更新网站声明 ${id} 失败`, error)
    return response(res, BamblooStatusCode.Uncategoried, '声明更新失败')
  }
}
