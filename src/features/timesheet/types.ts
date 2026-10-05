export interface JiraUser {
  // Canonical identity: Cloud accountId, or Data Center user key.
  accountId: string
  displayName: string
  username?: string
}
export type JiraDeployment = 'cloud' | 'data-center'
export interface Credentials {
  deployment?: JiraDeployment
  baseUrl: string
  email: string
  token: string
}
export interface Sprint {
  id: number
  name: string
  state: string
  startDate?: string
  endDate?: string
  completeDate?: string
}
export interface Board {
  id: number
  name: string
  type: string
}
export interface Issue {
  id: string
  key: string
  summary: string
  issueType: string
  status: string
  assignee: JiraUser | null
  parent?: string
  originalEstimateSeconds: number | null
  remainingEstimateSeconds: number | null
  timeSpentSeconds: number
}
export interface Worklog {
  id: string
  issueKey: string
  accountId: string
  started: string
  timeSpentSeconds: number
  comment: string
}
export interface Entry {
  id: string
  issueKey: string
  date: string
  seconds: number
  comment: string
  origin: 'automatic' | 'manual'
  edited: boolean
  worklogId?: string
  result?: 'success' | 'error' | 'uncertain'
  error?: string
}
export interface Analysis {
  sprint: Sprint
  user: JiraUser
  authenticatedUser: JiraUser
  issues: Issue[]
  worklogs: Worklog[]
  timezone: string
  baseUrl: string
  warnings: string[]
}
export interface Period {
  start: string
  end: string
  dailySeconds: number
  timezone: string
}
export interface Validation {
  level: 'ERROR' | 'WARNING' | 'INFO'
  message: string
  entryId?: string
}
export interface CreationResult {
  id: string
}
