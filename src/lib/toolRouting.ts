export function resolveToolPath(pathname: string, search: string): string {
  const path = pathname.replace(/\/$/, '') || '/'
  // Preserve legacy Jira OAuth callbacks previously handled by App at the root.
  return path === '/' && new URLSearchParams(search).has('jira')
    ? '/devscore'
    : path
}
