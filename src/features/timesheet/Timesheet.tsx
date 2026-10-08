import React from 'react'
import { displayDate, duration } from './dates'
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Loader2,
  Send,
  ClipboardCheck,
} from 'lucide-react'
import Planning from './Planning'
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
    messageError,
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
          Escolha as tasks, planeje as horas e confira cada lançamento antes de
          enviar ao Jira.
        </p>
        <ol className="flex flex-wrap gap-2 text-sm" aria-label="Etapas">
          {stages.map(([key, label], index) => (
            <li
              key={key}
              aria-current={stage === key ? 'step' : undefined}
              className={`rounded px-3 py-2 ${stage === key ? 'bg-green-700 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
            >
              <span className="flex items-center gap-2">
                {index < stages.findIndex(([step]) => step === stage) ? (
                  <CheckCircle2 size={15} aria-hidden="true" />
                ) : (
                  <span>{index + 1}.</span>
                )}
                {label}
              </span>
            </li>
          ))}
        </ol>
      </section>
      {message && <Notice error={messageError}>{message}</Notice>}
      {progress && <Notice>{progress}</Notice>}
      {busy && !progress && (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300"
        >
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          Buscando dados no Jira…
        </p>
      )}
      {stage === 'configuration' ? (
        <Configuration controller={controller} />
      ) : (
        <details className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <summary className="cursor-pointer p-4 font-medium">
            Alterar board ou Sprint{' '}
            <span className="block text-sm font-normal text-gray-500 mt-1">
              {analysis?.sprint.name} · {analysis?.user.displayName}
            </span>
          </summary>
          <Configuration controller={controller} />
        </details>
      )}
      {analysis && (
        <>
          {analysis.warnings.map((warning) => (
            <Notice key={warning}>{warning}</Notice>
          ))}
          {stage === 'analysis' ? (
            <AnalysisView
              analysis={analysis}
              period={period}
              entries={entries.filter((entry) => !entry.worklogId)}
              showPlanningSummary={stage !== 'analysis'}
            />
          ) : (
            <details className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <summary className="cursor-pointer font-medium">
                Ver tasks, saldos e capacidade do período
              </summary>
              <AnalysisView
                analysis={analysis}
                period={period}
                entries={entries.filter((entry) => !entry.worklogId)}
              />
            </details>
          )}
          {(stage === 'analysis' || stage === 'suggestion') && (
            <Planning
              key={`${analysis.sprint.id}:${analysis.user.accountId}`}
              controller={controller}
            />
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" disabled={busy} onClick={exportData}>
              <Download size={16} aria-hidden="true" />
              Exportar CSV
            </Button>
          </div>
          {stage !== 'analysis' && (
            <>
              {stage === 'confirmation' && (
                <p className="text-sm text-gray-500">
                  Confira a lista de envio abaixo. Para alterar datas, horas ou
                  comentários, abra a grade de edição.
                </p>
              )}
              <details open={stage !== 'confirmation'} className="space-y-3">
                <summary className="cursor-pointer font-medium text-green-700 dark:text-green-300">
                  {stage === 'confirmation'
                    ? 'Editar lançamentos antes de enviar'
                    : 'Grade de edição dos lançamentos'}
                </summary>
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
              </details>
              {validations
                .filter((item) => !item.entryId)
                .map((item, index) => (
                  <Notice key={index} error={item.level === 'ERROR'}>
                    {item.message}
                  </Notice>
                ))}
              {stage === 'suggestion' && (
                <section className={panelClass}>
                  <h2 className="font-semibold flex items-center gap-2">
                    <ClipboardCheck size={18} aria-hidden="true" />
                    Próximo passo: revisar os lançamentos
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Confira datas, tasks e horas na grade. Você pode editar,
                    adicionar ou remover itens. Revisar abre a etapa de
                    conferência; ainda não envia nada ao Jira.
                  </p>
                  <Button
                    disabled={busy || !entries.length}
                    onClick={() => setStage('review')}
                  >
                    <ArrowRight size={16} aria-hidden="true" />
                    Revisar apontamentos
                  </Button>
                  {!entries.length && (
                    <p className="text-sm">
                      Nenhum lançamento preparado. Gere uma sugestão ou adicione
                      um lançamento na grade.
                    </p>
                  )}
                </section>
              )}
              {stage === 'review' && (
                <section className={panelClass}>
                  <h2 className="font-semibold">Revise antes de continuar</h2>
                  <p className="text-sm">
                    Confira os lançamentos na grade acima. Corrija os erros
                    indicados para abrir a confirmação do envio.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => setStage('suggestion')}
                    >
                      Voltar ao planejamento
                    </Button>
                    <Button
                      disabled={busy || !pending.length || errors.length > 0}
                      onClick={() => {
                        setStage('confirmation')
                        setAcknowledged(false)
                      }}
                    >
                      <ArrowRight size={16} aria-hidden="true" />
                      Ir para confirmação
                    </Button>
                  </div>
                  {errors.length > 0 && (
                    <p className="text-sm text-red-700 dark:text-red-300">
                      {errors.length} erro(s) precisam ser corrigidos antes de
                      continuar.
                    </p>
                  )}
                </section>
              )}
              {stage === 'confirmation' && (
                <section className={panelClass}>
                  <h2 className="text-lg font-semibold">Confirmação</h2>
                  <p className="text-sm">
                    Estes são os lançamentos que serão registrados para{' '}
                    <strong>{analysis.user.displayName}</strong>. O envio só
                    acontece ao clicar em “Confirmar e registrar no Jira”.
                  </p>
                  <ul
                    aria-label="Lançamentos a registrar"
                    className="divide-y divide-gray-200 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    {[...pending]
                      .sort(
                        (a, b) =>
                          a.date.localeCompare(b.date) ||
                          a.issueKey.localeCompare(b.issueKey)
                      )
                      .map((entry) => (
                        <li key={entry.id} className="p-3">
                          <p className="font-medium tabular-nums">
                            {displayDate(entry.date)}:{' '}
                            <a
                              className="text-green-700 dark:text-green-300 underline"
                              href={`${analysis.baseUrl}/browse/${encodeURIComponent(entry.issueKey)}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {entry.issueKey}
                            </a>{' '}
                            =&gt; {duration(entry.seconds)}
                          </p>
                          {entry.comment && (
                            <p className="text-sm text-gray-500 whitespace-pre-wrap mt-1">
                              Comentário: {entry.comment}
                            </p>
                          )}
                        </li>
                      ))}
                  </ul>
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
                    Antes do envio, conferimos os dados novamente no Jira. Os
                    apontamentos existentes e as estimativas serão mantidos.
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
                      Revisei os lançamentos e os avisos. Confirmo o registro
                      das horas na conta Jira conectada.
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => setStage('review')}
                    >
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
                      <Send size={16} aria-hidden="true" />
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
