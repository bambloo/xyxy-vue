import type { UserPublicProfile } from '../../../../common/entity/user'

export type TabKey = 'profile' | 'password' | 'security' | 'users'

export type UserMenuItem = {
  key: TabKey
  labelKey: string
  icon: string
  descriptionKey: string
  route: string
  permissions: string[]
}

export const userMenuItems: UserMenuItem[] = [
  {
    key: 'profile',
    labelKey: 'user.profile',
    icon: 'person-outline',
    descriptionKey: 'user.profileHint',
    route: 'user-profile',
    permissions: [],
  },
  {
    key: 'password',
    labelKey: 'user.password',
    icon: 'lock-closed-outline',
    descriptionKey: 'user.passwordHint',
    route: 'user-password',
    permissions: [],
  },
  {
    key: 'security',
    labelKey: 'user.security',
    icon: 'shield-checkmark-outline',
    descriptionKey: 'user.securityHint',
    route: 'user-security',
    permissions: ['security.manage'],
  },
  {
    key: 'users',
    labelKey: 'user.users',
    icon: 'people-outline',
    descriptionKey: 'user.usersHint',
    route: 'user-users',
    permissions: ['users.import'],
  },
]

export function canAccessMenu(user: UserPublicProfile | null, item: UserMenuItem) {
  if (!user) return false
  if (user.isAdmin) return true
  return item.permissions.every((permission) => user.permissions?.includes(permission))
}
