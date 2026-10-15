import { randomUUID } from 'node:crypto'
import type { Response } from 'express'
import { MongoServerError } from 'mongodb'
import { GALAXY_STAR_COLORS, type SentGalaxyStar } from '../../../../common/entity/galaxy-star'
import { BamblooError, BamblooStatusCode } from '../../../../common/status'
import type { User } from '../../core/entity/user'
import { mongo_helper } from '../../util/mongo-helper'
import { format_local_day, format_timestamp } from '../../util/date-time'
import { response } from '../../util/secretary'
import type { WpiRequest } from '../../util/wpi-access'

export const config = { access: 'protected' as const }

interface GalaxyStarRecord extends SentGalaxyStar {
  _id: string
  userTag: string
  day: string
}

function requireUser(req: WpiRequest): User {
  if (!req.user) {
    throw new BamblooError(BamblooStatusCode.Unauthorized, '需要登录后访问')
  }
  return req.user
}

export default async function handler(
  params: Record<string, unknown>,
  req: WpiRequest,
  res: Response,
) {
  const user = requireUser(req)
  const now = new Date()
  const day = format_local_day(now)
  const collection = await mongo_helper.ddo((db) => db.collection<GalaxyStarRecord>('galaxy_star'))

  if (params.action === 'status') {
    const sentToday = await collection.findOne(
      { _id: `${user.tag}:${day}` },
      { projection: { _id: 1 } },
    )
    const tomorrow = new Date(now)
    tomorrow.setHours(24, 0, 0, 0)
    return response(res, BamblooStatusCode.Success, undefined, {
      canSend: !sentToday,
      resetsAt: tomorrow.toISOString(),
    })
  }

  if (params.action === 'send') {
    const title = typeof params.title === 'string' ? params.title.trim() : ''
    const content = typeof params.content === 'string' ? params.content.trim() : ''
    const color = params.color
    const isPresetColor = (value: unknown): value is SentGalaxyStar['color'] =>
      typeof value === 'string' && GALAXY_STAR_COLORS.some((preset) => preset === value)
    if (!title || title.length > 40 || !content || content.length > 500 || !isPresetColor(color)) {
      throw new BamblooError(BamblooStatusCode.BadRequest, '星星标题、内容或颜色不符合要求')
    }

    const star: SentGalaxyStar = {
      id: randomUUID(),
      title,
      content,
      color,
      createdAt: format_timestamp(now),
    }
    const record: GalaxyStarRecord = {
      ...star,
      _id: `${user.tag}:${day}`,
      userTag: user.tag,
      day,
    }
    try {
      await collection.insertOne(record)
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new BamblooError(BamblooStatusCode.DailyFortuneGenerated, '今天已经发送过星星了')
      }
      throw error
    }
    return response(res, BamblooStatusCode.Success, undefined, { star })
  }

  const records = await collection
    .find(
      {},
      {
        projection: { _id: 0, userTag: 0, day: 0 },
      },
    )
    .sort({ createdAt: 1 })
    .toArray()
  return response(res, BamblooStatusCode.Success, undefined, { stars: records })
}
