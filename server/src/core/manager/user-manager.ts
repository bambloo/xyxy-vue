import { BamblooError, BamblooStatusCode } from '../../../../common/status'
import { mongo_helper } from '../../util/mongo-helper'
import { Mutex } from '../../util/mutex'

export interface user_key {
  id?: string
  name?: string
  phone?: string
}

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
    return Promise.resolve(this)
  }

  public get(key: user_key) {
    if (key.id) {
      return mongo_helper.get('user', { id: key.id })
    } else if (key.phone) {
      return mongo_helper.get('user', { phone: key.phone })
    } else {
      return Promise.reject(
        new BamblooError(BamblooStatusCode.BadRequest, '必须提供 id 或 phone 作为查询条件'),
      )
    }
  }

  // public static add_user(user: user) {
  //   this.users.set(user.id, user)
  // }

  // public static remove_user(user: user) {
  //   this.users.delete(user.id)
  // }

  // public static get_user(id: string): user | undefined {
  //   return this.users.get(id)
  // }

  // public static get_users(): user[] {
  //   return Array.from(this.users.values())
  // }

  // public static get_user_count(): number {
  //   return this.users.size
  // }

  // public static get_user_ids(): string[] {}
}
