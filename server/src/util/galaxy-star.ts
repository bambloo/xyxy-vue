import { randomUUID } from 'node:crypto'
import type { Response } from 'express'
import { MongoServerError, type Collection } from 'mongodb'
import {
  GALAXY_STAR_COLORS,
  type GalaxyBlackHoleEntry,
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

type GalaxyStarCommentRecord = GalaxyStarComment & {
  userTag: string
  anonymousDay?: string
  votes?: {
    userTag: string
    vote: GalaxyStarVote
    sourceStarId?: string
    createdAt?: string
  }[]
}

type GalaxyStarCommentNotification = {
  userTag: string
  commentId: string
}

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
  comments?: GalaxyStarCommentRecord[]
  links?: { sourceStarId: string; createdAt: string }[]
  unreadCommentNotifications?: GalaxyStarCommentNotification[]
  unreadCommentIds?: string[]
  unreadCommentAt?: string
}

export interface GalaxyBlackHoleRecord extends GalaxyBlackHoleEntry {
  _id: string
  contentId: string
  createdAt: string
  updatedAt: string
}

interface GalaxyBlackHoleMetadata {
  _id: string
  migratedAt?: string
}

export function getGalaxyStarCollection() {
  return mongo_helper.ddo((db) => db.collection<GalaxyStarRecord>('galaxy_star'))
}

function getGalaxyBlackHoleCollection() {
  return mongo_helper.ddo((db) => db.collection<GalaxyBlackHoleRecord>('galaxy_black_hole_content'))
}

function getGalaxyBlackHoleMetadataCollection() {
  return mongo_helper.ddo((db) =>
    db.collection<GalaxyBlackHoleMetadata>('galaxy_black_hole_metadata'),
  )
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

export function getOptionalGalaxyStarUser(req: WpiRequest, res: Response) {
  return refresh_session(req, res)
    .then((session) => {
      req.auth = session.payload
      return user_manager
        .instance()
        .then((manager) => manager.get({ tag: session.payload.userTag }))
        .then((user) => {
          req.user = user
          return user
        })
    })
    .catch((error: unknown) => {
      if (
        error instanceof BamblooError &&
        (error.code === BamblooStatusCode.Unauthorized ||
          error.code === BamblooStatusCode.EntityNonexist)
      ) {
        return undefined
      }
      throw error
    })
}

export function getGalaxyStarStatus(
  collection: Collection<GalaxyStarRecord>,
  user: User,
  res: Response,
  now = new Date(),
) {
  const day = getGalaxyStarDay(now)
  return collection
    .findOne(
      { _id: `${user.tag}:${day}` },
      { projection: { _id: 1, id: 1, color: 1 } },
    )
    .then((sentToday) => {
      const tomorrow = new Date(now)
      tomorrow.setHours(24, 0, 0, 0)
      return response(res, BamblooStatusCode.Success, undefined, {
        canSend: !sentToday,
        hasSentToday: Boolean(sentToday),
        todayStarId: sentToday?.id,
        todayStarColor: sentToday?.color,
        resetsAt: tomorrow.toISOString(),
      })
    })
}

export function sendGalaxyStar(
  params: Record<string, unknown>,
  collection: Collection<GalaxyStarRecord>,
  user: User,
  res: Response,
  now = new Date(),
) {
  const day = getGalaxyStarDay(now)
  const title = typeof params.title === 'string' ? params.title.trim() : ''
  const content = typeof params.content === 'string' ? params.content.trim() : ''
  const color = typeof params.color === 'string' ? params.color.toLowerCase() : ''
  const isValidColor = /^#[0-9a-f]{6}$/.test(color)
  if (!title || title.length > 40 || !content || content.length > 500 || !isValidColor) {
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
  return collection
    .insertOne(record)
    .catch((error: unknown) => {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new BamblooError(BamblooStatusCode.DailyFortuneGenerated, '今天已经发送过星星了')
      }
      throw error
    })
    .then(() =>
      collection
        .find(
          { comments: { $elemMatch: { userTag: user.tag, anonymousDay: day } } },
          { projection: { _id: 1, comments: 1 } },
        )
        .toArray(),
    )
    .then((commentRecords) =>
      commentRecords.reduce<Promise<void>>(
        (chain, commentRecord) => {
          const anonymousComments =
            commentRecord.comments?.filter(
              (comment) => comment.userTag === user.tag && comment.anonymousDay === day,
            ) ?? []
          if (anonymousComments.length === 0) return chain
          return chain.then(() =>
            collection.updateOne(
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
            ).then(() => undefined),
          )
        },
        Promise.resolve(),
      ),
    )
    .then(() => response(res, BamblooStatusCode.Success, undefined, { star }))
}

export function voteForGalaxyStar(
  params: Record<string, unknown>,
  collection: Collection<GalaxyStarRecord>,
  user: User,
  res: Response,
  now = new Date(),
) {
  const starId = typeof params.starId === 'string' ? params.starId.trim() : ''
  const vote = params.vote
  if (!starId || (vote !== 'like' && vote !== 'dislike')) {
    throw new BamblooError(BamblooStatusCode.BadRequest, '星星评价无效')
  }

  return Promise.all([
    collection.findOne({ _id: `${user.tag}:${getGalaxyStarDay(now)}` }),
    collection.findOne({ id: starId }, { projection: { _id: 1, userTag: 1, votes: 1 } }),
  ]).then(([sourceStar, target]) => {
    if (!target) {
      throw new BamblooError(BamblooStatusCode.EntityNonexist, '星星不存在')
    }
    const existingVote = target.votes?.find((entry) => entry.userTag === user.tag)
    const voteCountField = vote === 'like' ? 'likeCount' : 'dislikeCount'
    const sourceStarId = sourceStar && target.userTag !== user.tag ? sourceStar.id : undefined
    const updated = existingVote
      ? existingVote.vote === vote
        ? collection.updateOne(
          {
            _id: target._id,
            votes: { $elemMatch: { userTag: user.tag, vote } },
          },
          {
            $pull: {
              votes: { userTag: user.tag },
              ...(existingVote.sourceStarId && existingVote.createdAt
                ? {
                    links: {
                      sourceStarId: existingVote.sourceStarId,
                      createdAt: existingVote.createdAt,
                    },
                  }
                : {}),
            },
            $inc: { [voteCountField]: -1 },
          },
        )
        : collection.updateOne(
          {
            _id: target._id,
            votes: { $elemMatch: { userTag: user.tag, vote: existingVote.vote } },
          },
          {
            $set: { 'votes.$[voter].vote': vote },
            $inc: {
              [existingVote.vote === 'like' ? 'likeCount' : 'dislikeCount']: -1,
              [voteCountField]: 1,
            },
          },
          { arrayFilters: [{ 'voter.userTag': user.tag, 'voter.vote': existingVote.vote }] },
        )
      : collection.updateOne(
        {
          _id: target._id,
          votes: { $not: { $elemMatch: { userTag: user.tag } } },
        },
        {
          $push: {
            votes: {
              userTag: user.tag,
              vote,
              ...(sourceStarId ? { sourceStarId } : {}),
              createdAt: format_timestamp(now),
            },
            ...(sourceStarId
              ? { links: { sourceStarId: sourceStarId, createdAt: format_timestamp(now) } }
              : {}),
          },
          $inc: { [voteCountField]: 1 },
        },
      )
    return updated.then((result) => {
      if (result.modifiedCount !== 1) {
        throw new BamblooError(BamblooStatusCode.BadRequest, '评价状态已变化，请重试')
      }
      return collection.findOne({ _id: target._id })
    }).then((updatedStar) => {
      if (!updatedStar) return undefined
      return getGalaxyBlackHoleCollection().then((blackHoleCollection) =>
        syncBlackHoleEntriesForStar(updatedStar, blackHoleCollection),
      )
    }).then(() => listGalaxyStars(params, collection, user.tag, res))
  })
}

export function voteForGalaxyStarComment(
  params: Record<string, unknown>,
  collection: Collection<GalaxyStarRecord>,
  user: User,
  res: Response,
  now = new Date(),
) {
  const starId = typeof params.starId === 'string' ? params.starId.trim() : ''
  const commentId = typeof params.commentId === 'string' ? params.commentId.trim() : ''
  const vote = params.vote
  if (!starId || !commentId || (vote !== 'like' && vote !== 'dislike')) {
    throw new BamblooError(BamblooStatusCode.BadRequest, '评论评价无效')
  }

  return Promise.all([
    collection.findOne({ _id: `${user.tag}:${getGalaxyStarDay(now)}` }),
    collection.findOne({ id: starId }, { projection: { _id: 1, comments: 1 } }),
  ]).then(([sourceStar, target]) => {
    if (!target) {
      throw new BamblooError(BamblooStatusCode.EntityNonexist, '星星不存在')
    }
    const comment = target.comments?.find(({ id }) => id === commentId)
    if (!comment) {
      throw new BamblooError(BamblooStatusCode.EntityNonexist, '评论不存在')
    }
    const createdAt = format_timestamp(now)
    const existingVote = comment.votes?.find(({ userTag }) => userTag === user.tag)
    const voteCountField = vote === 'like' ? 'likeCount' : 'dislikeCount'
    const updated = existingVote
      ? existingVote.vote === vote
        ? collection.updateOne(
          {
            _id: target._id,
            comments: {
              $elemMatch: {
                id: commentId,
                votes: { $elemMatch: { userTag: user.tag, vote } },
              },
            },
          },
          {
            $pull: {
              'comments.$[targetComment].votes': { userTag: user.tag },
              ...(existingVote.sourceStarId && existingVote.createdAt
                ? {
                    links: {
                      sourceStarId: existingVote.sourceStarId,
                      createdAt: existingVote.createdAt,
                    },
                  }
                : {}),
            },
            $inc: {
              [`comments.$[targetComment].${voteCountField}`]: -1,
            },
          },
          { arrayFilters: [{ 'targetComment.id': commentId }] },
        )
        : collection.updateOne(
          {
            _id: target._id,
            comments: {
              $elemMatch: {
                id: commentId,
                votes: { $elemMatch: { userTag: user.tag, vote: existingVote.vote } },
              },
            },
          },
          {
            $set: { 'comments.$[targetComment].votes.$[voter].vote': vote },
            $inc: {
              [`comments.$[targetComment].${existingVote.vote === 'like' ? 'likeCount' : 'dislikeCount'}`]:
                -1,
              [`comments.$[targetComment].${voteCountField}`]: 1,
            },
          },
          {
            arrayFilters: [
              { 'targetComment.id': commentId },
              { 'voter.userTag': user.tag, 'voter.vote': existingVote.vote },
            ],
          },
        )
      : collection.updateOne(
        {
          _id: target._id,
          comments: {
            $elemMatch: {
              id: commentId,
              'votes.userTag': { $ne: user.tag },
            },
          },
        },
        {
          $push: {
            'comments.$[targetComment].votes': {
              userTag: user.tag,
              vote,
              ...(sourceStar ? { sourceStarId: sourceStar.id, createdAt } : {}),
            },
            ...(sourceStar ? { links: { sourceStarId: sourceStar.id, createdAt } } : {}),
          },
          $inc: {
            [`comments.$[targetComment].${voteCountField}`]: 1,
          },
        },
        {
          arrayFilters: [
            {
              'targetComment.id': commentId,
              'targetComment.votes.userTag': { $ne: user.tag },
            },
          ],
        },
      )
    return updated.then((result) => {
      if (result.modifiedCount !== 1) {
        throw new BamblooError(BamblooStatusCode.BadRequest, '评价状态已变化，请重试')
      }
      return collection.findOne({ _id: target._id })
    }).then((updatedStar) => {
      if (!updatedStar) {
        throw new BamblooError(BamblooStatusCode.EntityNonexist, '星星不存在')
      }
      return getGalaxyBlackHoleCollection()
        .then((blackHoleCollection) => syncBlackHoleEntriesForStar(updatedStar, blackHoleCollection))
        .then(() =>
          response(res, BamblooStatusCode.Success, undefined, {
            star: mapGalaxyStarRecord(updatedStar, user.tag),
          }),
        )
    })
  })
}

export function commentOnGalaxyStar(
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

  return Promise.all([
    collection.findOne({ _id: `${user.tag}:${day}` }),
    collection.findOne({ id: starId }, { projection: { _id: 1, userTag: 1 } }),
  ]).then(([sourceStar, target]) => {
    if (!target) {
      throw new BamblooError(BamblooStatusCode.EntityNonexist, '星星不存在')
    }
    let parentCommentUserTag: string | undefined
    const verifyParent = parentCommentId
        ? collection
            .findOne({ _id: target._id }, { projection: { comments: 1 } })
            .then((targetWithComments) => {
              const parentComment = targetWithComments?.comments?.find(
                (entry) => entry.id === parentCommentId,
              )
              if (!parentComment) {
                throw new BamblooError(BamblooStatusCode.EntityNonexist, '评论不存在')
              }
              parentCommentUserTag = parentComment.userTag
            })
        : Promise.resolve()

    return verifyParent.then(() => {
      const createdAt = format_timestamp(now)
      const comment: GalaxyStarCommentRecord = {
        id: randomUUID(),
        content,
        createdAt,
        userTag: user.tag,
        likeCount: 0,
        dislikeCount: 0,
        votes: [],
        ...(sourceStar
          ? { sourceStarId: sourceStar.id, sourceStarTitle: sourceStar.title }
          : { anonymousDay: day }),
        ...(parentCommentId ? { parentCommentId } : {}),
      }
      const notificationRecipients = new Set(
        [target.userTag, parentCommentUserTag].filter(
          (recipientTag): recipientTag is string => Boolean(recipientTag && recipientTag !== user.tag),
        ),
      )
      const notifications = [...notificationRecipients].map((recipientTag) => ({
        userTag: recipientTag,
        commentId: comment.id,
      }))
      const shouldCreateLink = sourceStar && sourceStar.id !== target.id
      const pushOperations = {
        comments: comment,
        ...(shouldCreateLink ? { links: { sourceStarId: sourceStar.id, createdAt } } : {}),
        ...(target.userTag !== user.tag ? { unreadCommentIds: comment.id } : {}),
        ...(notifications.length
          ? { unreadCommentNotifications: { $each: notifications } }
          : {}),
      }
      return collection
        .updateOne(
          { _id: target._id },
          {
            $push: pushOperations,
            ...(notificationRecipients.has(target.userTag)
              ? { $min: { unreadCommentAt: createdAt } }
              : {}),
          },
        )
        .then((updated) => {
          if (updated.modifiedCount !== 1) {
            throw new BamblooError(BamblooStatusCode.EntityNonexist, '星星不存在')
          }
          return listGalaxyStars(params, collection, user.tag, res)
        })
    })
  })
}

export function getGalaxyStarCommentNotifications(
  collection: Collection<GalaxyStarRecord>,
  user: User,
  res: Response,
) {
  return collection
    .find(
      {
        $or: [
          { userTag: user.tag, unreadCommentIds: { $exists: true, $ne: [] } },
          { unreadCommentNotifications: { $elemMatch: { userTag: user.tag } } },
        ],
      },
      {
        projection: {
          id: 1,
          createdAt: 1,
          userTag: 1,
          comments: 1,
          unreadCommentIds: 1,
          unreadCommentNotifications: 1,
        },
      },
    )
    .sort({ unreadCommentAt: 1, createdAt: 1 })
    .toArray()
    .then((records) =>
      response(res, BamblooStatusCode.Success, undefined, {
        notifications: getUnreadCommentNotifications(records, user.tag),
      }),
    )
}

export function consumeGalaxyStarCommentNotification(
  collection: Collection<GalaxyStarRecord>,
  user: User,
  res: Response,
) {
  let consumedStar: GalaxyStarView | undefined
  let consumedCommentId: string | undefined
  const consumeNext = (attempt: number): Promise<void> => {
    if (attempt >= 10 || consumedStar) return Promise.resolve()
    return collection
      .find({
        $or: [
          { userTag: user.tag, unreadCommentIds: { $exists: true, $ne: [] } },
          { unreadCommentNotifications: { $elemMatch: { userTag: user.tag } } },
        ],
      })
      .sort({ unreadCommentAt: 1, createdAt: 1 })
      .toArray()
      .then((records) => {
        const record = records
          .map((candidate) => ({
            record: candidate,
            commentId: getUnreadCommentNotifications([candidate], user.tag)[0]?.commentId,
          }))
          .find((candidate) => candidate.commentId)
        if (!record?.commentId) return
        return collection
          .updateOne(
            {
              _id: record.record._id,
              $or: [
                { userTag: user.tag, unreadCommentIds: record.commentId },
                {
                  unreadCommentNotifications: {
                    $elemMatch: { userTag: user.tag, commentId: record.commentId },
                  },
                },
              ],
            },
            {
              $pull: {
                unreadCommentIds: record.commentId,
                unreadCommentNotifications: {
                  userTag: user.tag,
                  commentId: record.commentId,
                },
              },
            },
          )
          .then((updated) => {
            if (updated.modifiedCount !== 1) return consumeNext(attempt + 1)
            consumedStar = mapGalaxyStarRecord(record.record, user.tag)
            consumedCommentId = record.commentId
          })
      })
  }
  return consumeNext(0).then(() =>
    collection
      .find(
        {
          $or: [
            { userTag: user.tag, unreadCommentIds: { $exists: true, $ne: [] } },
            { unreadCommentNotifications: { $elemMatch: { userTag: user.tag } } },
          ],
        },
        {
          projection: {
            id: 1,
            createdAt: 1,
            userTag: 1,
            comments: 1,
            unreadCommentIds: 1,
            unreadCommentNotifications: 1,
          },
        },
      )
      .sort({ unreadCommentAt: 1, createdAt: 1 })
      .toArray(),
  ).then((remainingRecords) =>
    response(res, BamblooStatusCode.Success, undefined, {
      star: consumedStar,
      selectedCommentId: consumedCommentId,
      notifications: getUnreadCommentNotifications(remainingRecords, user.tag),
    }),
  )
}

function getUnreadCommentNotifications(
  records: Pick<
    GalaxyStarRecord,
    'id' | 'userTag' | 'comments' | 'unreadCommentIds' | 'unreadCommentNotifications'
  >[],
  userTag: string,
) {
  const notifications = records.flatMap((record) => {
    const commentIds = new Set([
      ...(record.userTag === userTag ? (record.unreadCommentIds ?? []) : []),
      ...(record.unreadCommentNotifications ?? [])
        .filter((notification) => notification.userTag === userTag)
        .map((notification) => notification.commentId),
    ])
    const commentsById = new Map((record.comments ?? []).map((comment) => [comment.id, comment]))
    return [...commentIds]
      .map((commentId) => ({
        commentId,
        createdAt: commentsById.get(commentId)?.createdAt ?? '',
      }))
      .filter(({ createdAt }) => Boolean(createdAt))
      .map(({ commentId, createdAt }) => ({ starId: record.id, commentId, createdAt }))
  })
  notifications.sort((first, second) => first.createdAt.localeCompare(second.createdAt))
  return notifications.map(({ starId, commentId }) => ({ starId, commentId }))
}

export function seedGalaxyBlackHoleStars(
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
  return collection
    .bulkWrite(
      seedRecords.map((record) => ({
        updateOne: {
          filter: { _id: record._id },
          update: { $setOnInsert: record },
          upsert: true,
        },
      })),
    )
    .then((result) =>
      getGalaxyBlackHoleCollection().then((blackHoleCollection) =>
        seedRecords
        .reduce<Promise<void>>(
            (chain, record) =>
              chain.then(() =>
                collection.findOne({ _id: record._id }).then((savedRecord) => {
                  if (!savedRecord) return
                return syncBlackHoleEntriesForStar(savedRecord, blackHoleCollection).then(
                  () => undefined,
                )
              }),
              ),
            Promise.resolve(),
          )
          .then(() =>
            response(res, BamblooStatusCode.Success, undefined, {
              createdCount: result.upsertedCount,
              starIds: seedRecords.map(({ id }) => id),
            }),
          ),
      ),
    )
}

export function getBlackHoleLimit(value: unknown) {
  if (value === undefined) return 20
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 20) {
    throw new BamblooError(BamblooStatusCode.BadRequest, '每批黑洞星星数量必须介于 1 到 20 之间')
  }
  return value
}

export function listGalaxyStars(
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
  if (view === 'blackhole') {
    return Promise.all([
      getGalaxyBlackHoleCollection(),
      getGalaxyBlackHoleMetadataCollection(),
    ]).then(([blackHoleCollection, metadataCollection]) =>
      ensureBlackHoleMigration(collection, blackHoleCollection, metadataCollection)
        .then(() =>
          readBlackHoleCandidates(blackHoleCollection, requestedStarIds, excludedStarIds, limit),
        )
        .then((selectedRecords) =>
          collection
            .find({ id: { $in: selectedRecords.map(({ starId }) => starId) } })
            .toArray()
            .then((starRecords) => ({ selectedRecords, starRecords })),
        )
        .then(({ selectedRecords, starRecords }) => {
          const starRecordsById = new Map(starRecords.map((record) => [record.id, record]))
          const selectedEntries = selectedRecords.map(
            ({ _id: id, contentId, createdAt: _createdAt, updatedAt: _updatedAt, ...entry }) => ({
              ...entry,
              id,
              contentId,
              myVote:
                entry.kind === 'star'
                  ? starRecordsById
                      .get(entry.starId)
                      ?.votes?.find(({ userTag: voterTag }) => voterTag === userTag)?.vote
                  : starRecordsById
                      .get(entry.starId)
                      ?.comments?.find(({ id: commentId }) => commentId === contentId)
                      ?.votes?.find(({ userTag: voterTag }) => voterTag === userTag)?.vote,
            }),
          )
          return blackHoleCollection.countDocuments().then((totalCount) =>
            response(res, BamblooStatusCode.Success, undefined, {
              stars: [],
              connections: [],
              hiddenStarIds: [],
              blackHoleEntries: selectedEntries,
              totalCount,
            }),
          )
        }),
    )
  }
  return listStars(collection, userTag, res, view, limit, excludedStarIds, requestedStarIds)
}

export function getGalaxyBlackHoleContent(
  params: Record<string, unknown>,
  collection: Collection<GalaxyStarRecord>,
  userTag: string,
  res: Response,
) {
  const entryId = typeof params.entryId === 'string' ? params.entryId.trim() : ''
  if (!entryId) {
    throw new BamblooError(BamblooStatusCode.BadRequest, '黑洞内容标识无效')
  }
  return getGalaxyBlackHoleCollection().then((blackHoleCollection) =>
    blackHoleCollection.findOne({ _id: entryId }).then((entry) => {
      if (!entry) {
        throw new BamblooError(BamblooStatusCode.EntityNonexist, '黑洞内容已不存在')
      }
      return collection.findOne({ id: entry.starId }).then((record) => {
        if (!record) {
          return blackHoleCollection.deleteOne({ _id: entryId }).then(() => {
            throw new BamblooError(BamblooStatusCode.EntityNonexist, '相关星星已不存在')
          })
        }
        return syncBlackHoleEntriesForStar(record, blackHoleCollection)
          .then(() => blackHoleCollection.findOne({ _id: entryId }))
          .then((currentEntry) => {
            if (!currentEntry) {
              throw new BamblooError(
                BamblooStatusCode.EntityNonexist,
                '该内容已不再符合黑洞条件',
              )
            }
            return response(res, BamblooStatusCode.Success, undefined, {
              star: mapGalaxyStarRecord(record, userTag),
              selectedCommentId:
                currentEntry.kind === 'comment' ? currentEntry.contentId : undefined,
            })
          })
      })
    }),
  )
}

function listStars(
  collection: Collection<GalaxyStarRecord>,
  userTag: string | undefined,
  res: Response,
  view: GalaxyStarListView = 'normal',
  limit = 100,
  excludedStarIds = new Set<string>(),
  requestedStarIds = new Set<string>(),
) {
  return collection
    .find({}, { projection: { _id: 0, userTag: 0, day: 0 } })
    .sort({ createdAt: 1 })
    .toArray()
    .then((records) => {
    const pairCounts = new Map<string, number>()
    records.forEach((record) => {
      record.links?.forEach(({ sourceStarId }) => {
        if (sourceStarId === record.id) return
        const pairKey = `${sourceStarId}:${record.id}`
        pairCounts.set(pairKey, (pairCounts.get(pairKey) ?? 0) + 1)
      })
  })
  const allConnections: GalaxyStarConnection[] = [...pairCounts].map(([key, count]) => {
    const [sourceStarId = '', targetStarId = ''] = key.split(':')
    return { sourceStarId, targetStarId, count }
  })
  const visibleConnections = allConnections
  const connectionCounts = new Map<string, number>()
  visibleConnections.forEach(({ sourceStarId, targetStarId, count }) => {
    connectionCounts.set(sourceStarId, (connectionCounts.get(sourceStarId) ?? 0) + count)
    connectionCounts.set(targetStarId, (connectionCounts.get(targetStarId) ?? 0) + count)
  })
  const selectedRecords = records
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
      unreadCommentAt: _unreadCommentAt,
      unreadCommentIds: _unreadCommentIds,
      unreadCommentNotifications: _unreadCommentNotifications,
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
            ({
              userTag: commentUserTag,
              anonymousDay: _anonymousDay,
              votes: commentVotes = [],
              likeCount: commentLikes = 0,
              dislikeCount: commentDislikes = 0,
              ...comment
            }) => ({
              ...comment,
              likeCount: commentLikes,
              dislikeCount: commentDislikes,
              myVote: commentVotes.find(({ userTag: voterTag }) => voterTag === userTag)?.vote,
              isOwn: commentUserTag === userTag,
            }),
          )
        : [],
      isOwn: Boolean(userTag && ownerTag === userTag),
      myVote: userTag ? votes.find((entry) => entry.userTag === userTag)?.vote : undefined,
    }),
  )
    return response(res, BamblooStatusCode.Success, undefined, {
      stars,
      connections: visibleConnections,
      hiddenStarIds: [],
      blackHoleEntries: [],
      totalCount,
    })
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

function mapGalaxyStarRecord(record: GalaxyStarRecord, userTag: string): GalaxyStarView {
  const {
    _id: _recordId,
    userTag: ownerTag,
    day: _day,
    unreadCommentAt: _unreadCommentAt,
    unreadCommentIds: _unreadCommentIds,
    unreadCommentNotifications: _unreadCommentNotifications,
    votes = [],
    links: _links,
    likeCount = 0,
    dislikeCount = 0,
    comments = [],
    ...star
  } = record
  return {
    ...star,
    likeCount,
    dislikeCount,
    connectionCount: 0,
    comments: comments.map(
      ({
        userTag: commentUserTag,
        anonymousDay: _anonymousDay,
        votes: commentVotes = [],
        likeCount: commentLikes = 0,
        dislikeCount: commentDislikes = 0,
        ...comment
      }) => ({
        ...comment,
        likeCount: commentLikes,
        dislikeCount: commentDislikes,
        myVote: commentVotes.find(({ userTag: voterTag }) => voterTag === userTag)?.vote,
        isOwn: commentUserTag === userTag,
      }),
    ),
    isOwn: ownerTag === userTag,
    myVote: votes.find((entry) => entry.userTag === userTag)?.vote,
  }
}

function isBlackHoleStar(star: Pick<GalaxyStarRecord, 'likeCount' | 'dislikeCount'>) {
  const likeCount = star.likeCount ?? 0
  const dislikeCount = star.dislikeCount ?? 0
  return dislikeCount > 8 && dislikeCount > likeCount * 1.5
}

function isBlackHoleComment(comment: Pick<GalaxyStarComment, 'likeCount' | 'dislikeCount'>) {
  const likeCount = comment.likeCount ?? 0
  const dislikeCount = comment.dislikeCount ?? 0
  return dislikeCount > 8 && dislikeCount > likeCount * 1.5
}

function createBlackHoleEntries(record: GalaxyStarRecord): GalaxyBlackHoleRecord[] {
  const now = format_timestamp(new Date())
  const entries: GalaxyBlackHoleRecord[] = []
  if (isBlackHoleStar(record)) {
    entries.push({
      _id: `star:${record.id}`,
      id: `star:${record.id}`,
      starId: record.id,
      contentId: record.id,
      kind: 'star',
      content: record.content,
      likeCount: record.likeCount ?? 0,
      dislikeCount: record.dislikeCount ?? 0,
      createdAt: record.createdAt,
      updatedAt: now,
    })
  }
  record.comments?.filter(isBlackHoleComment).forEach((comment) => {
    entries.push({
      _id: `comment:${record.id}:${comment.id}`,
      id: `comment:${record.id}:${comment.id}`,
      starId: record.id,
      contentId: comment.id,
      kind: 'comment',
      content: comment.content,
      likeCount: comment.likeCount ?? 0,
      dislikeCount: comment.dislikeCount ?? 0,
      createdAt: comment.createdAt,
      updatedAt: now,
    })
  })
  return entries
}

function syncBlackHoleEntriesForStar(
  record: GalaxyStarRecord,
  blackHoleCollection: Collection<GalaxyBlackHoleRecord>,
) {
  const entries = createBlackHoleEntries(record)
  const entryIds = entries.map(({ _id }) => _id)
  const upsertEntries =
    entries.length > 0
      ? blackHoleCollection.bulkWrite(
      entries.map(({ _id, id, ...entry }) => ({
        updateOne: {
          filter: { _id },
          update: { $set: { ...entry, id }, $setOnInsert: { _id } },
          upsert: true,
        },
      })),
        )
      : Promise.resolve()
  return upsertEntries.then(() =>
    blackHoleCollection.deleteMany({
      starId: record.id,
      ...(entryIds.length > 0 ? { _id: { $nin: entryIds } } : {}),
    }),
  )
}

function reconcileBlackHoleEntries(
  records: GalaxyStarRecord[],
  blackHoleCollection: Collection<GalaxyBlackHoleRecord>,
) {
  const entries = records.flatMap(createBlackHoleEntries)
  const entryIds = entries.map(({ _id }) => _id)
  const upsertEntries =
    entries.length > 0
      ? blackHoleCollection.bulkWrite(
      entries.map(({ _id, id, ...entry }) => ({
        updateOne: {
          filter: { _id },
          update: { $set: { ...entry, id }, $setOnInsert: { _id } },
          upsert: true,
        },
      })),
        )
      : Promise.resolve()
  return upsertEntries.then(() =>
    blackHoleCollection.deleteMany(entryIds.length > 0 ? { _id: { $nin: entryIds } } : {}),
  )
}

function ensureBlackHoleMigration(
  collection: Collection<GalaxyStarRecord>,
  blackHoleCollection: Collection<GalaxyBlackHoleRecord>,
  metadataCollection: Collection<GalaxyBlackHoleMetadata>,
) {
  return metadataCollection.findOne({ _id: 'entries-v1' }).then((migration) => {
    if (migration?.migratedAt) return
    return collection
      .find({})
      .toArray()
      .then((records) => reconcileBlackHoleEntries(records, blackHoleCollection))
      .then(() =>
        metadataCollection.updateOne(
          { _id: 'entries-v1' },
          { $set: { migratedAt: format_timestamp(new Date()) } },
          { upsert: true },
        ),
      )
      .then(() => undefined)
  })
}

function readBlackHoleCandidates(
  collection: Collection<GalaxyBlackHoleRecord>,
  requestedStarIds: Set<string>,
  excludedStarIds: Set<string>,
  limit: number,
) {
  const query = (filter: Record<string, unknown>) =>
    collection.find(filter).sort({ updatedAt: -1 }).limit(limit).toArray()
  const requested = requestedStarIds.size
    ? query({ _id: { $in: [...requestedStarIds] } })
    : Promise.resolve<GalaxyBlackHoleRecord[]>([])
  return requested.then((requestedEntries) => {
    if (requestedEntries.length > 0) return requestedEntries
    return query({ _id: { $nin: [...excludedStarIds] } }).then((candidates) => {
      if (candidates.length > 0 || excludedStarIds.size === 0) return candidates
      return query({})
    })
  })
}
