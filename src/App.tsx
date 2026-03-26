import React, { useEffect, useState } from 'react'
import { useTheme } from './ThemeProvider'
import { supabase } from './lib/supabase'

import Header from './components/Header'
import TeamSelector from './components/TeamSelector'
import GlobalCapacity from './components/GlobalCapacity'
import AddDevForm from './components/AddDevForm'
import DevCard from './components/DevCard'
import Summary from './components/Summary'
import SettingsModal from './components/SettingsModal'
import { Dev, NO_TEAM_VALUE, PointsType, Team, TeamSelection } from './types'

type NewDev = { name: string; capacity: string }

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
              entries.push({ value: historyItem.value, timestamp: historyItem.timestamp })
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

  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<TeamSelection>(NO_TEAM_VALUE)
  const [devs, setDevs] = useState<Dev[]>([])
  const [localDevs, setLocalDevs] = useState<Dev[]>(() => parseStoredLocalDevs())
  const [localPointsType, setLocalPointsType] = useState<PointsType>(() => parseStoredPointsType())
  const [newDev, setNewDev] = useState<NewDev>({ name: '', capacity: '' })

  const [customPointsMap, setCustomPointsMap] = useState<Record<number, string>>({})
  const [globalCapacity, setGlobalCapacity] = useState<string>('')

  const isWithoutTeam = selectedTeamId === NO_TEAM_VALUE
  const selectedTeam = isWithoutTeam
    ? { id: undefined, name: 'Nenhum', pointsType: localPointsType }
    : teams.find(team => team.id === selectedTeamId)
  const selectedPointsType = selectedTeam?.pointsType ?? localPointsType

  const setCurrentDevs: React.Dispatch<React.SetStateAction<Dev[]>> = value => {
    const nextDevs =
      typeof value === 'function' ? (value as (prev: Dev[]) => Dev[])(devs) : value

    setDevs(nextDevs)

    if (isWithoutTeam) {
      setLocalDevs(nextDevs)
    }
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
    if (!isWithoutTeam) return

    setDevs(localDevs)
  }, [isWithoutTeam, localDevs])

  useEffect(() => {
    let ignore = false

    if (isWithoutTeam) return

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
  }, [isWithoutTeam, selectedTeamId, teams])

  useEffect(() => {
    setCustomPointsMap({})
  }, [selectedTeamId])

  const addDev = () => {
    const name = newDev.name.trim()
    const capacity = Number(newDev.capacity)

    if (!name || Number.isNaN(capacity) || capacity <= 0) return

    setCurrentDevs(prev => [
      ...prev,
      {
        idTeam: isWithoutTeam || typeof selectedTeamId !== 'number' ? undefined : selectedTeamId,
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

  const addPoints = (index: number, value: number) => {
    const dev = devs[index]
    if (!dev) return

    updateDev(index, {
      points: dev.points + value,
      history: [...dev.history, { value, timestamp: new Date().toISOString() }],
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {showSupabaseWarning && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
            Nao foi possivel conectar ao Supabase no momento. Se precisar restaurar a sincronizacao dos times, entre em contato com o mestre Lucas para reiniciar o Supabase.
          </div>
        )}

        <Header theme={theme} setTheme={setTheme} setShowSettings={setShowSettings} />

        <TeamSelector
          teams={teams}
          selectedTeamId={selectedTeamId}
          setSelectedTeamId={setSelectedTeamId}
          localPointsType={localPointsType}
          setLocalPointsType={setLocalPointsType}
        />

        <GlobalCapacity
          globalCapacity={globalCapacity}
          setGlobalCapacity={setGlobalCapacity}
          devs={devs}
          setDevs={setCurrentDevs}
        />

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
            />
          ))}

          {!!devs.length && <Summary devs={devs} pointsType={selectedPointsType} />}
        </div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}

export default App
