import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import {
  HttpError,
  createSupabaseAdminClient,
  getAtlassianClientId,
  getAtlassianRedirectUri,
  getAtlassianScopes,
  getAuthorizedUser,
  normalizeText,
} from '../_shared/jira.ts'

function getSafeReturnTo(value: unknown): string | null {
  const returnTo = normalizeText(value)
  if (!returnTo) return null

  const appBaseUrl = Deno.env.get('APP_BASE_URL')?.trim()
  let parsedReturnTo: URL
  try {
    parsedReturnTo = new URL(returnTo)
  } catch {
    return appBaseUrl ?? null
  }

  if (appBaseUrl) {
    const parsedAppBaseUrl = new URL(appBaseUrl)
    return parsedReturnTo.origin === parsedAppBaseUrl.origin ? parsedReturnTo.toString() : appBaseUrl
  }

  return ['localhost', '127.0.0.1'].includes(parsedReturnTo.hostname)
    ? parsedReturnTo.toString()
    : null
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
    const body = await req.json().catch(() => ({}))
    const returnTo = getSafeReturnTo(body.returnTo)
    const state = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    await supabaseAdmin
      .from('jira_oauth_states')
      .delete()
      .lt('expires_at', new Date().toISOString())

    const { error } = await supabaseAdmin
      .from('jira_oauth_states')
      .insert({
        state,
        user_id: user.id,
        return_to: returnTo,
        expires_at: expiresAt,
      })

    if (error) {
      throw new HttpError(500, 'Nao foi possivel iniciar a conexao com Jira.')
    }

    const authorizeUrl = new URL('https://auth.atlassian.com/authorize')
    authorizeUrl.searchParams.set('audience', 'api.atlassian.com')
    authorizeUrl.searchParams.set('client_id', getAtlassianClientId())
    authorizeUrl.searchParams.set('scope', getAtlassianScopes())
    authorizeUrl.searchParams.set('redirect_uri', getAtlassianRedirectUri(req))
    authorizeUrl.searchParams.set('state', state)
    authorizeUrl.searchParams.set('response_type', 'code')
    authorizeUrl.searchParams.set('prompt', 'consent')

    return jsonResponse({ authorizationUrl: authorizeUrl.toString(), expiresAt })
  } catch (error) {
    const httpError = error instanceof HttpError
      ? error
      : new HttpError(500, 'Nao foi possivel iniciar a conexao com Jira.')

    return jsonResponse(
      { error: httpError.message, details: httpError.details },
      httpError.status,
    )
  }
})
