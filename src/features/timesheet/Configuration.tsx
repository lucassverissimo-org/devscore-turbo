import React from 'react'
import { findUsers } from './api'
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
    setSelected,
    users,
    setUsers,
    query,
    setQuery,
    boards,
    boardId,
    sprints,
    chooseBoard,
    chooseSprint,
    refreshBoards,
    sprint,
    period,
    setPeriod,
    busy,
    run,
    resetAnalysis,
    disconnect,
    changeCredentials,
    connect,
    analyze,
    activeCredentials,
    setMessage,
  } = controller
  return (
    <fieldset disabled={busy} className={`${panelClass} disabled:opacity-75`}>
      <legend className="sr-only">Configuração Jira</legend>
      <div className="flex justify-between gap-2">
        <h2 className="font-semibold text-lg">
          Conexão Jira {deployment === 'cloud' ? 'Cloud' : 'Data Center'}
        </h2>
        {connected && (
          <Button onClick={disconnect}>Desconectar e limpar credenciais</Button>
        )}
      </div>
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
            deployment === 'cloud' ? 'API Token' : 'PAT (Personal Access Token)'
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
      <Button onClick={connect}>Conectar</Button>
      {connected && (
        <p className="font-semibold text-green-700 dark:text-green-300">
          Conectado como: {connected.displayName}
        </p>
      )}
      {connected && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
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
            <Field label="Usuário analisado">
              <select
                className={inputClass}
                value={selected?.accountId || ''}
                onChange={(event) => {
                  setSelected(
                    users.find(
                      (user) => user.accountId === event.target.value
                    ) || null
                  )
                  resetAnalysis()
                }}
              >
                {users.map((user) => (
                  <option key={user.accountId} value={user.accountId}>
                    {user.displayName}
                    {user.accountId === connected.accountId
                      ? ' (sua conta)'
                      : ''}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Button onClick={refreshBoards}>Atualizar boards</Button>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Procurar outro usuário">
              <input
                className={inputClass}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </Field>
            <Button
              disabled={!query.trim()}
              onClick={() =>
                run(async () => {
                  const found = await findUsers(
                    query,
                    activeCredentials,
                    deployment
                  )
                  setUsers([
                    ...new Map(
                      [
                        connected,
                        ...(selected ? [selected] : []),
                        ...found,
                      ].map((user) => [user.accountId, user])
                    ).values(),
                  ])
                  if (!found.length)
                    setMessage(
                      'Nenhum usuário encontrado. Confira o nome e a permissão Browse users and groups.'
                    )
                })
              }
            >
              Buscar usuário
            </Button>
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Data inicial">
              <input
                className={inputClass}
                type="date"
                value={period.start}
                onChange={(event) => {
                  setPeriod({ ...period, start: event.target.value })
                  resetAnalysis()
                }}
              />
            </Field>
            <Field label="Data final">
              <input
                className={inputClass}
                type="date"
                value={period.end}
                onChange={(event) => {
                  setPeriod({ ...period, end: event.target.value })
                  resetAnalysis()
                }}
              />
            </Field>
            <Field label="Jornada diária (horas)">
              <input
                className={inputClass}
                type="number"
                step="0.25"
                min="0.25"
                max="24"
                value={period.dailySeconds / 3600}
                onChange={(event) => {
                  setPeriod({
                    ...period,
                    dailySeconds: Number(event.target.value) * 3600,
                  })
                  resetAnalysis()
                }}
              />
            </Field>
            <Field label="Timezone">
              <input className={inputClass} value={period.timezone} readOnly />
              <small>Configurado por JIRA_TIMEZONE no servidor.</small>
            </Field>
          </div>
          <Button
            disabled={!sprint || !selected || !period.start || !period.end}
            onClick={analyze}
          >
            Analisar Sprint
          </Button>
        </>
      )}
    </fieldset>
  )
}
