import { randomUUID } from 'node:crypto'
import type { Response } from 'express'
import { MongoServerError, type Collection } from 'mongodb'
import {
  GALAXY_STAR_COLORS,
  type GalaxyStarComment,
  type GalaxyStarConnection,
  type GalaxyStarVote,
  type SentGalaxyStar,
  type GalaxyStarView,
} from '../../../../common/entity/galaxy-star'
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
  votes?: {
    userTag: string
    vote: GalaxyStarVote
    sourceStarId?: string
    createdAt?: string
  }[]
  likeCount?: number
  dislikeCount?: number
  comments?: (GalaxyStarComment & { userTag: string })[]
  links?: { sourceStarId: string; createdAt: string }[]
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
      { projection: { _id: 1, id: 1 } },
    )
    const tomorrow = new Date(now)
    tomorrow.setHours(24, 0, 0, 0)
    return response(res, BamblooStatusCode.Success, undefined, {
      canSend: !sentToday,
      hasSentToday: Boolean(sentToday),
      todayStarId: sentToday?.id,
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
      votes: [],
      likeCount: 0,
      dislikeCount: 0,
      comments: [],
      links: [],
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

  if (params.action === 'vote') {
    const starId = typeof params.starId === 'string' ? params.starId.trim() : ''
    const vote = params.vote
    if (!starId || (vote !== 'like' && vote !== 'dislike')) {
      throw new BamblooError(BamblooStatusCode.BadRequest, '星星评价无效')
    }

    const sourceStar = await collection.findOne({ _id: `${user.tag}:${day}` })
    if (!sourceStar) {
      throw new BamblooError(BamblooStatusCode.BadRequest, '今天寄出星星后才能评价')
    }
    const target = await collection.findOne(
      { id: starId },
      { projection: { _id: 1, userTag: 1, votes: 1 } },
    )
    if (!target) {
      throw new BamblooError(BamblooStatusCode.EntityNonexist, '星星不存在')
    }
    if (target.userTag === user.tag) {
      throw new BamblooError(BamblooStatusCode.BadRequest, '不能评价自己的星星')
    }
    if (target.votes?.some((entry) => entry.userTag === user.tag)) {
      throw new BamblooError(BamblooStatusCode.BadRequest, '你已经评价过这颗星星')
    }

    const updated = await collection.updateOne(
      {
        _id: target._id,
        votes: { $not: { $elemMatch: { userTag: user.tag } } },
      },
      {
        $push: {
          votes: {
            userTag: user.tag,
            vote,
            sourceStarId: sourceStar.id,
            createdAt: format_timestamp(now),
          },
          links: { sourceStarId: sourceStar.id, createdAt: format_timestamp(now) },
        },
        $inc: vote === 'like' ? { likeCount: 1 } : { dislikeCount: 1 },
      },
    )
    if (updated.modifiedCount !== 1) {
      throw new BamblooError(BamblooStatusCode.BadRequest, '你已经评价过这颗星星')
    }

    return listStars(collection, user.tag, res)
  }

  if (params.action === 'comment') {
    const starId = typeof params.starId === 'string' ? params.starId.trim() : ''
    const content = typeof params.content === 'string' ? params.content.trim() : ''
    const parentCommentId =
      typeof params.parentCommentId === 'string' ? params.parentCommentId.trim() : undefined
    if (!starId || !content || content.length > 500) {
      throw new BamblooError(BamblooStatusCode.BadRequest, '评论内容不能为空且不能超过500字')
    }
    if (params.parentCommentId !== undefined && !parentCommentId) {
      throw new BamblooError(BamblooStatusCode.BadRequest, '回复目标无效')
    }

    const sourceStar = await collection.findOne({ _id: `${user.tag}:${day}` })
    if (!sourceStar) {
      throw new BamblooError(BamblooStatusCode.BadRequest, '今天寄出星星后才能评论')
    }
    const target = await collection.findOne({ id: starId }, { projection: { _id: 1, userTag: 1 } })
    if (!target) {
      throw new BamblooError(BamblooStatusCode.EntityNonexist, '星星不存在')
    }
    if (target.userTag === user.tag) {
      throw new BamblooError(BamblooStatusCode.BadRequest, '不能评论自己的星星')
    }
    if (parentCommentId) {
      const targetWithComments = await collection.findOne(
        { _id: target._id },
        { projection: { comments: 1 } },
      )
      const parentComment = targetWithComments?.comments?.find(
        (entry) => entry.id === parentCommentId,
      )
      if (!parentComment) {
        throw new BamblooError(BamblooStatusCode.EntityNonexist, '评论不存在')
      }
    }

    const createdAt = format_timestamp(now)
    const comment: GalaxyStarComment & { userTag: string } = {
      id: randomUUID(),
      sourceStarId: sourceStar.id,
      sourceStarTitle: sourceStar.title,
      content,
      createdAt,
      userTag: user.tag,
      ...(parentCommentId ? { parentCommentId } : {}),
    }
    const updated = await collection.updateOne(
      { _id: target._id },
      {
        $push: {
          comments: comment,
          links: { sourceStarId: sourceStar.id, createdAt },
        },
      },
    )
    if (updated.modifiedCount !== 1) {
      throw new BamblooError(BamblooStatusCode.EntityNonexist, '星星不存在')
    }
    return listStars(collection, user.tag, res)
  }

  return listStars(collection, user.tag, res)
}

async function listStars(collection: Collection<GalaxyStarRecord>, userTag: string, res: Response) {
  const records = await collection
    .find(
      {},
      {
        projection: { _id: 0, userTag: 0, day: 0 },
      },
    )
    .sort({ createdAt: 1 })
    .toArray()
  const pairCounts = new Map<string, number>()
  const connectionCounts = new Map<string, number>()
  records.forEach((record) => {
    record.links?.forEach(({ sourceStarId }) => {
      const pairKey = `${sourceStarId}:${record.id}`
      pairCounts.set(pairKey, (pairCounts.get(pairKey) ?? 0) + 1)
      connectionCounts.set(sourceStarId, (connectionCounts.get(sourceStarId) ?? 0) + 1)
      connectionCounts.set(record.id, (connectionCounts.get(record.id) ?? 0) + 1)
    })
  })
  const connections: GalaxyStarConnection[] = [...pairCounts].map(([key, count]) => {
    const [sourceStarId = '', targetStarId = ''] = key.split(':')
    return { sourceStarId, targetStarId, count }
  })
  const stars: GalaxyStarView[] = records.map(
    ({
      _id: _recordId,
      userTag: ownerTag,
      day: _day,
      votes = [],
      links: _links,
      likeCount = 0,
      dislikeCount = 0,
      comments = [],
      ...star
    }) => ({
      ...star,
      likeCount,
      dislikeCount,
      connectionCount: connectionCounts.get(star.id) ?? 0,
      comments: comments.map(({ userTag: _commentUserTag, ...comment }) => comment),
      isOwn: ownerTag === userTag,
      myVote: votes.find((entry) => entry.userTag === userTag)?.vote,
    }),
  )
  return response(res, BamblooStatusCode.Success, undefined, { stars, connections })
}
