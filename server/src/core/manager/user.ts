import { randomUUID } from 'node:crypto'
import { BamblooError, BamblooStatusCode } from '../../../../common/status'
import type { UserQuery } from '../../../../common/entity/user'
import { hash_password } from '../../../../common/util/crypto'
import { User, type UserProfile } from '../entity/user'
import { mongo_helper } from '../../util/mongo-helper'
import { Mutex } from '../../util/mutex'
import { format_timestamp } from '../../util/date-time'

export const DEFAULT_ADMIN_ACCOUNT = 'admin'
export const DEFAULT_ADMIN_PASSWORD = 'Admin123456'

export class user_manager {
  private static global_instance: user_manager = new user_manager()
  private static global_mutex: Mutex = new Mutex()

  public static instance() {
    return this.global_mutex.do(() => {
      if (!this.global_instance.initialized) {
        return this.global_instance.initialize()
      }
      return this.global_instance
    })
  }

  private initialized: boolean = false

  private initialize(): Promise<this> {
    return this.ensureAdmin().then(() => {
      this.initialized = true
      return this
    })
  }

  public ensureAdmin(): Promise<UserProfile> {
    return this.get({ account: DEFAULT_ADMIN_ACCOUNT }).catch(() =>
      hash_password(DEFAULT_ADMIN_PASSWORD).then((passwordHash) => {
        const now = format_timestamp(new Date())
        const adminUser: UserProfile = {
          tag: randomUUID(),
          account: DEFAULT_ADMIN_ACCOUNT,
          passwordHash,
          name: '管理员',
          isAdmin: true,
          createdAt: now,
          updatedAt: now,
        }

        return mongo_helper
          .ddo((db) => db.collection('user').insertOne(adminUser))
          .then(() => adminUser)
      }),
    )
  }

  public get(key: UserQuery): Promise<User> {
    if (key.tag) {
      return this.get_user({ tag: key.tag })
    }

    if (key.account) {
      return this.get_user({ account: key.account })
    }

    if (key.phone) {
      return this.get_user({ phone: key.phone })
    }

    return Promise.reject(
      new BamblooError(BamblooStatusCode.BadRequest, '必须提供 tag、account 或 phone 作为查询条件'),
    )
  }

  private get_user(key: UserQuery): Promise<User> {
    return mongo_helper.get<UserProfile>('user', { ...key }).then((profile) => new User(profile))
  }

  public updatePassword(tag: string, passwordHash: string) {
    return this.get({ tag }).then((user) => user.updatePassword(passwordHash))
  }

  public importInactiveTags(tags: string[]): Promise<UserProfile[]> {
    const imported: UserProfile[] = []
    const uniqueTags = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))]

    return uniqueTags
      .reduce<Promise<void>>(
        (chain, tag) =>
          chain.then(() =>
            this.get({ tag })
              .then((user) => {
                imported.push(user)
              })
              .catch(() => {
                const now = format_timestamp(new Date())
                const user: UserProfile = {
                  tag,
                  account: '',
                  passwordHash: '',
                  name: '',
                  isActive: false,
                  createdAt: now,
                  updatedAt: now,
                }
                return mongo_helper
                  .ddo((db) => db.collection('user').insertOne(user))
                  .then(() => {
                    imported.push(user)
                  })
              }),
          ),
        Promise.resolve(),
      )
      .then(() => imported)
  }

  public get_without_daily_fortune(): Promise<User> {
    const now = new Date()
    const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayStart = format_timestamp(localMidnight)
    return mongo_helper.tdo('user', (collection) => {
      return collection
        .findOne(
          {
            isActive: { $ne: false },
            $or: [
              { lastFortuneGeneratedAt: { $exists: false } },
              { lastFortuneGeneratedAt: { $lt: todayStart } },
            ],
          },
          { projection: { tag: 1, lastFortuneGeneratedAt: 1 } },
        )
        .then((doc) => {
          if (!doc) {
            return Promise.reject(
              new BamblooError(
                BamblooStatusCode.DailyFortuneGenerated,
                '没有找到未生成今日运势的用户',
              ),
            )
          } else {
            return this.get({ tag: doc.tag })
          }
        })
    })
  }
}
