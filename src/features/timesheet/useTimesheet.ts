import { useEffect, useRef, useState } from 'react'
import type {
  Analysis,
  Board,
  Credentials,
  Entry,
  JiraUser,
  JiraDeployment,
  Period,
  Sprint,
} from './types'
import {
  ApiError,
  createWorklog,
  getAnalysis,
  getSprint,
  getBoards,
  getSprints,
  testConnection,
} from './api'
import {
  DEFAULT_TIMEZONE,
  EDIT_INCREMENT_SECONDS,
  logicalDate,
  periodDays,
} from './dates'
import { summarize } from './distribution'
import { validateEntries } from './validation'
import { exportCsv } from './csv'
import { submitSequential } from './submission'
import {
  clearConnectionSession,
  readConnectionSession,
  saveConnectionSession,
} from './connectionSession'
export type Stage =
  | 'configuration'
  | 'analysis'
  | 'suggestion'
  | 'review'
  | 'confirmation'
  | 'result'
export const stages: Array<[Stage, string]> = [
  ['configuration', 'Configuração'],
  ['analysis', 'Análise'],
  ['suggestion', 'Sugestão'],
  ['review', 'Revisão'],
  ['confirmation', 'Confirmação'],
  ['result', 'Resultado'],
]
export function useTimesheet() {
  const [savedConnection] = useState(readConnectionSession)
  const [deployment, setDeployment] = useState<JiraDeployment>(
    savedConnection?.deployment || 'cloud'
  )
  const [credentials, setCredentials] = useState<Credentials>(
    savedConnection || {
      baseUrl: '',
      email: '',
      token: '',
    }
  )
  const [connected, setConnected] = useState<JiraUser | null>(null)
  const [selected, setSelected] = useState<JiraUser | null>(null)
  const [users, setUsers] = useState<JiraUser[]>([])
  const [query, setQuery] = useState('')
  const [boards, setBoards] = useState<Board[]>([])
  const [boardId, setBoardId] = useState('')
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [sprint, setSprint] = useState<Sprint | null>(null)
  const [period, setPeriod] = useState<Period>({
    start: '',
    end: '',
    dailySeconds: 8 * 3600,
    timezone: DEFAULT_TIMEZONE,
  })
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [history, setHistory] = useState<Entry[][]>([])
  const [stage, setStage] = useState<Stage>('configuration')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const sent = useRef(new Map<string, string>())
  const uncertain = useRef(new Set<string>())
  const fingerprint = (entry: Entry) =>
    `${deployment}|${analysis?.baseUrl || ''}|${selected?.accountId || ''}|${entry.issueKey}|${entry.date}|${entry.seconds}`
  const [message, setMessage] = useState('')
  const [progress, setProgress] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const activeCredentials = { ...credentials, deployment }
  const run = async (operation: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setMessage('')
    try {
      await operation()
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível completar a operação.'
      )
      if (error instanceof ApiError && error.retryAfter)
        setCooldown(Date.now() + error.retryAfter * 1000)
    } finally {
      busyRef.current = false
      setBusy(false)
      setProgress('')
    }
  }
  const resetAnalysis = () => {
    setAnalysis(null)
    setEntries([])
    setHistory([])
    setStage('configuration')
    setAcknowledged(false)
  }
  const resetConnection = () => {
    setBoards([])
    setBoardId('')
    setSprints([])
    setConnected(null)
    setSelected(null)
    setUsers([])
    setSprint(null)
    resetAnalysis()
    setCredentials({ baseUrl: '', email: '', token: '' })
  }
  const disconnect = () => {
    resetConnection()
    clearConnectionSession()
    setMessage(
      'Conexão encerrada; credenciais removidas da sessão do navegador.'
    )
  }
  const changeCredentials = (patch: Partial<Credentials>) => {
    setBoards([])
    setBoardId('')
    setSprints([])
    setCredentials((current) => ({ ...current, ...patch }))
    setConnected(null)
    setSelected(null)
    setSprint(null)
    resetAnalysis()
  }
  const changeDeployment = (next: JiraDeployment) => {
    resetConnection()
    setDeployment(next)
    setCredentials({
      baseUrl: next === 'data-center' ? 'https://agile.corp.edp.pt' : '',
      email: '',
      token: '',
    })
    setMessage('')
  }
  const connect = () =>
    run(async () => {
      const result = await testConnection(activeCredentials, deployment)
      saveConnectionSession({ ...activeCredentials, baseUrl: result.baseUrl })
      setConnected(result.user)
      setSelected(result.user)
      setUsers([result.user])
      setPeriod((current) => ({ ...current, timezone: result.timezone }))
      resetAnalysis()
      setBoardId('')
      setSprints([])
      setSprint(null)
      setBoards(await getBoards(activeCredentials, deployment))
    })
  useEffect(() => {
    if (savedConnection) void connect()
  }, [])
  const refreshBoards = () =>
    run(async () => {
      setBoards(await getBoards(activeCredentials, deployment))
    })
  const chooseBoard = (id: string) =>
    run(async () => {
      setBoardId(id)
      setSprints([])
      setSprint(null)
      resetAnalysis()
      if (id)
        setSprints(await getSprints(Number(id), activeCredentials, deployment))
    })
  const chooseSprint = (id: string) =>
    run(async () => {
      setSprint(null)
      resetAnalysis()
      if (!id) return
      const result = await getSprint(Number(id), activeCredentials, deployment)
      setSprint(result)
      resetAnalysis()
      setPeriod((current) => ({
        ...current,
        start:
          current.start ||
          (result.startDate
            ? logicalDate(result.startDate, current.timezone)
            : ''),
        end:
          current.end ||
          (result.endDate ? logicalDate(result.endDate, current.timezone) : ''),
      }))
    })
  const analyze = () =>
    run(async () => {
      if (!selected || !sprint)
        throw new Error('Conecte e localize uma Sprint primeiro.')
      periodDays(period)
      const result = await getAnalysis(
        sprint.id,
        selected,
        period,
        activeCredentials,
        deployment
      )
      setAnalysis(result)
      setEntries([])
      setHistory([])
      setStage('analysis')
      setAcknowledged(false)
    })
  const edit = (next: Entry[]) => {
    if (busyRef.current) return
    setHistory((current) => [...current.slice(-49), entries])
    setEntries(next)
    setAcknowledged(false)
  }
  const update = (id: string, patch: Partial<Entry>) => {
    const current = entries.find((entry) => entry.id === id)
    if (current?.result === 'uncertain')
      uncertain.current.delete(fingerprint(current))
    edit(
      entries.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              ...patch,
              edited: true,
              result: undefined,
              error: undefined,
            }
          : entry
      )
    )
  }
  const add = () => {
    if (!analysis?.issues.length) return
    edit([
      ...entries,
      {
        id: crypto.randomUUID(),
        issueKey: analysis.issues[0].key,
        date: period.start,
        seconds: EDIT_INCREMENT_SECONDS,
        comment: '',
        origin: 'manual',
        edited: true,
      },
    ])
  }
  const split = (id: string) => {
    const original = entries.find((entry) => entry.id === id)
    if (!original) return
    const first =
      Math.floor(original.seconds / 2 / EDIT_INCREMENT_SECONDS) *
      EDIT_INCREMENT_SECONDS
    edit(
      entries.flatMap((entry) =>
        entry.id === id
          ? [
              { ...entry, seconds: first, edited: true },
              {
                ...entry,
                id: crypto.randomUUID(),
                seconds: entry.seconds - first,
                edited: true,
              },
            ]
          : [entry]
      )
    )
  }
  const pending = entries.filter((entry) => !entry.worklogId)
  const validations = analysis
    ? validateEntries(analysis, period, pending, true)
    : []
  const errors = validations.filter((item) => item.level === 'ERROR')
  const warnings = validations.filter((item) => item.level === 'WARNING')
  const stats = analysis
    ? summarize(
        analysis.issues,
        analysis.worklogs,
        analysis.user.accountId,
        period,
        entries
      )
    : null
  const exportData = () => {
    if (!analysis) return
    const csvStage =
      stage === 'analysis'
        ? 'analysis'
        : stage === 'result'
          ? 'result'
          : stage === 'confirmation'
            ? 'confirmation'
            : 'review'
    const url = URL.createObjectURL(
      new Blob([exportCsv(analysis, period, entries, csvStage)], {
        type: 'text/csv;charset=utf-8;',
      })
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `jira-timesheet-${period.start}-a-${period.end}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }
  const register = () =>
    run(async () => {
      if (!analysis || !selected || !acknowledged || stage !== 'confirmation')
        throw new Error(
          'Revise e confirme explicitamente os lançamentos antes de registrar.'
        )
      if (Date.now() < cooldown)
        throw new Error(
          `Limite Jira: aguarde até ${new Date(cooldown).toLocaleTimeString('pt-BR')} para tentar novamente.`
        )
      setProgress('Revalidando os apontamentos no Jira…')
      const fresh = await getAnalysis(
        analysis.sprint.id,
        selected,
        period,
        activeCredentials,
        deployment
      )
      setAnalysis(fresh)
      const freshValidations = validateEntries(fresh, period, pending, true)
      if (freshValidations.some((item) => item.level === 'ERROR')) {
        setAcknowledged(false)
        throw new Error(
          'A revalidação encontrou erros. Revise os lançamentos atualizados antes de registrar.'
        )
      }
      const warningSignature = (items: typeof warnings) =>
        JSON.stringify(
          items
            .filter((item) => item.level === 'WARNING')
            .map((item) => [item.entryId, item.message])
            .sort()
        )
      if (warningSignature(freshValidations) !== warningSignature(warnings)) {
        setAcknowledged(false)
        throw new Error(
          'Os avisos mudaram desde a revisão. Confira e confirme novamente.'
        )
      }
      setProgress(`Registrando worklogs… 0 de ${pending.length}`)
      const results = await submitSequential(
        entries,
        async (entry, pendingItems) => {
          const key = fingerprint(entry)
          const previousId = sent.current.get(key)
          if (previousId) return { id: previousId }
          if (uncertain.current.has(key))
            throw new ApiError(
              'Este lançamento teve resultado incerto nesta sessão. Confira no Jira antes de reenviar.',
              true
            )
          try {
            const result = await createWorklog(
              analysis.sprint.id,
              selected,
              period,
              entry,
              pendingItems,
              acknowledged,
              validateEntries(fresh, period, pendingItems, true),
              activeCredentials,
              deployment
            )
            sent.current.set(key, result.id)
            return result
          } catch (error) {
            if (error instanceof ApiError) {
              if (error.uncertain) uncertain.current.add(key)
              if (error.fresh) setAnalysis(error.fresh)
              if (error.retryAfter)
                setCooldown(Date.now() + error.retryAfter * 1000)
            }
            throw error
          }
        },
        (completed, total, results) => {
          setProgress(`Registrando worklogs… ${completed} de ${total}`)
          setEntries(results)
        }
      )
      setEntries(results)
      setHistory([])
      setStage('result')
      setAcknowledged(false)
      setProgress('')
      // Refresh read data so recorded hours and future retries use current capacity.
      try {
        setAnalysis(
          await getAnalysis(
            analysis.sprint.id,
            selected,
            period,
            activeCredentials,
            deployment
          )
        )
      } catch {
        setMessage(
          'Envio concluído. Não foi possível atualizar a análise; uma nova tentativa fará revalidação no Jira.'
        )
      }
    })
  const succeeded = entries.filter((entry) => entry.worklogId)
  return {
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
    setSprint,
    period,
    setPeriod,
    analysis,
    entries,
    history,
    setHistory,
    stage,
    setStage,
    busy,
    message,
    progress,
    acknowledged,
    setAcknowledged,
    run,
    resetAnalysis,
    disconnect,
    changeCredentials,
    connect,
    analyze,
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
    activeCredentials,
    setMessage,
    setEntries,
  }
}
