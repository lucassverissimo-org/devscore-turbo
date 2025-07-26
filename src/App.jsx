// src/App.jsx
import React, { useState, useEffect } from 'react'
import { useTheme } from './ThemeProvider.jsx'
import { supabase } from './lib/supabase'
import Header from './components/Header'
import TeamSelector from './components/TeamSelector'
import GlobalCapacity from './components/GlobalCapacity'
import AddDevForm from './components/AddDevForm'
import DevCard from './components/DevCard'
import Summary from './components/Summary'
import SettingsModal from './components/SettingsModal'
import { getPointValues } from './lib/utils/getPointValues'

export default function App() {
  const { theme, setTheme } = useTheme()

  const [showSettings, setShowSettings] = useState(false)
  const [teams, setTeams] = useState([])
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [devs, setDevs] = useState([])
  const [newDev, setNewDev] = useState({ name: '', capacity: '' })
  const [customPointsMap, setCustomPointsMap] = useState({})
  const [globalCapacity, setGlobalCapacity] = useState('')

  useEffect(() => {
    const fetchTeams = async () => {
      const { data, error } = await supabase.from('Teams').select('*')
      if (!error) {
        setTeams(data)
        if (data.length > 0) setSelectedTeamId(data[0].id)
      }
    }
    fetchTeams()
  }, [])

  useEffect(() => {
    const fetchDevs = async () => {
      if (!selectedTeamId) return
      const { data, error } = await supabase
        .from('Devs')
        .select('*')
        .eq('idTeam', selectedTeamId)
        .order('name', { ascending: true })
      if (!error) {
        const formatted = data.map(dev => ({
          ...dev,
          capacity: dev.capacity || 14,
          points: 0,
          history: [],
          customPoints: '',
        }))
        setDevs(formatted)
        setSelectedTeam(teams.find(t => t.id == selectedTeamId))
      }
    }
    fetchDevs()
  }, [selectedTeamId])

  const addDev = () => {
    if (!newDev.name || !newDev.capacity) return
    setDevs([
      ...devs,
      { ...newDev, capacity: Number(newDev.capacity), points: 0, history: [], customPoints: '' },
    ])
    setNewDev({ name: '', capacity: '' })
  }

  const updateDev = (index, updatedDev) => {
    const updated = [...devs]
    updated[index] = { ...updated[index], ...updatedDev }
    setDevs(updated)
  }

  const addPoints = (index, value) => {
    const dev = devs[index]
    const updatedPoints = dev.points + value
    const updatedHistory = [...dev.history, { value, timestamp: new Date().toISOString() }]
    updateDev(index, { points: updatedPoints, history: updatedHistory })
  }

  const removeDev = (index) => {
    const updated = [...devs]
    updated.splice(index, 1)
    setDevs(updated)
  }

  const updateCapacity = (index, value) => {
    const newCap = Number(value)
    if (!isNaN(newCap)) updateDev(index, { capacity: newCap })
  }

  const removeHistoryItem = (devIndex, histIndex) => {
    const dev = devs[devIndex]
    const removed = dev.history[histIndex]
    const newPoints = dev.points - removed.value
    const newHistory = dev.history.filter((_, i) => i !== histIndex)
    updateDev(devIndex, { points: newPoints, history: newHistory })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Header theme={theme} setTheme={setTheme} setShowSettings={setShowSettings} />
        <TeamSelector teams={teams} selectedTeamId={selectedTeamId} setSelectedTeamId={setSelectedTeamId} />
        <GlobalCapacity globalCapacity={globalCapacity} setGlobalCapacity={setGlobalCapacity} devs={devs} setDevs={setDevs} />
        <AddDevForm newDev={newDev} setNewDev={setNewDev} addDev={addDev} />

        <div className="space-y-4">
          {devs.map((dev, idx) => (
            <DevCard
              key={`${selectedTeamId}-${idx}`}
              dev={dev}
              index={idx}
              selectedTeam={selectedTeam}
              updateCapacity={updateCapacity}
              addPoints={addPoints}
              customPointsMap={customPointsMap}
              setCustomPointsMap={setCustomPointsMap}
              removeDev={removeDev}
              removeHistoryItem={removeHistoryItem}
            />
          ))}
          {devs.length > 0 && <Summary devs={devs} selectedTeam={selectedTeam} />}
        </div>
      </div>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}