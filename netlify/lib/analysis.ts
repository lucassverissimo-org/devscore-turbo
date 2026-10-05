import type {
  Analysis,
  JiraUser,
  Period,
} from '../../src/features/timesheet/types'
import { dates, periodDays } from '../../src/features/timesheet/dates'
import { JiraClient, JiraError, safeText } from './jira'
export function account(value: unknown): string {
  const id = safeText(value, 'accountId')
  if (!/^[a-zA-Z0-9:_.@-]+$/.test(id))
    throw new JiraError(400, 'accountId inválido.')
  return id
}
export async function analyze(
  client: JiraClient,
  sprintId: number,
  user: JiraUser,
  period: Period
): Promise<Analysis> {
  const authenticatedUser = await client.myself()
  const sprint = await client.sprint(sprintId)
  periodDays(period)
  const id = account(user.accountId)
  const selected = await client.user(id)
  const jqlUser = client.jqlUser(selected)
  const listed = await client.search(
    `sprint = ${sprintId} AND assignee = "${jqlUser}" ORDER BY key ASC`
  )
  const issues = [] as typeof listed
  for (const item of listed) {
    const latest = await client.issue(item.key)
    if (latest.assignee?.accountId === id) issues.push(latest)
  }
  const warnings: string[] = []
  // Broaden JQL by one day on each side because JQL dates use the Jira profile timezone.
  const paddedStart = dates(
    new Date(Date.parse(period.start) - 86400000).toISOString().slice(0, 10),
    period.start
  )[0]
  const paddedEnd = new Date(Date.parse(period.end) + 86400000)
    .toISOString()
    .slice(0, 10)
  let otherIssues = [] as typeof issues
  try {
    otherIssues = await client.search(
      `worklogAuthor = "${jqlUser}" AND worklogDate >= "${paddedStart}" AND worklogDate <= "${paddedEnd}" ORDER BY key ASC`
    )
  } catch (error) {
    if (!(error instanceof JiraError) || ![400, 403].includes(error.status))
      throw error
    warnings.push(
      'Busca de worklogs fora da Sprint indisponível. A capacidade é uma aproximação baseada apenas nas issues da Sprint.'
    )
  }
  const keys = [
    ...new Set([...issues, ...otherIssues].map((issue) => issue.key)),
  ]
  const worklogs = [] as Analysis['worklogs']
  for (const key of keys) worklogs.push(...(await client.worklogs(key)))
  return {
    sprint,
    user: selected,
    authenticatedUser,
    issues,
    worklogs,
    timezone: period.timezone,
    baseUrl: client.config.baseUrl,
    warnings,
  }
}
