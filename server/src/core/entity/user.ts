import type { UserPublicProfile } from '../../../../common/entity/user'
import { BamblooError, BamblooStatusCode } from '../../../../common/status'
import { trigger_fortune_generation } from '../manager/daily-fortune'
import { current_time_name, type TimeName } from '../../util/daily-prompt-template'
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
}
