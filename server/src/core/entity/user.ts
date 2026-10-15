import type { UserPublicProfile } from '../../../../common/entity/user'
import { BamblooError, BamblooStatusCode } from '../../../../common/status'
import { trigger_fortune_generation } from '../manager/daily-fortune'
import {
  current_time_name,
  time_name_for_index,
  type TimeName,
} from '../../util/daily-prompt-template'
import { format_timestamp } from '../../util/date-time'
import { mongo_helper } from '../../util/mongo-helper'

interface FortuneGeneration {
  prompt: string
  message: string
}

interface DailyFortuneRecord {
  _id: string
  userTag: string
  day: string
  fortune: FortuneGeneration
  time_fortune?: Partial<Record<TimeName, FortuneGeneration>>
  createdAt: string
}

export interface UserTimeFortuneDay {
  date: string
  dailyFortune: string
  timeFortunes: { timeName: TimeName; message: string }[]
}

export interface UserTimeFortuneHistory {
  timeName: TimeName
  days: UserTimeFortuneDay[]
}

export interface UserTimeFortuneDetails {
  ready: boolean
  timeName: TimeName
  dailyFortune: string
  timeFortunes: { timeName: TimeName; message: string }[]
}

function timeFortunesFor(record: DailyFortuneRecord | undefined) {
  return Array.from({ length: 12 }, (_, offset) => {
    const timeName = time_name_for_index(11 - offset)
    const fortune = record?.time_fortune?.[timeName]
    return fortune?.prompt && fortune.message
      ? { timeName, message: fortune.message }
      : undefined
  }).filter((fortune) => fortune !== undefined)
}

function formatLocalDay(date: Date) {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export interface UserProfile {
  tag: string
  account: string
  passwordHash: string
  name: string
  phone?: string
  birthday?: string
  hobbies?: string
  isAdmin?: boolean
  isActive?: boolean
  permissions?: string[]
  email?: string
  avatar?: string
  lastFortuneGeneratedAt?: string
  createdAt?: string
  updatedAt?: string
}

export function to_public_user(user: UserProfile): UserPublicProfile {
  const {
    tag,
    account,
    name,
    phone,
    birthday,
    hobbies,
    isActive,
    isAdmin,
    permissions,
    email,
    avatar,
    createdAt,
    updatedAt,
  } = user

  return {
    tag,
    account,
    name,
    phone,
    birthday,
    hobbies,
    isActive,
    isAdmin,
    permissions,
    email,
    avatar,
    createdAt,
    updatedAt,
  }
}

export class User implements UserProfile {
  tag: string
  account: string
  passwordHash: string
  name: string
  phone?: string | undefined
  birthday?: string | undefined
  hobbies?: string | undefined
  isAdmin?: boolean | undefined
  isActive?: boolean | undefined
  permissions?: string[] | undefined
  email?: string | undefined
  avatar?: string | undefined
  lastFortuneGeneratedAt?: string | undefined
  createdAt?: string | undefined
  updatedAt?: string | undefined

  constructor(init: UserProfile) {
    this.tag = init.tag
    this.account = init.account
    this.passwordHash = init.passwordHash
    this.name = init.name
    this.phone = init.phone
    this.birthday = init.birthday
    this.hobbies = init.hobbies
    this.isAdmin = init.isAdmin
    this.isActive = init.isActive
    this.permissions = init.permissions
    this.email = init.email
    this.avatar = init.avatar
    this.lastFortuneGeneratedAt = init.lastFortuneGeneratedAt
    this.createdAt = init.createdAt
    this.updatedAt = init.updatedAt
  }

  ask_daily_fortune(day: string): Promise<string> {
    const id = `${this.tag}:${day}`

    return mongo_helper
      .ddo((db) => db.collection<DailyFortuneRecord>('daily_fortune').findOne({ _id: id }))
      .then((record) => {
        if (!record) {
          trigger_fortune_generation(this.tag, true)
          throw new BamblooError(
            BamblooStatusCode.EntityNonexist,
            `未找到用户 ${this.tag} 的 ${day} 今日运势`,
          )
        }
        return record.fortune.message
      })
  }

  ask_time_fortune(day: string): Promise<string> {
    const id = `${this.tag}:${day}`
    const timeName = current_time_name()

    return mongo_helper
      .ddo((db) => db.collection<DailyFortuneRecord>('daily_fortune').findOne({ _id: id }))
      .then((record) => {
        const generation = record?.time_fortune?.[timeName]
        const fortune = generation?.message
        if (!fortune?.trim()) {
          trigger_fortune_generation(this.tag, !record, true)
          throw new BamblooError(
            BamblooStatusCode.EntityNonexist,
            `未找到用户 ${this.tag} 的 ${day} 当前时辰锦言`,
          )
        }
        return fortune
      })
  }

  updatePassword(passwordHash: string) {
    return mongo_helper.ddo(async (db) => {
      const updatedAt = format_timestamp(new Date())
      const result = await db
        .collection('user')
        .updateOne({ tag: this.tag }, { $set: { passwordHash, updatedAt } })
      if (!result.matchedCount) {
        throw new BamblooError(BamblooStatusCode.EntityNonexist, '用户不存在')
      }
      this.passwordHash = passwordHash
      this.updatedAt = updatedAt
    })
  }

  get_time_fortune(day: string, now = new Date()): Promise<UserTimeFortuneDetails> {
    const id = `${this.tag}:${day}`
    const timeName = current_time_name(now)

    return mongo_helper
      .ddo((db) => db.collection<DailyFortuneRecord>('daily_fortune').findOne({ _id: id }))
      .then((record) => {
        const fortune = record?.time_fortune?.[timeName]
        return {
          ready: Boolean(fortune?.prompt && fortune.message),
          timeName,
          dailyFortune: record?.fortune?.message ?? '',
          timeFortunes: timeFortunesFor(record ?? undefined),
        }
      })
  }

  get_time_fortune_history(now = new Date()): Promise<UserTimeFortuneHistory> {
    const days = Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset)
      return formatLocalDay(date)
    })
    const ids = days.map((date) => `${this.tag}:${date}`)

    return mongo_helper
      .ddo((db) =>
        db.collection<DailyFortuneRecord>('daily_fortune').find({ _id: { $in: ids } }).toArray(),
      )
      .then((records) => {
        const recordsById = new Map(records.map((record) => [record._id, record]))
        const recentDays = days.flatMap((date) => {
          const record = recordsById.get(`${this.tag}:${date}`)
          const timeFortunes = timeFortunesFor(record)
          const dailyFortune = record?.fortune?.message ?? ''
          return dailyFortune || timeFortunes.length
            ? [{ date, dailyFortune, timeFortunes }]
            : []
        })

        return {
          timeName: current_time_name(now),
          days: recentDays,
        }
      })
  }
}
