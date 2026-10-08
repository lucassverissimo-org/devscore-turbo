import React from 'react'
import { RefreshCw, Search, ListFilter, LogIn } from 'lucide-react'
import { displayDate, logicalDate } from './dates'
import { Button, Field, inputClass, panelClass } from './ui'
import type { useTimesheet } from './useTimesheet'
export default function Configuration({
  controller,
}: {
  controller: ReturnType<typeof useTimesheet>
}) {
  const {
    deployment,
    changeDeployment,
    credentials,
    connected,
    selected,
    boards,
    boardId,
    sprints,
    chooseBoard,
    chooseSprint,
    refreshBoards,
    sprint,
    period,
    busy,
    disconnect,
    changeCredentials,
    connect,
    analyze,
  } = controller
  return (
    <fieldset disabled={busy} className={`${panelClass} disabled:opacity-75`}>
      <legend className="sr-only">Configuração Jira</legend>
      <div className="flex justify-between gap-2">
        <h2 className="font-semibold text-lg">
          Conexão Jira {deployment === 'cloud' ? 'Cloud' : 'Data Center'}
        </h2>
        {connected && (
          <Button variant="secondary" onClick={disconnect}>
            Desconectar e limpar credenciais
          </Button>
        )}
      </div>
      <details
        open={!connected}
        className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3"
      >
        <summary className="cursor-pointer font-medium">
          {connected ? 'Dados da conexão' : 'Informe sua conexão Jira'}
        </summary>
        <Field label="Tipo de Jira">
          <select
            className={inputClass}
            value={deployment}
            onChange={(event) =>
              changeDeployment(event.target.value as typeof deployment)
            }
          >
            <option value="cloud">Jira Cloud</option>
            <option value="data-center">Jira Data Center (PAT)</option>
          </select>
        </Field>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Jira Base URL">
            <input
              autoComplete="off"
              className={inputClass}
              placeholder={
                deployment === 'cloud'
                  ? 'https://seu-site.atlassian.net'
                  : 'https://agile.corp.edp.pt'
              }
              value={credentials.baseUrl}
              onChange={(event) =>
                changeCredentials({ baseUrl: event.target.value })
              }
            />
          </Field>
          {deployment === 'cloud' && (
            <Field label="E-mail Jira">
              <input
                autoComplete="off"
                className={inputClass}
                type="email"
                value={credentials.email}
                onChange={(event) =>
                  changeCredentials({ email: event.target.value })
                }
              />
            </Field>
          )}
          <Field
            label={
              deployment === 'cloud'
                ? 'API Token'
                : 'PAT (Personal Access Token)'
            }
          >
            <input
              autoComplete="off"
              className={inputClass}
              type="password"
              value={credentials.token}
              onChange={(event) =>
                changeCredentials({ token: event.target.value })
              }
            />
          </Field>
        </div>
        <Button onClick={connect}>
          <LogIn size={16} aria-hidden="true" />
          Conectar
        </Button>
      </details>
      {connected && (
        <p className="font-semibold text-green-700 dark:text-green-300">
          Conectado como: {connected.displayName}
        </p>
      )}
      {connected && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold flex items-center gap-2">
              <ListFilter size={18} aria-hidden="true" />
              Selecione as tasks que serão consultadas
            </h3>
            <Button
              variant="secondary"
              onClick={refreshBoards}
              title="Busca novamente os boards disponíveis para sua conta"
            >
              <RefreshCw size={16} aria-hidden="true" />
              Atualizar boards
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Board">
              <select
                className={inputClass}
                value={boardId}
                onChange={(event) => chooseBoard(event.target.value)}
              >
                <option value="">Selecione um board</option>
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </select>
              {!boards.length && !busy && (
                <small>Nenhum board Scrum disponível para esta conta.</small>
              )}
            </Field>
            <Field label="Sprint">
              <select
                className={inputClass}
                value={sprint?.id || ''}
                disabled={!boardId || !sprints.length}
                onChange={(event) => chooseSprint(event.target.value)}
              >
                <option value="">Selecione uma Sprint</option>
                {sprints.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ·{' '}
                    {(
                      {
                        active: 'Ativa',
                        future: 'Futura',
                        closed: 'Concluída',
                      } as Record<string, string>
                    )[item.state] || item.state}
                  </option>
                ))}
              </select>
              {boardId && !sprints.length && !busy && (
                <small>Nenhuma Sprint disponível neste board.</small>
              )}
            </Field>
          </div>
          {sprint && (
            <p>
              Sprint {sprint.id} — {sprint.name} · Status: {sprint.state} ·{' '}
              {sprint.startDate
                ? displayDate(logicalDate(sprint.startDate, period.timezone))
                : 'Início não informado'}{' '}
              a{' '}
              {sprint.endDate
                ? displayDate(logicalDate(sprint.endDate, period.timezone))
                : 'Fim não informado'}
            </p>
          )}
          <Button disabled={!sprint || !selected} onClick={analyze}>
            <Search size={16} aria-hidden="true" />
            Consultar tasks e saldos
          </Button>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Consulta todas as tasks atribuídas ao usuário nesta Sprint. Você
            escolhe os dias dos apontamentos na próxima etapa.
          </p>
        </>
      )}
    </fieldset>
  )
}
