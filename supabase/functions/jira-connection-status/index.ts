import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import {
  HttpError,
  createSupabaseAdminClient,
  getAuthorizedUser,
  getJiraConnection,
} from '../_shared/jira.ts'

Deno.serve(async req => {
  const optionsResponse = handleOptions(req)
  if (optionsResponse) return optionsResponse

  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
      throw new HttpError(405, 'Metodo nao permitido.')
    }

    const supabaseAdmin = createSupabaseAdminClient()
    const user = await getAuthorizedUser(req, supabaseAdmin)
    const connection = await getJiraConnection(supabaseAdmin, user.id).catch(error => {
      if (error instanceof HttpError && error.status === 409) return null
      throw error
    })

    if (!connection) {
      return jsonResponse({ connected: false })
    }

    return jsonResponse({
      connected: true,
      authMode: connection.authMode,
      serviceConnection: connection.serviceConnection,
      canDisconnect: connection.authMode !== 'data-center-pat',
      cloudId: connection.cloud_id,
      siteUrl: connection.site_url,
      siteName: connection.site_name,
      scope: connection.scope,
      accessTokenExpiresAt: connection.access_token_expires_at,
      connectedAt: connection.connected_at,
      updatedAt: connection.updated_at,
    })
  } catch (error) {
    const httpError = error instanceof HttpError
      ? error
      : new HttpError(500, 'Nao foi possivel carregar o status da conexao Jira.')

    return jsonResponse(
      { error: httpError.message, details: httpError.details },
      httpError.status,
    )
  }
})
