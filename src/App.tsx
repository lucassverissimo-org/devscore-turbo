import React, { useEffect, useState } from 'react'
import { useTheme } from './ThemeProvider'
import { supabase } from './lib/supabase'

import Header from './components/Header'
import TeamSelector from './components/TeamSelector'
import AddDevForm from './components/AddDevForm'
import DevCard from './components/DevCard'
import Summary from './components/Summary'
import SettingsModal from './components/SettingsModal'
import SprintPlanning from './components/SprintPlanning'
import { Dev, NO_TEAM_VALUE, PointsType, SprintDistributionData, SprintPlanningData, SprintPlanningRecord, Team, TeamSelection } from './types'
import {
  SPRINT_PROJECT,
  listSprintPlanningRecords,
  saveNewSprintPlanningRecord,
  updateSprintDistributionRecord,
  updateSprintPlanningRecord,
} from './lib/sprintPlanningSupabase'
import { normalizeHistoryText } from './lib/utils/history'
import {
  SPRINT_PLANNING_STORAGE_KEY,
  createEmptySprintPlanning,
  loadStoredSprintPlanning,
} from './lib/utils/sprintPlanning'
import {
  SPRINT_DISTRIBUTION_STORAGE_KEY,
  createEmptySprintDistribution,
  createSprintDistribution,
  loadStoredSprintDistribution,
} from './lib/utils/sprintDistribution'

type NewDev = { name: string; capacity: string }
type ActiveTab = 'distribution' | 'sprint'

const LOCAL_DEVS_STORAGE_KEY = 'devscore.localDevs'
const LOCAL_POINTS_TYPE_STORAGE_KEY = 'devscore.localPointsType'

function normalizePointsType(value: unknown): PointsType {
  return value === 'hrs' ? 'hrs' : 'pts'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseStoredLocalDevs(): Dev[] {
  if (typeof window === 'undefined') return []

  try {
    const stored = window.localStorage.getItem(LOCAL_DEVS_STORAGE_KEY)
    if (!stored) return []

    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []

    return parsed.reduce<Dev[]>((acc, item) => {
      if (!isRecord(item) || typeof item.name !== 'string' || typeof item.capacity !== 'number') {
        return acc
      }

      const history = Array.isArray(item.history)
        ? item.history.reduce<Dev['history']>((entries, historyItem) => {
            if (
              isRecord(historyItem) &&
              typeof historyItem.value === 'number' &&
              typeof historyItem.timestamp === 'string'
            ) {
              const text = normalizeHistoryText(historyItem.text)
              entries.push({
                value: historyItem.value,
                timestamp: historyItem.timestamp,
                ...(text ? { text } : {}),
              })
            }
            return entries
          }, [])
        : []

      acc.push({
        id: typeof item.id === 'string' ? item.id : undefined,
        idTeam: undefined,
        name: item.name,
        capacity: item.capacity,
        points: typeof item.points === 'number' ? item.points : 0,
        history,
        customPoints: '',
      })

      return acc
    }, [])
  } catch {
    return []
  }
}

function parseStoredPointsType(): PointsType {
  if (typeof window === 'undefined') return 'pts'

  return normalizePointsType(window.localStorage.getItem(LOCAL_POINTS_TYPE_STORAGE_KEY))
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getDefaultTeamSelection(teams: Team[]): TeamSelection {
  const bravoTeam = teams.find(team => team.name.trim().toLowerCase() === 'bravo')

  if (typeof bravoTeam?.id === 'number') {
    return bravoTeam.id
  }

  if (typeof teams[0]?.id === 'number') {
    return teams[0].id
  }

  return NO_TEAM_VALUE
}

function App() {
  const { theme, setTheme } = useTheme()
  const [showSettings, setShowSettings] = useState(false)
  const [showSupabaseWarning, setShowSupabaseWarning] = useState(!supabase)
  const [activeTab, setActiveTab] = useState<ActiveTab>('distribution')
  const [isSprintEnabled, setIsSprintEnabled] = useState(false)

  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<TeamSelection>(NO_TEAM_VALUE)
  const [devs, setDevs] = useState<Dev[]>([])
  const [localDevs, setLocalDevs] = useState<Dev[]>(() => parseStoredLocalDevs())
  const [localPointsType, setLocalPointsType] = useState<PointsType>(() => parseStoredPointsType())
  const [newDev, setNewDev] = useState<NewDev>({ name: '', capacity: '' })
  const [sprintPlanning, setSprintPlanning] = useState<SprintPlanningData>(() => loadStoredSprintPlanning())
  const [sprintRecords, setSprintRecords] = useState<SprintPlanningRecord[]>([])
  const [selectedSprintRecord, setSelectedSprintRecord] = useState<SprintPlanningRecord | null>(null)
  const [isLoadingSprints, setIsLoadingSprints] = useState(false)
  const [isSavingPlanning, setIsSavingPlanning] = useState(false)
  const [isSavingDistribution, setIsSavingDistribution] = useState(false)
  const [sprintMessage, setSprintMessage] = useState('')
  const [planningSaveMessage, setPlanningSaveMessage] = useState('')
  const [distributionSaveMessage, setDistributionSaveMessage] = useState('')
  const [planningSnapshot, setPlanningSnapshot] = useState(() => JSON.stringify(loadStoredSprintPlanning()))
  const [distributionSnapshot, setDistributionSnapshot] = useState(() => {
    const storedDistribution = loadStoredSprintDistribution()
    return JSON.stringify(storedDistribution)
  })

  const [customPointsMap, setCustomPointsMap] = useState<Record<number, string>>({})
  const isWithoutTeam = selectedTeamId === NO_TEAM_VALUE
  const selectedTeam = isWithoutTeam
    ? { id: undefined, name: 'Nenhum', pointsType: localPointsType }
    : teams.find(team => team.id === selectedTeamId)
  const selectedPointsType = isSprintEnabled ? localPointsType : selectedTeam?.pointsType ?? localPointsType
  const distributionData = React.useMemo<SprintDistributionData>(
    () => createSprintDistribution(localDevs, localPointsType),
    [localDevs, localPointsType]
  )
  const sprintStoryOptions = React.useMemo(
    () => Array.from(new Set(
      sprintPlanning.tasks
        .map(task => task.code.trim())
        .filter(Boolean)
    )),
    [sprintPlanning.tasks]
  )
  const hasPlanningChanges = JSON.stringify(sprintPlanning) !== planningSnapshot
  const hasDistributionChanges = JSON.stringify(distributionData) !== distributionSnapshot
  const shouldUseLocalDistribution = isSprintEnabled || isWithoutTeam

  const setCurrentDevs: React.Dispatch<React.SetStateAction<Dev[]>> = value => {
    const nextDevs =
      typeof value === 'function' ? (value as (prev: Dev[]) => Dev[])(devs) : value

    setDevs(nextDevs)

    if (shouldUseLocalDistribution) {
      setLocalDevs(nextDevs)
    }
  }

  const applySprintRecord = React.useCallback((record: SprintPlanningRecord) => {
    const planning = record.planningData
    const distribution: SprintDistributionData = {
      ...record.distributionData,
      pointsType: 'hrs',
    }

    setSelectedSprintRecord(record)
    setSprintPlanning(planning)
    setPlanningSnapshot(JSON.stringify(planning))
    setLocalPointsType(distribution.pointsType)
    setLocalDevs(distribution.devs)
    setDevs(distribution.devs)
    setDistributionSnapshot(JSON.stringify(distribution))
    setSelectedTeamId(NO_TEAM_VALUE)
    setCustomPointsMap({})
    setSprintMessage('')
    setPlanningSaveMessage('')
    setDistributionSaveMessage('')
  }, [])

  const refreshSprintRecords = React.useCallback(async (selectFirstRecord: boolean) => {
    if (!supabase) {
      setSprintMessage('Supabase indisponivel. Usando dados locais.')
      return
    }

    setIsLoadingSprints(true)
    const result = await listSprintPlanningRecords(SPRINT_PROJECT)
    setIsLoadingSprints(false)

    if (result.error) {
      setSprintRecords([])
      setSprintMessage(`Nao foi possivel carregar as sprints: ${result.error}`)
      return
    }

    setSprintRecords(result.records)

    if (selectFirstRecord && result.records.length) {
      applySprintRecord(result.records[0])
      return
    }

    if (!result.records.length) {
      setSprintMessage('Nenhuma sprint salva para o projeto BRAVO.')
    }
  }, [applySprintRecord])

  const upsertRecordInList = (record: SprintPlanningRecord) => {
    setSprintRecords(current => {
      const withoutRecord = current.filter(item => item.id !== record.id)
      return [record, ...withoutRecord].sort((a, b) => {
        const dateCompare = (b.startDate || '').localeCompare(a.startDate || '')
        return dateCompare || b.name.localeCompare(a.name)
      })
    })
  }

  const confirmDiscardSprintChanges = () => {
    if (!hasPlanningChanges && !hasDistributionChanges) return true

    return window.confirm('Existem alteracoes nao salvas na sprint atual. Deseja descartar essas alteracoes?')
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(LOCAL_DEVS_STORAGE_KEY, JSON.stringify(localDevs))
  }, [localDevs])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(LOCAL_POINTS_TYPE_STORAGE_KEY, localPointsType)
  }, [localPointsType])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(SPRINT_PLANNING_STORAGE_KEY, JSON.stringify(sprintPlanning))
  }, [sprintPlanning])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(SPRINT_DISTRIBUTION_STORAGE_KEY, JSON.stringify(distributionData))
  }, [distributionData])

  useEffect(() => {
    if (!isSprintEnabled) return

    setSelectedTeamId(NO_TEAM_VALUE)
    setLocalPointsType('hrs')
    refreshSprintRecords(false)
  }, [isSprintEnabled, refreshSprintRecords])

  useEffect(() => {
    let ignore = false

    if (!supabase) {
      setShowSupabaseWarning(true)
      setTeams([])
      return
    }

    ;(async () => {
      const { data, error } = await supabase.from('Teams').select('*').order('name', { ascending: true })

      if (ignore) return

      if (error || !data) {
        setShowSupabaseWarning(true)
        setTeams([])
        return
      }

      setShowSupabaseWarning(false)

      const formattedTeams = (data as Team[]).map(team => ({
        ...team,
        pointsType: normalizePointsType(team.pointsType),
      }))

      setTeams(formattedTeams)
      setSelectedTeamId(prev =>
        typeof prev === 'number' && formattedTeams.some(team => team.id === prev)
          ? prev
          : getDefaultTeamSelection(formattedTeams)
      )
    })()

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    if (!shouldUseLocalDistribution) return

    setDevs(localDevs)
  }, [localDevs, shouldUseLocalDistribution])

  useEffect(() => {
    let ignore = false

    if (isWithoutTeam || isSprintEnabled) return

    if (!supabase) {
      setShowSupabaseWarning(true)
      setDevs([])
      return
    }

    const currentTeam = teams.find(team => team.id === selectedTeamId)
    if (!currentTeam) {
      setDevs([])
      return
    }

    ;(async () => {
      const { data, error } = await supabase
        .from('Devs')
        .select('*')
        .eq('idTeam', selectedTeamId)
        .order('name', { ascending: true })

      if (ignore) return

      if (error || !data) {
        setShowSupabaseWarning(true)
        setDevs([])
        return
      }

      setShowSupabaseWarning(false)

      const formatted: Dev[] = (data as Partial<Dev>[]).map(dev => ({
        id: dev.id,
        idTeam: dev.idTeam ?? selectedTeamId,
        name: dev.name ?? '',
        capacity: dev.capacity ?? 14,
        points: 0,
        history: [],
        customPoints: '',
      }))

      setDevs(formatted)
    })()

    return () => {
      ignore = true
    }
  }, [isSprintEnabled, isWithoutTeam, selectedTeamId, teams])

  useEffect(() => {
    setCustomPointsMap({})
  }, [selectedTeamId])

  useEffect(() => {
    if (!isSprintEnabled && activeTab === 'sprint') {
      setActiveTab('distribution')
    }
  }, [activeTab, isSprintEnabled])

  const addDev = () => {
    const name = newDev.name.trim()
    const capacity = Number(newDev.capacity)

    if (!name || Number.isNaN(capacity) || capacity <= 0) return

    setCurrentDevs(prev => [
      ...prev,
      {
        idTeam: shouldUseLocalDistribution || typeof selectedTeamId !== 'number' ? undefined : selectedTeamId,
        name,
        capacity,
        points: 0,
        history: [],
        customPoints: '',
      },
    ])
    setNewDev({ name: '', capacity: '' })
  }

  const updateDev = (index: number, updated: Partial<Dev>) =>
    setCurrentDevs(prev => prev.map((dev, i) => (i === index ? { ...dev, ...updated } : dev)))

  const addPoints = (index: number, value: number, textValue?: string) => {
    const dev = devs[index]
    if (!dev) return
    const text = normalizeHistoryText(textValue)

    updateDev(index, {
      points: dev.points + value,
      history: [
        ...dev.history,
        { value, timestamp: new Date().toISOString(), ...(text ? { text } : {}) },
      ],
    })
  }

  const removeDev = (index: number) =>
    setCurrentDevs(prev => prev.filter((_, i) => i !== index))

  const updateCapacity = (index: number, value: string) => {
    const n = Number(value)
    if (!Number.isNaN(n)) updateDev(index, { capacity: n })
  }

  const removeHistoryItem = (devIndex: number, histIndex: number) => {
    const dev = devs[devIndex]
    const removed = dev?.history[histIndex]
    if (!dev || !removed) return

    updateDev(devIndex, {
      points: dev.points - removed.value,
      history: dev.history.filter((_, index) => index !== histIndex),
    })
  }

  const distributeSprintTasks = (planning: SprintPlanningData) => {
    const nextDevs: Dev[] = planning.members
      .filter(member => member.active && member.name.trim())
      .map(member => ({
        idTeam: undefined,
        name: member.name.trim(),
        capacity: member.capacity,
        points: 0,
        history: [],
        customPoints: '',
      }))

    setSelectedTeamId(NO_TEAM_VALUE)
    setLocalPointsType('hrs')
    setLocalDevs(nextDevs)
    setDevs(nextDevs)
    setCustomPointsMap({})
    setActiveTab('distribution')
  }

  const selectSprintRecord = (recordId: string) => {
    const record = sprintRecords.find(item => item.id === recordId)
    if (!record || record.id === selectedSprintRecord?.id) return
    if (!confirmDiscardSprintChanges()) return

    applySprintRecord(record)
  }

  const createNewSprintDraft = () => {
    if (!confirmDiscardSprintChanges()) return

    const emptyDistribution = createEmptySprintDistribution()
    setSelectedSprintRecord(null)
    setSprintPlanning(createEmptySprintPlanning())
    setPlanningSnapshot(JSON.stringify(createEmptySprintPlanning()))
    setLocalPointsType(emptyDistribution.pointsType)
    setLocalDevs(emptyDistribution.devs)
    setDevs(emptyDistribution.devs)
    setDistributionSnapshot(JSON.stringify(emptyDistribution))
    setCustomPointsMap({})
    setSprintMessage('Nova sprint em rascunho. Preencha os dados e salve na guia Sprint.')
    setPlanningSaveMessage('')
    setDistributionSaveMessage('')
    setSelectedTeamId(NO_TEAM_VALUE)
    setActiveTab('sprint')
  }

  const cloneSprintDraft = () => {
    if (!selectedSprintRecord && !sprintPlanning.sprintName.trim()) return
    if (!confirmDiscardSprintChanges()) return

    const sourcePlanning = selectedSprintRecord?.planningData ?? sprintPlanning
    const emptyDistribution = createEmptySprintDistribution()
    const memberIdMap = new Map<string, string>()
    const clonedMembers = sourcePlanning.members.map(member => {
      const nextId = createId()
      memberIdMap.set(member.id, nextId)
      return { ...member, id: nextId }
    })
    const clonedPlanning: SprintPlanningData = {
      ...sourcePlanning,
      sprintName: `${sourcePlanning.sprintName || selectedSprintRecord?.name || 'Sprint'} - Copia`,
      members: clonedMembers,
      tasks: sourcePlanning.tasks.map(task => ({
        ...task,
        id: createId(),
        memberId: task.memberId ? memberIdMap.get(task.memberId) : undefined,
      })),
    }

    setSelectedSprintRecord(null)
    setSprintPlanning(clonedPlanning)
    setPlanningSnapshot(JSON.stringify(createEmptySprintPlanning()))
    setLocalPointsType(emptyDistribution.pointsType)
    setLocalDevs(emptyDistribution.devs)
    setDevs(emptyDistribution.devs)
    setDistributionSnapshot(JSON.stringify(emptyDistribution))
    setCustomPointsMap({})
    setSprintMessage('Sprint clonada em rascunho. Ajuste o nome e salve na guia Sprint.')
    setPlanningSaveMessage('')
    setDistributionSaveMessage('')
    setSelectedTeamId(NO_TEAM_VALUE)
    setActiveTab('sprint')
  }

  const savePlanning = async () => {
    const sprintName = sprintPlanning.sprintName.trim()

    if (!sprintName) {
      setPlanningSaveMessage('Informe o nome da sprint antes de salvar.')
      return
    }

    if (!supabase) {
      setPlanningSnapshot(JSON.stringify(sprintPlanning))
      setPlanningSaveMessage('Supabase indisponivel. Dados da Sprint salvos apenas localmente.')
      return
    }

    setIsSavingPlanning(true)
    setPlanningSaveMessage('')

    const result = selectedSprintRecord
      ? await updateSprintPlanningRecord(
          selectedSprintRecord.id,
          sprintPlanning,
          selectedSprintRecord.planningUpdatedAt,
        )
      : await saveNewSprintPlanningRecord(sprintPlanning, distributionData, SPRINT_PROJECT)

    setIsSavingPlanning(false)

    if (result.conflict) {
      setPlanningSaveMessage('A Sprint foi alterada por outra pessoa. Recarregue a sprint antes de salvar novamente.')
      await refreshSprintRecords(false)
      return
    }

    if (result.error) {
      setPlanningSaveMessage(`Nao foi possivel salvar a Sprint: ${result.error}`)
      return
    }

    if (!result.record) {
      setPlanningSaveMessage('Nao foi possivel salvar a Sprint: retorno invalido do Supabase.')
      return
    }

    const savedRecord = result.record
    setSelectedSprintRecord(savedRecord)
    upsertRecordInList(savedRecord)
    setSprintPlanning(savedRecord.planningData)
    setPlanningSnapshot(JSON.stringify(savedRecord.planningData))

    if (!selectedSprintRecord) {
      setDistributionSnapshot(JSON.stringify(distributionData))
    }

    setPlanningSaveMessage('Sprint salva no Supabase.')
    setSprintMessage('')
  }

  const saveDistribution = async () => {
    if (!selectedSprintRecord) {
      setDistributionSaveMessage('Salve a Sprint antes de salvar a distribuicao.')
      return
    }

    if (!supabase) {
      setDistributionSnapshot(JSON.stringify(distributionData))
      setDistributionSaveMessage('Supabase indisponivel. Distribuicao salva apenas localmente.')
      return
    }

    setIsSavingDistribution(true)
    setDistributionSaveMessage('')

    const result = await updateSprintDistributionRecord(
      selectedSprintRecord.id,
      distributionData,
      selectedSprintRecord.distributionUpdatedAt,
    )

    setIsSavingDistribution(false)

    if (result.conflict) {
      setDistributionSaveMessage('A distribuicao foi alterada por outra pessoa. Recarregue a sprint antes de salvar novamente.')
      await refreshSprintRecords(false)
      return
    }

    if (result.error) {
      setDistributionSaveMessage(`Nao foi possivel salvar a distribuicao: ${result.error}`)
      return
    }

    if (!result.record) {
      setDistributionSaveMessage('Nao foi possivel salvar a distribuicao: retorno invalido do Supabase.')
      return
    }

    const savedRecord = result.record
    setSelectedSprintRecord(savedRecord)
    upsertRecordInList(savedRecord)
    setDistributionSnapshot(JSON.stringify(distributionData))
    setDistributionSaveMessage('Distribuicao salva no Supabase.')
    setSprintMessage('')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {showSupabaseWarning && activeTab === 'distribution' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
            Nao foi possivel conectar ao Supabase no momento. Se precisar restaurar a sincronizacao dos times, entre em contato com o mestre Lucas para reiniciar o Supabase.
          </div>
        )}

        <Header theme={theme} setTheme={setTheme} setShowSettings={setShowSettings} />

        {isSprintEnabled && (
          <>
            <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
              <div className="grid gap-3 lg:grid-cols-[140px_minmax(260px,1fr)_auto] lg:items-end">
                <label className="space-y-1">
                  <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">Projeto</span>
                  <input
                    value={SPRINT_PROJECT}
                    readOnly
                    className="h-10 w-full rounded border bg-gray-50 p-2 text-sm dark:border-gray-600 dark:bg-gray-900/40"
                  />
                </label>
                <label className="space-y-1">
                  <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">Sprint salva</span>
                  <select
                    value={selectedSprintRecord?.id ?? ''}
                    onChange={event => selectSprintRecord(event.target.value)}
                    disabled={isLoadingSprints || !sprintRecords.length}
                    className="h-10 w-full rounded border bg-white p-2 dark:border-gray-600 dark:bg-gray-700"
                  >
                    <option value="">
                      {isLoadingSprints
                        ? 'Carregando sprints...'
                        : sprintRecords.length
                          ? 'Rascunho nao salvo'
                          : 'Nenhuma sprint salva'}
                    </option>
                    {sprintRecords.map(record => (
                      <option key={record.id} value={record.id}>
                        {record.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={createNewSprintDraft}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded bg-blue-500 px-3 text-white hover:bg-blue-600"
                  >
                    Nova Sprint
                  </button>
                  <button
                    onClick={cloneSprintDraft}
                    disabled={!selectedSprintRecord && !sprintPlanning.sprintName.trim()}
                    className="inline-flex h-10 items-center justify-center rounded bg-gray-100 px-3 text-gray-800 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                  >
                    Clonar Sprint
                  </button>
                  <button
                    onClick={() => refreshSprintRecords(false)}
                    disabled={isLoadingSprints}
                    className="inline-flex h-10 items-center justify-center rounded bg-gray-100 px-3 text-gray-800 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                  >
                    Atualizar lista
                  </button>
                </div>
              </div>
              {sprintMessage && (
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{sprintMessage}</p>
              )}
            </section>

            <div className="flex gap-2 rounded-lg bg-white p-1 shadow dark:bg-gray-800">
              <button
                onClick={() => setActiveTab('distribution')}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                  activeTab === 'distribution'
                    ? 'bg-green-700 text-white'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Distribuicao
              </button>
              <button
                onClick={() => setActiveTab('sprint')}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                  activeTab === 'sprint'
                    ? 'bg-green-700 text-white'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Sprint
              </button>
            </div>
          </>
        )}

        {activeTab === 'distribution' || !isSprintEnabled ? (
          <>
            {isSprintEnabled ? (
              <section className="rounded bg-white p-4 shadow dark:bg-gray-800">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Distribuicao</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {selectedSprintRecord
                        ? `${selectedSprintRecord.name} - unidade hrs`
                        : 'Rascunho sem sprint salva - unidade hrs'}
                    </p>
                  </div>
                  <button
                    onClick={saveDistribution}
                    disabled={isSavingDistribution || !selectedSprintRecord}
                    className="inline-flex items-center justify-center rounded bg-blue-500 px-3 py-2 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSavingDistribution ? 'Salvando' : hasDistributionChanges ? 'Salvar distribuicao' : 'Salvar distribuicao'}
                  </button>
                </div>
                {distributionSaveMessage && (
                  <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{distributionSaveMessage}</p>
                )}
              </section>
            ) : (
              <TeamSelector
                teams={teams}
                selectedTeamId={selectedTeamId}
                setSelectedTeamId={setSelectedTeamId}
                localPointsType={localPointsType}
                setLocalPointsType={setLocalPointsType}
              />
            )}

            <AddDevForm
              newDev={newDev}
              setNewDev={setNewDev}
              addDev={addDev}
              pointsType={selectedPointsType}
            />

            <div className="space-y-4">
              {devs.map((dev, idx) => (
                <DevCard
                  key={`${selectedTeamId}-${idx}`}
                  dev={dev}
                  index={idx}
                  pointsType={selectedPointsType}
                  updateCapacity={updateCapacity}
                  addPoints={addPoints}
                  customPointsMap={customPointsMap}
                  setCustomPointsMap={setCustomPointsMap}
                  removeDev={removeDev}
                  removeHistoryItem={removeHistoryItem}
                  storyOptions={isSprintEnabled ? sprintStoryOptions : []}
                />
              ))}

              {!!devs.length && <Summary devs={devs} pointsType={selectedPointsType} />}
            </div>
          </>
        ) : (
          <SprintPlanning
            planning={sprintPlanning}
            setPlanning={setSprintPlanning}
            distribution={distributionData}
            onDistributeTasks={distributeSprintTasks}
            onSavePlanning={savePlanning}
            isSavingPlanning={isSavingPlanning}
            savePlanningMessage={planningSaveMessage}
            hasPlanningChanges={hasPlanningChanges || !selectedSprintRecord}
          />
        )}
      </div>

      {showSettings && (
        <SettingsModal
          isSprintEnabled={isSprintEnabled}
          setIsSprintEnabled={setIsSprintEnabled}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}

export default App
