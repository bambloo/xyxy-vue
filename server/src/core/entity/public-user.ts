import type { UserPublicProfile } from '../../../../common/entity/user'
import type { UserProfile } from './user'

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
