import { expect, it, vi } from 'vitest'
import { handle } from '../netlify/functions/jira.mts'

it.each(['cloud', 'data-center'] as const)(
  'lista boards e todas as páginas de Sprints no %s',
  async (deployment) => {
    const credentials = {
      deployment,
      baseUrl:
        deployment === 'cloud'
          ? 'https://example.atlassian.net'
          : 'https://agile.corp.edp.pt',
      email: 'test@example.com',
      token: 'dummy',
    }
    const fetcher = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input))
        const auth = new Headers(init?.headers).get('Authorization')
        expect(auth).toBe(
          deployment === 'cloud'
            ? `Basic ${Buffer.from('test@example.com:dummy').toString('base64')}`
            : 'Bearer dummy'
        )
        expect(init?.method).toBe('GET')
        const next = url.searchParams.get('startAt') === '1'
        if (url.pathname === '/rest/agile/1.0/board') {
          expect(url.searchParams.get('type')).toBe('scrum')
          return Response.json({
            isLast: next,
            values: [
              {
                id: next ? 2 : 1,
                name: next ? 'Alpha' : 'Zulu',
                type: 'scrum',
              },
            ],
          })
        }
        expect(url.pathname).toBe('/rest/agile/1.0/board/2/sprint')
        return Response.json({
          isLast: next,
          values: [
            {
              id: next ? 10 : 20,
              name: next ? 'Ativa' : 'Encerrada',
              state: next ? 'active' : 'closed',
            },
          ],
        })
      }
    )
    const send = (payload: object) =>
      handle(
        new Request('http://localhost/.netlify/functions/jira', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credentials, ...payload }),
        }),
        {},
        fetcher
      )
    const boards = await send({ action: 'boards' })
    expect(boards.status).toBe(200)
    expect(await boards.json()).toEqual([
      { id: 2, name: 'Alpha', type: 'scrum' },
      { id: 1, name: 'Zulu', type: 'scrum' },
    ])
    const sprints = await send({ action: 'sprints', boardId: 2 })
    expect(sprints.status).toBe(200)
    expect(await sprints.json()).toEqual([
      { id: 10, name: 'Ativa', state: 'active' },
      { id: 20, name: 'Encerrada', state: 'closed' },
    ])
    expect(fetcher).toHaveBeenCalledTimes(4)
    fetcher.mockClear()
    expect(
      (await send({ action: 'sprints', boardId: '../other' })).status
    ).toBe(400)
    expect(fetcher).not.toHaveBeenCalled()
  }
)
