import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

type Handler = (request: Request, env: NodeJS.ProcessEnv) => Promise<Response>

// Development-only adapter. The same backend handles Netlify and local Vite requests.
export async function serveJiraLocally(
  incoming: IncomingMessage,
  outgoing: ServerResponse,
  handle: Handler,
  env: NodeJS.ProcessEnv
) {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of incoming) {
    size += Buffer.byteLength(chunk)
    if (size > 250000) {
      outgoing.writeHead(413, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      })
      outgoing.end(JSON.stringify({ error: 'Requisição muito grande.' }))
      return
    }
    chunks.push(Buffer.from(chunk))
  }
  const headers = new Headers()
  for (const [key, value] of Object.entries(incoming.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(key, item))
    else if (value !== undefined) headers.set(key, value)
  }
  const method = incoming.method || 'GET'
  const request = new Request(
    `http://${incoming.headers.host || 'localhost'}/.netlify/functions/jira`,
    {
      method,
      headers,
      ...(!['GET', 'HEAD'].includes(method)
        ? { body: Buffer.concat(chunks).toString('utf8') }
        : {}),
    }
  )
  const response = await handle(request, env)
  outgoing.writeHead(
    response.status,
    Object.fromEntries(response.headers.entries())
  )
  outgoing.end(Buffer.from(await response.arrayBuffer()))
}

export function jiraLocalApi(env: NodeJS.ProcessEnv): Plugin {
  return {
    name: 'jira-local-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((incoming, outgoing, next) => {
        if (incoming.url?.split('?')[0] !== '/.netlify/functions/jira')
          return next()
        void (async () => {
          const module = await server.ssrLoadModule(
            '/netlify/functions/jira.mts'
          )
          await serveJiraLocally(
            incoming,
            outgoing,
            module.handle as Handler,
            env
          )
        })().catch(() => {
          if (!outgoing.headersSent)
            outgoing.writeHead(500, {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store',
            })
          outgoing.end(
            JSON.stringify({
              error:
                'Não foi possível iniciar a API Jira local. Confira o terminal do Vite.',
            })
          )
        })
      })
    },
  }
}
