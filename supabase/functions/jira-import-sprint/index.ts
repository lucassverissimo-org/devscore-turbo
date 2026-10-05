import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import {
  HttpError,
  JiraConnectionRow,
  buildJiraApiUrl,
  createSupabaseAdminClient,
  getAuthorizedUser,
  getJiraConnection,
  getValidJiraAccessToken,
  jiraFetchWithBackoff,
  normalizePositiveInteger,
  normalizeText,
} from '../_shared/jira.ts'

type ImportBody = {
  boardId?: unknown
  sprintId?: unknown
  sprintName?: unknown
  forceRefresh?: unknown
}

type JiraSprint = {
  id: number
  name: string
  state?: string
}

type NormalizedIssue = {
  id: string
  key: string
  summary: string
  status: string
  issueType: string
  url: string
  storyPoints: number | null
}

function getCacheTtlSeconds(): number {
  const configured = Number(Deno.env.get('JIRA_SPRINT_CACHE_TTL_SECONDS') ?? '')
  return Number.isFinite(configured) && configured > 0 ? configured : 15 * 60
}

function getStoryPointsField(): string | null {
  const field = normalizeText(Deno.env.get('JIRA_STORY_POINTS_FIELD'))
  return field || null
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

async function findCachedSprintByName(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  connection: JiraConnectionRow,
  userId: string,
  boardId: number,
  sprintName: string,
): Promise<JiraSprint | null> {
  const targetName = normalizeName(sprintName)
  const { data: cachedSprints } = await supabaseAdmin
    .from('jira_sprint_cache')
    .select('sprint_id,sprint_name')
    .eq('user_id', userId)
    .eq('cloud_id', connection.cloud_id)
    .eq('board_id', boardId)

  const cachedSprint = Array.isArray(cachedSprints)
    ? cachedSprints.find(row => normalizeName(row.sprint_name ?? '') === targetName)
    : null

  if (!cachedSprint?.sprint_id) return null

  return {
    id: cachedSprint.sprint_id,
    name: cachedSprint.sprint_name ?? sprintName,
  }
}

async function getFreshSprintCache(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  connection: JiraConnectionRow,
  userId: string,
  sprintId: number,
  boardId: number | null,
  sprintName: string,
  cacheTtlSeconds: number,
): Promise<Record<string, unknown> | null> {
  const { data: cacheRow, error: cacheError } = await supabaseAdmin
    .from('jira_sprint_cache')
    .select('issues,jira_fetched_at,sprint_name,board_id')
    .eq('user_id', userId)
    .eq('cloud_id', connection.cloud_id)
    .eq('sprint_id', sprintId)
    .maybeSingle()

  if (cacheError) {
    throw new HttpError(500, 'Nao foi possivel consultar o cache Jira.')
  }

  if (!cacheRow) return null

  const fetchedAt = Date.parse(cacheRow.jira_fetched_at)
  const isFresh = Number.isFinite(fetchedAt) && Date.now() - fetchedAt < cacheTtlSeconds * 1000
  if (!isFresh) return null

  return {
    source: 'cache',
    cacheTtlSeconds,
    fetchedAt: cacheRow.jira_fetched_at,
    sprint: {
      id: sprintId,
      name: cacheRow.sprint_name ?? sprintName,
      boardId: cacheRow.board_id ?? boardId,
    },
    issues: Array.isArray(cacheRow.issues) ? cacheRow.issues : [],
  }
}

function extractAdfText(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value.map(extractAdfText).filter(Boolean).join(' ')
  }

  if (typeof value !== 'object') return ''
  const record = value as Record<string, unknown>
  const ownText = typeof record.text === 'string' ? record.text : ''
  const childText = extractAdfText(record.content)
  return [ownText, childText].filter(Boolean).join(' ')
}

function normalizeIssue(issue: Record<string, unknown>, connection: JiraConnectionRow, storyPointsField: string | null): NormalizedIssue | null {
  const key = normalizeText(issue.key)
  const id = normalizeText(issue.id)
  const fields = typeof issue.fields === 'object' && issue.fields !== null
    ? issue.fields as Record<string, unknown>
    : {}

  if (!key) return null

  const status = typeof fields.status === 'object' && fields.status !== null
    ? normalizeText((fields.status as Record<string, unknown>).name)
    : ''
  const issueType = typeof fields.issuetype === 'object' && fields.issuetype !== null
    ? normalizeText((fields.issuetype as Record<string, unknown>).name)
    : ''
  const summary = normalizeText(fields.summary) || extractAdfText(fields.description).slice(0, 180)
  const rawStoryPoints = storyPointsField ? fields[storyPointsField] : null
  const storyPoints = typeof rawStoryPoints === 'number' && Number.isFinite(rawStoryPoints)
    ? rawStoryPoints
    : null

  return {
    id,
    key,
    summary,
    status,
    issueType,
    url: `${connection.site_url}/browse/${encodeURIComponent(key)}`,
    storyPoints,
  }
}

async function fetchJiraJson(url: string, accessToken: string): Promise<Record<string, unknown>> {
  const response = await jiraFetchWithBackoff(url, accessToken)

  if (!response.ok) {
    const responseText = await response.text().catch(() => '')
    const statusMessage = response.status === 403
      ? 'Usuario sem permissao para consultar esta sprint no Jira.'
      : response.status === 404
        ? 'Sprint ou board nao encontrado no Jira.'
        : response.status === 429
          ? 'Jira limitou as requisicoes. Tente novamente mais tarde.'
          : 'Jira recusou a consulta da sprint.'

    throw new HttpError(response.status, statusMessage, {
      jiraStatus: response.status,
      jiraResponse: responseText.slice(0, 500),
    })
  }

  return response.json()
}

async function resolveSprintByName(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  connection: JiraConnectionRow,
  userId: string,
  accessToken: string,
  boardId: number,
  sprintName: string,
): Promise<JiraSprint> {
  const cachedSprint = await findCachedSprintByName(supabaseAdmin, connection, userId, boardId, sprintName)
  if (cachedSprint) return cachedSprint

  const targetName = normalizeName(sprintName)
  let startAt = 0
  const maxResults = 50

  for (let page = 0; page < 5; page += 1) {
    const url = new URL(buildJiraApiUrl(connection, `/rest/agile/1.0/board/${boardId}/sprint`))
    url.searchParams.set('state', 'active,future')
    url.searchParams.set('startAt', String(startAt))
    url.searchParams.set('maxResults', String(maxResults))

    const data = await fetchJiraJson(url.toString(), accessToken)
    const values = Array.isArray(data.values) ? data.values as Array<Record<string, unknown>> : []
    const sprint = values.find(item => normalizeName(normalizeText(item.name)) === targetName)

    if (sprint) {
      const id = normalizePositiveInteger(sprint.id)
      const name = normalizeText(sprint.name)
      if (id && name) {
        return {
          id,
          name,
          state: normalizeText(sprint.state),
        }
      }
    }

    if (data.isLast === true || values.length === 0) break
    startAt = Number(data.startAt ?? startAt) + Number(data.maxResults ?? maxResults)
  }

  throw new HttpError(404, 'Sprint nao encontrada. Informe o Sprint ID para evitar uma busca mais ampla no Jira.')
}

async function fetchSprintIssuesFromEndpoint(
  connection: JiraConnectionRow,
  accessToken: string,
  endpoint: string,
  storyPointsField: string | null,
): Promise<NormalizedIssue[]> {
  const fields = ['summary', 'status', 'issuetype', 'description', storyPointsField]
    .filter((field): field is string => Boolean(field))
  const issues: NormalizedIssue[] = []
  let nextPageToken = ''
  let startAt = 0

  for (let page = 0; page < 30; page += 1) {
    const url = new URL(buildJiraApiUrl(connection, endpoint))
    url.searchParams.set('maxResults', '100')
    url.searchParams.set('fields', fields.join(','))

    if (nextPageToken) {
      url.searchParams.set('nextPageToken', nextPageToken)
    } else if (startAt > 0) {
      url.searchParams.set('startAt', String(startAt))
    }

    const data = await fetchJiraJson(url.toString(), accessToken)
    const pageIssues = Array.isArray(data.issues)
      ? data.issues as Array<Record<string, unknown>>
      : []

    for (const issue of pageIssues) {
      const normalized = normalizeIssue(issue, connection, storyPointsField)
      if (normalized) issues.push(normalized)
    }

    nextPageToken = normalizeText(data.nextPageToken)
    if (nextPageToken) continue

    if (data.isLast === true || pageIssues.length === 0) break

    const currentStart = Number(data.startAt ?? startAt)
    const maxResults = Number(data.maxResults ?? 100)
    const total = Number(data.total ?? issues.length)
    startAt = currentStart + maxResults

    if (startAt >= total) break
  }

  return issues
}

async function fetchSprintIssues(
  connection: JiraConnectionRow,
  accessToken: string,
  boardId: number | null,
  sprintId: number,
): Promise<NormalizedIssue[]> {
  const endpoints = boardId
    ? [
        `/rest/software/1.0/board/${boardId}/sprint/${sprintId}/issue`,
        `/rest/agile/1.0/board/${boardId}/sprint/${sprintId}/issue`,
      ]
    : [
        `/rest/software/1.0/sprint/${sprintId}/issue`,
        `/rest/agile/1.0/sprint/${sprintId}/issue`,
      ]
  const storyPointsField = getStoryPointsField()
  let lastError: unknown = null

  for (const endpoint of endpoints) {
    try {
      return await fetchSprintIssuesFromEndpoint(connection, accessToken, endpoint, storyPointsField)
    } catch (error) {
      lastError = error
      if (!(error instanceof HttpError) || (error.status !== 404 && error.status !== 400)) {
        throw error
      }
    }
  }

  throw lastError instanceof HttpError
    ? lastError
    : new HttpError(502, 'Nao foi possivel consultar a sprint no Jira.')
}

Deno.serve(async req => {
  const optionsResponse = handleOptions(req)
  if (optionsResponse) return optionsResponse

  try {
    if (req.method !== 'POST') {
      throw new HttpError(405, 'Metodo nao permitido.')
    }

    const supabaseAdmin = createSupabaseAdminClient()
    const user = await getAuthorizedUser(req, supabaseAdmin)
    const connection = await getJiraConnection(supabaseAdmin, user.id)
    const body = await req.json().catch(() => ({})) as ImportBody
    const boardId = normalizePositiveInteger(body.boardId)
    let sprintId = normalizePositiveInteger(body.sprintId)
    let sprintName = normalizeText(body.sprintName)
    const forceRefresh = body.forceRefresh === true
    const cacheTtlSeconds = getCacheTtlSeconds()

    if (!sprintId) {
      if (!boardId || !sprintName) {
        throw new HttpError(400, 'Informe o Sprint ID ou preencha Board ID e nome da sprint.')
      }

      const cachedSprint = await findCachedSprintByName(supabaseAdmin, connection, user.id, boardId, sprintName)
      if (cachedSprint) {
        sprintId = cachedSprint.id
        sprintName = cachedSprint.name
      }
    }

    if (sprintId && !forceRefresh) {
      const cachedResponse = await getFreshSprintCache(
        supabaseAdmin,
        connection,
        user.id,
        sprintId,
        boardId,
        sprintName,
        cacheTtlSeconds,
      )
      if (cachedResponse) return jsonResponse(cachedResponse)
    }

    const accessToken = await getValidJiraAccessToken(supabaseAdmin, connection)

    if (!sprintId) {
      if (!boardId || !sprintName) {
        throw new HttpError(400, 'Informe o Sprint ID ou preencha Board ID e nome da sprint.')
      }

      const sprint = await resolveSprintByName(
        supabaseAdmin,
        connection,
        user.id,
        accessToken,
        boardId,
        sprintName,
      )
      sprintId = sprint.id
      sprintName = sprint.name

      if (!forceRefresh) {
        const cachedResponse = await getFreshSprintCache(
          supabaseAdmin,
          connection,
          user.id,
          sprintId,
          boardId,
          sprintName,
          cacheTtlSeconds,
        )
        if (cachedResponse) return jsonResponse(cachedResponse)
      }
    }

    if (!sprintId) {
      throw new HttpError(400, 'Nao foi possivel identificar o Sprint ID.')
    }

    const issues = await fetchSprintIssues(connection, accessToken, boardId, sprintId)
    const fetchedAt = new Date().toISOString()

    const { error: upsertError } = await supabaseAdmin
      .from('jira_sprint_cache')
      .upsert({
        user_id: user.id,
        cloud_id: connection.cloud_id,
        board_id: boardId,
        sprint_id: sprintId,
        sprint_name: sprintName || null,
        issues,
        jira_fetched_at: fetchedAt,
      }, { onConflict: 'user_id,cloud_id,sprint_id' })

    if (upsertError) {
      throw new HttpError(500, 'Nao foi possivel salvar o cache Jira.')
    }

    return jsonResponse({
      source: 'jira',
      cacheTtlSeconds,
      fetchedAt,
      sprint: {
        id: sprintId,
        name: sprintName || null,
        boardId,
      },
      issues,
    })
  } catch (error) {
    const httpError = error instanceof HttpError
      ? error
      : new HttpError(500, 'Nao foi possivel importar a sprint do Jira.')

    return jsonResponse(
      { error: httpError.message, details: httpError.details },
      httpError.status,
    )
  }
})
