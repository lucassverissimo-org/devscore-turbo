export type JiraConnectionStatus = {
  connected: boolean
  authMode?: 'cloud-oauth' | 'data-center-pat'
  serviceConnection?: boolean
  canDisconnect?: boolean
  cloudId?: string
  siteUrl?: string
  siteName?: string
  scope?: string
  accessTokenExpiresAt?: string
  connectedAt?: string
  updatedAt?: string
}

export type JiraSprintIssue = {
  id: string
  key: string
  summary: string
  status: string
  issueType: string
  url: string
  storyPoints: number | null
}

export type JiraSprintImportParams = {
  boardId?: string
  sprintId?: string
  sprintName?: string
  forceRefresh?: boolean
}

export type JiraSprintImportResult = {
  source: 'jira' | 'cache'
  cacheTtlSeconds: number
  fetchedAt: string
  sprint: {
    id: number
    name: string | null
    boardId: number | null
  }
  issues: JiraSprintIssue[]
}
