import { randomUUID } from 'node:crypto'
import type { Response } from 'express'
import { MongoServerError, type Collection } from 'mongodb'
import {
  GALAXY_STAR_COLORS,
  type GalaxyStarComment,
  type GalaxyStarConnection,
  type GalaxyStarListView,
  type GalaxyStarVote,
  type SentGalaxyStar,
  type GalaxyStarView,
} from '../../../common/entity/galaxy-star'
import { BamblooError, BamblooStatusCode } from '../../../common/status'
import type { User } from '../core/entity/user'
import { user_manager } from '../core/manager/user'
import { format_local_day, format_timestamp } from './date-time'
import { mongo_helper } from './mongo-helper'
import { refresh_session } from './session'
import { response } from './secretary'
import type { WpiRequest } from './wpi-access'

export interface GalaxyStarRecord extends SentGalaxyStar {
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
  comments?: (GalaxyStarComment & { userTag: string; anonymousDay?: string })[]
  links?: { sourceStarId: string; createdAt: string }[]
}

export async function getGalaxyStarCollection() {
  return mongo_helper.ddo((db) => db.collection<GalaxyStarRecord>('galaxy_star'))
}

export function getGalaxyStarDay(now = new Date()) {
  return format_local_day(now)
}

export function requireGalaxyStarUser(req: WpiRequest): User {
  if (!req.user) {
    throw new BamblooError(BamblooStatusCode.Unauthorized, '需要登录后访问')
  }
  return req.user
}

export async function getOptionalGalaxyStarUser(req: WpiRequest, res: Response) {
  try {
    const session = await refresh_session(req, res)
    req.auth = session.payload
    req.user = await user_manager
      .instance()
      .then((manager) => manager.get({ tag: session.payload.userTag }))
    return req.user
  } catch (error) {
    if (
      error instanceof BamblooError &&
      (error.code === BamblooStatusCode.Unauthorized ||
        error.code === BamblooStatusCode.EntityNonexist)
    ) {
      return undefined
    }
    throw error
  }
}

export async function getGalaxyStarStatus(
  collection: Collection<GalaxyStarRecord>,
  user: User,
  res: Response,
  now = new Date(),
) {
  const day = getGalaxyStarDay(now)
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

export async function sendGalaxyStar(
  params: Record<string, unknown>,
  collection: Collection<GalaxyStarRecord>,
  user: User,
  res: Response,
  now = new Date(),
) {
  const day = getGalaxyStarDay(now)
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
  const anonymousCommentRecords = await collection
    .find(
      { comments: { $elemMatch: { userTag: user.tag, anonymousDay: day } } },
      { projection: { _id: 1, comments: 1 } },
    )
    .toArray()
  for (const commentRecord of anonymousCommentRecords) {
    const anonymousComments =
      commentRecord.comments?.filter(
        (comment) => comment.userTag === user.tag && comment.anonymousDay === day,
      ) ?? []
    if (anonymousComments.length === 0) continue
    await collection.updateOne(
      {
        _id: commentRecord._id,
        comments: { $elemMatch: { userTag: user.tag, anonymousDay: day } },
      },
      {
        $set: {
          'comments.$[anonymousComment].sourceStarId': star.id,
          'comments.$[anonymousComment].sourceStarTitle': star.title,
        },
        $unset: { 'comments.$[anonymousComment].anonymousDay': '' },
        $push: {
          links: {
            $each: anonymousComments.map(({ createdAt }) => ({
              sourceStarId: star.id,
              createdAt,
            })),
          },
        },
      },
      {
        arrayFilters: [
          { 'anonymousComment.userTag': user.tag, 'anonymousComment.anonymousDay': day },
        ],
      },
    )
  }
  return response(res, BamblooStatusCode.Success, undefined, { star })
}

export async function voteForGalaxyStar(
  params: Record<string, unknown>,
  collection: Collection<GalaxyStarRecord>,
  user: User,
  res: Response,
  now = new Date(),
) {
  const day = getGalaxyStarDay(now)
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

  return listGalaxyStars(params, collection, user.tag, res)
}

export async function commentOnGalaxyStar(
  params: Record<string, unknown>,
  collection: Collection<GalaxyStarRecord>,
  user: User,
  res: Response,
  now = new Date(),
) {
  const day = getGalaxyStarDay(now)
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
  const target = await collection.findOne({ id: starId }, { projection: { _id: 1, userTag: 1 } })
  if (!target) {
    throw new BamblooError(BamblooStatusCode.EntityNonexist, '星星不存在')
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
    content,
    createdAt,
    userTag: user.tag,
    ...(sourceStar
      ? { sourceStarId: sourceStar.id, sourceStarTitle: sourceStar.title }
      : { anonymousDay: day }),
    ...(parentCommentId ? { parentCommentId } : {}),
  }
  const updated = await collection.updateOne(
    { _id: target._id },
    sourceStar
      ? {
          $push: {
            comments: comment,
            links: { sourceStarId: sourceStar.id, createdAt },
          },
        }
      : { $push: { comments: comment } },
  )
  if (updated.modifiedCount !== 1) {
    throw new BamblooError(BamblooStatusCode.EntityNonexist, '星星不存在')
  }
  return listGalaxyStars(params, collection, user.tag, res)
}

export async function seedGalaxyBlackHoleStars(
  params: Record<string, unknown>,
  collection: Collection<GalaxyStarRecord>,
  user: User,
  res: Response,
  now = new Date(),
) {
  if (!user.isAdmin) {
    throw new BamblooError(BamblooStatusCode.Unauthorized, '只有管理员可以创建黑洞测试星')
  }
  const count = getBlackHoleSeedCount(params.count)
  const day = getGalaxyStarDay(now)
  const samples = [
    ['被遗忘的星球', '它曾在星图边缘闪烁，如今沉入黑洞深处。', GALAXY_STAR_COLORS[0]],
    ['最后一束微光', '穿过漫长夜空的光，最终也被引力捕获。', GALAXY_STAR_COLORS[3]],
    ['沉默的回声', '没有人记得它的名字，只有星尘仍在回应。', GALAXY_STAR_COLORS[4]],
    ['坠落轨道', '它偏离了原来的轨道，缓缓靠近事件视界。', GALAXY_STAR_COLORS[2]],
    ['深空旅人', '在无声的宇宙里，它停止了漂流。', GALAXY_STAR_COLORS[5]],
    ['暗面微光', '微弱的光芒没有熄灭，只是再也无法逃离。', GALAXY_STAR_COLORS[1]],
    ['失重的梦', '一场尚未醒来的梦，被引力留在此处。', GALAXY_STAR_COLORS[6]],
    ['星尘来信', '这封来自远方的信，最终落进了黑洞。', GALAXY_STAR_COLORS[7]],
    ['午夜星屑', '它把最后的愿望留给了无边的夜色。', GALAXY_STAR_COLORS[8]],
    ['归于寂静', '所有旅程都有终点，它的终点是一片深邃。', GALAXY_STAR_COLORS[9]],
  ] as const
  const seedRecords: GalaxyStarRecord[] = Array.from({ length: count }, (_, index) => {
    const sample = samples[index % samples.length]!
    const suffix = index < samples.length ? '' : ` ${index + 1}`
    return {
      _id: `blackhole-demo:${index + 1}`,
      id: `blackhole-demo-${index + 1}`,
      title: `${sample[0]}${suffix}`,
      content: sample[1],
      color: sample[2],
      createdAt: format_timestamp(now),
      userTag: 'system:blackhole-demo',
      day,
      likeCount: 0,
      dislikeCount: 9,
      votes: [],
      comments: [],
      links: [],
    }
  })
  const result = await collection.bulkWrite(
    seedRecords.map((record) => ({
      updateOne: {
        filter: { _id: record._id },
        update: { $setOnInsert: record },
        upsert: true,
      },
    })),
  )
  return response(res, BamblooStatusCode.Success, undefined, {
    createdCount: result.upsertedCount,
    starIds: seedRecords.map(({ id }) => id),
  })
}

export function getBlackHoleLimit(value: unknown) {
  if (value === undefined) return 20
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 20) {
    throw new BamblooError(BamblooStatusCode.BadRequest, '每批黑洞星星数量必须介于 1 到 20 之间')
  }
  return value
}

export async function listGalaxyStars(
  params: Record<string, unknown>,
  collection: Collection<GalaxyStarRecord>,
  userTag: string | undefined,
  res: Response,
) {
  const view = getListView(params.view)
  if (!userTag && view !== 'normal') {
    throw new BamblooError(BamblooStatusCode.Unauthorized, '需要登录后访问')
  }
  const limit = view === 'blackhole' ? getBlackHoleLimit(params.limit) : 100
  const excludedStarIds = getStarIdSet(params.excludeIds, '排除星星列表')
  const requestedStarIds = getStarIdSet(params.includeIds, '指定星星列表')
  return listStars(collection, userTag, res, view, limit, excludedStarIds, requestedStarIds)
}

async function listStars(
  collection: Collection<GalaxyStarRecord>,
  userTag: string | undefined,
  res: Response,
  view: GalaxyStarListView = 'normal',
  limit = 100,
  excludedStarIds = new Set<string>(),
  requestedStarIds = new Set<string>(),
) {
  const records = await collection
    .find({}, { projection: { _id: 0, userTag: 0, day: 0 } })
    .sort({ createdAt: 1 })
    .toArray()
  const pairCounts = new Map<string, number>()
  records.forEach((record) => {
    record.links?.forEach(({ sourceStarId }) => {
      const pairKey = `${sourceStarId}:${record.id}`
      pairCounts.set(pairKey, (pairCounts.get(pairKey) ?? 0) + 1)
    })
  })
  const allConnections: GalaxyStarConnection[] = [...pairCounts].map(([key, count]) => {
    const [sourceStarId = '', targetStarId = ''] = key.split(':')
    return { sourceStarId, targetStarId, count }
  })
  const hiddenRecords = records.filter(isBlackHoleStar)
  const hiddenIds = hiddenRecords.map(({ id }) => id)
  const visibleConnections =
    view === 'blackhole'
      ? []
      : allConnections.filter(
          ({ sourceStarId, targetStarId }) =>
            !hiddenIds.includes(sourceStarId) && !hiddenIds.includes(targetStarId),
        )
  const connectionCounts = new Map<string, number>()
  visibleConnections.forEach(({ sourceStarId, targetStarId, count }) => {
    connectionCounts.set(sourceStarId, (connectionCounts.get(sourceStarId) ?? 0) + count)
    connectionCounts.set(targetStarId, (connectionCounts.get(targetStarId) ?? 0) + count)
  })
  const selectedRecords =
    view === 'blackhole' ? hiddenRecords : records.filter((record) => !isBlackHoleStar(record))
  const totalCount = selectedRecords.length
  let batchRecords = selectedRecords
  if (view === 'blackhole') {
    const requestedRecords = selectedRecords.filter(({ id }) => requestedStarIds.has(id))
    if (requestedRecords.length > 0) {
      batchRecords = requestedRecords.slice(0, limit)
    } else {
      const candidates = selectedRecords.filter(({ id }) => !excludedStarIds.has(id))
      const pool = candidates.length > 0 ? candidates : [...selectedRecords]
      for (let index = pool.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1))
        ;[pool[index], pool[swapIndex]] = [pool[swapIndex]!, pool[index]!]
      }
      batchRecords = pool.slice(0, limit)
    }
  }
  const stars: GalaxyStarView[] = batchRecords.map(
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
      ...(!userTag ? { title: '', content: '' } : {}),
      likeCount,
      dislikeCount,
      connectionCount: connectionCounts.get(star.id) ?? 0,
      comments: userTag
        ? comments.map(
            ({ userTag: _commentUserTag, anonymousDay: _anonymousDay, ...comment }) => comment,
          )
        : [],
      isOwn: Boolean(userTag && ownerTag === userTag),
      myVote: userTag ? votes.find((entry) => entry.userTag === userTag)?.vote : undefined,
    }),
  )
  return response(res, BamblooStatusCode.Success, undefined, {
    stars,
    connections: visibleConnections,
    hiddenStarIds: view === 'blackhole' ? batchRecords.map(({ id }) => id) : hiddenIds,
    totalCount,
  })
}

function getListView(value: unknown): GalaxyStarListView {
  if (value === undefined || value === 'normal') return 'normal'
  if (value === 'blackhole') return 'blackhole'
  throw new BamblooError(BamblooStatusCode.BadRequest, '星星列表视图无效')
}

function getStarIdSet(value: unknown, fieldName: string) {
  if (value === undefined) return new Set<string>()
  if (
    !Array.isArray(value) ||
    value.length > 100 ||
    !value.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 128)
  ) {
    throw new BamblooError(BamblooStatusCode.BadRequest, `${fieldName}无效`)
  }
  return new Set(value)
}

function getBlackHoleSeedCount(value: unknown) {
  if (value === undefined) return 5
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 100) {
    throw new BamblooError(BamblooStatusCode.BadRequest, '测试星数量必须介于 1 到 100 之间')
  }
  return value
}

function isBlackHoleStar(star: Pick<GalaxyStarRecord, 'likeCount' | 'dislikeCount'>) {
  const likeCount = star.likeCount ?? 0
  const dislikeCount = star.dislikeCount ?? 0
  return dislikeCount > 8 && dislikeCount > likeCount * 1.5
}
