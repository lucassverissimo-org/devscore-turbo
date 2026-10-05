import { afterEach, expect, it, vi } from 'vitest'
import { jiraRequest } from '../src/features/timesheet/api'
afterEach(() => vi.unstubAllGlobals())
it('envia a escolha Data Center e PAT para a Function', async () => {
  const transport = vi.fn<typeof fetch>(async () =>
    Response.json({ user: { accountId: 'key', displayName: 'Lucas' } })
  )
  vi.stubGlobal('fetch', transport)
  await jiraRequest('test', {
    deployment: 'data-center',
    baseUrl: 'https://agile.corp.edp.pt',
    email: '',
    token: 'dummy',
  })
  expect(JSON.parse(String(transport.mock.calls[0][1]?.body))).toMatchObject({
    deployment: 'data-center',
    credentials: { token: 'dummy', email: '' },
  })
})
it('recusa o Jira corporativo antes de enviar as credenciais', async () => {
  const transport = vi.fn()
  vi.stubGlobal('fetch', transport)
  await expect(
    jiraRequest('test', {
      baseUrl: 'https://agile.corp.edp.pt',
      email: 'test@example.com',
      token: 'dummy',
    })
  ).rejects.toThrow('somente Jira Cloud')
  expect(transport).not.toHaveBeenCalled()
})
it('inclui o status HTTP sem expor o corpo de uma falha da Function', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('private diagnostic', { status: 502 }))
  )
  await expect(
    jiraRequest('test', {
      baseUrl: 'https://example.atlassian.net',
      email: 'test@example.com',
      token: 'dummy',
    })
  ).rejects.toThrow('HTTP 502')
})
