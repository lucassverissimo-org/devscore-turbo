import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { expect, it } from 'vitest'
import { serveJiraLocally } from '../scripts/jira-local-api'
import { handle } from '../netlify/functions/jira.mts'

it('a API local recebe POST e aplica as mesmas proteções da Function', async () => {
  const server = createServer((incoming, outgoing) => {
    void serveJiraLocally(incoming, outgoing, handle, {}).catch(() => {
      outgoing.statusCode = 500
      outgoing.end()
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/.netlify/functions/jira`
  try {
    expect((await fetch(url)).status).toBe(405)
    const payload = {
      action: 'test',
      deployment: 'data-center',
      credentials: {
        baseUrl: 'https://untrusted.example',
        token: 'private-dummy',
        email: '',
      },
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: new URL(url).origin,
      },
      body: JSON.stringify(payload),
    })
    expect(response.status).toBe(403)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.text()).not.toContain('private-dummy')
    const csrf = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://external.example',
      },
      body: JSON.stringify(payload),
    })
    expect(csrf.status).toBe(403)
    const large = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'x'.repeat(250001),
    })
    expect(large.status).toBe(413)
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  }
})
