export type UserRole = 'USER' | 'SCRUM' | 'ADMIN'

export type UserProfile = {
  id: string
  email: string
  fullName: string
  role: UserRole
  createdAt?: string
  updatedAt?: string
}
