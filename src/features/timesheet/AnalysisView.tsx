import React from 'react'
import type { Analysis, Period } from './types'
import { balance, summarize } from './distribution'
import { duration, displayDate } from './dates'
import { panelClass } from './ui'
export default function AnalysisView({
  analysis,
  period,
  entries,
}: {
  analysis: Analysis
  period: Period
  entries: Parameters<typeof summarize>[4]
}) {
  const stats = summarize(
    analysis.issues,
    analysis.worklogs,
    analysis.user.accountId,
    period,
    entries
  )
  const values: Array<[string, string]> = [
    ['Sprint', `${analysis.sprint.id} — ${analysis.sprint.name}`],
    ['Usuário', analysis.user.displayName],
    ['Período', `${displayDate(period.start)} até ${displayDate(period.end)}`],
    ['Dias úteis', String(stats.days.filter((day) => day.capacity > 0).length)],
    ['Jornada diária', duration(period.dailySeconds)],
    ['Capacidade teórica', duration(stats.theoretical)],
    ['Horas já registradas', duration(stats.registered)],
    ['Capacidade disponível', duration(stats.available)],
    [
      'Total estimado',
      duration(
        analysis.issues.reduce(
          (sum, issue) => sum + (issue.originalEstimateSeconds || 0),
          0
        )
      ),
    ],
    [
      'Total apontado nas issues',
      duration(
        analysis.issues.reduce((sum, issue) => sum + issue.timeSpentSeconds, 0)
      ),
    ],
    ['Saldo das issues', duration(stats.totalBalance)],
    ['Horas sugeridas', duration(stats.suggested)],
    ['Horas não alocadas', duration(stats.unallocated)],
    ['Saldo não distribuído', duration(stats.undistributed)],
    ['Issues sem estimativa', String(stats.withoutEstimate)],
  ]
  return (
    <section className={panelClass}>
      <h2 className="text-lg font-semibold">Análise da Sprint</h2>
      <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {values.map(([label, value]) => (
          <div key={label} className="rounded bg-gray-50 dark:bg-gray-900 p-3">
            <dt className="text-xs text-gray-500 dark:text-gray-400">
              {label}
            </dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="text-left py-2">
            Issues atribuídas ao usuário na Sprint inteira
          </caption>
          <thead>
            <tr>
              {[
                'Issue',
                'Resumo',
                'Tipo',
                'Status',
                'Estimativa',
                'Apontado total',
                'Apontado pelo usuário',
                'Saldo',
                'Sugestão',
                'Situação',
              ].map((label) => (
                <th key={label} className="text-left p-2 whitespace-nowrap">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {analysis.issues.map((issue) => {
              const values = balance(issue)
              const own = analysis.worklogs
                .filter(
                  (log) =>
                    log.issueKey === issue.key &&
                    log.accountId === analysis.user.accountId
                )
                .reduce((sum, log) => sum + log.timeSpentSeconds, 0)
              const suggested = entries
                .filter((entry) => entry.issueKey === issue.key)
                .reduce(
                  (sum, entry) => sum + Math.max(0, entry.seconds || 0),
                  0
                )
              return (
                <tr
                  key={issue.key}
                  className="border-t border-gray-200 dark:border-gray-700"
                >
                  <td className="p-2 whitespace-nowrap">
                    <a
                      className="text-green-700 dark:text-green-300 underline"
                      href={`${analysis.baseUrl}/browse/${encodeURIComponent(issue.key)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {issue.key}
                    </a>
                    {issue.parent && (
                      <small className="block">Pai: {issue.parent}</small>
                    )}
                  </td>
                  <td className="p-2 min-w-[200px]">{issue.summary}</td>
                  <td className="p-2">{issue.issueType}</td>
                  <td className="p-2">{issue.status}</td>
                  <td className="p-2">
                    {duration(issue.originalEstimateSeconds || 0)}
                  </td>
                  <td className="p-2">{duration(issue.timeSpentSeconds)}</td>
                  <td className="p-2">{duration(own)}</td>
                  <td className="p-2">{duration(values.balance)}</td>
                  <td className="p-2">{duration(suggested)}</td>
                  <td className="p-2">
                    {!issue.originalEstimateSeconds
                      ? 'Sem estimativa original'
                      : values.excess
                        ? `${duration(values.excess)} acima da estimativa`
                        : values.balance
                          ? 'Com saldo'
                          : 'Sem saldo'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!analysis.issues.length && (
          <p className="py-4">
            Nenhuma issue atribuída a esse usuário na Sprint.
          </p>
        )}
      </div>
    </section>
  )
}
