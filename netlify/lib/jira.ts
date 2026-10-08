import type {
  Credentials,
  Board,
  JiraDeployment,
  Issue,
  JiraUser,
  Sprint,
  Worklog,
} from '../../src/features/timesheet/types'
import { cloudSiteUrl } from '../../src/features/timesheet/cloudSite'
import { dataCenterSiteUrl } from '../../src/features/timesheet/dataCenterSite'
import { validTimezone } from '../../src/features/timesheet/dates'
export class JiraError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number,
    public uncertain = false
  ) {
    super(message)
  }
}
export const fields = [
  'summary',
  'issuetype',
  'status',
  'assignee',
  'parent',
  'timeoriginalestimate',
  'timeestimate',
  'timespent',
]
interface RawIssue {
  id: string
  key: string
  fields: {
    summary: string
    issuetype?: { name: string }
    status?: { name: string }
    assignee: RawUser | null
    parent?: { key: string }
    timeoriginalestimate?: number
    timeestimate?: number
    timespent?: number
  }
}
interface RawLog {
  id: string
  author: RawUser
  started: string
  timeSpentSeconds: number
  comment?: string | { content?: Array<{ content?: Array<{ text?: string }> }> }
}
interface RawUser {
  accountId?: string
  key?: string
  name?: string
  displayName: string
  active?: boolean
}
function normalizeUser(raw: RawUser): JiraUser {
  const accountId = raw.accountId || raw.key || raw.name
  if (!accountId)
    throw new JiraError(502, 'Jira não retornou a identificação do usuário.')
  return {
    accountId,
    displayName: raw.displayName,
    ...(raw.name ? { username: raw.name } : {}),
  }
}

function normalizeIssue(raw: RawIssue): Issue {
  return {
    id: raw.id,
    key: raw.key,
    summary: raw.fields.summary,
    issueType: raw.fields.issuetype?.name || '',
    status: raw.fields.status?.name || '',
    assignee: raw.fields.assignee && normalizeUser(raw.fields.assignee),
    parent: raw.fields.parent?.key,
    originalEstimateSeconds: raw.fields.timeoriginalestimate ?? null,
    remainingEstimateSeconds: raw.fields.timeestimate ?? null,
    timeSpentSeconds: raw.fields.timespent || 0,
  }
}
export function cloudUrl(value: string): string {
  try {
    return cloudSiteUrl(value)
  } catch (error) {
    throw new JiraError(
      400,
      error instanceof Error ? error.message : 'URL Jira Cloud inválida.'
    )
  }
}
export function safeText(value: unknown, name: string, max = 200): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > max ||
    /[\r\n]/.test(value) ||
    value.includes(String.fromCharCode(0))
  )
    throw new JiraError(400, `${name} inválido.`)
  return value.trim()
}
export function jiraConfig(
  credentials: Credentials | undefined,
  env: NodeJS.ProcessEnv,
  deployment: JiraDeployment = credentials?.deployment || 'cloud'
) {
  if (!['cloud', 'data-center'].includes(deployment))
    throw new JiraError(400, 'Tipo de Jira inválido.')
  const dc = deployment === 'data-center'
  const configuredUrl = dc ? env.JIRA_DC_BASE_URL : env.JIRA_BASE_URL
  const value = safeText(
    credentials ? credentials.baseUrl : configuredUrl,
    'URL'
  )
  let baseUrl: string
  try {
    baseUrl = dc ? dataCenterSiteUrl(value) : cloudUrl(value)
  } catch {
    throw new JiraError(
      400,
      dc ? 'URL HTTPS do Data Center inválida.' : 'URL Jira Cloud inválida.'
    )
  }
  if (dc) {
    const allowed = [
      'https://agile.corp.edp.pt',
      ...(env.JIRA_DC_ALLOWED_BASE_URLS || '').split(','),
      ...(configuredUrl ? [configuredUrl] : []),
    ]
      .filter(Boolean)
      .map((url) => dataCenterSiteUrl(url))
    if (!allowed.includes(baseUrl))
      throw new JiraError(
        403,
        'Servidor Data Center não autorizado. Configure JIRA_DC_ALLOWED_BASE_URLS no Netlify.'
      )
  }
  const email = dc
    ? ''
    : safeText(credentials ? credentials.email : env.JIRA_EMAIL, 'E-mail', 320)
  const token = safeText(
    credentials ? credentials.token : dc ? env.JIRA_DC_PAT : env.JIRA_API_TOKEN,
    dc ? 'PAT' : 'API Token',
    4096
  )
  const timezone = env.JIRA_TIMEZONE || 'America/Fortaleza'
  if (!validTimezone(timezone))
    throw new JiraError(500, 'JIRA_TIMEZONE inválido no servidor.')
  return { baseUrl, email, token, timezone, deployment }
}
const errorMessage = (status: number) =>
  ({
    400: 'Jira recusou os dados. Confira os campos e o controle de tempo.',
    401: 'Não foi possível acessar o Jira. Verifique suas credenciais.',
    403: 'Sem permissão Jira para essa operação.',
    404: 'Sprint, issue ou recurso não encontrado ou não visível.',
    429: 'Limite do Jira atingido. Aguarde antes de tentar novamente.',
  })[status] || 'Jira indisponível. Tente novamente mais tarde.'
export function retrySeconds(header: string | null): number {
  if (!header) return 1
  const number = Number(header)
  return Math.max(
    1,
    Math.ceil(
      Number.isFinite(number)
        ? number
        : (Date.parse(header) - Date.now()) / 1000
    ) || 1
  )
}
export class JiraClient {
  private userKeys = new Map<string, string>()
  private normalizeUser(raw: RawUser): JiraUser {
    const user = normalizeUser(raw)
    if (raw.name && raw.key) this.userKeys.set(raw.name, raw.key)
    if (!raw.accountId && !raw.key && raw.name)
      user.accountId = this.userKeys.get(raw.name) || raw.name
    return user
  }
  constructor(
    public config: ReturnType<typeof jiraConfig>,
    private fetcher: typeof fetch = fetch,
    private pause = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms))
  ) {}
  async request<T>(path: string, body?: unknown, write = false): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      let response: Response
      try {
        response = await this.fetcher(this.config.baseUrl + path, {
          method: body === undefined ? 'GET' : 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
          headers: {
            Authorization:
              this.config.deployment === 'data-center'
                ? `Bearer ${this.config.token}`
                : `Basic ${Buffer.from(`${this.config.email}:${this.config.token}`).toString('base64')}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        })
      } catch {
        throw new JiraError(
          504,
          write
            ? 'Resposta não recebida. Confira no Jira se o worklog foi criado antes de tentar novamente.'
            : 'Falha de rede ou timeout ao acessar o Jira.',
          undefined,
          write
        )
      }
      if (response.status === 429) {
        const retry = retrySeconds(response.headers.get('Retry-After'))
        if (!write && retry <= 3 && attempt < 2) {
          await this.pause(retry * 1000)
          continue
        }
        throw new JiraError(429, errorMessage(429), retry)
      }
      if (!response.ok)
        throw new JiraError(
          response.status >= 500 ? 502 : response.status,
          response.status === 400 && path.includes('/mypermissions')
            ? 'Jira recusou a verificação de permissão Work on issues para registrar horas.'
            : response.status === 400 && write
              ? 'Jira recusou o registro de horas. Confira a data, a duração e as regras de controle de tempo do projeto.'
              : errorMessage(response.status),
          undefined,
          write && response.status >= 500
        )
      try {
        return (await response.json()) as T
      } catch {
        throw new JiraError(502, 'Resposta Jira inválida.', undefined, write)
      }
    }
    throw new JiraError(429, errorMessage(429))
  }
  async myself(): Promise<JiraUser> {
    return this.normalizeUser(await this.request<RawUser>(`${this.api}/myself`))
  }
  get api() {
    return this.config.deployment === 'data-center'
      ? '/rest/api/2'
      : '/rest/api/3'
  }
  async user(id: string): Promise<JiraUser> {
    return this.normalizeUser(
      await this.request<RawUser>(
        `${this.api}/user?${this.config.deployment === 'data-center' ? 'key' : 'accountId'}=${encodeURIComponent(id)}`
      )
    )
  }
  jqlUser(user: JiraUser) {
    const id =
      this.config.deployment === 'data-center'
        ? user.username || user.accountId
        : user.accountId
    return id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  }
  async sprint(id: number): Promise<Sprint> {
    if (!Number.isSafeInteger(id) || id <= 0)
      throw new JiraError(400, 'Sprint ID inválido.')
    const sprint = await this.request<Sprint>(`/rest/agile/1.0/sprint/${id}`)
    return {
      id: sprint.id,
      name: sprint.name,
      state: sprint.state,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      completeDate: sprint.completeDate,
    }
  }
  private async agilePages<T>(path: string): Promise<T[]> {
    const values: T[] = []
    for (let startAt = 0; ; ) {
      const page = await this.request<{
        values: T[]
        isLast?: boolean
        total?: number
      }>(
        `${path}${path.includes('?') ? '&' : '?'}startAt=${startAt}&maxResults=50`
      )
      values.push(...page.values)
      startAt += page.values.length
      if (values.length > 10000)
        throw new JiraError(400, 'Muitos resultados Jira para listar.')
      if (
        page.isLast === true ||
        (typeof page.total === 'number' && startAt >= page.total)
      )
        return values
      if (
        page.isLast === undefined &&
        page.total === undefined &&
        page.values.length < 50
      )
        return values
      if (!page.values.length)
        throw new JiraError(502, 'Paginação Jira inconsistente.')
    }
  }
  async boards(): Promise<Board[]> {
    const boards = await this.agilePages<Board>(
      '/rest/agile/1.0/board?type=scrum'
    )
    return boards
      .map(({ id, name, type }) => ({ id, name, type }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
  async sprints(boardId: number): Promise<Sprint[]> {
    if (!Number.isSafeInteger(boardId) || boardId <= 0)
      throw new JiraError(400, 'Board inválido.')
    const sprints = await this.agilePages<Sprint>(
      `/rest/agile/1.0/board/${boardId}/sprint`
    )
    const priority: Record<string, number> = { active: 0, future: 1, closed: 2 }
    return sprints
      .map(({ id, name, state, startDate, endDate, completeDate }) => ({
        id,
        name,
        state,
        startDate,
        endDate,
        completeDate,
      }))
      .sort(
        (a, b) =>
          (priority[a.state] ?? 3) - (priority[b.state] ?? 3) || b.id - a.id
      )
  }
  async users(query: string): Promise<JiraUser[]> {
    const result: JiraUser[] = []
    for (let startAt = 0; ; ) {
      const page = await this.request<RawUser[]>(
        `${this.api}/user/search?${this.config.deployment === 'data-center' ? 'username' : 'query'}=${encodeURIComponent(query)}&startAt=${startAt}&maxResults=50`
      )
      result.push(
        ...page
          .filter((user) => user.active)
          .map((user) => this.normalizeUser(user))
      )
      if (page.length < 50) break
      startAt += page.length
      if (startAt >= 1000)
        throw new JiraError(
          400,
          'Busca muito ampla. Informe um nome mais específico.'
        )
    }
    return result
  }
  async search(jql: string): Promise<Issue[]> {
    const issues: Issue[] = []
    if (this.config.deployment === 'data-center') {
      for (let startAt = 0; ; ) {
        const page = await this.request<{ issues: RawIssue[]; total: number }>(
          `${this.api}/search`,
          { jql, fields, maxResults: 100, startAt }
        )
        issues.push(...page.issues.map(normalizeIssue))
        startAt += page.issues.length
        if (issues.length > 5000)
          throw new JiraError(
            400,
            'Mais de 5.000 issues encontradas. Reduza o período da análise.'
          )
        if (startAt >= page.total) return issues
        if (!page.issues.length || !Number.isFinite(page.total))
          throw new JiraError(502, 'Paginação Jira inconsistente.')
      }
    }
    let nextPageToken: string | undefined
    const seenTokens = new Set<string>()
    do {
      const page = await this.request<{
        issues: RawIssue[]
        nextPageToken?: string
        isLast?: boolean
      }>('/rest/api/3/search/jql', {
        jql,
        fields,
        maxResults: 100,
        ...(nextPageToken ? { nextPageToken } : {}),
      })
      issues.push(...page.issues.map(normalizeIssue))
      nextPageToken = page.isLast ? undefined : page.nextPageToken
      if (nextPageToken && seenTokens.has(nextPageToken))
        throw new JiraError(502, 'Paginação Jira inconsistente.')
      if (nextPageToken) seenTokens.add(nextPageToken)
      if (issues.length > 5000)
        throw new JiraError(
          400,
          'Mais de 5.000 issues encontradas. Reduza o período da análise.'
        )
    } while (nextPageToken)
    return issues
  }
  async issue(issueKey: string): Promise<Issue> {
    const raw = await this.request<RawIssue>(
      `${this.api}/issue/${encodeURIComponent(issueKey)}?fields=${fields.join(',')}`
    )
    return normalizeIssue(raw)
  }
  async worklogs(issueKey: string): Promise<Worklog[]> {
    const logs: Worklog[] = []
    for (let startAt = 0; ; ) {
      const page = await this.request<{ worklogs: RawLog[]; total: number }>(
        `${this.api}/issue/${encodeURIComponent(issueKey)}/worklog?startAt=${startAt}&maxResults=100`
      )
      logs.push(
        ...page.worklogs.map((log) => ({
          id: log.id,
          issueKey,
          accountId: this.normalizeUser(log.author).accountId,
          started: log.started,
          timeSpentSeconds: log.timeSpentSeconds,
          comment:
            typeof log.comment === 'string'
              ? log.comment
              : log.comment?.content
                  ?.flatMap(
                    (block) =>
                      block.content?.map((item) => item.text || '') || []
                  )
                  .join('\n') || '',
        }))
      )
      startAt += page.worklogs.length
      if (startAt >= page.total) break
      if (!page.worklogs.length)
        throw new JiraError(502, 'Não foi possível carregar todos os worklogs.')
    }
    return logs
  }
}
