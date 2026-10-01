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
