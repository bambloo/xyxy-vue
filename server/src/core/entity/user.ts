import type { UserPublicProfile } from '../../../../common/entity/user'

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

  ask_daily_fortune(day: string): Promise<void> {
    return Promise.resolve()
  }

  ask_time_fortune(arg0: string) {
    return Promise.resolve()
  }
}
