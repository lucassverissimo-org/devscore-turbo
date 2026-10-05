import type { JiraConnectionStatus, JiraSprintImportParams, JiraSprintImportResult } from '../types'
import { supabase } from './supabase'

type FunctionError = {
  message?: string
  context?: Response
}

async function normalizeFunctionError(error: unknown, fallback: string): Promise<string> {
  const functionError = error as FunctionError | null
  const response = functionError?.context

  if (response && typeof response.json === 'function') {
    try {
      const payload = await response.json()
      if (payload && typeof payload.error === 'string') {
        return payload.error
      }
    } catch {
      // Keep the original Supabase error below.
    }
  }

  return functionError?.message || fallback
}

export async function getJiraConnectionStatus(): Promise<{
  status: JiraConnectionStatus | null
  error?: string
}> {
  if (!supabase) return { status: null, error: 'Supabase indisponivel.' }

  const { data, error } = await supabase.functions.invoke('jira-connection-status')
  if (error) {
    return {
      status: null,
      error: await normalizeFunctionError(error, 'Nao foi possivel carregar o status do Jira.'),
    }
  }

  return { status: data as JiraConnectionStatus }
}

export async function startJiraOAuthConnection(returnTo: string): Promise<{
  authorizationUrl?: string
  error?: string
}> {
  if (!supabase) return { error: 'Supabase indisponivel.' }

  const { data, error } = await supabase.functions.invoke('jira-oauth-start', {
    body: { returnTo },
  })

  if (error) {
    return {
      error: await normalizeFunctionError(error, 'Nao foi possivel iniciar a conexao com Jira.'),
    }
  }

  const authorizationUrl = typeof data?.authorizationUrl === 'string' ? data.authorizationUrl : ''
  return authorizationUrl
    ? { authorizationUrl }
    : { error: 'Resposta invalida ao iniciar a conexao com Jira.' }
}

export async function disconnectJira(): Promise<{ error?: string }> {
  if (!supabase) return { error: 'Supabase indisponivel.' }

  const { error } = await supabase.functions.invoke('jira-disconnect')
  if (error) {
    return {
      error: await normalizeFunctionError(error, 'Nao foi possivel desconectar o Jira.'),
    }
  }

  return {}
}

export async function importJiraSprint(params: JiraSprintImportParams): Promise<{
  result: JiraSprintImportResult | null
  error?: string
}> {
  if (!supabase) return { result: null, error: 'Supabase indisponivel.' }

  const { data, error } = await supabase.functions.invoke('jira-import-sprint', {
    body: params,
  })

  if (error) {
    return {
      result: null,
      error: await normalizeFunctionError(error, 'Nao foi possivel importar a sprint do Jira.'),
    }
  }

  return { result: data as JiraSprintImportResult }
}
