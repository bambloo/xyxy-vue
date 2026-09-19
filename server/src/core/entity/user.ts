export interface UserProfile {
  id: string
  account: string
  passwordHash: string
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

export default UserProfile
