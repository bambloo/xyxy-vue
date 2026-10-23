import type { Response } from 'express'
import {
  SITE_DECLARATIONS,
  type SiteDeclaration,
  type SiteSuggestion,
} from '../../../../common/entity/site-info'
import { BamblooStatusCode } from '../../../../common/status'
import type { WpiRequest } from '../../util/wpi-access'
import { mongo_helper } from '../../util/mongo-helper'
import { response } from '../../util/secretary'

export const config = { access: 'protected' as const }

interface DeclarationRecord {
  _id: string
  content: string
  updatedAt: string
}

interface SuggestionRecord {
  _id: import('mongodb').ObjectId
  userTag: string
  content: string
  createdAt: string
  isRead?: boolean
}

export default function handler(
  _params: Record<string, unknown>,
  req: WpiRequest,
  res: Response,
) {
  if (!req.user) {
    return response(res, BamblooStatusCode.Unauthorized, '需要登录后访问')
  }

  const canManage = req.user.isAdmin || req.user.permissions?.includes('site.manage')
  return mongo_helper
    .ddo((db) =>
      db
        .collection<DeclarationRecord>('site_declaration')
        .find({ _id: { $in: SITE_DECLARATIONS.map((item) => item.id) } })
        .toArray(),
    )
    .then((records) => {
      const recordsById = new Map(records.map((record) => [record._id, record]))
      const declarations = SITE_DECLARATIONS.map((item) => {
        const record = recordsById.get(item.id)
        return {
          id: item.id,
          content: record?.content ?? '',
          ...(record?.updatedAt ? { updatedAt: record.updatedAt } : {}),
        } satisfies SiteDeclaration
      })
      if (!canManage) {
        return { declarations, suggestions: [] as SiteSuggestion[] }
      }
      return mongo_helper
        .ddo((db) =>
          db
            .collection<SuggestionRecord>('site_suggestion')
            .find({})
            .sort({ createdAt: -1, _id: -1 })
            .toArray(),
        )
        .then((records) => ({
          declarations,
          suggestions: records.map((record) => ({
            id: record._id.toString(),
            userTag: record.userTag,
            content: record.content,
            createdAt: record.createdAt,
            isRead: record.isRead ?? false,
          })),
        }))
    })
    .then(({ declarations, suggestions }) =>
      response(res, BamblooStatusCode.Success, undefined, { declarations, suggestions }),
    )
    .catch((error: unknown) => {
      console.error('读取网站声明和建议失败', error)
      return response(res, BamblooStatusCode.Uncategoried, '网站声明和建议读取失败')
    })
}
