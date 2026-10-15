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

export default async function handler(
  _params: Record<string, unknown>,
  req: WpiRequest,
  res: Response,
) {
  if (!req.user) {
    return response(res, BamblooStatusCode.Unauthorized, '需要登录后访问')
  }

  try {
    const canManage = req.user.isAdmin || req.user.permissions?.includes('site.manage')
    const declarations = await mongo_helper.ddo(async (db) => {
      const records = await db
        .collection<DeclarationRecord>('site_declaration')
        .find({ _id: { $in: SITE_DECLARATIONS.map((item) => item.id) } })
        .toArray()
      const recordsById = new Map(records.map((record) => [record._id, record]))
      return SITE_DECLARATIONS.map((item) => {
        const record = recordsById.get(item.id)
        return {
          id: item.id,
          content: record?.content ?? '',
          ...(record?.updatedAt ? { updatedAt: record.updatedAt } : {}),
        } satisfies SiteDeclaration
      })
    })

    let suggestions: SiteSuggestion[] = []
    if (canManage) {
      suggestions = await mongo_helper.ddo(async (db) => {
        const records = await db
          .collection<SuggestionRecord>('site_suggestion')
          .find({})
          .sort({ createdAt: -1, _id: -1 })
          .toArray()
        return records.map((record) => ({
          id: record._id.toString(),
          userTag: record.userTag,
          content: record.content,
          createdAt: record.createdAt,
          isRead: record.isRead ?? false,
        }))
      })
    }

    return response(res, BamblooStatusCode.Success, undefined, { declarations, suggestions })
  } catch (error) {
    console.error('读取网站声明和建议失败', error)
    return response(res, BamblooStatusCode.Uncategoried, '网站声明和建议读取失败')
  }
}
