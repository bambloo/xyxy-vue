export interface UserProfile {
  id: string
  account: string
  passwordHash: string
  name: string
  birthday: string
  phone: string
  hobbies: string
  isAdmin: boolean
}

export default UserProfile
