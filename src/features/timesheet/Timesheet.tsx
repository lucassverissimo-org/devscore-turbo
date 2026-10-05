import React from 'react'
import { displayDate, duration } from './dates'
import { distribute } from './distribution'
import AnalysisView from './AnalysisView'
import EntryGrid from './EntryGrid'
import Configuration from './Configuration'
import { Button, Notice, panelClass } from './ui'
import { stages, useTimesheet } from './useTimesheet'
export default function Timesheet() {
  const controller = useTimesheet()
  const {
    stage,
    message,
    progress,
    busy,
    analysis,
    entries,
    history,
    setHistory,
    setStage,
    acknowledged,
    setAcknowledged,
    edit,
    update,
    add,
    split,
    pending,
    validations,
    errors,
    warnings,
    stats,
    exportData,
    register,
    succeeded,
    period,
    connected,
    setEntries,
  } = controller
  return (
    <div className="space-y-4">
      <section className={panelClass}>
        <h1 className="text-2xl font-bold text-green-800 dark:text-green-100">
          Jira Sprint Timesheet Helper
        </h1>
        <p>
          Analise a Sprint, prepare os apontamentos e revise antes de registrar
          no Jira Cloud ou Data Center.
        </p>
        <ol className="flex flex-wrap gap-2 text-sm" aria-label="Etapas">
          {stages.map(([key, label], index) => (
            <li
              key={key}
              aria-current={stage === key ? 'step' : undefined}
              className={`rounded px-3 py-2 ${stage === key ? 'bg-green-700 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
            >
              {index + 1}. {label}
            </li>
          ))}
        </ol>
      </section>
      {message && <Notice error>{message}</Notice>}
      {progress && <Notice>{progress}</Notice>}
      <Configuration controller={controller} />
      {analysis && (
        <>
          {analysis.warnings.map((warning) => (
            <Notice key={warning}>{warning}</Notice>
          ))}
          {analysis.user.accountId !== analysis.authenticatedUser.accountId && (
            <Notice>
              Você está analisando outro usuário. Para registrar worklogs,
              conecte-se utilizando a conta Jira desse usuário. Análise, edição
              e CSV continuam disponíveis.
            </Notice>
          )}
          <AnalysisView
            analysis={analysis}
            period={period}
            entries={entries.filter((entry) => !entry.worklogId)}
          />
          <section className={panelClass}>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={
                  busy ||
                  succeeded.length > 0 ||
                  entries.some((entry) => entry.result === 'uncertain')
                }
                onClick={() => {
                  edit(
                    distribute(
                      analysis.issues,
                      analysis.worklogs,
                      analysis.user.accountId,
                      period
                    ).entries
                  )
                  setStage('suggestion')
                }}
              >
                Gerar sugestão
              </Button>
              <Button
                disabled={
                  busy ||
                  succeeded.length > 0 ||
                  entries.some((entry) => entry.result === 'uncertain')
                }
                onClick={() => edit([])}
              >
                Limpar sugestão
              </Button>
              <Button disabled={busy} onClick={exportData}>
                Exportar CSV
              </Button>
              {stage === 'analysis' && (
                <Button disabled={busy} onClick={() => setStage('suggestion')}>
                  Preparar lançamento manual
                </Button>
              )}
            </div>
          </section>
          {stage !== 'analysis' && (
            <>
              <EntryGrid
                analysis={analysis}
                period={period}
                entries={entries}
                validations={validations}
                locked={busy}
                update={update}
                remove={(id) =>
                  edit(entries.filter((entry) => entry.id !== id))
                }
                add={add}
                split={split}
                duplicate={(id) => {
                  const entry = entries.find((entry) => entry.id === id)
                  if (entry)
                    edit([
                      ...entries,
                      {
                        ...entry,
                        id: crypto.randomUUID(),
                        edited: true,
                        result: undefined,
                        error: undefined,
                      },
                    ])
                }}
                undo={() => {
                  const previous = history[history.length - 1]
                  if (previous) {
                    setEntries(previous)
                    setHistory(history.slice(0, -1))
                    setAcknowledged(false)
                  }
                }}
                canUndo={history.length > 0}
                checkedUncertain={(id) => update(id, { result: undefined })}
              />
              {validations
                .filter((item) => !item.entryId)
                .map((item, index) => (
                  <Notice key={index} error={item.level === 'ERROR'}>
                    {item.message}
                  </Notice>
                ))}
              {stage === 'suggestion' && (
                <Button
                  disabled={busy || !entries.length}
                  onClick={() => setStage('review')}
                >
                  Revisar apontamentos
                </Button>
              )}
              {stage === 'review' && (
                <Button
                  disabled={busy || !pending.length || errors.length > 0}
                  onClick={() => {
                    setStage('confirmation')
                    setAcknowledged(false)
                  }}
                >
                  Ir para confirmação
                </Button>
              )}
              {stage === 'confirmation' && (
                <section className={panelClass}>
                  <h2 className="text-lg font-semibold">Confirmação</h2>
                  <p>
                    Serão criados: {pending.length} worklogs · Total:{' '}
                    {duration(
                      pending.reduce(
                        (sum, entry) => sum + Math.max(0, entry.seconds || 0),
                        0
                      )
                    )}
                  </p>
                  <p>
                    Período: {displayDate(period.start)} até{' '}
                    {displayDate(period.end)} · Alterados manualmente:{' '}
                    {pending.filter((entry) => entry.edited).length} · Possíveis
                    duplicidades:{' '}
                    {
                      validations.filter((item) =>
                        item.message.includes('duplicidade')
                      ).length
                    }{' '}
                    · Erros: {errors.length} · Avisos: {warnings.length}
                  </p>
                  <p className="text-sm">
                    O servidor buscará os dados novamente antes de cada criação.
                    Worklogs existentes e estimativas serão mantidos.
                  </p>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={acknowledged}
                      disabled={busy}
                      onChange={(event) =>
                        setAcknowledged(event.target.checked)
                      }
                    />
                    <span>
                      Revisei os lançamentos e os avisos, incluindo a capacidade
                      visível. Confirmo a criação na identidade Jira conectada.
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={busy} onClick={() => setStage('review')}>
                      Voltar à revisão
                    </Button>
                    <Button
                      disabled={
                        busy ||
                        errors.length > 0 ||
                        !acknowledged ||
                        !pending.length ||
                        analysis.user.accountId !== connected?.accountId
                      }
                      onClick={register}
                    >
                      Confirmar e registrar no Jira
                    </Button>
                  </div>
                </section>
              )}
              {stage === 'result' && (
                <section className={panelClass}>
                  <h2 className="text-lg font-semibold">Resultado</h2>
                  <p>
                    Usuário: {analysis.user.displayName} · Total enviado:{' '}
                    {entries.filter((entry) => entry.result).length} · Sucessos:{' '}
                    {succeeded.length} · Erros:{' '}
                    {entries.filter((entry) => entry.result === 'error').length}{' '}
                    · Incertos:{' '}
                    {
                      entries.filter((entry) => entry.result === 'uncertain')
                        .length
                    }
                  </p>
                  <p>
                    Horas registradas:{' '}
                    {duration(
                      succeeded.reduce((sum, entry) => sum + entry.seconds, 0)
                    )}{' '}
                    · Horas não registradas:{' '}
                    {duration(
                      pending.reduce(
                        (sum, entry) => sum + Math.max(0, entry.seconds || 0),
                        0
                      )
                    )}
                  </p>
                  <Button
                    disabled={busy || !pending.length}
                    onClick={() => {
                      setStage('review')
                      setAcknowledged(false)
                      setHistory([])
                    }}
                  >
                    Revisar e reenviar somente os que falharam
                  </Button>
                </section>
              )}
            </>
          )}
          {stats && (
            <p className="sr-only">
              Sugestão total {duration(stats.suggested)}
            </p>
          )}
        </>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Nenhum worklog é criado durante a análise ou geração de sugestões.
      </p>
    </div>
  )
}
