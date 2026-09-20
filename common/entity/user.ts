export interface UserPublicProfile {
  tag: string
  account: string
  name: string
  phone?: string
  birthday?: string
  hobbies?: string
  isActive?: boolean
  isAdmin?: boolean
  permissions?: string[]
  email?: string
  avatar?: string
  createdAt?: string
  updatedAt?: string
}

export interface UserQuery {
  tag?: string
  account?: string
  name?: string
  phone?: string
}
