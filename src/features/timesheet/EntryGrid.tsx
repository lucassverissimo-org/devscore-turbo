import React from 'react'

import { Trash2 } from 'lucide-react'

import type { Analysis, Entry, Period, Validation } from './types'

import { dailyExisting } from './distribution'

import {
  displayDate,
  duration,
  EDIT_INCREMENT_SECONDS,
  logicalDate,
} from './dates'

import { Button, inputClass, panelClass } from './ui'

export default function EntryGrid({
  analysis,

  period,

  entries,

  validations,

  locked,

  update,

  remove,

  add,

  undo,

  canUndo,

  checkedUncertain,
}: {
  analysis: Analysis

  period: Period

  entries: Entry[]

  validations: Validation[]

  locked: boolean

  update: (id: string, patch: Partial<Entry>) => void

  remove: (id: string) => void

  add: () => void

  undo: () => void

  canUndo: boolean

  checkedUncertain: (id: string) => void
}) {
  const existing = dailyExisting(
    analysis.worklogs,

    analysis.user.accountId,

    period.timezone
  )

  const totals: Record<string, number> = {}

  for (const entry of entries.filter((entry) => !entry.worklogId))
    totals[entry.date] =
      (totals[entry.date] || 0) + Math.max(0, entry.seconds || 0)

  const logs = analysis.worklogs.filter(
    (log) =>
      !entries.some((entry) => entry.worklogId === log.id) &&
      log.accountId === analysis.user.accountId &&
      logicalDate(log.started, period.timezone) >= period.start &&
      logicalDate(log.started, period.timezone) <= period.end
  )

  return (
    <section className={panelClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Grade de lançamentos</h2>

        <div className="flex gap-2">
          <Button onClick={add} disabled={locked || !analysis.issues.length}>
            Adicionar lançamento
          </Button>

          <Button disabled={locked || !canUndo} onClick={undo}>
            Desfazer alteração
          </Button>
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Duração em horas decimais: 0.5 = 30 minutos, 0.75 = 45 minutos, 1.25 =
        1h15 e 1.5 = 1h30. Valores digitados são mantidos; os avisos aparecem
        abaixo de cada item.
      </p>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Total no dia = horas já apontadas pela sua conta + todos os lançamentos
        da grade nessa data, em todas as tasks.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {[
                'Data',

                'Issue / Resumo',

                'Existente no dia',

                'Horas a registrar',

                'Total no dia',

                'Comentário',

                'Status / Worklog ID',

                'Ações',
              ].map((label) => (
                <th key={label} className="p-2 text-left whitespace-nowrap">
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {logs.map((log) => (
              <tr
                key={`existing-${log.id}`}
                className="border-t border-gray-200 dark:border-gray-700 opacity-75"
              >
                <td className="p-2 whitespace-nowrap">
                  {displayDate(logicalDate(log.started, period.timezone))}
                </td>

                <td className="p-2">
                  {log.issueKey}

                  <small className="block">
                    {analysis.issues.find((issue) => issue.key === log.issueKey)
                      ?.summary || 'Issue fora da Sprint'}
                  </small>
                </td>

                <td className="p-2">{duration(log.timeSpentSeconds)}</td>

                <td className="p-2">—</td>

                <td className="p-2">—</td>

                <td className="p-2 max-w-xs whitespace-pre-wrap">
                  {log.comment}
                </td>

                <td className="p-2">Existente · {log.id}</td>

                <td className="p-2">Somente leitura</td>
              </tr>
            ))}

            {entries.map((entry) => {
              const disabled =
                locked || !!entry.worklogId || entry.result === 'uncertain'

              const messages = validations.filter(
                (message) => message.entryId === entry.id
              )

              return (
                <tr
                  key={entry.id}
                  className="border-t border-gray-200 dark:border-gray-700 align-top"
                >
                  <td className="p-2">
                    <input
                      aria-label={`Data ${entry.id}`}
                      className={inputClass}
                      type="date"
                      value={entry.date}
                      disabled={disabled}
                      onChange={(event) =>
                        update(entry.id, { date: event.target.value })
                      }
                    />
                  </td>

                  <td className="p-2 min-w-[210px]">
                    <select
                      aria-label={`Issue ${entry.id}`}
                      className={inputClass}
                      disabled={disabled}
                      value={entry.issueKey}
                      onChange={(event) =>
                        update(entry.id, { issueKey: event.target.value })
                      }
                    >
                      {analysis.issues.map((issue) => (
                        <option key={issue.key} value={issue.key}>
                          {issue.key}
                        </option>
                      ))}
                    </select>

                    <small>
                      {
                        analysis.issues.find(
                          (issue) => issue.key === entry.issueKey
                        )?.summary
                      }
                    </small>

                    <a
                      className="block underline text-green-700 dark:text-green-300"
                      href={`${analysis.baseUrl}/browse/${encodeURIComponent(entry.issueKey)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir no Jira
                    </a>
                  </td>

                  <td className="p-2 whitespace-nowrap">
                    {duration(existing[entry.date] || 0)}
                  </td>

                  <td className="p-2">
                    <input
                      aria-label={`Horas ${entry.id}`}
                      className={`${inputClass} min-w-[100px]`}
                      type="number"
                      step={EDIT_INCREMENT_SECONDS / 3600}
                      value={
                        Number.isFinite(entry.seconds)
                          ? entry.seconds / 3600
                          : ''
                      }
                      disabled={disabled}
                      onChange={(event) =>
                        update(entry.id, {
                          seconds:
                            event.target.value === ''
                              ? NaN
                              : Number(event.target.value) * 3600,
                        })
                      }
                    />
                  </td>

                  <td className="p-2 whitespace-nowrap">
                    {duration(
                      (existing[entry.date] || 0) + (totals[entry.date] || 0)
                    )}
                  </td>

                  <td className="p-2">
                    <textarea
                      aria-label={`Comentário ${entry.id}`}
                      className={`${inputClass} min-w-[190px]`}
                      rows={2}
                      value={entry.comment}
                      disabled={disabled}
                      onChange={(event) =>
                        update(entry.id, { comment: event.target.value })
                      }
                    />
                  </td>

                  <td className="p-2 min-w-[210px]">
                    <span>
                      {entry.result === 'success'
                        ? 'Sucesso'
                        : entry.result === 'error'
                          ? 'Erro no envio'
                          : entry.result === 'uncertain'
                            ? 'Resultado incerto'
                            : entry.edited
                              ? 'Editado manualmente'
                              : entry.origin === 'automatic'
                                ? 'Sugerido automaticamente'
                                : 'Manual'}
                    </span>

                    {entry.worklogId && <p>Worklog ID: {entry.worklogId}</p>}

                    {entry.error && (
                      <p className="text-red-600 dark:text-red-300">
                        {entry.error}
                      </p>
                    )}

                    {messages.map((message, index) => (
                      <p
                        key={index}
                        className={
                          message.level === 'ERROR'
                            ? 'text-red-600 dark:text-red-300'
                            : 'text-amber-700 dark:text-amber-300'
                        }
                      >
                        {message.level}: {message.message}
                      </p>
                    ))}

                    {entry.result === 'uncertain' && (
                      <label className="block mt-2">
                        <input
                          type="checkbox"
                          disabled={locked}
                          onChange={(event) => {
                            if (event.target.checked) checkedUncertain(entry.id)
                          }}
                        />{' '}
                        Conferi no Jira: este lançamento não existe. Liberar
                        revisão.
                      </label>
                    )}
                  </td>

                  <td className="p-2">
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="secondary"
                        disabled={disabled}
                        aria-label={`Remover lançamento ${entry.id}`}
                        title="Remover lançamento"
                        onClick={() => remove(entry.id)}
                      >
                        <Trash2 size={18} aria-hidden="true" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
