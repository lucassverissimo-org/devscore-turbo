import { createClient } from 'npm:@supabase/supabase-js@2.51.0'

export type JiraConnectionRow = {
  user_id: string
  authMode?: 'cloud-oauth' | 'data-center-pat'
  serviceConnection?: boolean
  atlassian_account_id: string | null
  cloud_id: string
  site_url: string
  site_name: string | null
  scope: string
  encrypted_access_token: string | null
  access_token_expires_at: string | null
  encrypted_refresh_token: string
  connected_at: string
  updated_at: string
}

export type AuthorizedUser = {
  id: string
  email: string
  role: 'SCRUM' | 'ADMIN'
}

export class HttpError extends Error {
  status: number
  details?: Record<string, unknown>

  constructor(status: number, message: string, details?: Record<string, unknown>) {
    super(message)
    this.status = status
    this.details = details
  }
}

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim()
  if (!value) {
    throw new HttpError(500, `Variavel de ambiente obrigatoria ausente: ${name}`)
  }

  return value
}

export function getAtlassianClientId(): string {
  return getRequiredEnv('ATLASSIAN_CLIENT_ID')
}

export function getAtlassianClientSecret(): string {
  return getRequiredEnv('ATLASSIAN_CLIENT_SECRET')
}

export function getAtlassianRedirectUri(req: Request, callbackFunctionName = 'jira-oauth-callback'): string {
  const configured = Deno.env.get('ATLASSIAN_REDIRECT_URI')?.trim()
  if (configured) return configured

  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  segments[segments.length - 1] = callbackFunctionName
  url.pathname = segments.join('/')
  url.search = ''
  return url.toString()
}

export function getDefaultAtlassianScopes(): string {
  return [
    'offline_access',
    'read:me',
    'read:jira-user',
    'read:jira-work',
    'read:sprint:jira-software',
    'read:issue-details:jira',
    'read:jql:jira',
    'read:board-scope:jira-software',
    'read:project:jira',
  ].join(' ')
}

export function getAtlassianScopes(): string {
  return Deno.env.get('ATLASSIAN_OAUTH_SCOPES')?.trim() || getDefaultAtlassianScopes()
}

export function isJiraDataCenterPatConfigured(): boolean {
  return Boolean(Deno.env.get('JIRA_BASE_URL')?.trim() && Deno.env.get('JIRA_PAT')?.trim())
}

export function getJiraDataCenterBaseUrl(): string {
  return getRequiredEnv('JIRA_BASE_URL').replace(/\/+$/, '')
}

export function getJiraDataCenterCacheId(): string {
  return `data-center:${getJiraDataCenterBaseUrl()}`
}

export function createSupabaseAdminClient() {
  const supabaseUrl = getRequiredEnv('SUPABASE_URL')
  const serviceRoleKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ||
    Deno.env.get('SUPABASE_SERVICE_KEY')?.trim()

  if (!serviceRoleKey) {
    throw new HttpError(500, 'Variavel de ambiente obrigatoria ausente: SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function parseBearerToken(req: Request): string {
  const authorization = req.headers.get('Authorization') ?? ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  if (!match?.[1]) {
    throw new HttpError(401, 'Sessao Supabase ausente.')
  }

  return match[1]
}

export async function getAuthorizedUser(req: Request, supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>): Promise<AuthorizedUser> {
  const token = parseBearerToken(req)
  const { data, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !data.user) {
    throw new HttpError(401, 'Sessao Supabase invalida.')
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .select('role,email')
    .eq('id', data.user.id)
    .maybeSingle()

  if (profileError) {
    throw new HttpError(500, 'Nao foi possivel validar o perfil do usuario.')
  }

  const role = profile?.role
  if (role !== 'SCRUM' && role !== 'ADMIN') {
    throw new HttpError(403, 'Somente usuarios SCRUM ou ADMIN podem usar a integracao com Jira.')
  }

  return {
    id: data.user.id,
    email: profile?.email ?? data.user.email ?? '',
    role,
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const secret = getRequiredEnv('JIRA_TOKEN_ENCRYPTION_KEY')
  if (secret.length < 32) {
    throw new HttpError(500, 'JIRA_TOKEN_ENCRYPTION_KEY deve ter pelo menos 32 caracteres.')
  }

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptSecret(value: string): Promise<string> {
  const key = await getEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(value),
  )

  return `v1.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`
}

export async function decryptSecret(value: string): Promise<string> {
  const [version, ivBase64, encryptedBase64] = value.split('.')
  if (version !== 'v1' || !ivBase64 || !encryptedBase64) {
    throw new HttpError(500, 'Formato de segredo criptografado invalido.')
  }

  const key = await getEncryptionKey()
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(ivBase64) },
    key,
    base64ToBytes(encryptedBase64),
  )

  return new TextDecoder().decode(decrypted)
}

export function buildJiraApiUrl(connection: JiraConnectionRow, apiPath: string): string {
  const normalizedPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`
  if (connection.authMode === 'data-center-pat') {
    return `${connection.site_url}${normalizedPath}`
  }

  return `https://api.atlassian.com/ex/jira/${connection.cloud_id}${normalizedPath}`
}

export async function getJiraConnection(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
): Promise<JiraConnectionRow> {
  if (isJiraDataCenterPatConfigured()) {
    const siteUrl = getJiraDataCenterBaseUrl()
    return {
      user_id: userId,
      authMode: 'data-center-pat',
      serviceConnection: true,
      atlassian_account_id: null,
      cloud_id: getJiraDataCenterCacheId(),
      site_url: siteUrl,
      site_name: Deno.env.get('JIRA_SITE_NAME')?.trim() || 'Jira Data Center',
      scope: 'pat',
      encrypted_access_token: null,
      access_token_expires_at: null,
      encrypted_refresh_token: '',
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  const { data, error } = await supabaseAdmin
    .from('jira_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new HttpError(500, 'Nao foi possivel carregar a conexao com Jira.')
  }

  if (!data) {
    throw new HttpError(409, 'Configure JIRA_BASE_URL/JIRA_PAT ou conecte sua conta Jira antes de importar a sprint.')
  }

  return {
    ...(data as JiraConnectionRow),
    authMode: 'cloud-oauth',
    serviceConnection: false,
  }
}

export async function getValidJiraAccessToken(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  connection: JiraConnectionRow,
): Promise<string> {
  if (connection.authMode === 'data-center-pat') {
    return getRequiredEnv('JIRA_PAT')
  }

  const expiresAt = connection.access_token_expires_at
    ? Date.parse(connection.access_token_expires_at)
    : 0

  if (connection.encrypted_access_token && expiresAt > Date.now() + 60_000) {
    return decryptSecret(connection.encrypted_access_token)
  }

  const refreshToken = await decryptSecret(connection.encrypted_refresh_token)
  const response = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: getAtlassianClientId(),
      client_secret: getAtlassianClientSecret(),
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    throw new HttpError(401, 'A autorizacao Jira expirou. Conecte o Jira novamente.')
  }

  const tokenData = await response.json()
  if (typeof tokenData.access_token !== 'string') {
    throw new HttpError(502, 'Resposta invalida do OAuth Atlassian.')
  }

  const encryptedAccessToken = await encryptSecret(tokenData.access_token)
  const encryptedRefreshToken = typeof tokenData.refresh_token === 'string'
    ? await encryptSecret(tokenData.refresh_token)
    : connection.encrypted_refresh_token
  const accessTokenExpiresAt = new Date(
    Date.now() + Math.max(Number(tokenData.expires_in ?? 3600) - 60, 60) * 1000,
  ).toISOString()

  await supabaseAdmin
    .from('jira_connections')
    .update({
      encrypted_access_token: encryptedAccessToken,
      encrypted_refresh_token: encryptedRefreshToken,
      access_token_expires_at: accessTokenExpiresAt,
      scope: typeof tokenData.scope === 'string' ? tokenData.scope : connection.scope,
    })
    .eq('user_id', connection.user_id)

  return tokenData.access_token
}

export async function jiraFetchWithBackoff(
  url: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<Response> {
  let delayMs = 1000
  let lastResponse: Response | null = null

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const headers = new Headers(init.headers)
    headers.set('Accept', headers.get('Accept') ?? 'application/json')
    headers.set('Authorization', `Bearer ${accessToken}`)

    const response = await fetch(url, {
      ...init,
      headers,
    })

    if (response.status !== 429 && response.status !== 503) {
      return response
    }

    lastResponse = response
    const retryAfter = Number(response.headers.get('Retry-After') ?? '')
    if (Number.isFinite(retryAfter) && retryAfter > 15) {
      throw new HttpError(429, `Jira pediu para aguardar ${retryAfter} segundos antes de tentar novamente.`, {
        retryAfter,
      })
    }

    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : delayMs
    const jitterMs = Math.floor(Math.random() * 250)
    await new Promise(resolve => setTimeout(resolve, Math.min(waitMs + jitterMs, 15_000)))
    delayMs = Math.min(delayMs * 2, 8000)
  }

  const headers = new Headers(init.headers)
  headers.set('Accept', headers.get('Accept') ?? 'application/json')
  headers.set('Authorization', `Bearer ${accessToken}`)

  return lastResponse ?? fetch(url, {
    ...init,
    headers,
  })
}

export function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizePositiveInteger(value: unknown): number | null {
  const numberValue = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value.trim())
      : NaN

  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null
}
