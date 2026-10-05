import type { Analysis, Entry, Period, Validation } from './types'
import { balance, dailyExisting } from './distribution'
import { logicalDate, periodDays, validDate } from './dates'
export function validateEntries(
  analysis: Analysis,
  period: Period,
  entries: Entry[],
  registering = false
): Validation[] {
  const messages: Validation[] = []
  const add = (level: Validation['level'], message: string, entryId?: string) =>
    messages.push({ level, message, entryId })
  try {
    periodDays(period)
  } catch (error) {
    add('ERROR', error instanceof Error ? error.message : 'Período inválido.')
    return messages
  }
  if (
    registering &&
    analysis.user.accountId !== analysis.authenticatedUser.accountId
  )
    add(
      'ERROR',
      'Você está analisando outro usuário. Para registrar worklogs, conecte-se utilizando a conta Jira desse usuário.'
    )
  const existing = dailyExisting(
    analysis.worklogs,
    analysis.user.accountId,
    period.timezone
  )
  const totalsIssue: Record<string, number> = {}
  const totalsDay: Record<string, number> = {}
  for (const entry of entries) {
    if (entry.worklogId) {
      add('INFO', 'Worklog já registrado nesta sessão.', entry.id)
      continue
    }
    if (entry.result === 'uncertain')
      add(
        'ERROR',
        'Resultado incerto: confira no Jira antes de liberar uma nova tentativa.',
        entry.id
      )
    if (
      !Number.isSafeInteger(entry.seconds) ||
      entry.seconds <= 0 ||
      entry.seconds > 86400
    )
      add(
        'ERROR',
        'Duração deve conter segundos inteiros, maior que zero e até 24h.',
        entry.id
      )
    if (!validDate(entry.date)) add('ERROR', 'Data inválida.', entry.id)
    else if (entry.date < period.start || entry.date > period.end)
      add('ERROR', 'Data fora do período.', entry.id)
    const issue = analysis.issues.find((issue) => issue.key === entry.issueKey)
    if (!issue)
      add(
        'ERROR',
        'Issue inexistente ou não atribuída ao usuário nesta Sprint.',
        entry.id
      )
    if (issue && !issue.originalEstimateSeconds)
      add('WARNING', 'Sem estimativa original: lançamento manual.', entry.id)
    if (entry.comment.length > 10000)
      add('ERROR', 'Comentário excede 10.000 caracteres.', entry.id)
    if (
      analysis.worklogs.some(
        (log) =>
          log.issueKey === entry.issueKey &&
          log.accountId === analysis.user.accountId &&
          logicalDate(log.started, period.timezone) === entry.date &&
          log.timeSpentSeconds === entry.seconds
      )
    )
      add(
        'ERROR',
        'Possível duplicidade com worklog existente. Remova ou revise explicitamente esse lançamento.',
        entry.id
      )
    if (
      entries.some(
        (other) =>
          other.id !== entry.id &&
          !other.worklogId &&
          other.issueKey === entry.issueKey &&
          other.date === entry.date &&
          other.seconds === entry.seconds
      )
    )
      add(
        'ERROR',
        'Possível duplicidade entre os lançamentos. Revise ou remova.',
        entry.id
      )
    totalsIssue[entry.issueKey] =
      (totalsIssue[entry.issueKey] || 0) + Math.max(0, entry.seconds || 0)
    totalsDay[entry.date] =
      (totalsDay[entry.date] || 0) + Math.max(0, entry.seconds || 0)
  }
  for (const entry of entries.filter((entry) => !entry.worklogId)) {
    const issue = analysis.issues.find((issue) => issue.key === entry.issueKey)
    if (
      issue?.originalEstimateSeconds &&
      totalsIssue[entry.issueKey] > balance(issue).balance
    )
      add(
        entry.origin === 'automatic' && !entry.edited ? 'ERROR' : 'WARNING',
        'Lançamentos ultrapassam o saldo atual da issue.',
        entry.id
      )
    const day = periodDays(period).find((day) => day.date === entry.date)
    if (
      day &&
      totalsDay[entry.date] + (existing[entry.date] || 0) > day.capacity
    )
      add(
        entry.origin === 'automatic' && !entry.edited ? 'ERROR' : 'WARNING',
        'Lançamentos ultrapassam a capacidade diária (inclui dias não úteis).',
        entry.id
      )
  }
  return messages
}
