import React, { useState, useEffect } from 'react'
import { useTheme } from './ThemeProvider'
import { supabase } from './lib/supabase'

import Header from './components/Header'
import TeamSelector from './components/TeamSelector'
import GlobalCapacity from './components/GlobalCapacity'
import AddDevForm from './components/AddDevForm'
import DevCard from './components/DevCard'
import Summary from './components/Summary'
import SettingsModal from './components/SettingsModal'
import { Team, Dev } from './types'

type NewDev = { name: string; capacity: string }

function App() {
  const { theme, setTheme } = useTheme()  
  const [showSettings, setShowSettings] = useState(false)

  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<number | undefined>()
  const [selectedTeam, setSelectedTeam] = useState<Team | undefined>()

  const [devs, setDevs] = useState<Dev[]>([])
  const [newDev, setNewDev] = useState<NewDev>({ name: '', capacity: '' })

  const [customPointsMap, setCustomPointsMap] = useState<Record<number, string>>({})
  const [globalCapacity, setGlobalCapacity] = useState<string>('')

  useEffect(() => {
    ;(async () => {
      const { data, error } = await supabase.from('Teams').select('*')
      if (!error && data) {
        setTeams(data as Team[])
        if (data.length) setSelectedTeamId(data[0].id)
      }
    })()
  }, [])

  useEffect(() => {
    if (!selectedTeamId) return
    ;(async () => {
      const { data, error } = await supabase
        .from('Devs')
        .select('*')
        .eq('idTeam', selectedTeamId)
        .order('name', { ascending: true })

      if (!error && data) {
        const formatted: Dev[] = (data as Partial<Dev>[]).map(d => ({
          id: d.id,
          idTeam: d.idTeam ?? selectedTeamId,
          name: d.name ?? '',
          capacity: d.capacity ?? 14,
          points: 0,
          history: [],
          customPoints: '',
        }))
        setDevs(formatted)
        setSelectedTeam(teams.find(t => t.id === selectedTeamId))
      }
    })()
  }, [selectedTeamId, teams])

  const addDev = () => {
    if (!newDev.name.trim() || !newDev.capacity.trim()) return
    setDevs(prev => [
      ...prev,
      {
        idTeam: selectedTeamId,
        name: newDev.name,
        capacity: Number(newDev.capacity),
        points: 0,
        history: [],
        customPoints: '',
      },
    ])
    setNewDev({ name: '', capacity: '' })
  }

  const updateDev = (index: number, updated: Partial<Dev>) =>
    setDevs(prev => prev.map((d, i) => (i === index ? { ...d, ...updated } : d)))

  const addPoints = (index: number, value: number) => {
    const dev = devs[index]
    updateDev(index, {
      points: dev.points + value,
      history: [...dev.history, { value, timestamp: new Date().toISOString() }],
    })
  }

  const removeDev = (index: number) =>
    setDevs(prev => prev.filter((_, i) => i !== index))

  const updateCapacity = (index: number, value: string) => {
    const n = Number(value)
    if (!Number.isNaN(n)) updateDev(index, { capacity: n })
  }

  const removeHistoryItem = (devIndex: number, histIndex: number) => {
    const dev = devs[devIndex]
    const [removed] = dev.history.splice(histIndex, 1)
    updateDev(devIndex, {
      points: dev.points - removed.value,
      history: [...dev.history],
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Header theme={theme} setTheme={setTheme} setShowSettings={setShowSettings} />

        <TeamSelector
          teams={teams}
          selectedTeamId={selectedTeamId}
          setSelectedTeamId={setSelectedTeamId}
        />

        <GlobalCapacity
          globalCapacity={globalCapacity}
          setGlobalCapacity={setGlobalCapacity}
          devs={devs}
          setDevs={setDevs}
        />

        <AddDevForm newDev={newDev} setNewDev={setNewDev} addDev={addDev} />

        <div className="space-y-4">
          {devs.map((dev, idx) => (
            <DevCard
              key={`${selectedTeamId}-${idx}`}
              dev={dev}
              index={idx}
              selectedTeam={selectedTeam!}
              updateCapacity={updateCapacity}
              addPoints={addPoints}
              customPointsMap={customPointsMap}
              setCustomPointsMap={setCustomPointsMap}
              removeDev={removeDev}
              removeHistoryItem={removeHistoryItem}
            />
          ))}

          {!!devs.length && <Summary devs={devs} selectedTeam={selectedTeam} />}
        </div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}

export default App