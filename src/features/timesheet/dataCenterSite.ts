export function dataCenterSiteUrl(value: string): string {
  const url = new URL(value.trim())
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      'Use a URL HTTPS do Jira Data Center, sem credenciais, consulta ou fragmento.'
    )
  return url.href.replace(/\/+$/, '')
}
