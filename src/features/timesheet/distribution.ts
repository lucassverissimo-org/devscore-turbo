import type { Entry, Issue, Period, Worklog } from './types'
import { logicalDate, periodDays, type CalendarPolicy } from './dates'
export function balance(issue: Issue) {
  const estimate = issue.originalEstimateSeconds || 0
  return {
    balance: Math.max(0, estimate - issue.timeSpentSeconds),
    excess: estimate ? Math.max(0, issue.timeSpentSeconds - estimate) : 0,
  }
}
export function dailyExisting(
  worklogs: Worklog[],
  accountId: string,
  timezone: string
): Record<string, number> {
  return worklogs
    .filter((log) => log.accountId === accountId)
    .reduce<Record<string, number>>((totals, log) => {
      const date = logicalDate(log.started, timezone)
      totals[date] = (totals[date] || 0) + log.timeSpentSeconds
      return totals
    }, {})
}
export function summarize(
  issues: Issue[],
  worklogs: Worklog[],
  accountId: string,
  period: Period,
  entries: Entry[],
  calendar?: CalendarPolicy
) {
  const days = periodDays(period, calendar)
  const existing = dailyExisting(worklogs, accountId, period.timezone)
  const theoretical = days.reduce((sum, day) => sum + day.capacity, 0)
  const registered = days.reduce(
    (sum, day) => sum + (existing[day.date] || 0),
    0
  )
  const available = days.reduce(
    (sum, day) => sum + Math.max(0, day.capacity - (existing[day.date] || 0)),
    0
  )
  const totalBalance = issues.reduce(
    (sum, issue) => sum + balance(issue).balance,
    0
  )
  const suggested = entries.reduce(
    (sum, entry) =>
      sum +
      (Number.isSafeInteger(entry.seconds) && entry.seconds > 0
        ? entry.seconds
        : 0),
    0
  )
  const undistributed = issues.reduce(
    (sum, issue) =>
      sum +
      Math.max(
        0,
        balance(issue).balance -
          entries
            .filter((entry) => entry.issueKey === issue.key)
            .reduce(
              (total, entry) => total + Math.max(0, entry.seconds || 0),
              0
            )
      ),
    0
  )
  return {
    days,
    existing,
    theoretical,
    registered,
    available,
    totalBalance,
    suggested,
    unallocated: Math.max(0, available - suggested),
    undistributed,
    withoutEstimate: issues.filter((issue) => !issue.originalEstimateSeconds)
      .length,
  }
}
export function distribute(
  issues: Issue[],
  worklogs: Worklog[],
  accountId: string,
  period: Period,
  calendar?: CalendarPolicy
) {
  const summary = summarize(issues, worklogs, accountId, period, [], calendar)
  const remaining = summary.days.map((day) => ({
    date: day.date,
    seconds: Math.max(0, day.capacity - (summary.existing[day.date] || 0)),
  }))
  const entries: Entry[] = []
  // Stable ordering and full blocks keep the suggestion deterministic and compact.
  for (const issue of [...issues].sort((a, b) =>
    a.key < b.key ? -1 : a.key > b.key ? 1 : 0
  )) {
    let seconds = balance(issue).balance
    for (const day of remaining) {
      const allocated = Math.min(seconds, day.seconds)
      if (allocated <= 0) continue
      entries.push({
        id: `auto-${issue.key}-${day.date}`,
        issueKey: issue.key,
        date: day.date,
        seconds: allocated,
        comment: '',
        origin: 'automatic',
        edited: false,
      })
      day.seconds -= allocated
      seconds -= allocated
      if (!seconds) break
    }
  }
  return {
    entries,
    ...summarize(issues, worklogs, accountId, period, entries, calendar),
    warnings: summary.withoutEstimate
      ? [
          'Issues sem estimativa original não entram na distribuição automática.',
        ]
      : [],
  }
}
