import type {
  Analysis,
  Board,
  CreationResult,
  Credentials,
  JiraDeployment,
  Entry,
  JiraUser,
  Period,
  Sprint,
  Validation,
} from './types'
import { cloudSiteUrl } from './cloudSite'
import { dataCenterSiteUrl } from './dataCenterSite'
export class ApiError extends Error {
  constructor(
    message: string,
    public uncertain = false,
    public retryAfter?: number,
    public fresh?: Analysis
  ) {
    super(message)
  }
}
export async function jiraRequest<T>(
  action: string,
  credentials?: Credentials,
  params: Record<string, unknown> = {},
  deployment: JiraDeployment = credentials?.deployment || 'cloud'
): Promise<T> {
  if (credentials) {
    try {
      if (deployment === 'data-center') dataCenterSiteUrl(credentials.baseUrl)
      else cloudSiteUrl(credentials.baseUrl)
    } catch (error) {
      throw new ApiError(
        error instanceof Error ? error.message : 'URL Jira Cloud inválida.'
      )
    }
  }
  let response: Response
  try {
    response = await fetch('/.netlify/functions/jira', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, credentials, ...params, deployment }),
      cache: 'no-store',
      signal: AbortSignal.timeout(120000),
    })
  } catch {
    throw new ApiError(
      action === 'create'
        ? 'Resposta não recebida. Confira a issue no Jira antes de reenviar.'
        : 'Falha de rede. Confira a conexão e tente novamente.',
      action === 'create'
    )
  }
  let data: T & {
    error?: string
    uncertain?: boolean
    retryAfter?: number
    fresh?: Analysis
  }
  try {
    data = await response.json()
  } catch {
    throw new ApiError(
      response.status === 404
        ? 'A API Jira não foi encontrada neste endereço. No ambiente local, reinicie com npm run dev ou npm run dev:netlify e abra a URL exibida no terminal. Em produção, publique também a Function Jira.'
        : `A API Jira retornou uma resposta não JSON (HTTP ${response.status}). Verifique o terminal do servidor local.`,
      action === 'create'
    )
  }
  if (!response.ok)
    throw new ApiError(
      data.error || 'Falha ao acessar Jira.',
      !!data.uncertain || (action === 'create' && response.status >= 500),
      data.retryAfter,
      data.fresh
    )
  return data
}
export const testConnection = (
  credentials?: Credentials,
  deployment?: JiraDeployment
) =>
  jiraRequest<{ user: JiraUser; timezone: string; baseUrl: string }>(
    'test',
    credentials,
    {},
    deployment
  )
export const getSprint = (
  sprintId: number,
  credentials?: Credentials,
  deployment?: JiraDeployment
) => jiraRequest<Sprint>('sprint', credentials, { sprintId }, deployment)
export const getBoards = (
  credentials?: Credentials,
  deployment?: JiraDeployment
) => jiraRequest<Board[]>('boards', credentials, {}, deployment)
export const getSprints = (
  boardId: number,
  credentials?: Credentials,
  deployment?: JiraDeployment
) => jiraRequest<Sprint[]>('sprints', credentials, { boardId }, deployment)
export const findUsers = (
  query: string,
  credentials?: Credentials,
  deployment?: JiraDeployment
) => jiraRequest<JiraUser[]>('users', credentials, { query }, deployment)
export const getAnalysis = (
  sprintId: number,
  user: JiraUser,
  period: Period,
  credentials?: Credentials,
  deployment?: JiraDeployment
) =>
  jiraRequest<Analysis>(
    'analysis',
    credentials,
    { sprintId, user, period },
    deployment
  )
export const createWorklog = (
  sprintId: number,
  user: JiraUser,
  period: Period,
  entry: Entry,
  pending: Entry[],
  acknowledgeWarnings: boolean,
  warnings: Validation[],
  credentials?: Credentials,
  deployment?: JiraDeployment
) =>
  jiraRequest<CreationResult>(
    'create',
    credentials,
    {
      sprintId,
      user,
      period,
      entry,
      pending,
      confirmed: true,
      acknowledgeWarnings,
      acknowledgedWarnings: warnings
        .filter((item) => item.level === 'WARNING')
        .map((item) => `${item.entryId || ''}:${item.message}`),
    },
    deployment
  )
