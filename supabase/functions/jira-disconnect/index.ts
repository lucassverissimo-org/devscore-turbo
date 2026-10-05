import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import {
  HttpError,
  createSupabaseAdminClient,
  getAuthorizedUser,
} from '../_shared/jira.ts'

Deno.serve(async req => {
  const optionsResponse = handleOptions(req)
  if (optionsResponse) return optionsResponse

  try {
    if (req.method !== 'POST') {
      throw new HttpError(405, 'Metodo nao permitido.')
    }

    const supabaseAdmin = createSupabaseAdminClient()
    const user = await getAuthorizedUser(req, supabaseAdmin)

    const { error: cacheError } = await supabaseAdmin
      .from('jira_sprint_cache')
      .delete()
      .eq('user_id', user.id)

    if (cacheError) {
      throw new HttpError(500, 'Nao foi possivel limpar o cache Jira.')
    }

    const { error } = await supabaseAdmin
      .from('jira_connections')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      throw new HttpError(500, 'Nao foi possivel desconectar o Jira.')
    }

    return jsonResponse({ disconnected: true })
  } catch (error) {
    const httpError = error instanceof HttpError
      ? error
      : new HttpError(500, 'Nao foi possivel desconectar o Jira.')

    return jsonResponse(
      { error: httpError.message, details: httpError.details },
      httpError.status,
    )
  }
})
