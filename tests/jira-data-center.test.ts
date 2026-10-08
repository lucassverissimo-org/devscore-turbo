import { describe, expect, it, vi } from 'vitest'
import { handle } from '../netlify/functions/jira.mts'
import { JiraClient, jiraConfig } from '../netlify/lib/jira'
import { validateEntries } from '../src/features/timesheet/validation'
import type { Analysis, Entry } from '../src/features/timesheet/types'

const credentials = {
  deployment: 'data-center' as const,
  baseUrl: 'https://agile.corp.edp.pt',
  email: '',
  token: 'dummy-pat',
}
const rawUser = {
  key: 'JIRAUSER10100',
  name: 'lucas.silva',
  displayName: 'Lucas',
  active: true,
}
const user = {
  accountId: rawUser.key,
  displayName: rawUser.displayName,
  username: rawUser.name,
}
const period = {
  start: '2026-10-05',
  end: '2026-10-06',
  dailySeconds: 28800,
  timezone: 'America/Fortaleza',
}
const entry: Entry = {
  id: 'one',
  issueKey: 'ABC-1',
  date: period.start,
  seconds: 3600,
  comment: 'Trabalho revisado',
  origin: 'automatic',
  edited: false,
}
const issue = {
  id: '1',
  key: 'ABC-1',
  fields: {
    summary: 'Task',
    assignee: rawUser,
    timeoriginalestimate: 28800,
    timespent: 0,
  },
}
const req = (payload: unknown) =>
  new Request('http://localhost/.netlify/functions/jira', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credentials, ...(payload as object) }),
  })
function fixture(other = false) {
  const writes: Array<{ url: string; body: Record<string, unknown> }> = []
  const fetcher = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      expect(new Headers(init?.headers).get('Authorization')).toBe(
        'Bearer dummy-pat'
      )
      expect(url).not.toContain('/rest/api/3')
      const body = init?.body ? JSON.parse(String(init.body)) : undefined
      if (url.endsWith('/myself')) return Response.json(rawUser)
      if (url.includes('/user?key='))
        return Response.json(
          other
            ? { ...rawUser, key: 'JIRAUSER20200', name: 'other.user' }
            : rawUser
        )
      if (url.includes('/user/search?username='))
        return Response.json([rawUser])
      if (url.endsWith('/sprint/123'))
        return Response.json({
          id: 123,
          name: 'Sprint',
          state: 'active',
          startDate: '2026-10-01T12:00:00Z',
          endDate: '2026-10-25T12:00:00Z',
        })
      if (url.endsWith('/search'))
        return Response.json({
          total: body.jql.includes('sprint') ? 1 : 0,
          issues: body.jql.includes('sprint')
            ? [
                {
                  ...issue,
                  fields: {
                    ...issue.fields,
                    assignee: other
                      ? { ...rawUser, key: 'JIRAUSER20200', name: 'other.user' }
                      : rawUser,
                  },
                },
              ]
            : [],
        })
      if (url.includes('/issue/ABC-1?fields='))
        return Response.json({
          ...issue,
          fields: {
            ...issue.fields,
            assignee: other
              ? { ...rawUser, key: 'JIRAUSER20200', name: 'other.user' }
              : rawUser,
          },
        })
      if (url.includes('/mypermissions'))
        return Response.json({
          permissions: { WORK_ON_ISSUES: { havePermission: true } },
        })
      if (url.includes('/worklog?') && init?.method === 'POST') {
        writes.push({ url, body })
        return Response.json({ id: '999' }, { status: 201 })
      }
      if (url.includes('/worklog?'))
        return Response.json({ total: 0, worklogs: [] })
      throw new Error(`Unexpected fixture route: ${url}`)
    }
  )
  return { fetcher, writes }
}
describe('Data Center no Timesheet', () => {
  it('conecta com PAT sem e-mail e não devolve o token', async () => {
    const { fetcher } = fixture()
    const response = await handle(req({ action: 'test' }), {}, fetcher)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      user,
      baseUrl: credentials.baseUrl,
    })
  })
  it('analisa usando user key e JQL com username devolvido pelo servidor', async () => {
    const { fetcher } = fixture()
    const response = await handle(
      req({
        action: 'analysis',
        sprintId: 123,
        user: { ...user, username: 'untrusted' },
        period,
      }),
      {},
      fetcher
    )
    expect(response.status).toBe(200)
    const data = (await response.json()) as Analysis
    expect(data.user).toEqual(user)
    expect(data.issues[0].assignee?.accountId).toBe(rawUser.key)
    const searches = fetcher.mock.calls.filter(([url]) =>
      String(url).endsWith('/search')
    )
    expect(JSON.parse(String(searches[0][1]?.body)).jql).toContain(
      'assignee = "lucas.silva"'
    )
  })
  it('revalida e cria worklog v2 com comentário texto sem alterar estimativas', async () => {
    const { fetcher, writes } = fixture()
    const response = await handle(
      req({
        action: 'create',
        sprintId: 123,
        user,
        period,
        entry,
        pending: [entry],
        confirmed: true,
      }),
      {},
      fetcher
    )
    expect(response.status).toBe(200)
    expect(writes).toEqual([
      {
        url: `${credentials.baseUrl}/rest/api/2/issue/ABC-1/worklog?adjustEstimate=leave`,
        body: {
          started: '2026-10-05T12:00:00.000+0000',
          timeSpentSeconds: 3600,
          comment: entry.comment,
        },
      },
    ])
  })
  it('continua bloqueando o registro para outro usuário', async () => {
    const { fetcher, writes } = fixture(true)
    const response = await handle(
      req({
        action: 'create',
        sprintId: 123,
        user: { accountId: 'JIRAUSER20200', displayName: 'Other' },
        period,
        entry,
        pending: [entry],
        confirmed: true,
      }),
      {},
      fetcher
    )
    expect(response.status).toBe(409)
    expect(writes).toHaveLength(0)
  })
  it.each([
    'https://localhost',
    'https://127.0.0.1',
    'https://untrusted.example',
    'http://agile.corp.edp.pt',
    'https://agile.corp.edp.pt/?token=x',
  ])(
    'bloqueia destino não autorizado antes de transmitir PAT: %s',
    async (baseUrl) => {
      const fetcher = vi.fn()
      const response = await handle(
        req({ action: 'test', credentials: { ...credentials, baseUrl } }),
        {},
        fetcher
      )
      expect(response.status).toBeGreaterThanOrEqual(400)
      expect(fetcher).not.toHaveBeenCalled()
    }
  )
  it('permite um contexto HTTPS explicitamente autorizado no servidor', () => {
    expect(
      jiraConfig(
        { ...credentials, baseUrl: 'https://jira.example/jira/' },
        { JIRA_DC_ALLOWED_BASE_URLS: 'https://jira.example/jira' }
      ).baseUrl
    ).toBe('https://jira.example/jira')
    expect(
      jiraConfig(
        undefined,
        { JIRA_DC_BASE_URL: credentials.baseUrl, JIRA_DC_PAT: 'deploy-pat' },
        'data-center'
      )
    ).toMatchObject({
      deployment: 'data-center',
      email: '',
      token: 'deploy-pat',
    })
  })
  it('carrega todas as páginas de issues e worklogs e resolve autores sem key', async () => {
    const fetcher = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input)
        if (url.endsWith('/myself')) return Response.json(rawUser)
        if (url.endsWith('/search')) {
          const body = JSON.parse(String(init?.body))
          return Response.json({
            total: 2,
            issues: [{ ...issue, key: `ABC-${body.startAt + 1}` }],
          })
        }
        const startAt = Number(new URL(url).searchParams.get('startAt'))
        return Response.json({
          total: 2,
          worklogs: [
            {
              id: String(startAt + 1),
              author: { name: rawUser.name, displayName: 'Lucas' },
              started: '2026-10-05T12:00:00.000+0000',
              timeSpentSeconds: 3600,
              comment: 'Texto DC',
            },
          ],
        })
      }
    )
    const client = new JiraClient(jiraConfig(credentials, {}), fetcher)
    await client.myself()
    expect(await client.search('sprint = 123')).toHaveLength(2)
    const logs = await client.worklogs('ABC-1')
    expect(logs).toHaveLength(2)
    expect(logs[0]).toMatchObject({
      accountId: rawUser.key,
      comment: 'Texto DC',
    })
    const { fetcher: base } = fixture()
    const analysis = (await (
      await handle(
        req({ action: 'analysis', sprintId: 123, user, period }),
        {},
        base
      )
    ).json()) as Analysis
    expect(
      validateEntries(
        { ...analysis, worklogs: logs },
        period,
        [entry],
        true
      ).some((item) => item.message.includes('duplicidade'))
    ).toBe(true)
  })
})
