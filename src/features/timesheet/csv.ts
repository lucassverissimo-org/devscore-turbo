import type { Analysis, Entry, Period } from './types'
import { logicalDate } from './dates'
import { validateEntries } from './validation'
import { balance } from './distribution'
const headers = [
  'Data',
  'Issue Key',
  'Resumo',
  'Tipo',
  'Status',
  'Usuário',
  'Horas',
  'Duração em segundos',
  'Comentário',
  'Origem',
  'Existente',
  'Editado manualmente',
  'Status da validação',
  'Worklog ID',
  'Resultado',
  'Erro',
]
export function csvCell(value: unknown): string {
  let text = String(value ?? '')
  // Prevent Excel formula injection, including whitespace-prefixed payloads.
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}
export function exportCsv(
  analysis: Analysis,
  period: Period,
  entries: Entry[],
  stage: 'analysis' | 'review' | 'confirmation' | 'result'
): string {
  const validations = validateEntries(analysis, period, entries, true)
  const columns =
    stage === 'analysis'
      ? [
          ...headers,
          'Estimativa original (segundos)',
          'Apontado pelo usuário (segundos)',
          'Saldo (segundos)',
          'Excesso (segundos)',
        ]
      : headers
  const rows: unknown[][] = []
  if (stage === 'analysis') {
    for (const issue of analysis.issues) {
      const own = analysis.worklogs
        .filter(
          (log) =>
            log.issueKey === issue.key &&
            log.accountId === analysis.user.accountId
        )
        .reduce((sum, log) => sum + log.timeSpentSeconds, 0)
      const values = balance(issue)
      rows.push([
        '',
        issue.key,
        issue.summary,
        issue.issueType,
        issue.status,
        analysis.user.displayName,
        issue.timeSpentSeconds / 3600,
        issue.timeSpentSeconds,
        '',
        'análise: total global da issue',
        true,
        false,
        issue.originalEstimateSeconds ? 'INFO' : 'WARNING',
        '',
        '',
        '',
        issue.originalEstimateSeconds,
        own,
        values.balance,
        values.excess,
      ])
    }
  } else {
    for (const log of analysis.worklogs.filter(
      (log) =>
        !entries.some((entry) => entry.worklogId === log.id) &&
        log.accountId === analysis.user.accountId &&
        logicalDate(log.started, period.timezone) >= period.start &&
        logicalDate(log.started, period.timezone) <= period.end
    )) {
      const issue = analysis.issues.find((issue) => issue.key === log.issueKey)
      rows.push([
        logicalDate(log.started, period.timezone),
        log.issueKey,
        issue?.summary || '',
        issue?.issueType || '',
        issue?.status || '',
        analysis.user.displayName,
        log.timeSpentSeconds / 3600,
        log.timeSpentSeconds,
        log.comment,
        'existente',
        true,
        false,
        'INFO',
        log.id,
      ])
    }
    for (const entry of entries) {
      const issue = analysis.issues.find(
        (issue) => issue.key === entry.issueKey
      )
      rows.push([
        entry.date,
        entry.issueKey,
        issue?.summary || '',
        issue?.issueType || '',
        issue?.status || '',
        analysis.user.displayName,
        entry.seconds / 3600,
        entry.seconds,
        entry.comment,
        entry.origin,
        false,
        entry.edited,
        validations
          .filter((item) => !item.entryId || item.entryId === entry.id)
          .map((item) => `${item.level}: ${item.message}`)
          .join(' | ') || 'OK',
        entry.worklogId,
        entry.result,
        entry.error,
      ])
    }
  }
  return (
    '\uFEFF' +
    [
      columns.map(csvCell).join(','),
      ...rows.map((row) =>
        columns.map((_, index) => csvCell(row[index])).join(',')
      ),
    ].join('\r\n')
  )
}
