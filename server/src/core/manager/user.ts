import { randomUUID } from 'node:crypto'
import { BamblooError, BamblooStatusCode } from '../../../../common/status'
import type { UserQuery } from '../../../../common/entity/user'
import { hash_password } from '../../../../common/util/crypto'
import type { UserProfile } from '../entity/user'
import { mongo_helper } from '../../util/mongo-helper'
import { Mutex } from '../../util/mutex'

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

  public async ensureAdmin(): Promise<UserProfile> {
    try {
      const existing = await this.get({ account: DEFAULT_ADMIN_ACCOUNT })
      return existing
    } catch {
      const passwordHash = await hash_password(DEFAULT_ADMIN_PASSWORD)
      const adminUser: UserProfile = {
        id: randomUUID(),
        account: DEFAULT_ADMIN_ACCOUNT,
        passwordHash,
        name: '管理员',
        isAdmin: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await mongo_helper.ddo((db) => {
        return db.collection('user').insertOne(adminUser)
      })

      return adminUser
    }
  }

  public get(key: UserQuery): Promise<UserProfile> {
    if (key.id) {
      return mongo_helper.get('user', { id: key.id })
    }

    if (key.account) {
      return mongo_helper.get('user', { account: key.account })
    }

    if (key.phone) {
      return mongo_helper.get('user', { phone: key.phone })
    }

    return Promise.reject(
      new BamblooError(BamblooStatusCode.BadRequest, '必须提供 id、account 或 phone 作为查询条件'),
    )
  }
}
