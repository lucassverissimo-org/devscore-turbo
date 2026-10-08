import { expect, it, describe, vi } from 'vitest'
import { handle } from '../netlify/functions/jira.mts'
import {
  cloudUrl,
  JiraClient,
  JiraError,
  jiraConfig,
  retrySeconds,
} from '../netlify/lib/jira'
import type { Entry } from '../src/features/timesheet/types'
const credentials = {
  baseUrl: 'https://example.atlassian.net',
  email: 'test@example.com',
  token: 'temporary-secret',
}
const period = {
  start: '2026-10-05',
  end: '2026-10-09',
  dailySeconds: 28800,
  timezone: 'America/Fortaleza',
}
const entry: Entry = {
  id: 'one',
  date: period.start,
  issueKey: 'ABC-1',
  seconds: 3600,
  comment: 'Trabalho',
  origin: 'automatic',
  edited: false,
}
const user = { accountId: 'me', displayName: 'Lucas' }
const request = (payload: unknown) =>
  new Request('http://localhost/.netlify/functions/jira', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
    body: JSON.stringify(payload),
  })
function fixture() {
  const posts: Array<{ url: string; body: Record<string, unknown> }> = []
  const fetcher = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const body = init?.body
        ? (JSON.parse(String(init.body)) as Record<string, unknown>)
        : undefined
      if (init?.method === 'POST' && url.includes('/worklog?')) {
        posts.push({ url, body: body || {} })
        return Response.json({ id: '999' }, { status: 201 })
      }
      if (url.endsWith('/myself') || url.includes('/user?accountId'))
        return Response.json(user)
      if (url.includes('/mypermissions')) {
        const permission = new URL(url).searchParams.get('permissions')
        if (permission !== 'WORK_ON_ISSUES')
          return Response.json(
            { errorMessages: ['Unrecognized permission'] },
            { status: 400 }
          )
        return Response.json({
          permissions: { WORK_ON_ISSUES: { havePermission: true } },
        })
      }
      if (url.endsWith('/sprint/123'))
        return Response.json({
          id: 123,
          name: 'Sprint',
          state: 'active',
          startDate: '2026-10-01T12:00:00Z',
          endDate: '2026-10-25T12:00:00Z',
        })
      if (url.includes('/search/jql'))
        return Response.json({
          isLast: true,
          issues: String(body?.jql).includes('sprint')
            ? [
                {
                  id: '1',
                  key: 'ABC-1',
                  fields: {
                    summary: 'Trabalho',
                    assignee: user,
                    issuetype: { name: 'Custom' },
                    status: { name: 'Active' },
                    timeoriginalestimate: 36000,
                    timespent: 14400,
                  },
                },
              ]
            : [],
        })
      if (url.includes('/issue/ABC-1?fields='))
        return Response.json({
          id: '1',
          key: 'ABC-1',
          fields: {
            summary: 'Trabalho',
            assignee: user,
            timeoriginalestimate: 36000,
            timespent: 14400,
          },
        })
      if (url.includes('/worklog?'))
        return Response.json({ total: 0, worklogs: [] })
      return Response.json({ error: 'unexpected' }, { status: 404 })
    }
  ) as unknown as typeof fetch
  return { fetcher, posts }
}
describe('Netlify Function: proteção e revalidação', () => {
  it('consulta WORK_ON_ISSUES antes de criar horas sem comentário', async () => {
    const { fetcher, posts } = fixture()
    const withoutComment = { ...entry, comment: '' }
    const response = await handle(
      request({
        action: 'create',
        credentials,
        sprintId: 123,
        user,
        period,
        entry: withoutComment,
        pending: [withoutComment],
        confirmed: true,
      }),
      {},
      fetcher
    )
    expect(response.status).toBe(200)
    expect(
      vi.mocked(fetcher).mock.calls.some(([url]) =>
        String(url).includes('permissions=WORK_ON_ISSUES')
      )
    ).toBe(true)
    expect(posts[0].body).toEqual({
      started: '2026-10-05T12:00:00.000+0000',
      timeSpentSeconds: 3600,
    })
  })
  it.each([
    ['2026-09-28', '2026-09-30'],
    ['2026-11-02', '2026-11-03'],
  ])(
    'analisa e registra fora das datas da Sprint: %s a %s',
    async (start, end) => {
      const { fetcher, posts } = fixture()
      const outsidePeriod = { ...period, start, end }
      const outsideEntry = { ...entry, date: start }
      const payload = {
        credentials,
        sprintId: 123,
        user,
        period: outsidePeriod,
      }
      const analysisResponse = await handle(
        request({ ...payload, action: 'analysis' }),
        {},
        fetcher
      )
      expect(analysisResponse.status).toBe(200)
      const response = await handle(
        request({
          ...payload,
          action: 'create',
          entry: outsideEntry,
          pending: [outsideEntry],
          confirmed: true,
        }),
        {},
        fetcher
      )
      expect(response.status).toBe(200)
      expect(posts).toHaveLength(1)
      expect(String(posts[0].body.started)).toContain(start)
    }
  )
  it('testa conexão sem retornar credenciais', async () => {
    const { fetcher } = fixture()
    const response = await handle(
      request({ action: 'test', credentials }),
      {},
      fetcher
    )
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toContain('Lucas')
    expect(text).not.toContain(credentials.token)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
  it('não permite usar segredo do deploy anonimamente', async () => {
    const response = await handle(request({ action: 'test' }), {})
    expect(response.status).toBe(403)
  })
  it('bloqueia origem externa antes da autenticação', async () => {
    const req = request({ action: 'test', credentials })
    req.headers.set('Origin', 'https://evil.example')
    expect((await handle(req, {})).status).toBe(403)
  })
  it.each([
    'http://example.atlassian.net',
    'https://localhost',
    'https://example.atlassian.net.evil.com',
    'https://evil@site.atlassian.net',
    'https://site.atlassian.net:8443',
    'https://site.atlassian.net/rest/api',
    'https://site.atlassian.net/?token=secret',
  ])('bloqueia SSRF: %s', (url) => expect(() => cloudUrl(url)).toThrow())
  it('rejeita token com newline', () =>
    expect(() =>
      jiraConfig({ ...credentials, token: 'secret\n' }, {})
    ).toThrow())
  it('consulta dados frescos e cria worklog sem author ou estimativas', async () => {
    const { fetcher, posts } = fixture()
    const response = await handle(
      request({
        action: 'create',
        credentials,
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
    expect(posts).toHaveLength(1)
    expect(posts[0].url).toContain('adjustEstimate=leave')
    expect(posts[0].body).toEqual({
      started: '2026-10-05T12:00:00.000+0000',
      timeSpentSeconds: 3600,
      comment: {
        type: 'doc',
        version: 1,
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Trabalho' }] },
        ],
      },
    })
  })
  it('exige confirmação explícita', async () => {
    const { fetcher, posts } = fixture()
    const result = await handle(
      request({
        action: 'create',
        credentials,
        sprintId: 123,
        user,
        period,
        entry,
        pending: [entry],
      }),
      {},
      fetcher
    )
    expect(result.status).toBe(400)
    expect(posts).toHaveLength(0)
  })
  it('bloqueia alteração maliciosa da identidade', async () => {
    const { fetcher, posts } = fixture()
    const proxy: typeof fetch = async (input, init) =>
      String(input).includes('/user?accountId')
        ? Response.json({ accountId: 'other', displayName: 'Outro' })
        : fetcher(input, init)
    const result = await handle(
      request({
        action: 'create',
        credentials,
        sprintId: 123,
        user: { accountId: 'other', displayName: 'Outro' },
        period,
        entry,
        pending: [entry],
        confirmed: true,
      }),
      {},
      proxy
    )
    expect(result.status).toBe(409)
    expect(posts).toHaveLength(0)
  })
  it('bloqueia duplicidade descoberta no servidor', async () => {
    const { fetcher, posts } = fixture()
    const proxy: typeof fetch = async (input, init) =>
      String(input).includes('/worklog?')
        ? Response.json({
            total: 1,
            worklogs: [
              {
                id: 'existing',
                author: user,
                started: '2026-10-05T09:00:00-0300',
                timeSpentSeconds: 3600,
              },
            ],
          })
        : fetcher(input, init)
    const result = await handle(
      request({
        action: 'create',
        credentials,
        sprintId: 123,
        user,
        period,
        entry,
        pending: [entry],
        confirmed: true,
      }),
      {},
      proxy
    )
    expect(result.status).toBe(409)
    expect(posts).toHaveLength(0)
  })
  it('bloqueia registro sem permissão Work on issues', async () => {
    const { fetcher, posts } = fixture()
    const proxy: typeof fetch = async (input, init) =>
      String(input).includes('/mypermissions')
        ? Response.json({
            permissions: { WORK_ON_ISSUES: { havePermission: false } },
          })
        : fetcher(input, init)
    const result = await handle(
      request({
        action: 'create',
        credentials,
        sprintId: 123,
        user,
        period,
        entry,
        pending: [entry],
        confirmed: true,
      }),
      {},
      proxy
    )
    expect(result.status).toBe(403)
    expect(posts).toHaveLength(0)
  })
})
describe('client Jira: paginação e falhas', () => {
  it('percorre todos os tokens de issues', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          issues: [
            { id: '1', key: 'ABC-1', fields: { summary: 'A', assignee: user } },
          ],
          nextPageToken: 'next',
          isLast: false,
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          issues: [
            { id: '2', key: 'ABC-2', fields: { summary: 'B', assignee: user } },
          ],
          isLast: true,
        })
      )
    const client = new JiraClient(jiraConfig(credentials, {}), fetcher)
    expect(await client.search('sprint = 123')).toHaveLength(2)
    expect(JSON.parse(fetcher.mock.calls[1][1].body).nextPageToken).toBe('next')
  })
  it('percorre worklogs sem confiar no campo inline das issues', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          total: 2,
          worklogs: [
            {
              id: '1',
              author: user,
              started: '2026-10-05T12:00:00Z',
              timeSpentSeconds: 60,
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          total: 2,
          worklogs: [
            {
              id: '2',
              author: user,
              started: '2026-10-05T12:00:00Z',
              timeSpentSeconds: 60,
            },
          ],
        })
      )
    expect(
      await new JiraClient(jiraConfig(credentials, {}), fetcher).worklogs(
        'ABC-1'
      )
    ).toHaveLength(2)
    expect(fetcher.mock.calls[1][0]).toContain('startAt=1')
  })
  it.each([400, 401, 403, 404, 500])(
    'sanitiza erro %i, sem corpo Jira ou token',
    async (status) => {
      const client = new JiraClient(
        jiraConfig(credentials, {}),
        vi.fn(async () => new Response('secret=temporary-secret', { status }))
      )
      await expect(client.myself()).rejects.toThrow(JiraError)
      await expect(client.myself()).rejects.not.toThrow('temporary-secret')
    }
  )
  it('GET respeita Retry-After curto', async () => {
    const pause = vi.fn(async () => {})
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('', { status: 429, headers: { 'Retry-After': '2' } })
      )
      .mockResolvedValueOnce(Response.json(user))
    expect(
      await new JiraClient(jiraConfig(credentials, {}), fetcher, pause).myself()
    ).toEqual(user)
    expect(pause).toHaveBeenCalledWith(2000)
  })
  it('POST nunca faz retry automático, mesmo com timeout ou 429', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response('', { status: 429, headers: { 'Retry-After': '10' } })
    )
    const client = new JiraClient(jiraConfig(credentials, {}), fetcher)
    await expect(client.request('/write', {}, true)).rejects.toMatchObject({
      retryAfter: 10,
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
    const failing = new JiraClient(
      jiraConfig(credentials, {}),
      vi.fn(async () => {
        throw new Error('network')
      })
    )
    await expect(failing.request('/write', {}, true)).rejects.toMatchObject({
      uncertain: true,
    })
  })
  it('entende Retry-After como data HTTP', () =>
    expect(
      retrySeconds(new Date(Date.now() + 10000).toUTCString())
    ).toBeGreaterThanOrEqual(9))
})

it('usa leitura direta para bloquear saldo zerado mesmo com JQL atrasado', async () => {
  const { fetcher, posts } = fixture()
  const proxy: typeof fetch = async (input, init) =>
    String(input).includes('/issue/ABC-1?fields=')
      ? Response.json({
          id: '1',
          key: 'ABC-1',
          fields: {
            summary: 'Trabalho',
            assignee: user,
            timeoriginalestimate: 36000,
            timespent: 36000,
          },
        })
      : fetcher(input, init)
  const result = await handle(
    request({
      action: 'create',
      credentials,
      sprintId: 123,
      user,
      period,
      entry,
      pending: [entry],
      confirmed: true,
    }),
    {},
    proxy
  )
  expect(result.status).toBe(409)
  expect(posts).toHaveLength(0)
})
it('não aceita avisos manuais novos sem revisão explícita', async () => {
  const { fetcher, posts } = fixture()
  const manual = { ...entry, seconds: 25200, edited: true }
  const result = await handle(
    request({
      action: 'create',
      credentials,
      sprintId: 123,
      user,
      period,
      entry: manual,
      pending: [manual],
      confirmed: true,
      acknowledgeWarnings: true,
      acknowledgedWarnings: [],
    }),
    {},
    fetcher
  )
  expect(result.status).toBe(409)
  expect(posts).toHaveLength(0)
})
it('permite excesso manual quando o aviso específico foi reconhecido', async () => {
  const { fetcher, posts } = fixture()
  const manual = { ...entry, seconds: 25200, edited: true }
  const result = await handle(
    request({
      action: 'create',
      credentials,
      sprintId: 123,
      user,
      period,
      entry: manual,
      pending: [manual],
      confirmed: true,
      acknowledgeWarnings: true,
      acknowledgedWarnings: [
        'one:Lançamentos ultrapassam o saldo atual da issue.',
      ],
    }),
    {},
    fetcher
  )
  expect(result.status).toBe(200)
  expect(posts).toHaveLength(1)
})
