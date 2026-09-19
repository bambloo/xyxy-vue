export interface UserPublicProfile {
  id: string
  account: string
  name: string
  phone?: string
  birthday?: string
  hobbies?: string
  isAdmin?: boolean
  isActive?: boolean
  email?: string
  avatar?: string
  createdAt?: string
  updatedAt?: string
}

export interface UserQuery {
  id?: string
  account?: string
  name?: string
  phone?: string
}
