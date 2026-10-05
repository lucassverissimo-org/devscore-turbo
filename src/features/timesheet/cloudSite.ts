export function cloudSiteUrl(value: string): string {
  const message =
    'O modo Cloud suporta somente Jira Cloud. Use https://seu-site.atlassian.net. Para o Jira corporativo, selecione Jira Data Center (PAT).'
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(message)
  }
  if (
    url.protocol !== 'https:' ||
    !/^[a-z0-9][a-z0-9-]*\.atlassian\.net$/i.test(url.hostname) ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !['', '/'].includes(url.pathname)
  )
    throw new Error(message)
  return url.origin
}
