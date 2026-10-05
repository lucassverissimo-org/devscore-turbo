import { handleOptions, jsonResponse, redirectResponse } from '../_shared/cors.ts'
import {
  HttpError,
  createSupabaseAdminClient,
  encryptSecret,
  getAtlassianClientId,
  getAtlassianClientSecret,
  getAtlassianRedirectUri,
  normalizeText,
} from '../_shared/jira.ts'

type OAuthStateRow = {
  state: string
  user_id: string
  return_to: string | null
  expires_at: string
}

type AccessibleResource = {
  id: string
  name?: string
  url?: string
  scopes?: string[]
}

function getFallbackReturnTo(): string {
  return Deno.env.get('APP_BASE_URL')?.trim() || 'http://localhost:5173'
}

function redirectWithResult(returnTo: string | null | undefined, status: 'connected' | 'error', message?: string): Response {
  const target = new URL(returnTo || getFallbackReturnTo())
  target.searchParams.set('jira', status)
  if (message) {
    target.searchParams.set('jira_message', message)
  }

  return redirectResponse(target.toString())
}

function selectJiraResource(resources: AccessibleResource[]): AccessibleResource | null {
  const preferredCloudId = Deno.env.get('ATLASSIAN_CLOUD_ID')?.trim()
  const preferredSiteUrl = Deno.env.get('ATLASSIAN_SITE_URL')?.trim()?.replace(/\/+$/, '')

  if (preferredCloudId) {
    const resource = resources.find(item => item.id === preferredCloudId)
    if (resource) return resource
  }

  if (preferredSiteUrl) {
    const resource = resources.find(item => item.url?.replace(/\/+$/, '') === preferredSiteUrl)
    if (resource) return resource
  }

  return resources.find(item =>
    Array.isArray(item.scopes) && item.scopes.some(scope => scope.includes('jira')),
  ) ?? resources[0] ?? null
}

Deno.serve(async req => {
  const optionsResponse = handleOptions(req)
  if (optionsResponse) return optionsResponse

  let stateRow: OAuthStateRow | null = null

  try {
    if (req.method !== 'GET') {
      throw new HttpError(405, 'Metodo nao permitido.')
    }

    const url = new URL(req.url)
    const state = normalizeText(url.searchParams.get('state'))
    const code = normalizeText(url.searchParams.get('code'))
    const oauthError = normalizeText(url.searchParams.get('error_description')) ||
      normalizeText(url.searchParams.get('error'))
    const supabaseAdmin = createSupabaseAdminClient()

    if (!state) {
      throw new HttpError(400, 'State OAuth ausente.')
    }

    const { data, error: stateError } = await supabaseAdmin
      .from('jira_oauth_states')
      .select('*')
      .eq('state', state)
      .maybeSingle()

    if (stateError) {
      throw new HttpError(500, 'Nao foi possivel validar a sessao OAuth.')
    }

    if (!data) {
      throw new HttpError(400, 'Sessao OAuth expirada ou invalida.')
    }

    stateRow = data as OAuthStateRow

    if (Date.parse(stateRow.expires_at) < Date.now()) {
      throw new HttpError(400, 'Sessao OAuth expirada. Tente conectar novamente.')
    }

    if (oauthError) {
      throw new HttpError(400, `Jira nao autorizou a conexao: ${oauthError}`)
    }

    if (!code) {
      throw new HttpError(400, 'Codigo OAuth ausente.')
    }

    const tokenResponse = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: getAtlassianClientId(),
        client_secret: getAtlassianClientSecret(),
        code,
        redirect_uri: getAtlassianRedirectUri(req),
      }),
    })

    if (!tokenResponse.ok) {
      throw new HttpError(502, 'Nao foi possivel trocar o codigo OAuth por token.')
    }

    const tokenData = await tokenResponse.json()
    if (typeof tokenData.access_token !== 'string' || typeof tokenData.refresh_token !== 'string') {
      throw new HttpError(502, 'Resposta OAuth sem tokens esperados.')
    }

    const resourcesResponse = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    })

    if (!resourcesResponse.ok) {
      throw new HttpError(502, 'Nao foi possivel identificar o site Jira autorizado.')
    }

    const resources = await resourcesResponse.json() as AccessibleResource[]
    const resource = selectJiraResource(Array.isArray(resources) ? resources : [])
    if (!resource?.id || !resource.url) {
      throw new HttpError(400, 'Nenhum site Jira foi autorizado para esta conta.')
    }

    let atlassianAccountId: string | null = null
    const meResponse = await fetch('https://api.atlassian.com/me', {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    })

    if (meResponse.ok) {
      const me = await meResponse.json()
      atlassianAccountId = typeof me.account_id === 'string' ? me.account_id : null
    }

    const accessTokenExpiresAt = new Date(
      Date.now() + Math.max(Number(tokenData.expires_in ?? 3600) - 60, 60) * 1000,
    ).toISOString()

    const { error: upsertError } = await supabaseAdmin
      .from('jira_connections')
      .upsert({
        user_id: stateRow.user_id,
        atlassian_account_id: atlassianAccountId,
        cloud_id: resource.id,
        site_url: resource.url.replace(/\/+$/, ''),
        site_name: resource.name ?? resource.url,
        scope: typeof tokenData.scope === 'string' ? tokenData.scope : '',
        encrypted_access_token: await encryptSecret(tokenData.access_token),
        access_token_expires_at: accessTokenExpiresAt,
        encrypted_refresh_token: await encryptSecret(tokenData.refresh_token),
        connected_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (upsertError) {
      throw new HttpError(500, 'Nao foi possivel salvar a conexao Jira.')
    }

    await supabaseAdmin
      .from('jira_oauth_states')
      .delete()
      .eq('state', state)

    return redirectWithResult(stateRow.return_to, 'connected', 'Jira conectado.')
  } catch (error) {
    const httpError = error instanceof HttpError
      ? error
      : new HttpError(500, 'Nao foi possivel concluir a conexao com Jira.')

    if (req.method === 'GET') {
      return redirectWithResult(stateRow?.return_to, 'error', httpError.message)
    }

    return jsonResponse(
      { error: httpError.message, details: httpError.details },
      httpError.status,
    )
  }
})
