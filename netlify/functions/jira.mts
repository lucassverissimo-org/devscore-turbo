import type {
  Credentials,
  JiraDeployment,
  Entry,
  JiraUser,
  Period,
} from '../../src/features/timesheet/types'
import { startedAt, validTimezone } from '../../src/features/timesheet/dates'
import { validateEntries } from '../../src/features/timesheet/validation'
import { account, analyze } from '../lib/analysis'
import { JiraClient, JiraError, jiraConfig, safeText } from '../lib/jira'
interface Payload {
  deployment?: JiraDeployment
  action: string
  credentials?: Credentials
  sprintId: number
  boardId: number
  query: string
  user: JiraUser
  period: Period
  entry: Entry
  pending: Entry[]
  confirmed?: boolean
  acknowledgeWarnings?: boolean
  acknowledgedWarnings?: string[]
}
const json = (value: unknown, status = 200, retryAfter?: number) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}),
    },
  })
async function authorizeDeploy(request: Request, env: NodeJS.ProcessEnv) {
  const token = request.headers.get('Authorization')
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const key = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
  const allowed = (env.JIRA_DEPLOY_ALLOWED_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  if (!url || !key || !allowed.length)
    throw new JiraError(
      403,
      'O modo deploy exige login Supabase e JIRA_DEPLOY_ALLOWED_USER_IDS no Netlify. Você também pode usar credenciais temporárias.'
    )
  if (!token?.startsWith('Bearer '))
    throw new JiraError(
      401,
      'Entre na sua conta DevScore para usar a conexão do deploy.'
    )
  const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { Authorization: token, apikey: key },
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok)
    throw new JiraError(401, 'Sessão DevScore inválida. Entre novamente.')
  const user = (await response.json()) as { id: string }
  if (!allowed.includes(user.id))
    throw new JiraError(
      403,
      'Sua conta DevScore não está autorizada a usar as credenciais Jira do deploy.'
    )
}
export async function handle(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
  fetcher: typeof fetch = fetch
) {
  try {
    if (request.method !== 'POST')
      return json({ error: 'Método não permitido.' }, 405)
    const origin = request.headers.get('Origin')
    if (origin && origin !== new URL(request.url).origin)
      throw new JiraError(403, 'Origem não autorizada.')
    if (!request.headers.get('Content-Type')?.includes('application/json'))
      throw new JiraError(400, 'Envie JSON.')
    const text = await request.text()
    if (text.length > 250000)
      throw new JiraError(413, 'Requisição muito grande.')
    let payload: Payload
    try {
      payload = JSON.parse(text) as Payload
    } catch {
      throw new JiraError(400, 'JSON inválido.')
    }
    if (
      !payload ||
      ![
        'test',
        'boards',
        'sprints',
        'sprint',
        'users',
        'analysis',
        'create',
      ].includes(payload.action)
    )
      throw new JiraError(400, 'Operação inválida.')
    if (!payload.credentials) await authorizeDeploy(request, env)
    const client = new JiraClient(
      jiraConfig(
        payload.credentials,
        env,
        payload.deployment || payload.credentials?.deployment || 'cloud'
      ),
      fetcher
    )
    if (payload.action === 'test')
      return json({
        user: await client.myself(),
        timezone: client.config.timezone,
        baseUrl: client.config.baseUrl,
      })
    if (payload.action === 'sprint')
      return json(await client.sprint(payload.sprintId))
    if (payload.action === 'boards') return json(await client.boards())
    if (payload.action === 'sprints')
      return json(await client.sprints(payload.boardId))
    if (payload.action === 'users')
      return json(await client.users(safeText(payload.query, 'Busca')))
    const period = payload.period
    if (!period || !validTimezone(period.timezone))
      throw new JiraError(400, 'Período ou timezone inválido.')
    account(payload.user?.accountId)
    const fresh = await analyze(client, payload.sprintId, payload.user, period)
    if (payload.action === 'analysis') return json(fresh)
    if (payload.confirmed !== true)
      throw new JiraError(400, 'Confirmação explícita obrigatória.')
    const entry = payload.entry
    if (
      !entry ||
      entry.worklogId ||
      entry.result === 'success' ||
      entry.result === 'uncertain'
    )
      throw new JiraError(
        409,
        'Item já enviado ou com resultado incerto. Confira no Jira.'
      )
    if (
      !Array.isArray(payload.pending) ||
      payload.pending.length > 1000 ||
      !payload.pending.some(
        (item) =>
          item.id === entry.id && JSON.stringify(item) === JSON.stringify(entry)
      )
    )
      throw new JiraError(400, 'Lista de revisão inválida.')
    // Validate untrusted JSON before invoking the shared validation service.
    for (const item of payload.pending) {
      if (
        !item ||
        typeof item.id !== 'string' ||
        typeof item.issueKey !== 'string' ||
        typeof item.date !== 'string' ||
        typeof item.comment !== 'string' ||
        !['manual', 'automatic'].includes(item.origin) ||
        typeof item.edited !== 'boolean' ||
        typeof item.seconds !== 'number'
      )
        throw new JiraError(400, 'Lançamento inválido.')
    }
    // Direct issue read avoids relying on an eventually consistent JQL time-spent value.
    const latestIssue = await client.issue(entry.issueKey)
    if (latestIssue.assignee?.accountId !== fresh.user.accountId)
      throw new JiraError(
        409,
        'A issue deixou de estar atribuída ao usuário selecionado. Atualize a análise.'
      )
    fresh.issues = fresh.issues.map((issue) =>
      issue.key === latestIssue.key ? latestIssue : issue
    )
    const validations = validateEntries(fresh, period, payload.pending, true)
    if (validations.some((item) => item.level === 'ERROR'))
      return json(
        {
          error:
            'Revalidação encontrou erros. Atualize a análise e revise os lançamentos.',
          validations,
          fresh,
        },
        409
      )
    if (
      validations.some(
        (item) =>
          item.level === 'WARNING' &&
          (payload.acknowledgeWarnings !== true ||
            !payload.acknowledgedWarnings?.includes(
              `${item.entryId || ''}:${item.message}`
            ))
      )
    )
      return json(
        {
          error: 'Revise e reconheça os avisos antes do registro.',
          validations,
          fresh,
        },
        409
      )
    const permissions = await client.request<{
      permissions: { WORK_ISSUES?: { havePermission: boolean } }
    }>(
      `${client.api}/mypermissions?issueKey=${encodeURIComponent(entry.issueKey)}&permissions=WORK_ISSUES`
    )
    if (!permissions.permissions.WORK_ISSUES?.havePermission)
      throw new JiraError(
        403,
        'Sem permissão Work on issues para registrar nesta issue.'
      )
    const result = await client.request<{ id: string }>(
      `${client.api}/issue/${encodeURIComponent(entry.issueKey)}/worklog?adjustEstimate=leave`,
      {
        started: startedAt(entry.date, period.timezone),
        timeSpentSeconds: entry.seconds,
        ...(entry.comment
          ? {
              comment:
                client.config.deployment === 'data-center'
                  ? entry.comment
                  : {
                      type: 'doc',
                      version: 1,
                      content: [
                        {
                          type: 'paragraph',
                          content: [{ type: 'text', text: entry.comment }],
                        },
                      ],
                    },
            }
          : {}),
      },
      true
    )
    if (!result.id)
      throw new JiraError(
        502,
        'Jira não retornou Worklog ID. Confira na issue antes de reenviar.',
        undefined,
        true
      )
    return json({ id: result.id })
  } catch (error) {
    if (error instanceof JiraError)
      return json(
        {
          error: error.message,
          code: error.status,
          uncertain: error.uncertain,
          retryAfter: error.retryAfter,
        },
        error.status,
        error.retryAfter
      )
    // Never return upstream bodies, request objects, credentials or stack traces.
    return json(
      {
        error:
          'Não foi possível acessar o Jira. Verifique sua configuração e permissões.',
        code: 500,
      },
      500
    )
  }
}
export default (request: Request) => handle(request)
